import { describe, it, expect } from 'vitest'
import { resolveStartup } from './startup'

const TOKYO = { lat: 35.69, lon: 139.69 }

describe('resolveStartup — game precedence', () => {
  it('deep-link query game wins over stored', () => {
    expect(resolveStartup({ queryGame: 'valorant', storedGame: 'cs2', storedRegion: null, coords: null }).gameId).toBe('valorant')
  })
  it('stored game is used when there is no query game', () => {
    expect(resolveStartup({ queryGame: null, storedGame: 'cs2', storedRegion: null, coords: null }).gameId).toBe('cs2')
  })
  it('an invalid query game is ignored, falling back to stored', () => {
    expect(resolveStartup({ queryGame: 'bogus', storedGame: 'cs2', storedRegion: null, coords: null }).gameId).toBe('cs2')
  })
  it('gameId is null when neither query nor stored is valid', () => {
    expect(resolveStartup({ queryGame: 'bogus', storedGame: 'also-bogus', storedRegion: null, coords: null }).gameId).toBeNull()
  })
})

describe('resolveStartup — region precedence', () => {
  it('a stored region valid for the game wins over geo', () => {
    const r = resolveStartup({ queryGame: 'valorant', storedGame: null, storedRegion: 'EU-West', coords: TOKYO })
    expect(r.region).toBe('EU-West')
  })
  it('falls back to geo-nearest when the stored region is invalid for the game', () => {
    // 'lol' does not operate in ME-Central; Tokyo -> nearest lol region is Asia-Korea (Seoul)
    const r = resolveStartup({ queryGame: null, storedGame: 'lol', storedRegion: 'ME-Central', coords: TOKYO })
    expect(r.region).toBe('Asia-Korea')
  })
  it('region is null when there is no stored region and no coords', () => {
    expect(resolveStartup({ queryGame: null, storedGame: 'lol', storedRegion: null, coords: null }).region).toBeNull()
  })
})
