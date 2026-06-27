# AGENTS.md — client measurement engine

> Scope: the `client/src/engine/` directory — the browser-side measurement engine. Nested AGENTS.md override; see the root [AGENTS.md](../../../AGENTS.md) for repo-wide rules.

## Overview

The engine runs a full network test and writes a graded `NetReport` into the singleton store. It is the **sole producer** of measurement state and **never imports React**. It auto-detects one of two runtimes and changes which measurements run:

- **LOCAL** (`detectMode()` → `'local'`): Node server present. Region ping = server TCP-connect sweep over the `/net` WebSocket; loss = server STUN/UDP.
- **HOSTED** (`'hosted'`): Cloudflare Worker, browser-only. Region ping = browser HTTPS-RTT; loss = WebRTC over Cloudflare TURN.

All scoring/thresholds live in `@shared` (see [../../../shared/AGENTS.md](../../../shared/AGENTS.md)); the engine only assembles `MetricInputs` and calls `grade()`/`bloatGrade()`/`rankToVerdict()`/`limitingFactor()`.

## Setup & commands

One-line pointer: see [../../../AGENTS.md](../../../AGENTS.md). Engine-relevant gates: `pnpm --filter client run test` (Vitest), `pnpm --filter client run typecheck`, `pnpm --filter client run build`. `pnpm dev` (root) runs server+client for LOCAL; `cd client && pnpm dev` with no server exercises HOSTED.

## Layout / Key files

| File | Role |
| --- | --- |
| `orchestrator.ts` | Conductor. `runTest()` (detect mode → `runLocal`/`runHosted`), `recompute()` (instant re-grade from store, no re-run). 5-phase flow: regions → loss → download → upload → compute. `assembleReport()`/`assembleHostedReport()`, `buildBufferbloat()`, `bestRegion()`, `worstLossOrNull()`, `measuredFromStore()`. |
| `throughput.ts` | `pickBackend()` (Cloudflare `speed.cloudflare.com` 4s probe, else `'loopback'`), `measureDownload()`/`measureUpload()` (concurrent saturating fetch streams → Mbps), `latencyProbe()`, `LatencySampler` (drift-free RTT polling for idle/loaded; default `intervalMs` 150, but the orchestrator passes ~160 ms). |
| `loss.ts` | HOSTED loss. `measureBrowserLoss()` — two `RTCPeerConnection`s forced onto Cloudflare TURN relay; sequenced echo probes over a DataChannel. Returns `StunLossData`, **never throws**. |
| `regionPing.ts` | HOSTED region latency. `measureAllRegions()` probes all 13 `@shared/regions` in parallel via `httpsTimeOnce()`; `regionStats()` mirrors server pinger math. `httpsTimeOnce` is injectable (`TimeOnce`). |
| `regionPing.test.ts` | The **only** engine test. Covers `regionStats`, `measureRegion` (warm-up discard + N samples), `measureAllRegions`, and `httpsTimeOnce` fetch options. Runs under Vitest in `environment:'node'`. |
| `stats.ts` | Pure helpers: `mean`, `median` (returns `0` for `[]`), `quantile` (linear interp), `meanAbsDev` (jitter), `bytesToMbps`. |
| `ws.ts` | `NetSocket`: typed LOCAL `/net` client. `ready()` resolves on `hello`; `probe()` runs TCP sweep; `loss()` runs one STUN-UDP run. Every op rejects on close/error/server-error/30s timeout. |
| `mode.ts` | `detectMode()` GETs `/api/health` (2.5s); `{service:'fragrate'}` ⇒ `'local'`, else `'hosted'`. Module-cached. Exports `RunMode`. |

## Conventions

- Timing via `performance.now()` only; `Date.now()` solely for `report.startedAt` wall-clock.
- Throughput is **base-10 Mbps from wire bytes**: `bytesToMbps = bytes*8/1e6/seconds` (matches ISP marketing). Never 1024-based.
- Loss is a **whole percent** (`lossPct`, 0..100). Durations/budgets are explicit ms.
- Network calls use `fetch` + `AbortController`/`setTimeout` hard timeouts + `cache:'no-store'`; errors are swallowed and surfaced as `null`/`available:false` — **except** `NetSocket` ops, which reject.
- Stream into the store: `store.set(patch, immediate?)`, `store.putRegion`, `store.pushLatency`, `store.reset`. The `immediate` flag forces synchronous notify (used at phase boundaries / completion).
- Phase progression: `regions → loss → download → upload → compute`, with hardcoded `progress` milestones.
- Injectable deps for testability: `measureRegion`/`measureAllRegions` accept a `TimeOnce`.

## Invariants — do not break

