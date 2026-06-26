import type { Rank } from '@shared/grading'

/** Gold hexagonal rank crest (Marcellus grade letter). */
export function RankBadge({ rank }: { rank: Rank | null }) {
  return (
    <div className={`np-crest ${rank ? '' : 'is-empty'}`.trim()}>
      <div
        className="np-crest-medallion"
        role="img"
        aria-label={rank ? `Network rank ${rank}` : 'Network rank pending'}
      >
        <div className="np-crest-glow" aria-hidden="true" />
        <div className="np-crest-plate" aria-hidden="true" />
        <div className="np-crest-inner">
          <span className="np-crest-letter">{rank ?? '?'}</span>
        </div>
        <div className="np-crest-ring" aria-hidden="true" />
      </div>
      <span className="np-crest-cap">Network Rank</span>
    </div>
  )
}
