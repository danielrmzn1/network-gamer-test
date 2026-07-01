import { describe, it, expect, afterEach, vi } from 'vitest'
import { nearestRegion, haversineKm } from './geo'
import { tzToCoords, detectCoords, detectNearestRegion, resetGeoCacheForTests } from './geo'
import { REGIONS } from '@shared/regions'
import type { Region } from '@shared/catalog.types'

const ALL: Region[] = REGIONS.map((r) => r.region)

describe('region coordinates', () => {
  it('every region has finite lat/lon', () => {
    for (const r of REGIONS) {
      expect(Number.isFinite(r.lat)).toBe(true)
      expect(Number.isFinite(r.lon)).toBe(true)
    }
  })
})

describe('haversineKm', () => {
  it('is ~0 for identical points and positive otherwise', () => {
    expect(haversineKm({ lat: 10, lon: 10 }, { lat: 10, lon: 10 })).toBeCloseTo(0)
    // London -> Frankfurt ~ 640 km
    expect(haversineKm({ lat: 51.51, lon: -0.13 }, { lat: 50.11, lon: 8.68 })).toBeGreaterThan(500)
  })
})

describe('nearestRegion', () => {
  it('maps a metro to its own region', () => {
    expect(nearestRegion({ lat: 19.43, lon: -99.13 }, ALL)).toBe('LATAM-North') // Mexico City
    expect(nearestRegion({ lat: 51.51, lon: -0.13 }, ALL)).toBe('EU-West') // London
    expect(nearestRegion({ lat: 35.69, lon: 139.69 }, ALL)).toBe('Asia-East') // Tokyo
    expect(nearestRegion({ lat: -33.87, lon: 151.21 }, ALL)).toBe('OCE') // Sydney
  })

  it('respects the allowed set (skips the true-nearest when excluded)', () => {
    const noLatam = ALL.filter((r) => r !== 'LATAM-North')
    // Mexico City with LATAM excluded -> a US region, not LATAM
    const r = nearestRegion({ lat: 19.43, lon: -99.13 }, noLatam)
    expect(r).not.toBe('LATAM-North')
    expect(['NA-East', 'NA-Central', 'NA-West']).toContain(r)
  })

  it('treats an empty allowed set as "all regions"', () => {
    expect(nearestRegion({ lat: 35.69, lon: 139.69 }, [])).toBe('Asia-East')
  })
})

describe('tzToCoords -> nearestRegion', () => {
  it('maps common IANA zones to the expected region', () => {
    expect(nearestRegion(tzToCoords('America/Mexico_City'), ALL)).toBe('LATAM-North')
    expect(nearestRegion(tzToCoords('Europe/London'), ALL)).toBe('EU-West')
    expect(nearestRegion(tzToCoords('Asia/Tokyo'), ALL)).toBe('Asia-East')
    expect(nearestRegion(tzToCoords('Australia/Sydney'), ALL)).toBe('OCE')
  })

  it('falls back by continent prefix for unlisted zones', () => {
    // Europe/* -> Frankfurt centroid -> EU-Central
    expect(nearestRegion(tzToCoords('Europe/Zurich'), ALL)).toBe('EU-Central')
  })

  it('returns a sane default for an unknown zone', () => {
    const c = tzToCoords('Etc/Unknown')
    expect(Number.isFinite(c.lat)).toBe(true)
    expect(Number.isFinite(c.lon)).toBe(true)
  })
})

describe('detectCoords / detectNearestRegion', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetGeoCacheForTests()
  })

  it('uses /api/geo coordinates when the fetch succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ lat: 35.69, lon: 139.69 }),
      } as Response),
    )
    const c = await detectCoords()
    expect(c).toEqual({ lat: 35.69, lon: 139.69 })
    resetGeoCacheForTests()
    expect(await detectNearestRegion(ALL)).toBe('Asia-East')
  })

  it('falls back to the timezone/locale coords when /api/geo fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response))
    const c = await detectCoords()
    expect(c).not.toBeNull()
    expect(Number.isFinite(c!.lat)).toBe(true)
  })
})
