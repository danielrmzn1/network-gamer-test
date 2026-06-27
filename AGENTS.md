# AGENTS.md — FRAGRATE monorepo

> This is the repo-wide guide and the primary entry point. It owns global setup, commands, and conventions; each sub-guide (see [See also](#see-also)) defers here for those and covers only its own area. Nested `AGENTS.md` files override this one within their directory.

## Overview

FRAGRATE is a gamer-grade network quality web app: it measures ping/jitter to real game regions, packet loss, and bufferbloat (latency under load), then gives each game a `PLAYABLE` / `RISKY` / `NO` verdict (the `NO` literal is shown as "No-go" in the UI) and an `S`-to-`F` rank. It runs in two modes auto-detected at load:

- **LOCAL** — a Node server on your machine: real TCP-connect region pings + STUN/UDP packet loss measured from your own connection.
- **HOSTED** — a Cloudflare Worker: browser-only download/upload/bufferbloat + packet loss via WebRTC over Cloudflare TURN. Region ping degrades to a browser HTTPS-RTT probe (browsers can't do raw TCP/UDP to game servers).

Core design value: **HONESTY**. Every metric is labeled with *how* it was obtained (TCP handshake vs HTTPS RTT, `stun-udp` vs `webrtc` loss, cloud-region geographic proxies), and a metric that could not be measured is reported as `null` — never faked as `0` or a perfect score.

## Setup & commands

Prereqs: **Node `>=20`** (`.nvmrc` pins major `20`) and **pnpm `>=10`** (`packageManager: pnpm@10.11.0`). Run `corepack enable` once to provision the pinned pnpm.

```bash
corepack enable && pnpm install   # one-time setup
```

All root scripts (from `package.json`) are thin orchestrators over `pnpm --filter <pkg> run <script>`:

| Command | What it does |
|---|---|
| `pnpm dev` | Runs `dev:server` + `dev:client` concurrently (LOCAL mode). Open http://localhost:5173. |
| `pnpm dev:server` | Node measurement server only (`tsx watch`) on `:8787`. |
| `pnpm dev:client` | Vite client only on `:5173` (proxies `/api` `/dl` `/ul` `/net` to `:8787`). |
| `pnpm build` | Builds the **client only**: `tsc --noEmit && vite build` → `client/dist`. The only build step in the repo. |
| `pnpm start` | Production server (`NODE_ENV=production tsx src/index.ts`) on `:8787`, serving the prebuilt `client/dist` same-origin. Run `pnpm build` first. |
| `pnpm typecheck` | Typechecks both workspaces: server (`tsc --noEmit`) then client (`tsc --noEmit`). |
| `pnpm test` | Runs the client Vitest suite (`vitest run`). Currently the only tests in the repo. |

Hosted-mode (Worker) tooling is **not** in `package.json` — `wrangler` is run via `pnpm dlx wrangler ...`:

```bash
pnpm build && pnpm dlx wrangler deploy        # deploy hosted mode (build first; Worker serves client/dist)
pnpm build && pnpm dlx wrangler dev           # local hosted-mode dev (reads TURN keys from gitignored .dev.vars)
pnpm dlx wrangler secret put TURN_KEY_ID      # also TURN_KEY_API_TOKEN — never commit these
```

## Layout / Key files

| File | Role |
|---|---|
| `shared/` | Single source of truth (types, game catalog, genre thresholds, grading math, WS protocol). **NOT a workspace package** — plain `.ts` imported by client via the `@shared/*` alias and by server via relative paths. |
| `server/` | Workspace package: Node + `ws` LOCAL-mode measurement plane (`/api/health`, `/dl`, `/ul`, `/net`). Runs via `tsx`, no build step. |
| `client/` | Workspace package: Vite + React + TS. UI shell + the browser measurement engine (`client/src/engine/`). |
| `worker/index.ts` | Cloudflare Worker for HOSTED mode: serves `client/dist` + one route `GET /api/turn`. Single `.ts` file, not a workspace package, built/run by Wrangler. |
| `wrangler.jsonc` | Worker config: `name fragrate`, `main worker/index.ts`, `assets.directory ./client/dist`. No `nodejs_compat`. |
| `pnpm-workspace.yaml` | Declares workspace packages — **only** `server` and `client`. |
| `package.json` | Root manifest + the canonical scripts above. Sole devDep: `concurrently`; also pins `pnpm.onlyBuiltDependencies: ["esbuild"]`. |
| `.nvmrc` | Pins Node to `20`. |
| `docs/` | Spec & design docs (see [See also](#see-also)). |

## Conventions

- **TypeScript strict + ESM** everywhere (`type: module` in every `package.json`). The client tsconfig adds `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` — unused imports fail the build.
- **No native dependencies.** Server's only runtime dep is `ws`; client's is React. Keep it that way.
- `shared/` has **zero runtime/third-party deps** — never import `node:*` or browser APIs there; it must compile into both the Node server and the Vite browser bundle.
- The `@shared/*` alias is configured in **three client files that must stay in sync**: `client/tsconfig.json` (`paths`, wildcard `@shared/*` → `../shared/*`), `client/vite.config.ts` and `client/vitest.config.ts` (`resolve.alias`, bare key `@shared` → the `shared` dir). The forms differ but resolve the same — keep each file's existing form. The server does **not** use the alias — it imports via relative paths and includes `../shared/**/*.ts` in `server/tsconfig.json`.
- **Clocks:** elapsed/RTT timing uses a monotonic clock — `performance.now()` (browser *and* Node) or `process.hrtime.bigint()` (Node) — **never** `Date.now()` for latency. `Date.now()` is only for wall-clock log/`startedAt` fields.
- **Units (load-bearing, encoded in field-name suffixes):** latency/jitter in ms (`*_ms`/`*Ms`), throughput in **base-10 Mbps** from wire bytes (`bytes*8/1e6/seconds`, never 1024-based), loss as a **whole percent** `0..100` (not a fraction).
- **Jitter** = mean absolute difference of *consecutive* (temporal-order) samples, computed identically on server and client so LOCAL and HOSTED numbers are comparable.
- **Honesty/labeling rule:** every metric must carry how it was obtained; unmeasured = `null`. Never relabel TCP/WS-derived loss as real packet loss, and disclose cloud-region endpoints as geographic proxies.
- **Git commit messages** follow Conventional Commits with a scope, inferred from history: `feat(client): …`, `fix(client): …`, `refactor(client): …`, `chore: …`. Scope is the affected area (`client`, `server`, etc.).

## Invariants — do not break

- `pnpm-workspace.yaml` must list exactly `server` and `client`. Do not make `shared/` or `worker/` workspace packages — it breaks the alias model and Worker build.
- **Mode detection** hinges on `GET /api/health`: the server returns `{ ok: true, service: 'fragrate', ... }`; the Worker deliberately **omits** it (404s `/api/*` instead) so the client resolves HOSTED. Do not add `/api/health` to the Worker, and do not remove/rename it on the server.
- The `/net` WebSocket contract and `NetReport` shape live once in `shared/protocol.ts`. Any message-shape change must be made in `shared/` plus both consumers (`server/`, `client/`) in lockstep.
- All verdict/scoring math lives in `shared/grading.ts` + `shared/thresholds.ts` and runs **client-side** (the server never grades). The weights, subscore breakpoints, bufferbloat penalty bands, and hard caps are interlocked — do not change a constant in isolation.
- Node `>=20` / pnpm `>=10` are pinned via `.nvmrc`, `packageManager`, and `engines`. Keep these and the committed `pnpm-lock.yaml` consistent — Cloudflare's Git deploy auto-detects them.
- TURN secrets (`TURN_KEY_ID`, `TURN_KEY_API_TOKEN`) must never be committed; they are Worker secrets / gitignored `.dev.vars`.

## Gotchas

- `pnpm build` builds **only the client**. The **server has no build step** (its `build` script is a no-op `echo`); it always runs through `tsx`. There is no `server/dist`.
- `pnpm start` does **not** build — run `pnpm build` first or it serves a stale/missing `client/dist`.
- In dev, hitting `:8787` directly looks broken: the server only serves `/api/health`, `/dl`, `/ul`, `/net` there (no UI). Vite on `:5173` serves the UI and proxies those paths.
- `worker/index.ts` is **not** covered by `pnpm typecheck` or `pnpm test` — its `Env`/`IceServer` types are hand-rolled and errors only surface at `wrangler deploy`/`wrangler dev`. Verify Worker changes manually.
- **Doc drift:** `docs/BUILD_SPEC.md` and `docs/MEASUREMENT_ENGINE.md` describe a `node-datachannel` server-side WebRTC loss path that does **not** exist. The real loss transports are `server/src/stun.ts` (STUN/UDP, LOCAL) and `client/src/engine/loss.ts` (WebRTC over Cloudflare TURN, HOSTED). Trust `README.md` and `docs/superpowers/` for current architecture; treat the two original specs as authoritative only for catalog/thresholds/grading/units.

## Making changes

- Before any change, run `pnpm typecheck`; before claiming done, run `pnpm typecheck && pnpm test`.
- Editing `shared/` ripples to both packages — typecheck both.
- Adding a `Genre` requires `shared/catalog.types.ts` (union) + `shared/thresholds.ts` (`GENRE_BANDS` entry) + `client/src/i18n.ts` (its `Record<Genre, …>`); all three are exhaustiveness-coupled. Adding a `Region` requires `shared/catalog.types.ts` + `shared/regions.ts`.
- Don't commit, branch, or push unless asked. End commit messages with the `Co-Authored-By` trailer.

## See also

Sub-guides (each scoped to its directory; defer here for global setup):

- [`shared/AGENTS.md`](shared/AGENTS.md) — domain types, catalog, thresholds, grading math, WS protocol.
- [`server/AGENTS.md`](server/AGENTS.md) — Node measurement plane (TCP pinger, STUN, throughput, `/net`).
- [`client/AGENTS.md`](client/AGENTS.md) — Vite + React UI shell, stores, i18n, components.
- [`client/src/engine/AGENTS.md`](client/src/engine/AGENTS.md) — browser measurement engine (orchestrator, throughput, loss, region ping, mode).
- [`worker/AGENTS.md`](worker/AGENTS.md) — Cloudflare Worker (hosted mode, `/api/turn`).
- [`docs/AGENTS.md`](docs/AGENTS.md) — spec & design docs and root config.

Key docs:

- [`README.md`](README.md) — user-facing overview, run/deploy, honesty table.
- [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md) — catalog, genre bands, grading math (source of truth for values; see doc-drift note above).
- [`docs/MEASUREMENT_ENGINE.md`](docs/MEASUREMENT_ENGINE.md) — measurement algorithms, units, timeline.
- [`docs/FRAGRATE-design-system.md`](docs/FRAGRATE-design-system.md) — visual design system & CSS tokens.
- [`docs/superpowers/specs/2026-06-26-browser-region-measurement-design.md`](docs/superpowers/specs/2026-06-26-browser-region-measurement-design.md) and [the plan](docs/superpowers/plans/2026-06-26-browser-region-measurement.md) — current hosted-mode region-measurement architecture.
