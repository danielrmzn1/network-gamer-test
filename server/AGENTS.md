# AGENTS.md — server (Node measurement plane)

> Scope: the `server/` directory. Nested AGENTS.md override; see the root [AGENTS.md](../AGENTS.md) for repo-wide rules.

## Overview

A thin Node + `ws` measurement plane for **LOCAL mode only**. It runs on the **player's own machine**, so every probe originates from the user's connection — the server cannot fake distance or last-mile conditions. This is the entire point: real per-region ping and real UDP loss are only honest when measured from the user's link, not from a datacenter.

- All latency is **root-free**: region ping is a **TCP-connect handshake** RTT (`pinger.ts`), not raw ICMP/root ping. Packet loss is **STUN binding requests over UDP** (`stun.ts`), not a privileged raw socket.
- The server is a **pure measurement layer** — it never grades. All scoring/verdict math runs client-side (see [`../shared/AGENTS.md`](../shared/AGENTS.md) and `client/src/engine/orchestrator.ts`).
- HOSTED mode is the Cloudflare Worker ([`../worker/AGENTS.md`](../worker/AGENTS.md)); it deliberately omits this server's endpoints so the client falls back to browser-only measurement. Region pings are most accurate **here, locally** — browsers can't do raw TCP/UDP to game endpoints.

## Setup & commands

Setup, Node/pnpm versions, and root scripts: see [../AGENTS.md](../AGENTS.md). Server-specific:

| Command | What |
| --- | --- |
| `pnpm --filter server run dev` | `tsx watch src/index.ts`; listens on `PORT` (default `:8787`, set in `index.ts`, not the script) (root: `pnpm run dev:server`). |
| `pnpm --filter server run start` | `NODE_ENV=production tsx src/index.ts`; serves `client/dist` if present. |
| `pnpm --filter server run typecheck` | `tsc --noEmit`; also type-checks `../shared/**/*.ts` (see `tsconfig.json` `include`). |
| `pnpm --filter server run build` | **No-op** — prints a message. There is no compile step; the server always runs via `tsx`. |

## Layout / Key files

| File | Role |
| --- | --- |
| `src/index.ts` | `node:http` entry on `PORT` (default `8787`). Routes `GET /api/health`, `GET /dl`, `POST /ul`, then static SPA, else 404. Attaches a `noServer` `WebSocketServer` that upgrades only `/net` (`socket.destroy()` for others) and sets `socket.setNoDelay(true)`. |
| `src/pinger.ts` | `pingEndpoint(host, port, opts)`: DNS `lookup` then open/destroy a TCP socket `count` times (defaults `count:8`, `timeoutMs:2000`, `gapMs:60`), timing the handshake with `process.hrtime.bigint()`. Returns `PingStats` (`min/avg/median/max`, MAD `jitter`, `lossPct`, `error:'dns'|'unreachable'`). |
| `src/stun.ts` | `stunProbe(opts)`: resolves the FIRST reachable `DEFAULT_STUN_SERVERS` entry (Google/Cloudflare; failover only), fires `count` (default `200`) 20-byte STUN binding requests over one `udp4` socket at `ratePps` (default `50`), pairs replies by 12-byte transaction id. Returns `StunLossData`. Supports `AbortSignal`. |
| `src/speedtest.ts` | `handleDownload` streams up to `MAX_DOWNLOAD` (1 GiB) of a pre-generated 1 MiB incompressible random `BLOCK` with backpressure and `content-encoding: identity`. `handleUpload` sinks the POST body and returns `{ bytes, ms }`. These `/dl`+`/ul` endpoints **are** the client's labeled `loopback` fallback — the client prefers Cloudflare's public speed endpoints and only uses these when Cloudflare is unreachable (that choice lives in `client/src/engine/throughput.ts`, not here; this file contains no Cloudflare logic). |
| `src/static.ts` | `serveStatic` serves `CLIENT_DIR` (`resolve(__dirname, '../../client/dist')`) with path-traversal containment, SPA fallback to `index.html`, MIME map, and immutable caching for paths containing `assets`. Returns `false` (so dev/Vite handles UI) when no build exists; `clientBuildExists()` gates it. |
| `src/ws/session.ts` | Per-connection `NetSession` for `/net`. Sends `hello` on connect, handles `probe:start` (runs `pingEndpoint` across targets with `PROBE_CONCURRENCY=6` workers), `loss:start` (runs `stunProbe`), and `session:abort`. One run at a time via a `busy` flag + single `AbortController`. |
| `tsconfig.json` | Strict ESNext / ES2022, `moduleResolution: Bundler`, `noEmit`. `include` covers `src/**/*.ts` **and** `../shared/**/*.ts`. |
| `package.json` | Package `server`. Sole runtime dep `ws`; dev deps `tsx`/`typescript`/`@types/node`/`@types/ws`. `type: module`. |

The `/net` wire contract is [`../shared/protocol.ts`](../shared/protocol.ts) (`ClientMessage`/`ServerMessage`, `ProbeStats`, `StunLossData`), imported **types-only** via relative paths (`../../shared`, `../../../shared`) — the server does NOT use the `@shared/*` alias. Methodology background: [`../docs/MEASUREMENT_ENGINE.md`](../docs/MEASUREMENT_ENGINE.md).

## Conventions

