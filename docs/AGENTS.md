# AGENTS.md — docs

> Scope: the `docs/` directory — design specs, build spec, measurement-engine doc, the visual design system, and the dated `superpowers/` plans/specs. Nested AGENTS.md override; see the root [AGENTS.md](../AGENTS.md) for repo-wide rules.

## Overview

This directory is **reference material**, not code. It holds FRAGRATE's design/spec documents plus the dashboard screenshot used by the README. There is nothing here to build, test, or lint — these files are not part of any `pnpm` package and are never imported. Treat them as documentation to read and keep accurate, not as code to refactor.

For setup/commands, see [../AGENTS.md](../AGENTS.md). No commands are specific to this directory.

## Layout / Key files

| File | Role |
| --- | --- |
| [`BUILD_SPEC.md`](./BUILD_SPEC.md) | Original consolidated v1 implementation spec. Source of truth for the game catalog (`GAMES[]`, cloud-region proxy map, `BASELINES`), per-genre threshold bands (`GENRE_BANDS`), and the grading math (`§2.2`: weights ping `.34` / jitter `.28` / loss `.23` / throughput `.15`, hard caps, bufferbloat penalty). **Caveat:** `§2.2` predates two behaviors that now live only in `shared/grading.ts` — the unmeasured-loss renormalization (drop the loss term and divide by `0.77`) and the revised bufferbloat hard cap (fires at added `>200 ms`, deliberately *not* the 6-band display `F` of `>400 ms`); treat `shared/grading.ts` as the real source of truth for those. Also documents HTTP routes, the `/net` WS message contract, and an *intended* file layout. |
| [`MEASUREMENT_ENGINE.md`](./MEASUREMENT_ENGINE.md) | Deep technical design of the measurement subsystems (download, upload, idle latency/jitter, bufferbloat, packet loss): exact algorithms, units, the client↔server API, WebRTC signaling, and the test timeline. Most detailed source for measurement conventions (base-10 Mbps from wire bytes, slow-start discard, drift-free scheduler, jitter = mean-abs-dev of consecutive samples). |
| [`FRAGRATE-design-system.md`](./FRAGRATE-design-system.md) | The visual design system: neon-cyberpunk HUD direction, the `:root` CSS token block, typography scale, component inventory, responsive grid, motion specs, reduced-motion fallback, and paste-ready CSS. Hard constraint: fully self-contained (no CDN/remote fonts/images/scripts). |
| [`superpowers/specs/`](./superpowers/specs/) | Design docs (the "what" and "why"). Dated filenames, e.g. `2026-06-26-browser-region-measurement-design.md`. |
| [`superpowers/plans/`](./superpowers/plans/) | Implementation plans executing a spec (the "how", task-by-task with `- [ ]` checkboxes). Dated filenames, e.g. `2026-06-26-browser-region-measurement.md`. |
| `screenshot.png` | Dashboard screenshot. Referenced by the root [`README.md`](../README.md) (`![FRAGRATE dashboard](docs/screenshot.png)`). |

## Conventions

- **`superpowers/` plans vs specs:** `specs/` are design documents (approved design, rationale, constraints); `plans/` are the implementation plans that execute a spec task-by-task. Plans link back to their spec. Filenames are dated `YYYY-MM-DD-<slug>(.md|-design.md)`.
- Spec docs use TS code blocks with file-path comments (e.g. `// shared/catalog.ts`). Where present, those blocks are the canonical values for catalog/thresholds/grading — but verify against the actual `shared/` source, which is the real source of truth.

## Making changes

- **When you change behavior a doc describes, update the doc in the same change.** Grading math lives in [`BUILD_SPEC.md`](./BUILD_SPEC.md) `§2.2` and `shared/grading.ts`; measurement algorithms in [`MEASUREMENT_ENGINE.md`](./MEASUREMENT_ENGINE.md) and `client/src/engine/`; UI tokens/components in [`FRAGRATE-design-system.md`](./FRAGRATE-design-system.md) and `client/src/styles/`. Keep doc and code in lockstep.
- Do not refactor or reformat these docs as if they were code. Edit for accuracy.

## Gotchas

- **Doc drift (important):** [`BUILD_SPEC.md`](./BUILD_SPEC.md) and [`MEASUREMENT_ENGINE.md`](./MEASUREMENT_ENGINE.md) both state the server uses `node-datachannel` for server-side WebRTC loss. **It is not a dependency** — `server/package.json` depends only on `ws`. The real architecture uses `server/src/stun.ts` (STUN/UDP) for LOCAL-mode loss and `client/src/engine/loss.ts` (WebRTC over Cloudflare TURN) for HOSTED-mode loss. Trust [`../README.md`](../README.md) and the [`superpowers/`](./superpowers/) docs for the current architecture; treat the two original specs as historical intent for catalog/thresholds/grading/units, not for the loss transport.
- **Layout drift:** `BUILD_SPEC.md §5` describes an intended file tree (e.g. `server/src/routes/`, `client/src/engine/scheduler.ts`) that does **not** match the actual flatter layout. Verify real paths in the repo before citing the spec's layout.
- The two original specs (`BUILD_SPEC.md`, `MEASUREMENT_ENGINE.md`) predate the browser per-region measurement feature and do **not** describe `regionPing.ts` or the hosted region map. The [`superpowers/`](./superpowers/) spec + plan are the authoritative description of current hosted-mode behavior.
- `FRAGRATE-design-system.md`'s `@font-face` uses a `<<<INLINE_WOFF2_PAYLOAD>>>` placeholder; the actual decision is to ship on the system fallback stack, so no bundled font face is shipped.

## See also

- Root guide and repo-wide setup: [../AGENTS.md](../AGENTS.md)
- Project overview, modes, deploy: [../README.md](../README.md)
