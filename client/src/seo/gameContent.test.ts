import { describe, expect, it } from 'vitest'
import { buildGamePage, variantPath, VARIANTS } from './gameContent'

describe('variantPath', () => {
  it('keeps EN at the root and prefixes other locales', () => {
    expect(variantPath('valorant', 'ping-test', 'en')).toBe('/valorant-ping-test')
    expect(variantPath('valorant', 'ping-test', 'es')).toBe('/es/valorant-ping-test')
    expect(variantPath('valorant', 'ping-test', 'pt')).toBe('/pt/valorant-ping-test')
  })

  it('builds the three variant slugs', () => {
    expect(variantPath('cs2', 'ping-test')).toBe('/cs2-ping-test')
    expect(variantPath('cs2', 'good-ping')).toBe('/good-ping-for-cs2')
    expect(variantPath('cs2', 'packet-loss')).toBe('/cs2-packet-loss-test')
  })
})

describe('buildGamePage', () => {
  it('returns null for an unknown game id', () => {
    expect(buildGamePage('not-a-game', 'ping-test', 'en')).toBeNull()
  })

  it.each(VARIANTS)('builds pt-BR content for %s with reciprocal hreflang', (variant) => {
    const d = buildGamePage('valorant', variant, 'pt')
    expect(d).not.toBeNull()
    expect(d!.path.startsWith('/pt/')).toBe(true)
    expect(d!.lang).toBe('pt')
    // localized prose, not the EN fallback
    expect(d!.title).not.toBe(buildGamePage('valorant', variant, 'en')!.title)
    // hreflang set covers every locale + x-default and points at per-locale paths
    const hreflangs = d!.alternates.map((a) => a.hreflang)
    expect(hreflangs).toEqual(['en', 'es', 'pt', 'x-default'])
    expect(d!.alternates.find((a) => a.hreflang === 'pt')!.path).toBe(d!.path)
  })

  it('threads genre threshold numbers into the localized copy', () => {
    const d = buildGamePage('lol', 'good-ping', 'pt')!
    // MOBA band: good ping = 45 ms — the number the tester actually grades against
    expect(d.lead).toContain('45 ms')
  })
})
