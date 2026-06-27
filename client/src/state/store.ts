import { useSyncExternalStore } from 'react'
import type {
  NetReport,
  ProbeStats,
  StunLossData,
  PhaseName,
  BufferbloatResult,
  ThroughputResult,
} from '@shared/protocol'
import type { Region } from '@shared/catalog.types'
import type { RunMode } from '../engine/mode'

export type Status = 'idle' | 'running' | 'done' | 'error'

export interface EngineState {
  status: Status
  mode: RunMode | 'unknown'
  phase: PhaseName | null
  phaseLabel: string
  progress: number // 0..1 overall
  selectedGameId: string
  selectedRegion: Region | null
  regions: Record<string, ProbeStats>
  liveLatency: number[] // rolling sparkline (idle + loaded RTTs)
  liveDownMbps: number
  liveUpMbps: number
  lossIdle: StunLossData | null
  lossLoaded: StunLossData | null
  download: ThroughputResult | null
  upload: ThroughputResult | null
  bufferbloat: BufferbloatResult | null
  // Raw bufferbloat inputs, kept so region/game re-selection can recompute
  // verdicts without re-running the test.
  idleMedian: number
  loadedDownMedian: number | null
  loadedUpMedian: number | null
  report: NetReport | null
  backendLabel: string
  error: string | null
}

const SPARK_MAX = 120

function initialState(selectedGameId: string): EngineState {
  return {
    status: 'idle',
    mode: 'unknown',
    phase: null,
    phaseLabel: '',
    progress: 0,
    selectedGameId,
    selectedRegion: null,
    regions: {},
    liveLatency: [],
    liveDownMbps: 0,
    liveUpMbps: 0,
    lossIdle: null,
    lossLoaded: null,
    download: null,
    upload: null,
    bufferbloat: null,
    idleMedian: 0,
    loadedDownMedian: null,
    loadedUpMedian: null,
    report: null,
    backendLabel: '',
    error: null,
  }
}

class EngineStore {
  private state: EngineState
  private listeners = new Set<() => void>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(defaultGameId: string, defaultRegion: Region | null = null) {
    this.state = { ...initialState(defaultGameId), selectedRegion: defaultRegion }
    this.subscribe = this.subscribe.bind(this)
    this.getSnapshot = this.getSnapshot.bind(this)
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot(): EngineState {
    return this.state
  }

  get value(): EngineState {
    return this.state
  }

  // Update state immediately (so getSnapshot is fresh) but throttle notifications
  // to ~10fps to keep repaints cheap during the high-frequency live phases.
  set(patch: Partial<EngineState>, immediate = false): void {
    this.state = { ...this.state, ...patch }
    if (immediate) {
      if (this.flushTimer != null) {
        clearTimeout(this.flushTimer)
        this.flushTimer = null
      }
      this.emit()
      return
    }
    if (this.flushTimer == null) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null
        this.emit()
      }, 100)
    }
  }

  pushLatency(rtt: number): void {
    const next = [...this.state.liveLatency, rtt]
    if (next.length > SPARK_MAX) next.splice(0, next.length - SPARK_MAX)
    this.set({ liveLatency: next })
  }

  putRegion(stats: ProbeStats): void {
    this.set({ regions: { ...this.state.regions, [stats.id]: stats } })
  }

  reset(gameId: string, region: Region | null): void {
    // preserve the detected run mode across a re-run
    this.state = { ...initialState(gameId), selectedRegion: region, mode: this.state.mode }
    this.emit()
  }

  private emit(): void {
    for (const fn of this.listeners) fn()
  }
}

export const store = new EngineStore('lol', 'LATAM-North')

export function useEngine(): EngineState {
  // getServerSnapshot (3rd arg) returns the same static idle state during the
  // SSG prerender and the client's first render, so hydration matches.
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
