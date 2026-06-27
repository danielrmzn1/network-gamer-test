# Mobile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a purpose-built tabbed mobile layout (≤768px) for the FRAGRATE tester — sticky header (verdict + stat strip) and Overview/Games/Regions tabs — wired to the live engine, while the desktop layout (≥768px) stays byte-identical.

**Architecture:** `App.tsx` remains the single wiring component (hooks, effects, derivations, handlers, `<Seo/>`). It renders the existing desktop layout wrapped in `hidden md:block` and a new `<MobileDashboard/>` (root `md:hidden`) that receives the same derived data via a `DashboardProps` bundle. Mobile is built from new files under `client/src/components/mobile/`, reusing `ArcGauge`/`Meters`/`Sparkline` and the existing i18n helpers. No engine/`@shared` changes.

**Tech Stack:** React 18, TypeScript (strict), Tailwind v4 (CSS-first, tokens in `index.css`), `vite-react-ssg`, vitest (engine only), Playwright (webapp-testing skill) for verification.

## Global Constraints

- **Scope:** `client/` only. No `server/` / `worker/` / `shared/` changes. No new runtime dependencies.
- **Desktop unchanged:** the ≥768px rendered output must be pixel-identical to pre-change. The only `App.tsx` edits are: hoist `<Seo/>`, add `hidden md:block` to the `np-app` root, add the `<MobileDashboard/>` sibling, and factor an `onSelectLang` helper (behavior-identical).
- **Breakpoint:** Tailwind `md` (768px). Desktop wrapper `hidden md:block`; mobile root `md:hidden`.
- **No mock data:** the prototype's `netpulse-data.js` / `ios-frame.jsx` / `<x-dc>` are reference only. All values come from the live `EngineState`.
- **i18n:** every user-facing string via `t()`/builders; new keys added to `S` need **both** `en` and `es` (`S` is `satisfies Record<string, Entry>`).
- **State:** read-only here; never mutate `EngineState`. Use the handlers passed from `App`.
- **Null metrics** render as `—` (use `fmt` from `lib/format`); guard with `Number.isFinite`.
- **Per-task gate:** `pnpm --filter client typecheck` (strict, `noUnusedLocals`/`noUnusedParameters`) **and** `pnpm --filter client build` both pass. Unused imports/vars fail the build — keep code clean.
- **Visual source of truth:** the `Dashboard Mobile.dc.html` prototype. Design tokens (`--color-teal`, `--color-gold`, `--color-bad`, etc.) and clip-path vars (`--cut-6/8/10/12/14`, `--hex`) already exist in `client/src/styles/index.css`; use Tailwind utilities + arbitrary values referencing those vars (same style as existing components), not raw hardcoded hex.

> Subagents may re-fetch the prototype for exact pixel values via the DesignSync tool: `method: "get_file", projectId: "2f96a165-b679-492f-884e-544f3477560b", path: "Dashboard Mobile.dc.html"`.

---

## Task 1: i18n keys for mobile UI

**Files:**
- Modify: `client/src/i18n.tsx` (the `S` object, ends ~line 100)

**Interfaces:**
- Produces: new `StrKey`s `tabOverview`, `tabGames`, `tabRegions`, `filterAll`, `filterPlayable`, `tapForDetail` — usable via `t(lang, key)`.

- [ ] **Step 1: Add the six keys** to the `S` object (place after `gradedOn`, before the closing `} satisfies Record<string, Entry>`):

```ts
  tabOverview: { en: 'Overview', es: 'Resumen' },
  tabGames: { en: 'Games', es: 'Juegos' },
  tabRegions: { en: 'Regions', es: 'Regiones' },
  filterAll: { en: 'All', es: 'Todos' },
  filterPlayable: { en: 'Playable', es: 'Jugables' },
  tapForDetail: { en: 'Tap a game for detail', es: 'Toca un juego para ver el detalle' },
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter client typecheck`
Expected: PASS (no unused — these are referenced in later tasks, but adding to `S` alone is valid).

- [ ] **Step 3: Commit**

```bash
git add client/src/i18n.tsx
git commit -m "feat(mobile): add i18n keys for mobile tabs/filters"
```

---

## Task 2: Make `ArcGauge` size-aware and `Sparkline` height-aware

These are additive optional props; **desktop callers pass nothing → identical output**.

**Files:**
- Modify: `client/src/components/ArcGauge.tsx`
- Modify: `client/src/components/Sparkline.tsx`

**Interfaces:**
- Produces: `ArcGauge` accepts optional `size?: number` (default 128). `Sparkline` accepts optional `height?: number` (default 170).

- [ ] **Step 1: ArcGauge — add `size` prop.** Add `size?: number` to `Props`. Change the `<svg>` from the fixed `w-32 h-32` class to a size-driven style; the numeric/unit text lives in the `0 0 120 120` viewBox so it scales automatically.

In `Props`:
```ts
  stateLabel?: string
  size?: number
```
Signature + svg:
```tsx
export function ArcGauge({ value, max, unit, name, tone, decimals = 0, stateLabel, size = 128 }: Props) {
  // ...unchanged frac/offset/display...
  return (
    <div className="flex flex-col items-center gap-3" style={{ '--g-color': TONE[tone] } as CSSProperties}>
      <svg
        className="overflow-visible"
        style={{ width: size, height: size }}
        viewBox="0 0 120 120"
        role="img"
        aria-label={`${name}: ${display} ${unit}`}
      >
```
(Leave the rest of the SVG body unchanged.)

