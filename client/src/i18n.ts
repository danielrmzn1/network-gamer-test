import { useSyncExternalStore } from 'react'
import type { Genre } from '@shared/catalog.types'
import type { VerdictState } from '@shared/grading'
import type { PhaseName } from '@shared/protocol'
import type { Tone } from './lib/tone'

export type Lang = 'en' | 'es'

// ── reactive language store (persisted) ──────────────────────────────────────
function initial(): Lang {
  try {
    const v = localStorage.getItem('netpulse-lang')
    if (v === 'es' || v === 'en') return v
  } catch { /* ignore */ }
  return 'en'
}
let current: Lang = initial()
const listeners = new Set<() => void>()

export function setLang(l: Lang): void {
  if (l === current) return
  current = l
  try { localStorage.setItem('netpulse-lang', l) } catch { /* ignore */ }
  for (const fn of listeners) fn()
}
export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    () => current,
    () => current,
  )
}

// ── static strings ───────────────────────────────────────────────────────────
type Entry = { en: string; es: string }
const S = {
  tagline: { en: 'Gamer Network Report', es: 'Reporte de Red para Gamers' },
  primaryGame: { en: 'Primary game', es: 'Juego principal' },
  coreMetrics: { en: 'Core Metrics', es: 'Métricas' },
  canYouPlay: { en: 'Can You Play?', es: '¿Puedes Jugar?' },
  regionMap: { en: 'Region Latency Map', es: 'Mapa de Latencia por Región' },
  verdict: { en: 'Verdict', es: 'Veredicto' },
  runTest: { en: 'Run Test', es: 'Iniciar prueba' },
  runAgain: { en: 'Run Again', es: 'Repetir' },
  testing: { en: 'Testing…', es: 'Midiendo…' },
  throughputVia: { en: 'Throughput via', es: 'Throughput vía' },
  lossMethodLabel: { en: 'Loss method', es: 'Método de pérdida' },
  latencyTcp: { en: 'Latency = TCP handshake to region proxies', es: 'Latencia = handshake TCP a proxies de región' },
  gaugePing: { en: 'Ping', es: 'Ping' },
  gaugeJitter: { en: 'Jitter', es: 'Jitter' },
  gaugeLoss: { en: 'Loss', es: 'Pérdida' },
  download: { en: 'Download', es: 'Descarga' },
  upload: { en: 'Upload', es: 'Subida' },
  bufferbloat: { en: 'Bufferbloat', es: 'Bufferbloat' },
  latencyUnderLoad: { en: 'latency under load', es: 'latencia bajo carga' },
  couldntMeasure: { en: 'couldn’t measure under load', es: 'no se pudo medir bajo carga' },
  peak: { en: 'peak', es: 'máx' },
  latencyOverTime: { en: 'Latency over time', es: 'Latencia en el tiempo' },
  awaitingSamples: { en: 'awaiting samples', es: 'esperando muestras' },
  limitedBy: { en: 'Limited by', es: 'Limitado por' },
  allInRange: { en: 'All metrics in range', es: 'Todas las métricas en rango' },
  pending: { en: 'Pending', es: 'Pendiente' },
  runToEvaluate: { en: 'Run the test to evaluate', es: 'Ejecuta la prueba para evaluar' },
  heroRunning: { en: 'Running diagnostics', es: 'Ejecutando diagnóstico' },
  heroErrorLine: { en: 'Test couldn’t complete', es: 'La prueba no se completó' },
  heroErrorSub: { en: 'Something interrupted the measurement.', es: 'Algo interrumpió la medición.' },
  measuring: { en: 'Measuring your connection', es: 'Midiendo tu conexión' },
  idleSub: {
    en: 'Run a full network check — ping to real game regions, jitter, UDP packet loss and bufferbloat — and get a straight answer for every game, not just a speed number.',
    es: 'Ejecuta un análisis de red completo — ping a regiones reales de cada juego, jitter, pérdida de paquetes UDP y bufferbloat — y obtén una respuesta clara para cada juego, no solo un número de velocidad.',
  },
  hostedBadge: { en: 'Hosted demo', es: 'Demo en línea' },
  runLocallyTitle: { en: 'Per-game server ping', es: 'Ping por servidor de juego' },
  runLocallyBody: {
    en: 'Real ping and packet loss to each game’s regional servers need raw network access a browser can’t do. Run NETPULSE locally to unlock the full per-game, per-region report.',
    es: 'El ping y la pérdida reales a los servidores regionales de cada juego requieren acceso de red que el navegador no permite. Ejecuta NETPULSE localmente para el reporte completo por juego y región.',
  },
  runLocallyCta: { en: '⬇ How to run locally', es: '⬇ Cómo ejecutarlo localmente' },
  internetRtt: { en: 'internet RTT', es: 'RTT de Internet' },
  hostedApprox: { en: '(approx — run locally for true per-game ping)', es: '(aprox — ejecútalo localmente para el ping real por juego)' },
} satisfies Record<string, Entry>

export type StrKey = keyof typeof S
export function t(l: Lang, k: StrKey): string {
  return S[k][l]
}

// ── enum-driven helpers ──────────────────────────────────────────────────────
const GENRE: Record<Genre, Entry> = {
  'Tactical FPS': { en: 'Tactical FPS', es: 'FPS Táctico' },
  'Competitive FPS': { en: 'Competitive FPS', es: 'FPS Competitivo' },
  'Battle Royale': { en: 'Battle Royale', es: 'Battle Royale' },
  MOBA: { en: 'MOBA', es: 'MOBA' },
  Fighting: { en: 'Fighting', es: 'Pelea' },
  Racing: { en: 'Racing', es: 'Carreras' },
  MMORPG: { en: 'MMORPG', es: 'MMORPG' },
  'Real-time strategy': { en: 'Real-time strategy', es: 'Estrategia en tiempo real' },
  'Casual/Co-op': { en: 'Casual/Co-op', es: 'Casual/Co-op' },
}
export function genreLabel(l: Lang, g: Genre): string {
  return GENRE[g][l]
}

