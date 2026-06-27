# AGENTS.md — shared/ (single source of truth)

> Scope: the `shared/` directory. Nested AGENTS.md override; see the root [AGENTS.md](../AGENTS.md) for repo-wide rules.

## Overview

`shared/` is the runtime-dependency-free single source of truth for FRAGRATE's domain types, game/region catalog, per-genre quality thresholds, the scoring/grading math, and the `/net` WebSocket contract. Both consumers depend on it:

- **Client** (Vite/browser) imports via the `@shared/*` path alias.
- **Server** (Node, run via `tsx`) imports via relative paths and a `tsconfig` include.

A change here ripples to **both**. This is the contract boundary — edit it knowing two compilers will validate it.

## Setup & commands

`shared/` has **no build/typecheck of its own** — it is plain `.ts` compiled into each consumer. It is validated only through whoever imports the changed file. From repo root:

- `pnpm typecheck` — typechecks `server` then `client` (the way `shared/` is type-validated).
- `pnpm --filter client run build` — `tsc --noEmit && vite build`; strictest gate, compiles every shared file the client uses.

See [../AGENTS.md](../AGENTS.md) for full setup.

## Layout / Key files

| File | Role |
| --- | --- |
| `catalog.types.ts` | Core domain types, zero runtime deps: `Region` union (13 literals), `EndpointKind` (`'cloud-proxy'\|'gameserver'\|'baseline'`), `Confidence`, `Genre` (9 literals), `Endpoint`, `Game`. |
| `catalog.ts` | `GAMES: Game[]` (10 games: `lol`, `valorant`, `cs2`, `dota2`, `fortnite`, `rocket-league`, `apex`, `warzone`, `overwatch2`, `minecraft`) with per-region endpoints. Exports `GAME_BY_ID` (lookup) and `gameRegions(id): Region[]` (distinct regions in catalog order). Almost every endpoint is a cloud-region TCP-443 proxy; only Minecraft has real gameservers on `25565`. |
| `regions.ts` | `RegionInfo` + `REGIONS: RegionInfo[]` (one neutral AWS `ec2.<region>` TCP-443 endpoint per `Region`) + `REGION_BY_ID: Record<Region, RegionInfo>`. The per-region ping-sweep target list (drives the heatmap). |
| `baselines.ts` | `BASELINES: Endpoint[]` — neutral anchors (`1.1.1.1`, `8.8.8.8`, AWS regions) with `kind:'baseline'`. **Currently defined but unreferenced** by `client/src` or `server/src`. |
| `thresholds.types.ts` | `LowerBand {great,good,ok,bad}` (lower-is-better, 4 edges), `HigherBand {good,ok}` (throughput), `GenreBands`. |
| `thresholds.ts` | `GENRE_BANDS: Record<Genre, GenreBands>` — per-genre quality bands (ping/jitter ms, loss %, dl/ul Mbps) + a human `note`. Must stay exhaustive over `Genre`. |
| `grading.ts` | All scoring math (runs **client-side**). `lowerSubscore`/`higherSubscore`, `Rank`, `BloatGrade`, `VerdictState`, `MetricInputs`, `bloatPenalty`/`bloatGrade`, `scoreToLetter`, `GradeResult`, `grade(m, bands)`, `rankToVerdict`, `limitingFactor`. |
| `protocol.ts` | The `/net` WebSocket contract + assembled `NetReport`. `PhaseName`, `ProbeStats`, `StunLossData`, `LossSummary`, `ThroughputResult`, `BufferbloatResult`, `GameVerdict`, `NetReport`, and the `ClientMessage`/`ServerMessage` unions. The only shared file the server imports (types only). |

## Conventions

