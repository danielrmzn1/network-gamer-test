import { GAME_BY_ID, gameRegions } from '@shared/catalog'
import { REGION_BY_ID } from '@shared/regions'
import { GENRE_BANDS } from '@shared/thresholds'
import type { GenreBands } from '@shared/thresholds.types'
import { SITE_URL } from './config'

export type Variant = 'ping-test' | 'good-ping' | 'packet-loss'
export const VARIANTS: Variant[] = ['ping-test', 'good-ping', 'packet-loss']

/** Root-relative URL for a game × variant page. */
export function variantPath(id: string, v: Variant): string {
  switch (v) {
    case 'ping-test':
      return `/${id}-ping-test`
    case 'good-ping':
      return `/good-ping-for-${id}`
    case 'packet-loss':
      return `/${id}-packet-loss-test`
  }
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

export interface GamePageData {
  id: string
  name: string
  genre: string
  publisher: string
  variant: Variant
  path: string
  title: string
  description: string
  h1: string
  lead: string
  bands: GenreBands
  regions: { label: string; metro: string }[]
  showRegions: boolean
  showTable: boolean
  fixSteps: FixStep[]
  faqs: GameFaq[]
  related: RelatedLink[]
  jsonLd: object[]
}

function relatedLabel(name: string, v: Variant): string {
  switch (v) {
    case 'ping-test':
      return `${name} ping test`
    case 'good-ping':
      return `Good ping for ${name}`
    case 'packet-loss':
      return `${name} packet loss test`
  }
}

/**
 * Builds a per-game content page for one of three deliberately distinct
 * variants (ping-test / good-ping / packet-loss). Every number comes from the
 * same genre thresholds the live tester grades against, so the pages are
 * internally consistent and genuinely useful — and each variant has its own
 * angle, copy, FAQ ordering and (for packet-loss) a fix checklist + HowTo
 * schema, so they don't read as near-duplicates. Returns null for an unknown id.
 */
export function buildGamePage(id: string, variant: Variant): GamePageData | null {
  const game = GAME_BY_ID[id]
  if (!game) return null

  const b = GENRE_BANDS[game.genre]
  const name = game.name
  const path = variantPath(id, variant)
  const regions = gameRegions(id).map((r) => {
    const info = REGION_BY_ID[r]
    return { label: info.label, metro: info.metro }
  })

  // Reusable, number-backed Q&As.
  const faqGoodPing: GameFaq = {
    q: `What is a good ping for ${name}?`,
    a:
      `Aim for under ${b.pingMs.good} ms; under ${b.pingMs.great} ms is optimal for ${name}. ` +
      `Up to ${b.pingMs.ok} ms is the playable ceiling, and above about ${b.pingMs.bad} ms ${name} feels laggy.`,
  }
  const faqLoss: GameFaq = {
    q: `How much packet loss can ${name} tolerate?`,
    a:
      `Keep packet loss under ${b.lossPct.good}%. Between ${b.lossPct.good}% and ${b.lossPct.ok}% is ` +
      `borderline; above ${b.lossPct.bad}% ${name} is effectively unplayable.`,
  }
  const faqJitter: GameFaq = {
    q: `Does jitter matter for ${name}?`,
    a:
      `Yes — keep jitter under ${b.jitterMs.good} ms for ${name} (${game.genre}). Above ` +
      `${b.jitterMs.bad} ms you get inconsistent hit registration and rubber-banding even when average ping looks fine.`,
  }
  const faqSpeed: GameFaq = {
    q: `How much internet speed does ${name} need?`,
    a:
      `Surprisingly little — about ${b.downloadMbps.ok}–${b.downloadMbps.good} Mbps down and ` +
      `${b.uploadMbps.ok}–${b.uploadMbps.good} Mbps up is plenty. Latency, jitter and packet loss decide ` +
      `playability far more than raw speed.`,
  }
  const faqBufferbloat: GameFaq = {
    q: `Why does ${name} lag when someone else is streaming?`,
    a:
      `That's bufferbloat — latency that piles up when your connection is saturated. A fast line can still ` +
      `spike to hundreds of ms under load, so ${name} stutters mid-fight. FRAGRATE measures latency-under-load to catch it.`,
  }

  let title: string
  let description: string
  let h1: string
  let lead: string
  let faqs: GameFaq[]
  let fixSteps: FixStep[] = []
  let showRegions = true
  let showTable = true

  if (variant === 'ping-test') {
    title = `${name} Ping Test — Latency, Jitter & Packet Loss by Region | FRAGRATE`
    description =
      `Test your ${name} ping, jitter, packet loss and bufferbloat to real game regions. ` +
      `A good ${name} ping is under ${b.pingMs.good} ms — see the full per-region playability breakdown.`
    h1 = `${name} Ping Test`
    lead =
      `A good ping for ${name} (${game.genre}) is under ${b.pingMs.good} ms — ideally below ${b.pingMs.great} ms. ` +
      `Around ${b.pingMs.ok} ms is the playable ceiling, and past roughly ${b.pingMs.bad} ms it's effectively ` +
      `unplayable. FRAGRATE measures your real ping, jitter, packet loss and bufferbloat to the regions ${name} ` +
      `runs in and returns a per-game Playable / Risky / No-go verdict.`
    faqs = [faqGoodPing, faqLoss, faqJitter, faqSpeed]
  } else if (variant === 'good-ping') {
    title = `What Is a Good Ping for ${name}? (${b.pingMs.good} ms) | FRAGRATE`
    description =
      `A good ping for ${name} is under ${b.pingMs.good} ms (optimal under ${b.pingMs.great} ms). ` +
      `See the exact ping, jitter and packet-loss thresholds for ${name} and test yours free.`
    h1 = `What is a good ping for ${name}?`
    lead =
      `A good ping for ${name} (${game.genre}) is under ${b.pingMs.good} ms, and under ${b.pingMs.great} ms is ` +
      `optimal. ${b.pingMs.ok} ms is the highest still-playable ping; beyond about ${b.pingMs.bad} ms ${name} ` +
      `becomes frustrating. The table below is the exact ping, jitter and packet-loss bands ${name} is graded against.`
    faqs = [faqGoodPing, faqJitter, faqLoss, faqBufferbloat]
    showRegions = false // thresholds-focused; differentiate from the ping-test page
  } else {
    title = `${name} Packet Loss Test & Fix — Stop Lag Spikes | FRAGRATE`
    description =
      `Test ${name} packet loss and bufferbloat in your browser — no download. ${name} tolerates under ` +
      `${b.lossPct.good}% loss; above ${b.lossPct.bad}% is unplayable. Plus a step-by-step fix checklist.`
    h1 = `${name} Packet Loss Test`
    lead =
      `Packet loss is the top cause of ${name} lag spikes, missed hit-registration and rubber-banding. ${name} ` +
      `stays smooth under ${b.lossPct.good}% loss; ${b.lossPct.ok}% is borderline and above ${b.lossPct.bad}% it's ` +
      `effectively unplayable. Test your real UDP loss and bufferbloat below, then work through the fixes.`
    faqs = [faqLoss, faqBufferbloat, faqJitter, faqGoodPing]
    fixSteps = [
      {
        title: 'Use a wired Ethernet connection',
        body: `Wi-Fi is the most common source of packet loss and jitter. A cable to the router removes interference and is the single biggest fix for most ${name} players.`,
      },
      {
        title: 'Enable SQM / QoS on your router',
        body: 'Smart Queue Management (fq_codel / CAKE) crushes bufferbloat — the lag that appears when the line is busy. Many routers expose this as "QoS" or "anti-bufferbloat".',
      },
      {
        title: 'Pick the nearest server region',
        body: `Switch ${name} to the closest region. A nearer datacenter means lower ping and fewer drops; see the region list on the ${name} ping test.`,
      },
      {
        title: 'Restart the gateway and rule out the line',
        body: 'Power-cycle the modem/router. If loss persists on Ethernet across servers, the problem is upstream — contact your ISP with the measured loss figures.',
      },
    ]
  }

  const related: RelatedLink[] = VARIANTS.filter((v) => v !== variant).map((v) => ({
    label: relatedLabel(name, v),
    path: variantPath(id, v),
  }))

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
      name: `How to fix packet loss in ${name}`,
      step: fixSteps.map((st) => ({ '@type': 'HowToStep', name: st.title, text: st.body })),
    })
  }

  return {
    id,
    name,
    genre: game.genre,
    publisher: game.publisher,
    variant,
    path,
    title,
    description,
    h1,
    lead,
    bands: b,
    regions,
    showRegions,
    showTable,
    fixSteps,
    faqs,
    related,
    jsonLd,
  }
}
