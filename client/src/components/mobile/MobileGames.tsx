import type { CSSProperties } from 'react'
import type { EngineState } from '../../state/store'
import type { Game } from '@shared/catalog.types'
import type { Lang } from '../../i18n'
import type { Genre } from '@shared/catalog.types'
import type { VerdictState } from '@shared/grading'
import { GAMES } from '@shared/catalog'
import { gradeColor } from '../GameCard'
import { t, verdictWord, reasonWord, genreLabel } from '../../i18n'

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
