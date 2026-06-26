# Browser-native per-region measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hosted (browser) mode produce the full per-game, per-region report with no local install, by measuring per-region latency from the browser and reusing the existing WebRTC last-mile loss as a connection-wide metric.

**Architecture:** A new pure-ish client module `regionPing.ts` times HTTPS round-trips (warm-up + N samples, `redirect:'manual'`) to the same public `ec2.<region>.amazonaws.com:443` endpoints local mode uses, emitting `ProbeStats`. The hosted orchestrator path is reworked to populate `store.regions` and grade through the region-aware `assembleReport` (with a `webrtc` loss method), and `recompute()` becomes region-aware in hosted mode. The UI renders the live `RegionSelector` in both modes and demotes the "run locally" wall to an optional footnote, with mode-aware honesty copy.

**Tech Stack:** TypeScript, React 18, Vite 6, Vitest (new), pnpm workspaces. Spec: `docs/superpowers/specs/2026-06-26-browser-region-measurement-design.md`.

## Global Constraints

- **Browser-only, zero new backend infrastructure.** No regional responders.
- **Honest by design:** per-region latency labeled "HTTPS RTT" (not "TCP handshake"); loss labeled "last-mile UDP loss (your connection)", `method:'webrtc'`.
- **The probe MUST use `redirect:'manual'`.** `ec2.<region>.amazonaws.com/` 301-redirects to `aws.amazon.com`; following it collapses all 13 regions to one host. The 301 is served in-region, so timing the un-followed request is the real per-region RTT.
- **Output type is `ProbeStats` (`shared/protocol.ts`)** with `id` = region id — NOT `PingStats`.
- **Jitter formula** = mean of `|sample[i] − sample[i-1]|` (reuse `meanAbsDev` from `client/src/engine/stats.ts`, identical to `server/src/pinger.ts`).
- **Keep local mode unchanged** as the precision path. Do not touch `server/`.
- **i18n parity:** every new/changed user-facing string in EN and ES.
- **Per-request timeout 2000 ms; 7 timed samples + 1 discarded warm-up; cache-buster `?_=<counter>`; all 13 regions in parallel, samples sequential within a region.**

## File Structure

- **Create** `client/src/engine/regionPing.ts` — HTTPS-RTT prober: pure `regionStats()`, injectable `TimeOnce`, `httpsTimeOnce`, `measureRegion()`, `measureAllRegions()`.
- **Create** `client/src/engine/regionPing.test.ts` — Vitest unit tests (pure stats + mocked timer).
- **Create** `client/vitest.config.ts` — Vitest config with the `@shared` alias.
- **Modify** `client/src/engine/orchestrator.ts` — `Measured.lossMethod`; `assembleReport` loss method; `measuredFromStore`; `runLocal`; rework `runHosted`; region-aware hosted `recompute`.
- **Modify** `client/src/App.tsx` — render `RegionSelector` in both modes; optional footnote; graded-region caption; mode-aware note.
- **Modify** `client/src/i18n.ts` — badge rename; mode-aware `noteBody`; new labels; remove dead strings.
- **Modify** `client/src/styles/components.css` — one rule for the footnote/caption.
- **Modify** `client/package.json` (+ root `package.json`) — Vitest devDep + `test` script.

---

### Task 1: Vitest setup + pure `regionStats`

**Files:**
- Modify: `client/package.json` (devDep + `test` script), `package.json` (root `test` script)
- Create: `client/vitest.config.ts`
- Create: `client/src/engine/regionPing.ts`
- Test: `client/src/engine/regionPing.test.ts`

**Interfaces:**
- Consumes: `mean`, `quantile`, `meanAbsDev` from `client/src/engine/stats.ts`; `ProbeStats` from `@shared/protocol`.
- Produces: `regionStats(id: string, host: string, port: number, rtts: number[], samples: number): ProbeStats`.

- [ ] **Step 1: Add Vitest to the client workspace**

Run:
```bash
pnpm --filter client add -D vitest@^2.1.8
```
Expected: `client/package.json` gains `"vitest"` under devDependencies; `pnpm-lock.yaml` updates.

- [ ] **Step 2: Add `test` scripts**

