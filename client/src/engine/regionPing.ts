import type { ProbeStats } from '@shared/protocol'
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
