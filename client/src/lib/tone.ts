import type { LowerBand } from '@shared/thresholds.types'

export type Tone = 'good' | 'warn' | 'bad' | 'neutral'

/** Map a "lower is better" metric to a semantic tone using its genre band. */
export function toneLower(v: number | null | undefined, b: LowerBand): Tone {
  if (v == null || !Number.isFinite(v)) return 'neutral'
  if (v <= b.good) return 'good'
  if (v <= b.ok) return 'warn'
  return 'bad'
}

/** A sensible gauge max so the band thresholds sit at meaningful arc positions. */
export function gaugeMax(b: LowerBand): number {
  return Math.max(b.bad * 1.7, b.bad + 1)
}

export function toneWord(t: Tone): string {
  if (t === 'good') return 'Optimal'
  if (t === 'warn') return 'Marginal'
  if (t === 'bad') return 'Poor'
  return ''
}
