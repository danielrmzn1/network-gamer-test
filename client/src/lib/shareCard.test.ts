import { describe, expect, it } from 'vitest'
import type { NetReport } from '@shared/protocol'
import { GAME_BY_ID } from '@shared/catalog'
import { buildShareData, buildShareText, shareUrl } from './shareCard'

const report: NetReport = {
  startedAt: 0,
  region: 'EU-Central',
  selectedGameId: 'valorant',
  regions: [],
  selectedPing: {
    id: 'EU-Central', host: 'x', port: 443, ip: null,
    samples: 10, received: 10, lossPct: 0,
    min: 11, avg: 12.4, median: 12, jitter: 1.3,
  },
  download: { meanMbps: 320.5, peakMbps: 400, samples: 40, bytes: 1, seconds: 8, method: 'cloudflare' },
  upload: { meanMbps: 41.2, peakMbps: 50, samples: 40, bytes: 1, seconds: 8, method: 'cloudflare' },
  bufferbloat: {
    available: true, idleMedian: 12, loadedMedianDown: 20, loadedMedianUp: 18,
    deltaDownMs: 8, deltaUpMs: 6, worstDeltaMs: 8, rpmIdle: 5000, rpmLoaded: 3000, grade: 'A',
  },
  loss: { method: 'stun-udp', idle: null, loaded: null, lossPct: 0.1, jitterMs: 1.1 },
  overallRank: 'A',
  verdicts: [{
    gameId: 'valorant', name: 'VALORANT', genre: 'Tactical FPS', state: 'PLAYABLE', reason: null,
    rank: 'S', score: 96, subscores: { ping: 100, jitter: 100, loss: 98, throughput: 100 },
    bloatGrade: 'A', caps: [],
  }],
}

describe('buildShareData', () => {
  it('flattens the selected game verdict and grades tones against its genre bands', () => {
    const d = buildShareData(report, GAME_BY_ID['valorant'], 'en')
    expect(d.rank).toBe('S') // the game verdict's rank, not overallRank
    expect(d.verdict).toBe('PLAYABLE')
    expect(d.regionLabel).toBe('EU Central')
    expect(d.pingMs).toBe(12)
    expect(d.pingTone).toBe('good') // 12 ms ≤ Tactical FPS good (30)
    expect(d.lossTone).toBe('good') // 0.1% = Tactical FPS good edge
  })

  it('falls back to overallRank when the game has no verdict entry', () => {
    const d = buildShareData(report, GAME_BY_ID['cs2'], 'en')
    expect(d.rank).toBe('A')
    expect(d.verdict).toBe('NO')
  })
})

describe('share text & url', () => {
  it('deep-links the tester with the game preselected, per locale', () => {
    expect(shareUrl({ lang: 'en', gameId: 'valorant' })).toBe('https://fragrate.net/?game=valorant')
    expect(shareUrl({ lang: 'es', gameId: 'valorant' })).toBe('https://fragrate.net/es?game=valorant')
    expect(shareUrl({ lang: 'pt', gameId: 'valorant' })).toBe('https://fragrate.net/pt?game=valorant')
  })

  it('localizes the share message and includes rank, game and url', () => {
    for (const lang of ['en', 'es', 'pt'] as const) {
      const text = buildShareText(buildShareData(report, GAME_BY_ID['valorant'], lang))
      expect(text).toContain('S')
      expect(text).toContain('VALORANT')
      expect(text).toContain(shareUrl({ lang, gameId: 'valorant' }))
    }
  })
})
