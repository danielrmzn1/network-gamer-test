# AGENTS.md — Cloudflare Worker (hosted mode)

> Scope: the `worker/` directory and the repo-root `wrangler.jsonc`. Nested AGENTS.md override; see the root [AGENTS.md](../AGENTS.md) for repo-wide rules.

## Overview

- The single Cloudflare Worker (Workers Static Assets) that powers FRAGRATE's **HOSTED mode**.
- Serves the built client from `client/dist` (the `ASSETS` binding) and exposes exactly one dynamic route: `GET /api/turn`.
- `GET /api/turn` mints **short-lived** Cloudflare Realtime TURN credentials server-side so the long-term TURN key never reaches the browser.
- HOSTED mode = browser-only measurements (download/upload/bufferbloat + last-mile WebRTC packet loss). There is no local Node server here, so there is **no server-measured / raw TCP-or-UDP region ping**; per-region latency is instead measured **in the browser as HTTPS RTT** (see [`../client/src/engine/regionPing.ts`](../client/src/engine/regionPing.ts)), which reads somewhat above a true UDP ping. The Worker itself never measures region latency.

## Runtime constraints — read first

- **Web APIs only.** `worker/index.ts` uses only `fetch` / `Response` / `URL`. There are NO imports.
- **No `nodejs_compat`** in `wrangler.jsonc`. Do NOT import any Node builtin (`node:*`) — it breaks at deploy/runtime.
- **Module-worker format**: `export default { async fetch(request, env) }`. Not service-worker `addEventListener` style.
- Secrets come from the `env` parameter (typed by a local `interface Env`). No `process.env`, no dotenv.
- This Worker is **not** covered by `pnpm typecheck` (no tsconfig includes `worker/`, no `@cloudflare/workers-types` installed). `Env`/`IceServer` are hand-rolled. It is type-checked only implicitly by `wrangler` at `wrangler dev` / `wrangler deploy`, where errors first surface. There are no tests for the Worker.

## Setup & commands

Global setup lives in [../AGENTS.md](../AGENTS.md). Worker-specific flow (`wrangler` is fetched on demand via `pnpm dlx` — it is NOT a declared dependency and there is no `deploy` npm script):

| Command | What |
| --- | --- |
| `pnpm run build` | Build the client into `client/dist` (the `assets.directory`). Required before any deploy. |
| `pnpm build && pnpm dlx wrangler dev` | Run the Worker locally for hosted-mode dev (serves `client/dist` + `/api/turn`). Reads secrets from a gitignored `.dev.vars`. |
| `pnpm dlx wrangler deploy` | Deploy the Worker. Run after `pnpm run build`. |
| `pnpm dlx wrangler secret put TURN_KEY_ID` | Set the TURN Key/Token ID secret. |
| `pnpm dlx wrangler secret put TURN_KEY_API_TOKEN` | Set the TURN Bearer API token secret. |

- `pnpm dev` (root) runs the Node server + Vite (LOCAL mode), NOT this Worker.
- Local secrets go in a gitignored `.dev.vars`; `.dev.vars` and `.wrangler/` are in `.gitignore`. Without the secrets, hosted-mode loss degrades to `available:false` ("run locally") and the site still works.

## Layout / Key files

| File | Role |
| --- | --- |
| `index.ts` | Worker entry (`main` in `wrangler.jsonc`). Default export with `async fetch(request, env)`. Routes `GET /api/turn` → `handleTurn`; non-GET `/api/turn` → 405; any other `/api/*` → 404; everything else → `env.ASSETS.fetch(request)`. Local `Env`, `IceServer`, and a `json()` helper. |
| `../wrangler.jsonc` | Worker config at repo root: `name: "fragrate"`, `main: "worker/index.ts"`, `compatibility_date: "2026-06-25"`, and `assets { directory: "./client/dist", binding: "ASSETS", not_found_handling: "single-page-application" }`. No `nodejs_compat`. TURN secrets are intentionally not stored here. |

## Conventions

