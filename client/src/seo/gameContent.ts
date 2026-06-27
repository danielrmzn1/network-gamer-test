import { GAME_BY_ID, gameRegions } from '@shared/catalog'
import { REGION_BY_ID } from '@shared/regions'
import { GENRE_BANDS } from '@shared/thresholds'
import type { GenreBands } from '@shared/thresholds.types'
import { SITE_URL } from './config'

export interface GameFaq {
  q: string
  a: string
}

export interface GamePageData {
  id: string
  name: string
  genre: string
  publisher: string
  path: string
  title: string
  description: string
  lead: string
  bands: GenreBands
  regions: { label: string; metro: string }[]
  faqs: GameFaq[]
  jsonLd: object[]
}

/**
 * Builds a per-game "ping test" content page from the single source of truth
 * (catalog + genre thresholds). Every number is the same one the live tester
 * grades against, so the page is internally consistent and genuinely useful —
 * not thin/boilerplate. Returns null for an unknown game id.
 */
export function buildGamePage(id: string): GamePageData | null {
  const game = GAME_BY_ID[id]
  if (!game) return null

  const bands = GENRE_BANDS[game.genre]
  const path = `/${id}-ping-test`
  const regions = gameRegions(id).map((r) => {
    const info = REGION_BY_ID[r]
    return { label: info.label, metro: info.metro }
  })

  const title = `${game.name} Ping Test — Latency, Jitter & Packet Loss by Region | FRAGRATE`
  const description =
    `Test your ${game.name} ping, jitter, packet loss and bufferbloat to real game regions. ` +
    `A good ${game.name} ping is under ${bands.pingMs.good} ms — see the full per-region playability breakdown.`

  const lead =
    `A good ping for ${game.name} (${game.genre}) is under ${bands.pingMs.good} ms — ideally below ` +
    `${bands.pingMs.great} ms. Around ${bands.pingMs.ok} ms is the playable ceiling, and past roughly ` +
    `${bands.pingMs.bad} ms it's effectively unplayable. FRAGRATE measures your real ping, jitter, packet ` +
    `loss and bufferbloat to the regions ${game.name} runs in and returns a per-game Playable / Risky / No-go verdict.`

  const faqs: GameFaq[] = [
    {
      q: `What is a good ping for ${game.name}?`,
      a:
        `Aim for under ${bands.pingMs.good} ms; under ${bands.pingMs.great} ms is optimal for ${game.name}. ` +
        `Up to ${bands.pingMs.ok} ms is the playable ceiling, and above about ${bands.pingMs.bad} ms ${game.name} feels laggy.`,
    },
    {
      q: `How much packet loss can ${game.name} tolerate?`,
      a:
        `Keep packet loss under ${bands.lossPct.good}%. Between ${bands.lossPct.good}% and ${bands.lossPct.ok}% is ` +
        `borderline; above ${bands.lossPct.bad}% ${game.name} is effectively unplayable.`,
    },
    {
      q: `Does jitter matter for ${game.name}?`,
      a:
        `Yes — keep jitter under ${bands.jitterMs.good} ms for ${game.name} (${game.genre}). Above ` +
        `${bands.jitterMs.bad} ms you get inconsistent hit registration and rubber-banding even when average ping looks fine.`,
    },
    {
      q: `How much internet speed does ${game.name} need?`,
      a:
        `Surprisingly little — about ${bands.downloadMbps.ok}–${bands.downloadMbps.good} Mbps down and ` +
        `${bands.uploadMbps.ok}–${bands.uploadMbps.good} Mbps up is plenty. Latency, jitter and packet loss decide ` +
        `playability far more than raw speed.`,
    },
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
      { '@type': 'ListItem', position: 2, name: `${game.name} Ping Test`, item: `${SITE_URL}${path}` },
    ],
  }

  return {
    id,
    name: game.name,
    genre: game.genre,
    publisher: game.publisher,
    path,
    title,
    description,
    lead,
    bands,
    regions,
    faqs,
    jsonLd: [faqLd, breadcrumbLd],
  }
}
