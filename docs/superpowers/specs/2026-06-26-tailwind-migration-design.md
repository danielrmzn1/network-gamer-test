# Design Spec: Migrate `client/` styling to Tailwind v4

**Date:** 2026-06-26
**Status:** Approved (brainstorming) — pending spec review
**Scope:** `client/` only. No server / worker / shared changes.

## Goal

Replace the hand-written CSS design system (`client/src/styles/global.css` +
`client/src/styles/components.css`, ~900 lines) with Tailwind v4, while keeping
the rendered UI **pixel-identical**. This is a tooling migration, not a redesign.

## Non-goals

- No visual redesign. No spacing/color "improvements."
- No component-logic changes, no refactors unrelated to styling.
- No changes to `server/`, `worker/`, `shared/`, `index.html` content (other than
  nothing — the Google Fonts `<link>` and `color-scheme` meta stay as-is).
- No new runtime dependencies. Only Tailwind dev tooling is added.

## Approach (decided during brainstorming)

- **Tailwind v4**, CSS-first. Design tokens live in an `@theme` block; the build is
  wired with the official `@tailwindcss/vite` plugin (no PostCSS config, no JS
  `tailwind.config`).
- **Token-first + small kept utility set.** Tokens become utilities; component
  markup is converted to utility classes in JSX. A deliberate ~10% of styles that
  fight utilities (notch clip-paths, ambient background, gradient frames, the
  diamond section divider, `color-mix()` glows) stay as conventional CSS in the
  entry stylesheet.
- **Browser baseline:** Tailwind v4 requires Safari 16.4+ / Chrome 111+ / Firefox
  128+. The existing CSS already uses `color-mix()`, which requires the same
  baseline, so this is not a regression.

## 1. Tooling changes

1. Add dev deps to `client/package.json`: `tailwindcss@^4` and `@tailwindcss/vite@^4`
   (installed with pnpm). Note: `vitest` + a `test` script already exist in
   `client/package.json` — leave them untouched.
2. `client/vite.config.ts`: import and add the `@tailwindcss/vite` plugin to the
   `plugins` array (alongside `react()`).
3. Create **one** entry stylesheet `client/src/styles/index.css` containing, in order:
   - `@import "tailwindcss";`
   - `@theme { ... }` token block (Section 2)
   - a `:root` block for raw (non-utility) vars: clip-path polygons, line/border
     rgba tokens, the gold up-bar gradient stops, and the text-shadow glow
   - `@layer base { ... }` for global resets, `body` ambient background, links,
     selection, focus, reduced-motion
   - the kept decorative CSS — `@utility` for single-class reusable bits, plain
     rules / `@layer components` for compound or pseudo-element pieces (Section 3)
   - `@keyframes np-pulse` and `@keyframes np-infotip-in`
4. `client/src/main.tsx`: change `import './styles/global.css'` →
   `import './styles/index.css'`.
5. `client/src/App.tsx`: remove `import './styles/components.css'`.
6. **Delete** `client/src/styles/global.css` and `client/src/styles/components.css`.

## 2. Token map (`:root` → `@theme`)

All tokens are preserved by value. Two renames are required to avoid collisions
with Tailwind's default `--text-*` (font-size) namespace, where a color named
`base` would make `text-base` ambiguous.

### Colors (`--color-*` → `text-*` / `bg-*` / `stroke-*` / `fill-*` / `border-*`)

