import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rememberGame, preferredGame, rememberRegion, preferredRegion } from './prefs'

function mockStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size },
  } as unknown as Storage
}

beforeEach(() => {
  vi.stubGlobal('localStorage', mockStorage())
})

describe('game persistence', () => {
  it('round-trips a valid game id', () => {
    rememberGame('valorant')
    expect(preferredGame()).toBe('valorant')
  })
  it('returns null for an unknown stored game', () => {
    localStorage.setItem('fragrate-game', 'nonexistent')
    expect(preferredGame()).toBeNull()
  })
  it('returns null when nothing is stored', () => {
    expect(preferredGame()).toBeNull()
  })
  it('returns null for an inherited Object.prototype key (e.g. toString)', () => {
    localStorage.setItem('fragrate-game', 'toString')
    expect(preferredGame()).toBeNull()
  })
})

describe('region persistence', () => {
  it('round-trips a valid region', () => {
    rememberRegion('EU-West')
    expect(preferredRegion()).toBe('EU-West')
  })
  it('returns null for an invalid stored region', () => {
    localStorage.setItem('fragrate-region', 'Mars')
    expect(preferredRegion()).toBeNull()
  })
})
