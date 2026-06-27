import { GAME_BY_ID, gameRegions } from '@shared/catalog'
import { REGION_BY_ID } from '@shared/regions'
import { GENRE_BANDS } from '@shared/thresholds'
import type { GenreBands } from '@shared/thresholds.types'
import { genreLabel, type Lang } from '../i18n'
import { SITE_URL } from './config'

export type Variant = 'ping-test' | 'good-ping' | 'packet-loss'
export const VARIANTS: Variant[] = ['ping-test', 'good-ping', 'packet-loss']

function baseSlug(id: string, v: Variant): string {
  switch (v) {
    case 'ping-test':
      return `/${id}-ping-test`
    case 'good-ping':
      return `/good-ping-for-${id}`
    case 'packet-loss':
      return `/${id}-packet-loss-test`
  }
}

/** Root-relative URL for a game × variant page in a given locale (es is prefixed). */
export function variantPath(id: string, v: Variant, lang: Lang = 'en'): string {
  const s = baseSlug(id, v)
  return lang === 'es' ? `/es${s}` : s
}

export interface GameFaq {
  q: string
  a: string
}
export interface FixStep {
  title: string
  body: string
}
export interface RelatedLink {
  label: string
  path: string
}
export interface Alternate {
  hreflang: string
  path: string
}
export interface GameLabels {
  thresholdsHeading: string
  fixHeading: string
  regionsHeading: string
  measureHeading: string
  measureBody: string
  faqHeading: string
  relatedHeading: string
  navRun: string
  cta: string
  table: { metric: string; optimal: string; good: string; playableMax: string; nogo: string }
}

export interface GamePageData {
  id: string
  name: string
  genre: string
  publisher: string
  variant: Variant
  lang: Lang
  path: string
  alternates: Alternate[]
  title: string
  description: string
  h1: string
  lead: string
  bands: GenreBands
  regions: { label: string; metro: string }[]
  showRegions: boolean
  showTable: boolean
  showNote: boolean
  fixSteps: FixStep[]
  faqs: GameFaq[]
  related: RelatedLink[]
  labels: GameLabels
  jsonLd: object[]
}

/**
 * Builds a per-game content page for one of three distinct variants
 * (ping-test / good-ping / packet-loss) in EN or ES. All prose is generated
 * from the genre thresholds the live tester grades against, so pages are
 * self-consistent and genuinely useful; each variant + locale has its own
 * title/H1/lead/FAQ. Returns null for an unknown game id.
 */
