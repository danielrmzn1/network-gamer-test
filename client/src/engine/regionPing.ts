import type { ProbeStats } from '@shared/protocol'
import { REGIONS, type RegionInfo } from '@shared/regions'
import { mean, quantile, meanAbsDev } from './stats'

/**
 * Build a ProbeStats from a list of successful HTTPS-RTT samples. Mirrors the
 * server TCP pinger's math (server/src/pinger.ts) so hosted and local numbers
 * are computed identically. `samples` is the total attempted (for lossPct);
 * `rtts` holds only the successful ones. No `ip` (browser can't resolve it).
 */
export function regionStats(
  id: string,
  host: string,
  port: number,
  rtts: number[],
  samples: number,
): ProbeStats {
  const received = rtts.length
  if (received === 0) {
    return {
      id, host, port, ip: null, samples, received: 0, lossPct: 100,
      min: null, avg: null, median: null, jitter: null,
    }
  }
  return {
    id, host, port, ip: null, samples, received,
    lossPct: ((samples - received) / samples) * 100,
    min: Math.min(...rtts),
    avg: mean(rtts),
    median: quantile(rtts, 0.5),
    jitter: meanAbsDev(rtts),
  }
}

export type TimeOnce = (url: string, timeoutMs: number) => Promise<number | null>

/**
 * Time one HTTPS round-trip. CRITICAL: redirect:'manual' — ec2.<region>.amazonaws.com
 * 301s to aws.amazon.com; following it would make every region time the SAME host.
 * With redirect:'manual' the fetch resolves at the in-region 301 as an
 * `opaqueredirect` response (no body), giving a clean ~1-RTT sample on a warm
 * keep-alive connection (verified across regions in a real browser).
 *
 * mode MUST be 'cors' (the default), NOT 'no-cors': the Fetch standard forbids
 * redirect:'manual' with no-cors mode (no-cors requires redirect:'follow'), so
 * no-cors + manual throws synchronously on every call. cors + manual is the
 * standard idiom for timing a cross-origin redirect without following it; CORS
 * response headers aren't needed because an opaqueredirect is unreadable anyway.
 * Returns ms, or null on timeout/error.
 */
export const httpsTimeOnce: TimeOnce = async (url, timeoutMs) => {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  const start = performance.now()
  try {
    await fetch(url, { mode: 'cors', cache: 'no-store', redirect: 'manual', signal: ac.signal })
    return performance.now() - start
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface RegionPingOpts {
  count?: number // timed samples (default 7)
  timeoutMs?: number // per request (default 2000)
  onRegion?: (stats: ProbeStats) => void
}

/** Warm-up (discarded) + `count` timed samples on the reused connection. */
export async function measureRegion(
  info: RegionInfo,
  opts: RegionPingOpts = {},
  timeOnce: TimeOnce = httpsTimeOnce,
): Promise<ProbeStats> {
  const count = opts.count ?? 7
  const timeoutMs = opts.timeoutMs ?? 2000
  const base = `https://${info.host}/`

  await timeOnce(`${base}?_=warm`, timeoutMs) // warm-up: DNS+TCP+TLS, parks keep-alive

  const rtts: number[] = []
  for (let i = 0; i < count; i++) {
    const rtt = await timeOnce(`${base}?_=${i}`, timeoutMs)
    if (rtt != null) rtts.push(rtt)
  }
  return regionStats(info.region, info.host, info.port, rtts, count)
}

/** Probe all 13 regions in parallel; calls opts.onRegion as each completes. */
export async function measureAllRegions(
  opts: RegionPingOpts = {},
  timeOnce: TimeOnce = httpsTimeOnce,
): Promise<Record<string, ProbeStats>> {
  const entries = await Promise.all(
    REGIONS.map(async (info) => {
      const stats = await measureRegion(info, opts, timeOnce)
      opts.onRegion?.(stats)
      return [info.region, stats] as const
    }),
  )
  return Object.fromEntries(entries)
}
