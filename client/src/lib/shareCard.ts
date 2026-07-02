import type { NetReport } from '@shared/protocol'
import type { Game } from '@shared/catalog.types'
import type { Rank, VerdictState } from '@shared/grading'
import { GENRE_BANDS } from '@shared/thresholds'
import { REGION_BY_ID } from '@shared/regions'
import { SITE_URL } from '../seo/config'
import { homePath, heroVerdict, verdictWord, t, type Lang } from '../i18n'
import { fmt, fmtMbps } from './format'
import { toneLower, type Tone } from './tone'

// 1200×630 (Open Graph ratio) PNG of a finished report, drawn in the app's
// visual language so a shared screenshot is instantly recognizable. Everything
// here runs on user click only — nothing touches the DOM at module scope, so
// the SSG prerender never executes canvas/navigator code.

export interface ShareCardData {
  lang: Lang
  gameId: string
  gameName: string
  regionLabel: string
  rank: Rank | null
  verdict: VerdictState
  pingMs: number | null
  jitterMs: number | null
  lossPct: number | null
  dlMbps: number | null
  ulMbps: number | null
  bloatGrade: string | null
  pingTone: Tone
  jitterTone: Tone
  lossTone: Tone
}

/** Flatten the report into exactly what the card draws (selected game's verdict). */
export function buildShareData(report: NetReport, game: Game, lang: Lang): ShareCardData {
  const v = report.verdicts.find((x) => x.gameId === game.id)
  const bands = GENRE_BANDS[game.genre]
  const ping = report.selectedPing?.median ?? null
  const jitter = report.selectedPing?.jitter ?? null
  const loss = report.loss?.lossPct ?? null
  return {
    lang,
    gameId: game.id,
    gameName: game.name,
    regionLabel: REGION_BY_ID[report.region]?.label ?? report.region,
    rank: v?.rank ?? report.overallRank,
    verdict: v?.state ?? 'NO',
    pingMs: ping,
    jitterMs: jitter,
    lossPct: loss,
    dlMbps: report.download?.meanMbps ?? null,
    ulMbps: report.upload?.meanMbps ?? null,
    bloatGrade: report.bufferbloat?.grade ?? null,
    pingTone: toneLower(ping, bands.pingMs),
    jitterTone: toneLower(jitter, bands.jitterMs),
    lossTone: toneLower(loss, bands.lossPct),
  }
}

/** Deep link back into the tester with the shared game preselected. */
export function shareUrl(d: Pick<ShareCardData, 'lang' | 'gameId'>): string {
  return `${SITE_URL}${homePath(d.lang)}?game=${d.gameId}`
}

/** Localized share-sheet text; the image carries the numbers. */
export function buildShareText(d: ShareCardData): string {
  const url = shareUrl(d)
  const w = verdictWord(d.lang, d.verdict)
  if (d.lang === 'es') {
    return d.rank
      ? `Mi red es rango ${d.rank} para ${d.gameName} — ${w} en FRAGRATE. Prueba la tuya: ${url}`
      : `Probé mi red para ${d.gameName} en FRAGRATE — ${w}. Prueba la tuya: ${url}`
  }
  if (d.lang === 'pt') {
    return d.rank
      ? `Minha rede é rank ${d.rank} para ${d.gameName} — ${w} no FRAGRATE. Teste a sua: ${url}`
      : `Testei minha rede para ${d.gameName} no FRAGRATE — ${w}. Teste a sua: ${url}`
  }
  return d.rank
    ? `My network is rank ${d.rank} for ${d.gameName} — ${w} on FRAGRATE. Test yours: ${url}`
    : `I tested my network for ${d.gameName} on FRAGRATE — ${w}. Test yours: ${url}`
}

// ── drawing ──────────────────────────────────────────────────────────────────

// Mirrors the CSS design tokens in styles/index.css (canvas can't read CSS vars).
const C = {
  deep: '#0a141f',
  void: '#070e16',
  wash: '#11283c',
  teal: '#3fd6c9',
  gold: '#c9a85c',
  goldLight: '#f0d28f',
  goldBright: '#f1d79a',
  goldDeep: '#b78b3e',
  inkHi: '#ece4d2',
  inkBody: '#9db1c2',
  inkLo: '#5e7184',
  good: '#5fd39a',
  warn: '#e0a64b',
  bad: '#e0455c',
  goldLine: 'rgba(201, 168, 92, 0.25)',
} as const

const DISPLAY = '"Marcellus SC", "Times New Roman", serif'
const UI = 'Rajdhani, system-ui, sans-serif'

const TONE_COLOR: Record<Tone, string> = {
  good: C.teal,
  warn: C.warn,
  bad: C.bad,
  neutral: C.inkBody,
}

function bloatColor(grade: string | null): string {
  if (grade === 'A+' || grade === 'A') return C.teal
  if (grade === 'B') return C.good
  if (grade === 'C') return C.warn
  if (grade === 'D' || grade === 'F') return C.bad
  return C.inkLo
}

