import { createContext, useContext, type ReactNode } from 'react'
import type { Genre } from '@shared/catalog.types'
import type { VerdictState } from '@shared/grading'
import type { PhaseName } from '@shared/protocol'
import type { Tone } from './lib/tone'
import type { RunMode } from './engine/mode'

export type Lang = 'en' | 'es' | 'pt'

/** Root-relative tester path for a locale ('/' = en, '/es', '/pt'). */
export function homePath(l: Lang): string {
  return l === 'en' ? '/' : `/${l}`
}

// ── locale (URL-driven) ──────────────────────────────────────────────────────
// The active locale comes from the route: there is one prerendered HTML document
// per locale ('/' = en, '/es/' = es, '/pt/' = pt), provided via <LangProvider>. Because the
// locale is fixed by the URL, the server prerender and the client's first render
// always agree, so hydration matches. localStorage is only a redirect hint for
// first-time visitors (see preferredLang / rememberLang).
const LS_KEY = 'fragrate-lang'

const LangContext = createContext<Lang>('en')

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export function useLang(): Lang {
  return useContext(LangContext)
}

/** Persist the user's explicit language choice so auto-redirect respects it. */
export function rememberLang(l: Lang): void {
  try { localStorage.setItem(LS_KEY, l) } catch { /* ignore */ }
}

/** First-visit preference: stored choice, else browser locale, else null (stay). */
export function preferredLang(): Lang | null {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === 'es' || v === 'en' || v === 'pt') return v
  } catch { /* ignore */ }
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
    // First match wins so the browser's language priority order is respected.
    for (const l of langs) {
      const low = l?.toLowerCase() ?? ''
      if (low.startsWith('es')) return 'es'
      if (low.startsWith('pt')) return 'pt'
    }
  } catch { /* ignore */ }
  return null
}

