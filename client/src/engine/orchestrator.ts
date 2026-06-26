import type { Region } from '@shared/catalog.types'
import type {
  NetReport,
  ProbeStats,
  StunLossData,
  ThroughputResult,
  BufferbloatResult,
  LossSummary,
  GameVerdict,
} from '@shared/protocol'
import { GAMES, gameRegions } from '@shared/catalog'
import { REGIONS } from '@shared/regions'
import { GENRE_BANDS } from '@shared/thresholds'
import {
  grade,
  bloatGrade,
  rankToVerdict,
  limitingFactor,
  type MetricInputs,
} from '@shared/grading'
import { NetSocket } from './ws'
import { pickBackend, measureDownload, measureUpload, LatencySampler } from './throughput'
import { median, meanAbsDev } from './stats'
import { detectMode } from './mode'
import { measureBrowserLoss } from './loss'
import { store } from '../state/store'

interface Measured {
  regions: Record<string, ProbeStats>
  lossIdle: StunLossData | null
  lossLoaded: StunLossData | null
  download: ThroughputResult | null
  upload: ThroughputResult | null
  idleMedian: number
  loadedMedianDown: number | null // null = no loaded samples collected
  loadedMedianUp: number | null
}

/** Worst measured loss across idle/loaded runs, or null if neither could be measured. */
function worstLossOrNull(a: StunLossData | null, b: StunLossData | null): number | null {
  const vals: number[] = []
  if (a?.available) vals.push(a.lossPct)
  if (b?.available) vals.push(b.lossPct)
  return vals.length ? Math.max(...vals) : null
}

function bestRegion(regions: Record<string, ProbeStats>, allowed?: Region[]): Region | null {
  let best: { id: string; median: number } | null = null
  for (const s of Object.values(regions)) {
    if (allowed && !allowed.includes(s.id as Region)) continue
    if (s.median != null && (best == null || s.median < best.median)) best = { id: s.id, median: s.median }
  }
  return (best?.id as Region) ?? null
}

function buildBufferbloat(m: Measured): BufferbloatResult {
  const deltas: number[] = []
  if (m.loadedMedianDown != null) deltas.push(m.loadedMedianDown - m.idleMedian)
  if (m.loadedMedianUp != null) deltas.push(m.loadedMedianUp - m.idleMedian)
  const available = deltas.length > 0
  const worstDelta = available ? Math.max(0, ...deltas) : 0
  const ld = m.loadedMedianDown ?? m.idleMedian
  const lu = m.loadedMedianUp ?? m.idleMedian
  const worstLoaded = Math.max(ld, lu)
  return {
    available,
    idleMedian: m.idleMedian,
    loadedMedianDown: ld,
    loadedMedianUp: lu,
    deltaDownMs: m.loadedMedianDown != null ? m.loadedMedianDown - m.idleMedian : 0,
    deltaUpMs: m.loadedMedianUp != null ? m.loadedMedianUp - m.idleMedian : 0,
    worstDeltaMs: worstDelta,
    rpmIdle: m.idleMedian > 0 ? 60000 / m.idleMedian : 0,
    rpmLoaded: worstLoaded > 0 ? 60000 / worstLoaded : 0,
    grade: available ? bloatGrade(worstDelta) : null,
  }
}

