import { randomUUID } from 'node:crypto'
import type { WebSocket } from 'ws'
import type {
  ClientMessage,
  ServerMessage,
  ProbeTarget,
  ProbeStats,
  LossTag,
} from '../../../shared/protocol'
import { pingEndpoint } from '../pinger'
import { stunProbe } from '../stun'

const PROBE_CONCURRENCY = 6

export class NetSession {
  readonly id = randomUUID()
  private closed = false
  private busy = false // one server-side measurement at a time
  private ac: AbortController | null = null

  constructor(private ws: WebSocket) {
    this.send({ type: 'hello', sessionId: this.id, caps: { stun: true } })
    ws.on('message', (data) => this.onMessage(data))
    ws.on('close', () => this.cleanup())
    ws.on('error', () => this.cleanup())
  }

  private send(msg: ServerMessage): void {
    if (this.closed) return
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg))
  }

  private onMessage(data: unknown): void {
    let msg: ClientMessage
    try {
      msg = JSON.parse(String(data)) as ClientMessage
    } catch {
      return
    }
    switch (msg.type) {
      case 'probe:start':
        if (this.busy) return // ignore overlapping runs (well-behaved client serializes)
        void this.runProbes(msg.targets, msg.count, msg.timeoutMs, msg.gapMs)
        break
      case 'loss:start':
        if (this.busy) return
        void this.runLoss(msg.tag, msg.count, msg.ratePps, msg.timeoutMs)
        break
      case 'session:abort':
        this.ac?.abort()
        break
    }
  }

  private async runProbes(
    targets: ProbeTarget[],
    count = 8,
    timeoutMs = 2000,
    gapMs = 60,
  ): Promise<void> {
    this.busy = true
    this.ac = new AbortController()
    const signal = this.ac.signal
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < targets.length && !signal.aborted && !this.closed) {
        const t = targets[next++]
        const stats = await pingEndpoint(t.host, t.port, {
          count,
          timeoutMs,
          gapMs,
          onSample: (sample, rttMs) =>
            this.send({ type: 'probe:progress', id: t.id, sample, rttMs }),
        })
        const out: ProbeStats = {
          id: t.id,
          host: stats.host,
          port: stats.port,
          ip: stats.ip,
          samples: stats.samples,
          received: stats.received,
          lossPct: stats.lossPct,
          min: stats.min,
          avg: stats.avg,
          median: stats.median,
          jitter: stats.jitter,
        }
        this.send({ type: 'probe:result', stats: out })
      }
    }
    try {
      await Promise.all(
        Array.from({ length: Math.min(PROBE_CONCURRENCY, targets.length) }, () => worker()),
      )
      this.send({ type: 'probe:done' })
    } finally {
      this.busy = false
    }
  }

  private async runLoss(tag: LossTag, count = 200, ratePps = 50, timeoutMs = 1500): Promise<void> {
    this.busy = true
    this.ac = new AbortController()
    try {
      const data = await stunProbe({
        count,
        ratePps,
        timeoutMs,
        signal: this.ac.signal,
        onProgress: (sent, received) => this.send({ type: 'loss:progress', tag, sent, received }),
      })
      this.send({ type: 'loss:result', tag, data })
    } finally {
      this.busy = false
    }
  }

  private cleanup(): void {
    if (this.closed) return
    this.closed = true
    this.ac?.abort()
  }
}
