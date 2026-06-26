import type { StunLossData } from '@shared/protocol'

// Browser-side packet loss for HOSTED mode (Cloudflare Worker — no Node server).
// Two RTCPeerConnections forced onto the Cloudflare TURN relay via
// iceTransportPolicy:'relay', so probes traverse the user's real last-mile UDP
// path (browser -> Cloudflare TURN edge -> browser). TURN creds come from the
// /api/turn Worker route. Returns StunLossData and NEVER throws: any failure
// (no TURN, ICE timeout) -> available:false, so the UI shows "run locally".

const unavailable = (): StunLossData => ({
  available: false, sent: 0, received: 0, lossPct: 0,
  rttMin: null, rttAvg: null, rttMedian: null, jitter: null, servers: [],
})

async function fetchTurn(): Promise<RTCIceServer[] | null> {
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 4000)
    const res = await fetch('/api/turn', { signal: ac.signal, cache: 'no-store' })
    clearTimeout(timer)
    if (!res.ok) return null
    const j = (await res.json()) as { iceServers?: RTCIceServer[] }
    return j.iceServers ?? null
  } catch {
    return null
  }
}

export interface BrowserLossOpts {
  count?: number // total sequenced probes (default 200)
  ratePps?: number // approx probes/sec; drives the inter-burst pacing
  timeoutMs?: number // ICE/relay connect budget (default 8000)
  onProgress?: (sent: number, received: number) => void
}

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export async function measureBrowserLoss(opts: BrowserLossOpts = {}): Promise<StunLossData> {
  const { count = 200, ratePps = 200, timeoutMs = 8000, onProgress } = opts

  const iceServers = await fetchTurn()
  // No TURN configured (or unreachable) -> unavailable so the UI degrades.
  if (!iceServers || iceServers.length === 0) return unavailable()

  const cfg: RTCConfiguration = { iceServers, iceTransportPolicy: 'relay' }
  let pc1: RTCPeerConnection | null = null
  let pc2: RTCPeerConnection | null = null

  try {
    pc1 = new RTCPeerConnection(cfg) // sender
    pc2 = new RTCPeerConnection(cfg) // receiver
    const sender = pc1
    const receiver = pc2

    // UDP-only ICE relay between the two PCs, in-page (no signaling server).
    const isUdp = (c: RTCIceCandidate): boolean => {
      let proto = (c.protocol || '').toLowerCase()
      if (!proto && c.candidate) proto = (c.candidate.split(' ')[2] ?? '').toLowerCase()
      return proto === 'udp'
    }
    sender.onicecandidate = (e) => {
      if (e.candidate && isUdp(e.candidate)) receiver.addIceCandidate(e.candidate).catch(() => {})
    }
    receiver.onicecandidate = (e) => {
      if (e.candidate && isUdp(e.candidate)) sender.addIceCandidate(e.candidate).catch(() => {})
    }

    // CRITICAL: ordered:false + maxRetransmits:0 => UDP-like, loss is truthful.
    const dc = sender.createDataChannel('probe', { ordered: false, maxRetransmits: 0 })

    const received = new Set<number>()
    const rtt: number[] = []
    let prevSample: number | null = null
    let jitter = 0 // RFC3550 J += (|D| - J)/16
    let sent = 0

    // pc2 echoes every probe straight back -> full round-trip measurement.
    receiver.ondatachannel = (e) => {
      const ch = e.channel
      ch.onmessage = (m) => {
        try {
          ch.send(m.data as string)
        } catch {
          /* channel closing */
        }
      }
    }

    // Echoes arriving back at pc1.
    dc.onmessage = (m) => {
      const now = performance.now()
      const [seqStr, tSentStr] = String(m.data).split(':')
      const seq = Number(seqStr)
      if (received.has(seq)) return // ignore rare dup
      received.add(seq)
      const sample = now - Number(tSentStr)
      rtt.push(sample)
      if (prevSample !== null) {
        const d = Math.abs(sample - prevSample)
        jitter += (d - jitter) / 16
      }
      prevSample = sample
      onProgress?.(sent, received.size)
    }

    // Open / connect with a hard budget -> reject on timeout.
    const opened = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ICE/relay timeout')), timeoutMs)
      dc.onopen = () => {
        clearTimeout(t)
        resolve()
      }
      dc.onerror = () => {
        clearTimeout(t)
        reject(new Error('DataChannel error'))
      }
    })

    // Establish the relay loopback entirely in-page.
    await sender.setLocalDescription(await sender.createOffer())
    await receiver.setRemoteDescription(sender.localDescription!)
    await receiver.setLocalDescription(await receiver.createAnswer())
    await sender.setRemoteDescription(receiver.localDescription!)

    await opened // throws on timeout -> caught below -> unavailable()

    // Send sequenced probes in bursts at ~ratePps.
    const batchSize = Math.max(1, Math.round(ratePps / 20)) // ~20 bursts/sec
    const batchWaitMs = 50
    for (let base = 0; base < count; base += batchSize) {
      for (let i = base; i < Math.min(count, base + batchSize); i++) {
        try {
          dc.send(`${i}:${performance.now()}`)
          sent++
        } catch {
          /* channel backpressure/closing */
        }
      }
      await new Promise((r) => setTimeout(r, batchWaitMs))
    }

    // Drain: let late echoes land before scoring (reordering is NOT loss).
    await new Promise((r) => setTimeout(r, 3000))

    const recvCount = received.size
    const lossPct = sent ? ((sent - recvCount) / sent) * 100 : 0

    return {
      available: true,
      sent,
      received: recvCount,
      lossPct,
      rttMin: rtt.length ? Math.min(...rtt) : null,
      rttAvg: rtt.length ? rtt.reduce((a, b) => a + b, 0) / rtt.length : null,
      rttMedian: median(rtt),
      jitter: rtt.length > 1 ? jitter : null,
      servers: [{ host: 'turn.cloudflare.com', sent, received: recvCount }],
    }
  } catch {
    // ICE timeout, DataChannel error, or anything else -> graceful fallback.
    return unavailable()
  } finally {
    try {
      pc1?.close()
    } catch {
      /* noop */
    }
    try {
      pc2?.close()
    } catch {
      /* noop */
    }
  }
}
