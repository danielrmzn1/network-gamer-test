# Tailwind v4 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-written CSS design system in `client/` with Tailwind v4 while keeping the rendered UI pixel-identical.

**Architecture:** Tailwind v4 CSS-first. Design tokens move into a single `@theme` block in a new `client/src/styles/index.css`; component `np-*` classes are replaced with utility classes inline in JSX. A deliberate ~10% of styles (notched gradient frames, the ambient body background, the diamond section divider, `color-mix()` glow boxes) stay as conventional CSS in `index.css`. During the transition, temporary back-compat CSS-variable aliases keep the not-yet-converted `components.css` rendering, so every task leaves the app building and visually identical.

**Tech Stack:** React 18, Vite 6, TypeScript, Tailwind v4 (`tailwindcss` + `@tailwindcss/vite`), pnpm workspace, Playwright (via webapp-testing) for visual parity.

## Global Constraints

- **Tailwind v4** only, CSS-first (`@theme`, `@tailwindcss/vite`). No PostCSS config, no JS `tailwind.config`.
- **Pixel-identical** rendered output is the bar. No redesign, no spacing/color "improvements."
- **No new runtime dependencies.** Only `tailwindcss` + `@tailwindcss/vite` added (dev deps in `client/`).
- **Do not touch** `server/`, `worker/`, `shared/`, or `index.html` content. The Google Fonts `<link>` and `color-scheme` meta stay as-is.
- **Do not touch** the existing `vitest` dep or `test` script in `client/package.json`.
- **Source of truth for values:** the original `client/src/styles/global.css` and `client/src/styles/components.css` (in git history after deletion) — every reproduced rule must match them exactly.
- **Token names:** per the spec, foreground `--text-*` colors → `--color-ink-*` (utilities `text-ink-hi` …); surface `--bg-base` → `--color-abyss`. All other token names are preserved.
- Browser baseline: Safari 16.4+ / Chrome 111+ (already required by existing `color-mix()`).
- Commit after each task. Work stays on branch `feat/tailwind-migration`.

## Translation Reference (apply consistently in every component task)

These conventions map the original CSS idioms to Tailwind v4. Use them everywhere; the per-component tables below assume them.

| CSS idiom | Tailwind utility |
| --- | --- |
| `color: var(--teal)` | `text-teal` (token) |
| `color: var(--text-hi)` | `text-ink-hi` (renamed token) |
| `background-color: var(--bg-panel)` | `bg-panel` |
| `font-family: var(--font-ui/display)` | `font-ui` / `font-display` |
| `clip-path: var(--cut-12)` | `[clip-path:var(--cut-12)]` (raw var; arbitrary value) |
| `box-shadow: inset 0 0 0 1px var(--gold-line)` | `shadow-[inset_0_0_0_1px_var(--gold-line)]` |
| `text-shadow: var(--text-glow-teal)` | `[text-shadow:var(--text-glow-teal)]` |
| `background: linear-gradient(180deg,a,b)` (token stops) | `bg-gradient-to-b from-<a> to-<b>` |
| `background: linear-gradient(<angle>,…)` (non-90/180 or literal stops) | `[background:linear-gradient(150deg,#0e1d2b,#0a1521)]` (arbitrary; underscores for spaces) |
| `rgba(r,g,b,a)` literal | `rgb(R_G_B/0.NN)` inside arbitrary values, or `bg-white/[0.06]` style for white/token alphas |
| `[aria-pressed="true"]{…}` | `aria-pressed:…` |
| `[aria-pressed="false"]:hover{…}` | `aria-[pressed=false]:hover:…` |
| `[data-running="true"]{…}` | `data-[running=true]:…` |
| `[data-selected="true"]{…}` | `data-[selected=true]:…` |
| `@media (max-width:980px)` | `max-[980px]:…` |
| `@media (max-width:760px)` | `max-[760px]:…` |
| `@media (max-width:460px)` | `max-[460px]:…` |
| `@media (prefers-reduced-motion)` | `motion-reduce:…` |
| `animation: np-pulse 1.3s …` | `animate-pulse-hud` (token) |
| `animation: np-infotip-in .14s …` | `animate-infotip-in` (token) |
| SVG `stroke/fill: var(--x)` | `stroke-[var(--x)]` / `fill-ink-hi` etc. |
| per-element dynamic var (`--c`, `--rc`, `--g`, `--g-color`) | keep the existing inline `style={{ '--x': … }}`; reference with `[color:var(--c)]`, `stroke-[var(--g-color)]`, etc. Change the JS color helpers to return `var(--color-*)` token values. |

Spacing crib (px → utility): 2→`0.5`, 3→`[3px]`, 4→`1`, 6→`1.5`, 7→`[7px]`, 8→`2`, 10→`2.5`, 12→`3`, 14→`3.5`, 16→`4`, 18→`[18px]`, 20→`5`, 22→`[22px]`, 24→`6`, 26→`[26px]`, 28→`7`, 30→`[30px]`, 36→`9`, 38→`[38px]`, 40→`10`, 48→`12`, 52→`[52px]`, 56→`14`. Sizes: 128→`32`, 160→`40`, 170→`[170px]`, 176→`44`. `text-xs`=12px, `text-base`=16px, `text-2xl`=24px.

## File Structure

- **Create:** `client/src/styles/index.css` — the single stylesheet: `@import "tailwindcss"`, `@theme` tokens, raw `:root` vars, temporary compat aliases, `@layer base` (resets + ambient bg), kept decorative classes, keyframes.
- **Delete (Task 1):** `client/src/styles/global.css`.
- **Delete (Task 11):** `client/src/styles/components.css` (shrinks across tasks 2–10, deleted at cleanup).
- **Modify:** `client/vite.config.ts` (add plugin), `client/src/main.tsx` (import), `client/src/App.tsx` + all 10 component files under `client/src/components/`.
- **Untouched:** `client/src/engine/**`, `client/src/lib/**`, `client/src/state/**`, `client/src/i18n.ts`, `client/index.html`.

Component tasks 2–10 are independent (each owns its own file; `index.css` is stable read-only after Task 1) and may be parallelized during execution.

---