| Old var          | New `@theme` token   | Utility example   | Value     |
| ---------------- | -------------------- | ----------------- | --------- |
| `--bg-void`      | `--color-void`       | `bg-void`         | `#070e16` |
| `--bg-deep`      | `--color-deep`       | `bg-deep`         | `#0a141f` |
| `--bg-base`      | `--color-abyss` ⚑    | `bg-abyss`        | `#0a1521` |
| `--bg-panel`     | `--color-panel`      | `bg-panel`        | `#0f2030` |
| `--bg-panel-2`   | `--color-panel-2`    | `bg-panel-2`      | `#102234` |
| `--bg-inset`     | `--color-inset`      | `bg-inset`        | `#0e1d2b` |
| `--teal`         | `--color-teal`       | `text-teal`       | `#3fd6c9` |
| `--teal-dim`     | `--color-teal-dim`   | `bg-teal-dim`     | `#1f8f9e` |
| `--teal-deep`    | `--color-teal-deep`  | `bg-teal-deep`    | `#12273a` |
| `--gold`         | `--color-gold`       | `text-gold`       | `#c9a85c` |
| `--gold-light`   | `--color-gold-light` | `text-gold-light` | `#f0d28f` |
| `--gold-bright`  | `--color-gold-bright`| `text-gold-bright`| `#f1d79a` |
| `--gold-deep`    | `--color-gold-deep`  | `bg-gold-deep`    | `#b78b3e` |
| `--good`         | `--color-good`       | `text-good`       | `#5fd39a` |
| `--warn`         | `--color-warn`       | `text-warn`       | `#e0a64b` |
| `--bad`          | `--color-bad`        | `text-bad`        | `#e0455c` |
| `--text-hi`      | `--color-ink-hi` ⚑   | `text-ink-hi`     | `#ece4d2` |
| `--text-mid`     | `--color-ink-mid` ⚑  | `text-ink-mid`    | `#cdd8e2` |
| `--text-body`    | `--color-ink-body` ⚑ | `text-ink-body`   | `#9db1c2` |
| `--text-base`    | `--color-ink-base` ⚑ | `text-ink-base`   | `#93a7b8` |
| `--text-lo`      | `--color-ink-lo` ⚑   | `text-ink-lo`     | `#5e7184` |
| `--text-faint`   | `--color-ink-faint` ⚑| `text-ink-faint`  | `#7c8fa0` |

⚑ = renamed (the `--bg-*`→surface and `--text-*`→`ink-*` namespaces). The original
prefix carried the role (`bg`/`text`); Tailwind's color namespace is flat, so the
role moves into the name. `--text-*` → `ink-*` avoids the font-size collision; the
sole surface collision (`--bg-base`) is renamed `abyss`.

### Fonts (`--font-*` → `font-*`)

| Old            | New `@theme`     | Utility        |
| -------------- | ---------------- | -------------- |
| `--font-display` | `--font-display` | `font-display` |
| `--font-ui`      | `--font-ui`      | `font-ui`      |

### Shadows / animations

| Old            | New `@theme`              | Utility            |
| -------------- | ------------------------- | ------------------ |
| `--glow-gold`  | `--shadow-glow-gold`      | `shadow-glow-gold` |
| `--glow-teal`  | `--shadow-glow-teal`      | `shadow-glow-teal` |
| `np-pulse`     | `--animate-pulse-hud`     | `animate-pulse-hud`|
| `np-infotip-in`| `--animate-infotip-in`    | `animate-infotip-in`|

### Raw vars (kept in `:root`, NOT utilities — referenced by kept CSS & arbitrary values)

- Clip-paths: `--cut-6`, `--cut-8`, `--cut-10`, `--cut-12`, `--cut-14`, `--cut-16`,
  `--cut-20`, `--hex` (unchanged).
- Lines: `--gold-line`, `--gold-line-strong`, `--teal-line` (unchanged).
- Up-bar gradient stops: `--up-gold-a`, `--up-gold-b` (unchanged).
- Text-shadow glow: `--text-glow-teal` (unchanged; applied via
  `[text-shadow:var(--text-glow-teal)]` arbitrary value to stay version-robust).

## 3. Kept as CSS (the deliberate ~10%)

These remain in `index.css` rather than becoming inline utilities, because forcing
them inline would destroy readability and/or they rely on compound selectors,
pseudo-elements, or `color-mix()`.

**`@layer base` (global, applies without a class):**
- `* { box-sizing }`; `html, body, #root` sizing; `button { font-family: inherit; cursor }`.
- `body` background + font + smoothing, and the ambient `body::before` (radial wash)
  and `body::after` (diamond grid) decorative layers.
- `a`, `::selection`, `:focus-visible`, and the `@media (prefers-reduced-motion)` block.

**Kept decorative classes** (single-class → `@utility`; compound/pseudo → plain rules):
- `np-frame` / `np-frame-in` (+ `.np-frame.hero` variants) — the gold→teal gradient
  notched panel. The `Frame` component keeps emitting these classes.
- `np-cut` — notched single-inset-border panel.
- `np-section-title` — flex row with `::before` diamond bullet and `::after` fading
  gold line. (`.np-eyebrow` text styling moves inline to utilities.)
- `.np-app::before` — the fixed top gold→teal glow bar (kept as a small rule on a
  retained `np-app` hook class; `.np-app` box layout itself moves to utilities).

**`color-mix()` glows** — applied via arbitrary-value utilities or tiny kept rules:
- bufferbloat grade box (`box-shadow` inset ring + outer glow driven by `--g`),
- game-card rank `text-shadow` (driven by `--c`).

Clip-paths on otherwise utility-driven elements use `[clip-path:var(--cut-N)]`
arbitrary values.