// ── static strings ───────────────────────────────────────────────────────────
type Entry = { en: string; es: string; pt: string }
const S = {
  tagline: { en: 'Gamer Network Report', es: 'Reporte de Red para Gamers', pt: 'Relatório de Rede para Gamers' },
  primaryGame: { en: 'Primary game', es: 'Juego principal', pt: 'Jogo principal' },
  coreMetrics: { en: 'Core Metrics', es: 'Métricas', pt: 'Métricas' },
  canYouPlay: { en: 'Can You Play?', es: '¿Puedes Jugar?', pt: 'Dá para Jogar?' },
  regionMap: { en: 'Region Latency Map', es: 'Mapa de Latencia por Región', pt: 'Mapa de Latência por Região' },
  verdict: { en: 'Verdict', es: 'Veredicto', pt: 'Veredito' },
  runTest: { en: 'Run Test', es: 'Iniciar prueba', pt: 'Iniciar teste' },
  runAgain: { en: 'Run Again', es: 'Repetir', pt: 'Repetir' },
  testing: { en: 'Testing…', es: 'Midiendo…', pt: 'Medindo…' },
  throughputVia: { en: 'Throughput via', es: 'Throughput vía', pt: 'Throughput via' },
  lossMethodLabel: { en: 'Loss method', es: 'Método de pérdida', pt: 'Método de perda' },
  latencyTcp: { en: 'Latency = TCP handshake to region proxies', es: 'Latencia = handshake TCP a proxies de región', pt: 'Latência = handshake TCP até proxies de região' },
  latencyHttps: { en: 'Latency = HTTPS RTT to region endpoints', es: 'Latencia = RTT HTTPS a endpoints de región', pt: 'Latência = RTT HTTPS até endpoints de região' },
  gaugePing: { en: 'Ping', es: 'Ping', pt: 'Ping' },
  gaugeJitter: { en: 'Jitter', es: 'Jitter', pt: 'Jitter' },
  gaugeLoss: { en: 'Loss', es: 'Pérdida', pt: 'Perda' },
  download: { en: 'Download', es: 'Descarga', pt: 'Download' },
  upload: { en: 'Upload', es: 'Subida', pt: 'Upload' },
  bufferbloat: { en: 'Bufferbloat', es: 'Bufferbloat', pt: 'Bufferbloat' },
  bufferbloatInfo: { en: 'What is bufferbloat?', es: '¿Qué es el bufferbloat?', pt: 'O que é bufferbloat?' },
  bufferbloatHelp: {
    en: 'Bufferbloat is the lag that shows up when your connection is busy. During a big download or upload, data piles up in a queue and your ping spikes — so games feel laggy even when your speed looks fast. A good grade means your connection stays responsive under load.',
    es: 'El bufferbloat es la demora que aparece cuando tu conexión está ocupada. Durante una descarga o subida grande, los datos se acumulan en una cola y tu ping se dispara — los juegos se sienten lentos aunque tu velocidad parezca alta. Una buena nota significa que tu conexión sigue respondiendo bajo carga.',
    pt: 'Bufferbloat é o atraso que aparece quando sua conexão está ocupada. Durante um download ou upload grande, os dados se acumulam em uma fila e seu ping dispara — os jogos ficam travados mesmo com a velocidade parecendo alta. Uma boa nota significa que sua conexão continua respondendo sob carga.',
  },
  latencyUnderLoad: { en: 'latency under load', es: 'latencia bajo carga', pt: 'latência sob carga' },
  couldntMeasure: { en: 'couldn’t measure under load', es: 'no se pudo medir bajo carga', pt: 'não foi possível medir sob carga' },
  peak: { en: 'peak', es: 'máx', pt: 'pico' },
  latencyOverTime: { en: 'Latency over time', es: 'Latencia en el tiempo', pt: 'Latência ao longo do tempo' },
  awaitingSamples: { en: 'awaiting samples', es: 'esperando muestras', pt: 'aguardando amostras' },
  limitedBy: { en: 'Limited by', es: 'Limitado por', pt: 'Limitado por' },
  allInRange: { en: 'All metrics in range', es: 'Todas las métricas en rango', pt: 'Todas as métricas dentro do esperado' },
  pending: { en: 'Pending', es: 'Pendiente', pt: 'Pendente' },
  runToEvaluate: { en: 'Run the test to evaluate', es: 'Ejecuta la prueba para evaluar', pt: 'Execute o teste para avaliar' },
  heroRunning: { en: 'Running diagnostics', es: 'Ejecutando diagnóstico', pt: 'Executando diagnóstico' },
  heroErrorLine: { en: 'Test couldn’t complete', es: 'La prueba no se completó', pt: 'O teste não foi concluído' },
  heroErrorSub: { en: 'Something interrupted the measurement.', es: 'Algo interrumpió la medición.', pt: 'Algo interrompeu a medição.' },
  measuring: { en: 'Measuring your connection', es: 'Midiendo tu conexión', pt: 'Medindo sua conexão' },
  idleSub: {
    en: 'Run a full network check — ping to real game regions, jitter, UDP packet loss and bufferbloat — and get a straight answer for every game, not just a speed number.',
    es: 'Ejecuta un análisis de red completo — ping a regiones reales de cada juego, jitter, pérdida de paquetes UDP y bufferbloat — y obtén una respuesta clara para cada juego, no solo un número de velocidad.',
    pt: 'Execute uma análise completa da rede — ping até as regiões reais de cada jogo, jitter, perda de pacotes UDP e bufferbloat — e receba uma resposta direta para cada jogo, não só um número de velocidade.',
  },
  hostedBadge: { en: 'Hosted', es: 'En línea', pt: 'Online' },
  hostedRegionNote: {
    en: 'Measured in your browser (HTTPS RTT + last-mile loss). Want raw-socket precision — exact UDP ping and true per-region loss? Run FRAGRATE locally.',
    es: 'Medido en tu navegador (RTT HTTPS + pérdida de última milla). ¿Quieres precisión de sockets crudos — ping UDP exacto y pérdida real por región? Ejecuta FRAGRATE localmente.',
    pt: 'Medido no seu navegador (RTT HTTPS + perda de última milha). Quer precisão de sockets brutos — ping UDP exato e perda real por região? Execute o FRAGRATE localmente.',
  },
  hostedRegionUnreachable: {
    en: 'Couldn’t reach the region endpoints from your browser. Run FRAGRATE locally for per-game-region ping.',
    es: 'No se pudo alcanzar los endpoints de región desde tu navegador. Ejecuta FRAGRATE localmente para el ping por región.',
    pt: 'Não foi possível alcançar os endpoints de região a partir do seu navegador. Execute o FRAGRATE localmente para ver o ping por região.',
  },
  gradedOn: { en: 'Verdict graded on', es: 'Veredicto evaluado en', pt: 'Veredito avaliado em' },
  tabOverview: { en: 'Overview', es: 'Resumen', pt: 'Resumo' },
  tabGames: { en: 'Games', es: 'Juegos', pt: 'Jogos' },
  tabRegions: { en: 'Regions', es: 'Regiones', pt: 'Regiões' },
  viewsLabel: { en: 'Views', es: 'Vistas', pt: 'Abas' },
  filterAll: { en: 'All', es: 'Todos', pt: 'Todos' },
  filterPlayable: { en: 'Playable', es: 'Jugables', pt: 'Jogáveis' },
  tapForDetail: { en: 'Tap a game for detail', es: 'Toca un juego para ver el detalle', pt: 'Toque em um jogo para ver detalhes' },
  share: { en: 'Share result', es: 'Compartir resultado', pt: 'Compartilhar resultado' },
  shareCopied: { en: 'Image copied', es: 'Imagen copiada', pt: 'Imagem copiada' },
  shareDownloaded: { en: 'Image downloaded', es: 'Imagen descargada', pt: 'Imagem baixada' },
  shareFailed: { en: 'Couldn’t share', es: 'No se pudo compartir', pt: 'Não foi possível compartilhar' },
} satisfies Record<string, Entry>