### Task 1: Tailwind tooling + `index.css` foundation

**Files:**
- Modify: `client/package.json` (add dev deps), `client/vite.config.ts`, `client/src/main.tsx`, `client/src/App.tsx` (import line only), `client/src/styles/components.css` (remove the two `@keyframes`)
- Create: `client/src/styles/index.css`
- Delete: `client/src/styles/global.css`

**Produces (the shared interface every later task consumes):**
- Utilities from `@theme`: colors `void/deep/abyss/panel/panel-2/inset`, `teal/teal-dim/teal-deep`, `gold/gold-light/gold-bright/gold-deep`, `good/warn/bad`, `ink-hi/ink-mid/ink-body/ink-base/ink-lo/ink-faint`; `font-ui`, `font-display`; `shadow-glow-teal`, `shadow-glow-gold`; `animate-pulse-hud`, `animate-infotip-in`.
- Raw vars (for arbitrary values): `--cut-6…20`, `--hex`, `--gold-line`, `--gold-line-strong`, `--teal-line`, `--up-gold-a`, `--up-gold-b`, `--text-glow-teal`.
- Kept classes: `np-frame`, `np-frame-in` (+ `.hero`), `np-cut`, `np-section-title` (+ `.np-eyebrow`), `np-label`, `np-num`.
- Temporary compat aliases (old token names) so `components.css` keeps rendering. Removed in Task 11.

- [ ] **Step 1: Capture the "before" visual baseline (do this FIRST, before any edit)**

Start the client dev server and screenshot the idle UI at three widths. Use the webapp-testing skill (Playwright).

```bash
pnpm --filter client dev   # serves http://localhost:5173
```
Capture full-page screenshots to `scratchpad/baseline/` at viewport widths 1320, 900, 420 (idle state). The app renders without the measurement server (mode detection falls back to "hosted"). Keep these as the parity reference for Task 12.

- [ ] **Step 2: Install Tailwind v4 dev deps**

```bash
pnpm --filter client add -D tailwindcss @tailwindcss/vite
```
Expected: `tailwindcss` and `@tailwindcss/vite` (v4.x) appear in `client/package.json` devDependencies; lockfile updates.

- [ ] **Step 3: Add the Vite plugin**

Modify `client/vite.config.ts`: import the plugin and add it to `plugins`.
```ts
import tailwindcss from '@tailwindcss/vite'
// ...
  plugins: [react(), tailwindcss()],
```

- [ ] **Step 4: Create `client/src/styles/index.css`**

Write this exact content:
```css
@import "tailwindcss";

/* ── Design tokens → utilities ───────────────────────────────────────────── */
@theme {
  /* Surfaces */
  --color-void: #070e16;
  --color-deep: #0a141f;
  --color-abyss: #0a1521;     /* was --bg-base */
  --color-panel: #0f2030;
  --color-panel-2: #102234;
  --color-inset: #0e1d2b;

  /* Brand — teal + gold */
  --color-teal: #3fd6c9;
  --color-teal-dim: #1f8f9e;
  --color-teal-deep: #12273a;
  --color-gold: #c9a85c;
  --color-gold-light: #f0d28f;
  --color-gold-bright: #f1d79a;
  --color-gold-deep: #b78b3e;

  /* Semantic state */
  --color-good: #5fd39a;
  --color-warn: #e0a64b;
  --color-bad: #e0455c;

  /* Foreground / ink (was --text-*) */
  --color-ink-hi: #ece4d2;
  --color-ink-mid: #cdd8e2;
  --color-ink-body: #9db1c2;
  --color-ink-base: #93a7b8;
  --color-ink-lo: #5e7184;
  --color-ink-faint: #7c8fa0;

  /* Fonts */
  --font-display: "Marcellus SC", "Trajan Pro", "Times New Roman", serif;
  --font-ui: "Rajdhani", system-ui, -apple-system, "Segoe UI", sans-serif;

  /* Shadows / glows */
  --shadow-glow-teal: 0 0 18px rgb(63 214 201 / 0.5);
  --shadow-glow-gold: 0 6px 22px rgb(201 168 92 / 0.35);

  /* Animations */
  --animate-pulse-hud: np-pulse 1.3s ease-in-out infinite;
  --animate-infotip-in: np-infotip-in 0.14s ease-out;
}

/* ── Raw vars (not utilities; referenced via arbitrary values & kept CSS) ──── */
:root {
  --cut-6: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  --cut-8: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  --cut-10: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  --cut-12: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
  --cut-14: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  --cut-16: polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px);
  --cut-20: polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px);
  --hex: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);

  --gold-line: rgb(201 168 92 / 0.2);
  --gold-line-strong: rgb(201 168 92 / 0.4);
  --teal-line: rgb(63 214 201 / 0.25);

  --up-gold-a: #9a7a32;
  --up-gold-b: #e6c46a;

  --text-glow-teal: 0 0 24px rgb(63 214 201 / 0.45);
}

/* ── TEMP back-compat aliases (DELETE in Task 11) ──────────────────────────── */
/* Lets the not-yet-converted components.css resolve original token names. */
:root {
  --bg-void: var(--color-void);
  --bg-deep: var(--color-deep);
  --bg-base: var(--color-abyss);
  --bg-panel: var(--color-panel);
  --bg-panel-2: var(--color-panel-2);
  --bg-inset: var(--color-inset);
  --teal: var(--color-teal);
  --teal-dim: var(--color-teal-dim);
  --teal-deep: var(--color-teal-deep);
  --gold: var(--color-gold);
  --gold-light: var(--color-gold-light);
  --gold-bright: var(--color-gold-bright);
  --gold-deep: var(--color-gold-deep);
  --good: var(--color-good);
  --warn: var(--color-warn);
  --bad: var(--color-bad);
  --text-hi: var(--color-ink-hi);
  --text-mid: var(--color-ink-mid);
  --text-body: var(--color-ink-body);
  --text-base: var(--color-ink-base);
  --text-lo: var(--color-ink-lo);
  --text-faint: var(--color-ink-faint);
  --glow-gold: var(--shadow-glow-gold);
  --glow-teal: var(--shadow-glow-teal);
}

/* ── Base layer (replaces global.css base + ambient) ───────────────────────── */
@layer base {
  html,
  body,
  #root {
    margin: 0;
    min-height: 100%;
  }

  body {
    background-color: var(--color-void);
    color: var(--color-ink-base);
    font-family: var(--font-ui);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    overflow-x: hidden;
  }

  /* Ambient: radial wash + diamond grid */
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -2;
    background: radial-gradient(120% 90% at 50% -10%, #11283c 0%, #0a141f 55%, #070e16 100%);
  }
  body::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-image:
      linear-gradient(rgb(201 168 92 / 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgb(201 168 92 / 0.04) 1px, transparent 1px);
    background-size: 46px 46px;
    background-position: center;
  }

  a {
    color: var(--color-teal);
  }
  ::selection {
    background: rgb(63 214 201 / 0.28);
    color: var(--color-ink-hi);
  }
  button {
    font-family: inherit;
    cursor: pointer;
  }
  :focus-visible {
    outline: 2px solid var(--color-teal);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}

/* ── Kept decorative classes (carried over from global.css) ────────────────── */
.np-frame {
  clip-path: var(--cut-16);
  background: linear-gradient(150deg, rgb(201 168 92 / 0.32), rgb(63 214 201 / 0.14));
  padding: 1px;
}
.np-frame-in {
  clip-path: var(--cut-16);
  background: linear-gradient(150deg, #0f2030, #0a1521);
  height: 100%;
}
.np-frame.hero {
  clip-path: var(--cut-20);
  background: linear-gradient(150deg, rgb(201 168 92 / 0.5), rgb(201 168 92 / 0.08) 45%, rgb(63 214 201 / 0.22));
}
.np-frame.hero .np-frame-in {
  clip-path: var(--cut-20);
  background: linear-gradient(150deg, #102234 0%, #0a1521 70%);
}

.np-cut {
  clip-path: var(--cut-12);
  box-shadow: inset 0 0 0 1px var(--gold-line);
  background: linear-gradient(150deg, var(--color-inset), var(--color-abyss));
}

.np-section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 34px 2px 16px;
}
.np-section-title::before {
  content: "";
  width: 7px;
  height: 7px;
  background: var(--color-teal);
  transform: rotate(45deg);
  box-shadow: 0 0 8px var(--color-teal);
  flex: 0 0 auto;
}
.np-section-title .np-eyebrow {
  font-family: var(--font-ui);
  font-weight: 600;
  letter-spacing: 0.22em;
  font-size: 13px;
  text-transform: uppercase;
  color: var(--color-gold);
  white-space: nowrap;
}
.np-section-title::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--gold-line-strong), transparent);
}

.np-label {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-ink-lo);
}
.np-num {
  font-family: var(--font-display);
  color: var(--color-ink-hi);
}

/* ── Keyframes (moved from components.css) ─────────────────────────────────── */
@keyframes np-pulse {
  0%, 100% { box-shadow: 0 0 10px rgb(63 214 201 / 0.3); }
  50% { box-shadow: 0 0 22px rgb(63 214 201 / 0.6); }
}
@keyframes np-infotip-in {
  from { opacity: 0; transform: translateY(calc(-100% + 5px)); }
  to { opacity: 1; transform: translateY(-100%); }
}
```

