# Geo-nearest region + remembered last selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded initial region with the user's geographically nearest region, and remember the last game + last explicit region choice across visits.

**Architecture:** Two small client modules — `engine/geo.ts` (Cloudflare `/api/geo` edge geo with a timezone/locale fallback → Haversine nearest region) and `state/prefs.ts` (localStorage persistence) — plus a pure `state/startup.ts` resolver that composes deep-link/stored/geo precedence. `App.tsx`'s existing mount `useEffect` calls the resolver (client-only, post-hydration). A new `GET /api/geo` route is added to the Worker (edge geo) and the Node server (stub). Measured per-region latency still refines the pick after a test runs (unchanged).

**Tech Stack:** TypeScript, React 18, Vite/`vite-react-ssg`, Vitest (node env), Cloudflare Workers, Node http server.

## Global Constraints

- **Style:** 2-space indent, single quotes, **no semicolons** (repo-wide).
- **No new npm dependencies.** Haversine + timezone table are hand-rolled.
- **Tests live under `client/src/**/*.test.ts`** (vitest `include`), run in the **`node`** environment. Shared/server tests are NOT collected.
- **`@shared/*`** resolves to `../shared/*` (vite + vitest alias).
- **SSG hydration:** all per-user detection runs **client-only inside a mount `useEffect`**; never touch `localStorage` / `navigator` / `fetch` / `Intl` at module top level. `store.getServerSnapshot` must keep returning the static idle state.
- **Worker invariants (do NOT break):** do NOT add `/api/health`; keep the `/api/turn` response shape `{ iceServers }`; Web APIs only (no `node:*`, no `@cloudflare/workers-types` import — hand-roll types); literal `url.pathname` compare; use the local `json()` helper.
- **Cloudflare `request.cf` values are strings** (e.g. `latitude: "19.43"`); parse with `Number()`.
- **Commit after every task.** TDD: write the failing test first for all pure logic.

Commands (run from repo root unless noted):
- Typecheck: `pnpm typecheck`
- All client tests: `pnpm --filter client run test`
- Single test file: `pnpm --filter client exec vitest run src/engine/geo.test.ts`

---

### Task 1: Region coordinates + `nearestRegion` (Haversine)

**Files:**
- Modify: `shared/regions.ts` (add `lat`/`lon` to `RegionInfo` + all 13 entries)
- Create: `client/src/engine/geo.ts`
- Test: `client/src/engine/geo.test.ts`

**Interfaces:**
- Consumes: `REGIONS`, `RegionInfo` from `@shared/regions`; `Region` from `@shared/catalog.types`.
- Produces: `interface Coords { lat: number; lon: number }`; `haversineKm(a: Coords, b: Coords): number`; `nearestRegion(coords: Coords, allowed: Region[]): Region | null`.

- [ ] **Step 1: Write the failing test** — `client/src/engine/geo.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { nearestRegion, haversineKm } from './geo'
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter client exec vitest run src/engine/geo.test.ts`
Expected: FAIL — `Failed to resolve import './geo'` (and `r.lat`/`r.lon` undefined).

- [ ] **Step 3: Add coordinates to `shared/regions.ts`**

Add two fields to the interface:

```ts
export interface RegionInfo {
  region: Region
  label: string
  metro: string
  host: string
  port: number
  lat: number
  lon: number
}
```

Update every entry (append `lat`/`lon`, metro coordinates):

