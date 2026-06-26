import type { ThroughputResult, ThroughputMethod } from '@shared/protocol'
import { bytesToMbps } from './stats'

// Throughput + loaded-latency are measured against Cloudflare's public speed
// endpoints (real internet path, CORS-enabled) — measuring against the local
// server would only test the loopback. Falls back to the local server, clearly
// labeled 'loopback', if Cloudflare is unreachable.

const CF_BASE = 'https://speed.cloudflare.com'

function downUrl(backend: ThroughputMethod, bytes: number): string {
  const n = Math.floor(performance.now() * 1000) % 1_000_000
  return backend === 'cloudflare'
    ? `${CF_BASE}/__down?bytes=${bytes}&n=${n}`
    : `/dl?bytes=${bytes}&n=${n}`
}
function upUrl(backend: ThroughputMethod): string {
  return backend === 'cloudflare' ? `${CF_BASE}/__up` : '/ul'
}

/** Decide which backend to use. Prefers Cloudflare; falls back to loopback. */
export async function pickBackend(): Promise<ThroughputMethod> {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 4000)
    const res = await fetch(downUrl('cloudflare', 1000), { signal: ac.signal, cache: 'no-store' })
    clearTimeout(t)
    if (res.ok) {
      await res.arrayBuffer()
      return 'cloudflare'
    }
  } catch {
    /* fall through */
  }
  return 'loopback'
}

function makeRandomBuffer(bytes: number): ArrayBuffer {
  const ab = new ArrayBuffer(bytes)
  const view = new Uint8Array(ab)
  const MAX = 65536 // crypto.getRandomValues per-call limit
  for (let off = 0; off < bytes; off += MAX) {
    crypto.getRandomValues(view.subarray(off, Math.min(off + MAX, bytes)))
  }
  return ab
}

interface PhaseOpts {
  backend: ThroughputMethod
  durationMs?: number
  warmupMs?: number
  connections?: number
  onSample?: (instMbps: number, elapsedS: number) => void
  signal?: AbortSignal
}

export async function measureDownload(opts: PhaseOpts): Promise<ThroughputResult> {
  const { backend, durationMs = 10000, warmupMs = 2000, connections = 6, onSample, signal } = opts
  const BIG = 100 * 1024 * 1024 // 100 MB per request; restarts keep links saturated

  let total = 0
  let peak = 0
  let sampleCount = 0
  const start = performance.now()
  const ac = new AbortController()
  const onAbort = (): void => ac.abort()
  signal?.addEventListener('abort', onAbort)
  const stopTimer = setTimeout(() => ac.abort(), durationMs)

  let lastT = start
  let lastBytes = 0
  let warmupBytes = 0
  let warmupT = start
  let warmupCaptured = false
  const sampler = setInterval(() => {
    const t = performance.now()
    const inst = bytesToMbps(total - lastBytes, (t - lastT) / 1000)
    if (t - start >= warmupMs) {
      if (!warmupCaptured) { warmupCaptured = true; warmupBytes = total; warmupT = t }
      peak = Math.max(peak, inst)
      sampleCount++
    }
    onSample?.(inst, (t - start) / 1000)
    lastT = t
    lastBytes = total
  }, 200)

  const stream = async (): Promise<void> => {
    while (!ac.signal.aborted) {
      try {
        const res = await fetch(downUrl(backend, BIG), { signal: ac.signal, cache: 'no-store' })
        if (!res.body) break
        const reader = res.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) total += value.byteLength
        }
      } catch {
        break // aborted or network error — stop this stream
      }
    }
  }

  await Promise.allSettled(Array.from({ length: connections }, () => stream()))
  clearInterval(sampler)
  clearTimeout(stopTimer)
  signal?.removeEventListener('abort', onAbort)

  const now = performance.now()
  const steadyBytes = warmupCaptured ? total - warmupBytes : total
  const steadySecs = warmupCaptured ? (now - warmupT) / 1000 : (now - start) / 1000
  return {
    meanMbps: bytesToMbps(steadyBytes, steadySecs),
    peakMbps: peak,
    samples: sampleCount,
    bytes: total,
    seconds: (now - start) / 1000,
    method: backend,
  }
}

