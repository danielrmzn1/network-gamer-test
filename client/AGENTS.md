# AGENTS.md — client (UI shell)

> Scope: the `client/` package — the Vite + React + TS presentation layer (gauges, meters, sparkline, verdict cards, region map, i18n, stores). It EXCLUDES `src/engine/` (measurement logic) and `@shared/*` (types/catalog), which have their own guides. Nested AGENTS.md override; see the root [AGENTS.md](../AGENTS.md) for repo-wide rules.

## Overview

- Single-page React 18 app, no framework beyond React: state, i18n, and routing are hand-rolled.
- Renders the `EngineState` snapshot from the global store and drives the engine via buttons (`onRun` → `runTest`, game/region picks → `recompute`).
- Trilingual EN/ES/PT-BR. Honesty-by-design: every metric shows how it was measured and which mode (`local`/`hosted`) is active.
- Stack: `vite@6`, `react`/`react-dom@18.3`, `typescript@5.7`, `vitest@2`, `@vitejs/plugin-react`. No state/i18n/router/CSS libraries.

## Setup & commands

Global setup (`corepack`, `pnpm install`, `pnpm dev`) lives in the root [AGENTS.md](../AGENTS.md). Client-only scripts:

| Command | What |
| --- | --- |
| `pnpm --filter client dev` | Vite dev server on `:5173`; proxies `/api`, `/dl`, `/ul`, `/net` (ws) to `:8787`. Root alias: `pnpm dev:client`. |
| `pnpm --filter client build` | `tsc --noEmit && vite build` → `client/dist`. Typecheck gates the build. |
| `pnpm --filter client typecheck` | `tsc --noEmit` only — fastest gate for UI edits. |
| `pnpm --filter client test` | `vitest run` (node env, `src/**/*.test.ts`). Currently matches only engine tests; none in this shell yet. |
| `pnpm --filter client preview` | Serve the built `dist/` to verify the production bundle. |

## Layout / Key files

| File | Role |
| --- | --- |
| `src/main.tsx` | Entry. Mounts `<App/>` into `#root` in `React.StrictMode`; imports `styles/global.css`. StrictMode double-invokes effects in dev. |
| `src/App.tsx` | Root + only wiring component. Subscribes via `useEngine()`, derives ping/jitter/loss fallback chains, maps to tones, lays out the whole page, calls `detectMode()` once. |
| `src/state/store.ts` | Framework-free reactive store. `EngineState` interface (UI source of truth), `EngineStore` with throttled notify, singleton `store = new EngineStore('lol','LATAM-North')`, `useEngine()` hook, `Status` type. |
| `src/i18n.ts` | All user-facing copy + the language store. `S` string table, `t()`, enum maps (`GENRE`/`VERDICT`/`REASON`/`TONE`/`PHASE`/`PHASE_SHORT`), sentence builders, `setLang`/`useLang`, `Lang` type. |
| `src/lib/format.ts` | Pure formatters: `fmt` (`—` for null/non-finite), `fmtMbps` (adaptive precision), `mbpsBarPct` (log-scaled bar fill). |
| `src/lib/tone.ts` | Pure metric→tone: `toneLower(v, LowerBand)` → `good`/`warn`/`bad`/`neutral`, `gaugeMax(band)`, `Tone` type. (`toneWord` is English-only and superseded by `i18n.gaugeStateWord`.) |
| `src/components/Hero.tsx` | Verdict banner: rank badge, eyebrow, CTA, and the metric/method meta line (backend, loss method, TCP-vs-HTTPS latency note). |
| `src/components/ArcGauge.tsx` | Hand-built SVG 270° arc gauge (ping/jitter/loss); `—` when null. |
| `src/components/Meters.tsx` | Download/upload bars (live ?? measured) + bufferbloat tile with `InfoTip`. |
| `src/components/Sparkline.tsx` | Rolling-latency `<canvas>` chart (manual DPR scaling, `ResizeObserver`, data held in a ref). |
| `src/components/GameCard.tsx` | Per-game verdict card; `gradeColor` maps rank letter to a CSS var. |
| `src/components/RegionSelector.tsx` | Region grid filtered to the game's allowed regions; shows label/metro/median ping. |
| `src/components/PhaseStepper.tsx` | 5-step progress strip: `['regions','loss','download','upload','compute']` (omits `bufferbloat`). |
| `src/components/RankBadge.tsx` / `Frame.tsx` / `InfoTip.tsx` | Gold rank crest; notched panel wrapper; accessible portal tooltip. |
| `src/styles/global.css` | Design tokens (CSS custom props, `--cut-*` clip-paths), body background, `.np-frame`/`.np-cut` primitives, reduced-motion. Imported by `main.tsx`. |
| `src/styles/components.css` | All component `.np-*` styles, responsive breakpoints (980/760/460px), animations. Imported by `App.tsx`. |
| `index.html` | HTML host: loads Marcellus SC + Rajdhani from Google Fonts, dark `color-scheme`, inline SVG ⚡ favicon, `/src/main.tsx`. |
| `vite.config.ts` / `vitest.config.ts` / `tsconfig.json` | `@shared` alias (→ `../shared`) declared in all three; dev proxy + `fs.allow ['..']` in Vite; strict TS with `noUnusedLocals/Parameters`. |