- TypeScript, ES module style, 2-space indent, no semicolons, single quotes (matches the repo).
- Routing is literal pathname compare via `new URL(request.url)` (`url.pathname === '/api/turn'`, `url.pathname.startsWith('/api/')`) — no router library.
- JSON responses always go through the local `json(body, status, extra)` helper (sets `Content-Type: application/json`).
- No throwing for expected failures: missing secrets → 500, upstream non-OK → 502. The client treats any non-OK as "no TURN" and degrades.
- Comments explain WHY (why `:53` URLs are dropped, why there is no `/api/health`). Preserve that intent.
- TTL is in seconds (`ttl = 86400`; commented max `172800` / 48h).

## Invariants — do not break

- **Do NOT add a `GET /api/health` route.** Its absence is load-bearing: the client's `detectMode()` ([../client/src/engine/mode.ts](../client/src/engine/mode.ts)) probes `/api/health` and only treats a 200 whose JSON has `service === 'fragrate'` as LOCAL. The Worker must let `/api/health` fall into the `/api/*` 404 branch so HOSTED mode is detected.
- The `/api/turn` success response MUST be shaped `{ iceServers: [...] }` (array of `{ urls: string[], username?, credential? }`). [../client/src/engine/loss.ts](../client/src/engine/loss.ts) reads `j.iceServers` and passes it into `RTCConfiguration`. Renaming the field or changing the shape breaks hosted-mode packet-loss measurement.
- `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` stay as Worker secrets (set via `wrangler secret` / dashboard / `.dev.vars`). Never hardcode them or send them to the browser — keeping the long-term key server-side is the whole point of `/api/turn`.
- The `:53` URL filter must stay: ICE URLs containing `':53'` are dropped because Chrome/Firefox block them and (without trickle ICE) the connection stalls.
- `assets.directory` must remain `./client/dist` and `not_found_handling` must remain `single-page-application` — the client is a Vite SPA and relies on the `index.html` fallback. Run `pnpm run build` before deploy so `client/dist` exists.
- Keep the Worker free of Node APIs (no `nodejs_compat`). Only `fetch`/`Response`/`URL`/Web APIs.

## Gotchas

- `handleTurn` returns **500** when secrets are missing but **502** when the upstream Cloudflare Realtime call fails. The client collapses both to `available:false`, but the distinction matters for debugging (500 = secrets not set, 502 = upstream/credentials rejected).
- The success response sets `Cache-Control: no-store`; creds are short-lived (`ttl 86400s`). Don't add caching that would serve stale/expired creds.
- TURN setup is optional: without the two secrets the site still works — hosted-mode loss just shows `available:false`. The Worker never measures region ping itself; in hosted mode per-region latency is measured **in-browser as HTTPS RTT** (a browser can't do raw TCP/UDP to game servers), so it reads somewhat above a true UDP ping. It is not unavailable — just measured differently and labeled as such.
- Cloudflare's Git deploy auto-detects pnpm (committed `pnpm-lock.yaml` + `packageManager`) and Node 20 (`.nvmrc`), runs `pnpm run build`, then `npx wrangler deploy`. Pushes to `main` auto-redeploy.

## Making changes

- Edit `worker/index.ts`, then verify manually — there is no typecheck or test gate. Use `pnpm build && pnpm dlx wrangler dev` and hit `/api/turn`, or deploy and check.
- Any change to the `/api/turn` shape or the `/api/health` absence must be coordinated with the client engine ([../client/src/engine/loss.ts](../client/src/engine/loss.ts), [../client/src/engine/mode.ts](../client/src/engine/mode.ts)).

## See also

- [../AGENTS.md](../AGENTS.md) — repo-wide rules and setup.
- [../client/src/engine/AGENTS.md](../client/src/engine/AGENTS.md) — the hosted-mode measurement engine that consumes `/api/turn`.
- [../server/AGENTS.md](../server/AGENTS.md) — the LOCAL-mode Node server that provides `/api/health`, `/net`, `/dl`, `/ul`.
- [../docs/superpowers/specs/2026-06-26-browser-region-measurement-design.md](../docs/superpowers/specs/2026-06-26-browser-region-measurement-design.md) — current hosted-mode design and honesty-label matrix.