export function assembleReport(m: Measured, selectedGameId: string, region: Region | null): NetReport {
  // Resolve the region WITHIN the regions this game actually operates in.
  // Only honor an explicit region if it's a real region for this game AND was
  // reachable; otherwise grade the best measured in-game region and report THAT
  // (never grade a region off invented sentinel values, or one the game lacks).
  const allowed = gameRegions(selectedGameId)
  const allowList = allowed.length ? allowed : undefined
  const usable = (s?: ProbeStats): boolean => !!s && s.median != null
  let chosen: Region
  if (region && (!allowList || allowList.includes(region)) && usable(m.regions[region])) {
    chosen = region
  } else {
    chosen = bestRegion(m.regions, allowList) ?? allowed[0] ?? region ?? 'NA-East'
  }
  const selectedPing = m.regions[chosen] ?? null
  const bufferbloat = buildBufferbloat(m)
  const lossPct = worstLossOrNull(m.lossIdle, m.lossLoaded)
  const dl = m.download?.meanMbps ?? 0
  const ul = m.upload?.meanMbps ?? 0

  const metrics: MetricInputs = {
    ping_ms: selectedPing?.median ?? 999,
    jitter_ms: selectedPing?.jitter ?? 99,
    loss_pct: lossPct,
    dl_mbps: dl,
    ul_mbps: ul,
    rtt_idle: bufferbloat.idleMedian,
    rtt_loaded: bufferbloat.available ? bufferbloat.idleMedian + bufferbloat.worstDeltaMs : null,
  }

  const verdicts: GameVerdict[] = GAMES.map((g) => {
    const r = grade(metrics, GENRE_BANDS[g.genre])
    return {
      ...r,
      gameId: g.id,
      name: g.name,
      genre: g.genre,
      state: rankToVerdict(r.rank),
      reason: limitingFactor(r),
    }
  })

  const loss: LossSummary = {
    method: m.lossIdle?.available || m.lossLoaded?.available ? 'stun-udp' : 'unavailable',
    idle: m.lossIdle,
    loaded: m.lossLoaded,
    lossPct,
    jitterMs: m.lossIdle?.jitter ?? m.lossLoaded?.jitter ?? null,
  }

  const overallRank = verdicts.find((v) => v.gameId === selectedGameId)?.rank ?? null

  return {
    startedAt: Date.now(),
    region: chosen,
    selectedGameId,
    regions: Object.values(m.regions),
    selectedPing,
    download: m.download,
    upload: m.upload,
    bufferbloat,
    loss,
    overallRank,
    verdicts,
  }
}

function measuredFromStore(): Measured {
  const s = store.value
  return {
    regions: s.regions,
    lossIdle: s.lossIdle,
    lossLoaded: s.lossLoaded,
    download: s.download,
    upload: s.upload,
    idleMedian: s.idleMedian,
    loadedMedianDown: s.loadedDownMedian,
    loadedMedianUp: s.loadedUpMedian,
  }
}

/** Recompute verdicts for a new region/game from already-measured data (instant). */
export function recompute(opts: { region?: Region; gameId?: string }): void {
  const s = store.value
  if (!s.report) {
    store.set({
      selectedRegion: opts.region ?? s.selectedRegion,
      selectedGameId: opts.gameId ?? s.selectedGameId,
    })
    return
  }
  const gameId = opts.gameId ?? s.selectedGameId
  if (s.mode === 'hosted') {
    // No regions in hosted mode — just re-grade with the same browser metrics.
    const idleJitter = s.report.selectedPing?.jitter ?? 0
    const report = assembleHostedReport(measuredFromStore(), gameId, idleJitter)
    store.set({ selectedGameId: gameId, report }, true)
    return
  }
  const region = opts.region ?? s.selectedRegion
  const report = assembleReport(measuredFromStore(), gameId, region)
  // report.region is the region actually graded (may differ if the requested
  // one was unreachable) — keep the highlight consistent with it.
  store.set({ selectedGameId: gameId, selectedRegion: report.region, report }, true)
}

/** Dispatch to the local (full) or hosted (browser-only) measurement flow. */
export async function runTest(opts: { gameId: string; region: Region | null }): Promise<void> {
  if (store.value.status === 'running') return // guard against concurrent runs
  const mode = await detectMode()
  store.reset(opts.gameId, opts.region)
  store.set({ status: 'running', mode, progress: 0.02 }, true)
  return mode === 'hosted' ? runHosted(opts) : runLocal(opts)
}