In `client/package.json`, add to `"scripts"`:
```json
    "test": "vitest run"
```
In root `package.json` `"scripts"`, add:
```json
    "test": "pnpm --filter client run test"
```

- [ ] **Step 3: Create the Vitest config (with the @shared alias)**

Create `client/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Standalone config so tests don't pull in the React/build plugin. The @shared
// alias must mirror vite.config.ts so '@shared/*' resolves to ../shared/*.
export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Write the failing test for `regionStats`**

Create `client/src/engine/regionPing.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { regionStats } from './regionPing'

describe('regionStats', () => {
  it('computes min/median/jitter/lossPct from samples', () => {
    const s = regionStats('NA-East', 'h', 443, [10, 12, 11, 13, 12], 5)
    expect(s.id).toBe('NA-East')
    expect(s.received).toBe(5)
    expect(s.lossPct).toBe(0)
    expect(s.min).toBe(10)
    expect(s.median).toBe(12) // sorted [10,11,12,12,13] -> 12
    expect(s.jitter).toBeCloseTo(1.5) // mean(|2|,|1|,|2|,|1|) = 1.5
  })

  it('counts dropped samples in lossPct (received < samples)', () => {
    const s = regionStats('EU-West', 'h', 443, [20, 22], 7)
    expect(s.received).toBe(2)
    expect(s.lossPct).toBeCloseTo((5 / 7) * 100)
  })

  it('returns null fields and 100% loss when nothing was received', () => {
    const s = regionStats('OCE', 'h', 443, [], 7)
    expect(s.received).toBe(0)
    expect(s.min).toBeNull()
    expect(s.median).toBeNull()
    expect(s.jitter).toBeNull()
    expect(s.lossPct).toBe(100)
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm --filter client run test`
Expected: FAIL — `regionStats` is not exported (module has no such export / cannot find).

- [ ] **Step 6: Implement `regionStats`**

Create `client/src/engine/regionPing.ts`:
```ts
import type { ProbeStats } from '@shared/protocol'
import { mean, quantile, meanAbsDev } from './stats'

/**
 * Build a ProbeStats from a list of successful HTTPS-RTT samples. Mirrors the
 * server TCP pinger's math (server/src/pinger.ts) so hosted and local numbers
 * are computed identically. `samples` is the total attempted (for lossPct);
 * `rtts` holds only the successful ones. No `ip` (browser can't resolve it).
 */
export function regionStats(
  id: string,
  host: string,
  port: number,
  rtts: number[],
  samples: number,
): ProbeStats {
  const received = rtts.length
  if (received === 0) {
    return {
      id, host, port, ip: null, samples, received: 0, lossPct: 100,
      min: null, avg: null, median: null, jitter: null,
    }
  }
  return {
    id, host, port, ip: null, samples, received,
    lossPct: ((samples - received) / samples) * 100,
    min: Math.min(...rtts),
    avg: mean(rtts),
    median: quantile(rtts, 0.5),
    jitter: meanAbsDev(rtts),
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter client run test`
Expected: PASS (3 passing).

- [ ] **Step 8: Commit**

```bash
git add client/package.json package.json pnpm-lock.yaml client/vitest.config.ts client/src/engine/regionPing.ts client/src/engine/regionPing.test.ts
git commit -m "feat(client): add Vitest + regionStats pure helper for browser region ping"
```

---

### Task 2: HTTPS timing probe (`measureRegion` / `measureAllRegions`)

**Files:**
- Modify: `client/src/engine/regionPing.ts`
- Test: `client/src/engine/regionPing.test.ts`

**Interfaces:**
- Consumes: `REGIONS`, `RegionInfo` from `@shared/regions`; `regionStats` (Task 1).
- Produces:
  - `type TimeOnce = (url: string, timeoutMs: number) => Promise<number | null>`
  - `httpsTimeOnce: TimeOnce`
  - `interface RegionPingOpts { count?: number; timeoutMs?: number; onRegion?: (stats: ProbeStats) => void }`
  - `measureRegion(info: RegionInfo, opts?: RegionPingOpts, timeOnce?: TimeOnce): Promise<ProbeStats>`
  - `measureAllRegions(opts?: RegionPingOpts, timeOnce?: TimeOnce): Promise<Record<string, ProbeStats>>`

- [ ] **Step 1: Write the failing tests for the probe (mocked timer)**

Append to `client/src/engine/regionPing.test.ts`:
```ts
import { measureRegion, measureAllRegions, type TimeOnce } from './regionPing'
import { REGIONS } from '@shared/regions'

describe('measureRegion', () => {
  it('discards the warm-up request and times N samples', async () => {
    const calls: string[] = []
    const seq = [999, 10, 12, 11, 13, 12, 10, 11] // warm=999, then 7 samples
    let i = 0
    const timeOnce: TimeOnce = async (url) => { calls.push(url); return seq[i++] }
    const info = REGIONS[0]

    const s = await measureRegion(info, { count: 7 }, timeOnce)

    expect(calls[0]).toContain('?_=warm')
    expect(calls).toHaveLength(8) // 1 warm-up + 7 timed
    expect(s.id).toBe(info.region)
    expect(s.host).toBe(info.host)
    expect(s.received).toBe(7)
    expect(s.min).toBe(10) // the 999 warm-up is excluded
  })

  it('drops failed samples and reports received:0/median:null when all fail', async () => {
    const timeOnce: TimeOnce = async () => null
    const s = await measureRegion(REGIONS[0], { count: 5 }, timeOnce)
    expect(s.received).toBe(0)
    expect(s.median).toBeNull()
    expect(s.lossPct).toBe(100)
  })
})

describe('measureAllRegions', () => {
  it('returns ProbeStats keyed by region id for every region', async () => {
    const timeOnce: TimeOnce = async () => 42
    const out = await measureAllRegions({ count: 3 }, timeOnce)
    expect(Object.keys(out).sort()).toEqual(REGIONS.map((r) => r.region).sort())
    for (const r of REGIONS) {
      expect(out[r.region].id).toBe(r.region)
      expect(out[r.region].received).toBe(3)
    }
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter client run test`
Expected: FAIL — `measureRegion` / `measureAllRegions` / `TimeOnce` not exported.

- [ ] **Step 3: Implement the probe**

Append to `client/src/engine/regionPing.ts`:
```ts
import { REGIONS, type RegionInfo } from '@shared/regions'

export type TimeOnce = (url: string, timeoutMs: number) => Promise<number | null>

/**
 * Time one HTTPS round-trip. CRITICAL: redirect:'manual' — ec2.<region>.amazonaws.com
 * 301s to aws.amazon.com; following it would make every region time the SAME host.
 * The opaqueredirect resolves at the in-region 301 (no body), giving a clean ~1-RTT
 * sample on a warm keep-alive connection. Returns ms, or null on timeout/error.
 */
export const httpsTimeOnce: TimeOnce = async (url, timeoutMs) => {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  const start = performance.now()
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', redirect: 'manual', signal: ac.signal })
    return performance.now() - start
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface RegionPingOpts {
  count?: number // timed samples (default 7)
  timeoutMs?: number // per request (default 2000)
  onRegion?: (stats: ProbeStats) => void
}

/** Warm-up (discarded) + `count` timed samples on the reused connection. */
export async function measureRegion(
  info: RegionInfo,
  opts: RegionPingOpts = {},
  timeOnce: TimeOnce = httpsTimeOnce,
): Promise<ProbeStats> {
  const count = opts.count ?? 7
  const timeoutMs = opts.timeoutMs ?? 2000
  const base = `https://${info.host}/`

  await timeOnce(`${base}?_=warm`, timeoutMs) // warm-up: DNS+TCP+TLS, parks keep-alive

  const rtts: number[] = []
  for (let i = 0; i < count; i++) {
    const rtt = await timeOnce(`${base}?_=${i}`, timeoutMs)
    if (rtt != null) rtts.push(rtt)
  }
  return regionStats(info.region, info.host, info.port, rtts, count)
}

/** Probe all 13 regions in parallel; calls opts.onRegion as each completes. */
export async function measureAllRegions(
  opts: RegionPingOpts = {},
  timeOnce: TimeOnce = httpsTimeOnce,
): Promise<Record<string, ProbeStats>> {
  const entries = await Promise.all(
    REGIONS.map(async (info) => {
      const stats = await measureRegion(info, opts, timeOnce)
      opts.onRegion?.(stats)
      return [info.region, stats] as const
    }),
  )
  return Object.fromEntries(entries)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter client run test`
Expected: PASS (5 passing total).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter client run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/engine/regionPing.ts client/src/engine/regionPing.test.ts
git commit -m "feat(client): browser HTTPS-RTT region probe (redirect:manual, parallel)"
```

---

### Task 3: Thread a loss `method` through `assembleReport`

This lets the hosted path reuse the region-aware `assembleReport` while labeling loss `webrtc` (not `stun-udp`). Pure refactor; local behavior unchanged.

**Files:**
- Modify: `client/src/engine/orchestrator.ts`

**Interfaces:**
- Produces: `Measured` gains `lossMethod: 'stun-udp' | 'webrtc'`; `assembleReport` uses it.

- [ ] **Step 1: Add `lossMethod` to the `Measured` interface**

In `client/src/engine/orchestrator.ts`, in `interface Measured` (after `loadedMedianUp`):
```ts
  loadedMedianUp: number | null
  lossMethod: 'stun-udp' | 'webrtc'
```

- [ ] **Step 2: Use it in `assembleReport`'s `LossSummary`**

In `assembleReport`, change the `loss` object's `method`:
```ts
  const loss: LossSummary = {
    method: m.lossIdle?.available || m.lossLoaded?.available ? m.lossMethod : 'unavailable',
    idle: m.lossIdle,
    loaded: m.lossLoaded,
    lossPct,
    jitterMs: m.lossIdle?.jitter ?? m.lossLoaded?.jitter ?? null,
  }
```

- [ ] **Step 3: Set it in `measuredFromStore`**

In `measuredFromStore`, add to the returned object:
```ts
    loadedMedianUp: s.loadedUpMedian,
    lossMethod: s.mode === 'hosted' ? 'webrtc' : 'stun-udp',
```

- [ ] **Step 4: Set it in `runLocal`'s `measured`**

In `runLocal`, in the `const measured: Measured = { ... }` block, add:
```ts
      loadedMedianUp,
      lossMethod: 'stun-udp',
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter client run typecheck`
Expected: FAIL — `runHosted`'s `measured` object now lacks `lossMethod`. That is fixed in Task 4; if implementing Tasks 3+4 together this resolves. If verifying Task 3 alone, temporarily add `lossMethod: 'webrtc',` to `runHosted`'s `measured` object, then proceed to Task 4.

- [ ] **Step 6: Commit**

```bash
git add client/src/engine/orchestrator.ts
git commit -m "refactor(client): parameterize loss method on assembleReport/Measured"
```

---

### Task 4: Rework `runHosted` to measure per-region latency

**Files:**
- Modify: `client/src/engine/orchestrator.ts`

**Interfaces:**
- Consumes: `measureAllRegions` (Task 2); existing `bestRegion`, `assembleReport`, `assembleHostedReport`, `gameRegions`.

- [ ] **Step 1: Import `measureAllRegions`**

At the top of `client/src/engine/orchestrator.ts`, add:
```ts
import { measureAllRegions } from './regionPing'
```

- [ ] **Step 2: Replace the `runHosted` "regions" phase (Phase 1) block**

Replace the existing Phase 1 block in `runHosted` (the `store.set({ phase: 'regions', progress: 0.08 }, true)` line through `const idleJitter = meanAbsDev(idleSamples)`) with:
```ts
    // Phase 1: per-region HTTPS RTT (browser) + idle baseline (for bufferbloat)
    store.set({ phase: 'regions', phaseLabel: 'Mapping regions & latency', progress: 0.08 }, true)
    const idleSampler = new LatencySampler(backend, (rtt) => store.pushLatency(rtt))
    const idleP = idleSampler.run(3500, 160)
    const regionsP = measureAllRegions({ count: 7, timeoutMs: 2000, onRegion: (s) => store.putRegion(s) })
    await Promise.all([idleP, regionsP])
    const idleSamples = idleSampler.samples()
    const idleMedian = median(idleSamples)
    const idleJitter = meanAbsDev(idleSamples)

    // Choose the region within this game's allowed set (mirrors runLocal).
    const allowed = gameRegions(opts.gameId)
    const allowList = allowed.length ? allowed : undefined
    const chosenRegion: Region =
      (opts.region && (!allowList || allowList.includes(opts.region)) ? opts.region : null) ??
      bestRegion(store.value.regions, allowList) ??
      allowed[0] ??
      'NA-East'
    store.set({ selectedRegion: chosenRegion })
```
Also delete the now-unused `void opts.region` line at the top of `runHosted`.

- [ ] **Step 3: Replace the `runHosted` compute block (Phase 5)**

Replace the existing `const measured: Measured = { regions: {}, ... }` block and the `assembleHostedReport(...)` call + final `store.set({...})` with:
```ts
    // Phase 5: compute + grade
    store.set({ phase: 'compute', progress: 0.95 }, true)
    const measured: Measured = {
      regions: store.value.regions,
      lossIdle,
      lossLoaded: null,
      download,
      upload,
      idleMedian,
      loadedMedianDown,
      loadedMedianUp,
      lossMethod: 'webrtc',
    }
    // If at least one region was reachable, grade per-region; otherwise fall back
    // to the generic internet-RTT report (region map shows "—" everywhere).
    const hasRegionData = Object.values(store.value.regions).some((r) => r.median != null)
    const report = hasRegionData
      ? assembleReport(measured, opts.gameId, chosenRegion)
      : assembleHostedReport(measured, opts.gameId, idleJitter)
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
```

- [ ] **Step 4: Typecheck + build + tests**

Run: `pnpm --filter client run typecheck && pnpm --filter client run test && pnpm run build`
Expected: typecheck clean (no unused `assembleHostedReport`/`bestRegion` — both still used), 5 tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/engine/orchestrator.ts
git commit -m "feat(client): hosted mode measures per-region HTTPS RTT and grades per-region"
```

---

### Task 5: Make hosted `recompute` region-aware

So clicking a region / switching game recomputes the per-region verdict instantly.

**Files:**
- Modify: `client/src/engine/orchestrator.ts`

- [ ] **Step 1: Replace the hosted branch of `recompute`**

In `recompute`, replace the `if (s.mode === 'hosted') { ... return }` block with:
```ts
  if (s.mode === 'hosted') {
    const m = measuredFromStore()
    const hasRegionData = Object.values(m.regions).some((r) => r.median != null)
    if (hasRegionData) {
      const region = opts.region ?? s.selectedRegion
      const report = assembleReport(m, gameId, region)
      store.set({ selectedGameId: gameId, selectedRegion: report.region, report }, true)
    } else {
      // No reachable regions — re-grade against the generic internet RTT.
      const idleJitter = s.report.selectedPing?.jitter ?? 0
      const report = assembleHostedReport(m, gameId, idleJitter)
      store.set({ selectedGameId: gameId, report }, true)
    }
    return
  }
```

- [ ] **Step 2: Typecheck + tests**

Run: `pnpm --filter client run typecheck && pnpm --filter client run test`
Expected: clean; 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add client/src/engine/orchestrator.ts
git commit -m "feat(client): hosted recompute is region-aware (instant per-region re-grade)"
```

---

### Task 6: UX — region map in both modes, honest copy, badge

**Files:**
- Modify: `client/src/i18n.ts`, `client/src/components/Hero.tsx`, `client/src/App.tsx`, `client/src/styles/components.css`

**Interfaces:**
- Consumes: `RegionSelector`, `gameRegions`, `REGION_BY_ID`, store `regions`/`report`/`mode`.

- [ ] **Step 1: Update i18n strings**

In `client/src/i18n.ts` `const S`:
- Change `hostedBadge` to:
```ts
  hostedBadge: { en: 'Hosted', es: 'En línea' },
```
- Add these keys (anywhere in `S`):
```ts
  hostedRegionNote: {
    en: 'Measured in your browser (HTTPS RTT + last-mile loss). Want raw-socket precision — exact UDP ping and true per-region loss? Run FRAGRATE locally.',
    es: 'Medido en tu navegador (RTT HTTPS + pérdida de última milla). ¿Quieres precisión de sockets crudos — ping UDP exacto y pérdida real por región? Ejecuta FRAGRATE localmente.',
  },
  hostedRegionUnreachable: {
    en: 'Couldn’t reach the region endpoints from your browser. Run FRAGRATE locally for per-game-region ping.',
    es: 'No se pudo alcanzar los endpoints de región desde tu navegador. Ejecuta FRAGRATE localmente para el ping por región.',
  },
  gradedOn: { en: 'Verdict graded on', es: 'Veredicto evaluado en' },
  latencyHttps: { en: 'Latency = HTTPS RTT to region endpoints', es: 'Latencia = RTT HTTPS a endpoints de región' },
```

- [ ] **Step 2: Make `noteBody` mode-aware**

In `client/src/i18n.ts`, replace the `noteBody` function with:
```ts
import type { RunMode } from './engine/mode'

export function noteBody(l: Lang, backend: string, mode: RunMode | 'unknown'): string {
  if (mode === 'hosted') {
    return l === 'es'
      ? `La latencia por región es el RTT HTTPS desde tu navegador a un endpoint público en la región real de cada juego (algo por encima del ping UDP crudo). La pérdida de paquetes es la pérdida UDP de última milla medida por WebRTC vía Cloudflare TURN — es de tu conexión, no por región. El throughput y el bufferbloat se miden contra los endpoints públicos de ${backend}. Para ping UDP exacto y pérdida real por región, ejecuta FRAGRATE localmente.`
      : `Per-region latency is the HTTPS RTT from your browser to a public endpoint in each game’s real datacenter region (somewhat above raw UDP ping). Packet loss is your last-mile UDP loss measured via WebRTC through Cloudflare TURN — it’s your connection’s loss, not per region. Throughput & bufferbloat run against ${backend}’s public speed endpoints. For exact UDP ping and true per-region loss, run FRAGRATE locally.`
  }
  return l === 'es'
    ? `La latencia es el tiempo de handshake TCP desde tu equipo a un endpoint público en la región real de cada juego — un proxy de ping sin permisos de root que confirma alcanzabilidad. La pérdida de paquetes y el jitter UDP provienen de sondas STUN/UDP a servidores STUN públicos (UDP real de Internet). El throughput y el bufferbloat se miden contra los endpoints públicos de ${backend}. Los veredictos aplican los umbrales por género de cada juego a tu conexión medida.`
    : `Latency is the TCP-handshake time from your machine to a public endpoint in each game’s real datacenter region — a root-free, reachability-confirming ping proxy. Packet loss & UDP jitter come from STUN/UDP probes to public STUN servers (real internet UDP). Throughput & bufferbloat run against ${backend}’s public speed endpoints. Verdicts apply each game’s genre-specific thresholds to your measured connection.`
}
```

- [ ] **Step 3: Update `Hero.tsx` — real region descriptor + HTTPS label in hosted**

Hosted now has a real per-region RTT, so Hero must drop the obsolete "internet RTT (approx — run locally)" wording and label latency "HTTPS RTT". In `client/src/components/Hero.tsx`:

1. In `VerdictText`, replace the `where`/`tail` lines:
```tsx
  const hosted = state.mode === 'hosted'
  const where = hosted ? t(lang, 'internetRtt') : lang === 'es' ? `a ${regionLabel}` : `to ${regionLabel}`
  const tail = hosted ? ` ${t(lang, 'hostedApprox')}` : ''
```
with (region-based in both modes, no approx hedge):
```tsx
  const where = lang === 'es' ? `a ${regionLabel}` : `to ${regionLabel}`
  const tail = ''
```
(`hosted` is no longer needed in `VerdictText` — its only uses were these two lines.)

2. In the `Hero` function, add `const hosted = state.mode === 'hosted'` right after `const lang = useLang()`, then make the latency label mode-aware. Replace:
```tsx
              <span>{t(lang, 'latencyTcp')}</span>
```
with:
```tsx
              <span>{t(lang, hosted ? 'latencyHttps' : 'latencyTcp')}</span>
```

- [ ] **Step 4: Add the footnote/caption CSS rule**

In `client/src/styles/components.css`, append:
```css
.np-runlocal-note {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-faint);
}
.np-region-graded {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-faint);
}
```

- [ ] **Step 5: Render `RegionSelector` in both modes + footnote + graded caption**

In `client/src/App.tsx`:
1. Add to the imports from `@shared/regions`:
```ts
import { REGION_BY_ID } from '@shared/regions'
```
2. Update the call to the note (currently `noteBody(lang, s.backendLabel || 'Cloudflare')`) to pass mode:
```tsx
        <b>{noteTitle[lang]}</b> {noteBody(lang, s.backendLabel || 'Cloudflare', s.mode)}
```
3. Replace the entire `{s.mode === 'hosted' ? ( ...run-locally panel... ) : ( <RegionSelector .../> )}` block with:
```tsx
      <RegionSelector
        regions={s.regions}
        selected={s.selectedRegion}
        allowed={gameRegions(s.selectedGameId)}
        onSelect={onPickRegion}
      />
      {s.mode === 'hosted' && (
        <p className="np-runlocal-note">
          {Object.values(s.regions).some((r) => r.received > 0)
            ? t(lang, 'hostedRegionNote')
            : t(lang, 'hostedRegionUnreachable')}
        </p>
      )}
      {s.mode === 'hosted' && s.report && Object.values(s.regions).some((r) => r.received > 0) && (
        <p className="np-region-graded">
          {t(lang, 'gradedOn')} {REGION_BY_ID[s.report.region].label}
        </p>
      )}
```

- [ ] **Step 6: Remove now-dead strings**

After Steps 2–5, these i18n keys have no remaining usage. Verify, then delete each from `const S` in `client/src/i18n.ts`:
```bash
grep -rn "internetRtt\|hostedApprox\|runLocallyTitle\|runLocallyBody\|runLocallyCta" client/src --include="*.ts" --include="*.tsx" | grep -v client/src/i18n.ts
```
Expected: zero matches → delete `internetRtt`, `hostedApprox`, `runLocallyTitle`, `runLocallyBody`, `runLocallyCta` from `S`. Keep `latencyTcp` (still used for local labeling). If a key still shows a usage, leave it. (The now-unused `.np-runlocal*` CSS classes are harmless to leave.)

- [ ] **Step 7: Typecheck + build + tests**

Run: `pnpm --filter client run typecheck && pnpm --filter client run test && pnpm run build`
Expected: typecheck clean (no unused imports/strings), 5 tests pass, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add client/src/i18n.ts client/src/components/Hero.tsx client/src/App.tsx client/src/styles/components.css
git commit -m "feat(client): render live region map in hosted mode with honest labels"
```

---

### Task 7: Full verification + deploy

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck, tests, build**

Run: `pnpm run typecheck && pnpm run test && pnpm run build`
Expected: server + client typecheck clean; tests pass; build writes `client/dist`.

- [ ] **Step 2: Confirm no CSP would block the AWS hosts**

Run: `grep -rni "content-security-policy\|connect-src" client worker wrangler.jsonc`
Expected: no matches (no CSP exists; nothing to change). If a match appears, add `https://ec2.*.amazonaws.com` to `connect-src`.

- [ ] **Step 3: Manual hosted check (local Worker dev)**

Run: `pnpm build && pnpm dlx wrangler dev`
In the browser at the dev URL: run a test and confirm (a) the region map populates with **distinct** per-region latencies (NOT all identical — guards the redirect fix), (b) verdicts compute, (c) switching game/region recomputes instantly, (d) the "Verdict graded on …" caption shows, (e) an offline/blocked region renders "—". (Note: `wrangler dev` serves the Worker without TURN secrets, so loss shows unavailable — expected.)

- [ ] **Step 4: Commit any fixes, then push to deploy**

```bash
git push
```
Cloudflare's connected build runs `pnpm run build` + `wrangler deploy`; verify the live site’s region map shows distinct latencies.

---

## Notes for the implementer

- **Do not touch `server/`** — local mode is the precision path and must keep working (`runLocal` regression: still uses the WS TCP pinger).
- The `regions` phase id is displayed as "Ping" (`i18n.PHASE_SHORT.regions`); there is no `PING` phase value.
- Hosted loss stays **idle-only** (`lossLoaded: null`); grading already renormalizes weights when loaded loss is absent. A high last-mile loss reading caps every game/region (by design) — the mode-aware note discloses it as connection-wide.
