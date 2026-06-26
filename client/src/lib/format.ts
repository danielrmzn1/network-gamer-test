export function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(decimals)
}

/** Log-scaled bar fill (0..100%) so 1 Mbps and 1 Gbps both read well. */
export function mbpsBarPct(mbps: number): number {
  const v = Math.max(0, mbps)
  return Math.min(100, (Math.log10(v + 1) / Math.log10(1001)) * 100)
}

export function fmtMbps(mbps: number | null | undefined): string {
  if (mbps == null || !Number.isFinite(mbps)) return '—'
  if (mbps >= 100) return mbps.toFixed(0)
  if (mbps >= 10) return mbps.toFixed(1)
  return mbps.toFixed(2)
}
