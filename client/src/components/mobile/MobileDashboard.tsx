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
        <div className="flex gap-1.5 mt-2.5" role="tablist" aria-label={t(lang, 'viewsLabel')}>
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