async function runLocal(opts: { gameId: string; region: Region | null }): Promise<void> {
  const ws = new NetSocket()
  try {
    await ws.ready()
    const backend = await pickBackend()
    store.set({ backendLabel: backend === 'cloudflare' ? 'Cloudflare' : 'Local loopback' })

    // ── Phase 1: region sweep (server TCP) + idle latency baseline (browser CF) ──
    store.set({ phase: 'regions', phaseLabel: 'Mapping regions & latency', progress: 0.05 }, true)
    const idleSampler = new LatencySampler(backend, (rtt) => store.pushLatency(rtt))
    const idleP = idleSampler.run(3200, 160)
    const targets = REGIONS.map((r) => ({ id: r.region, host: r.host, port: r.port }))
    await ws.probe(targets, { count: 6, timeoutMs: 1500, gapMs: 40, onResult: (s) => store.putRegion(s) })
    idleSampler.stop()
    await idleP
    const idleMedian = median(idleSampler.samples())

    const allowed = gameRegions(opts.gameId)
    const allowList = allowed.length ? allowed : undefined
    const chosenRegion: Region =
      (opts.region && (!allowList || allowList.includes(opts.region)) ? opts.region : null) ??
      bestRegion(store.value.regions, allowList) ??
      allowed[0] ??
      'NA-East'
    store.set({ selectedRegion: chosenRegion })

    // ── Phase 2: idle packet loss (server STUN UDP) ──
    store.set({ phase: 'loss', phaseLabel: 'Measuring packet loss (UDP)', progress: 0.28 }, true)
    const lossIdle = await ws.loss('idle', { count: 150, ratePps: 50, timeoutMs: 1500 })
    store.set({ lossIdle })

    // ── Phase 3: download + loaded latency + loaded loss (concurrent) ──
    store.set({ phase: 'download', phaseLabel: 'Download + bufferbloat', progress: 0.45 }, true)
    const downSampler = new LatencySampler(backend, (rtt) => store.pushLatency(rtt))
    const downSamplerP = downSampler.run(10000, 160)
    const lossLoadedP = ws.loss('loaded', { count: 200, ratePps: 50, timeoutMs: 1500 })
    const download = await measureDownload({ backend, durationMs: 10000, onSample: (mbps) => store.set({ liveDownMbps: mbps }) })
    downSampler.stop()
    await downSamplerP
    const lossLoaded = await lossLoadedP
    store.set({ download, lossLoaded })
    // null (not idleMedian) when probes couldn't complete under load — so we
    // report bufferbloat as "unmeasured" rather than a falsely perfect A+.
    const loadedMedianDown = downSampler.samples().length ? median(downSampler.samples()) : null

    // ── Phase 4: upload + loaded latency ──
    store.set({ phase: 'upload', phaseLabel: 'Upload + bufferbloat', progress: 0.7 }, true)
    const upSampler = new LatencySampler(backend, (rtt) => store.pushLatency(rtt))
    const upSamplerP = upSampler.run(10000, 160)
    const upload = await measureUpload({ backend, durationMs: 10000, onSample: (mbps) => store.set({ liveUpMbps: mbps }) })
    upSampler.stop()
    await upSamplerP
    store.set({ upload })
    const loadedMedianUp = upSampler.samples().length ? median(upSampler.samples()) : null

    // ── Phase 5: compute + grade ──
    store.set({ phase: 'compute', phaseLabel: 'Scoring', progress: 0.95 }, true)
    const measured: Measured = {
      regions: store.value.regions,
      lossIdle,
      lossLoaded,
      download,
      upload,
      idleMedian,
      loadedMedianDown,
      loadedMedianUp,
    }
    const report = assembleReport(measured, opts.gameId, chosenRegion)
    store.set({
      report,
      bufferbloat: report.bufferbloat,
      idleMedian,
      loadedDownMedian: loadedMedianDown,
      loadedUpMedian: loadedMedianUp,
      selectedRegion: report.region,
      status: 'done',
      phase: null,
      progress: 1,
    }, true)
  } catch (e) {
    store.set({ status: 'error', error: e instanceof Error ? e.message : 'unknown error' }, true)
  } finally {
    ws.abort() // tell the server to stop any in-flight probe/loss run
    ws.close()
  }
}

/**
 * Hosted (Cloudflare Pages) report: no per-game-region ping (browsers can't do
 * raw TCP/UDP), so we grade against the generic internet RTT to the throughput
 * endpoint plus browser-measured loss/bufferbloat/throughput. The per-game
 * verdicts still apply each genre's thresholds — clearly an approximation of the
 * real per-region ping you'd get by running NETPULSE locally.
 */