export type StrKey = keyof typeof S
export function t(l: Lang, k: StrKey): string {
  return S[k][l]
}

// ── enum-driven helpers ──────────────────────────────────────────────────────
const GENRE: Record<Genre, Entry> = {
  'Tactical FPS': { en: 'Tactical FPS', es: 'FPS Táctico', pt: 'FPS Tático' },
  'Competitive FPS': { en: 'Competitive FPS', es: 'FPS Competitivo', pt: 'FPS Competitivo' },
  'Battle Royale': { en: 'Battle Royale', es: 'Battle Royale', pt: 'Battle Royale' },
  MOBA: { en: 'MOBA', es: 'MOBA', pt: 'MOBA' },
  Fighting: { en: 'Fighting', es: 'Pelea', pt: 'Luta' },
  Racing: { en: 'Racing', es: 'Carreras', pt: 'Corrida' },
  MMORPG: { en: 'MMORPG', es: 'MMORPG', pt: 'MMORPG' },
  'Real-time strategy': { en: 'Real-time strategy', es: 'Estrategia en tiempo real', pt: 'Estratégia em tempo real' },
  'Casual/Co-op': { en: 'Casual/Co-op', es: 'Casual/Co-op', pt: 'Casual/Co-op' },
}
export function genreLabel(l: Lang, g: Genre): string {
  return GENRE[g][l]
}

const VERDICT: Record<VerdictState, Entry> = {
  PLAYABLE: { en: 'Playable', es: 'Jugable', pt: 'Jogável' },
  RISKY: { en: 'Risky', es: 'Riesgoso', pt: 'Arriscado' },
  NO: { en: 'No-go', es: 'No apto', pt: 'Inviável' },
}
export function verdictWord(l: Lang, s: VerdictState): string {
  return VERDICT[s][l]
}