```ts
export const REGIONS: RegionInfo[] = [
  { region: 'LATAM-North', label: 'LATAM North', metro: 'Mexico City', host: 'ec2.mx-central-1.amazonaws.com', port: 443, lat: 19.43, lon: -99.13 },
  { region: 'NA-East', label: 'NA East', metro: 'Virginia', host: 'ec2.us-east-1.amazonaws.com', port: 443, lat: 39.04, lon: -77.49 },
  { region: 'NA-Central', label: 'NA Central', metro: 'Ohio / Chicago', host: 'ec2.us-east-2.amazonaws.com', port: 443, lat: 39.96, lon: -82.99 },
  { region: 'NA-West', label: 'NA West', metro: 'Oregon', host: 'ec2.us-west-2.amazonaws.com', port: 443, lat: 45.87, lon: -119.69 },
  { region: 'EU-West', label: 'EU West', metro: 'London', host: 'ec2.eu-west-2.amazonaws.com', port: 443, lat: 51.51, lon: -0.13 },
  { region: 'EU-Central', label: 'EU Central', metro: 'Frankfurt', host: 'ec2.eu-central-1.amazonaws.com', port: 443, lat: 50.11, lon: 8.68 },
  { region: 'Asia-East', label: 'Asia East', metro: 'Tokyo', host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, lat: 35.69, lon: 139.69 },
  { region: 'Asia-Korea', label: 'Korea', metro: 'Seoul', host: 'ec2.ap-northeast-2.amazonaws.com', port: 443, lat: 37.57, lon: 126.98 },
  { region: 'Asia-SE', label: 'Asia SE', metro: 'Singapore', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, lat: 1.35, lon: 103.82 },
  { region: 'Asia-South', label: 'India', metro: 'Mumbai', host: 'ec2.ap-south-1.amazonaws.com', port: 443, lat: 19.08, lon: 72.88 },
  { region: 'OCE', label: 'Oceania', metro: 'Sydney', host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, lat: -33.87, lon: 151.21 },
  { region: 'SA-East', label: 'SA East', metro: 'São Paulo', host: 'ec2.sa-east-1.amazonaws.com', port: 443, lat: -23.55, lon: -46.63 },
  { region: 'ME-Central', label: 'Middle East', metro: 'UAE', host: 'ec2.me-central-1.amazonaws.com', port: 443, lat: 25.20, lon: 55.27 },
]
```

(`REGION_BY_ID` below is unchanged.)

- [ ] **Step 4: Implement `geo.ts` (Haversine + nearestRegion)**

```ts
import type { Region } from '@shared/catalog.types'
import { REGIONS } from '@shared/regions'

export interface Coords {
  lat: number
  lon: number
}

/** Great-circle distance in km between two lat/lon points (haversine). */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371
  const rad = (d: number): number => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Closest region to `coords`, restricted to `allowed` (a game's regions). An
 * empty `allowed` means "consider all regions". Returns null only when there
 * are no candidate regions.
 */
export function nearestRegion(coords: Coords, allowed: Region[]): Region | null {
  const allow = new Set(allowed)
  let best: { region: Region; km: number } | null = null
  for (const r of REGIONS) {
    if (allow.size > 0 && !allow.has(r.region)) continue
    const km = haversineKm(coords, { lat: r.lat, lon: r.lon })
    if (best == null || km < best.km) best = { region: r.region, km }
  }
  return best?.region ?? null
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter client exec vitest run src/engine/geo.test.ts`
Expected: PASS (all `describe` blocks green).

- [ ] **Step 6: Commit**

```bash
git add shared/regions.ts client/src/engine/geo.ts client/src/engine/geo.test.ts
git commit -m "feat(geo): region coordinates + haversine nearestRegion"
```

---

### Task 2: Timezone/locale fallback + `detectCoords` + `detectNearestRegion`

**Files:**
- Modify: `client/src/engine/geo.ts`
- Test: `client/src/engine/geo.test.ts` (extend)

**Interfaces:**
- Consumes: `Coords`, `nearestRegion` (Task 1).
- Produces: `tzToCoords(tz: string): Coords`; `detectCoords(): Promise<Coords | null>` (memoized); `detectNearestRegion(allowed: Region[]): Promise<Region | null>`; `resetGeoCacheForTests(): void`.

- [ ] **Step 1: Write the failing tests** — append to `client/src/engine/geo.test.ts`

```ts
import { afterEach, vi } from 'vitest'
import { tzToCoords, detectCoords, detectNearestRegion, resetGeoCacheForTests } from './geo'

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lat: 35.69, lon: 139.69 }),
    } as Response))
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter client exec vitest run src/engine/geo.test.ts`
Expected: FAIL — `tzToCoords`/`detectCoords`/`detectNearestRegion`/`resetGeoCacheForTests` not exported.

- [ ] **Step 3: Implement the fallback + detection in `geo.ts`** (append below `nearestRegion`)