- [ ] **Step 2: Sparkline — add `height` prop.** Add to the signature and apply to the canvas.

```tsx
export function Sparkline({ data, height = 170 }: { data: number[]; height?: number }) {
```
Change the canvas element from `className="w-full h-[170px] block"` to:
```tsx
      <canvas ref={ref} className="w-full block" style={{ height }} />
```

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter client typecheck && pnpm --filter client build`
Expected: PASS. (Desktop usage unchanged — App passes no `size`/`height`.)

- [ ] **Step 4: Commit**

```bash
git add client/src/components/ArcGauge.tsx client/src/components/Sparkline.tsx
git commit -m "feat(mobile): optional size/height props on ArcGauge and Sparkline"
```

---

## Task 3: Export grade/region color helpers for reuse

The mobile rows reuse the desktop color mappings. Export them (additive — no output change).

**Files:**
- Modify: `client/src/components/GameCard.tsx`
- Modify: `client/src/components/RegionSelector.tsx`

**Interfaces:**
- Produces: `gradeColor(rank?: string): string` exported from `GameCard.tsx`; `msColor(median: number | null): string` exported from `RegionSelector.tsx`.

- [ ] **Step 1:** In `GameCard.tsx`, change `function gradeColor(` → `export function gradeColor(`.
- [ ] **Step 2:** In `RegionSelector.tsx`, change `function msColor(` → `export function msColor(`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter client typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/GameCard.tsx client/src/components/RegionSelector.tsx
git commit -m "refactor(client): export gradeColor/msColor for mobile reuse"
```

---

## Task 4: `MobileDashboard` shell + `DashboardProps` + wire into `App`

Deliverable: at ≤768px the mobile **chrome** renders (sticky header: brand/lang/hosted badge, verdict row, stat strip, progress bar, error banner, segmented tabs) and the three tab panels (empty stubs that switch); desktop ≥768px is unchanged. Tabs are implemented as three separate files so Tasks 5–7 can fill them in independently.

**Files:**
- Create: `client/src/components/mobile/MobileDashboard.tsx`
- Create: `client/src/components/mobile/MobileOverview.tsx` (stub)
- Create: `client/src/components/mobile/MobileGames.tsx` (stub)
- Create: `client/src/components/mobile/MobileRegions.tsx` (stub)
- Modify: `client/src/App.tsx`

**Interfaces:**
- Produces: `DashboardProps` (exported from `MobileDashboard.tsx`), `MobileDashboard` default-or-named export. Tab stubs export `MobileOverview`, `MobileGames`, `MobileRegions` with the prop shapes consumed in Tasks 5–7.
- Consumes: `ArcGauge`/`Meters`/`Sparkline` (Task 2), color helpers (Task 3), i18n keys (Task 1).

- [ ] **Step 1: Create the tab stubs** so `MobileDashboard` compiles. Each renders a placeholder; full content lands in Tasks 5–7.

`client/src/components/mobile/MobileOverview.tsx`:
```tsx
import type { EngineState } from '../../state/store'
import type { Game } from '@shared/catalog.types'
import type { Lang } from '../../i18n'
import type { Tone } from '../../lib/tone'
import { GENRE_BANDS } from '@shared/thresholds'

export interface MobileOverviewProps {
  s: EngineState
  lang: Lang
  game: Game
  bands: (typeof GENRE_BANDS)[Game['genre']]
  ping: number | null
  jitter: number | null
  loss: number | null
  pingTone: Tone
  jitterTone: Tone
  lossTone: Tone
}

export function MobileOverview(_props: MobileOverviewProps) {
  return <div data-tab="overview" />
}
```

`client/src/components/mobile/MobileGames.tsx`:
```tsx
import type { EngineState } from '../../state/store'
import type { Game } from '@shared/catalog.types'
import type { Lang } from '../../i18n'

export interface MobileGamesProps {
  s: EngineState
  lang: Lang
  game: Game
  filter: 'all' | 'playable'
  setFilter: (f: 'all' | 'playable') => void
  expandedId: string | null
  setExpandedId: (fn: (prev: string | null) => string | null) => void
  onPickGame: (id: string) => void
}

export function MobileGames(_props: MobileGamesProps) {
  return <div data-tab="games" />
}
```

`client/src/components/mobile/MobileRegions.tsx`:
```tsx
import type { EngineState } from '../../state/store'
import type { Region } from '@shared/catalog.types'
import type { Lang } from '../../i18n'

export interface MobileRegionsProps {
  s: EngineState
  lang: Lang
  onPickRegion: (r: Region) => void
}

export function MobileRegions(_props: MobileRegionsProps) {
  return <div data-tab="regions" />
}
```

> Note: `_props` placeholder names dodge `noUnusedParameters` in the stubs; Tasks 5–7 replace these signatures with real destructured props.

- [ ] **Step 2: Create `MobileDashboard.tsx`** — the orchestrator + sticky header + footer. Full code:

```tsx
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { EngineState } from '../../state/store'
import type { Game, Region } from '@shared/catalog.types'
import { GAMES } from '@shared/catalog'
import { GENRE_BANDS } from '@shared/thresholds'
import { REGION_BY_ID } from '@shared/regions'
import type { Tone } from '../../lib/tone'
import { fmt } from '../../lib/format'
import {
  type Lang, t, heroIdle, heroVerdict, phaseLabel, noteTitle, noteBody,
} from '../../i18n'
import { variantPath } from '../../seo/gameContent'
import { MobileOverview } from './MobileOverview'
import { MobileGames } from './MobileGames'
import { MobileRegions } from './MobileRegions'

export interface DashboardProps {
  s: EngineState
  lang: Lang
  game: Game
  bands: (typeof GENRE_BANDS)[Game['genre']]
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

type Tab = 'overview' | 'games' | 'regions'

const TONE_COLOR: Record<Tone, string> = {
  good: 'var(--color-teal)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
  neutral: 'var(--color-ink-lo)',
}

// Bufferbloat grade → color (mirrors Meters' bloatColor; real grade, not hardcoded red).
function bloatColor(g: string | null): string {
  if (g === 'A+' || g === 'A') return 'var(--color-good)'
  if (g === 'B') return 'var(--color-teal)'
  if (g === 'C') return 'var(--color-warn)'
  if (g === 'D' || g === 'F') return 'var(--color-bad)'
  return 'var(--color-ink-faint)'
}

// Small compact hex grade crest for the header (mobile-sized analogue of RankBadge).
function HexGrade({ grade }: { grade: string }) {
  return (
    <div className="relative w-11 h-[50px] shrink-0" role="img" aria-label={`Network rank ${grade}`}>
      <div className="absolute -inset-1.5 [background:radial-gradient(circle,rgb(224_166_75/0.35),transparent_68%)]" aria-hidden />
      <div className="absolute inset-0 [clip-path:var(--hex)] [background:linear-gradient(160deg,var(--color-gold-light),var(--color-gold-deep)_50%,#6f5527)]" aria-hidden />
      <div className="absolute inset-0.5 [clip-path:var(--hex)] [background:radial-gradient(circle_at_50%_36%,#1a3650,#0a1521_75%)] grid place-items-center">
        <span className="font-display text-[25px] leading-none text-gold-bright [text-shadow:0_2px_10px_rgb(224_166_75/0.55)]">{grade}</span>
      </div>
    </div>
  )
}

const LANG_BTN_BASE = 'font-ui text-xs font-bold tracking-[0.12em] px-3 py-1.5 border-none [transition:all_0.15s_ease]'
const TAB_BASE = 'flex-1 text-center font-ui font-semibold text-[11.5px] tracking-[0.12em] uppercase py-2.5 px-1 border-none [clip-path:var(--cut-8)] [transition:all_0.15s_ease]'

export function MobileDashboard(props: DashboardProps) {
  const { s, lang, game, onRun, onSelectLang } = props
  const [tab, setTab] = useState<Tab>('overview')
  const [filter, setFilter] = useState<'all' | 'playable'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const running = s.status === 'running'
  const done = s.status === 'done'
  const v = s.report?.verdicts.find((x) => x.gameId === game.id)
  const rank = done ? v?.rank ?? s.report?.overallRank ?? null : null
  const grade = rank ?? '?'

  const regionId = s.report?.region ?? s.selectedRegion
  const regionLabel = regionId ? REGION_BY_ID[regionId]?.label ?? regionId : ''

  // Headline (an <h1> for mobile-first SEO), reusing the existing i18n builders.
  let head: { pre: string; hl: string; post: string }
  if (running) head = { pre: t(lang, 'heroRunning'), hl: '…', post: '' }
  else if (s.status === 'error') head = { pre: t(lang, 'heroErrorLine'), hl: '', post: '' }
  else if (done) { const hv = heroVerdict(lang, v?.state ?? 'NO'); head = { pre: hv.pre, hl: game.name, post: hv.post } }
  else head = heroIdle(lang)

  const eyebrow = running && s.phase
    ? phaseLabel(lang, s.phase)
    : `${t(lang, 'verdict')} · ${game.name}${regionLabel ? ` · ${regionLabel}` : ''}`

  const retestLabel = running ? t(lang, 'testing') : done ? t(lang, 'runAgain') : t(lang, 'runTest')
  const bbGrade = s.report?.bufferbloat?.grade ?? s.bufferbloat?.grade ?? null

  const langBtn = (on: boolean): string =>
    `${LANG_BTN_BASE} ${on ? 'bg-gradient-to-b from-gold-light to-gold text-abyss' : 'bg-transparent text-ink-faint'}`
  const tabBtn = (on: boolean): string =>
    `${TAB_BASE} ${on
      ? 'bg-gradient-to-b from-teal/20 to-teal/[0.06] shadow-[inset_0_0_0_1px_rgb(63_214_201/0.55),0_0_12px_rgb(63_214_201/0.18)] text-[#bff3ee]'
      : 'bg-white/[0.03] shadow-[inset_0_0_0_1px_var(--gold-line)] text-ink-faint'}`

  const tabs: { k: Tab; label: string }[] = [
    { k: 'overview', label: t(lang, 'tabOverview') },
    { k: 'games', label: t(lang, 'tabGames') },
    { k: 'regions', label: t(lang, 'tabRegions') },
  ]

  return (
    <div className="md:hidden relative min-h-screen text-ink-body font-ui [background:radial-gradient(120%_70%_at_50%_-8%,#11283c_0%,#0a141f_52%,#070e16_100%)]">
      {/* ===== STICKY HEADER ===== */}
      <div
        className="sticky top-0 z-10 px-3.5 pb-2.5 bg-[rgb(9_18_28/0.93)] backdrop-blur-[10px] shadow-[0_1px_0_rgb(201_168_92/0.2),0_8px_22px_rgb(0_0_0/0.4)]"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 10px)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 [background:linear-gradient(90deg,transparent,rgb(201_168_92/0.6)_30%,rgb(63_214_201/0.6)_70%,transparent)]" />

        {/* brand + lang */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="font-display text-[19px] tracking-[1px] text-ink-hi">
              FRAG<span className="text-teal [text-shadow:var(--text-glow-teal)]">RATE</span>
            </div>
            {s.mode === 'hosted' && (
              <span className="font-ui text-[9px] font-bold tracking-[0.18em] uppercase text-gold-light [clip-path:var(--cut-6)] shadow-[inset_0_0_0_1px_var(--gold-line-strong)] px-2 py-0.5">
                {t(lang, 'hostedBadge')}
              </span>
            )}
          </div>
          <div className="flex items-center [clip-path:var(--cut-8)] shadow-[inset_0_0_0_1px_var(--gold-line-strong)]" role="group" aria-label="Language">
            <button type="button" className={langBtn(lang === 'en')} aria-pressed={lang === 'en'} onClick={() => onSelectLang('en')}>EN</button>
            <button type="button" className={langBtn(lang === 'es')} aria-pressed={lang === 'es'} onClick={() => onSelectLang('es')}>ES</button>
          </div>
        </div>

        {/* verdict row */}
        <div className="flex items-center gap-2.5 mt-2.5">
          <HexGrade grade={grade} />
          <div className="flex-1 min-w-0">
            <div className="text-[9px] tracking-[0.12em] uppercase text-teal whitespace-nowrap overflow-hidden text-ellipsis">{eyebrow}</div>
            <h1 className="font-display text-sm leading-[1.2] text-ink-hi mt-0.5 line-clamp-2 m-0">
              {head.pre}<span className="text-teal">{head.hl}</span>{head.post}
            </h1>
          </div>
          <button
            type="button"
            className="shrink-0 font-ui font-bold text-[11px] tracking-[0.12em] uppercase text-abyss bg-gradient-to-b from-gold-light to-gold border-none px-3.5 py-2.5 [clip-path:var(--cut-8)] shadow-[0_4px_14px_rgb(201_168_92/0.32)] disabled:opacity-80 disabled:cursor-progress"
            onClick={onRun}
            disabled={running}
          >
            {retestLabel}
          </button>
        </div>

        {/* stat strip */}
        <div className="flex mt-2.5 [clip-path:var(--cut-8)] shadow-[inset_0_0_0_1px_rgb(201_168_92/0.16)] bg-[rgb(13_24_36/0.5)]">
          <Stat label={t(lang, 'gaugePing')} value={fmt(props.ping, 0)} unit="ms" color={TONE_COLOR[props.pingTone]} />
          <Stat label={t(lang, 'gaugeLoss')} value={fmt(props.loss, props.loss != null && props.loss < 1 ? 2 : 1)} unit="%" color={TONE_COLOR[props.lossTone]} divided />
          <Stat label="BB" value={bbGrade ?? '—'} color={bloatColor(bbGrade)} divided />
        </div>

        {/* progress (running only) */}
        {running && (
          <div className="mt-2 h-0.5 bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-teal shadow-[0_0_8px_var(--color-teal)] [transition:width_0.4s_ease]" style={{ width: `${Math.round((s.progress || 0) * 100)}%` }} />
          </div>
        )}

        {/* tabs */}
        <div className="flex gap-1.5 mt-2.5" role="tablist" aria-label={t(lang, 'tabOverview')}>
          {tabs.map((tb) => (
            <button key={tb.k} type="button" role="tab" aria-selected={tab === tb.k} className={tabBtn(tab === tb.k)} onClick={() => { setTab(tb.k); setExpandedId(() => null) }}>
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== ERROR ===== */}
      {s.status === 'error' && (
        <div className="mx-3.5 mt-3.5 px-3.5 py-3 [clip-path:var(--cut-8)] shadow-[inset_0_0_0_1px_rgb(224_69_92/0.5)] text-bad bg-[rgb(224_69_92/0.08)] text-sm">
          ⚠ {s.error}
        </div>
      )}

      {/* ===== TAB CONTENT ===== */}
      <div className="relative z-[1] px-3.5 pt-3.5" role="tabpanel">
        {tab === 'overview' && (
          <MobileOverview
            s={s} lang={lang} game={game} bands={props.bands}
            ping={props.ping} jitter={props.jitter} loss={props.loss}
            pingTone={props.pingTone} jitterTone={props.jitterTone} lossTone={props.lossTone}
          />
        )}
        {tab === 'games' && (
          <MobileGames
            s={s} lang={lang} game={game}
            filter={filter} setFilter={setFilter}
            expandedId={expandedId} setExpandedId={setExpandedId}
            onPickGame={props.onPickGame}
          />
        )}
        {tab === 'regions' && (
          <MobileRegions s={s} lang={lang} onPickRegion={props.onPickRegion} />
        )}

        {/* honesty note — preserved on mobile */}
        <p className="mt-7 pt-5 [border-top:1px_solid_var(--gold-line)] text-xs leading-[1.6] text-ink-lo [&_b]:text-gold [&_b]:font-semibold">
          <b>{noteTitle[lang]}</b> {noteBody(lang, s.backendLabel || 'Cloudflare', s.mode)}
        </p>

        {/* per-game guide links — crawlable internal links on mobile */}
        <footer className="mt-8 pt-5 [border-top:1px_solid_var(--gold-line)]">
          <span className="block mb-2.5 font-ui text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-lo">
            {lang === 'es' ? 'Guías por juego' : 'Per-game guides'}
          </span>
          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            {GAMES.map((g) => (
              <Link key={g.id} to={variantPath(g.id, 'ping-test', lang)} className="text-[13px] text-ink-body no-underline hover:text-teal">
                {g.name} {lang === 'es' ? 'ping' : 'ping test'}
              </Link>
            ))}
          </nav>
        </footer>

        <div className="h-12" />
      </div>
    </div>
  )
}

function Stat({ label, value, unit, color, divided }: { label: string; value: string; unit?: string; color: string; divided?: boolean }) {
  return (
    <div className={`flex-1 text-center py-[7px] px-1 ${divided ? '[border-left:1px_solid_rgb(201_168_92/0.14)]' : ''}`}>
      <div className="text-[8.5px] tracking-[0.12em] uppercase text-ink-lo">{label}</div>
      <div className="font-display text-[17px] mt-px" style={{ color } as CSSProperties}>
        {value}{unit && <span className="font-ui text-[9px] text-ink-lo"> {unit}</span>}
      </div>
    </div>
  )
}
```

> **Implementer note:** the eyebrow/headline wrapper uses `min-w-0` so the `text-ellipsis` truncation works inside the flex row.

- [ ] **Step 3: Wire into `App.tsx`.** Make exactly these edits:

(a) Add imports near the other component imports:
```tsx
import { MobileDashboard, type DashboardProps } from './components/mobile/MobileDashboard'
```
and add `type Lang` to the existing `./i18n` import.

(b) Add the shared lang handler (next to the other handlers, after `onPickRegion`):
```tsx
  const onSelectLang = (l: Lang): void => {
    rememberLang(l)
    navigate(l === 'es' ? '/es' : '/')
  }
```

(c) Update the two desktop EN/ES buttons to use it (behavior-identical):
```tsx
            onClick={() => onSelectLang('en')}
```
```tsx
            onClick={() => onSelectLang('es')}
```
(remove the now-inline `rememberLang(...)` + `navigate(...)` bodies).

(d) Build the props bundle just before `return (` :
```tsx
  const dashboardProps: DashboardProps = {
    s, lang, game, bands, ping, jitter, loss, pingTone, jitterTone, lossTone,
    onRun, onPickGame, onPickRegion, onSelectLang,
  }
```

(e) Restructure the `return`: hoist `<Seo/>` out, add `hidden md:block` to the `np-app` root, append `<MobileDashboard/>`. The desktop markup inside the wrapper is otherwise **unchanged**:
```tsx
  return (
    <>
      <Seo
        title={seo.title}
        description={seo.description}
        path={path}
        locale={lang}
        alternates={alternates}
        jsonLd={jsonLd}
      />
      <div className="np-app relative max-w-[1320px] mx-auto px-10 pt-[30px] pb-14 max-[760px]:px-4 max-[760px]:pt-[22px] max-[760px]:pb-12 hidden md:block">
        {/* …existing desktop header → footer, verbatim (minus the <Seo/> that moved up)… */}
      </div>
      <MobileDashboard {...dashboardProps} />
    </>
  )
```

- [ ] **Step 4: Typecheck + build**

Run: `pnpm --filter client typecheck && pnpm --filter client build`
Expected: PASS.

- [ ] **Step 5: Playwright smoke** (webapp-testing skill): start `pnpm --filter client dev`, load `http://localhost:5173/` at viewport 375×812 → mobile header (brand, EN/ES, verdict, stat strip, 3 tabs) visible; clicking tabs swaps the (empty) panel. At 1280×800 → desktop layout identical (capture screenshot for Task 8 comparison). EN/ES toggle navigates.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/mobile client/src/App.tsx
git commit -m "feat(mobile): MobileDashboard shell + breakpoint wiring; desktop unchanged"
```

---

## Task 5: Overview tab content

Deliverable: Overview tab shows 3 gauges + throughput/bufferbloat + sparkline, wired to live state, matching the prototype.

**Files:**
- Modify: `client/src/components/mobile/MobileOverview.tsx`

**Interfaces:**
- Consumes: `MobileOverviewProps` (Task 4), `ArcGauge` (size-aware, Task 2), `Meters`, `Sparkline` (height-aware, Task 2), `gaugeMax`/`toneLower` from `lib/tone`, `gaugeStateWord`/`genreLabel`/`t` from i18n.

- [ ] **Step 1: Replace the stub** with the full Overview. Card wrappers use the same notched-panel treatment as the prototype (clip `--cut-12`, inset gold border, `#0e1d2b→#0a1521` gradient):

```tsx
import type { Genre } from '@shared/catalog.types'
import { ArcGauge } from '../ArcGauge'
import { Meters } from '../Meters'
import { Sparkline } from '../Sparkline'
import { gaugeMax } from '../../lib/tone'
import { t, gaugeStateWord, genreLabel } from '../../i18n'
import type { MobileOverviewProps } from './MobileOverview.props' // see note

const PANEL = '[clip-path:var(--cut-12)] shadow-[inset_0_0_0_1px_rgb(201_168_92/0.2)] [background:linear-gradient(150deg,#0e1d2b,#0a1521)]'
const EYEBROW = 'flex items-center gap-2.5 mx-0.5 mb-2.5'

function SectionTitle({ children }: { children: string }) {
  return (
    <div className={EYEBROW}>
      <span className="w-1.5 h-1.5 bg-teal rotate-45 shadow-[0_0_7px_var(--color-teal)] shrink-0" />
      <span className="font-ui font-semibold tracking-[0.2em] text-[11px] text-gold uppercase whitespace-nowrap">{children}</span>
      <span className="flex-1 h-px [background:linear-gradient(90deg,var(--gold-line-strong),transparent)]" />
    </div>
  )
}

export function MobileOverview({ s, lang, game, bands, ping, jitter, loss, pingTone, jitterTone, lossTone }: MobileOverviewProps) {
  return (
    <div>
      <SectionTitle>{`${t(lang, 'coreMetrics')} · ${genreLabel(lang, game.genre as Genre)}`}</SectionTitle>

      <div className={`${PANEL} px-2.5 py-4 flex justify-around`}>
        <ArcGauge size={88} name={t(lang, 'gaugePing')}   value={ping}   max={gaugeMax(bands.pingMs)}   unit="ms" tone={pingTone}   stateLabel={gaugeStateWord(lang, pingTone)} />
        <ArcGauge size={88} name={t(lang, 'gaugeJitter')} value={jitter} max={gaugeMax(bands.jitterMs)} unit="ms" decimals={1} tone={jitterTone} stateLabel={gaugeStateWord(lang, jitterTone)} />
        <ArcGauge size={88} name={t(lang, 'gaugeLoss')}   value={loss}   max={gaugeMax(bands.lossPct)}  unit="%"  decimals={2} tone={lossTone}   stateLabel={gaugeStateWord(lang, lossTone)} />
      </div>

      <div className={`${PANEL} mt-3`}>
        <Meters download={s.download} upload={s.upload} liveDown={s.liveDownMbps} liveUp={s.liveUpMbps} bufferbloat={s.bufferbloat} />
      </div>

      <div className={`${PANEL} mt-3`}>
        <Sparkline data={s.liveLatency} height={110} />
      </div>
    </div>
  )
}
```

> **Implementer note (props import):** keep `MobileOverviewProps` defined in `MobileOverview.tsx` itself (as created in Task 4) — do **not** introduce a separate `MobileOverview.props` file. The import line above is illustrative; replace it by destructuring the locally-defined interface. Ensure the final file exports `MobileOverview` and the `MobileOverviewProps` interface, and has no unused imports.

- [ ] **Step 2: Verify gauge fit.** At 360px width the 3×88px gauges + padding must not overflow horizontally. If tight, reduce `size` to 84 and panel `px` to 2. (Confirm in Playwright at 360px.)

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter client typecheck && pnpm --filter client build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/mobile/MobileOverview.tsx
git commit -m "feat(mobile): Overview tab (gauges, throughput, sparkline)"
```

---

## Task 6: Games tab content

Deliverable: Games tab lists per-game verdicts with All/Playable filter; tapping a card selects the game (re-grades) and expands its reason.

**Files:**
- Modify: `client/src/components/mobile/MobileGames.tsx`

**Interfaces:**
- Consumes: `MobileGamesProps` (Task 4), `gradeColor` (Task 3), `GAMES` from `@shared/catalog`, `verdictWord`/`reasonWord`/`genreLabel`/`t` from i18n.
- Playable predicate: `v.state !== 'NO'`. Pre-run (no `s.report`) the filter is a no-op.

- [ ] **Step 1: Replace the stub** with the full Games tab:

```tsx
import type { CSSProperties } from 'react'
import type { Genre } from '@shared/catalog.types'
import type { VerdictState } from '@shared/grading'
import { GAMES } from '@shared/catalog'
import { gradeColor } from '../GameCard'
import { t, verdictWord, reasonWord, genreLabel } from '../../i18n'
import type { MobileGamesProps } from './MobileGames' // self-type; see note

interface Row {
  id: string
  name: string
  genre: string
  rank?: string
  state?: VerdictState
  reason?: string | null
}

const PANEL_SEL = '[clip-path:var(--cut-12)] [background:linear-gradient(150deg,rgb(63_214_201/0.1),#0c1a28)] shadow-[inset_0_0_0_1px_rgb(63_214_201/0.4),0_0_16px_rgb(63_214_201/0.12)]'
const PANEL_DEF = '[clip-path:var(--cut-12)] [background:linear-gradient(150deg,#0e1d2b,#0a1521)] shadow-[inset_0_0_0_1px_rgb(201_168_92/0.18)]'

export function MobileGames({ s, lang, filter, setFilter, expandedId, setExpandedId, onPickGame }: MobileGamesProps) {
  const mode = s.mode === 'unknown' ? undefined : s.mode
  let rows: Row[] = s.report
    ? s.report.verdicts.map((v) => ({ id: v.gameId, name: v.name, genre: v.genre, rank: v.rank, state: v.state, reason: v.reason }))
    : GAMES.map((g) => ({ id: g.id, name: g.name, genre: g.genre }))
  if (filter === 'playable') rows = rows.filter((r) => r.state == null || r.state !== 'NO')

  const filterBtn = (on: boolean): string =>
    `font-ui text-[11px] font-semibold tracking-[0.12em] uppercase px-3.5 py-1.5 border-none [clip-path:var(--cut-6)] ${
      on ? 'bg-gradient-to-b from-gold-light to-gold text-abyss font-bold'
         : 'bg-white/[0.04] shadow-[inset_0_0_0_1px_var(--gold-line-strong)] text-ink-body'}`

  return (
    <div>
      <div className="flex items-center gap-2.5 mx-0.5 mb-2.5">
        <span className="w-1.5 h-1.5 bg-teal rotate-45 shadow-[0_0_7px_var(--color-teal)] shrink-0" />
        <span className="font-ui font-semibold tracking-[0.2em] text-[11px] text-gold uppercase whitespace-nowrap">{t(lang, 'canYouPlay')}</span>
        <span className="flex-1 h-px [background:linear-gradient(90deg,var(--gold-line-strong),transparent)]" />
      </div>

      <div className="flex gap-2 mb-3">
        <button type="button" className={filterBtn(filter === 'all')} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t(lang, 'filterAll')}</button>
        <button type="button" className={filterBtn(filter === 'playable')} aria-pressed={filter === 'playable'} onClick={() => setFilter('playable')}>{t(lang, 'filterPlayable')}</button>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const sel = r.id === s.selectedGameId
          const color = gradeColor(r.rank)
          const expanded = expandedId === r.id
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={sel}
              onClick={() => { onPickGame(r.id); setExpandedId((prev) => (prev === r.id ? null : r.id)) }}
              className={`relative overflow-hidden w-full text-left border-none block py-3 pl-4 pr-3.5 ${sel ? PANEL_SEL : PANEL_DEF}`}
              style={{ '--c': color } as CSSProperties}
            >
              <span className="absolute top-0 left-0 bottom-0 w-[3px] bg-[var(--c)]" />
              <div className="flex items-center gap-2.5">
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[15px] leading-[1.15] text-ink-hi whitespace-nowrap overflow-hidden text-ellipsis">{r.name}</div>
                  <div className="text-[9.5px] tracking-[0.12em] uppercase text-ink-lo mt-0.5">{genreLabel(lang, r.genre as Genre)}</div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 [clip-path:var(--cut-6)] shadow-[inset_0_0_0_1px_rgb(224_166_75/0.35)] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--c)] shadow-[0_0_6px_var(--c)]" />
                  <span className="text-[9px] tracking-[0.12em] uppercase text-[#e0c490]">{r.state ? verdictWord(lang, r.state) : t(lang, 'pending')}</span>
                </span>
                <span className="font-display text-[28px] leading-[0.8] text-center w-6 shrink-0 [color:var(--c)] [text-shadow:0_0_12px_color-mix(in_srgb,var(--c)_30%,transparent)]">{r.rank ?? '—'}</span>
              </div>
              {expanded && (
                <div className="mt-2.5 pt-2.5 [border-top:1px_solid_rgb(201_168_92/0.16)] text-xs leading-[1.4] text-ink-body">
                  {r.state ? (r.reason ? `${t(lang, 'limitedBy')} ${reasonWord(lang, r.reason, mode)}` : t(lang, 'allInRange')) : t(lang, 'runToEvaluate')}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="text-center text-[10px] tracking-[0.08em] text-ink-lo mt-3">{t(lang, 'tapForDetail')}</div>
    </div>
  )
}
```

> **Implementer note:** `MobileGamesProps` is defined in this same file (from Task 4) — destructure it directly; remove the illustrative self-import line. No unused imports.

- [ ] **Step 2: Typecheck + build**

Run: `pnpm --filter client typecheck && pnpm --filter client build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/mobile/MobileGames.tsx
git commit -m "feat(mobile): Games tab (filter + select/expand rows)"
```

---

## Task 7: Regions tab content

Deliverable: Regions tab shows a 2-column grid of the selected game's allowed regions with median ms + fill bar; tapping picks the region.

**Files:**
- Modify: `client/src/components/mobile/MobileRegions.tsx`

**Interfaces:**
- Consumes: `MobileRegionsProps` (Task 4), `msColor` (Task 3), `REGIONS`/`REGION_BY_ID` from `@shared/regions`, `gameRegions` from `@shared/catalog`, `fmt` from `lib/format`, `t`/`useLang`-free (lang via prop).

- [ ] **Step 1: Replace the stub** with the full Regions tab:

```tsx
import type { CSSProperties } from 'react'
import { REGIONS, REGION_BY_ID } from '@shared/regions'
import { gameRegions } from '@shared/catalog'
import { msColor } from '../RegionSelector'
import { fmt } from '../../lib/format'
import { t } from '../../i18n'
import type { MobileRegionsProps } from './MobileRegions' // self-type; see note

const CHIP_SEL = '[clip-path:var(--cut-10)] [background:linear-gradient(150deg,rgb(201_168_92/0.12),#0c1a28)] shadow-[inset_0_0_0_1px_rgb(201_168_92/0.5),0_0_14px_rgb(201_168_92/0.16)]'
const CHIP_DEF = '[clip-path:var(--cut-10)] [background:linear-gradient(150deg,#0e1d2b,#0a1521)] shadow-[inset_0_0_0_1px_rgb(201_168_92/0.16)]'

export function MobileRegions({ s, lang, onPickRegion }: MobileRegionsProps) {
  const allow = new Set(gameRegions(s.selectedGameId))
  const list = REGIONS.filter((info) => allow.size === 0 || allow.has(info.region))
    .map((info) => {
      const stats = s.regions[info.region]
      const reachable = stats && stats.received > 0
      const median = reachable ? stats!.median : null
      return { info, median, reachable }
    })
    .sort((a, b) => (a.median ?? Infinity) - (b.median ?? Infinity))

  const maxMedian = Math.max(1, ...list.map((r) => r.median ?? 0))

  return (
    <div>
      <div className="flex items-center gap-2.5 mx-0.5 mb-2.5">
        <span className="w-1.5 h-1.5 bg-teal rotate-45 shadow-[0_0_7px_var(--color-teal)] shrink-0" />
        <span className="font-ui font-semibold tracking-[0.2em] text-[11px] text-gold uppercase whitespace-nowrap">{t(lang, 'regionMap')}</span>
        <span className="flex-1 h-px [background:linear-gradient(90deg,var(--gold-line-strong),transparent)]" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {list.map(({ info, median, reachable }) => {
          const sel = s.selectedRegion === info.region
          const color = msColor(median)
          const pct = reachable && median != null ? Math.round((median / maxMedian) * 100) : 0
          return (
            <button
              key={info.region}
              type="button"
              aria-pressed={sel}
              onClick={() => onPickRegion(info.region)}
              className={`relative overflow-hidden text-left border-none w-full py-2.5 px-3 ${sel ? CHIP_SEL : CHIP_DEF}`}
              style={{ '--rc': color } as CSSProperties}
            >
              <div className="text-[11px] tracking-[0.12em] uppercase text-ink-mid whitespace-nowrap overflow-hidden text-ellipsis">{REGION_BY_ID[info.region].label}</div>
              <div className="text-[10px] text-ink-lo mt-px whitespace-nowrap overflow-hidden text-ellipsis">{info.metro}</div>
              <div className="mt-1.5">
                <span className="font-display text-[23px] [color:var(--rc)]">{reachable ? fmt(median, 0) : '—'}</span>
                <span className="font-ui text-[10px] text-ink-lo"> ms</span>
              </div>
              <div className="h-1 mt-1.5 bg-white/[0.06] rounded-sm overflow-hidden">
                <div className="h-full bg-[var(--rc)] shadow-[0_0_6px_var(--rc)] [transition:width_0.9s_cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${pct}%` }} />
              </div>
            </button>
          )
        })}
      </div>

      {s.mode === 'hosted' && (
        <p className="mt-2.5 text-xs leading-normal text-ink-faint">
          {Object.values(s.regions).some((r) => r.received > 0) ? t(lang, 'hostedRegionNote') : t(lang, 'hostedRegionUnreachable')}
        </p>
      )}
    </div>
  )
}
```

> **Implementer note:** `MobileRegionsProps` is defined in this file (Task 4) — destructure directly; remove the illustrative self-import. The non-null assertion `stats!.median` is guarded by `reachable`; keep TS happy without `any`.

- [ ] **Step 2: Typecheck + build**

Run: `pnpm --filter client typecheck && pnpm --filter client build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/mobile/MobileRegions.tsx
git commit -m "feat(mobile): Regions tab (allowed-region grid)"
```

---

## Task 8: Full verification (desktop-identical + mobile flows)

**Files:** none (verification only).

- [ ] **Step 1: Gates**

Run: `pnpm --filter client typecheck && pnpm --filter client build && pnpm --filter client test`
Expected: all PASS (engine vitest unaffected).

- [ ] **Step 2: Desktop identical.** With the webapp-testing skill, screenshot `/` and `/es` at 1280×800 **on this branch** and compare against the same on `main` (or the Task 4 Step 5 baseline). Confirm no visual diff in the desktop layout.

- [ ] **Step 3: Mobile behavior** at 375×812 (and a 360px check), EN and ES:
  - Header: brand, EN/ES toggle (navigates + persists), verdict hex + eyebrow + `<h1>` headline, stat strip (`—` before a run), tabs.
  - Run the test (Retest) → button shows `testing`, progress bar fills, gauges/bars animate, stat strip + verdict populate, headline updates to the verdict.
  - Games tab: All/Playable filter; tap a game → it highlights, Overview re-grades to that game's genre, row expands with the reason.
  - Regions tab: grid of allowed regions sorted best-first; tap a region → selection updates and gauges re-grade.
  - Confirm `prefers-reduced-motion` disables the sweep/fill (emulate in devtools).

- [ ] **Step 4: SSG/SEO check.** `pnpm --filter client build` then inspect `client/dist/index.html`: it contains the mobile `<h1>` text and the per-game `<a href>` links. (`grep -o '<h1[^>]*>' client/dist/index.html` shows ≥1; the per-game links resolve to `*-ping-test` paths.)

- [ ] **Step 5: Final commit (if any verification fixups were needed) and push.**

```bash
git push -u origin feat/mobile-dashboard
```

- [ ] **Step 6: Open PR** titled `feat(mobile): tabbed mobile dashboard layout`, body summarizing: new ≤768px tabbed layout wired to the live engine; desktop ≥768px unchanged (screenshot diff clean); reused ArcGauge/Meters/Sparkline; i18n EN/ES; SEO H1 + internal links preserved.

---

## Self-Review (completed)

- **Spec coverage:** coexistence/breakpoint → Task 4; `DashboardProps` → Task 4; sticky header (verdict, stat strip, progress, tabs, hosted badge, error) → Task 4; Overview (gauges/Meters/Sparkline/note) → Tasks 4–5; Games (filter/select/expand) → Task 6; Regions (allowed grid + hosted note) → Task 7; ArcGauge `size` / Sparkline `height` → Task 2; color-helper reuse → Task 3; i18n keys → Task 1; SEO H1/links/note → Task 4; a11y roles → Task 4; verification incl. desktop-identical → Task 8. All spec sections mapped.
- **Placeholders:** none — full code per file; the "illustrative self-import" lines (`MobileOverview`/`MobileGames`/`MobileRegions` props) are flagged with explicit implementer notes to remove them, since each props interface is defined in its own file from Task 4.
- **Type consistency:** `DashboardProps`/`MobileOverviewProps`/`MobileGamesProps`/`MobileRegionsProps` field names and the handler signatures (`onPickGame(id: string)`, `onPickRegion(r: Region)`, `setExpandedId((prev)=>…)`) are consistent across Tasks 4–7. `gradeColor`/`msColor` exported in Task 3 and imported in Tasks 6–7.