## Conventions

- **Styling is current hand-written CSS** — all classes are prefixed `np-` (legacy "netping" namespace), kebab-case. No CSS modules / Tailwind / CSS-in-JS today. Per-element dynamic color is passed as inline CSS custom props (e.g. `style={{ '--c': gradeColor(rank) } as CSSProperties}`) and consumed in the stylesheet. Reuse the tokens in `global.css`; don't introduce ad-hoc colors.
- **Visuals are hand-built**, not library widgets: `ArcGauge` is raw SVG, `Sparkline` is a raw `<canvas>`. There is no charting/gauge dependency.
- **All visible text comes from `i18n.ts`.** Add UI strings to `S` and read via `t(lang, key)`; enum labels via the typed maps; multi-part sentences via the builder functions. Tiny inline ternaries (e.g. `'now'`/`'ahora'` in `Sparkline`) are tolerated only for trivial words.
- **State only via `store.set(patch, immediate?)` / `store.reset()`** — never mutate `EngineState` in place. `set` updates synchronously but throttles notifications ~100ms unless `immediate=true`.
- Components are presentational with explicit `Props` interfaces; `App.tsx` is the only wiring component besides the two stores.
- Null/absent metrics are `null`, rendered as `—` (`fmt`) — never raw `null`/`NaN`. Guard with `Number.isFinite`.
- `@shared/*` for shared imports; relative paths otherwise. `.ts`/`.tsx` extensions are imported explicitly (e.g. `import App from './App.tsx'`).
- Accessibility is intentional: `type='button'` + `aria-pressed` toggles, `role`/`aria-label` on SVGs, `aria-describedby`/`aria-expanded`/Escape on `InfoTip`. `prefers-reduced-motion` is honored in CSS — a global wildcard block in `global.css` plus a block in `components.css` that disables the `.np-infotip-pop` entry animation (it is a stylesheet concern; `InfoTip.tsx` itself has no reduced-motion logic). Preserve these.

## Invariants — do not break