- **HONESTY / labeling.** TCP handshake is not literally ping; HTTPS RTT is not ping; HOSTED loss is WebRTC-over-TURN, not raw UDP. A metric that could not be measured is `null` / `available:false`, never faked. When no loaded RTT samples land, the internal/store loaded medians (`loadedDownMedian`/`loadedUpMedian`) stay **`null`** (not `idleMedian`), which forces `BufferbloatResult.available:false` and a `null` grade (see comment at `orchestrator.ts` ~L246) — otherwise an unmeasured link would grade a false A+. (Note: the public `BufferbloatResult.loadedMedian*` fields then fall back to `idleMedian`, but `available:false` suppresses the grade.)
- `loss.ts` `createDataChannel` MUST stay `{ ordered:false, maxRetransmits:0 }` (retransmits hide real loss), keep `iceTransportPolicy:'relay'` and the `isUdp` candidate filter (measures the real last-mile UDP path), and keep the post-send 3000ms drain (reordering is not loss).
- `regionPing.httpsTimeOnce` MUST use `redirect:'manual'` AND `mode:'cors'`. `redirect:'follow'` makes `ec2.<region>` 301 to `aws.amazon.com` (every region times one host); `no-cors`+`manual` throws synchronously. Asserted by `regionPing.test.ts`.
- `measureUpload` MUST send a bare `Blob` with no custom headers/content-type (stays a CORS simple request; a preflight makes Cloudflare `__up` silently zero the upload).
- Throughput/loaded-latency MUST target the real internet (Cloudflare), not loopback; loopback is only a labeled fallback.
- Region grading stays within `gameRegions(gameId)`: only honor an explicit region if it is valid for the game AND reachable (`median != null`); otherwise grade the best reachable in-game region. Never grade off sentinel values.
- `NetSocket` MUST reject (not hang) every pending op on close/error/server-error/timeout — `runLocal`'s try/catch relies on it to set `status:'error'`.
- `runTest` early-returns if `status==='running'` (single-run guard). `detectMode` returns `'local'` ONLY for `{service:'fragrate'}`.
- `recompute`/`measuredFromStore` depend on persisted `EngineState` field names `idleMedian`, `loadedDownMedian`, `loadedUpMedian`; renaming without updating both sides silently breaks instant re-grading.

## Gotchas

- **Two `median()` with different empty-input contracts**: `stats.ts median()` returns `0` for `[]`; `loss.ts`'s private `median()` returns `null`. Don't conflate them.
- **Store vs internal field names**: orchestrator's internal `Measured` uses `loadedMedianDown`/`loadedMedianUp`; the store/`EngineState` uses `loadedDownMedian`/`loadedUpMedian`. `measuredFromStore()` bridges them.
- **Sentinel grading inputs are deliberate.** Missing ping → `999`ms, missing jitter → `99`ms (`assembleReport`); ping `999` when `idleMedian<=0` (hosted). These force an unmeasured region to NO-GO, not perfect.
- HOSTED picks `assembleReport` vs `assembleHostedReport` at runtime by whether ANY region had `median != null`. `assembleHostedReport` fabricates a synthetic `ProbeStats` (`id:'internet'`, `host:'cloudflare-anycast'`) and `region:'NA-East'` — that `'NA-East'` is a placeholder, NOT a measurement (region map hidden in hosted mode).
- `BrowserLossOpts` default `ratePps` is `200`, but `runHosted` passes `50`; `timeoutMs` default `8000`. `measureBrowserLoss` is inherently several seconds long (3s drain).
- `LatencySampler.run()` resolves only after `stop()` or `durationMs` elapses; always `await` the sampler promise *after* `stop()`, else loaded samples are lost → silently `null` bufferbloat.
- Throughput defaults: download `connections=6` streaming large (`BIG`, 100 MB) requests; upload `connections=3` posting reusable 1 MB (`CHUNK`) bodies (the 1 MB size is upload-only, so several complete in the 10s window on slow uplinks; a larger chunk could finish 0 times → misleading 0 Mbps). `warmupMs=2000` is discarded from the steady-state mean.
- `NetSocket` `OP_TIMEOUT_MS` is 30s per op; very long server runs near that bound can spuriously reject.
- `downUrl` appends a `performance.now()`-derived cache-buster; don't remove it or responses may be cached.
- Tests run in `environment:'node'` — no DOM/`fetch`/`RTCPeerConnection`. Only pure/injectable code is tested; `loss.ts`, `ws.ts`, `throughput.ts` network paths are NOT unit-tested. Use the `TimeOnce` injection (or stub `global.fetch`) for new tests.

## Making changes

- Verdict/threshold/grading logic belongs in `@shared`, not here — the engine only assembles `MetricInputs` and calls the shared functions.
- New measurement data the UI needs: add the field to `EngineState` (`../state/store.ts`) and write it from the run flow — that interface is the engine↔UI contract.
- Keep LOCAL and HOSTED region math comparable (`regionPing.ts` intentionally mirrors `server/src/pinger.ts`).
- Run `pnpm --filter client run test` and `... run typecheck` (strict + `noUnused*`) before claiming done.

## See also

- [../state/store.ts](../state/store.ts) — `EngineState`, the engine↔UI contract.
- [../../../shared/AGENTS.md](../../../shared/AGENTS.md) — grading/thresholds/catalog/protocol.
- [../../../server/AGENTS.md](../../../server/AGENTS.md) — `/net`, `/dl`, `/ul`, `/api/health`, STUN.
- [../../../worker/AGENTS.md](../../../worker/AGENTS.md) — `/api/turn` for HOSTED loss.
- [../../../docs/MEASUREMENT_ENGINE.md](../../../docs/MEASUREMENT_ENGINE.md) — measurement algorithms and the test timeline (treat its WebRTC-on-server claim as historical; loss transports are STUN local / TURN hosted).
