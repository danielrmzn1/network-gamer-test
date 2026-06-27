import type { CSSProperties } from 'react'
import type { VerdictState } from '@shared/grading'
import type { Genre } from '@shared/catalog.types'
import type { RunMode } from '../engine/mode'
import { useLang, t, verdictWord, reasonWord, genreLabel } from '../i18n'

/** Grade letter -> semantic color (matches the design's gradeColor). */
function gradeColor(rank?: string): string {
  if (rank === 'C') return 'var(--color-good)'
  if (rank === 'D') return 'var(--color-warn)'
  if (rank === 'F') return 'var(--color-bad)'
  if (rank === 'S' || rank === 'A' || rank === 'B') return 'var(--color-teal)'
  return 'var(--color-ink-lo)'
}

interface Props {
  name: string
  genre: string
  rank?: string
  state?: VerdictState
  reason?: string | null
  mode?: RunMode
  selected: boolean
  onSelect: () => void
}

export function GameCard({ name, genre, rank, state, reason, mode, selected, onSelect }: Props) {
  const lang = useLang()
  return (
    <button
      type="button"
      className="relative overflow-hidden pl-[18px] pr-4 py-4 [clip-path:var(--cut-14)] text-left border-none [background:linear-gradient(150deg,#0e1d2b,#0a1521)] shadow-[inset_0_0_0_1px_var(--gold-line)] [transition:transform_0.15s_ease,box-shadow_0.2s_ease] before:content-[''] before:absolute before:top-0 before:left-0 before:bottom-0 before:w-[3px] before:bg-[var(--c)] data-[selected=true]:[background:linear-gradient(150deg,rgb(63_214_201/0.1),#0c1a28)] data-[selected=true]:shadow-[inset_0_0_0_1px_rgb(63_214_201/0.45),0_0_18px_rgb(63_214_201/0.15)] data-[selected=true]:-translate-y-0.5"
      style={{ '--c': gradeColor(rank) } as CSSProperties}
      data-selected={selected}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-display text-[15px] leading-[1.15] text-ink-hi">{name}</div>
          <div className="text-[11px] tracking-[0.16em] uppercase text-ink-lo mt-1">{genreLabel(lang, genre as Genre)}</div>
        </div>
        <div className="font-display text-[30px] leading-[0.8] [color:var(--c)] [text-shadow:0_0_12px_color-mix(in_srgb,var(--c)_30%,transparent)]">{rank ?? '—'}</div>
      </div>
      <span className="inline-flex items-center gap-[7px] mt-3 px-3 py-1 [clip-path:var(--cut-6)] shadow-[inset_0_0_0_1px_rgb(224_166_75/0.4)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--c)] shadow-[0_0_7px_var(--c)]" />
        <span className="text-[10px] tracking-[0.18em] uppercase text-[#e0c490]">{state ? verdictWord(lang, state) : t(lang, 'pending')}</span>
      </span>
      <div className="text-xs text-ink-faint mt-2.5 leading-[1.35]">
        {state ? (
          reason ? (
            <>
              {t(lang, 'limitedBy')} {reasonWord(lang, reason, mode)}
            </>
          ) : (
            t(lang, 'allInRange')
          )
        ) : (
          t(lang, 'runToEvaluate')
        )}
      </div>
    </button>
  )
}
