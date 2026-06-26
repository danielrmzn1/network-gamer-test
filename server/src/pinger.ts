import net from 'node:net'
import { lookup } from 'node:dns/promises'

/**
 * Root-free latency to a game/relay endpoint using TCP-connect timing.
 *
 * A full ICMP ping needs raw sockets (root). Instead we measure the time for a
 * TCP handshake to complete to a port the server actually listens on — that is
 * one network round-trip, so it is an accurate, privilege-free proxy for ping.
 *
 * Because the Node server runs on the *player's own machine*, this measures the
 * player's real path to the game servers, not some datacenter's path.
 */

export interface PingSample {
  rtt: number | null // ms, or null on timeout/refused/error
}

export interface PingStats {
  host: string
  port: number
  ip: string | null
  samples: number
  received: number
  lossPct: number
  min: number | null
  avg: number | null
  median: number | null
  max: number | null
  jitter: number | null // mean absolute deviation of consecutive RTTs (ms)
  error?: string
}

function connectOnce(ip: string, port: number, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint()
    let settled = false
    const socket = new net.Socket()
    const done = (rtt: number | null) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(rtt)
    }
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => {
      const rtt = Number(process.hrtime.bigint() - start) / 1e6
      done(rtt)
    })
    socket.once('timeout', () => done(null))
    socket.once('error', () => done(null))
    socket.connect({ host: ip, port })
  })
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base]
}

export async function pingEndpoint(
  host: string,
  port: number,
  opts: {
    count?: number
    timeoutMs?: number
    gapMs?: number
    onSample?: (sample: number, rtt: number | null) => void
  } = {},
): Promise<PingStats> {
  const count = opts.count ?? 8
  const timeoutMs = opts.timeoutMs ?? 2000
  const gapMs = opts.gapMs ?? 60

  let ip: string | null = null
  try {
    const res = await lookup(host)
    ip = res.address
  } catch {
    return {
      host, port, ip: null, samples: count, received: 0, lossPct: 100,
      min: null, avg: null, median: null, max: null, jitter: null,
      error: 'dns',
    }
  }

  const rtts: number[] = []
  let received = 0
  for (let i = 0; i < count; i++) {
    const rtt = await connectOnce(ip, port, timeoutMs)
    if (rtt !== null) {
      rtts.push(rtt)
      received++
    }
    opts.onSample?.(i, rtt)
    if (gapMs > 0 && i < count - 1) await new Promise((r) => setTimeout(r, gapMs))
  }

  if (rtts.length === 0) {
    return {
      host, port, ip, samples: count, received: 0, lossPct: 100,
      min: null, avg: null, median: null, max: null, jitter: null,
      error: 'unreachable',
    }
  }

  const sorted = [...rtts].sort((a, b) => a - b)
  const sum = rtts.reduce((a, b) => a + b, 0)
  const avg = sum / rtts.length

  // Jitter = mean absolute difference between consecutive samples.
  let jitterSum = 0
  for (let i = 1; i < rtts.length; i++) jitterSum += Math.abs(rtts[i] - rtts[i - 1])
  const jitter = rtts.length > 1 ? jitterSum / (rtts.length - 1) : 0

  return {
    host,
    port,
    ip,
    samples: count,
    received,
    lossPct: ((count - received) / count) * 100,
    min: sorted[0],
    avg,
    median: quantile(sorted, 0.5),
    max: sorted[sorted.length - 1],
    jitter,
  }
}