async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`400 130px ${DISPLAY}`),
      document.fonts.load(`400 50px ${DISPLAY}`),
      document.fonts.load(`600 20px ${UI}`),
      document.fonts.load(`700 40px ${UI}`),
    ])
  } catch {
    /* fall back to system fonts */
  }
}

/** Draw letter-spaced text (canvas has no portable letterSpacing); returns end x. */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number): number {
  let cx = x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
  return cx - spacing
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + spacing
  return w - spacing
}

/** Pointy-top hexagon matching the CSS --hex clip-path proportions. */
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number): void {
  ctx.beginPath()
  ctx.moveTo(cx, cy - hh)
  ctx.lineTo(cx + hw, cy - hh / 2)
  ctx.lineTo(cx + hw, cy + hh / 2)
  ctx.lineTo(cx, cy + hh)
  ctx.lineTo(cx - hw, cy + hh / 2)
  ctx.lineTo(cx - hw, cy - hh / 2)
  ctx.closePath()
}

interface Span {
  text: string
  color: string
}

/** Word-wrap colored spans into lines that fit maxWidth (single ctx.font). */
function wrapSpans(ctx: CanvasRenderingContext2D, spans: Span[], maxWidth: number): Span[][] {
  const lines: Span[][] = []
  let line: Span[] = []
  let lineW = 0
  for (const span of spans) {
    for (const word of span.text.split(/(?<=\s)/)) {
      const w = ctx.measureText(word).width
      if (lineW + w > maxWidth && line.length) {
        lines.push(line)
        line = []
        lineW = 0
      }
      const last = line[line.length - 1]
      if (last && last.color === span.color) last.text += word
      else line.push({ text: word, color: span.color })
      lineW += w
    }
  }
  if (line.length) lines.push(line)
  return lines
}