```ts
// Compact IANA timezone -> approx metro coords. Only needs to land the user on
// the right continent; the /api/geo edge path is primary and measured latency
// refines the pick after a run.
const TZ_COORDS: Record<string, Coords> = {
  'America/Mexico_City': { lat: 19.43, lon: -99.13 },
  'America/New_York': { lat: 40.71, lon: -74.01 },
  'America/Toronto': { lat: 43.65, lon: -79.38 },
  'America/Chicago': { lat: 41.88, lon: -87.63 },
  'America/Denver': { lat: 39.74, lon: -104.99 },
  'America/Los_Angeles': { lat: 34.05, lon: -118.24 },
  'America/Phoenix': { lat: 33.45, lon: -112.07 },
  'America/Sao_Paulo': { lat: -23.55, lon: -46.63 },
  'America/Bogota': { lat: 4.71, lon: -74.07 },
  'America/Lima': { lat: -12.05, lon: -77.04 },
  'America/Argentina/Buenos_Aires': { lat: -34.6, lon: -58.38 },
  'America/Santiago': { lat: -33.45, lon: -70.67 },
  'Europe/London': { lat: 51.51, lon: -0.13 },
  'Europe/Dublin': { lat: 53.35, lon: -6.26 },
  'Europe/Paris': { lat: 48.86, lon: 2.35 },
  'Europe/Madrid': { lat: 40.42, lon: -3.7 },
  'Europe/Berlin': { lat: 52.52, lon: 13.4 },
  'Europe/Rome': { lat: 41.9, lon: 12.5 },
  'Europe/Amsterdam': { lat: 52.37, lon: 4.9 },
  'Europe/Warsaw': { lat: 52.23, lon: 21.01 },
  'Europe/Moscow': { lat: 55.76, lon: 37.62 },
  'Europe/Istanbul': { lat: 41.01, lon: 28.98 },
  'Asia/Tokyo': { lat: 35.69, lon: 139.69 },
  'Asia/Seoul': { lat: 37.57, lon: 126.98 },
  'Asia/Shanghai': { lat: 31.23, lon: 121.47 },
  'Asia/Hong_Kong': { lat: 22.32, lon: 114.17 },
  'Asia/Singapore': { lat: 1.35, lon: 103.82 },
  'Asia/Bangkok': { lat: 13.76, lon: 100.5 },
  'Asia/Jakarta': { lat: -6.21, lon: 106.85 },
  'Asia/Kolkata': { lat: 19.08, lon: 72.88 },
  'Asia/Dubai': { lat: 25.2, lon: 55.27 },
  'Asia/Manila': { lat: 14.6, lon: 120.98 },
  'Australia/Sydney': { lat: -33.87, lon: 151.21 },
  'Australia/Melbourne': { lat: -37.81, lon: 144.96 },
  'Australia/Perth': { lat: -31.95, lon: 115.86 },
  'Pacific/Auckland': { lat: -36.85, lon: 174.76 },
  'Africa/Johannesburg': { lat: -26.2, lon: 28.05 },
  'Africa/Cairo': { lat: 30.04, lon: 31.24 },
  'Africa/Lagos': { lat: 6.52, lon: 3.38 },
}

// Continent-prefix centroids for zones not in the table above.
const PREFIX_COORDS: Record<string, Coords> = {
  America: { lat: 39.0, lon: -98.0 }, // ~US centroid
  Europe: { lat: 50.11, lon: 8.68 }, // Frankfurt
  Asia: { lat: 1.35, lon: 103.82 }, // Singapore
  Australia: { lat: -33.87, lon: 151.21 }, // Sydney
  Pacific: { lat: -33.87, lon: 151.21 }, // Sydney
  Africa: { lat: 30.04, lon: 31.24 }, // Cairo (closest to our EU/ME regions)
  Atlantic: { lat: 51.51, lon: -0.13 }, // London
  Indian: { lat: 25.2, lon: 55.27 }, // Dubai
}

// navigator.language region subtag -> coords (secondary hint when the timezone
// is unhelpful, e.g. UTC / Etc/*).
const LANG_COORDS: Record<string, Coords> = {
  MX: { lat: 19.43, lon: -99.13 }, US: { lat: 39.0, lon: -98.0 }, CA: { lat: 43.65, lon: -79.38 },
  BR: { lat: -23.55, lon: -46.63 }, AR: { lat: -34.6, lon: -58.38 }, GB: { lat: 51.51, lon: -0.13 },
  ES: { lat: 40.42, lon: -3.7 }, DE: { lat: 50.11, lon: 8.68 }, FR: { lat: 48.86, lon: 2.35 },
  JP: { lat: 35.69, lon: 139.69 }, KR: { lat: 37.57, lon: 126.98 }, SG: { lat: 1.35, lon: 103.82 },
  IN: { lat: 19.08, lon: 72.88 }, AU: { lat: -33.87, lon: 151.21 }, AE: { lat: 25.2, lon: 55.27 },
}

const DEFAULT_COORDS: Coords = { lat: 39.04, lon: -77.49 } // NA-East (Virginia)

/** Map an IANA timezone to approximate coords (exact zone -> prefix -> default). */
export function tzToCoords(tz: string): Coords {
  if (TZ_COORDS[tz]) return TZ_COORDS[tz]
  const prefix = tz.split('/')[0]
  return PREFIX_COORDS[prefix] ?? DEFAULT_COORDS
}

/** navigator.language region subtag -> coords, or null. */
function langCoords(): Coords | null {
  try {
    if (typeof navigator === 'undefined') return null
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
    for (const l of langs) {
      const region = l?.split('-')[1]?.toUpperCase()
      if (region && LANG_COORDS[region]) return LANG_COORDS[region]
    }
  } catch { /* ignore */ }
  return null
}

/** Best-effort coords from the browser timezone (+ language hint). Never throws. */
function localeCoords(): Coords {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && (TZ_COORDS[tz] || PREFIX_COORDS[tz.split('/')[0]])) return tzToCoords(tz)
  } catch { /* ignore */ }
  return langCoords() ?? DEFAULT_COORDS
}

interface GeoResponse {
  lat?: number
  lon?: number
}

async function fetchEdgeGeo(): Promise<Coords | null> {
  try {
    const res = await fetch('/api/geo', { cache: 'no-store' })
    if (!res.ok) return null
    const j = (await res.json()) as GeoResponse
    if (typeof j.lat === 'number' && typeof j.lon === 'number') return { lat: j.lat, lon: j.lon }
  } catch { /* ignore */ }
  return null
}

let cache: Promise<Coords | null> | null = null

/**
 * The user's approximate coords: Cloudflare edge geo (/api/geo) if available,
 * else the browser-timezone/locale fallback. Memoized (module-level promise) so
 * repeated calls (e.g. switching games) reuse the first result with no refetch.
 */
export function detectCoords(): Promise<Coords | null> {
  if (cache == null) cache = (async () => (await fetchEdgeGeo()) ?? localeCoords())()
  return cache
}

/** Test-only: clear the memoized coords so each test starts fresh. */
export function resetGeoCacheForTests(): void {
  cache = null
}

/** Nearest region to the detected coords, within the game's allowed set. */
export async function detectNearestRegion(allowed: Region[]): Promise<Region | null> {
  const coords = await detectCoords()
  if (!coords) return null
  return nearestRegion(coords, allowed)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter client exec vitest run src/engine/geo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/engine/geo.ts client/src/engine/geo.test.ts
git commit -m "feat(geo): timezone/locale fallback + memoized detectCoords/detectNearestRegion"
```