## 4. Components converted to utilities in JSX

Each component's `np-*` classes are replaced with Tailwind utilities (referencing
the §2 tokens). Inventory:

- `App.tsx` — app shell (`np-app` box → utilities, glow `::before` kept), header,
  brand + `RATE` teal glow, language toggle group + buttons (`aria-pressed`
  variants), game-picker label + chip row + chips, error banner, section titles
  (kept class), cluster grid, run-local panel + `<code>`, footer note.
- `Hero.tsx` — hero flex layout, eyebrow, verdict line + `.hl` highlight, sub,
  actions, CTA (`data-running` running state → `animate-pulse-hud`), meta row.
- `RankBadge.tsx` — hex crest: glow / plate / inner / ring layers (clip-path `--hex`
  + gradients) and the Marcellus letter; `is-empty` dimmed state.
- `PhaseStepper.tsx` — stepper row, step chips with `done` / `active` states.
- `ArcGauge.tsx` — gauge wrapper + tone color (via inline `--g-color` style var),
  SVG `track` / `fill` (stroke + drop-shadow + transition), value/unit text fills,
  name + state labels.
- `Meters.tsx` — meters column, meter rows, value + unit, track + fill (`down`/`up`
  gradients), peak label, bufferbloat row + grade box (driven by inline `--g`).
- `Sparkline.tsx` — spark wrapper, head row, title, meta, canvas sizing. (Canvas
  drawing code is untouched — it uses literal colors in JS, not CSS.)
- `GameCard.tsx` — card button, left accent bar (`::before` → kept/arbitrary),
  selected state, top row, name/genre, rank (driven by inline `--c`), status pill +
  dot, reason.
- `RegionSelector.tsx` — region grid + chips, hover/pressed states, name/metro/ping
  (driven by inline `--rc`).
- `InfoTip.tsx` — round "i" button (hover/focus teal + `color-mix` focus ring) and
  the portal tooltip bubble (`np-infotip-pop`: fixed, gradient bg, clip-path,
  shadow, `animate-infotip-in`).
- `Frame.tsx` — keeps emitting `np-frame`/`np-frame-in` (kept classes); no inline
  utilities needed.

**Dynamic per-element colors stay as inline `style` CSS vars** (already clean):
`--c` (`GameCard`), `--rc` (`RegionSelector`), `--g` (`Meters`), `--g-color`
(`ArcGauge` via the `tone-*` class → switch to inline `--g-color`). Tailwind
arbitrary values read these vars (e.g. `text-[var(--c)]`, `stroke-[var(--g-color)]`).

## 5. Verification

1. `pnpm --filter client typecheck` passes.
2. `pnpm --filter client build` passes (tsc + vite build, Tailwind compiles).
3. **Before/after visual parity** with Playwright (webapp-testing skill):
   - Capture "before" screenshots on the current `main` (pre-change) first.
   - After migration, capture the same shots and diff.
   - Widths: ~1320px (desktop), ~900px (tablet, crosses the 980px breakpoint),
     ~420px (mobile, crosses 760px + 460px breakpoints).
   - States: idle, and hosted mode (run-local panel shown vs region grid).
   - Spot-check `prefers-reduced-motion` (animations disabled).
   The client dev server (`pnpm --filter client dev`) renders the idle UI without
   the measurement server (mode detection falls back to hosted), which is
   sufficient for static visual parity.

## 6. Risks & mitigations

- **Token name collisions** with Tailwind defaults → mitigated by the `ink-*` /
  `abyss` renames (Section 2). During implementation, verify no other custom color
  name shadows a default font-size/spacing utility.
- **`@utility` vs `@layer components`** — `@utility` is single-class only; compound
  selectors (`.np-frame.hero .np-frame-in`, `.np-step.active .np-step-label`) must
  be plain CSS rules, not `@utility`. Use the right tool per piece.
- **Pixel drift from Tailwind preflight** — v4's reset differs slightly from the
  current bespoke reset (e.g. default margins, `button` styles). Mitigated by the
  base-layer rules above and by the before/after screenshot diff catching any drift.
- **`text-shadow`** — applied via arbitrary value referencing `--text-glow-teal` to
  avoid depending on a specific v4 minor that ships `text-shadow-*` utilities.

## 7. Definition of done

- `global.css` and `components.css` deleted; `index.css` is the single stylesheet.
- All 11 components + `App.tsx` use Tailwind utilities (plus the kept decorative
  classes from Section 3).
- typecheck + build pass; before/after screenshots show no visual regression at the
  three breakpoints and both modes.