function assembleHostedReport(m: Measured, selectedGameId: string, idleJitter: number): NetReport {
  const bufferbloat = buildBufferbloat(m)
  const lossPct = worstLossOrNull(m.lossIdle, m.lossLoaded)
  const dl = m.download?.meanMbps ?? 0
  const ul = m.upload?.meanMbps ?? 0
  const ping = m.idleMedian

  const metrics: MetricInputs = {
    ping_ms: ping > 0 ? ping : 999,
    jitter_ms: idleJitter,
    loss_pct: lossPct,
    dl_mbps: dl,
    ul_mbps: ul,
    rtt_idle: bufferbloat.idleMedian,
    rtt_loaded: bufferbloat.available ? bufferbloat.idleMedian + bufferbloat.worstDeltaMs : null,
  }

  const verdicts: GameVerdict[] = GAMES.map((g) => {
    const r = grade(metrics, GENRE_BANDS[g.genre])
    return { ...r, gameId: g.id, name: g.name, genre: g.genre, state: rankToVerdict(r.rank), reason: limitingFactor(r) }
  })

  const loss: LossSummary = {
    method: m.lossIdle?.available || m.lossLoaded?.available ? 'webrtc' : 'unavailable',
    idle: m.lossIdle,
    loaded: m.lossLoaded,
    lossPct,
    jitterMs: m.lossIdle?.jitter ?? m.lossLoaded?.jitter ?? null,
  }

  const selectedPing: ProbeStats = {
    id: 'internet', host: 'cloudflare-anycast', port: 443, ip: null,
    samples: 0, received: 0, lossPct: 0,
    min: ping || null, avg: ping || null, median: ping || null, jitter: idleJitter,
  }

  const overallRank = verdicts.find((v) => v.gameId === selectedGameId)?.rank ?? null

  return {
    startedAt: Date.now(),
    region: 'NA-East', // placeholder; the region map is hidden in hosted mode
    selectedGameId,
    regions: [],
    selectedPing,
    download: m.download,
    upload: m.upload,
    bufferbloat,
    loss,
    overallRank,
    verdicts,
  }
}

async function runHosted(opts: { gameId: string; region: Region | null }): Promise<void> {
  void opts.region
  try {
    const backend = await pickBackend()
    store.set({ backendLabel: backend === 'cloudflare' ? 'Cloudflare' : 'Local loopback' })

    // Phase 1: idle latency to the throughput endpoint (generic internet RTT)
    store.set({ phase: 'regions', progress: 0.08 }, true)
    const idleSampler = new LatencySampler(backend, (rtt) => store.pushLatency(rtt))
    await idleSampler.run(3500, 160)
    const idleSamples = idleSampler.samples()
    const idleMedian = median(idleSamples)
    const idleJitter = meanAbsDev(idleSamples)

    // Phase 2: packet loss via browser WebRTC (Cloudflare TURN loopback)
    store.set({ phase: 'loss', progress: 0.3 }, true)
    const lossIdle = await measureBrowserLoss({ count: 200, ratePps: 50 })
    store.set({ lossIdle })

    // Phase 3: download + loaded latency
    store.set({ phase: 'download', progress: 0.45 }, true)
    const downSampler = new LatencySampler(backend, (rtt) => store.pushLatency(rtt))
    const downP = downSampler.run(10000, 160)
    const download = await measureDownload({ backend, durationMs: 10000, onSample: (mbps) => store.set({ liveDownMbps: mbps }) })
    downSampler.stop()
    await downP
    store.set({ download })
    const loadedMedianDown = downSampler.samples().length ? median(downSampler.samples()) : null

    // Phase 4: upload + loaded latency
    store.set({ phase: 'upload', progress: 0.7 }, true)
    const upSampler = new LatencySampler(backend, (rtt) => store.pushLatency(rtt))
    const upP = upSampler.run(10000, 160)
    const upload = await measureUpload({ backend, durationMs: 10000, onSample: (mbps) => store.set({ liveUpMbps: mbps }) })
    upSampler.stop()
    await upP
    store.set({ upload })
    const loadedMedianUp = upSampler.samples().length ? median(upSampler.samples()) : null

    // Phase 5: compute + grade
    store.set({ phase: 'compute', progress: 0.95 }, true)
    const measured: Measured = {
      regions: {},
      lossIdle,
      lossLoaded: null,
      download,
      upload,
      idleMedian,
      loadedMedianDown,
      loadedMedianUp,
    }
    const report = assembleHostedReport(measured, opts.gameId, idleJitter)
    store.set({
      report,
      bufferbloat: report.bufferbloat,
      idleMedian,
      loadedDownMedian: loadedMedianDown,
      loadedUpMedian: loadedMedianUp,
      status: 'done',
      phase: null,
      progress: 1,
    }, true)
  } catch (e) {
    store.set({ status: 'error', error: e instanceof Error ? e.message : 'unknown error' }, true)
  }
}
