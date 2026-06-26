import { describe, it, expect, vi, afterEach } from 'vitest'
import { regionStats, httpsTimeOnce } from './regionPing'
import { measureRegion, measureAllRegions, type TimeOnce } from './regionPing'
import { REGIONS } from '@shared/regions'

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

describe('measureRegion', () => {
  it('discards the warm-up request and times N samples', async () => {
    const calls: string[] = []
    const seq = [999, 10, 12, 11, 13, 12, 10, 11] // warm=999, then 7 samples
    let i = 0
    const timeOnce: TimeOnce = async (url) => { calls.push(url); return seq[i++] }
    const info = REGIONS[0]

    const s = await measureRegion(info, { count: 7 }, timeOnce)

    expect(calls[0]).toContain('?_=warm')
    expect(calls).toHaveLength(8) // 1 warm-up + 7 timed
    expect(s.id).toBe(info.region)
    expect(s.host).toBe(info.host)
    expect(s.received).toBe(7)
    expect(s.min).toBe(10) // the 999 warm-up is excluded
  })

  it('drops failed samples and reports received:0/median:null when all fail', async () => {
    const timeOnce: TimeOnce = async () => null
    const s = await measureRegion(REGIONS[0], { count: 5 }, timeOnce)
    expect(s.received).toBe(0)
    expect(s.median).toBeNull()
    expect(s.lossPct).toBe(100)
  })
})

describe('httpsTimeOnce', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls fetch with redirect:manual, mode:cors, and cache:no-store', async () => {
    const mockFetch = vi.fn().mockResolvedValue({} as Response)
    vi.stubGlobal('fetch', mockFetch)

    await httpsTimeOnce('https://x/', 2000)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    // mode MUST be 'cors' (not 'no-cors'): the browser forbids redirect:'manual'
    // with no-cors mode (no-cors requires redirect:'follow'), which would throw
    // synchronously on every probe. cors + manual resolves with an opaqueredirect.
    expect(options).toMatchObject({
      redirect: 'manual',
      mode: 'cors',
      cache: 'no-store',
    })
  })
})

describe('measureAllRegions', () => {
  it('returns ProbeStats keyed by region id for every region', async () => {
    const timeOnce: TimeOnce = async () => 42
    const out = await measureAllRegions({ count: 3 }, timeOnce)
    expect(Object.keys(out).sort()).toEqual(REGIONS.map((r) => r.region).sort())
    for (const r of REGIONS) {
      expect(out[r.region].id).toBe(r.region)
      expect(out[r.region].received).toBe(3)
    }
  })
})
