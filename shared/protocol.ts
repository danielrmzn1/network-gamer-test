// Single source of truth for the /net WebSocket contract and the assembled
// report shape. Imported by both the server WS layer and the client engine.
//
// Measurement vantage points (honest by construction):
//  - Region/game latency + jitter  : server-side TCP-connect from the USER's
//    machine to real region endpoints (the local server can't fake distance).
//  - Packet loss + UDP jitter       : server-side STUN binding requests over UDP
//    to public STUN servers — real internet UDP loss from the user's link.
//  - Throughput + bufferbloat       : browser <-> Cloudflare public speed
//    endpoints (real internet path), with a local-loopback fallback (labeled).

import type { Region } from './catalog.types'
import type { Rank, BloatGrade, VerdictState, GradeResult } from './grading'

export type PhaseName =
  | 'regions'
  | 'loss'
  | 'download'
  | 'upload'
  | 'bufferbloat'
  | 'compute'

// ───────────────────────── measurement result shapes ─────────────────────────

/** Stats for one TCP-probed target (a region proxy, baseline, or game endpoint). */
export interface ProbeStats {
  id: string
  host: string
  port: number
  ip: string | null
  samples: number
  received: number
  lossPct: number
  min: number | null
  avg: number | null
  median: number | null
  jitter: number | null
}

/** One STUN UDP loss/jitter measurement run (idle or under load). */
export interface StunLossData {
  available: boolean
  sent: number
  received: number
  lossPct: number
  rttMin: number | null
  rttAvg: number | null
  rttMedian: number | null
  jitter: number | null
  servers: { host: string; sent: number; received: number }[]
}

export type LossTag = 'idle' | 'loaded'

export interface LossSummary {
  method: 'stun-udp' | 'webrtc' | 'unavailable'
  idle: StunLossData | null
  loaded: StunLossData | null
  lossPct: number | null // headline: worst of idle/loaded; null = not measured
  jitterMs: number | null // UDP jitter (idle preferred)
}

export type ThroughputMethod = 'cloudflare' | 'loopback'
export interface ThroughputResult {
  meanMbps: number
  peakMbps: number
  samples: number
  bytes: number
  seconds: number
  method: ThroughputMethod
}

export interface BufferbloatResult {
  available: boolean // false when no loaded-latency samples were collected
  idleMedian: number
  loadedMedianDown: number
  loadedMedianUp: number
  deltaDownMs: number
  deltaUpMs: number
  worstDeltaMs: number
  rpmIdle: number
  rpmLoaded: number
  grade: BloatGrade | null
}

export interface GameVerdict extends GradeResult {
  gameId: string
  name: string
  genre: string
  state: VerdictState
  reason: string | null
}

export interface NetReport {
  startedAt: number
  region: Region
  selectedGameId: string
  regions: ProbeStats[] // per-region TCP ping sweep (the heatmap)
  selectedPing: ProbeStats | null // chosen region's entry — headline ping/jitter
  download: ThroughputResult | null
  upload: ThroughputResult | null
  bufferbloat: BufferbloatResult | null
  loss: LossSummary | null
  overallRank: Rank | null
  verdicts: GameVerdict[]
}

// ───────────────────────────── WS message unions ─────────────────────────────

export interface ProbeTarget { id: string; host: string; port: number }

export type ClientMessage =
  | { type: 'probe:start'; targets: ProbeTarget[]; count?: number; timeoutMs?: number; gapMs?: number }
  | { type: 'loss:start'; tag: LossTag; count?: number; ratePps?: number; timeoutMs?: number }
  | { type: 'session:abort' }

export type ServerMessage =
  | { type: 'hello'; sessionId: string; caps: { stun: boolean } }
  | { type: 'probe:progress'; id: string; sample: number; rttMs: number | null }
  | { type: 'probe:result'; stats: ProbeStats }
  | { type: 'probe:done' }
  | { type: 'loss:progress'; tag: LossTag; sent: number; received: number }
  | { type: 'loss:result'; tag: LossTag; data: StunLossData }
  | { type: 'error'; message: string }
