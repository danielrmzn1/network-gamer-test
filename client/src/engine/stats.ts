export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base]
}

/** Jitter = mean absolute difference between consecutive samples. */
export function meanAbsDev(xs: number[]): number {
  if (xs.length < 2) return 0
  let sum = 0
  for (let i = 1; i < xs.length; i++) sum += Math.abs(xs[i] - xs[i - 1])
  return sum / (xs.length - 1)
}

export function bytesToMbps(bytes: number, seconds: number): number {
  if (seconds <= 0) return 0
  return (bytes * 8) / 1e6 / seconds
}