export async function measureUpload(opts: PhaseOpts): Promise<ThroughputResult> {
  const { backend, durationMs = 10000, warmupMs = 2000, connections = 3, onSample, signal } = opts
  // 1 MB chunks: small enough that several complete within the window even on a
  // slow (~1-2 Mbps) uplink — a 4 MB chunk could never finish in 10 s there,
  // yielding a misleading 0. Per-request overhead is negligible against the
  // 3 concurrent connections.
  const CHUNK = 1024 * 1024
  const chunk = new Blob([makeRandomBuffer(CHUNK)]) // reusable BodyInit

  let total = 0
  let peak = 0
  let sampleCount = 0
  const start = performance.now()
  const ac = new AbortController()
  const onAbort = (): void => ac.abort()
  signal?.addEventListener('abort', onAbort)
  const stopTimer = setTimeout(() => ac.abort(), durationMs)

  let lastT = start
  let lastBytes = 0
  let warmupBytes = 0
  let warmupT = start
  let warmupCaptured = false
  const sampler = setInterval(() => {
    const t = performance.now()
    const inst = bytesToMbps(total - lastBytes, (t - lastT) / 1000)
    if (t - start >= warmupMs) {
      if (!warmupCaptured) { warmupCaptured = true; warmupBytes = total; warmupT = t }
      peak = Math.max(peak, inst)
      sampleCount++
    }
    onSample?.(inst, (t - start) / 1000)
    lastT = t
    lastBytes = total
  }, 200)

  const stream = async (): Promise<void> => {
    while (!ac.signal.aborted) {
      try {
        // No custom headers: a Blob body with no explicit content-type keeps
        // this a CORS "simple request" (no preflight), which Cloudflare's __up
        // accepts cross-origin. A non-safelisted content-type would trigger a
        // preflight that __up rejects, silently zeroing the upload.
        await fetch(upUrl(backend), {
          method: 'POST',
          body: chunk,
          signal: ac.signal,
          cache: 'no-store',
        })
        total += CHUNK
      } catch {
        break
      }
    }
  }

  await Promise.allSettled(Array.from({ length: connections }, () => stream()))
  clearInterval(sampler)
  clearTimeout(stopTimer)
  signal?.removeEventListener('abort', onAbort)

  const now = performance.now()
  const steadyBytes = warmupCaptured ? total - warmupBytes : total
  const steadySecs = warmupCaptured ? (now - warmupT) / 1000 : (now - start) / 1000
  return {
    meanMbps: bytesToMbps(steadyBytes, steadySecs),
    peakMbps: peak,
    samples: sampleCount,
    bytes: total,
    seconds: (now - start) / 1000,
    method: backend,
  }
}

/** One latency round-trip to the backend (a tiny request). Returns ms or null. */
export async function latencyProbe(backend: ThroughputMethod, signal?: AbortSignal): Promise<number | null> {
  const t0 = performance.now()
  try {
    const res = await fetch(downUrl(backend, 0), { signal, cache: 'no-store' })
    await res.arrayBuffer()
    return performance.now() - t0
  } catch {
    return null
  }
}

/**
 * Repeatedly probe latency at a fixed interval (drift-free). Used both for the
 * idle baseline and for the loaded measurement that runs concurrently with a
 * throughput phase to expose bufferbloat.
 */
export class LatencySampler {
  private rtts: number[] = []
  private stopped = false
  private ac = new AbortController()

  constructor(private backend: ThroughputMethod, private onSample?: (rtt: number) => void) {}

  async run(durationMs: number, intervalMs = 150): Promise<void> {
    const start = performance.now()
    let i = 0
    while (!this.stopped && performance.now() - start < durationMs) {
      const target = start + i * intervalMs
      const wait = target - performance.now()
      if (wait > 0) await new Promise((r) => setTimeout(r, wait))
      i++
      const rtt = await latencyProbe(this.backend, this.ac.signal)
      if (rtt !== null) {
        this.rtts.push(rtt)
        this.onSample?.(rtt)
      }
    }
  }

  stop(): void {
    this.stopped = true
    this.ac.abort()
  }

  samples(): number[] {
    return this.rtts
  }
}
