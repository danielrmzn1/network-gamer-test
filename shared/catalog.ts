import type { Game, Region } from './catalog.types'

// Consolidated catalog (BUILD_SPEC §1.4). Almost every endpoint is a cloud-region
// geographic proxy (AWS/GCP region co-located with the real game datacenter),
// because competitive games run UDP-only and refuse TCP. Two genuine TCP
// gameservers (Minecraft Java) are measured directly.
export const GAMES: Game[] = [
  {
    id: 'valorant', name: 'VALORANT', genre: 'Tactical FPS', publisher: 'Riot Games',
    endpoints: [
      { region: 'NA-East', label: 'NA East (Ashburn, VA)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-West', label: 'NA West (Oregon)', host: 'ec2.us-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-Central', label: 'NA Central (Chicago→Ohio)', host: 'ec2.us-east-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West', label: 'EU West (London)', host: 'ec2.eu-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central', label: 'EU Central (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE', label: 'Asia SE (Singapore)', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-East', label: 'Asia East (Tokyo)', host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-Korea', label: 'Korea (Seoul)', host: 'ec2.ap-northeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-South', label: 'India (Mumbai)', host: 'ec2.ap-south-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'OCE', label: 'Oceania (Sydney)', host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East', label: 'SA East (São Paulo)', host: 'ec2.sa-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'ME-Central', label: 'MENA (UAE proxy)', host: 'ec2.me-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  {
    id: 'lol', name: 'League of Legends', genre: 'MOBA', publisher: 'Riot Games',
    endpoints: [
      { region: 'NA-Central', label: 'NA (Chicago→Ohio)', host: 'ec2.us-east-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-East', label: 'NA East alt (Virginia)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West', label: 'NA West (Oregon)', host: 'ec2.us-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West', label: 'EUW (Amsterdam→Ireland)', host: 'ec2.eu-west-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central', label: 'EUNE (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-Korea', label: 'Korea (Seoul)', host: 'ec2.ap-northeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE', label: 'SEA (Singapore)', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'OCE', label: 'OCE (Sydney)', host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'LATAM-North', label: 'LAN — Latin America North (Mexico)', host: 'ec2.mx-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'SA-East', label: 'LAS / BR (São Paulo)', host: 'ec2.sa-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
    ],
  },
  {
    id: 'cs2', name: 'Counter-Strike 2', genre: 'Tactical FPS', publisher: 'Valve',
    endpoints: [
      { region: 'NA-East', label: 'NA East (Washington DC)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West', label: 'NA West (Los Angeles)', host: 'ec2.us-west-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West', label: 'NA NW (Seattle)', host: 'ec2.us-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-Central', label: 'EU Central (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West', label: 'EU West (London)', host: 'ec2.eu-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-SE', label: 'Asia SE (Singapore)', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-East', label: 'Asia East (Tokyo)', host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-South', label: 'India (Mumbai)', host: 'ec2.ap-south-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'low' },
      { region: 'OCE', label: 'Oceania (Sydney)', host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'SA-East', label: 'SA East (São Paulo)', host: 'ec2.sa-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'ME-Central', label: 'MENA (Dubai→UAE)', host: 'ec2.me-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'low' },
    ],
  },
  {
    id: 'dota2', name: 'Dota 2', genre: 'MOBA', publisher: 'Valve',
    endpoints: [
      { region: 'NA-East', label: 'US East (Virginia)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West', label: 'US West (N. California)', host: 'ec2.us-west-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-Central', label: 'EU Central (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West', label: 'EU West (London)', host: 'ec2.eu-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-SE', label: 'Asia SE (Singapore)', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-East', label: 'Asia East (Tokyo)', host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE', label: 'OCE (Sydney)', host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'SA-East', label: 'SA East (São Paulo)', host: 'ec2.sa-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  {
    id: 'fortnite', name: 'Fortnite', genre: 'Battle Royale', publisher: 'Epic Games',
    endpoints: [
      { region: 'NA-East', label: 'NA-East (Virginia)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-Central', label: 'NA-Central (Dallas→Ohio)', host: 'ec2.us-east-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West', label: 'NA-West (California)', host: 'ec2.us-west-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-West', label: 'EU-West (London/Paris)', host: 'ec2.eu-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central', label: 'EU-Central (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-East', label: 'Asia (Tokyo)', host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE', label: 'SEA (Singapore)', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE', label: 'Oceania (Sydney)', host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East', label: 'Brazil (São Paulo)', host: 'ec2.sa-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'ME-Central', label: 'Middle East (UAE proxy)', host: 'ec2.me-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  {
    id: 'rocket-league', name: 'Rocket League', genre: 'Racing', publisher: 'Psyonix (Epic)',
    endpoints: [
      { region: 'NA-East', label: 'US-East (Virginia)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-Central', label: 'US-East alt (Ohio)', host: 'ec2.us-east-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-West', label: 'US-West (Oregon)', host: 'ec2.us-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-West', label: 'EU-West (Dublin)', host: 'ec2.eu-west-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central', label: 'EU-Central (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE', label: 'Asia SE (Singapore)', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-East', label: 'Asia East (Tokyo)', host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-Korea', label: 'Korea (Seoul)', host: 'ec2.ap-northeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE', label: 'OCE (Sydney)', host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East', label: 'SA East (São Paulo)', host: 'ec2.sa-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
    ],
  },
  {
    id: 'apex', name: 'Apex Legends', genre: 'Battle Royale', publisher: 'EA / Respawn',
    endpoints: [
      { region: 'NA-East', label: 'us-east-1 (N. Virginia)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-Central', label: 'us-east-2 (Ohio)', host: 'ec2.us-east-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-West', label: 'us-west-2 (Oregon)', host: 'ec2.us-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central', label: 'eu-central-1 (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-West', label: 'eu-west-2 (London)', host: 'ec2.eu-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-East', label: 'ap-northeast-1 (Tokyo)', host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE', label: 'ap-southeast-1 (Singapore)', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE', label: 'ap-southeast-2 (Sydney)', host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East', label: 'sa-east-1 (São Paulo)', host: 'ec2.sa-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'ME-Central', label: 'Bahrain (UAE proxy)', host: 'ec2.me-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  {
    id: 'warzone', name: 'Call of Duty: Warzone', genre: 'Battle Royale', publisher: 'Activision',
    endpoints: [
      { region: 'NA-East', label: 'NA-East (Virginia)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-Central', label: 'NA-Central (Dallas→Ohio)', host: 'ec2.us-east-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West', label: 'NA-West (Los Angeles)', host: 'ec2.us-west-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West', label: 'EU-West (London)', host: 'ec2.eu-west-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-Central', label: 'EU-Central (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-East', label: 'Asia (Tokyo)', host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-SE', label: 'SEA (Singapore)', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE', label: 'Oceania (Sydney)', host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'low' },
      { region: 'SA-East', label: 'Brazil (São Paulo)', host: 'ec2.sa-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  {
    id: 'overwatch2', name: 'Overwatch 2', genre: 'Competitive FPS', publisher: 'Blizzard',
    endpoints: [
      { region: 'NA-East', label: 'NA-East (GCP S. Carolina)', host: 'us-east1-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-Central', label: 'NA-Central (GCP Iowa)', host: 'us-central1-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-West', label: 'NA-West (GCP Oregon)', host: 'us-west1-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-West', label: 'EU-West (GCP Belgium)', host: 'europe-west1-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central', label: 'EU-Central (GCP Frankfurt)', host: 'europe-west3-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE', label: 'Asia-SE (GCP Singapore)', host: 'asia-southeast1-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-Korea', label: 'Korea (GCP Seoul)', host: 'asia-northeast3-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-East', label: 'Japan (GCP Tokyo)', host: 'asia-northeast1-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'OCE', label: 'OCE (GCP Sydney)', host: 'australia-southeast1-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East', label: 'SA-East (GCP São Paulo)', host: 'southamerica-east1-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
    ],
  },
  {
    id: 'minecraft', name: 'Minecraft (Java / Hypixel)', genre: 'Casual/Co-op', publisher: 'Mojang / Hypixel',
    endpoints: [
      { region: 'NA-East', label: 'Hypixel (anycast, US core)', host: 'mc.hypixel.net', port: 25565, kind: 'gameserver', confidence: 'high' },
      { region: 'EU-West', label: 'CubeCraft (EU network)', host: 'play.cubecraft.net', port: 25565, kind: 'gameserver', confidence: 'medium' },
      { region: 'NA-East', label: 'Realms proxy (Virginia)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'low' },
      { region: 'EU-Central', label: 'Realms proxy (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'low' },
    ],
  },
]

export const GAME_BY_ID: Record<string, Game> = Object.fromEntries(GAMES.map((g) => [g.id, g]))

/** The distinct regions a game operates in, in catalog order. */
export function gameRegions(id: string): Region[] {
  const g = GAME_BY_ID[id]
  if (!g) return []
  const seen = new Set<Region>()
  const out: Region[] = []
  for (const e of g.endpoints) {
    if (!seen.has(e.region)) {
      seen.add(e.region)
      out.push(e.region)
    }
  }
  return out
}
