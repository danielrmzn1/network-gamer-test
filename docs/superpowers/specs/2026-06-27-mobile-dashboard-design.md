# Design Spec: Mobile dashboard (tabbed layout)

**Date:** 2026-06-27
**Status:** Approved (brainstorming) — pending spec review
**Scope:** `client/` only. No `server/` / `worker/` / `shared/` changes.

## Goal

Add a purpose-built **mobile** experience for the FRAGRATE tester at viewports
≤768px: a tabbed, single-column layout (sticky header with verdict + stat strip;
**Overview / Games / Regions** tabs) imported from the `Dashboard Mobile.dc.html`
Claude Design prototype. The **desktop layout (≥768px) stays exactly as it is
today** — same DOM, same pixels.

The prototype is a *visual/interaction* reference only. Its mock data
(`netpulse-data.js`), iOS device frame (`ios-frame.jsx`), and `<x-dc>` templating
are **not** used. The real mobile UI is wired to the live engine store, the same
source of truth the desktop uses.

## Non-goals

- No visual or behavioral change to the desktop layout.
- No engine / measurement / scoring / `@shared` changes. `EngineState` already
  exposes everything both layouts need.
- No new runtime dependencies.
- No separate routes/URLs for mobile (no `/m`); same canonical URLs, same SSG.
- No redesign of the per-game content pages (`GamePage`/`GameRoute`).

## Decisions (locked during brainstorming)

1. **Coexistence:** render *both* layouts; switch with a CSS breakpoint
   (`hidden md:block` desktop / `md:hidden` mobile). SSR/hydration-safe, no flash,
   SEO-safe. Not JS viewport detection.
2. **Breakpoint:** Tailwind `md` = 768px. ≤768px → mobile tabs; ≥768px → current
   desktop layout.
3. **Game tap (Games tab):** tapping a game **selects** it (re-grades Overview
   gauges + header verdict for its genre/region via `onPickGame`) **and** expands
   its "Limited by …" reason inline.

## Architecture

### `App.tsx` stays the single wiring component

`App.tsx` keeps all hooks, effects, derivations, and handlers it has today:

- `useEngine()`, `useLang()`, `useNavigate()`
- derived `game`, `bands`, `ping`/`jitter`/`loss`, `pingTone`/`jitterTone`/`lossTone`
- handlers `onRun`, `onPickGame`, `onPickRegion`
- the mount effect (first-visit lang redirect, `?game=` preselect, `detectMode()`)
- the `seo` / `jsonLd` / `alternates` objects

Changes to `App.tsx` (the **only** desktop-touching edits, all behavior-preserving):

1. Hoist `<Seo … />` to the top of the returned fragment so it renders once,
   independent of the breakpoint split. (It renders into `<head>` — no visual change.)
2. Add `hidden md:block` to the existing `np-app` root wrapper `<div>`. Its inner
   markup (header, game picker, error banner, `<Hero>`, `<PhaseStepper>`, gauges,
   `<Meters>`, `<Sparkline>`, `<GameCard>` grid, `<RegionSelector>`, note, footer)
   is **left byte-identical** — not moved, not reordered.
3. Add a sibling `<MobileDashboard … />` (its own root carries `md:hidden`).
4. Extract a shared `onSelectLang(l: Lang)` handler
   (`rememberLang(l); navigate(l === 'es' ? '/es' : '/')`) and use it for both the
   existing desktop EN/ES buttons (identical effect) and the mobile toggle.

Resulting render shape:

```jsx
return (
  <>
    <Seo … />
    <div className="np-app … hidden md:block"> {/* unchanged desktop layout */} </div>
    <MobileDashboard {…dashboardProps} />   {/* root is md:hidden */}
  </>
)
```

> Rationale for keeping desktop in `App.tsx` (vs extracting a `DesktopDashboard`
> file): the smallest possible diff is the strongest guarantee that "desktop stays
> the same," and it's the easiest to review. Extraction is deferred (YAGNI).

### Shared props contract

A single props bundle is computed in `App.tsx` and passed to `MobileDashboard`
(exported as `DashboardProps` from `components/mobile/MobileDashboard.tsx`):

```ts
interface DashboardProps {
  s: EngineState
  lang: Lang
  game: Game
  bands: (typeof GENRE_BANDS)[Genre]   // = GENRE_BANDS[game.genre]; mobile derives maxes via gaugeMax()
  ping: number | null
  jitter: number | null
  loss: number | null
  pingTone: Tone
  jitterTone: Tone
  lossTone: Tone
  onRun: () => void
  onPickGame: (id: string) => void
  onPickRegion: (r: Region) => void
  onSelectLang: (l: Lang) => void
}
```

Mobile child components read text via `useLang()`/`t()` from context (the route's
`<LangProvider>` already wraps `App`), exactly like the existing components.

## Mobile component tree

New folder `client/src/components/mobile/`:

- **`MobileDashboard.tsx`** — orchestrator. Owns local UI state via `useState`:
  `tab: 'overview' | 'games' | 'regions'` (default `'overview'`),
  `filter: 'all' | 'playable'` (default `'all'`),
  `expandedId: string | null` (default `null`).
  Renders the sticky header, the active tab panel, and the footer. Root `<div>`
  carries `md:hidden` + the mobile background wash.
- **`MobileGames.tsx`** — Games tab: All/Playable filter chips + the game rows.
- **`MobileRegions.tsx`** — Regions tab: 2-column region chip grid.

The Overview tab content and the sticky header are small enough to live inside
`MobileDashboard.tsx` (header is composed inline; a tiny local `HexGrade` badge
helper may be defined in-file). Granularity may flex slightly during planning, but
no file should grow past one clear responsibility.

### Sticky header (always visible)

- Top padding uses `env(safe-area-inset-top)` (drop the prototype's fixed 56px
  iOS-frame spacer). Own gold→teal 2px top glow line.
- Brand `FRAG`+teal`RATE`; `Hosted` badge when `s.mode === 'hosted'`; EN/ES toggle
  (`aria-pressed`, calls `onSelectLang`).
- **Verdict row:**
  - Compact hex grade badge (`HexGrade`): shows the selected game's verdict `rank`
    when `status === 'done'`, else `?`.
  - Eyebrow: `${t('verdict')} · ${game.name} · ${regionLabel}` (region from
    `s.report?.region ?? s.selectedRegion`, via `REGION_BY_ID`).
  - Headline rendered as the page's mobile **`<h1>`**, built from the existing i18n
    builders: `heroIdle` (idle), `t('heroRunning')` (running), `heroVerdict` of the
    selected game's `state` (done), `t('heroErrorLine')` (error). The game name span
    is teal-highlighted as in `heroVerdict`.
  - Retest button → `onRun`; label `t('runTest')` / `t('runAgain')` / `t('testing')`;
    `disabled` while running.
- **Stat strip:** Ping / Loss / BB. Values from real state
  (`ping`, `loss`, `s.report?.bufferbloat?.grade ?? s.bufferbloat?.grade`);
  render `—` when null/non-finite. (`showStatStrip` prototype prop is dropped; always shown.)
- **Progress:** a slim bar driven by `s.progress` (0..1), shown only while
  `status === 'running'`. While running the eyebrow shows `phaseLabel(lang, s.phase)`.
- **Tabs:** segmented control, `role="tablist"` with three `role="tab"`
  (`aria-selected`), switching `tab`.
- **Error:** when `s.status === 'error'`, an error banner appears under the header
  (`⚠ {s.error}`), mirroring desktop's banner styling.

### Overview tab (`role="tabpanel"`)

Reuses existing components (single source of truth, localized labels):

- Section eyebrow: `${t('coreMetrics')} · ${genreLabel(lang, game.genre)}`.
- **3× `ArcGauge`** (ping / jitter / loss) with the same `value`/`max`/`tone`/
  `stateLabel` props the desktop passes. **`ArcGauge` gains an optional
  `size?: number` prop (default `128`)**; desktop passes nothing → identical; mobile
  passes ~`88`. The gauge's numeric text lives in the `0 0 120 120` viewBox, so it
  scales with the SVG automatically. Implementation: when `size` is set, apply
  `style={{ width: size, height: size }}` instead of the `w-32 h-32` classes.
- **`<Meters/>`** reused as-is (download/upload bars + bufferbloat tile).
- **`<Sparkline/>`** reused, gaining an optional **`height?: number`** prop
  (default `170`); mobile passes ~`110`. Implementation swaps the `h-[170px]` class
  for an inline height when provided.
- **Honesty note** at the bottom: `noteTitle[lang]` + `noteBody(lang, s.backendLabel || 'Cloudflare', s.mode)`.
  Preserves the core "how it was measured" value.

### Games tab

- Section eyebrow `t('canYouPlay')`.
- Filter chips All (`t('filterAll')`) / Playable (`t('filterPlayable')`),
  `aria-pressed`. **Playable** predicate: `v.state !== 'NO'` (keeps `PLAYABLE` +
  `RISKY`, drops `NO`). Pre-run (no verdicts) the filter is a no-op (all games show).
- Rows from `s.report?.verdicts` (post-run) or `GAMES` (pre-run). Each row
  (`MobileGameRow`): game name + `genreLabel` + verdict pill (`verdictWord`) + big
  grade letter (color via the same grade→color mapping as `GameCard`). Tap →
  `onPickGame(g.id)` **and** toggle `expandedId`; selected game highlighted
  (`data-selected`). Expanded row shows `t('limitedBy')` + `reasonWord(lang, reason, mode)`
  (or `t('allInRange')`), reusing the desktop reason logic.
- Tap hint line: `t('tapForDetail')`.

### Regions tab

