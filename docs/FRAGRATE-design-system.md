# FRAGRATE — Visual Design System

> **Direction:** Neon cyberpunk HUD. Dark near-black base, cyan + magenta neon glow, animated gauges, an overall S/A/B/C/D rank badge, and per-game "can you play?" verdict cards.
> **Constraint:** Fully self-contained. No external assets, no CDNs, no webfont links. Everything below ships inline.

FRAGRATE is read like an instrument cluster, not an article. The eye should land on the **rank badge** first (the verdict), then the **gauges** (the evidence), then the **per-game cards** (the consequence). Color is doing two separate jobs and they must never be confused: **cyan/magenta is the brand atmosphere**, and **green/amber/red is semantic state**. A gauge glows cyan because that's the HUD; its needle goes red because the number is bad. Keep those systems apart and the whole thing stays legible.

---

## 1. Color tokens

### Design rationale

- **Base is layered near-black with a blue bias** (`#05070D`), not pure `#000`. Pure black kills the neon — the glow needs a slightly-lit dark surface to bloom against. Each elevation layer lifts ~4–6% in lightness so panels read as floating glass over a void.
- **Two brand neons:** cyan `#0AF0FF` (primary HUD, "data") and magenta `#FF2BD6` (energy, "you / the player"). They sit near-opposite on the wheel for maximum charge. Magenta is rationed — it marks the live/active thing, never fills large areas.
- **Semantic triad is deliberately desaturated-neon, not traffic-light primary:** a spring green, an amber-gold, a hot coral-red. They're tuned to glow on dark without vibrating against the cyan.
- **Neutrals are blue-grey**, never neutral grey — `#8A93A6` carries a hint of the cyan so dimmed text feels native to the world.

### `:root` token block (drop-in)

```css
:root {
  /* ---- Base / elevation (layered near-black, blue bias) ---- */
  --bg-void:        #05070D;  /* page background, deepest */
  --bg-base:        #0A0E18;  /* app shell */
  --bg-panel:       #0F1626;  /* cards, panels (glass over void) */
  --bg-panel-2:     #161F33;  /* raised / hover panel */
  --bg-inset:       #070A12;  /* recessed wells: gauge tracks, inputs */
  --bg-grid:        #0D1320;  /* scanline / grid line tint */

  /* ---- Brand neon ---- */
  --neon-cyan:      #0AF0FF;
  --neon-cyan-dim:  #0BA9B5;  /* cyan at rest / borders */
  --neon-magenta:   #FF2BD6;
  --neon-mag-dim:   #B5219B;  /* magenta at rest / borders */

  /* ---- Semantic state (separate from brand) ---- */
  --good:           #36F1A6;  /* PLAYABLE / good */
  --good-dim:       #1E8F66;
  --warn:           #FFC53D;  /* RISKY / warning */
  --warn-dim:       #B8862A;
  --bad:            #FF4D6A;  /* NO / critical */
  --bad-dim:        #A12C40;

  /* ---- Text ---- */
  --text-hi:        #EAF6FF;  /* primary readout, near-white w/ cyan tint */
  --text-mid:       #B8C4DA;  /* labels, secondary */
  --text-lo:        #8A93A6;  /* captions, units, disabled */
  --text-faint:     #4A5468;  /* gridline labels, hints */

  /* ---- Lines / strokes ---- */
  --stroke:         #1E2A42;  /* default hairline border */
  --stroke-strong:  #2C3C5C;
  --focus-ring:     #0AF0FF;

  /* ---- Glow shadows (the signature) ---- */
  --glow-cyan:      0 0 4px #0AF0FF, 0 0 14px rgba(10,240,255,.55), 0 0 32px rgba(10,240,255,.25);
  --glow-cyan-soft: 0 0 10px rgba(10,240,255,.30);
  --glow-magenta:   0 0 4px #FF2BD6, 0 0 14px rgba(255,43,214,.55), 0 0 30px rgba(255,43,214,.22);
  --glow-good:      0 0 4px #36F1A6, 0 0 16px rgba(54,241,166,.45);
  --glow-warn:      0 0 4px #FFC53D, 0 0 16px rgba(255,197,61,.45);
  --glow-bad:       0 0 4px #FF4D6A, 0 0 16px rgba(255,77,106,.50);

  /* text-shadow flavor of the cyan glow, for headings/readouts */
  --text-glow-cyan: 0 0 6px rgba(10,240,255,.7), 0 0 18px rgba(10,240,255,.35);
  --text-glow-mag:  0 0 6px rgba(255,43,214,.7), 0 0 18px rgba(255,43,214,.35);

  /* ---- Radii / spacing scale ---- */
  --r-sm: 4px;  --r-md: 8px;  --r-lg: 14px;  --r-pill: 999px;
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;  --sp-4: 16px;
  --sp-5: 24px; --sp-6: 32px; --sp-7: 48px;  --sp-8: 64px;
}
```

