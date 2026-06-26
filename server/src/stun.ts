import dgram from 'node:dgram'
import { randomBytes } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import type { StunLossData } from '../../shared/protocol'

// Measure real internet UDP packet loss + jitter by firing STUN binding requests
// at a public STUN server and counting binding-success responses. UDP needs no
// root, and STUN servers reliably echo our 12-byte transaction id so we can pair
// requests to replies and time each round-trip. This reflects the user's actual
// last-mile UDP path — the thing that governs in-game packet loss.
//
// We probe a SINGLE server for the whole run so loss/jitter/RTT all describe one
// coherent path. The server list is failover only (first that resolves wins) —
// mixing servers would contaminate jitter with inter-server baseline differences.

export interface StunServer { host: string; port: number }

export const DEFAULT_STUN_SERVERS: StunServer[] = [
  { host: 'stun.l.google.com', port: 19302 },
  { host: 'stun.cloudflare.com', port: 3478 },
  { host: 'stun1.l.google.com', port: 19302 },
]

const MAGIC_COOKIE = 0x2112a442

function makeBindingRequest(): { buf: Buffer; key: string } {
  const tx = randomBytes(12)
  const buf = Buffer.alloc(20)
  buf.writeUInt16BE(0x0001, 0) // Binding Request
  buf.writeUInt16BE(0, 2) // length 0
  buf.writeUInt32BE(MAGIC_COOKIE, 4)
  tx.copy(buf, 8)
  return { buf, key: tx.toString('hex') }
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

interface Outstanding { sentAt: number }

export async function stunProbe(opts: {
  servers?: StunServer[]
  count?: number
  ratePps?: number
  timeoutMs?: number
  signal?: AbortSignal
  onProgress?: (sent: number, received: number) => void
}): Promise<StunLossData> {
  const servers = opts.servers ?? DEFAULT_STUN_SERVERS
  const count = opts.count ?? 200
  const ratePps = opts.ratePps ?? 50
  const timeoutMs = opts.timeoutMs ?? 1500

  const unavailable = (): StunLossData => ({
    available: false, sent: 0, received: 0, lossPct: 0,
    rttMin: null, rttAvg: null, rttMedian: null, jitter: null, servers: [],
  })

  // Pick the first server that resolves; the rest are failover only.
  let target: { host: string; ip: string; port: number } | null = null
  for (const s of servers) {
    try {
      const { address } = await lookup(s.host, { family: 4 })
      target = { host: s.host, ip: address, port: s.port }
      break
    } catch {
      /* try next */
    }
  }
  if (!target || opts.signal?.aborted) return unavailable()
  const dst = target

  const socket = dgram.createSocket('udp4')
  const outstanding = new Map<string, Outstanding>()
  const rtts: number[] = [] // arrival order — jitter is measured on this
  let sent = 0
  let received = 0

  return await new Promise<StunLossData>((resolve) => {
    let settled = false
    const onAbort = (): void => finish()
    const finish = (): void => {
      if (settled) return
      settled = true
      opts.signal?.removeEventListener('abort', onAbort)
      try { socket.close() } catch { /* noop */ }

      // Jitter MUST be computed on temporal arrival order (not sorted), else it
      // telescopes to (max−min)/(n−1).
      let jitterSum = 0
      for (let i = 1; i < rtts.length; i++) jitterSum += Math.abs(rtts[i] - rtts[i - 1])
      const jitter = rtts.length > 1 ? jitterSum / (rtts.length - 1) : rtts.length === 1 ? 0 : null
      const sorted = [...rtts].sort((a, b) => a - b)
      const avg = rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null

      resolve({
        available: sent > 0,
        sent,
        received,
        lossPct: sent > 0 ? ((sent - received) / sent) * 100 : 0,
        rttMin: sorted.length ? sorted[0] : null,
        rttAvg: avg,
        rttMedian: median(sorted),
        jitter,
        servers: [{ host: dst.host, sent, received }],
      })
    }

    if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true })

    socket.on('message', (msg) => {
      if (msg.length < 20) return
      if (msg.readUInt16BE(0) !== 0x0101) return // not a binding success
      const key = msg.subarray(8, 20).toString('hex')
      const rec = outstanding.get(key)
      if (!rec) return
      outstanding.delete(key)
      received++
      rtts.push(performance.now() - rec.sentAt)
      opts.onProgress?.(sent, received)
    })
    socket.on('error', () => finish())

    socket.bind(() => {
      const intervalMs = 1000 / ratePps
      const startedAt = performance.now()
      let i = 0
      const tick = (): void => {
        if (settled || opts.signal?.aborted) { finish(); return }
        // Drift-free pacing: send all probes whose scheduled time has passed.
        while (i < count && performance.now() - startedAt >= i * intervalMs) {
          const { buf, key } = makeBindingRequest()
          outstanding.set(key, { sentAt: performance.now() })
          sent++
          socket.send(buf, dst.port, dst.ip, () => { /* ignore send errors */ })
          i++
          opts.onProgress?.(sent, received)
        }
        if (i < count) {
          setTimeout(tick, Math.max(1, intervalMs))
        } else {
          // All sent; wait one timeout window for stragglers, then finish.
          setTimeout(finish, timeoutMs)
        }
      }
      tick()
    })
  })
}
