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