### State → token mapping

| Verdict / state | Surface | Glow | Text |
|---|---|---|---|
| PLAYABLE / good | `--good` stroke on `--bg-panel` | `--glow-good` | `--good` |
| RISKY / warn | `--warn` stroke | `--glow-warn` | `--warn` |
| NO / critical | `--bad` stroke | `--glow-bad` | `--bad` |
| Live / in-progress | `--neon-magenta` stroke | `--glow-magenta` | `--neon-magenta` |
| Idle / data HUD | `--neon-cyan-dim` stroke | `--glow-cyan-soft` | `--text-hi` |

---

## 2. Typography

### The pairing

No webfont fetch (CSP-safe). We evoke three roles using system stacks plus **one bundled display face delivered as a base64 `@font-face` data URI**, with a strong system fallback so a missing font never breaks the HUD.

| Role | Feel to evoke | Self-contained stack |
|---|---|---|
| **Display / HUD headline** | A wide, squared, mono-ish techno face (think *Orbitron / Rajdhani* energy) — geometric, slightly condensed, all-caps. | Bundle one such face as `FragrateDisplay` via data-URI `@font-face`. Fallback: `"Bahnschrift", "DIN Alternate", "Eurostile", system-ui, sans-serif`. |
| **Readout / numerals** | A monospace so digits never reflow as they count up. | `ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace`. Always with `font-variant-numeric: tabular-nums`. |
| **Body / labels** | Clean neutral grotesque (think *Inter*-class but we don't ship it). | `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. |

```css
/* Bundled display face — replace the base64 payload with the real woff2 */
@font-face {
  font-family: "FragrateDisplay";
  src: url("data:font/woff2;base64,<<<INLINE_WOFF2_PAYLOAD>>>") format("woff2");
  font-weight: 400 800;
  font-display: swap;
}

:root {
  --font-display: "FragrateDisplay", "Bahnschrift", "DIN Alternate", "Eurostile", system-ui, sans-serif;
  --font-mono:    ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace;
  --font-body:    system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

> If no display face is bundled, the fallback stack still reads as "HUD" because we lean on uppercase + wide tracking + tabular numerals to do the work.

### Type scale & treatment

| Token | Size / line-height | Weight | Tracking | Transform | Use |
|---|---|---|---|---|---|
| `--t-rank` | 88px / 0.9 | 800 | -0.02em | upper | The single S/A/B/C/D letter |
| `--t-display-xl` | 40px / 1.05 | 700 | 0.04em | upper | Hero verdict line |
| `--t-display` | 28px / 1.1 | 700 | 0.06em | upper | Section / panel titles |
| `--t-readout` | 34px / 1 | 600 (mono) | 0 | — | Gauge center number (ping ms) |
| `--t-readout-sm` | 20px / 1 | 600 (mono) | 0 | — | Secondary metric values |
| `--t-label` | 12px / 1.3 | 600 | 0.16em | upper | HUD labels: PING, JITTER, LOSS |
| `--t-body` | 15px / 1.55 | 400 | 0 | — | Descriptions, helper copy |
| `--t-caption` | 11px / 1.4 | 500 | 0.08em | upper | Units, gridline labels, footnotes |

**Letter-spacing is the HUD tell.** Every uppercase label gets `0.12–0.16em` tracking. Body copy gets none. Numerals get `tabular-nums` so a `9` ms reading and a `188` ms reading occupy aligned columns.

---

## 3. Component inventory

Each entry: what it looks like, then the key CSS technique that makes it work.

### 3.1 Radial / arc SVG gauge — Ping · Jitter · Loss
**Visual.** A 270° arc (gap at the bottom, like a tachometer) on a recessed `--bg-inset` track. The progress arc is a cyan-to-magenta stroke that *fills* as the value lands, capped with a glowing round end. The center shows a big mono readout (`34 ms`) over a small uppercase label (`PING`). The arc color shifts to the **semantic** token when the value crosses a threshold (good→warn→bad), and the whole arc carries a `drop-shadow` glow matching that state.

**Technique.** Single `<circle>` with `stroke-dasharray` = circumference and an animated `stroke-dashoffset`; `stroke-linecap:round`; the whole arc rotated to start at the 7-o'clock position. Glow via SVG `filter` (`feGaussianBlur` + `feMerge`) or a CSS `filter: drop-shadow(...)` on the stroked element. Gradient stroke via an inline `<linearGradient>`. See snippet in §6.

### 3.2 Throughput bar meters — Download / Upload
**Visual.** Horizontal segmented bars. The fill is a clipped neon gradient (cyan for download, magenta for upload) with a faint moving "data stream" shimmer travelling left→right while the test runs. A tick scale below (0 / 50 / 100 / 250 / 500+ Mbps, non-linear). Current value as a mono readout pinned to the right.

**Technique.** Track = `--bg-inset` with `inset` box-shadow for depth. Fill = `width%` transition + `linear-gradient` + an overlaid pseudo-element with a repeating-gradient that animates `background-position` (the shimmer). Segments via a `repeating-linear-gradient` mask so the bar reads as discrete cells.

### 3.3 Live latency sparkline
**Visual.** A wide, short strip charting latency over the last ~60 samples. Cyan stroke line, a soft cyan area-fill fading to transparent below it, a faint horizontal grid, and an **emphasized glowing endpoint dot** that pulses. Spikes above the "playable" threshold tint that segment toward `--warn`/`--bad`.

**Technique.** Canvas (not SVG) for the rolling redraw — cheaper than thrashing the DOM. Draw: faint gridlines → area fill (`createLinearGradient`, cyan `.25` → transparent) → stroke line with `shadowBlur` for glow → endpoint arc with stronger `shadowBlur`. New sample shifts the buffer and requests one frame.

### 3.4 The big rank badge (S / A / B / C / D)
**Visual.** The hero. A hexagon/shield plate in `--bg-panel-2` with a double neon border, holding one giant display letter. Rank drives color: **S** = magenta+cyan dual glow (special), **A/B** = cyan, **C** = amber, **D** = red. A thin rotating conic-gradient ring orbits behind it, and the letter has a layered `text-shadow` glow plus a subtle CRT chromatic-split (cyan/magenta offset copies). Below: a one-line plain-language summary ("Tournament-ready").

**Technique.** Hex via `clip-path: polygon(...)`. Orbiting ring = pseudo-element with `background: conic-gradient(...)` and a slow `rotate` animation, masked to a ring with `mask: radial-gradient(...)`. Chromatic split = two `text-shadow` offsets in cyan and magenta. See §6.

### 3.5 Per-game verdict card — PLAYABLE / RISKY / NO
**Visual.** A card per title (Valorant, CS2, Fortnite, LoL, Apex…). Top row: game name + a small required-spec line (e.g. "needs < 50 ms, < 2% loss"). Center: a bold **state pill** — `PLAYABLE` (green), `RISKY` (amber), `NO` (red) — with matching glow. The card's left edge carries a 3px severity stripe in the state color, and the whole card border glows faintly in that color on hover. A micro-readout shows the limiting factor ("Loss 4% — too high").

**Technique.** Border glow via layered `box-shadow` (one inset hairline + one outer colored bloom) using the state token. Severity stripe = `border-left` or a `::before`. The state pill reuses the semantic glow tokens. See §6.

### 3.6 Region / server selector
**Visual.** A horizontal scroll-row of pill chips (Frankfurt, London, Ashburn, Tokyo…) each showing its name + a tiny live ping number. Selected chip gets the cyan neon fill + glow; others sit as outline chips. A faint "auto-detected" chip is pre-highlighted.

**Technique.** `display:flex; gap; overflow-x:auto` with scroll-snap. Selected = cyan border + `--glow-cyan-soft` + `--text-hi`; unselected = `--stroke` border, `--text-mid`. Ping number in mono.

### 3.7 "RUN TEST" CTA
**Visual.** The loudest control. A wide pill with a cyan→magenta gradient border, dark interior, uppercase tracked label, and a constant slow glow-pulse at rest. On hover the glow intensifies and a sweep of light crosses it. While running it transforms into a labeled progress state ("MEASURING JITTER…") and the glow switches to magenta (live).

**Technique.** Gradient border via `background` + `border: 2px solid transparent` with `background-clip: padding-box, border-box` (double background trick), or a `::before` gradient frame. Sweep = a skewed white `linear-gradient` pseudo-element animated across on hover. Pulse = `animation` on `box-shadow`.

### 3.8 Progress / phase stepper
**Visual.** A thin horizontal track of named phases — `PING → JITTER → LOSS → DOWNLOAD → UPLOAD → SCORING`. Completed phases are solid cyan with a check; the active phase pulses magenta; pending phases are dim outline. A connecting line fills behind them as it advances.

**Technique.** Flex row of step nodes; connector = a background line with an animated `width` overlay in cyan. Active node uses the magenta glow-pulse; completed nodes use static `--glow-cyan-soft`.

### 3.8b Phase verdict micro-states (RISKY example)

```html
<div class="np-card np-card--risky">
  <div class="np-card__stripe" aria-hidden="true"></div>
  <header class="np-card__head">
    <span class="np-game">VALORANT</span>
    <span class="np-req">needs &lt; 50 ms · &lt; 2% loss</span>
  </header>
  <div class="np-verdict np-verdict--risky">RISKY</div>
  <p class="np-reason">Loss 4% — packet loss above competitive threshold.</p>
</div>
```

### 3.9 Results summary panel
**Visual.** A glass panel that slides up after a run. Left: the rank badge restated small. Middle: a tidy table/grid of every metric with its value, unit, and a tiny state dot. Right: a "share card" preview + a `RUN AGAIN` ghost button. Headed by the hero verdict line.

**Technique.** `backdrop`-style panel = `--bg-panel` with a top hairline `--neon-cyan-dim` border and `--glow-cyan-soft`. Metric grid uses `display:grid; grid-template-columns: 1fr auto auto` with `tabular-nums`.

---

## 4. Layout

### Dashboard grid

```
┌────────────────────────────────────────────────────────────┐
│  HERO VERDICT  — rank badge + summary line + RUN TEST CTA    │
├──────────────────────────┬─────────────────────────────────┤
│  GAUGES (ping/jitter/loss)│  THROUGHPUT (down / up)          │
│  3-up arc gauges          │  two bar meters                  │
├──────────────────────────┴─────────────────────────────────┤
│  LIVE LATENCY SPARKLINE (full width)                         │
├──────────────────────────────────────────────────────────────┤
│  PER-GAME VERDICT CARDS  (auto-fill grid)                    │
├──────────────────────────────────────────────────────────────┤
│  REGION SELECTOR (scroll row)   ·   PHASE STEPPER            │
└──────────────────────────────────────────────────────────────┘
```

```css
.np-dash {
  display: grid;
  gap: var(--sp-5);
  grid-template-columns: repeat(12, 1fr);
  max-width: 1280px;
  margin-inline: auto;
  padding: var(--sp-6) var(--sp-5);
}
.np-hero       { grid-column: 1 / -1; }
.np-gauges     { grid-column: 1 / 8; }   /* gauges get the wider left */
.np-throughput { grid-column: 8 / -1; }
.np-sparkline  { grid-column: 1 / -1; }
.np-games      { grid-column: 1 / -1; }

/* per-game cards: responsive auto-fill */
.np-games-grid {
  display: grid;
  gap: var(--sp-4);
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

/* 3-up gauges collapse to a snap row on mid screens */
.np-gauges-row {
  display: grid;
  gap: var(--sp-4);
  grid-template-columns: repeat(3, 1fr);
}
```

### Hero verdict area
Center-stage on load: the rank badge (left or centered), the plain-language verdict line beside it (`--t-display-xl`), and the `RUN TEST` CTA. This is the only place magenta and cyan are allowed to glow at full strength simultaneously. Everything else in the hero is quiet so the badge wins.

### Mobile behavior (`max-width: 760px`)

```css
@media (max-width: 760px) {
  .np-dash { grid-template-columns: 1fr; gap: var(--sp-4); padding: var(--sp-4); }
  .np-gauges, .np-throughput { grid-column: 1 / -1; }
  .np-gauges-row { grid-template-columns: 1fr; }     /* gauges stack */
  .np-games-grid { grid-template-columns: 1fr 1fr; } /* 2-up cards */
  .np-hero { text-align: center; }
  .np-rank { font-size: 64px; }                       /* badge shrinks */
}
@media (max-width: 420px) {
  .np-games-grid { grid-template-columns: 1fr; }      /* 1-up cards */
}
```

- Gauges stack vertically (or become a horizontal scroll-snap row, keeping them large enough to read).
- The phase stepper turns vertical on the narrowest screens.
- CTA goes full-width and sticks to the bottom while running.

---

## 5. Motion

| Motion | Spec |
|---|---|
| **Gauge sweep** | `stroke-dashoffset` animates over **900ms** with `cubic-bezier(.16,1,.3,1)` (fast out, settling overshoot-free). The needle/end-cap leads, the center number count-up runs in sync. |
| **Number count-up** | JS `requestAnimationFrame` interpolation, **700ms**, ease-out; `tabular-nums` prevents width jitter. Runs once per result, not per frame of live data. |
| **Glow pulse** | `box-shadow`/`text-shadow` opacity breathes on a **2.4s** `ease-in-out` `alternate` loop — used on the rank badge, active CTA, and active stepper node. Subtle: ~`0.6 → 1.0` intensity, never a hard blink. |
| **Scanline / grid background** | A fixed full-page layer: a `repeating-linear-gradient` of 1px horizontal lines at ~3% opacity over the void, plus a faint perspective grid. A single soft scanline band drifts top→bottom over **8s** linear. Sits behind everything at low opacity so it's atmosphere, not noise. |
| **CTA light-sweep** | On hover, a skewed highlight crosses the button once over **600ms**. |
| **Sparkline endpoint** | The leading dot pulses (`scale` + `shadowBlur`) on a **1.2s** loop. |
| **Throughput shimmer** | The "data stream" overlay scrolls `background-position` continuously **only while a test runs**, then freezes. |

### Reduced-motion fallback (required)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  /* Gauges/counters jump straight to final value.
     Glow becomes a static, non-pulsing shadow.
     Scanline band and shimmer are removed entirely. */
  .np-scanline-band, .np-throughput__shimmer { display: none; }
}
```

Even with motion reduced, the **state still reads**: glows stay (static), colors stay, rank and verdicts are correct. Motion is enhancement, never the carrier of meaning.

---

## 6. Key component CSS snippets (ready to use)

### 6.1 Background atmosphere (scanline + perspective grid)

```css
.np-app {
  position: relative;
  min-height: 100vh;
  background: var(--bg-void);
  color: var(--text-mid);
  font-family: var(--font-body);
  isolation: isolate;
}
/* grid + scanlines */
.np-app::before {
  content: "";
  position: fixed; inset: 0; z-index: -2; pointer-events: none;
  background:
    repeating-linear-gradient(0deg, transparent 0 2px, rgba(10,240,255,.035) 2px 3px),
    radial-gradient(120% 80% at 50% -10%, rgba(10,240,255,.10), transparent 60%),
    radial-gradient(100% 60% at 90% 110%, rgba(255,43,214,.08), transparent 60%),
    var(--bg-base);
}
/* drifting scanline band */
.np-scanline-band {
  position: fixed; left: 0; right: 0; top: 0; height: 140px; z-index: -1;
  pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(10,240,255,.06), transparent);
  animation: np-scan 8s linear infinite;
}
@keyframes np-scan { from { transform: translateY(-140px); } to { transform: translateY(100vh); } }
```

### 6.2 Gauge glow (SVG arc)

```html
<svg class="np-gauge" viewBox="0 0 120 120" role="img" aria-label="Ping 34 milliseconds">
  <defs>
    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"  stop-color="var(--neon-cyan)"/>
      <stop offset="1"  stop-color="var(--neon-magenta)"/>
    </linearGradient>
  </defs>
  <!-- track -->
  <circle class="np-gauge__track" cx="60" cy="60" r="50"/>
  <!-- progress (270deg arc) -->
  <circle class="np-gauge__fill" cx="60" cy="60" r="50"/>
</svg>
```

```css
.np-gauge { width: 100%; transform: rotate(135deg); } /* start arc bottom-left */
.np-gauge__track,
.np-gauge__fill {
  fill: none; stroke-width: 9; stroke-linecap: round;
  /* 270° of a 2πr circumference: r=50 → C≈314.16; 75% = 235.6 visible */
  stroke-dasharray: 235.6 314.16;
}
.np-gauge__track { stroke: var(--bg-inset); }
.np-gauge__fill {
  stroke: url(#gaugeGrad);
  /* offset = 235.6 * (1 - value%) ; set via JS or inline style */
  stroke-dashoffset: 235.6;
  filter: drop-shadow(0 0 6px rgba(10,240,255,.7))
          drop-shadow(0 0 14px rgba(10,240,255,.35));
  transition: stroke-dashoffset .9s cubic-bezier(.16,1,.3,1);
}
/* state recolor: add .is-warn / .is-bad on the <svg> */
.np-gauge.is-warn .np-gauge__fill { stroke: var(--warn);
  filter: drop-shadow(0 0 6px rgba(255,197,61,.7)) drop-shadow(0 0 14px rgba(255,197,61,.35)); }
.np-gauge.is-bad  .np-gauge__fill { stroke: var(--bad);
  filter: drop-shadow(0 0 6px rgba(255,77,106,.8)) drop-shadow(0 0 16px rgba(255,77,106,.4)); }
```

### 6.3 Neon text (with CRT chromatic split for the rank letter)

```css
.np-neon {
  color: var(--text-hi);
  text-shadow: var(--text-glow-cyan);
}
.np-rank {
  font-family: var(--font-display);
  font-size: var(--t-rank); font-weight: 800; line-height: .9;
  color: var(--text-hi);
  /* layered glow + chromatic aberration (cyan left, magenta right) */
  text-shadow:
    -1.5px 0 rgba(255,43,214,.9),
     1.5px 0 rgba(10,240,255,.9),
     0 0 10px rgba(10,240,255,.6),
     0 0 26px rgba(10,240,255,.35);
}
.np-rank--s {  /* the special dual-neon top rank */
  text-shadow:
    -2px 0 rgba(255,43,214,1),
     2px 0 rgba(10,240,255,1),
     0 0 14px rgba(255,43,214,.6),
     0 0 30px rgba(10,240,255,.5);
}
.np-rank--c { text-shadow: -1.5px 0 rgba(255,197,61,.7), 0 0 18px rgba(255,197,61,.5); color:#FFE5AE; }
.np-rank--d { text-shadow: -1.5px 0 rgba(255,77,106,.8), 0 0 18px rgba(255,77,106,.55); color:#FFD2DA; }
```

### 6.4 Card border glow (per-game verdict card)

```css
.np-card {
  position: relative;
  background:
    linear-gradient(180deg, var(--bg-panel-2), var(--bg-panel));
  border: 1px solid var(--stroke);
  border-radius: var(--r-lg);
  padding: var(--sp-5) var(--sp-4);
  overflow: hidden;
  transition: box-shadow .25s ease, border-color .25s ease, transform .25s ease;
}
/* severity stripe down the left edge */
.np-card__stripe {
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
}
.np-card--good  { border-color: var(--good-dim); }
.np-card--risky { border-color: var(--warn-dim); }
.np-card--no    { border-color: var(--bad-dim);  }
.np-card--good  .np-card__stripe { background: var(--good); box-shadow: var(--glow-good); }
.np-card--risky .np-card__stripe { background: var(--warn); box-shadow: var(--glow-warn); }
.np-card--no    .np-card__stripe { background: var(--bad);  box-shadow: var(--glow-bad);  }

.np-card:hover { transform: translateY(-2px); }
.np-card--good:hover  { box-shadow: inset 0 0 0 1px var(--good), 0 0 22px rgba(54,241,166,.30); }
.np-card--risky:hover { box-shadow: inset 0 0 0 1px var(--warn), 0 0 22px rgba(255,197,61,.30); }
.np-card--no:hover    { box-shadow: inset 0 0 0 1px var(--bad),  0 0 22px rgba(255,77,106,.32); }

/* the verdict pill */
.np-verdict {
  display: inline-block;
  font-family: var(--font-display);
  font-size: 18px; font-weight: 700; letter-spacing: .12em;
  padding: 6px 16px; border-radius: var(--r-pill);
  background: var(--bg-inset); border: 1px solid currentColor;
}
.np-verdict--good  { color: var(--good); text-shadow: 0 0 8px rgba(54,241,166,.7); box-shadow: var(--glow-good); }
.np-verdict--risky { color: var(--warn); text-shadow: 0 0 8px rgba(255,197,61,.7); box-shadow: var(--glow-warn); }
.np-verdict--no    { color: var(--bad);  text-shadow: 0 0 8px rgba(255,77,106,.7); box-shadow: var(--glow-bad); }
```

### 6.5 RUN TEST CTA (gradient frame + glow pulse)

```css
.np-cta {
  position: relative;
  font-family: var(--font-display);
  font-size: 18px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
  color: var(--text-hi);
  padding: 16px 40px; border-radius: var(--r-pill);
  border: 2px solid transparent;
  background:
    linear-gradient(var(--bg-base), var(--bg-base)) padding-box,
    linear-gradient(90deg, var(--neon-cyan), var(--neon-magenta)) border-box;
  cursor: pointer;
  box-shadow: var(--glow-cyan-soft);
  animation: np-pulse 2.4s ease-in-out infinite alternate;
  overflow: hidden;
}
@keyframes np-pulse {
  from { box-shadow: 0 0 8px rgba(10,240,255,.25); }
  to   { box-shadow: 0 0 22px rgba(10,240,255,.55), 0 0 40px rgba(255,43,214,.25); }
}
.np-cta::after { /* hover light-sweep */
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.25) 50%, transparent 70%);
  transform: translateX(-120%) skewX(-15deg);
}
.np-cta:hover::after { transition: transform .6s ease; transform: translateX(120%) skewX(-15deg); }
.np-cta:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 3px; }
.np-cta.is-running { /* live state goes magenta */
  background:
    linear-gradient(var(--bg-base), var(--bg-base)) padding-box,
    linear-gradient(90deg, var(--neon-magenta), var(--neon-cyan)) border-box;
}
```

---

## 7. Accessibility & integrity checklist

- **Color is never the only signal.** Verdict pills carry the word (`PLAYABLE`/`RISKY`/`NO`); gauges carry the number + unit; cards carry a text reason. The green/amber/red is reinforcement.
- **Contrast.** Primary readouts use `--text-hi` (`#EAF6FF`) on `--bg-panel` (passes AA for large text). Don't put body copy in `--text-faint`; that token is for gridline labels only.
- **Focus.** Every interactive element gets a visible `--focus-ring` outline with offset — the cyan ring doubles as on-brand.
- **Reduced motion.** Honored globally (§5); meaning survives without animation.
- **Self-contained.** No CDN, no remote font, no remote image. The one display face is inlined as a data URI with a system fallback; gauges/sparkline are SVG/Canvas; all glow is box/text-shadow. Nothing fetches.
- **Tabular numerals everywhere digits update**, so counters and metric columns never reflow.
