import type { Rank } from '@shared/grading'

/** Gold hexagonal rank crest (Marcellus grade letter). */
export function RankBadge({ rank }: { rank: Rank | null }) {
  return (
    <div className="shrink-0 flex flex-col items-center gap-3.5">
      <div
        className="relative w-40 h-44"
        role="img"
        aria-label={rank ? `Network rank ${rank}` : 'Network rank pending'}
      >
        <div
          className="absolute -inset-[18px] [background:radial-gradient(circle,rgb(224_166_75/0.35),transparent_68%)]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 [clip-path:var(--hex)] [background:linear-gradient(160deg,var(--color-gold-light),var(--color-gold-deep)_50%,#6f5527)]"
          aria-hidden="true"
        />
        <div className="absolute inset-1 [clip-path:var(--hex)] [background:radial-gradient(circle_at_50%_36%,#1a3650,#0a1521_75%)] grid place-items-center">
          <span
            className={`font-display text-[92px] leading-none ${
              rank
                ? 'text-gold-bright [text-shadow:0_4px_18px_rgb(224_166_75/0.55)]'
                : 'text-ink-lo [text-shadow:none] opacity-60'
            }`}
          >
            {rank ?? '?'}
          </span>
        </div>
        <div
          className="absolute inset-1 [clip-path:var(--hex)] shadow-[inset_0_0_0_1px_rgb(241_215_154/0.25)] pointer-events-none"
          aria-hidden="true"
        />
      </div>
      <span className="font-ui text-[11px] tracking-[0.34em] uppercase text-gold">Network Rank</span>
    </div>
  )
}