const REASON: Record<string, Entry> = {
  ping: { en: 'ping', es: 'el ping', pt: 'o ping' },
  jitter: { en: 'jitter', es: 'el jitter', pt: 'o jitter' },
  'packet loss': { en: 'packet loss', es: 'la pérdida de paquetes', pt: 'a perda de pacotes' },
  bufferbloat: { en: 'bufferbloat', es: 'el bufferbloat', pt: 'o bufferbloat' },
  throughput: { en: 'throughput', es: 'el ancho de banda', pt: 'a banda' },
}
const REASON_HOSTED_LOSS: Entry = {
  en: 'your connection (last-mile loss)',
  es: 'tu conexión (pérdida de última milla)',
  pt: 'sua conexão (perda de última milha)',
}
export function reasonWord(l: Lang, r: string, mode?: 'local' | 'hosted'): string {
  if (mode === 'hosted' && r === 'packet loss') return REASON_HOSTED_LOSS[l]
  return REASON[r]?.[l] ?? r
}

const TONE: Record<Exclude<Tone, 'neutral'>, Entry> = {
  good: { en: 'Optimal', es: 'Óptimo', pt: 'Ótimo' },
  warn: { en: 'Marginal', es: 'Marginal', pt: 'Regular' },
  bad: { en: 'Poor', es: 'Pobre', pt: 'Ruim' },
}
export function gaugeStateWord(l: Lang, tone: Tone): string {
  return tone === 'neutral' ? '' : TONE[tone][l]
}

const PHASE: Record<PhaseName, Entry> = {
  regions: { en: 'Mapping regions & latency', es: 'Midiendo regiones y latencia', pt: 'Medindo regiões e latência' },
  loss: { en: 'Measuring packet loss (UDP)', es: 'Midiendo pérdida de paquetes (UDP)', pt: 'Medindo perda de pacotes (UDP)' },
  download: { en: 'Download + bufferbloat', es: 'Descarga + bufferbloat', pt: 'Download + bufferbloat' },
  upload: { en: 'Upload + bufferbloat', es: 'Subida + bufferbloat', pt: 'Upload + bufferbloat' },
  bufferbloat: { en: 'Bufferbloat', es: 'Bufferbloat', pt: 'Bufferbloat' },
  compute: { en: 'Scoring', es: 'Calculando puntaje', pt: 'Calculando pontuação' },
}
export function phaseLabel(l: Lang, p: PhaseName): string {
  return PHASE[p][l]
}

const PHASE_SHORT: Record<string, Entry> = {
  regions: { en: 'Ping', es: 'Ping', pt: 'Ping' },
  loss: { en: 'Loss', es: 'Pérdida', pt: 'Perda' },
  download: { en: 'Down', es: 'Baj.', pt: 'Down' },
  upload: { en: 'Up', es: 'Sub.', pt: 'Up' },
  compute: { en: 'Score', es: 'Punt.', pt: 'Nota' },
}
export function phaseShort(l: Lang, p: PhaseName): string {
  return PHASE_SHORT[p]?.[l] ?? p
}