- [ ] **Step 5: Point `main.tsx` at the new stylesheet**

In `client/src/main.tsx`, change `import './styles/global.css'` → `import './styles/index.css'`.

- [ ] **Step 6: Remove the duplicated keyframes from `components.css`**

In `client/src/styles/components.css`, delete the `@keyframes np-pulse { … }` block and the `@keyframes np-infotip-in { … }` block (now defined in `index.css`; keyframes are global so existing `components.css` rules still resolve them). Leave everything else in `components.css` untouched. Leave the `import './styles/components.css'` in `App.tsx` in place.

- [ ] **Step 7: Delete `global.css`**

```bash
git rm client/src/styles/global.css
```

- [ ] **Step 8: Verify build + typecheck**

```bash
pnpm --filter client typecheck
pnpm --filter client build
```
Expected: both pass. Tailwind compiles; no "unknown utility" errors.

- [ ] **Step 9: Verify visual parity (still identical)**

Restart `pnpm --filter client dev`, re-screenshot at 1320/900/420 idle, and compare to `scratchpad/baseline/`. Expected: no visible difference (compat aliases + kept classes preserve everything).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "build(client): add Tailwind v4 + index.css foundation; drop global.css"
```

---

### Task 2: Convert `App.tsx` shell

**Files:** Modify `client/src/App.tsx`; Modify `client/src/styles/components.css` (move `.np-app::before` to `index.css`, then delete `.np-app`, `.np-app::before`, `.np-gamepicker*`, `.np-header`, `.np-brand*`, `.np-tag`, `.np-hosted-badge`, `.np-lang*`, `.np-game-chip*`, `.np-error`, `.np-cluster`, `.np-gauges`, `.np-runlocal*`, `.np-note*` rules). Modify `client/src/styles/index.css` (add `.np-app::before`).

**Consumes:** all Task 1 tokens/vars; keeps `np-frame`, `np-section-title`/`np-eyebrow` classes (unchanged in JSX).

- [ ] **Step 1: Move the top-glow `::before` into `index.css`**

Add to `index.css` (after `.np-cut`):
```css
.np-app::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 2;
  background: linear-gradient(90deg, transparent, rgb(201 168 92 / 0.6) 30%, rgb(63 214 201 / 0.6) 70%, transparent);
}
```

- [ ] **Step 2: Rewrite the JSX classNames in `App.tsx`**

Keep the `np-app` class (for the `::before`) and add utilities. Keep `np-section-title`/`np-eyebrow` and `np-frame` (via `<Frame>`) as-is. Apply:

| Element (current class) | New `className` |
| --- | --- |
| root `div.np-app` | `np-app relative max-w-[1320px] mx-auto px-10 pt-[30px] pb-14 max-[760px]:px-4 max-[760px]:pt-[22px] max-[760px]:pb-12` |
| `header.np-header` | `flex items-center justify-between gap-6 flex-wrap mb-1.5` |
| `div.np-brand` | `flex items-baseline gap-4` |
| `h1` (brand) | `m-0 font-display font-normal text-[30px] tracking-[1px] text-ink-hi` |
| `span.mag` (RATE) | `text-teal [text-shadow:var(--text-glow-teal)]` |
| `span.np-tag` | `font-ui text-xs tracking-[0.25em] uppercase text-ink-lo` |
| `span.np-hosted-badge` | `font-ui text-[10px] font-bold tracking-[0.18em] uppercase text-gold-light [clip-path:var(--cut-6)] shadow-[inset_0_0_0_1px_var(--gold-line-strong)] px-2.5 py-1` |
| `div.np-lang` | `flex items-center [clip-path:var(--cut-10)] shadow-[inset_0_0_0_1px_var(--gold-line-strong)]` |
| `button.np-lang-btn` (both) | `bg-transparent border-none text-ink-faint font-ui text-[13px] font-semibold tracking-[0.14em] px-4 py-[7px] transition-all duration-150 aria-pressed:bg-gradient-to-b aria-pressed:from-gold-light aria-pressed:to-gold aria-pressed:text-abyss aria-pressed:font-bold aria-[pressed=false]:hover:text-ink-mid` |
| `div.np-gamepicker` | `mt-[22px] mb-2` |
| `span.np-label` (gamepicker) | `block mb-2.5 font-ui text-[11px] font-semibold tracking-[0.25em] uppercase text-ink-lo` |
| `div.np-gamepicker-row` | `flex flex-wrap gap-2` |
| `button.np-game-chip` | `font-ui text-xs tracking-[0.12em] uppercase px-4 py-2 [clip-path:var(--cut-8)] bg-white/[0.03] shadow-[inset_0_0_0_1px_var(--gold-line)] text-ink-body border-none [transition:all_0.16s_ease] hover:text-ink-mid aria-pressed:[background:linear-gradient(180deg,rgb(63_214_201/0.22),rgb(63_214_201/0.06))] aria-pressed:shadow-[inset_0_0_0_1px_rgb(63_214_201/0.55),0_0_14px_rgb(63_214_201/0.22)] aria-pressed:text-[#bff3ee]` |
| `div.np-error` | `px-[18px] py-3.5 [clip-path:var(--cut-10)] shadow-[inset_0_0_0_1px_rgb(224_69_92/0.5)] text-bad bg-[rgb(224_69_92/0.08)] my-[18px]` |
| `div.np-cluster` | `grid grid-cols-[1.55fr_1fr] gap-[18px] max-[980px]:grid-cols-1` |
| `div.np-gauges` | `flex justify-around gap-4 p-[26px] max-[460px]:flex-col max-[460px]:items-center` |
| `div.np-cards` | `grid grid-cols-5 gap-3.5 max-[980px]:grid-cols-3 max-[760px]:grid-cols-2 max-[460px]:grid-cols-1` |
| `div.np-runlocal` | `flex items-center justify-between gap-[18px] flex-wrap px-6 py-5 [clip-path:var(--cut-12)] shadow-[inset_0_0_0_1px_var(--gold-line)] [background:linear-gradient(150deg,var(--color-inset),var(--color-abyss))]` |
| `div.np-runlocal-title` | `font-ui font-semibold tracking-[0.2em] text-[13px] uppercase text-gold` |
| `p.np-runlocal-body` | `mt-1.5 mb-0 text-[13px] text-ink-body max-w-[62ch]` |
| `code.np-runlocal-cmd` | `[font-family:ui-monospace,'Cascadia_Mono',Menlo,monospace] text-[13px] text-teal bg-void [clip-path:var(--cut-8)] shadow-[inset_0_0_0_1px_rgb(63_214_201/0.3)] px-3.5 py-2.5 whitespace-nowrap` |
| `p.np-note` | `mt-[30px] mx-0.5 mb-0 pt-5 [border-top:1px_solid_var(--gold-line)] text-xs leading-[1.6] text-ink-lo max-w-[1100px] [&_b]:text-gold [&_b]:font-semibold` |

Note: `div.np-cards` appears twice in `App.tsx` (report branch and fallback branch) — update both.

- [ ] **Step 3: Delete the now-unused rules from `components.css`**

Remove from `components.css`: `.np-app`, `.np-app::before` (moved), `.np-header`, `.np-brand`, `.np-brand h1`, `.np-brand h1 .mag`, `.np-brand .np-tag`, `.np-hosted-badge`, `.np-lang`, `.np-lang-btn` (+ aria variants), `.np-gamepicker`, `.np-gamepicker .np-label`, `.np-gamepicker-row`, `.np-game-chip` (+ states), `.np-error`, `.np-cluster`, `.np-gauges`, `.np-runlocal`, `.np-runlocal-title`, `.np-runlocal-body`, `.np-runlocal-cmd`, `.np-note`, `.np-note b`, and the `.np-cluster`/`.np-cards`/`.np-gauges` entries inside the `@media` blocks. Leave the rest (Hero, gauge, meters, spark, card, region, infotip, crest, stepper rules) untouched.

- [ ] **Step 4: Verify**

```bash
pnpm --filter client typecheck && pnpm --filter client build
```
Then dev-server screenshot at 1320/900/420; diff the header, game-picker, section titles, cluster grid, run-local panel, footer against baseline. Expected: identical.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "refactor(client): convert App shell to Tailwind utilities"
```

---

### Task 3: Convert `Hero.tsx` + `RankBadge.tsx`

**Files:** Modify `client/src/components/Hero.tsx`, `client/src/components/RankBadge.tsx`; remove `.np-hero*`, `.np-cta*`, `.np-crest*` rules (and their `@media (max-width:760px)` `.np-hero*` entries) from `components.css`.

**Consumes:** Task 1 tokens; `np-frame.hero` (via `<Frame hero>`), `animate-pulse-hud`.

- [ ] **Step 1: `Hero.tsx` classNames**

| Element | New `className` |
| --- | --- |
| `<Frame hero className="np-hero-frame">` | `<Frame hero className="mt-[22px]">` |
| `div.np-hero` | `flex items-center gap-10 px-9 py-8 max-[760px]:flex-col max-[760px]:text-center` |
| `div.np-hero-info` | `flex-1 min-w-0` |
| `div.np-hero-eyebrow` | `font-ui text-xs tracking-[0.3em] uppercase text-teal mb-3.5` |
| `h1.np-verdict-line` (all 4 occurrences in `VerdictText`) | `m-0 mb-3.5 font-display font-normal text-[clamp(26px,3.4vw,40px)] leading-[1.12] text-ink-hi [text-wrap:balance]` |
| `span.hl` (inside verdict line) | `text-teal [text-shadow:var(--text-glow-teal)]` |
| `p.np-verdict-sub` (all occurrences) | `m-0 mb-[22px] text-base leading-normal text-ink-body max-w-[680px]` |
| `div.np-hero-actions` | `flex items-center gap-7 flex-wrap max-[760px]:justify-center` |
| `button.np-cta` | `font-ui font-bold text-[15px] tracking-[0.2em] uppercase text-abyss bg-gradient-to-b from-gold-light to-gold border-none px-[38px] py-3.5 [clip-path:var(--cut-12)] shadow-glow-gold transition-[filter,transform] duration-150 hover:brightness-[1.08] active:translate-y-px data-[running=true]:bg-gradient-to-b data-[running=true]:from-[#2a6f78] data-[running=true]:to-teal-dim data-[running=true]:text-[#d7faf6] data-[running=true]:cursor-progress data-[running=true]:animate-pulse-hud` |
| `div.np-hero-meta` | `flex gap-[26px] flex-wrap text-[13px] max-[760px]:justify-center [&_span]:text-ink-lo [&_b]:text-ink-mid [&_b]:font-semibold` |

- [ ] **Step 2: `RankBadge.tsx` classNames**

The `is-empty` state changes only the letter. Compute the letter class from `rank`.

| Element | New `className` |
| --- | --- |
| `div.np-crest …` (root) | `shrink-0 flex flex-col items-center gap-3.5` (drop the `is-empty` toggle from the root) |
| `div.np-crest-medallion` | `relative w-40 h-44` |
| `div.np-crest-glow` | `absolute -inset-[18px] [background:radial-gradient(circle,rgb(224_166_75/0.35),transparent_68%)]` |
| `div.np-crest-plate` | `absolute inset-0 [clip-path:var(--hex)] [background:linear-gradient(160deg,var(--color-gold-light),var(--color-gold-deep)_50%,#6f5527)]` |
| `div.np-crest-inner` | `absolute inset-1 [clip-path:var(--hex)] [background:radial-gradient(circle_at_50%_36%,#1a3650,#0a1521_75%)] grid place-items-center` |
| `div.np-crest-ring` | `absolute inset-1 [clip-path:var(--hex)] shadow-[inset_0_0_0_1px_rgb(241_215_154/0.25)] pointer-events-none` |
| `span.np-crest-letter` | base: `font-display text-[92px] leading-none` then `rank ? 'text-gold-bright [text-shadow:0_4px_18px_rgb(224_166_75/0.55)]' : 'text-ink-lo [text-shadow:none] opacity-60'` |
| `span.np-crest-cap` | `font-ui text-[11px] tracking-[0.34em] uppercase text-gold` |

- [ ] **Step 3: Delete `.np-hero*`, `.np-cta*` (+ keyframe already gone), `.np-crest*` rules and the `.np-hero*` lines in the 760px media block from `components.css`.**

- [ ] **Step 4: Verify** — typecheck + build; screenshot the hero (idle + a `data-running` state by clicking Run) and the crest (empty `?` and a graded letter if reachable) at all widths; diff vs baseline.

- [ ] **Step 5: Commit** — `refactor(client): convert Hero + RankBadge to Tailwind utilities`

---

### Task 4: Convert `PhaseStepper.tsx`

**Files:** Modify `client/src/components/PhaseStepper.tsx`; remove `.np-stepper`, `.np-step*` rules from `components.css`.

- [ ] **Step 1:** Replace the per-step state class. Build a state map in the component:
```tsx
const STEP = {
  pending: 'shadow-[inset_0_0_0_1px_var(--gold-line)] bg-white/[0.02]',
  done: 'shadow-[inset_0_0_0_1px_var(--teal-line)] bg-teal/5',
  active: 'shadow-[inset_0_0_0_1px_rgb(201_168_92/0.55)] bg-white/[0.02] animate-pulse-hud',
} as const
const NODE = { pending: 'text-ink-lo', done: 'text-teal', active: 'text-gold-light' } as const
const LABEL = { pending: 'text-ink-lo', done: 'text-ink-mid', active: 'text-gold-light' } as const
```

| Element | New `className` |
| --- | --- |
| `div.np-stepper` | `mt-3.5 flex gap-2.5 flex-wrap` |
| `div.np-step ${stateCls}` | `` `flex items-center gap-2 px-4 py-[7px] [clip-path:var(--cut-8)] ${STEP[state]}` `` (where `state` = `done`/`active`/`pending`) |
| `span.np-step-node` | `` `font-ui text-xs ${NODE[state]}` `` |
| `span.np-step-label` | `` `text-xs tracking-[0.16em] uppercase ${LABEL[state]}` `` |

Keep the existing `done`/`active`/`pending` derivation; map it to the `state` key.

- [ ] **Step 2: Delete `.np-stepper`, `.np-step`, `.np-step-node`, `.np-step-label`, `.np-step.done …`, `.np-step.active …` from `components.css`.**

- [ ] **Step 3: Verify** — build; screenshot the stepper in idle (all pending), running (one active, earlier done), and done (all done). Diff vs baseline.

- [ ] **Step 4: Commit** — `refactor(client): convert PhaseStepper to Tailwind utilities`

---

### Task 5: Convert `ArcGauge.tsx` (SVG)

**Files:** Modify `client/src/components/ArcGauge.tsx`; remove `.np-gauge*` rules from `components.css`.

- [ ] **Step 1:** Replace the `tone-${tone}` class with an inline `--g-color` style. Add a tone→token map:
```tsx
const TONE: Record<Tone, string> = {
  good: 'var(--color-teal)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
  neutral: 'var(--color-teal-dim)',
}
```
Set `style={{ '--g-color': TONE[tone] } as CSSProperties}` on the wrapper (import `CSSProperties` type).

| Element | New `className` |
| --- | --- |
| `div.np-gauge tone-*` | `flex flex-col items-center gap-3` (+ the `--g-color` style) |
| `svg` | `w-32 h-32 overflow-visible` |
| `circle.np-gauge-track` | `stroke-white/[0.06]` |
| `circle.np-gauge-fill` | `stroke-[var(--g-color)] [filter:drop-shadow(0_0_6px_var(--g-color))] [transition:stroke-dashoffset_0.9s_cubic-bezier(0.16,1,0.3,1),stroke_0.4s_ease]` |
| `text.np-gauge-value` | `font-display text-[30px] fill-ink-hi` |
| `text.np-gauge-unit` | `font-ui text-xs fill-ink-lo` |
| `span.np-gauge-name` | `text-xs tracking-[0.18em] uppercase text-ink-mid` |
| `span.np-gauge-state` | `text-[11px] tracking-[0.16em] uppercase [color:var(--g-color)] mt-[3px]` |

- [ ] **Step 2: Delete `.np-gauge`, `.np-gauge.tone-*`, `.np-gauge svg`, `.np-gauge-track`, `.np-gauge-fill`, `.np-gauge-value`, `.np-gauge-unit`, `.np-gauge-name`, `.np-gauge-state` from `components.css`.**

- [ ] **Step 3: Verify** — build; screenshot the three gauges (with and without values). Confirm arc color, glow (drop-shadow), value/unit fills, and the fill transition match. Diff vs baseline. (`np-gauges` container layout already lives in App from Task 2.)

- [ ] **Step 4: Commit** — `refactor(client): convert ArcGauge to Tailwind utilities`

---

### Task 6: Convert `Meters.tsx`

**Files:** Modify `client/src/components/Meters.tsx`; move `.np-bloat-grade` to `index.css`; remove the other `.np-meter*`, `.np-bloat*` rules from `components.css`.

- [ ] **Step 1: Move the `color-mix()` grade box to `index.css`** (kept class). Add after `.np-cut`:
```css
.np-bloat-grade {
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  clip-path: var(--cut-10);
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--g, var(--color-ink-faint));
  box-shadow:
    inset 0 0 0 2px var(--g, var(--color-ink-faint)),
    0 0 16px color-mix(in srgb, var(--g, transparent) 40%, transparent),
    inset 0 0 12px color-mix(in srgb, var(--g, transparent) 18%, transparent);
}
```
Keep `className="np-bloat-grade"` on the grade element and its inline `style={{ '--g': bloatColor(...) }}` (change `bloatColor` to return `var(--color-*)` values).

- [ ] **Step 2: `Meters.tsx` classNames.** In the `Bar` component, build the fill class from `dir`:
```tsx
const FILL = {
  down: 'bg-gradient-to-r from-teal-dim to-teal shadow-[0_0_10px_rgb(63_214_201/0.5)]',
  up: '[background:linear-gradient(90deg,var(--up-gold-a),var(--up-gold-b))] shadow-[0_0_10px_rgb(201_168_92/0.45)]',
} as const
```

| Element | New `className` |
| --- | --- |
| `div.np-meters` | `p-[26px] flex flex-col justify-center gap-[22px] h-full` |
| `div.np-meter-row` | `flex flex-col gap-2` |
| `div.np-meter-head` | `flex justify-between items-baseline` |
| `span.np-label` (Bar) | `font-ui text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-lo` |
| `span.np-meter-val` | `font-display text-2xl text-ink-hi` |
| `span.u` (in meter-val) | `font-ui text-xs text-ink-lo ml-1` |
| `div.np-meter-track` | `h-2 bg-white/[0.06] [clip-path:polygon(4px_0,100%_0,100%_100%,0_100%)] relative` |
| `div.np-meter-fill ${dir}` | `` `absolute inset-y-0 left-0 [transition:width_0.5s_cubic-bezier(0.16,1,0.3,1)] ${FILL[dir]}` `` (keep inline `style={{ width }}`) |
| `div.np-meter-max` | `text-right text-[10px] tracking-[0.1em] uppercase text-ink-lo` |
| `div.np-bloat` | `flex items-center justify-between [border-top:1px_solid_var(--gold-line)] pt-[18px]` |
| `div.np-bloat-label` | `text-xs tracking-[0.16em] uppercase text-ink-body` |
| `div.np-bloat-detail` | `text-xs text-ink-lo mt-[3px]` |
| `div.np-bloat-grade` | keep `np-bloat-grade` (kept class) + existing inline `--g` style |

- [ ] **Step 3: Delete `.np-meters`, `.np-meter-row`, `.np-meter-head`, `.np-meter-val`, `.np-meter-val .u`, `.np-meter-track`, `.np-meter-fill` (+ `.down`/`.up`), `.np-meter-max`, `.np-bloat`, `.np-bloat-label`, `.np-bloat-detail`, and the old `.np-bloat-grade` (moved) from `components.css`.**

- [ ] **Step 4: Verify** — build; screenshot the meters panel (download/upload bars with widths, bufferbloat row + colored grade box). Diff vs baseline.

- [ ] **Step 5: Commit** — `refactor(client): convert Meters to Tailwind utilities`

---

### Task 7: Convert `Sparkline.tsx`

**Files:** Modify `client/src/components/Sparkline.tsx`; remove `.np-spark*` rules from `components.css`. (The canvas-drawing JS uses literal colors — leave it untouched.)

- [ ] **Step 1: classNames**

| Element | New `className` |
| --- | --- |
| `div.np-spark` | `px-[26px] py-[22px]` |
| `div.np-spark-head` | `flex justify-between items-center mb-2.5` |
| `span.np-spark-title` | `font-semibold tracking-[0.2em] text-xs uppercase text-gold` |
| `span.np-spark-meta` | `text-xs tracking-[0.05em] text-ink-lo` |
| `canvas` | `w-full h-[170px] block` |

- [ ] **Step 2: Delete `.np-spark`, `.np-spark-head`, `.np-spark-title`, `.np-spark-meta`, `.np-spark canvas` from `components.css`.**

- [ ] **Step 3: Verify** — build; screenshot the latency chart panel (header + canvas height). Diff vs baseline.

- [ ] **Step 4: Commit** — `refactor(client): convert Sparkline to Tailwind utilities`

---

### Task 8: Convert `GameCard.tsx`

**Files:** Modify `client/src/components/GameCard.tsx`; remove `.np-card*`, `.np-pill*` rules from `components.css`.

- [ ] **Step 1:** Keep the inline `style={{ '--c': gradeColor(rank) }}`; change `gradeColor` to return `var(--color-*)` tokens (`good`/`warn`/`bad`/`teal`/`ink-lo`).

| Element | New `className` |
| --- | --- |
| `button.np-card` | `relative overflow-hidden pl-[18px] pr-4 py-4 [clip-path:var(--cut-14)] text-left border-none [background:linear-gradient(150deg,#0e1d2b,#0a1521)] shadow-[inset_0_0_0_1px_var(--gold-line)] transition-[transform,box-shadow] duration-200 before:content-[''] before:absolute before:top-0 before:left-0 before:bottom-0 before:w-[3px] before:bg-[var(--c)] data-[selected=true]:[background:linear-gradient(150deg,rgb(63_214_201/0.1),#0c1a28)] data-[selected=true]:shadow-[inset_0_0_0_1px_rgb(63_214_201/0.45),0_0_18px_rgb(63_214_201/0.15)] data-[selected=true]:-translate-y-0.5` |
| `div.np-card-top` | `flex justify-between items-start gap-2` |
| `div.np-card-name` | `font-display text-[15px] leading-[1.15] text-ink-hi` |
| `div.np-card-genre` | `text-[11px] tracking-[0.16em] uppercase text-ink-lo mt-1` |
| `div.np-card-rank` | `font-display text-[30px] leading-[0.8] [color:var(--c)] [text-shadow:0_0_12px_color-mix(in_srgb,var(--c)_30%,transparent)]` |
| `span.np-pill` | `inline-flex items-center gap-[7px] mt-3 px-3 py-1 [clip-path:var(--cut-6)] shadow-[inset_0_0_0_1px_rgb(224_166_75/0.4)]` |
| `span.dot` | `w-1.5 h-1.5 rounded-full bg-[var(--c)] shadow-[0_0_7px_var(--c)]` |
| `span` (pill label, last child) | `text-[10px] tracking-[0.18em] uppercase text-[#e0c490]` |
| `div.np-card-reason` | `text-xs text-ink-faint mt-2.5 leading-[1.35]` |

- [ ] **Step 2: Delete `.np-card`, `.np-card::before`, `.np-card[data-selected="true"]`, `.np-card-top`, `.np-card-name`, `.np-card-genre`, `.np-card-rank`, `.np-pill`, `.np-pill .dot`, `.np-pill span:last-child`, `.np-card-reason` from `components.css`.**

- [ ] **Step 3: Verify** — build; screenshot the card grid (unselected + selected card showing accent bar, lifted shadow, rank color/glow, pill). Diff vs baseline.

- [ ] **Step 4: Commit** — `refactor(client): convert GameCard to Tailwind utilities`

---

### Task 9: Convert `RegionSelector.tsx`

**Files:** Modify `client/src/components/RegionSelector.tsx`; remove `.np-regions`, `.np-region*` rules (+ their `@media` entries) from `components.css`.

- [ ] **Step 1:** Keep inline `style={{ '--rc': msColor(median) }}`; change `msColor` to return `var(--color-*)` tokens (`teal`/`warn`/`bad`/`ink-faint`).

| Element | New `className` |
| --- | --- |
| `div.np-regions` | `grid grid-cols-5 gap-3 max-[980px]:grid-cols-3 max-[760px]:grid-cols-2 max-[460px]:grid-cols-1` |
| `button.np-region-chip` | `text-left border-none px-4 py-3.5 [clip-path:var(--cut-12)] [background:linear-gradient(150deg,#0e1d2b,#0a1521)] shadow-[inset_0_0_0_1px_var(--gold-line)] [transition:box-shadow_0.18s_ease] hover:shadow-[inset_0_0_0_1px_var(--gold-line-strong)] aria-pressed:[background:linear-gradient(150deg,rgb(201_168_92/0.12),#0c1a28)] aria-pressed:shadow-[inset_0_0_0_1px_rgb(201_168_92/0.5),0_0_16px_rgb(201_168_92/0.18)]` |
| `div.np-region-name` | `text-xs tracking-[0.14em] uppercase text-ink-mid` |
| `div.np-region-metro` | `text-[11px] text-ink-lo mt-0.5` |
| `div.np-region-ping` | `mt-2.5 font-display text-[26px] [color:var(--rc)]` |
| `span.u` (ping unit) | `font-ui text-[11px] text-ink-lo ml-[3px]` |

- [ ] **Step 2: Delete `.np-regions`, `.np-region-chip` (+ `:hover`, `[aria-pressed]`), `.np-region-name`, `.np-region-metro`, `.np-region-ping`, `.np-region-ping .u`, and the `.np-regions` entries in all three `@media` blocks from `components.css`.**

- [ ] **Step 3: Verify** — this panel shows in full (non-hosted) mode. Either temporarily force `s.mode !== 'hosted'`, or run the full stack (`pnpm dev`) so the region grid renders. Screenshot the grid (default + a pressed chip) at all widths; confirm the responsive column counts (5/3/2/1). Diff vs baseline.

- [ ] **Step 4: Commit** — `refactor(client): convert RegionSelector to Tailwind utilities`

---

### Task 10: Convert `InfoTip.tsx`

**Files:** Modify `client/src/components/InfoTip.tsx`; remove `.np-infotip*` rules (+ the `@media` `.np-infotip-pop` entry) from `components.css`.

- [ ] **Step 1: classNames** (keep the inline `style` for `top/left/width` on the portal bubble)

| Element | New `className` |
| --- | --- |
| `span.np-infotip` | `inline-flex leading-[0]` |
| `button.np-infotip-btn` | `inline-grid place-items-center w-[17px] h-[17px] p-0 m-0 border-0 rounded-full bg-none text-ink-lo cursor-pointer [transition:color_0.15s_ease,box-shadow_0.15s_ease] [-webkit-tap-highlight-color:transparent] hover:text-teal focus-visible:text-teal focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-teal)_55%,transparent)]` |
| `span.np-infotip-pop` (portal) | `fixed z-[1000] -translate-y-full px-3.5 py-3 font-ui text-[12.5px] font-medium leading-normal tracking-normal normal-case text-ink-mid [background:linear-gradient(150deg,var(--color-panel-2),var(--color-inset))] [clip-path:var(--cut-8)] shadow-[inset_0_0_0_1px_var(--gold-line-strong),0_12px_34px_rgb(0_0_0/0.55)] pointer-events-none animate-infotip-in motion-reduce:animate-none` |

- [ ] **Step 2: Delete `.np-infotip`, `.np-infotip-btn` (+ `:hover`/`:focus-visible`), `.np-infotip-pop`, and the `@media (prefers-reduced-motion) .np-infotip-pop` rule from `components.css`.**

- [ ] **Step 3: Verify** — build; the "i" button is in the bufferbloat label. Hover/focus it and screenshot the open tooltip bubble (position, gradient, clip-path, shadow, entrance). Confirm focus ring. Diff vs baseline.

- [ ] **Step 4: Commit** — `refactor(client): convert InfoTip to Tailwind utilities`

---

### Task 11: Cleanup — delete `components.css`, remove compat aliases

**Files:** Delete `client/src/styles/components.css`; modify `client/src/App.tsx` (remove import); modify `client/src/styles/index.css` (remove temp aliases; drop `np-num`/`np-label` if unused).

- [ ] **Step 1: Confirm `components.css` is empty of meaningful rules.**
```bash
grep -nE '\.np-|@keyframes|@media' client/src/styles/components.css
```
Expected: nothing left except possibly empty `@media` wrappers or comments. If any `.np-*` rule remains, it was missed — go back and convert/move it before deleting.

- [ ] **Step 2: Remove the import and delete the file.**

In `client/src/App.tsx` remove `import './styles/components.css'`. Then:
```bash
git rm client/src/styles/components.css
```

- [ ] **Step 3: Remove the temporary compat-alias `:root` block from `index.css`** (the block labeled `TEMP back-compat aliases`).

- [ ] **Step 4: Drop dead kept classes.** Check whether `np-label` and `np-num` are still referenced:
```bash
grep -rn "np-label\|np-num" client/src
```
Expected after conversions: no matches (App's gamepicker label and Meters' Bar label were inlined). Remove `.np-label` and `.np-num` from `index.css` if unreferenced. Keep `np-frame*`, `np-cut`, `np-section-title*`, `np-app::before`, `np-bloat-grade` (still used).

- [ ] **Step 5: Verify**
```bash
pnpm --filter client typecheck && pnpm --filter client build
```
Expected: both pass with no `components.css` and no aliases.

- [ ] **Step 6: Commit** — `refactor(client): drop components.css and transition aliases`

---

### Task 12: Final visual-parity verification

**Files:** none (verification + final commit if any fixes).

- [ ] **Step 1: Comprehensive before/after diff.** Run `pnpm dev` (full stack, so RegionSelector renders) and capture "after" screenshots matching the Task 1 baseline set, plus the extra states:
  - Widths 1320 / 900 / 420.
  - States: idle; running (click Run); and hosted-mode run-local panel vs full-mode region grid.
  - `prefers-reduced-motion` on (emulate in Playwright) — confirm pulse/tooltip animations are disabled.
  Compare each against the baseline. Investigate any pixel diff; the acceptable causes are sub-pixel anti-aliasing only. Any real difference → fix the offending utility and re-verify.

- [ ] **Step 2: Confirm no stray CSS.**
```bash
find client/src -name '*.css'   # expect only client/src/styles/index.css
grep -rn "np-" client/src --include=*.tsx   # expect only: np-frame, np-frame-in, np-app, np-section-title, np-eyebrow, np-bloat-grade
```

- [ ] **Step 3: Final commit (if Step 1 required fixes).** Otherwise the migration is already committed.
```bash
git add -A && git commit -m "test(client): verify Tailwind migration visual parity"
```

---

## Self-Review

**Spec coverage:** Tooling/Vite/entry-css (§1) → Task 1. Token map incl. `ink-*`/`abyss` renames (§2) → Task 1 `@theme`. Raw vars (§2) → Task 1 `:root`. Kept-as-CSS set (§3: frame, cut, ambient base, section-title, app glow, color-mix grade box) → Task 1 + moved-in during Tasks 2/6. Component conversions (§4, all 11 + App) → Tasks 2–10. Dynamic inline-var pattern (§4) → Tasks 5/6/8/9 keep `style` vars, helpers return `var(--color-*)`. Verification (§5: typecheck, build, before/after at 3 widths + modes + reduced-motion) → per-task + Task 12. Out-of-scope (§6) honored: no server/worker/shared/index.html edits; only Tailwind dev deps. DoD (§7) → Tasks 11–12.

**Placeholder scan:** No TBD/TODO. Every className target is a concrete string; the index.css is given in full; deletions list exact selectors.

**Type/name consistency:** Token utility names (`text-ink-*`, `bg-abyss`, `from-gold-light`, `to-teal-dim`, `shadow-glow-gold`, `animate-pulse-hud`, `animate-infotip-in`) are defined in Task 1 and used unchanged in later tasks. Raw vars (`--cut-*`, `--gold-line*`, `--teal-line`, `--up-gold-*`, `--text-glow-teal`, `--hex`) defined in Task 1, referenced via arbitrary values later. Inline per-element vars (`--c`, `--rc`, `--g`, `--g-color`) kept as-is; helper functions (`gradeColor`, `bloatColor`, `msColor`) updated to emit `var(--color-*)`; `TONE`/`FILL`/`STEP`/`NODE`/`LABEL` maps introduced where state classes were used. Consistent.