export function buildGamePage(id: string, variant: Variant, lang: Lang = 'en'): GamePageData | null {
  const game = GAME_BY_ID[id]
  if (!game) return null

  const b = GENRE_BANDS[game.genre]
  const name = game.name
  const genre = genreLabel(lang, game.genre)
  const tr = (en: string, es: string): string => (lang === 'es' ? es : en)
  const path = variantPath(id, variant, lang)

  const regions = gameRegions(id).map((r) => {
    const info = REGION_BY_ID[r]
    return { label: info.label, metro: info.metro }
  })

  // ── number-backed Q&As ──────────────────────────────────────────────────
  const faqGoodPing: GameFaq = {
    q: tr(`What is a good ping for ${name}?`, `¿Cuál es un buen ping para ${name}?`),
    a: tr(
      `Aim for under ${b.pingMs.good} ms; under ${b.pingMs.great} ms is optimal for ${name}. Up to ${b.pingMs.ok} ms is the playable ceiling, and above about ${b.pingMs.bad} ms ${name} feels laggy.`,
      `Apunta a menos de ${b.pingMs.good} ms; bajo ${b.pingMs.great} ms es óptimo para ${name}. Hasta ${b.pingMs.ok} ms es el límite jugable, y por encima de ~${b.pingMs.bad} ms ${name} se siente lento.`,
    ),
  }
  const faqLoss: GameFaq = {
    q: tr(`How much packet loss can ${name} tolerate?`, `¿Cuánta pérdida de paquetes tolera ${name}?`),
    a: tr(
      `Keep packet loss under ${b.lossPct.good}%. Between ${b.lossPct.good}% and ${b.lossPct.ok}% is borderline; above ${b.lossPct.bad}% ${name} is effectively unplayable.`,
      `Mantén la pérdida bajo ${b.lossPct.good}%. Entre ${b.lossPct.good}% y ${b.lossPct.ok}% es dudoso; por encima de ${b.lossPct.bad}% ${name} es prácticamente injugable.`,
    ),
  }
  const faqJitter: GameFaq = {
    q: tr(`Does jitter matter for ${name}?`, `¿Importa el jitter en ${name}?`),
    a: tr(
      `Yes — keep jitter under ${b.jitterMs.good} ms for ${name} (${genre}). Above ${b.jitterMs.bad} ms you get inconsistent hit registration and rubber-banding even when average ping looks fine.`,
      `Sí — mantén el jitter bajo ${b.jitterMs.good} ms para ${name} (${genre}). Por encima de ${b.jitterMs.bad} ms tendrás registro de impactos inconsistente y rubber-banding aunque el ping medio se vea bien.`,
    ),
  }
  const faqSpeed: GameFaq = {
    q: tr(`How much internet speed does ${name} need?`, `¿Cuánta velocidad de internet necesita ${name}?`),
    a: tr(
      `Surprisingly little — about ${b.downloadMbps.ok}–${b.downloadMbps.good} Mbps down and ${b.uploadMbps.ok}–${b.uploadMbps.good} Mbps up is plenty. Latency, jitter and packet loss decide playability far more than raw speed.`,
      `Sorprendentemente poca — unos ${b.downloadMbps.ok}–${b.downloadMbps.good} Mbps de bajada y ${b.uploadMbps.ok}–${b.uploadMbps.good} Mbps de subida bastan. La latencia, el jitter y la pérdida deciden la jugabilidad mucho más que la velocidad bruta.`,
    ),
  }
  const faqBufferbloat: GameFaq = {
    q: tr(
      `Why does ${name} lag when someone else is streaming?`,
      `¿Por qué ${name} va lento cuando alguien más ve streaming?`,
    ),
    a: tr(
      `That's bufferbloat — latency that piles up when your connection is saturated. A fast line can still spike to hundreds of ms under load, so ${name} stutters mid-fight. FRAGRATE measures latency-under-load to catch it.`,
      `Eso es bufferbloat — latencia que se acumula cuando tu conexión está saturada. Una línea rápida puede dispararse a cientos de ms bajo carga, así que ${name} se entrecorta en plena acción. FRAGRATE mide la latencia bajo carga para detectarlo.`,
    ),
  }

  // ── variant-specific copy ───────────────────────────────────────────────
  let title: string
  let description: string
  let h1: string
  let lead: string
  let faqs: GameFaq[]
  let fixSteps: FixStep[] = []
  let showRegions = true
  let showTable = true

  if (variant === 'ping-test') {
    title = tr(
      `${name} Ping Test — Latency, Jitter & Packet Loss by Region | FRAGRATE`,
      `Test de Ping de ${name} — Latencia, Jitter y Pérdida por Región | FRAGRATE`,
    )
    description = tr(
      `Test your ${name} ping, jitter, packet loss and bufferbloat to real game regions. A good ${name} ping is under ${b.pingMs.good} ms — see the full per-region playability breakdown.`,
      `Mide tu ping, jitter, pérdida de paquetes y bufferbloat de ${name} hacia regiones reales. Un buen ping para ${name} es menos de ${b.pingMs.good} ms — mira el desglose de jugabilidad por región.`,
    )
    h1 = tr(`${name} Ping Test`, `Test de Ping de ${name}`)
    lead = tr(
      `A good ping for ${name} (${genre}) is under ${b.pingMs.good} ms — ideally below ${b.pingMs.great} ms. Around ${b.pingMs.ok} ms is the playable ceiling, and past roughly ${b.pingMs.bad} ms it's effectively unplayable. FRAGRATE measures your real ping, jitter, packet loss and bufferbloat to the regions ${name} runs in and returns a per-game Playable / Risky / No-go verdict.`,
      `Un buen ping para ${name} (${genre}) es menos de ${b.pingMs.good} ms — idealmente bajo ${b.pingMs.great} ms. Cerca de ${b.pingMs.ok} ms es el límite jugable, y más allá de ~${b.pingMs.bad} ms es prácticamente injugable. FRAGRATE mide tu ping, jitter, pérdida y bufferbloat reales hacia las regiones donde corre ${name} y da un veredicto Jugable / Riesgoso / No apto.`,
    )
    faqs = [faqGoodPing, faqLoss, faqJitter, faqSpeed]
  } else if (variant === 'good-ping') {
    title = tr(
      `What Is a Good Ping for ${name}? (${b.pingMs.good} ms) | FRAGRATE`,
      `¿Cuál es un buen ping para ${name}? (${b.pingMs.good} ms) | FRAGRATE`,
    )
    description = tr(
      `A good ping for ${name} is under ${b.pingMs.good} ms (optimal under ${b.pingMs.great} ms). See the exact ping, jitter and packet-loss thresholds for ${name} and test yours free.`,
      `Un buen ping para ${name} es menos de ${b.pingMs.good} ms (óptimo bajo ${b.pingMs.great} ms). Mira los umbrales exactos de ping, jitter y pérdida de ${name} y prueba el tuyo gratis.`,
    )
    h1 = tr(`What is a good ping for ${name}?`, `¿Cuál es un buen ping para ${name}?`)
    lead = tr(
      `A good ping for ${name} (${genre}) is under ${b.pingMs.good} ms, and under ${b.pingMs.great} ms is optimal. ${b.pingMs.ok} ms is the highest still-playable ping; beyond about ${b.pingMs.bad} ms ${name} becomes frustrating. The table below is the exact ping, jitter and packet-loss bands ${name} is graded against.`,
      `Un buen ping para ${name} (${genre}) es menos de ${b.pingMs.good} ms, y bajo ${b.pingMs.great} ms es óptimo. ${b.pingMs.ok} ms es el ping jugable más alto; más allá de ~${b.pingMs.bad} ms ${name} se vuelve frustrante. La tabla muestra las bandas exactas de ping, jitter y pérdida con las que se evalúa ${name}.`,
    )
    faqs = [faqGoodPing, faqJitter, faqLoss, faqBufferbloat]
    showRegions = false
  } else {
    title = tr(
      `${name} Packet Loss Test & Fix — Stop Lag Spikes | FRAGRATE`,
      `Test de Pérdida de Paquetes de ${name} y Solución | FRAGRATE`,
    )
    description = tr(
      `Test ${name} packet loss and bufferbloat in your browser — no download. ${name} tolerates under ${b.lossPct.good}% loss; above ${b.lossPct.bad}% is unplayable. Plus a step-by-step fix checklist.`,
      `Mide la pérdida de paquetes y el bufferbloat de ${name} en tu navegador — sin descargas. ${name} tolera menos de ${b.lossPct.good}% de pérdida; más de ${b.lossPct.bad}% es injugable. Incluye guía para solucionarlo.`,
    )
    h1 = tr(`${name} Packet Loss Test`, `Test de Pérdida de Paquetes de ${name}`)
    lead = tr(
      `Packet loss is the top cause of ${name} lag spikes, missed hit-registration and rubber-banding. ${name} stays smooth under ${b.lossPct.good}% loss; ${b.lossPct.ok}% is borderline and above ${b.lossPct.bad}% it's effectively unplayable. Test your real UDP loss and bufferbloat below, then work through the fixes.`,
      `La pérdida de paquetes es la principal causa de tirones, fallos de registro y rubber-banding en ${name}. ${name} va fluido con menos de ${b.lossPct.good}% de pérdida; ${b.lossPct.ok}% es el límite y más de ${b.lossPct.bad}% es prácticamente injugable. Mide tu pérdida UDP y bufferbloat reales y sigue los pasos para arreglarlo.`,
    )
    faqs = [faqLoss, faqBufferbloat, faqJitter, faqGoodPing]
    fixSteps = [
      {
        title: tr('Use a wired Ethernet connection', 'Usa una conexión por cable (Ethernet)'),
        body: tr(
          `Wi-Fi is the most common source of packet loss and jitter. A cable to the router removes interference and is the single biggest fix for most ${name} players.`,
          `El Wi-Fi es la causa más común de pérdida de paquetes y jitter. Un cable al router elimina interferencias y es la mejor solución para la mayoría de jugadores de ${name}.`,
        ),
      },
      {
        title: tr('Enable SQM / QoS on your router', 'Activa SQM / QoS en tu router'),
        body: tr(
          'Smart Queue Management (fq_codel / CAKE) crushes bufferbloat — the lag that appears when the line is busy. Many routers expose this as "QoS" or "anti-bufferbloat".',
          'Smart Queue Management (fq_codel / CAKE) elimina el bufferbloat — la latencia que aparece con la línea ocupada. Muchos routers lo exponen como "QoS" o "anti-bufferbloat".',
        ),
      },
      {
        title: tr('Pick the nearest server region', 'Elige la región de servidor más cercana'),
        body: tr(
          `Switch ${name} to the closest region. A nearer datacenter means lower ping and fewer drops; see the region list on the ${name} ping test.`,
          `Cambia ${name} a la región más cercana. Un datacenter más próximo significa menos ping y menos caídas; mira la lista de regiones en el test de ping de ${name}.`,
        ),
      },
      {
        title: tr('Restart the gateway and rule out the line', 'Reinicia el router y descarta la línea'),
        body: tr(
          'Power-cycle the modem/router. If loss persists on Ethernet across servers, the problem is upstream — contact your ISP with the measured loss figures.',
          'Reinicia el módem/router. Si la pérdida persiste por cable en varios servidores, el problema es de tu proveedor — contáctalo con las cifras de pérdida medidas.',
        ),
      },
    ]
  }

  const relatedLabel = (v: Variant): string => {
    switch (v) {
      case 'ping-test':
        return tr(`${name} ping test`, `Test de ping de ${name}`)
      case 'good-ping':
        return tr(`Good ping for ${name}`, `Buen ping para ${name}`)
      case 'packet-loss':
        return tr(`${name} packet loss test`, `Test de pérdida de ${name}`)
    }
  }
  const related: RelatedLink[] = VARIANTS.filter((v) => v !== variant).map((v) => ({
    label: relatedLabel(v),
    path: variantPath(id, v, lang),
  }))

  const labels: GameLabels = {
    thresholdsHeading: tr(
      `Good ping, jitter & packet loss for ${name}`,
      `Buen ping, jitter y pérdida de paquetes para ${name}`,
    ),
    fixHeading: tr(`How to fix ${name} packet loss`, `Cómo arreglar la pérdida de paquetes en ${name}`),
    regionsHeading: tr(`${name} regions FRAGRATE checks`, `Regiones de ${name} que mide FRAGRATE`),
    measureHeading: tr('How FRAGRATE measures this', 'Cómo mide FRAGRATE'),
    measureBody: tr(
      `FRAGRATE measures ping and jitter as a TCP-handshake to a public endpoint in each game region, packet loss via UDP/WebRTC, and bufferbloat as the latency added while your line is saturated. Run it locally for true per-region game-server ping, or use the hosted browser test for ping, loss and bufferbloat.`,
      `FRAGRATE mide el ping y el jitter como un handshake TCP a un endpoint público en cada región del juego, la pérdida de paquetes por UDP/WebRTC, y el bufferbloat como la latencia añadida mientras tu línea está saturada. Ejecútalo localmente para el ping real por región, o usa el test en el navegador para ping, pérdida y bufferbloat.`,
    ),
    faqHeading: tr('FAQ', 'Preguntas frecuentes'),
    relatedHeading: tr(`More for ${name}`, `Más sobre ${name}`),
    navRun: tr('Run the test →', 'Ejecutar la prueba →'),
    cta: tr(`Run the live ${name} test →`, `Ejecuta la prueba de ${name} en vivo →`),
    table: {
      metric: tr('Metric', 'Métrica'),
      optimal: tr('Optimal', 'Óptimo'),
      good: tr('Good', 'Bueno'),
      playableMax: tr('Playable max', 'Máx. jugable'),
      nogo: tr('No-go', 'No apto'),
    },
  }

  const alternates: Alternate[] = [
    { hreflang: 'en', path: variantPath(id, variant, 'en') },
    { hreflang: 'es', path: variantPath(id, variant, 'es') },
    { hreflang: 'x-default', path: variantPath(id, variant, 'en') },
  ]

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'FRAGRATE', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: h1, item: `${SITE_URL}${path}` },
    ],
  }
  const jsonLd: object[] = [faqLd, breadcrumbLd]
  if (fixSteps.length) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: tr(`How to fix packet loss in ${name}`, `Cómo arreglar la pérdida de paquetes en ${name}`),
      step: fixSteps.map((st) => ({ '@type': 'HowToStep', name: st.title, text: st.body })),
    })
  }

  return {
    id,
    name,
    genre,
    publisher: game.publisher,
    variant,
    lang,
    path,
    alternates,
    title,
    description,
    h1,
    lead,
    bands: b,
    regions,
    showRegions,
    showTable,
    showNote: lang === 'en', // the genre note string is English-only
    fixSteps,
    faqs,
    related,
    labels,
    jsonLd,
  }
}