---

### Task 3: Persistence — `prefs.ts`

**Files:**
- Create: `client/src/state/prefs.ts`
- Test: `client/src/state/prefs.test.ts`

**Interfaces:**
- Consumes: `GAME_BY_ID` from `@shared/catalog`; `REGION_BY_ID` from `@shared/regions`; `Region` from `@shared/catalog.types`.
- Produces: `rememberGame(id: string): void`; `preferredGame(): string | null`; `rememberRegion(r: Region): void`; `preferredRegion(): Region | null`.

- [ ] **Step 1: Write the failing test** — `client/src/state/prefs.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter client exec vitest run src/state/prefs.test.ts`
Expected: FAIL — `Failed to resolve import './prefs'`.

- [ ] **Step 3: Implement `prefs.ts`**

```ts
import type { Region } from '@shared/catalog.types'
import { GAME_BY_ID } from '@shared/catalog'
import { REGION_BY_ID } from '@shared/regions'

// localStorage (not cookies): these are only needed client-side; nothing in the
// build-time prerender consumes them. Mirrors the fragrate-lang pattern in i18n.tsx.
const GAME_KEY = 'fragrate-game'
const REGION_KEY = 'fragrate-region'

/** Persist the user's last game choice. */
export function rememberGame(id: string): void {
  try { localStorage.setItem(GAME_KEY, id) } catch { /* ignore */ }
}

/** The last game choice, if still a valid catalog game; else null. */
export function preferredGame(): string | null {
  try {
    const v = localStorage.getItem(GAME_KEY)
    if (v && GAME_BY_ID[v]) return v
  } catch { /* ignore */ }
  return null
}

/** Persist the user's explicit region choice. */
export function rememberRegion(r: Region): void {
  try { localStorage.setItem(REGION_KEY, r) } catch { /* ignore */ }
}

/** The last explicit region choice, if still a valid region; else null. */
export function preferredRegion(): Region | null {
  try {
    const v = localStorage.getItem(REGION_KEY)
    if (v && Object.prototype.hasOwnProperty.call(REGION_BY_ID, v)) return v as Region
  } catch { /* ignore */ }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter client exec vitest run src/state/prefs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/state/prefs.ts client/src/state/prefs.test.ts
git commit -m "feat(prefs): remember last game + explicit region in localStorage"
```