- ESM throughout (`type: module`); Node builtins use the `node:` prefix (`node:http`, `node:net`, `node:dgram`, `node:crypto`, `node:dns/promises`, `node:fs`, `node:path`, `node:url`).
- No framework: raw `node:http` with manual URL/path parsing (`(req.url ?? '/').split('?')[0]`) and manual `res.writeHead`/`res.end`.
- All durations are ms. RTT timing uses `process.hrtime.bigint()` / `performance.now()` divided by `1e6` — never `Date.now()` for latency (`Date.now()` is wall-clock only, e.g. `/api/health` `ts`).
- Callback I/O is Promise-wrapped with a single-settle guard (`settled`/`done` flag) to avoid double-resolve.
- Defensive parsing: `JSON.parse` and socket errors are swallowed and surfaced as `null`/`error` fields, never thrown — the server never crashes on a bad client message.
- Tunable params are optional `opts` with explicit defaults at the top of each function, kept in sync with the `ClientMessage` defaults in `protocol.ts`.
- Wire types are imported from `protocol.ts`, not redefined; the server-internal `PingStats` is a superset mapped to `ProbeStats` before sending.
- Keep the heavy methodology block comments atop each module — they encode the HONESTY rationale.

## Invariants — do not break

- `GET /api/health` MUST keep returning JSON `{ ok: true, service: 'fragrate', ts }`. The client's `detectMode()` treats a 200 with `service === 'fragrate'` as LOCAL mode; the Worker has NO `/api/health` so HOSTED resolves. Renaming/removing it breaks mode detection.
- The WebSocket endpoint MUST stay at path `/net` and reject all other upgrades (`socket.destroy()`). The Vite dev proxy and client `ws.ts` hardcode `/net`.
- All `/net` messages MUST conform to the `ClientMessage`/`ServerMessage` unions in `../shared/protocol.ts`. Change a message shape only by editing `shared/protocol.ts` and both consumers in lockstep.
- Region ping is **TCP-connect timing only**. Do NOT switch to ICMP/raw sockets — that needs root and defeats the run-anywhere, run-locally design.
- `stunProbe` MUST measure a **single** STUN server per run (first that resolves); the rest are failover only. Mixing servers contaminates jitter with inter-server baseline differences.
- Jitter MUST be the mean absolute difference of **consecutive (temporal) samples**, NOT the sorted array — sorting first telescopes jitter to `(max−min)/(n−1)`. True in both `pinger.ts` and `stun.ts`.
- `handleDownload` MUST send incompressible random bytes with `content-encoding: identity` and honor backpressure (`res.write` false → wait for `'drain'`). Compressible data or unbounded buffering falsifies throughput or OOMs the server.
- `NetSession` MUST run one measurement at a time (the `busy` guard); overlapping `probe`/`loss` runs share the one `AbortController` and would interfere.
- `serveStatic` MUST keep its path-traversal containment (`normalize` + `startsWith(CLIENT_DIR)`). Loosening it exposes arbitrary file reads.
- This server is the LOCAL-mode backend only — it never mints TURN credentials and never serves `/api/turn` (that is the Worker's job).

## Gotchas

- **No build output.** `build` is an `echo`; `start` runs `tsx src/index.ts`. `package.json` `main: dist/index.js` is never produced — don't add a `tsc` emit expecting `dist`.
- `tsc --noEmit` here also type-checks `../shared/` (via `include`), so a type error in `shared/` fails the server typecheck.
- **In dev the server does NOT serve the UI.** `clientBuildExists()` is false, `serveStatic` returns false, and everything 404s except `/api/health`, `/dl`, `/ul`, `/net`. Vite on `:5173` serves the UI and proxies these to `:8787`. Hitting `:8787` directly in dev looks broken but isn't.
- `CLIENT_DIR` resolves `../../client/dist` from `__dirname`; the comment assumes `server/dist` but code runs from `server/src` via `tsx` — the path math happens to resolve from both. Verify before relocating files.
- Immutable caching is a **substring match** `filePath.includes('assets')`; renaming the Vite assets dir, or any route containing `assets`, changes caching.
- `stunProbe` pacing uses a drift-free catch-up loop against `performance.now()`, not a fixed `setTimeout(intervalMs)`. Editing the loop can reintroduce timer drift that skews the send rate and thus `lossPct`.
- Outbound UDP to STUN ports (`19302`, `3478`) and arbitrary TCP region ports must be firewall-allowed; when blocked, loss reports `available:false` and pings report `error:'unreachable'` rather than failing loudly.
- `handleUpload`'s returned `ms` measures server-side receive duration only; the client may use its own timing — don't assume it's authoritative.
- `PORT` is read once at startup (default `8787`); the Vite proxy hardcodes `http://localhost:8787`, so overriding `PORT` in dev breaks the proxy.
- `ServerMessage` includes an `{ type: 'error' }` variant but `session.ts` never emits it currently; the client still rejects pending ops on socket close/error/timeout.

## Making changes

- Adding/changing a `/net` message: edit `../shared/protocol.ts` first, then this server and the client engine (`client/src/engine/ws.ts`) together.
- New measurement defaults: keep `pinger.ts`/`stun.ts` `opts` defaults aligned with the optional fields in `ClientMessage`.
- Run `pnpm --filter server run typecheck`; exercise end-to-end with root `pnpm dev` (server `:8787` + Vite `:5173`).

## See also

- [`../shared/AGENTS.md`](../shared/AGENTS.md) — the `/net` protocol and domain types (the contract boundary).
- [`../client/src/engine/AGENTS.md`](../client/src/engine/AGENTS.md) — the other `/net` consumer (`ws.ts`, `orchestrator.ts`).
- [`../worker/AGENTS.md`](../worker/AGENTS.md) — HOSTED mode; deliberately omits this server's endpoints.
- [`../docs/MEASUREMENT_ENGINE.md`](../docs/MEASUREMENT_ENGINE.md) — measurement algorithms and units.