- Section eyebrow `t('regionMap')`.
- 2-column grid filtered to `gameRegions(s.selectedGameId)` (same filter as
  `RegionSelector`). Each chip: `REGION_BY_ID[id].label`, `info.metro`,
  median ms (`fmt(median, 0)` / `—`), color by the same `msColor` bands
  (≤60 teal / ≤130 warn / else bad), and a fill bar (`median / maxMedian`). Tap →
  `onPickRegion(region)`; selected chip highlighted (`aria-pressed`).
- Hosted region note below the grid when `s.mode === 'hosted'`
  (`hostedRegionNote` / `hostedRegionUnreachable`), mirroring desktop.

### Footer (always visible, below tab content)

The per-game guide `<Link>`s (same set/targets as the desktop footer:
`variantPath(g.id, 'ping-test', lang)`), so mobile-first crawling still sees the
internal links.

## i18n additions

Add to `S` in `i18n.tsx` (both `en` + `es`, per the `satisfies Record<…, Entry>`
invariant — every key needs both):

| Key | en | es |
| --- | --- | --- |
| `tabOverview` | `Overview` | `Resumen` |
| `tabGames` | `Games` | `Juegos` |
| `tabRegions` | `Regions` | `Regiones` |
| `filterAll` | `All` | `Todos` |
| `filterPlayable` | `Playable` | `Jugables` |
| `tapForDetail` | `Tap a game for detail` | `Toca un juego para ver el detalle` |

Everything else reuses existing keys/builders (`verdict`, `coreMetrics`,
`canYouPlay`, `regionMap`, `download`, `upload`, `bufferbloat`, `runTest`,
`runAgain`, `testing`, `hostedBadge`, `hostedRegionNote`, `hostedRegionUnreachable`,
`heroIdle`, `heroRunning`, `heroVerdict`, `heroErrorLine`, `verdictWord`,
`reasonWord`, `genreLabel`, `gaugeStateWord`, `phaseLabel`, `noteTitle`, `noteBody`).
No hardcoded user-facing strings.

## SEO / SSG

- `<Seo/>` + JSON-LD render once in `<head>`, unchanged.
- The **mobile** subtree carries a real `<h1>`, descriptive copy (idle headline +
  sub), the honesty note, and the per-game internal links — so Google's
  mobile-first render sees full content and link equity. Two `<h1>`s exist in the
  DOM (the desktop one is `display:none`); one is visible per viewport — a standard
  responsive show/hide pattern, acceptable for SEO.
- The SSG prerender (`vite-react-ssg`, idle `getServerSnapshot`) emits both subtrees;
  hydration matches because the breakpoint split is pure CSS (no viewport JS at render).

## Accessibility

- Tabs: `role="tablist"` / `role="tab"` (`aria-selected`, `aria-controls`) /
  `role="tabpanel"`.
- All interactive elements are `<button type="button">`; toggles use `aria-pressed`.
- `ArcGauge` keeps its `role="img"` + `aria-label`.
- Lang group keeps `role="group"` + `aria-label`.
- `prefers-reduced-motion` is already handled globally in `index.css`; the mobile
  transitions (gauge sweep, bar fill, progress) inherit that reduction.

## Testing & verification

- `pnpm --filter client typecheck` (strict, `noUnusedLocals`/`noUnusedParameters`)
  and `pnpm --filter client build` both green.
- `pnpm --filter client test` (vitest engine tests) still pass — no engine changes.
- Playwright (webapp-testing):
  - **Desktop ≥768px (e.g. 1280px): visually identical** to pre-change — capture a
    before/after screenshot of `/` and confirm no diff.
  - **Mobile ~375px:** header (verdict, stat strip, tabs), each of the three tabs,
    EN↔ES toggle, and the idle / running / done states render per the prototype and
    are wired to live data (run the test, switch game on Games tab → Overview
    re-grades, pick a region on Regions tab).
- Confirm the prerendered HTML for `/` contains the mobile `<h1>` and the per-game
  links.

## Delivery

- Branch: `feat/mobile-dashboard` (off `main`, which already carries the Tailwind
  migration + merged SEO work).
- Spec + plan committed under `docs/superpowers/`, then implementation commits.
- PR titled `feat(mobile): tabbed mobile dashboard layout`.

## File-change summary

| File | Change |
| --- | --- |
| `client/src/App.tsx` | Hoist `<Seo/>`; add `hidden md:block` to `np-app` root; add `<MobileDashboard/>` sibling; add shared `onSelectLang`. Desktop markup otherwise untouched. |
| `client/src/components/mobile/MobileDashboard.tsx` | **New.** Orchestrator + sticky header + Overview tab + footer; exports `DashboardProps`. |
| `client/src/components/mobile/MobileGames.tsx` | **New.** Games tab (filter chips + game rows). |
| `client/src/components/mobile/MobileRegions.tsx` | **New.** Regions tab (region chip grid). |
| `client/src/components/ArcGauge.tsx` | Add optional `size?: number` (default 128). Desktop output unchanged. |
| `client/src/components/Sparkline.tsx` | Add optional `height?: number` (default 170). Desktop output unchanged. |
| `client/src/i18n.tsx` | Add 6 string keys (en+es). |
