// Shared domain types for the game catalog. Plain .ts, no runtime deps — safe
// to import from both the Node server and the Vite-bundled client.

export type Region =
  | 'NA-East' | 'NA-Central' | 'NA-West'
  | 'EU-West' | 'EU-Central'
  | 'Asia-East' | 'Asia-SE' | 'Asia-Korea' | 'Asia-South'
  | 'OCE' | 'SA-East' | 'LATAM-North' | 'ME-Central'

export type EndpointKind = 'cloud-proxy' | 'gameserver' | 'baseline'
export type Confidence = 'high' | 'medium' | 'low'

export interface Endpoint {
  region: Region
  label: string // human label shown in the region picker
  host: string
  port: number
  kind: EndpointKind // 'cloud-proxy' => labeled "TCP ping (region proxy)" in UI
  confidence: Confidence
}

export type Genre =
  | 'Tactical FPS' | 'Competitive FPS' | 'Battle Royale' | 'MOBA'
  | 'Fighting' | 'Racing' | 'MMORPG' | 'Real-time strategy' | 'Casual/Co-op'

export interface Game {
  id: string // stable slug
  name: string
  genre: Genre // selects the threshold band set
  publisher: string
  endpoints: Endpoint[]
}