- Store singleton defaults are `'lol'` + `'LATAM-North'` (the product's intended first-load defaults). Changing them changes the default game/region everywhere.
- Keep the `store.set` ~100ms throttle and `SPARK_MAX = 120` cap — they keep high-frequency live phases from thrashing React and bound memory. Use `immediate=true` for things that must repaint at once (e.g. mode detection: `store.set({ mode }, true)`).
- `i18n.ts` `S` is typed `satisfies Record<string, Entry>` and the enum maps are `Record<EnumType, Entry>` — every key needs `en`, `es` and `pt`. Adding a shared `Genre`/`VerdictState`/`PhaseName` is a compile error here until translated; keep the maps exhaustive.
- `i18n.ts` defaults the language from the browser/system locale on first visit (first `navigator.languages` entry starting `es` → Spanish or `pt` → Portuguese, else English), then persists the choice to `localStorage['fragrate-lang']`. Preserve this first-visit behavior.
- Keep every metric's "how it was measured" label intact: the Hero meta line (latency TCP vs HTTPS, loss method, backend) and the footer `noteBody` differ by mode. This is the core HONESTY value.
- The `@shared` alias and dev proxy paths (`/api`, `/dl`, `/ul`, `/net` with `ws:true` → `:8787`) must stay in sync across `vite.config.ts`, `vitest.config.ts`, and `tsconfig.json`.
- Build runs under `strict` + `noUnusedLocals`/`noUnusedParameters` — unused imports/vars fail the build. Keep code clean.

## Gotchas

- The engine (`src/engine/`) is the SOLE producer of `EngineState`. UI changes needing new data must coordinate with the engine; `EngineState` in `state/store.ts` is the contract. App imports `runTest`/`recompute` from `./engine/orchestrator` and `detectMode`/`RunMode` from `./engine/mode`.
- `s.mode` is a tri-state: `'unknown'` until `detectMode()` resolves, then `'local'`/`'hosted'`. Several branches pass `mode={s.mode === 'unknown' ? undefined : s.mode}` — handle all three.
- `PhaseStepper.STEPS` deliberately omits `'bufferbloat'` (measured inside download/upload); its `compute` step shows "Score".
- App's fallback chains (e.g. `ping = report.selectedPing.median ?? liveRegion.median ?? null`) make gauges show live values during a run and final report values after — preserve the precedence.
- Two tone/word systems exist: `lib/tone.ts` `toneWord` (English-only, largely unused) vs `i18n.gaugeStateWord` (localized, actually rendered). Use the i18n version for displayed text.
- `GameCard.gradeColor` maps grades unusually (`C`→green, `D`→warn, `F`→bad, `S/A/B`→teal). Intentional — don't "fix" to a naive gradient.
- `InfoTip`'s bubble is a fixed-position portal to `document.body` and dismisses on any scroll/resize by design (it does not reposition).
- StrictMode double-invokes effects in dev (so `detectMode` runs twice) — harmless here because `detectMode` is module-cached (`engine/mode.ts`) and is also called once inside `runTest`, so repeats return the same value; still, don't rely on single-invocation side effects in general.
- Fonts load from Google Fonts CDN via `index.html`; offline/blocked-CDN falls back to the `--font-display`/`--font-ui` stacks.
- Some `.np-*` rules in `components.css` (e.g. `.np-runlocal*`) are dead; the rendered hosted note uses `.np-runlocal-note` / `.np-region-graded`. Don't assume every rule has a live consumer.

## Making changes

- **Upcoming styling migration:** a migration of client styling to **Tailwind CSS v4** is in progress **on the `feat/tailwind-migration` branch** (token-first, UI to stay pixel-identical). Its design spec and plan — `docs/superpowers/specs/2026-06-26-tailwind-migration-design.md` and `docs/superpowers/plans/2026-06-26-tailwind-migration.md` — plus the actual Tailwind wiring (a new `src/styles/index.css`, edited `vite.config.ts`/`package.json`) live **only on that branch** and are **not present in this tree**. The hand-written CSS described above (`styles/global.css` + `styles/components.css`, `np-*` classes) is the CURRENT reality on this branch — work against it, but check out `feat/tailwind-migration` before any large CSS change so you don't duplicate or conflict with the migration.
- For measurement/scoring/mode logic: see [`./src/engine/AGENTS.md`](./src/engine/AGENTS.md). Verdict math and thresholds live in `@shared` (see [`../shared/AGENTS.md`](../shared/AGENTS.md)) — not here.
- After UI edits, run `pnpm --filter client typecheck` (fast) then `pnpm --filter client build` before claiming done.

## See also

- [`./src/engine/AGENTS.md`](./src/engine/AGENTS.md) — browser measurement engine (the producer of `EngineState`).
- [`../shared/AGENTS.md`](../shared/AGENTS.md) — domain types, game catalog, genre thresholds, grading math, WS protocol.
- [`../AGENTS.md`](../AGENTS.md) — repo-wide setup, modes, and global commands.
- [`../docs/FRAGRATE-design-system.md`](../docs/FRAGRATE-design-system.md) — visual design system and CSS token reference.
