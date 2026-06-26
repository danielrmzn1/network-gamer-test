import type { LowerBand, HigherBand, GenreBands } from './thresholds.types'

// Scoring + grading (BUILD_SPEC §2.2). Runs client-side after measurements land.

/** Lower-is-better subscore on a 0..100 piecewise scale through the band edges. */
export function lowerSubscore(x: number, b: LowerBand): number {
  const { great: g, good: o, ok: k, bad: d } = b
  if (x <= g) return 100
  if (x <= o) return 100 - (15 * (x - g)) / (o - g) // 100..85
  if (x <= k) return 85 - (25 * (x - o)) / (k - o) // 85..60
  if (x <= d) return 60 - (35 * (x - k)) / (d - k) // 60..25
  return Math.max(0, 25 - (25 * (x - d)) / d) // 25..0
}

/** Higher-is-better subscore (throughput). */
export function higherSubscore(v: number, b: HigherBand): number {
  const { good: G, ok: O } = b
  if (v >= G) return 100
  if (v >= O) return 60 + (40 * (v - O)) / (G - O) // 60..100
  return Math.max(0, (60 * v) / O) // 0..60
}

export type Rank = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
export type BloatGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'
export type VerdictState = 'PLAYABLE' | 'RISKY' | 'NO'

export interface MetricInputs {
  ping_ms: number // median RTT to the game endpoint
  jitter_ms: number // mean-abs-dev of consecutive RTTs
  loss_pct: number | null // packet loss %; null = could not be measured
  dl_mbps: number
  ul_mbps: number
  rtt_idle: number // for bufferbloat
  rtt_loaded: number | null // loaded median; null = bufferbloat not measured
}

/** Bufferbloat penalty applied to the score (engine band edges). */
export function bloatPenalty(addedMs: number): number {
  if (addedMs <= 5) return 0
  if (addedMs <= 30) return 3
  if (addedMs <= 60) return 8
  if (addedMs <= 200) return 16
  return 28
}

/** 6-band display grade for bufferbloat (A+ split from A). */
export function bloatGrade(addedMs: number): BloatGrade {
  if (addedMs <= 5) return 'A+'
  if (addedMs <= 30) return 'A'
  if (addedMs <= 60) return 'B'
  if (addedMs <= 150) return 'C'
  if (addedMs <= 400) return 'D'
  return 'F'
}

export function scoreToLetter(score: number): Rank {
  if (score >= 95) return 'S'
  if (score >= 85) return 'A'
  if (score >= 72) return 'B'
  if (score >= 58) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

const ORDER: Rank[] = ['S', 'A', 'B', 'C', 'D', 'F']
/** Clamp a rank so it cannot be better than `cap`. */
function capRank(r: Rank, cap: Rank): Rank {
  return ORDER.indexOf(r) >= ORDER.indexOf(cap) ? r : cap
}

export interface GradeResult {
  rank: Rank
  score: number // post-bufferbloat, pre-cap numeric (0..100)
  subscores: { ping: number; jitter: number; loss: number; throughput: number }
  bloatGrade: BloatGrade | null // null = bufferbloat could not be measured
  caps: string[] // which hard caps fired (for the UI "limiting factor")
}

export function grade(m: MetricInputs, bands: GenreBands): GradeResult {
  // STEP 1 — subscores
  const ping = lowerSubscore(m.ping_ms, bands.pingMs)
  const jitter = lowerSubscore(m.jitter_ms, bands.jitterMs)
  const dlSub = higherSubscore(m.dl_mbps, bands.downloadMbps)
  const ulSub = higherSubscore(m.ul_mbps, bands.uploadMbps)
  const throughput = 0.6 * dlSub + 0.4 * ulSub

  // Unmeasured loss must NOT score as a perfect 0%. Drop the loss term and
  // renormalize the remaining weights so the score isn't inflated.
  const lossMeasured = m.loss_pct != null
  const loss = lossMeasured ? lowerSubscore(m.loss_pct as number, bands.lossPct) : 100

  // STEP 2 — weighted base (latency/stability heavy, throughput light)
  const base = lossMeasured
    ? 0.34 * ping + 0.28 * jitter + 0.23 * loss + 0.15 * throughput
    : (0.34 * ping + 0.28 * jitter + 0.15 * throughput) / 0.77

  // STEP 3 — bufferbloat penalty (only when actually measured)
  const bloatMeasured = m.rtt_loaded != null
  const added = bloatMeasured ? Math.max(0, (m.rtt_loaded as number) - m.rtt_idle) : 0
  const penalty = bloatMeasured ? bloatPenalty(added) : 0
  const bg: BloatGrade | null = bloatMeasured ? bloatGrade(added) : null
  const score = Math.max(0, base - penalty)

  // STEP 5 — base letter
  let rank = scoreToLetter(score)

  // STEP 4 — hard caps (applied after letter lookup)
  const caps: string[] = []
  if (lossMeasured && (m.loss_pct as number) > bands.lossPct.bad) { rank = capRank(rank, 'C'); caps.push('packet loss') }
  if (m.ping_ms > bands.pingMs.bad) { rank = capRank(rank, 'C'); caps.push('ping') }
  if (m.jitter_ms > bands.jitterMs.bad) { rank = capRank(rank, 'B'); caps.push('jitter') }
  // Cap on the penalty-band F threshold (>200ms), matching the max penalty —
  // not the 6-band display grade (which only reads 'F' above 400ms).
  if (bloatMeasured && added > 200) { rank = capRank(rank, 'C'); caps.push('bufferbloat') }

  return { rank, score, subscores: { ping, jitter, loss, throughput }, bloatGrade: bg, caps }
}

export function rankToVerdict(rank: Rank): VerdictState {
  if (rank === 'S' || rank === 'A' || rank === 'B') return 'PLAYABLE'
  if (rank === 'C' || rank === 'D') return 'RISKY'
  return 'NO'
}

/**
 * Human "limiting factor" for a card: the lowest subscore that's actually a
 * problem, or the hard cap that fired. Returns null when everything is great.
 */
export function limitingFactor(r: GradeResult): string | null {
  if (r.caps.length) return r.caps[0]
  const subs: Array<[string, number]> = [
    ['ping', r.subscores.ping],
    ['jitter', r.subscores.jitter],
    ['packet loss', r.subscores.loss],
    ['throughput', r.subscores.throughput],
  ]
  subs.sort((a, b) => a[1] - b[1])
  return subs[0][1] < 70 ? subs[0][0] : null
}
