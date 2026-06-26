import { describe, it, expect } from 'vitest'
import { regionStats } from './regionPing'

describe('regionStats', () => {
  it('computes min/median/jitter/lossPct from samples', () => {
    const s = regionStats('NA-East', 'h', 443, [10, 12, 11, 13, 12], 5)
    expect(s.id).toBe('NA-East')
    expect(s.received).toBe(5)
    expect(s.lossPct).toBe(0)
    expect(s.min).toBe(10)
    expect(s.median).toBe(12) // sorted [10,11,12,12,13] -> 12
    expect(s.jitter).toBeCloseTo(1.5) // mean(|2|,|1|,|2|,|1|) = 1.5
  })

  it('counts dropped samples in lossPct (received < samples)', () => {
    const s = regionStats('EU-West', 'h', 443, [20, 22], 7)
    expect(s.received).toBe(2)
    expect(s.lossPct).toBeCloseTo((5 / 7) * 100)
  })

  it('returns null fields and 100% loss when nothing was received', () => {
    const s = regionStats('OCE', 'h', 443, [], 7)
    expect(s.received).toBe(0)
    expect(s.min).toBeNull()
    expect(s.median).toBeNull()
    expect(s.jitter).toBeNull()
    expect(s.lossPct).toBe(100)
  })
})