const VERDICT: Record<VerdictState, Entry> = {
  PLAYABLE: { en: 'Playable', es: 'Jugable' },
  RISKY: { en: 'Risky', es: 'Riesgoso' },
  NO: { en: 'No-go', es: 'No apto' },
}
export function verdictWord(l: Lang, s: VerdictState): string {
  return VERDICT[s][l]
}

const REASON: Record<string, Entry> = {
  ping: { en: 'ping', es: 'el ping' },
  jitter: { en: 'jitter', es: 'el jitter' },
  'packet loss': { en: 'packet loss', es: 'la pérdida de paquetes' },
  bufferbloat: { en: 'bufferbloat', es: 'el bufferbloat' },
  throughput: { en: 'throughput', es: 'el ancho de banda' },
}
export function reasonWord(l: Lang, r: string): string {
  return REASON[r]?.[l] ?? r
}

const TONE: Record<Exclude<Tone, 'neutral'>, Entry> = {
  good: { en: 'Optimal', es: 'Óptimo' },
  warn: { en: 'Marginal', es: 'Marginal' },
  bad: { en: 'Poor', es: 'Pobre' },
}
export function gaugeStateWord(l: Lang, tone: Tone): string {
  return tone === 'neutral' ? '' : TONE[tone][l]
}

const PHASE: Record<PhaseName, Entry> = {
  regions: { en: 'Mapping regions & latency', es: 'Midiendo regiones y latencia' },
  loss: { en: 'Measuring packet loss (UDP)', es: 'Midiendo pérdida de paquetes (UDP)' },
  download: { en: 'Download + bufferbloat', es: 'Descarga + bufferbloat' },
  upload: { en: 'Upload + bufferbloat', es: 'Subida + bufferbloat' },
  bufferbloat: { en: 'Bufferbloat', es: 'Bufferbloat' },
  compute: { en: 'Scoring', es: 'Calculando puntaje' },
}
export function phaseLabel(l: Lang, p: PhaseName): string {
  return PHASE[p][l]
}

const PHASE_SHORT: Record<string, Entry> = {
  regions: { en: 'Ping', es: 'Ping' },
  loss: { en: 'Loss', es: 'Pérdida' },
  download: { en: 'Down', es: 'Baj.' },
  upload: { en: 'Up', es: 'Sub.' },
  compute: { en: 'Score', es: 'Punt.' },
}
export function phaseShort(l: Lang, p: PhaseName): string {
  return PHASE_SHORT[p]?.[l] ?? p
}

// ── Hero sentence builders (return parts so the game name can be highlighted) ──
export function heroIdle(l: Lang): { pre: string; hl: string; post: string } {
  return l === 'es'
    ? { pre: '¿Tu conexión está ', hl: 'lista para jugar', post: '?' }
    : { pre: 'Is your line ', hl: 'game-ready', post: '?' }
}
export function heroVerdict(l: Lang, state: VerdictState): { pre: string; post: string } {
  if (l === 'es') {
    if (state === 'PLAYABLE') return { pre: 'Listo para ', post: '.' }
    if (state === 'RISKY') return { pre: 'Jugable, pero inestable para ', post: '.' }
    return { pre: 'Aún no listo para ', post: '.' }
  }
  if (state === 'PLAYABLE') return { pre: 'You’re cleared for ', post: '.' }
  if (state === 'RISKY') return { pre: 'Playable, but rough for ', post: '.' }
  return { pre: 'Not ready for ', post: ' right now.' }
}
export function weakPointText(l: Lang, reason: string | null): string {
  if (reason) {
    return l === 'es'
      ? `Tu punto débil es ${reasonWord('es', reason)}. `
      : `Your weak point is ${reasonWord('en', reason)}. `
  }
  return l === 'es'
    ? 'Todas las métricas clave están en rango para este juego. '
    : 'Every key metric is in range for this game. '
}
export function lossText(l: Lang, loss: number | null, fmt: (n: number | null, d?: number) => string): string {
  if (loss == null) return l === 'es' ? 'pérdida n/d' : 'packet loss n/a'
  return l === 'es' ? `${fmt(loss, 1)}% de pérdida` : `${fmt(loss, 1)}% packet loss`
}
export function noteBody(l: Lang, backend: string): string {
  return l === 'es'
    ? `La latencia es el tiempo de handshake TCP desde tu equipo a un endpoint público en la región real de cada juego — un proxy de ping sin permisos de root que confirma alcanzabilidad. La pérdida de paquetes y el jitter UDP provienen de sondas STUN/UDP a servidores STUN públicos (UDP real de Internet). El throughput y el bufferbloat se miden contra los endpoints públicos de ${backend}. Los veredictos aplican los umbrales por género de cada juego a tu conexión medida.`
    : `Latency is the TCP-handshake time from your machine to a public endpoint in each game’s real datacenter region — a root-free, reachability-confirming ping proxy. Packet loss & UDP jitter come from STUN/UDP probes to public STUN servers (real internet UDP). Throughput & bufferbloat run against ${backend}’s public speed endpoints. Verdicts apply each game’s genre-specific thresholds to your measured connection.`
}
export const noteTitle = { en: 'How to read this.', es: 'Cómo leer esto.' }
