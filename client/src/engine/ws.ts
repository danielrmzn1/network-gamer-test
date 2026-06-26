import type {
  ClientMessage,
  ServerMessage,
  ProbeStats,
  ProbeTarget,
  StunLossData,
  LossTag,
} from '@shared/protocol'

const OP_TIMEOUT_MS = 30000

interface PendingOp {
  handler: (ev: MessageEvent) => void
  reject: (e: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Typed client for the /net measurement WebSocket. Wraps the protocol in
 * promise-returning helpers. Every in-flight op is tracked so that a socket
 * close/error (or a server `error` message, or a timeout) REJECTS the pending
 * promise — otherwise a dropped connection would wedge the whole test forever.
 */
export class NetSocket {
  private ws: WebSocket
  readyPromise: Promise<void>
  caps: { stun: boolean } = { stun: false }
  sessionId = ''
  private pending = new Set<PendingOp>()

  constructor() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    this.ws = new WebSocket(`${proto}://${location.host}/net`)
    this.readyPromise = new Promise((resolve, reject) => {
      const onHello = (ev: MessageEvent): void => {
        const msg = JSON.parse(ev.data) as ServerMessage
        if (msg.type === 'hello') {
          this.sessionId = msg.sessionId
          this.caps = msg.caps
          this.ws.removeEventListener('message', onHello)
          resolve()
        }
      }
      this.ws.addEventListener('message', onHello)
      this.ws.addEventListener('error', () => reject(new Error('WebSocket error')))
      this.ws.addEventListener('close', () => {
        if (this.sessionId === '') reject(new Error('WebSocket closed before hello'))
      })
    })
    // Any socket failure rejects every pending probe/loss op.
    this.ws.addEventListener('close', () => this.failAll('WebSocket closed during measurement'))
    this.ws.addEventListener('error', () => this.failAll('WebSocket error during measurement'))
  }

  ready(): Promise<void> {
    return this.readyPromise
  }

  private send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
  }

  private begin(op: PendingOp): void {
    this.pending.add(op)
    this.ws.addEventListener('message', op.handler)
  }

  private finish(op: PendingOp): void {
    clearTimeout(op.timer)
    this.ws.removeEventListener('message', op.handler)
    this.pending.delete(op)
  }

  private failAll(message: string): void {
    for (const op of [...this.pending]) {
      this.finish(op)
      op.reject(new Error(message))
    }
  }

  /** Run a TCP-connect probe sweep; resolves with one ProbeStats per target. */
  probe(
    targets: ProbeTarget[],
    opts: { count?: number; timeoutMs?: number; gapMs?: number; onProgress?: (id: string, sample: number, rttMs: number | null) => void; onResult?: (stats: ProbeStats) => void } = {},
  ): Promise<ProbeStats[]> {
    return new Promise<ProbeStats[]>((resolve, reject) => {
      const results: ProbeStats[] = []
      let op: PendingOp
      const handler = (ev: MessageEvent): void => {
        const msg = JSON.parse(ev.data) as ServerMessage
        if (msg.type === 'probe:progress') opts.onProgress?.(msg.id, msg.sample, msg.rttMs)
        else if (msg.type === 'probe:result') {
          results.push(msg.stats)
          opts.onResult?.(msg.stats)
        } else if (msg.type === 'probe:done') {
          this.finish(op)
          resolve(results)
        } else if (msg.type === 'error') {
          this.finish(op)
          reject(new Error(msg.message))
        }
      }
      op = { handler, reject, timer: setTimeout(() => { this.finish(op); reject(new Error('probe timed out')) }, OP_TIMEOUT_MS) }
      this.begin(op)
      this.send({ type: 'probe:start', targets, count: opts.count, timeoutMs: opts.timeoutMs, gapMs: opts.gapMs })
    })
  }

  /** Run one STUN UDP loss/jitter measurement (idle or loaded). */
  loss(
    tag: LossTag,
    opts: { count?: number; ratePps?: number; timeoutMs?: number; onProgress?: (sent: number, received: number) => void } = {},
  ): Promise<StunLossData> {
    return new Promise<StunLossData>((resolve, reject) => {
      let op: PendingOp
      const handler = (ev: MessageEvent): void => {
        const msg = JSON.parse(ev.data) as ServerMessage
        if (msg.type === 'loss:progress' && msg.tag === tag) opts.onProgress?.(msg.sent, msg.received)
        else if (msg.type === 'loss:result' && msg.tag === tag) {
          this.finish(op)
          resolve(msg.data)
        } else if (msg.type === 'error') {
          this.finish(op)
          reject(new Error(msg.message))
        }
      }
      op = { handler, reject, timer: setTimeout(() => { this.finish(op); reject(new Error('loss run timed out')) }, OP_TIMEOUT_MS) }
      this.begin(op)
      this.send({ type: 'loss:start', tag, count: opts.count, ratePps: opts.ratePps, timeoutMs: opts.timeoutMs })
    })
  }

  abort(): void {
    this.send({ type: 'session:abort' })
  }

  close(): void {
    try {
      this.ws.close()
    } catch {
      /* noop */
    }
  }
}
