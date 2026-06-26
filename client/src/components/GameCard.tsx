import type { CSSProperties } from 'react'
import type { VerdictState } from '@shared/grading'
import type { Genre } from '@shared/catalog.types'
import type { RunMode } from '../engine/mode'
import { useLang, t, verdictWord, reasonWord, genreLabel } from '../i18n'

/** Grade letter -> semantic color (matches the design's gradeColor). */
function gradeColor(rank?: string): string {
  if (rank === 'C') return 'var(--good)'
  if (rank === 'D') return 'var(--warn)'
  if (rank === 'F') return 'var(--bad)'
  if (rank === 'S' || rank === 'A' || rank === 'B') return 'var(--teal)'
  return 'var(--text-lo)'
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
      className="np-card"
      style={{ '--c': gradeColor(rank) } as CSSProperties}
      data-selected={selected}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="np-card-top">
        <div>
          <div className="np-card-name">{name}</div>
          <div className="np-card-genre">{genreLabel(lang, genre as Genre)}</div>
        </div>
        <div className="np-card-rank">{rank ?? '—'}</div>
      </div>
      <span className="np-pill">
        <span className="dot" />
        <span>{state ? verdictWord(lang, state) : t(lang, 'pending')}</span>
      </span>
      <div className="np-card-reason">
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