export async function renderShareCard(d: ShareCardData): Promise<HTMLCanvasElement> {
  await ensureFonts()

  const W = 1200
  const H = 630
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  // background: base + radial wash + diamond grid (the app's ambient layers)
  ctx.fillStyle = C.deep
  ctx.fillRect(0, 0, W, H)
  const wash = ctx.createRadialGradient(W / 2, -60, 0, W / 2, -60, H * 1.4)
  wash.addColorStop(0, C.wash)
  wash.addColorStop(0.55, C.deep)
  wash.addColorStop(1, C.void)
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(201, 168, 92, 0.05)'
  ctx.lineWidth = 1
  for (let x = 23; x < W; x += 46) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 23; y < H; y += 46) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  // top rule (gold → teal) + inset frame
  const rule = ctx.createLinearGradient(0, 0, W, 0)
  rule.addColorStop(0, 'rgba(201, 168, 92, 0)')
  rule.addColorStop(0.3, 'rgba(201, 168, 92, 0.7)')
  rule.addColorStop(0.7, 'rgba(63, 214, 201, 0.7)')
  rule.addColorStop(1, 'rgba(63, 214, 201, 0)')
  ctx.fillStyle = rule
  ctx.fillRect(0, 0, W, 3)
  ctx.strokeStyle = C.goldLine
  ctx.strokeRect(18.5, 18.5, W - 37, H - 37)

  // rank crest (hex badge)
  const cx = 200
  const cy = 278
  const hw = 112
  const hh = 128
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, hh * 1.5)
  glow.addColorStop(0, 'rgba(224, 166, 75, 0.30)')
  glow.addColorStop(1, 'rgba(224, 166, 75, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(cx - hh * 1.5, cy - hh * 1.5, hh * 3, hh * 3)
  const rim = ctx.createLinearGradient(cx - hw, cy - hh, cx + hw * 0.6, cy + hh)
  rim.addColorStop(0, C.goldLight)
  rim.addColorStop(0.5, C.goldDeep)
  rim.addColorStop(1, '#6f5527')
  hexPath(ctx, cx, cy, hw, hh)
  ctx.fillStyle = rim
  ctx.fill()
  const inner = ctx.createRadialGradient(cx, cy - hh * 0.28, 0, cx, cy - hh * 0.28, hh * 1.3)
  inner.addColorStop(0, '#1a3650')
  inner.addColorStop(0.75, '#0a1521')
  inner.addColorStop(1, '#0a1521')
  hexPath(ctx, cx, cy, hw - 9, hh - 10)
  ctx.fillStyle = inner
  ctx.fill()
  ctx.font = `400 130px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(224, 166, 75, 0.55)'
  ctx.shadowBlur = 26
  ctx.fillStyle = d.rank ? C.goldBright : C.inkLo
  ctx.fillText(d.rank ?? '?', cx, cy + 10)
  ctx.shadowBlur = 0

  ctx.font = `600 17px ${UI}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.gold
  const caption = 'NETWORK RANK'
  drawTracked(ctx, caption, cx - trackedWidth(ctx, caption, 5) / 2, cy + hh + 36, 5)

  // eyebrow + verdict headline
  const x0 = 380
  ctx.font = `600 20px ${UI}`
  ctx.fillStyle = C.teal
  drawTracked(ctx, `${t(d.lang, 'verdict')} · ${d.gameName} · ${d.regionLabel}`.toUpperCase(), x0, 148, 3)

  const hv = heroVerdict(d.lang, d.verdict)
  ctx.font = `400 50px ${DISPLAY}`
  const spans: Span[] = [
    { text: hv.pre, color: C.inkHi },
    { text: d.gameName, color: C.teal },
    { text: hv.post, color: C.inkHi },
  ]
  let y = 218
  for (const line of wrapSpans(ctx, spans, 760).slice(0, 3)) {
    let x = x0
    for (const s of line) {
      ctx.fillStyle = s.color
      ctx.fillText(s.text, x, y)
      x += ctx.measureText(s.text).width
    }
    y += 64
  }

  // metrics strip
  const tiles: { label: string; value: string; unit: string; color: string }[] = [
    { label: t(d.lang, 'gaugePing'), value: fmt(d.pingMs, 0), unit: 'ms', color: TONE_COLOR[d.pingTone] },
    { label: t(d.lang, 'gaugeJitter'), value: fmt(d.jitterMs, 1), unit: 'ms', color: TONE_COLOR[d.jitterTone] },
    { label: t(d.lang, 'gaugeLoss'), value: fmt(d.lossPct, 2), unit: '%', color: TONE_COLOR[d.lossTone] },
    { label: t(d.lang, 'download'), value: fmtMbps(d.dlMbps), unit: 'Mbps', color: C.inkHi },
    { label: t(d.lang, 'upload'), value: fmtMbps(d.ulMbps), unit: 'Mbps', color: C.inkHi },
    { label: t(d.lang, 'bufferbloat'), value: d.bloatGrade ?? '—', unit: '', color: bloatColor(d.bloatGrade) },
  ]
  const stripX = 64
  const stripW = W - 2 * stripX
  const tileW = stripW / tiles.length
  ctx.strokeStyle = C.goldLine
  for (let i = 1; i < tiles.length; i++) {
    ctx.beginPath()
    ctx.moveTo(stripX + i * tileW, 474)
    ctx.lineTo(stripX + i * tileW, 548)
    ctx.stroke()
  }
  tiles.forEach((m, i) => {
    const center = stripX + i * tileW + tileW / 2
    ctx.font = `600 15px ${UI}`
    ctx.fillStyle = C.inkLo
    const label = m.label.toUpperCase()
    drawTracked(ctx, label, center - trackedWidth(ctx, label, 2) / 2, 492, 2)
    ctx.font = `700 40px ${UI}`
    const valueW = ctx.measureText(m.value).width
    ctx.font = `600 18px ${UI}`
    const unitW = m.unit ? ctx.measureText(m.unit).width + 7 : 0
    let x = center - (valueW + unitW) / 2
    ctx.font = `700 40px ${UI}`
    ctx.fillStyle = m.color
    ctx.fillText(m.value, x, 538)
    x += valueW + 7
    if (m.unit) {
      ctx.font = `600 18px ${UI}`
      ctx.fillStyle = C.inkLo
      ctx.fillText(m.unit, x, 538)
    }
  })

  // footer: wordmark + site
  ctx.strokeStyle = C.goldLine
  ctx.beginPath()
  ctx.moveTo(stripX, 574)
  ctx.lineTo(W - stripX, 574)
  ctx.stroke()
  ctx.font = `400 26px ${DISPLAY}`
  ctx.fillStyle = C.inkHi
  ctx.fillText('FRAG', stripX, 608)
  ctx.fillStyle = C.teal
  ctx.fillText('RATE', stripX + ctx.measureText('FRAG').width, 608)
  ctx.font = `700 22px ${UI}`
  ctx.fillStyle = C.gold
  ctx.textAlign = 'right'
  ctx.fillText('fragrate.net', W - stripX, 606)
  ctx.textAlign = 'left'

  return canvas
}

// ── share orchestration ──────────────────────────────────────────────────────

export type ShareOutcome = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'failed'

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/**
 * Render the card and hand it off: native share sheet where available
 * (mobile), else copy the PNG to the clipboard (desktop), else download it.
 */
export async function shareResult(report: NetReport, game: Game, lang: Lang): Promise<ShareOutcome> {
  const d = buildShareData(report, game, lang)
  let blob: Blob | null
  try {
    blob = await toBlob(await renderShareCard(d))
  } catch {
    return 'failed'
  }
  if (!blob) return 'failed'

  const filename = `fragrate-${d.gameId}${d.rank ? `-rank-${d.rank}` : ''}.png`
  const file = new File([blob], filename, { type: 'image/png' })
  const text = buildShareText(d)

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: 'FRAGRATE' })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // NotAllowedError etc. — fall through to clipboard/download
    }
  }
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      return 'copied'
    }
  } catch {
    /* fall through */
  }
  try {
    downloadBlob(blob, filename)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