- **Plain `.ts`, zero runtime/third-party deps.** Do NOT add `node:*` imports or browser APIs (`window`/`document`/`navigator`) — this code is bundled into both environments.
- ESM, `import type` for type-only imports (required by both `tsconfig`s' bundler/isolated-module resolution). **No default exports** — everything is named.
- Data tables are exported `const` arrays/records (`GAMES`, `REGIONS`, `BASELINES`, `GENRE_BANDS`) with O(1) lookup maps via `Object.fromEntries` (`GAME_BY_ID`, `REGION_BY_ID`).
- **Units are load-bearing field-name suffixes**: `*_ms`/`*Ms` = milliseconds; `*_pct`/`lossPct` = **percent (0..100, not a fraction)**; `*Mbps`/`*_mbps` = megabits/sec.
- Prefer string-literal unions over enums; `Record<Union, T>` tables are expected to be exhaustive over the union.
- **"Could not be measured" is `null`**, never `0` or a sentinel number (`loss_pct`, `rtt_loaded`, `ProbeStats.min/avg/median/jitter`, `LossSummary.lossPct`, `bloatGrade`, `overallRank`).
- No exceptions for domain logic: `gameRegions` returns `[]` for unknown ids; `grade()` renormalizes around missing metrics.

## Invariants — do not break

- **`grade()` is exact and interlocked — do not change a constant in isolation.** Subscore breakpoints (100/85/60/25/0), base weights (`0.34*ping + 0.28*jitter + 0.23*loss + 0.15*throughput`; `throughput = 0.6*dl + 0.4*ul`), the unmeasured-loss renormalization (divide by `0.77` when loss is `null`), `bloatPenalty` bands (5/30/60/200 ms → 0/3/8/16/28), and `scoreToLetter` cutoffs (95/85/72/58/40) move together.
- **Unmeasured loss must NOT score as 0%.** When `loss_pct` is `null`, `grade()` drops the loss term and renormalizes (`/0.77`); when `rtt_loaded` is `null`, the bufferbloat penalty/grade are skipped. Scoring a missing metric as perfect inflates ranks and violates HONESTY.
- **Hard caps** apply AFTER letter lookup and use band edges, not subscores: `loss>lossPct.bad`→cap C, `ping>pingMs.bad`→cap C, `jitter>jitterMs.bad`→cap B, bufferbloat `added>200ms`→cap C. `capRank` can only lower a rank. The bufferbloat cap uses the **200ms penalty-band edge, not** the display-grade threshold (>400ms) — see the inline comment.
- `ORDER = ['S','A','B','C','D','F']` must stay aligned with `scoreToLetter` and the `Rank`/`BloatGrade` unions (`capRank` indexes into it).
- **Exhaustiveness coupling:** `GENRE_BANDS` must have an entry for every `Genre`, and `client/src/i18n.ts` has a `Record<Genre, …>` that must too — adding a `Genre` requires `catalog.types.ts` + `thresholds.ts` + `i18n.ts` or typecheck breaks. Every `Game.genre` must be a `GENRE_BANDS` key (the orchestrator does `GENRE_BANDS[g.genre]`).
- **`Region` is a closed union.** Every `Endpoint.region`, `RegionInfo.region`, and `NetReport.region` must be a member. `REGION_BY_ID` is cast as `Record<Region, RegionInfo>` and assumes `REGIONS` covers the union — a new `Region` literal without a `REGIONS` entry leaves a hole.
- **`Game.id` values are stable slugs** (`GAME_BY_ID` keys, `NetReport.selectedGameId`, persisted client state) — do not rename existing ids.
- **`protocol.ts` is the byte-level WS contract.** Any change to `ClientMessage`/`ServerMessage` discriminants or fields (`ProbeStats`, `StunLossData`, etc.) must land in **both** consumers in lockstep, since both sides parse against these exact shapes.
- Probe targets live ONLY in shared (`REGIONS`/`GAMES`); the server has no hardcoded endpoint list and probes whatever `ProbeTarget[]` the client sends. Keep host/port truth here, not server-side.

## Gotchas

- **Not a pnpm workspace package.** `shared/` has no `package.json` and no `tsconfig.json`; `pnpm-workspace.yaml` lists only `server` and `client`. It is plain source compiled into each consumer.
- **Two import mechanisms, both must keep working.** The client uses `@shared/*` defined in **three files that must stay in sync** — `client/tsconfig.json` (`paths`, wildcard form `@shared/*` → `../shared/*`), `client/vite.config.ts` and `client/vitest.config.ts` (`resolve.alias`, bare-key form `@shared` → the `shared` dir). The two forms differ but resolve identically — preserve whichever form a file already uses. The server does NOT use the alias; it imports via relative paths (`../../shared/protocol`, `../../../shared/protocol`) and includes `../shared/**/*.ts` in `server/tsconfig.json`. Renaming/moving `shared/` breaks all of these.
- **Server imports `protocol.ts` only, and only as types.** `grading.ts`, `thresholds.ts`, `catalog.ts`, `regions.ts`, `baselines.ts` are **client-side only** — all verdict/score computation happens in the browser (`client/src/engine/orchestrator.ts`). The server is a pure measurement layer and never grades.
- `lossPct`/`loss_pct` are whole percentages (0..100), e.g. `100` = total loss; band edges like `0.1`/`0.5`/`2` are also percent.
- `GradeResult.score` is post-penalty but **pre-cap** (caps only affect the letter rank, not the number). `bloatGrade` is the 6-band display grade and can read better than the cap implies (cap fires at 200ms added, display `'F'` only at >400ms).
- `limitingFactor` returns `caps[0]` if any cap fired, else the lowest subscore only if `<70`, else `null` — a UI heuristic, not a strict minimum.
- `EndpointKind`/`Confidence` are display/honesty metadata, NOT grading inputs — don't repurpose them.
- `BASELINES` is exported but unwired — don't assume it is used.

## Making changes

- Editing `grade()` or the bands: change the interlocked constants together (see Invariants), then run `pnpm typecheck` and `pnpm --filter client run build`.
- Adding a `Genre`: update `catalog.types.ts` (union) + `thresholds.ts` (`GENRE_BANDS`) + `client/src/i18n.ts` (its `Record<Genre, …>`).
- Adding a `Region`: update `catalog.types.ts` (union) + `regions.ts` (`REGIONS` entry).
- Touching `protocol.ts` message shapes: update `shared/protocol.ts`, the server WS layer, and the client engine in one change.
- The canonical catalog/threshold/grading values and units are documented in [../docs/BUILD_SPEC.md](../docs/BUILD_SPEC.md) and [../docs/MEASUREMENT_ENGINE.md](../docs/MEASUREMENT_ENGINE.md) — the `.ts` here is the live source of truth.

## See also

- [../AGENTS.md](../AGENTS.md) — repo-wide rules and commands.
- [../server/AGENTS.md](../server/AGENTS.md) — LOCAL-mode server; consumes `protocol.ts`.
- [../client/AGENTS.md](../client/AGENTS.md) and [../client/src/engine/AGENTS.md](../client/src/engine/AGENTS.md) — UI and the engine that runs `grade()`.