---

### Task 4: Startup resolver — `startup.ts`

**Files:**
- Create: `client/src/state/startup.ts`
- Test: `client/src/state/startup.test.ts`

**Interfaces:**
- Consumes: `GAME_BY_ID`, `gameRegions` from `@shared/catalog`; `nearestRegion`, `Coords` from `../engine/geo`; `Region` from `@shared/catalog.types`.
- Produces: `interface StartupInput { queryGame: string | null; storedGame: string | null; storedRegion: Region | null; coords: Coords | null }`; `interface StartupSelection { gameId: string | null; region: Region | null }`; `resolveStartup(input: StartupInput): StartupSelection`.

- [ ] **Step 1: Write the failing test** — `client/src/state/startup.test.ts`

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter client exec vitest run src/state/startup.test.ts`
Expected: FAIL — `Failed to resolve import './startup'`.

- [ ] **Step 3: Implement `startup.ts`**

```ts
import type { Region } from '@shared/catalog.types'
import { GAME_BY_ID, gameRegions } from '@shared/catalog'
import { nearestRegion, type Coords } from '../engine/geo'

// Matches the store's default game (client/src/state/store.ts). Used only to
// resolve the region's allowed set when no game is otherwise selected.
const DEFAULT_GAME_ID = 'lol'

export interface StartupInput {
  queryGame: string | null // ?game=<id>
  storedGame: string | null // preferredGame()
  storedRegion: Region | null // preferredRegion()
  coords: Coords | null // detectCoords() result
}

export interface StartupSelection {
  gameId: string | null // null = keep the store default
  region: Region | null // null = keep the store default
}

/**
 * Resolve the initial game + region purely from deep-link / stored prefs / geo.
 *   game:   valid query deep-link > valid stored > null (keep default)
 *   region: stored-if-valid-for-game > geo-nearest > null (keep default)
 * A null field means "leave the store's existing value untouched".
 */