// ── Hero sentence builders (return parts so the game name can be highlighted) ──
export function heroIdle(l: Lang): { pre: string; hl: string; post: string } {
  if (l === 'es') return { pre: '¿Tu conexión está ', hl: 'lista para jugar', post: '?' }
  if (l === 'pt') return { pre: 'Sua conexão está ', hl: 'pronta para jogar', post: '?' }
  return { pre: 'Is your line ', hl: 'game-ready', post: '?' }
}
export function heroVerdict(l: Lang, state: VerdictState): { pre: string; post: string } {
  if (l === 'es') {
    if (state === 'PLAYABLE') return { pre: 'Listo para ', post: '.' }
    if (state === 'RISKY') return { pre: 'Jugable, pero inestable para ', post: '.' }
    return { pre: 'Aún no listo para ', post: '.' }
  }
  if (l === 'pt') {
    if (state === 'PLAYABLE') return { pre: 'Pronto para ', post: '.' }
    if (state === 'RISKY') return { pre: 'Jogável, mas instável para ', post: '.' }
    return { pre: 'Ainda não está pronto para ', post: '.' }
  }
  if (state === 'PLAYABLE') return { pre: 'You’re cleared for ', post: '.' }
  if (state === 'RISKY') return { pre: 'Playable, but rough for ', post: '.' }
  return { pre: 'Not ready for ', post: ' right now.' }
}
export function weakPointText(l: Lang, reason: string | null, mode?: 'local' | 'hosted'): string {
  if (reason) {
    if (l === 'es') return `Tu punto débil es ${reasonWord('es', reason, mode)}. `
    if (l === 'pt') return `Seu ponto fraco é ${reasonWord('pt', reason, mode)}. `
    return `Your weak point is ${reasonWord('en', reason, mode)}. `
  }
  if (l === 'es') return 'Todas las métricas clave están en rango para este juego. '
  if (l === 'pt') return 'Todas as métricas-chave estão dentro do esperado para este jogo. '
  return 'Every key metric is in range for this game. '
}
export function lossText(l: Lang, loss: number | null, fmt: (n: number | null, d?: number) => string): string {
  if (loss == null) return l === 'es' ? 'pérdida n/d' : l === 'pt' ? 'perda n/d' : 'packet loss n/a'
  if (l === 'es') return `${fmt(loss, 1)}% de pérdida`
  if (l === 'pt') return `${fmt(loss, 1)}% de perda`
  return `${fmt(loss, 1)}% packet loss`
}
export function noteBody(l: Lang, backend: string, mode: RunMode | 'unknown'): string {
  if (mode === 'hosted') {
    if (l === 'es')
      return `La latencia por región es el RTT HTTPS desde tu navegador a un endpoint público en la región real de cada juego (algo por encima del ping UDP crudo). La pérdida de paquetes es la pérdida UDP de última milla medida por WebRTC vía Cloudflare TURN — es de tu conexión, no por región. El throughput y el bufferbloat se miden contra los endpoints públicos de ${backend}. Para ping UDP exacto y pérdida real por región, ejecuta FRAGRATE localmente.`
    if (l === 'pt')
      return `A latência por região é o RTT HTTPS do seu navegador até um endpoint público na região real de cada jogo (um pouco acima do ping UDP bruto). A perda de pacotes é a perda UDP de última milha medida por WebRTC via Cloudflare TURN — é da sua conexão, não por região. O throughput e o bufferbloat são medidos contra os endpoints públicos de ${backend}. Para ping UDP exato e perda real por região, execute o FRAGRATE localmente.`
    return `Per-region latency is the HTTPS RTT from your browser to a public endpoint in each game’s real datacenter region (somewhat above raw UDP ping). Packet loss is your last-mile UDP loss measured via WebRTC through Cloudflare TURN — it’s your connection’s loss, not per region. Throughput & bufferbloat run against ${backend}’s public speed endpoints. For exact UDP ping and true per-region loss, run FRAGRATE locally.`
  }
  if (l === 'es')
    return `La latencia es el tiempo de handshake TCP desde tu equipo a un endpoint público en la región real de cada juego — un proxy de ping sin permisos de root que confirma alcanzabilidad. La pérdida de paquetes y el jitter UDP provienen de sondas STUN/UDP a servidores STUN públicos (UDP real de Internet). El throughput y el bufferbloat se miden contra los endpoints públicos de ${backend}. Los veredictos aplican los umbrales por género de cada juego a tu conexión medida.`
  if (l === 'pt')
    return `A latência é o tempo de handshake TCP da sua máquina até um endpoint público na região real de cada jogo — um proxy de ping sem root que confirma alcançabilidade. A perda de pacotes e o jitter UDP vêm de sondas STUN/UDP a servidores STUN públicos (UDP real da internet). O throughput e o bufferbloat são medidos contra os endpoints públicos de ${backend}. Os vereditos aplicam os limites por gênero de cada jogo à sua conexão medida.`
  return `Latency is the TCP-handshake time from your machine to a public endpoint in each game’s real datacenter region — a root-free, reachability-confirming ping proxy. Packet loss & UDP jitter come from STUN/UDP probes to public STUN servers (real internet UDP). Throughput & bufferbloat run against ${backend}’s public speed endpoints. Verdicts apply each game’s genre-specific thresholds to your measured connection.`
}
export const noteTitle = { en: 'How to read this.', es: 'Cómo leer esto.', pt: 'Como ler isto.' }