export function resolveStartup(input: StartupInput): StartupSelection {
  const gameId =
    (input.queryGame && GAME_BY_ID[input.queryGame] ? input.queryGame : null) ??
    (input.storedGame && GAME_BY_ID[input.storedGame] ? input.storedGame : null)

  const allowed = gameRegions(gameId ?? DEFAULT_GAME_ID)

  let region: Region | null = null
  if (input.storedRegion && allowed.includes(input.storedRegion)) {
    region = input.storedRegion
  } else if (input.coords) {
    region = nearestRegion(input.coords, allowed)
  }

  return { gameId, region }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter client exec vitest run src/state/startup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/state/startup.ts client/src/state/startup.test.ts
git commit -m "feat(startup): pure resolver for deep-link/stored/geo selection precedence"
```

---

### Task 5: Worker `GET /api/geo` (edge geo)

**Files:**
- Modify: `worker/index.ts`

**Interfaces:**
- Produces: HTTP `GET /api/geo` → `{ lat: number, lon: number, country?: string, continent?: string }` or `{ available: false }`.

> No automated test — the Worker has no test harness or typecheck gate (see `worker/AGENTS.md`). Verify manually.

- [ ] **Step 1: Add a `handleGeo` function** (place above `export default`, after `handleTurn`)

```ts
// GET /api/geo — the visitor's approximate location from Cloudflare's edge
// (request.cf). No secret needed. request.cf may be absent (some contexts /
// local wrangler); then we report { available:false } and the client falls back
// to its timezone/locale heuristic. cf.latitude/longitude are STRINGS.
interface CfGeo {
  latitude?: string
  longitude?: string
  country?: string
  continent?: string
}

function handleGeo(request: Request): Response {
  const cf = (request as unknown as { cf?: CfGeo }).cf
  const lat = cf?.latitude != null ? Number(cf.latitude) : NaN
  const lon = cf?.longitude != null ? Number(cf.longitude) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return json({ available: false }, 200, { 'Cache-Control': 'no-store' })
  }
  return json(
    { lat, lon, country: cf?.country, continent: cf?.continent },
    200,
    { 'Cache-Control': 'no-store' },
  )
}
```

- [ ] **Step 2: Route it** — in the `fetch` handler, add the branch **before** the `/api/*` 404 catch-all:

```ts
    if (url.pathname === '/api/geo') {
      if (request.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405)
      return handleGeo(request)
    }
```

(Insert immediately after the existing `/api/turn` block; the `/api/health` absence is preserved — do NOT add it.)

- [ ] **Step 3: Verify manually**

Run: `pnpm run build && pnpm dlx wrangler dev`
Then in another shell: `curl -s http://localhost:8787/api/geo`
Expected: a JSON object — either `{"lat":...,"lon":...}` (if `request.cf` is populated) or `{"available":false}`. Either is acceptable; the client handles both. Confirm `curl -s http://localhost:8787/api/health` still returns the `/api/*` 404 (so `detectMode` still resolves hosted).

- [ ] **Step 4: Commit**

```bash
git add worker/index.ts
git commit -m "feat(worker): add GET /api/geo edge geolocation route"
```

---

### Task 6: Node server `GET /api/geo` stub

**Files:**
- Modify: `server/src/index.ts`

**Interfaces:**
- Produces: HTTP `GET /api/geo` → `{ available: false }` (loopback server can't geolocate; spares local dev a 404). Client falls back to timezone regardless.

- [ ] **Step 1: Add the route** — in the `createServer` request handler, after the `/api/health` block:

```ts
  if (path === '/api/geo') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ available: false }))
    return
  }
```

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: PASS (no type errors in server).
(Optional runtime check: `pnpm dev`, then `curl -s http://localhost:8787/api/geo` → `{"available":false}`.)

- [ ] **Step 3: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): add GET /api/geo stub (available:false) for local dev"
```

---

### Task 7: Wire into `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `detectCoords`, `detectNearestRegion` (`./engine/geo`); `rememberGame`, `preferredGame`, `rememberRegion`, `preferredRegion` (`./state/prefs`); `resolveStartup` (`./state/startup`); existing `recompute`, `store`, `gameRegions`.

> Verified by typecheck + running the app (no unit test — this is effect glue over the unit-tested pieces).

- [ ] **Step 1: Add imports** near the existing imports (top of `client/src/App.tsx`):

```tsx
import { detectCoords, detectNearestRegion } from './engine/geo'
import { rememberGame, preferredGame, rememberRegion, preferredRegion } from './state/prefs'
import { resolveStartup } from './state/startup'
```

- [ ] **Step 2: Replace the mount `useEffect`** (currently lines ~55–63). New body:

```tsx
  useEffect(() => {
    if (lang === 'en' && preferredLang() === 'es') navigate('/es', { replace: true })

    // Resolve the initial game + region (client-only, post-hydration so SSG
    // hydration still matches): deep-link ?game= > stored pref > geo-nearest >
    // store default. Measured latency still refines the region after a test run.
    const queryGame = new URLSearchParams(window.location.search).get('game')
    void detectCoords().then((coords) => {
      const { gameId, region } = resolveStartup({
        queryGame,
        storedGame: preferredGame(),
        storedRegion: preferredRegion(),
        coords,
      })
      if (gameId) rememberGame(gameId)
      recompute({ gameId: gameId ?? undefined, region: region ?? undefined })
    })

    void detectMode().then((m) => store.set({ mode: m }, true))
  }, [lang, navigate])
```

- [ ] **Step 3: Update `onPickGame`** to persist and re-pick the region when the current one is invalid for the new game:

```tsx
  const onPickGame = (id: string): void => {
    rememberGame(id)
    recompute({ gameId: id })
    // If the current region isn't valid for the new game, re-pick the nearest
    // allowed region from the (memoized) detected coords — no refetch.
    const allowed = gameRegions(id)
    const cur = store.value.selectedRegion
    if (!cur || !allowed.includes(cur)) {
      void detectNearestRegion(allowed).then((r) => { if (r) recompute({ region: r }) })
    }
  }
```

- [ ] **Step 4: Update `onPickRegion`** to persist the explicit choice:

```tsx
  const onPickRegion = (r: Region): void => {
    rememberRegion(r)
    recompute({ region: r })
  }
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Verify in the running app** (use the `run` / `webapp-testing` skill)

Run: `pnpm dev` → open http://localhost:5173.
- On first load the region map highlights a region near you (not always LATAM-North). In local dev `/api/geo` returns `available:false`, so this comes from your timezone (`America/Mexico_City` → LATAM-North here — that's correct for this machine; verify the value matches your timezone).
- Click a different game whose region set differs → the highlighted region stays valid for that game.
- Click a region explicitly → reload the page → the same region is restored (check `localStorage`: `fragrate-game`, `fragrate-region`).
- Pick a different game → reload → that game is restored.

- [ ] **Step 7: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(app): auto-select nearest region + restore last game/region on load"
```

---

### Task 8: Full verification + draft PR

**Files:** none (verification + delivery).

- [ ] **Step 1: Run the full test + typecheck suite**

Run: `pnpm typecheck && pnpm --filter client run test`
Expected: typecheck clean; all vitest suites pass (including the pre-existing `regionPing.test.ts`).

- [ ] **Step 2: Production build sanity**

Run: `pnpm build`
Expected: `tsc --noEmit` + `vite-react-ssg build` succeed (prerender doesn't crash — confirms no web-API access at module top level).

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/geo-region-and-remembered-selection
```

- [ ] **Step 4: Open the draft PR to main**

```bash
gh pr create --draft --base main \
  --title "feat: geo-nearest region + remembered last game/region" \
  --body "$(cat <<'EOF'
## Summary
Two UX features for the tester landing page:
- **Auto-select the closest region.** Replaces the hardcoded `LATAM-North` default with the user's geographically nearest region — via Cloudflare edge geo (`GET /api/geo`) with a browser timezone/locale fallback (no permission prompt). Measured per-region latency still refines the pick after a test runs.
- **Remember the last selection.** Persists the last game and last *explicit* region choice to `localStorage`, restored on the next visit. Precedence: `?game=` deep-link > stored pref > geo-nearest > default.

## How it works
- `client/src/engine/geo.ts` — `/api/geo` edge geo + timezone table fallback → Haversine `nearestRegion`, memoized.
- `client/src/state/prefs.ts` — localStorage persistence (mirrors the existing `fragrate-lang` pattern).
- `client/src/state/startup.ts` — pure precedence resolver (unit-tested).
- `worker/index.ts` / `server/src/index.ts` — new `GET /api/geo` (edge geo / stub).
- `client/src/App.tsx` — wires it into the existing client-only mount effect (SSG hydration preserved; `/api/health` absence untouched so `detectMode` still works).

## Testing
- New unit tests: `geo.test.ts`, `prefs.test.ts`, `startup.test.ts`.
- `pnpm typecheck` + `pnpm --filter client run test` green; `pnpm build` succeeds.
- Manual: region auto-selects by location; explicit game/region choices persist across reloads.

Spec: `docs/superpowers/specs/2026-07-01-geo-region-and-remembered-selection-design.md`
Plan: `docs/superpowers/plans/2026-07-01-geo-region-and-remembered-selection.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Report the PR URL** to the user.

---

## Self-Review

**1. Spec coverage:**
- §4.1 region coords → Task 1 ✓
- §4.2 prefs → Task 3 ✓
- §4.3 geo (nearestRegion, detectCoords, tz fallback, detectNearestRegion) → Tasks 1, 2 ✓
- §4.4 worker `/api/geo` → Task 5; server stub → Task 6 ✓
- §4.5 App wiring (game/region precedence, persistence triggers, game-switch refinement) → Task 4 (resolver) + Task 7 ✓
- §5 testing → geo.test.ts (Tasks 1–2), prefs.test.ts (Task 3), startup.test.ts (Task 4); App via manual (Task 7) ✓
- §7 delivery (branch, TDD, typecheck+test, draft PR) → Task 8 ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has complete code. ✓

**3. Type consistency:** `Coords` defined in Task 1, reused in Tasks 2/4. `nearestRegion(coords, allowed): Region | null`, `detectCoords(): Promise<Coords | null>`, `detectNearestRegion(allowed): Promise<Region | null>` consistent across geo.ts and its consumers. `resolveStartup(StartupInput): StartupSelection` matches its App.tsx call site (`{ queryGame, storedGame, storedRegion, coords }` → `{ gameId, region }`). `recompute({ region?, gameId? })` call sites pass `?? undefined` so `null` never overrides. prefs signatures match test + App usage. ✓
