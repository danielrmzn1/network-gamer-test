# FRAGRATE — Consolidated Build Spec (v1)

> **What this is.** The single implementation-ready specification for FRAGRATE, a gamer-grade
> network-quality report. It merges the endpoint research, the genre threshold/grading model,
> the measurement-engine design, and the visual design system into one document an engineer
> can build directly against.
>
> **Stack (already scaffolded).** Client: Vite + React 18 + TypeScript (`client/`, dev `:5173`).
> Server: Node 20 + `node:http` + `ws` + `node-datachannel` (`server/`, `:8787`). In production
> the client build is served same-origin by the Node server, so **CORS is a non-issue**. The Vite
> dev proxy already maps `/api`, `/dl`, `/ul`, `/net` (ws) → `:8787`.
>
> **North-star principle: be honest about what each metric measures.**
> - Throughput is reported in **base-10 Mbps from wire bytes** (`bytes*8/1e6/s`), matching ISP marketing numbers.
> - Game-endpoint latency is **TCP handshake RTT** (SYN→SYN/ACK), a reachability-confirming *latency proxy* — labeled "TCP ping", never "ping".
> - True **packet loss** only comes from the WebRTC unreliable DataChannel (`ordered:false, maxRetransmits:0`); any TCP/WS-based loss number is "effective/approximate" and must be labeled as such.
> - Nearly every game endpoint is a **cloud-region geographic proxy** (AWS/GCP region near the real game datacenter), because real game servers are UDP-only and refuse TCP. This is disclosed in the UI per endpoint.

---

## 0. Why cloud-region proxies (read this before the catalog)

Modern competitive games do not expose a stable, TCP-reachable game-server hostname:

- **Riot (Valorant, LoL), Valve (CS2, Dota 2)** route gameplay over UDP — Valve via Steam Datagram Relay (SDR), Riot via direct UDP. SDR relay IPs and Riot game IPs reject TCP.
- **Epic (Fortnite, Rocket League), EA/Respawn (Apex), Activision (Warzone)** use UDP ping hosts (`ping-*.ds.on.epicgames.com`, Demonware STUN) that are closed on TCP 443/9000.
- **Blizzard (Overwatch 2)** hosts on Google Cloud; its gameservers are UDP-only.

The browser cannot send ICMP or raw UDP to arbitrary hosts, and root-free Node cannot open raw sockets. The honest, portable signal we *can* get is a **TCP connect handshake** to a host that is **co-located in the same cloud region/metro as the real game datacenter**. We therefore map each game/region to the operator's actual cloud region and probe that region's public TCP-443 endpoint (`ec2.<region>.amazonaws.com` for AWS, `<region>-aiplatform.googleapis.com` for GCP). The measured RTT reflects the network path to that metro — an excellent proxy for the real server's latency, plus it confirms reachability.

Two genuine exceptions are kept as `kind: "gameserver"` because Java Minecraft really does use TCP on `25565`: **Hypixel** (`mc.hypixel.net`) and **CubeCraft** (`play.cubecraft.net`). These are measured directly.

**Sanity-check decisions applied to the research:**
- **Dropped** the low-confidence invented/anycast IP `99.83.157.116` (Valorant "AP edge") — only 1 of 6 community IPs accepted TCP, anycast routes nondeterministically, no region guarantee.
- **Collapsed** Middle-East `me-south-1` (Bahrain, TCP-filtered from test host) onto `me-central-1` (UAE, verified open) everywhere it appeared.
- **Deduped** repeated `host:port` pairs within a game to one endpoint per logical region (e.g. Rocket League's two `us-east-*` entries become NA-East primary + NA-East-alt).
- **Normalized** region codes to one enum (below). `kind` is `"cloud-proxy"` for region proxies, `"gameserver"` for real TCP game hosts, `"baseline"` for neutral reference targets.

---

## 1. Consolidated Game Catalog (TS-ready)

### 1.1 Shared types

```ts
// shared/catalog.types.ts
export type Region =
  | 'NA-East' | 'NA-Central' | 'NA-West'
  | 'EU-West' | 'EU-Central'
  | 'Asia-East' | 'Asia-SE' | 'Asia-Korea' | 'Asia-South'
  | 'OCE' | 'SA-East' | 'ME-Central';

export type EndpointKind = 'cloud-proxy' | 'gameserver' | 'baseline';
export type Confidence = 'high' | 'medium' | 'low';

export interface Endpoint {
  region: Region;
  label: string;        // human label shown in the region picker
  host: string;
  port: number;
  kind: EndpointKind;   // 'cloud-proxy' => labeled "TCP ping (region proxy)" in UI
  confidence: Confidence;
}

export type Genre =
  | 'Tactical FPS' | 'Competitive FPS' | 'Battle Royale' | 'MOBA'
  | 'Fighting' | 'Racing' | 'MMORPG' | 'Real-time strategy' | 'Casual/Co-op';

export interface Game {
  id: string;           // stable slug, used in WS game-latency:start
  name: string;
  genre: Genre;         // selects the threshold band set (§2)
  publisher: string;
  endpoints: Endpoint[];
}
```

### 1.2 Region → cloud-region reference (the proxy map)

| Region | AWS proxy host (TCP 443) | GCP proxy host (TCP 443) | Metro |
|---|---|---|---|
| NA-East | `ec2.us-east-1.amazonaws.com` | `us-east1-aiplatform.googleapis.com` | Virginia / S. Carolina |
| NA-Central | `ec2.us-east-2.amazonaws.com` | `us-central1-aiplatform.googleapis.com` | Ohio / Iowa (Chicago/Dallas) |
| NA-West | `ec2.us-west-2.amazonaws.com` *(or `us-west-1` for CA metros)* | `us-west1-aiplatform.googleapis.com` | Oregon / N. California |
| EU-West | `ec2.eu-west-2.amazonaws.com` *(London; `eu-west-1` Dublin alt)* | `europe-west1-aiplatform.googleapis.com` | London / Dublin / Belgium |
| EU-Central | `ec2.eu-central-1.amazonaws.com` | `europe-west3-aiplatform.googleapis.com` | Frankfurt |
| Asia-East | `ec2.ap-northeast-1.amazonaws.com` *(Tokyo; `ap-east-1` HK alt)* | `asia-northeast1-aiplatform.googleapis.com` | Tokyo / Hong Kong |
| Asia-Korea | `ec2.ap-northeast-2.amazonaws.com` | `asia-northeast3-aiplatform.googleapis.com` | Seoul |
| Asia-SE | `ec2.ap-southeast-1.amazonaws.com` | `asia-southeast1-aiplatform.googleapis.com` | Singapore |
| Asia-South | `ec2.ap-south-1.amazonaws.com` | — | Mumbai |
| OCE | `ec2.ap-southeast-2.amazonaws.com` | `australia-southeast1-aiplatform.googleapis.com` | Sydney |
| SA-East | `ec2.sa-east-1.amazonaws.com` | `southamerica-east1-aiplatform.googleapis.com` | São Paulo |
| ME-Central | `ec2.me-central-1.amazonaws.com` | — | UAE (proxy for Bahrain) |

> Riot/Valve/Epic/EA/Activision games proxy via **AWS**; Overwatch 2 proxies via **GCP** (Blizzard's actual host). All proxy ports are **443**.

### 1.3 Baseline endpoints (neutral reference)

Always measured alongside the chosen game so users can compare game latency against a known-good Internet anchor.

```ts
// shared/baselines.ts
export const BASELINES: Endpoint[] = [
  { region: 'NA-East', label: 'Cloudflare 1.1.1.1',     host: '1.1.1.1', port: 443, kind: 'baseline', confidence: 'high' },
  { region: 'NA-East', label: 'Google DNS 8.8.8.8',     host: '8.8.8.8', port: 443, kind: 'baseline', confidence: 'high' },
  { region: 'NA-East', label: 'AWS us-east-1 (Virginia)',  host: 'ec2.us-east-1.amazonaws.com',    port: 443, kind: 'baseline', confidence: 'high' },
  { region: 'EU-Central', label: 'AWS eu-central-1 (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'baseline', confidence: 'high' },
  { region: 'Asia-SE', label: 'AWS ap-southeast-1 (Singapore)',  host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'baseline', confidence: 'high' },
];
```

### 1.4 The catalog (`shared/catalog.ts`)

```ts
import type { Game } from './catalog.types';

export const GAMES: Game[] = [
  // ─────────────────────────────  RIOT (AWS)  ─────────────────────────────
  {
    id: 'valorant', name: 'VALORANT', genre: 'Tactical FPS', publisher: 'Riot Games',
    endpoints: [
      { region: 'NA-East',   label: 'NA East (Ashburn, VA)',        host: 'ec2.us-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-West',   label: 'NA West (Oregon)',             host: 'ec2.us-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-Central',label: 'NA Central (Chicago→Ohio)',    host: 'ec2.us-east-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West',   label: 'EU West (London)',             host: 'ec2.eu-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central',label: 'EU Central (Frankfurt)',       host: 'ec2.eu-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE',   label: 'Asia SE (Singapore)',          host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-East', label: 'Asia East (Tokyo)',            host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-Korea',label: 'Korea (Seoul)',                host: 'ec2.ap-northeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-South',label: 'India (Mumbai)',               host: 'ec2.ap-south-1.amazonaws.com',     port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'OCE',       label: 'Oceania (Sydney)',             host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East',   label: 'SA East (São Paulo)',          host: 'ec2.sa-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'ME-Central',label: 'MENA (UAE proxy)',             host: 'ec2.me-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  {
    id: 'lol', name: 'League of Legends', genre: 'MOBA', publisher: 'Riot Games',
    endpoints: [
      { region: 'NA-Central',label: 'NA (Chicago→Ohio)',            host: 'ec2.us-east-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-East',   label: 'NA East alt (Virginia)',       host: 'ec2.us-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West',   label: 'NA West (Oregon)',             host: 'ec2.us-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West',   label: 'EUW (Amsterdam→Ireland)',      host: 'ec2.eu-west-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central',label: 'EUNE (Frankfurt)',             host: 'ec2.eu-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-Korea',label: 'Korea (Seoul)',                host: 'ec2.ap-northeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE',   label: 'SEA (Singapore)',              host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'OCE',       label: 'OCE (Sydney)',                 host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East',   label: 'LAS/BR (São Paulo)',           host: 'ec2.sa-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
    ],
  },
  // ─────────────────────────────  VALVE (AWS proxy for SDR)  ─────────────────────────────
  {
    id: 'cs2', name: 'Counter-Strike 2', genre: 'Tactical FPS', publisher: 'Valve',
    endpoints: [
      { region: 'NA-East',   label: 'NA East (Washington DC / iad)', host: 'ec2.us-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West',   label: 'NA West (Los Angeles / lax)',   host: 'ec2.us-west-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West',   label: 'NA NW (Seattle / eat)',         host: 'ec2.us-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-Central',label: 'EU Central (Frankfurt / fra)',  host: 'ec2.eu-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West',   label: 'EU West (London / lhr)',        host: 'ec2.eu-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-SE',   label: 'Asia SE (Singapore / sgp)',     host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-East', label: 'Asia East (Tokyo / tyo)',       host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-South',label: 'India (Mumbai / bom)',          host: 'ec2.ap-south-1.amazonaws.com',     port: 443, kind: 'cloud-proxy', confidence: 'low' },
      { region: 'OCE',       label: 'Oceania (Sydney / syd)',        host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'SA-East',   label: 'SA East (São Paulo / gru)',     host: 'ec2.sa-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'ME-Central',label: 'MENA (Dubai / dxb → UAE)',      host: 'ec2.me-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'low' },
    ],
  },
  {
    id: 'dota2', name: 'Dota 2', genre: 'MOBA', publisher: 'Valve',
    endpoints: [
      { region: 'NA-East',   label: 'US East (Virginia / iad)',      host: 'ec2.us-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West',   label: 'US West (N. California / lax)',  host: 'ec2.us-west-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-Central',label: 'EU Central (Frankfurt / fra)',  host: 'ec2.eu-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West',   label: 'EU West (London / lhr)',        host: 'ec2.eu-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-SE',   label: 'Asia SE (Singapore / sgp)',     host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-East', label: 'Asia East (Tokyo / tyo)',       host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE',       label: 'OCE (Sydney / syd)',            host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'SA-East',   label: 'SA East (São Paulo / gru)',     host: 'ec2.sa-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  // ─────────────────────────────  EPIC (AWS)  ─────────────────────────────
  {
    id: 'fortnite', name: 'Fortnite', genre: 'Battle Royale', publisher: 'Epic Games',
    endpoints: [
      { region: 'NA-East',   label: 'NA-East (Virginia)',           host: 'ec2.us-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-Central',label: 'NA-Central (Dallas→Ohio)',     host: 'ec2.us-east-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West',   label: 'NA-West (California)',         host: 'ec2.us-west-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-West',   label: 'EU-West (London/Paris)',       host: 'ec2.eu-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central',label: 'EU-Central (Frankfurt)',       host: 'ec2.eu-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-East', label: 'Asia (Tokyo)',                 host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE',   label: 'SEA (Singapore)',              host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE',       label: 'Oceania (Sydney)',             host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East',   label: 'Brazil (São Paulo)',           host: 'ec2.sa-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'ME-Central',label: 'Middle East (UAE proxy)',      host: 'ec2.me-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  {
    id: 'rocket-league', name: 'Rocket League', genre: 'Racing', publisher: 'Psyonix (Epic)',
    endpoints: [
      { region: 'NA-East',   label: 'US-East (Virginia)',           host: 'ec2.us-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-East',   label: 'US-East alt (Ohio)',           host: 'ec2.us-east-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-West',   label: 'US-West (Oregon)',             host: 'ec2.us-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-West',   label: 'EU-West (Dublin)',             host: 'ec2.eu-west-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central',label: 'EU-Central (Frankfurt)',       host: 'ec2.eu-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE',   label: 'Asia SE (Singapore)',          host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-East', label: 'Asia East (Tokyo)',            host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-Korea',label: 'Korea (Seoul)',                host: 'ec2.ap-northeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE',       label: 'OCE (Sydney)',                 host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East',   label: 'SA East (São Paulo)',          host: 'ec2.sa-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
    ],
  },
  // ─────────────────────────────  EA / RESPAWN (AWS)  ─────────────────────────────
  {
    id: 'apex', name: 'Apex Legends', genre: 'Battle Royale', publisher: 'EA / Respawn',
    endpoints: [
      { region: 'NA-East',   label: 'us-east-1 (N. Virginia)',      host: 'ec2.us-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-Central',label: 'us-east-2 (Ohio)',             host: 'ec2.us-east-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-West',   label: 'us-west-2 (Oregon)',           host: 'ec2.us-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central',label: 'eu-central-1 (Frankfurt)',     host: 'ec2.eu-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-West',   label: 'eu-west-2 (London)',           host: 'ec2.eu-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-East', label: 'ap-northeast-1 (Tokyo)',       host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-East', label: 'ap-east-1 (Hong Kong)',        host: 'ec2.ap-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE',   label: 'ap-southeast-1 (Singapore)',   host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE',       label: 'ap-southeast-2 (Sydney)',      host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East',   label: 'sa-east-1 (São Paulo)',        host: 'ec2.sa-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'ME-Central',label: 'Bahrain (UAE proxy)',          host: 'ec2.me-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  // ─────────────────────────────  ACTIVISION (AWS proxy)  ─────────────────────────────
  {
    id: 'warzone', name: 'Call of Duty: Warzone', genre: 'Battle Royale', publisher: 'Activision',
    endpoints: [
      { region: 'NA-East',   label: 'NA-East (Virginia)',           host: 'ec2.us-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-Central',label: 'NA-Central (Dallas→Ohio)',     host: 'ec2.us-east-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'NA-West',   label: 'NA-West (Los Angeles)',        host: 'ec2.us-west-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-West',   label: 'EU-West (London)',             host: 'ec2.eu-west-2.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'EU-Central',label: 'EU-Central (Frankfurt)',       host: 'ec2.eu-central-1.amazonaws.com',   port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-East', label: 'Asia (Tokyo)',                 host: 'ec2.ap-northeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'Asia-SE',   label: 'SEA (Singapore)',              host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'medium' },
      { region: 'OCE',       label: 'Oceania (Sydney)',             host: 'ec2.ap-southeast-2.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'low' },
      { region: 'SA-East',   label: 'Brazil (São Paulo)',           host: 'ec2.sa-east-1.amazonaws.com',      port: 443, kind: 'cloud-proxy', confidence: 'medium' },
    ],
  },
  // ─────────────────────────────  BLIZZARD (GCP)  ─────────────────────────────
  {
    id: 'overwatch2', name: 'Overwatch 2', genre: 'Competitive FPS', publisher: 'Blizzard',
    endpoints: [
      { region: 'NA-East',   label: 'NA-East (GCP S. Carolina)',    host: 'us-east1-aiplatform.googleapis.com',         port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-Central',label: 'NA-Central (GCP Iowa)',        host: 'us-central1-aiplatform.googleapis.com',      port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'NA-West',   label: 'NA-West (GCP Oregon)',         host: 'us-west1-aiplatform.googleapis.com',         port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-West',   label: 'EU-West (GCP Belgium)',        host: 'europe-west1-aiplatform.googleapis.com',     port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'EU-Central',label: 'EU-Central (GCP Frankfurt)',   host: 'europe-west3-aiplatform.googleapis.com',     port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-SE',   label: 'Asia-SE (GCP Singapore)',      host: 'asia-southeast1-aiplatform.googleapis.com',  port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-Korea',label: 'Korea (GCP Seoul)',            host: 'asia-northeast3-aiplatform.googleapis.com',  port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'Asia-East', label: 'Japan (GCP Tokyo)',            host: 'asia-northeast1-aiplatform.googleapis.com',  port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'OCE',       label: 'OCE (GCP Sydney)',             host: 'australia-southeast1-aiplatform.googleapis.com', port: 443, kind: 'cloud-proxy', confidence: 'high' },
      { region: 'SA-East',   label: 'SA-East (GCP São Paulo)',      host: 'southamerica-east1-aiplatform.googleapis.com',   port: 443, kind: 'cloud-proxy', confidence: 'high' },
    ],
  },
  // ─────────────────────────────  MOJANG / HYPIXEL (real TCP gameservers)  ─────────────────────────────
  {
    id: 'minecraft', name: 'Minecraft (Java / Hypixel)', genre: 'Casual/Co-op', publisher: 'Mojang / Hypixel',
    endpoints: [
      { region: 'NA-East',   label: 'Hypixel (anycast, US core)',   host: 'mc.hypixel.net',    port: 25565, kind: 'gameserver',  confidence: 'high' },
      { region: 'EU-West',   label: 'CubeCraft (EU network)',       host: 'play.cubecraft.net',port: 25565, kind: 'gameserver',  confidence: 'medium' },
      { region: 'NA-East',   label: 'Realms/self-host proxy (Virginia)',  host: 'ec2.us-east-1.amazonaws.com',    port: 443, kind: 'cloud-proxy', confidence: 'low' },
      { region: 'EU-Central',label: 'Realms/self-host proxy (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'cloud-proxy', confidence: 'low' },
    ],
  },
];
```

> **Genre note:** the research labeled Valorant/CS2 "Tactical FPS" and OW2/Apex/Warzone variously. We assign each game one genre that selects its threshold band set: Valorant + CS2 → **Tactical FPS**; Overwatch 2 → **Competitive FPS**; Fortnite/Apex/Warzone → **Battle Royale**; LoL/Dota 2 → **MOBA**; Rocket League → **Racing**; Minecraft → **Casual/Co-op**. (Tactical and Competitive FPS bands are nearly identical; the split preserves the slightly tighter loss tolerance of Tactical.)

---

## 2. Thresholds + Grading model (TS-ready)

### 2.1 Per-genre bands

All "lower is better" metrics (`pingMs`, `jitterMs`, `lossPct`) carry four edges `great > good > ok > bad`. Throughput (`downloadMbps`, `uploadMbps`) carries two edges `good`/`ok` (higher is better).

```ts
// shared/thresholds.types.ts
export interface LowerBand   { great: number; good: number; ok: number; bad: number }
export interface HigherBand  { good: number; ok: number }

export interface GenreBands {
  genre: Genre;
  pingMs: LowerBand;
  jitterMs: LowerBand;
  lossPct: LowerBand;
  downloadMbps: HigherBand;
  uploadMbps: HigherBand;
  note: string;
}
```

```ts
// shared/thresholds.ts
import type { GenreBands } from './thresholds.types';

export const GENRE_BANDS: Record<Genre, GenreBands> = {
  'Competitive FPS': {
    genre: 'Competitive FPS',
    pingMs:   { great: 15, good: 30, ok: 50, bad: 80 },
    jitterMs: { great: 2,  good: 5,  ok: 10, bad: 20 },
    lossPct:  { great: 0,  good: 0.1, ok: 0.5, bad: 2 },
    downloadMbps: { good: 25, ok: 10 },
    uploadMbps:   { good: 10, ok: 3 },
    note: 'High-tick hit-reg is unforgiving; jitter matters as much as raw ping. Throughput modest.',
  },
  'Tactical FPS': {
    genre: 'Tactical FPS',
    pingMs:   { great: 15, good: 30, ok: 50, bad: 80 },
    jitterMs: { great: 2,  good: 5,  ok: 10, bad: 18 },
    lossPct:  { great: 0,  good: 0.1, ok: 0.5, bad: 1.5 },
    downloadMbps: { good: 30, ok: 15 },
    uploadMbps:   { good: 10, ok: 5 },
    note: '128-tick; one dropped packet = a missed pre-fire. Tightest loss tolerance.',
  },
  'Battle Royale': {
    genre: 'Battle Royale',
    pingMs:   { great: 20, good: 40, ok: 70, bad: 100 },
    jitterMs: { great: 3,  good: 8,  ok: 15, bad: 30 },
    lossPct:  { great: 0,  good: 0.2, ok: 0.8, bad: 2.5 },
    downloadMbps: { good: 50, ok: 15 },
    uploadMbps:   { good: 10, ok: 3 },
    note: 'Dense end-game scenes want bandwidth headroom; twitch moments behave like Competitive FPS.',
  },
  'MOBA': {
    genre: 'MOBA',
    pingMs:   { great: 25, good: 45, ok: 70, bad: 100 },
    jitterMs: { great: 3,  good: 8,  ok: 15, bad: 30 },
    lossPct:  { great: 0,  good: 0.3, ok: 1, bad: 3 },
    downloadMbps: { good: 15, ok: 5 },
    uploadMbps:   { good: 5,  ok: 1 },
    note: 'Low bandwidth; ping+jitter dominate. Jitter punishes click-to-move precision.',
  },
  'Fighting': {
    genre: 'Fighting',
    pingMs:   { great: 20, good: 45, ok: 80, bad: 120 },
    jitterMs: { great: 2,  good: 6,  ok: 12, bad: 25 },
    lossPct:  { great: 0,  good: 0.2, ok: 0.8, bad: 2 },
    downloadMbps: { good: 15, ok: 3 },
    uploadMbps:   { good: 5,  ok: 1 },
    note: 'Rollback netcode tolerates ping but jitter forces inconsistent rollbacks. P2P-heavy.',
  },
  'Racing': {
    genre: 'Racing',
    pingMs:   { great: 30, good: 50, ok: 100, bad: 150 },
    jitterMs: { great: 3,  good: 10, ok: 20, bad: 40 },
    lossPct:  { great: 0,  good: 0.3, ok: 1, bad: 3 },
    downloadMbps: { good: 10, ok: 3 },
    uploadMbps:   { good: 3,  ok: 1 },
    note: 'Tiny bandwidth; latency consistency drives smooth interpolation. <100ms ceiling for clean racing.',
  },
  'MMORPG': {
    genre: 'MMORPG',
    pingMs:   { great: 40, good: 80, ok: 150, bad: 250 },
    jitterMs: { great: 5,  good: 15, ok: 30, bad: 60 },
    lossPct:  { great: 0,  good: 0.5, ok: 1.5, bad: 4 },
    downloadMbps: { good: 25, ok: 5 },
    uploadMbps:   { good: 5,  ok: 1 },
    note: 'GCD/ability-queue forgiving; widest loss/jitter tolerance among action genres.',
  },
  'Real-time strategy': {
    genre: 'Real-time strategy',
    pingMs:   { great: 50, good: 100, ok: 150, bad: 250 },
    jitterMs: { great: 5,  good: 15, ok: 35, bad: 70 },
    lossPct:  { great: 0,  good: 0.5, ok: 1.5, bad: 4 },
    downloadMbps: { good: 10, ok: 3 },
    uploadMbps:   { good: 3,  ok: 1 },
    note: 'Lockstep runs at slowest player; jitter more noticeable than raw latency. Throughput irrelevant.',
  },
  'Casual/Co-op': {
    genre: 'Casual/Co-op',
    pingMs:   { great: 50, good: 100, ok: 180, bad: 300 },
    jitterMs: { great: 8,  good: 20, ok: 45, bad: 90 },
    lossPct:  { great: 0,  good: 0.5, ok: 2, bad: 5 },
    downloadMbps: { good: 15, ok: 3 },
    uploadMbps:   { good: 3,  ok: 1 },
    note: 'Most forgiving; the floor against which stricter genres are graded.',
  },
};
```

### 2.2 Subscore + overall rank math

```ts
// shared/grading.ts
import type { LowerBand, HigherBand, GenreBands } from './thresholds.types';

/** Lower-is-better subscore on a 0..100 piecewise scale through the band edges. */
export function lowerSubscore(x: number, b: LowerBand): number {
  const { great: g, good: o, ok: k, bad: d } = b;
  if (x <= g) return 100;
  if (x <= o) return 100 - 15 * (x - g) / (o - g);   // 100..85
  if (x <= k) return 85  - 25 * (x - o) / (k - o);   // 85..60
  if (x <= d) return 60  - 35 * (x - k) / (d - k);   // 60..25
  return Math.max(0, 25 - 25 * (x - d) / d);          // 25..0
}

/** Higher-is-better subscore (throughput). */
export function higherSubscore(v: number, b: HigherBand): number {
  const { good: G, ok: O } = b;
  if (v >= G) return 100;
  if (v >= O) return 60 + 40 * (v - O) / (G - O);     // 60..100
  return Math.max(0, 60 * v / O);                      // 0..60
}

export type Rank = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
export type BloatGrade = 'A' | 'B' | 'C' | 'D' | 'F';   // A subsumes the A+ band for cap logic

export interface MetricInputs {
  ping_ms: number;     // median/p50 RTT to the game endpoint
  jitter_ms: number;   // mean-abs-dev of consecutive RTTs, idle
  loss_pct: number;    // packet loss % over the window (WebRTC primary)
  dl_mbps: number;
  ul_mbps: number;
  rtt_idle: number;    // for bufferbloat
  rtt_loaded: number;  // worst of down/up-saturated loaded median
}

/** ms-delta bufferbloat penalty + grade (STEP 3). */
export function bloat(addedMs: number): { penalty: number; grade: BloatGrade } {
  if (addedMs <= 5)   return { penalty: 0,  grade: 'A' };
  if (addedMs <= 30)  return { penalty: 3,  grade: 'B' };
  if (addedMs <= 60)  return { penalty: 8,  grade: 'C' };
  if (addedMs <= 200) return { penalty: 16, grade: 'D' };
  return                     { penalty: 28, grade: 'F' };
}

export function scoreToLetter(score: number): Rank {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 72) return 'B';
  if (score >= 58) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

const ORDER: Rank[] = ['S', 'A', 'B', 'C', 'D', 'F'];
/** Clamp a rank so it cannot be better than `cap`. */
function capRank(r: Rank, cap: Rank): Rank {
  return ORDER.indexOf(r) >= ORDER.indexOf(cap) ? r : cap;
}

export interface GradeResult {
  rank: Rank;
  score: number;            // post-bufferbloat, pre-cap numeric
  subscores: { ping: number; jitter: number; loss: number; throughput: number };
  bloatGrade: BloatGrade;
  caps: string[];           // which hard caps fired (for the UI "limiting factor")
}

export function grade(m: MetricInputs, bands: GenreBands): GradeResult {
  // STEP 1 — subscores
  const ping   = lowerSubscore(m.ping_ms,   bands.pingMs);
  const jitter = lowerSubscore(m.jitter_ms, bands.jitterMs);
  const loss   = lowerSubscore(m.loss_pct,  bands.lossPct);
  const dlSub  = higherSubscore(m.dl_mbps,  bands.downloadMbps);
  const ulSub  = higherSubscore(m.ul_mbps,  bands.uploadMbps);
  const throughput = 0.6 * dlSub + 0.4 * ulSub;

  // STEP 2 — weighted base (latency/stability heavy, throughput light)
  const base = 0.34 * ping + 0.28 * jitter + 0.23 * loss + 0.15 * throughput;

  // STEP 3 — bufferbloat penalty
  const { penalty, grade: bloatGrade } = bloat(m.rtt_loaded - m.rtt_idle);
  const score = base - penalty;

  // STEP 5 — base letter
  let rank = scoreToLetter(score);

  // STEP 4 — hard caps (applied after letter lookup)
  const caps: string[] = [];
  if (m.loss_pct  > bands.lossPct.bad)   { rank = capRank(rank, 'C'); caps.push('loss>bad'); }
  if (m.ping_ms   > bands.pingMs.bad)    { rank = capRank(rank, 'C'); caps.push('ping>bad'); }
  if (m.jitter_ms > bands.jitterMs.bad)  { rank = capRank(rank, 'B'); caps.push('jitter>bad'); }
  if (bloatGrade  === 'F')               { rank = capRank(rank, 'C'); caps.push('bufferbloat=F'); }

  return { rank, score, subscores: { ping, jitter, loss, throughput }, bloatGrade, caps };
}
```

**Weights:** `ping 0.34 + jitter 0.28 + loss 0.23 + throughput 0.15 = 1.00`. Latency/stability is 85% of the score; throughput only 15%. **S** is only reachable with great ping AND great jitter AND ~0 loss AND an A/B bufferbloat grade — i.e. genuine esports-grade quality *for that genre*. Because bands are genre-relative, the same `60ms / 8ms-jitter` reading is an A for MMORPG and a C for Tactical FPS — intended.

### 2.3 Bufferbloat bands (display + measurement)

Grade primarily off **added latency under load** = `loaded_median − idle_median` (worst of down- and up-saturated). Cross-check with RPM = `60000 / loaded_median_ms`; if the two bands disagree, **take the worse**. The display uses a 6-band scale (A+ split from A for the badge); the grading cap logic in §2.2 treats A+ as A.

| Display grade | Added latency under load | RPM (loaded) | Gamer meaning |
|---|---|---|---|
| **A+** | ≤ 5 ms | > 6000 | Working SQM/AQM (fq_codel/cake); esports-ready under load |
| **A** | 6–30 ms | 2000–6000 | Excellent; competitive FPS still fine |
| **B** | 31–60 ms | 1000–2000 | Good for most games |
| **C** | 61–150 ms | 400–1000 | Noticeable lag spikes under load |
| **D** | 151–400 ms | 130–400 | Bad bufferbloat; rubber-banding likely |
| **F** | > 400 ms | < 130 | Unplayable while the link is busy |

> **Penalty mapping note (decisive):** the grading penalty in `bloat()` uses the engine's band edges (`≤5 / ≤30 / ≤60 / ≤200 / >200`) which collapse A+/A into one 0-penalty bucket and shift the C/D boundary to 200 ms. The **display** table above is the user-facing 6-band version. Implement `bloat()` exactly as written for the score; render the display grade with the 6-band thresholds. This is intentional and the only place the two diverge.

---

## 3. Measurement engine (condensed) + exact contract

Full algorithms live in `docs/MEASUREMENT_ENGINE.md`. This is the binding summary; where they differ, the engine doc's algorithms win and this section's contract wins.

### 3.1 Conventions (non-negotiable)

- **Units:** base-10 Mbps from **wire bytes** (`bytes*8/1e6/s`); never 1024-based.
- **Clocks:** browser `performance.now()`, server `process.hrtime.bigint()`; `Date.now()` only for log `ts`.
- **`/dl` hygiene:** `Content-Encoding: identity`, `Cache-Control: no-store, no-transform`, unique `?n=<nonce>`. Serve slices of one pre-allocated 4 MiB `crypto.randomBytes` buffer — never randomize per chunk (you'd measure server CPU).
- **Connection cap:** browsers allow ~6 concurrent HTTP/1.1 conns per origin → **6 download / 3 upload** streams. During loaded phases drop download to **5** so the WS keeps a live slot (the "5+1 split").
- **Slow-start:** discard the **first 2 s** of every throughput phase; measure the steady window.
- **Nagle:** `socket.setNoDelay(true)` on the WS socket and every game-probe socket; leave `/dl`/`/ul` at default (bulk wants coalescing).

### 3.2 The five subsystems (one line each)

| # | Subsystem | Method | Headline output |
|---|---|---|---|
| 1 | **Download** | 6 (→5 loaded) parallel unbounded streamed `/dl` fetches, 10 s / 2 s warmup / 8 s window, 200 ms sampling, windowed steady mean | `meanMbps` (+ median, p90 peak) |
| 2 | **Upload** | 3 streaming `ReadableStream` POSTs to `/ul` (`duplex:'half'`), Safari `blob-loop` fallback, server-side `ul-rx` cross-check | `meanMbps` (prefer server count if >10% divergence) |
| 3 | **Idle latency/jitter** | (A) app-level WS JSON ping/pong, 30 samples @ 30–50 ms gap; (B) backend root-free TCP-connect timing to game endpoints, 10 samples × ≤4 endpoints | `{min,avg,median,p95,jitter}`; jitter = mean-abs-dev of consecutive RTTs |
| 4 | **Bufferbloat** | idle baseline → WS RTT during download (5+1) → during upload; `delta = loaded_median − idle_median`, `RPM = 60000/median` | `{deltaDownMs, deltaUpMs, rpmLoaded, grade}` |
| 5 | **Packet loss** | **PRIMARY** WebRTC `RTCDataChannel{ordered:false,maxRetransmits:0}` via `node-datachannel`, 50 probes/s, 250 idle + 250 loaded, bidirectional, gap-tolerance(10) loss logic; **FALLBACK** WS sequenced probes labeled `ws-approx` | `{lossMethod, idle, loadedDown, loadedUp}` per direction |

> **Honesty labels carried into the report:** `gameLatency` is `"TCP ping (handshake)"`, not "ping". `loss.lossMethod` is `"webrtc"` (true) or `"ws-approx"` (effective loss = severe spikes, TCP hides real drops). `upload.uploadMethod` is `"stream"` or `"blob-loop"`.

### 3.3 HTTP routes

| Method | Path | Purpose | Response |
|---|---|---|---|
| GET | `/api/health` | liveness (exists) | `{ok, service, ts}` |
| GET | `/api/games` | catalog for the picker | `{games:[{id,name,genre,publisher,regions:[{region,label}]}]}` |
| GET | `/dl?n=<nonce>[&bytes=N]` | download source (§1) | random octet-stream, `identity`/`no-store`/`no-transform` |
| POST | `/ul` | upload sink (§2), counts+discards | `{received:<bytes>}` |
| (any) | `/*` | SPA static (prod) → `client/dist` | `index.html` / assets |

### 3.4 WebSocket `/net` — message contract

Single multiplexed JSON WS per session. Server `setNoDelay(true)` on connect, assigns `sessionId`.

**Control / lifecycle**
```jsonc
S→C {"type":"hello","sessionId":"...","caps":{"webrtc":true}}
C→S {"type":"session:start","plan":["idle","game","loss","download","upload"],"game":"valorant","region":"EU-Central"}
S→C {"type":"session:phase","phase":"download","status":"begin"|"end"}
C→S {"type":"session:abort"}
```

**Idle latency (§3.1A)**
```jsonc
C→S {"type":"ping","seq":k,"t0":<perf.now ms>}
S→C {"type":"pong","seq":k,"t0":<echoed>,"srv":<hrtime ns>}   // echo synchronously, no awaits
```

**Game-endpoint TCP latency (§3.1B)**
```jsonc
C→S {"type":"game-latency:start","game":"valorant","region":"EU-Central"}
S→C {"type":"game-latency:progress","host":..,"port":..,"sample":k,"rttMs":..}
S→C {"type":"game-latency:result","game":..,"endpoints":[{host,port,ok,failed,min,avg,jitter}]}
```

**Upload server-side feedback (§2.3)**
```jsonc
S→C {"type":"ul-rx","conn":i,"bytes":<cumulative>}
```

**Live progress** (client emits for client-measured phases so the server can log; server emits for server-measured)
```jsonc
*→UI {"type":"progress","phase":"download"|"upload","mbps":..,"elapsed":ms,"window":"warmup"|"steady"}
*→UI {"type":"progress","phase":"bufferbloat","rttMs":..,"loadKind":"download"|"upload"}
*→UI {"type":"progress","phase":"loss","direction":"down"|"up","sent":..,"received":..,"lossPct":..}
```

**Phase results (authoritative, one per phase)**
```jsonc
{"type":"result","phase":"idle",       "data":{min,avg,median,p95,jitter,sent,received,lost}}
{"type":"result","phase":"game",       "data":{game,endpoints:[{host,port,ok,failed,min,avg,jitter}]}}
{"type":"result","phase":"download",   "data":{meanMbps,medianMbps,peakMbps,samples}}
{"type":"result","phase":"upload",     "data":{meanMbps,medianMbps,peakMbps,samples,uploadMethod}}
{"type":"result","phase":"bufferbloat","data":{idleMedian,loadedMedian,deltaDownMs,deltaUpMs,rpmIdle,rpmLoaded,grade}}
{"type":"result","phase":"loss",       "data":{lossMethod,idle:{...},loadedDown:{...},loadedUp:{...}}}
{"type":"session:complete","report":{...aggregate...,"verdicts":{<gameId>:{rank,score,subscores,bloatGrade,caps}}}}
```

**WebRTC signaling (over `/net`, §5.1)** + **WS-loss fallback (§5.2)**
```jsonc
C→S {"type":"rtc:offer-request"}
C→S {"type":"rtc:offer","sdp":"<sdp>"}
S→C {"type":"rtc:answer","sdp":"<sdp>"}
C↔S {"type":"rtc:ice","candidate":"<c>","mid":"<mid>"}
S→C {"type":"rtc:state","state":"connecting"|"connected"|"failed"}
// fallback:
C→S {"type":"wsloss:probe","seq":k,"t0":..}
S→C {"type":"wsloss:echo","seq":k,"t0":..}
```
DataChannel binary probe frame (not over WS): `[uint8 kind=0probe|1done][uint32 seq][float64 t0][uint32 totalIfDone]` (≤64 B). ICE: `iceServers: [{urls:'stun:stun.l.google.com:19302'}]`, no TURN; if ICE fails within **8 s**, fall back to `ws-approx`.

### 3.5 WebRTC honesty rule (load-bearing)

The only configuration that makes loss truthful:
```ts
pc.createDataChannel('loss', { ordered: false, maxRetransmits: 0 });
```
Anything TCP-based (including the WS fallback) cannot observe real loss — it sees the symptom (latency spikes), so it is always reported as `lossMethod:"ws-approx"` with the UI caveat *"Estimated — your network blocked the precise (UDP) test; this counts severe latency spikes as effective loss."*

---

## 4. Visual design system (condensed)

Full spec: `FRAGRATE-design-system.md`. Direction: **neon cyberpunk HUD**, read like an instrument cluster — rank badge first, gauges second, per-game cards third. **Cyan/magenta = brand atmosphere; green/amber/red = semantic state. Never mix them.** Fully self-contained: no CDN, no remote fonts/images (CSP-safe Artifact-style constraints apply to the shipped page too).

### 4.1 `:root` tokens (drop-in)

```css
:root {
  /* Base / elevation (layered near-black, blue bias) */
  --bg-void:#05070D; --bg-base:#0A0E18; --bg-panel:#0F1626; --bg-panel-2:#161F33;
  --bg-inset:#070A12; --bg-grid:#0D1320;
  /* Brand neon */
  --neon-cyan:#0AF0FF; --neon-cyan-dim:#0BA9B5; --neon-magenta:#FF2BD6; --neon-mag-dim:#B5219B;
  /* Semantic state (separate from brand) */
  --good:#36F1A6; --good-dim:#1E8F66; --warn:#FFC53D; --warn-dim:#B8862A; --bad:#FF4D6A; --bad-dim:#A12C40;
  /* Text */
  --text-hi:#EAF6FF; --text-mid:#B8C4DA; --text-lo:#8A93A6; --text-faint:#4A5468;
  /* Lines / strokes */
  --stroke:#1E2A42; --stroke-strong:#2C3C5C; --focus-ring:#0AF0FF;
  /* Glow shadows (the signature) */
  --glow-cyan:0 0 4px #0AF0FF,0 0 14px rgba(10,240,255,.55),0 0 32px rgba(10,240,255,.25);
  --glow-cyan-soft:0 0 10px rgba(10,240,255,.30);
  --glow-magenta:0 0 4px #FF2BD6,0 0 14px rgba(255,43,214,.55),0 0 30px rgba(255,43,214,.22);
  --glow-good:0 0 4px #36F1A6,0 0 16px rgba(54,241,166,.45);
  --glow-warn:0 0 4px #FFC53D,0 0 16px rgba(255,197,61,.45);
  --glow-bad:0 0 4px #FF4D6A,0 0 16px rgba(255,77,106,.50);
  --text-glow-cyan:0 0 6px rgba(10,240,255,.7),0 0 18px rgba(10,240,255,.35);
  --text-glow-mag:0 0 6px rgba(255,43,214,.7),0 0 18px rgba(255,43,214,.35);
  /* Radii / spacing */
  --r-sm:4px; --r-md:8px; --r-lg:14px; --r-pill:999px;
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:24px; --sp-6:32px; --sp-7:48px; --sp-8:64px;
  /* Type stacks */
  --font-display:"FragrateDisplay","Bahnschrift","DIN Alternate","Eurostile",system-ui,sans-serif;
  --font-mono:ui-monospace,"SF Mono","Cascadia Mono","Roboto Mono",Menlo,Consolas,monospace;
  --font-body:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
```

**State → token mapping:** PLAYABLE→`--good`/`--glow-good`; RISKY→`--warn`/`--glow-warn`; NO→`--bad`/`--glow-bad`; Live/in-progress→`--neon-magenta`/`--glow-magenta`; Idle HUD→`--neon-cyan-dim`/`--glow-cyan-soft`.

**Type scale (uppercase labels get `0.12–0.16em` tracking — the HUD tell; numerals always `tabular-nums`):** `--t-rank` 88px/800; `--t-display-xl` 40px/700 upper; `--t-display` 28px/700 upper; `--t-readout` 34px mono; `--t-readout-sm` 20px mono; `--t-label` 12px/600 0.16em upper; `--t-body` 15px/400; `--t-caption` 11px/500 upper.

> **Font action item:** the `@font-face` payload in the design doc is a `<<<INLINE_WOFF2_PAYLOAD>>>` placeholder. Either inline a real base64 woff2 **or** ship without the bundled face — the documented fallback stack (`Bahnschrift/Eurostile/system-ui` + uppercase + wide tracking + tabular numerals) carries the HUD feel on its own. **Decision: ship v1 on the fallback stack; treat the bundled face as a polish task.**

### 4.2 Component inventory

| Component | Visual | Key technique |
|---|---|---|
| **Arc gauge** (ping/jitter/loss) | 270° tachometer arc on recessed track, cyan→magenta fill, glowing round cap, big mono center readout; recolors to semantic token past threshold | `<circle>` `stroke-dasharray`=circumference + animated `stroke-dashoffset`, `linecap:round`, rotated to 7-o'clock; glow via `filter: drop-shadow` |
| **Throughput bars** (down/up) | Horizontal segmented bars, cyan(down)/magenta(up) gradient fill + moving data-stream shimmer, non-linear tick scale, mono readout right | `width%` transition + `repeating-linear-gradient` mask; shimmer = pseudo-element animating `background-position` while running |
| **Live sparkline** | Wide short strip, last ~60 latency samples, cyan stroke + fading area fill, pulsing glowing endpoint dot, spikes tint warn/bad | Canvas (rolling redraw), `shadowBlur` for glow |
| **Rank badge** (S/A/B/C/D/F) | Hero hex plate, double neon border, giant display letter; S=dual cyan+magenta, A/B=cyan, C=amber, D=red; conic orbit ring + CRT chromatic split | `clip-path` hex; orbit = conic-gradient pseudo-element masked to ring; chromatic split = offset cyan/magenta `text-shadow` |
| **Per-game verdict card** | PLAYABLE/RISKY/NO state pill, left severity stripe, border glows on hover, micro-readout of limiting factor | layered `box-shadow` (inset hairline + outer bloom); stripe `::before`; pills reuse semantic glow tokens |
| **Region selector** | Horizontal scroll-row of pill chips w/ live ping; selected = cyan fill+glow | `flex; overflow-x:auto` + scroll-snap |
| **RUN TEST CTA** | Wide pill, cyan→magenta gradient border, slow glow-pulse at rest, hover light-sweep; turns magenta + labeled while running | double-background gradient-border trick; `::after` skewed sweep; `box-shadow` pulse keyframes |
| **Phase stepper** | `PING→JITTER→LOSS→DOWNLOAD→UPLOAD→SCORING`; done=solid cyan+check, active=magenta pulse, pending=dim | flex nodes + animated connector `width` |
| **Results summary panel** | Slides up post-run: small rank badge + metric grid (value/unit/state dot) + share-card preview + RUN AGAIN | `--bg-panel` + top `--neon-cyan-dim` hairline + `--glow-cyan-soft`; `grid-template-columns:1fr auto auto` |

Five ready-to-use CSS snippets (background atmosphere/scanline+grid, gauge glow, neon/CRT rank text, card border glow + verdict pills, gradient-frame CTA) are in design doc §6 — copy them verbatim.

### 4.3 Layout

12-col responsive grid, `max-width:1280px`, centered. Top→bottom: **Hero verdict** (rank badge + summary line + CTA; the only place cyan+magenta glow at full strength together) → **Gauges (cols 1–7)** + **Throughput (cols 8–12)** → **full-width sparkline** → **per-game cards** (`auto-fill, minmax(220px,1fr)`) → **region selector + phase stepper**. Breakpoints: `≤760px` single column, gauges stack, cards 2-up, CTA full-width sticky-bottom while running; `≤420px` cards 1-up, stepper vertical.

### 4.4 Motion + accessibility

Gauge sweep `stroke-dashoffset` 900ms `cubic-bezier(.16,1,.3,1)`; number count-up RAF 700ms ease-out; glow pulse 2.4s breathe; drifting scanline band 8s; CTA light-sweep 600ms on hover; sparkline endpoint pulse 1.2s. **`prefers-reduced-motion: reduce`** collapses all durations to ~0, freezes glow static, removes scanline/shimmer — **meaning always survives without motion** (state carried by word + number + color, never animation). Color is never the only signal (verdict pills carry the word, gauges the number+unit, cards a text reason); every interactive element gets the cyan `--focus-ring`.

---

## 5. File / module layout

```
network-gamer-test/
├─ package.json                 # scripts: dev/build/start/typecheck; packageManager pnpm (exists)
├─ pnpm-workspace.yaml          # pnpm workspace packages: server, client (exists)
├─ docs/
│  ├─ BUILD_SPEC.md             # ← this file
│  └─ MEASUREMENT_ENGINE.md     # full engine algorithms (exists)
├─ FRAGRATE-design-system.md    # full visual spec (exists)
│
├─ shared/                      # ← NEW: types + data shared by client & server (path-aliased, not a workspace)
│  ├─ catalog.types.ts          # Region, EndpointKind, Endpoint, Genre, Game (§1.1)
│  ├─ catalog.ts                # GAMES[] (§1.4)
│  ├─ baselines.ts              # BASELINES[] (§1.3)
│  ├─ regions.ts                # Region → cloud-proxy-host map (§1.2)
│  ├─ thresholds.types.ts       # LowerBand, HigherBand, GenreBands
│  ├─ thresholds.ts             # GENRE_BANDS (§2.1)
│  ├─ grading.ts                # subscores + grade() + bloat() + scoreToLetter() (§2.2)
│  └─ protocol.ts               # WS message type unions + result shapes (§3.4) — single source of truth
│
├─ server/
│  ├─ package.json              # deps: ws, node-datachannel (exists)
│  └─ src/
│     ├─ index.ts               # http server bootstrap, route table, ws upgrade wiring (exists, extend)
│     ├─ static.ts              # serve client/dist in prod (exists, stub)
│     ├─ routes/
│     │  ├─ health.ts           # GET /api/health
│     │  ├─ games.ts            # GET /api/games (projects shared/catalog)
│     │  ├─ dl.ts               # GET /dl  (§1.5 pump loop, RAND buffer, backpressure)
│     │  └─ ul.ts               # POST /ul (§2.4 discard + ul-rx feedback)
│     ├─ ws/
│     │  ├─ session.ts          # per-connection session FSM, plan orchestration, setNoDelay
│     │  ├─ ping.ts             # pong echo (§3.1A)
│     │  ├─ webrtc.ts           # node-datachannel peer, signaling bridge, loss probe (§5.1)
│     │  └─ wsloss.ts           # ws-approx fallback echo (§5.2)
│     ├─ pinger.ts              # TCP-connect game-endpoint timing (§3.1B) (exists, stub → implement)
│     ├─ speedtest.ts           # shared throughput helpers (RAND buffer, steady-window math) (exists, stub)
│     └─ lib/stats.ts           # median, p95, meanAbsDev (shared with grading where useful)
│
└─ client/
   ├─ vite.config.ts            # proxy /api,/dl,/ul,/net→:8787; add shared/ path alias (exists, extend)
   ├─ index.html                # (exists)
   └─ src/
      ├─ main.tsx               # (exists)
      ├─ App.tsx                # dashboard shell + layout grid (exists → build out)
      ├─ styles/
      │  ├─ global.css          # :root tokens, reset, background atmosphere (§4.1) (exists → fill)
      │  └─ components.css       # gauge/bar/card/CTA/badge snippets from design §6
      ├─ engine/
      │  ├─ ws.ts               # /net WebSocket client, typed via shared/protocol
      │  ├─ download.ts         # §1.3 6→5-conn streamed fetch sampler
      │  ├─ upload.ts           # §2.3 ReadableStream POST + blob-loop fallback + feature detect
      │  ├─ latency.ts          # §3.1A ping/pong loop + jitter
      │  ├─ bufferbloat.ts      # §4 idle/loaded RTT folding into download/upload phases
      │  ├─ loss.ts             # §5.1 WebRTC DataChannel client + §5.2 ws-approx fallback
      │  ├─ scheduler.ts        # drift-free fixed-rate probe scheduler (start + k*interval)
      │  └─ orchestrator.ts     # runs the §6 timeline, assembles report, calls grade()
      ├─ state/
      │  └─ store.ts            # useReducer/Zustand: reduces WS progress/result msgs; ≤10fps repaint throttle
      └─ components/
         ├─ Hero.tsx            # rank badge + verdict line + RUN TEST CTA
         ├─ RankBadge.tsx       # hex plate, chromatic split, orbit ring
         ├─ ArcGauge.tsx        # SVG 270° gauge (ping/jitter/loss)
         ├─ ThroughputBar.tsx   # down/up bar meters + shimmer
         ├─ Sparkline.tsx       # canvas rolling latency chart
         ├─ GameCard.tsx        # per-game PLAYABLE/RISKY/NO verdict card
         ├─ RegionSelector.tsx  # scroll-row chips w/ live ping
         ├─ PhaseStepper.tsx    # phase progress
         └─ ResultsPanel.tsx    # post-run summary + share card
```

**Notes.** (a) `shared/` is consumed by both sides via a TS path alias (`"@shared/*"`) in both tsconfigs and a Vite `resolve.alias`; it is plain `.ts` with no runtime deps, safe to import server-side and bundle client-side. (b) The grading math (`grade()`) runs **client-side** in `orchestrator.ts` after all results arrive, then is echoed into `session:complete` for logging — the server stays a thin measurement plane. (c) New server deps beyond the scaffold: **none required** (`ws` + `node-datachannel` already present); `node:net`, `node:crypto`, `node:http` are built-in.

---

## 6. Test sequence / timeline (≈33–35 s) + build order

### 6.1 Runtime measurement timeline (orchestrator.ts)

```
t=0   hello / session:start; open WS; setNoDelay
      [1] IDLE LATENCY (§3.1A)        ~3 s   30 WS pings @ ~40 ms gap         — never overlap with throughput
      [2] GAME-ENDPOINT TCP (§3.1B)   ~4 s   ≤4 endpoints × 10 samples        — runs after idle pings; separate sockets
      [3] WEBRTC SETUP + IDLE LOSS    ~6 s   ICE handshake; 250 idle probes   — 8 s ICE budget → else ws-approx fallback
      [4] DOWNLOAD (§1)               10 s   6→5 conns; folds in bufferbloat-down RTT + loaded-down loss
      [5] UPLOAD (§2)                 10 s   3 conns;   folds in bufferbloat-up RTT   + loaded-up loss
      [6] COMPUTE                     <1 s   bufferbloat deltas/RPM, grade() per game, verdicts
      session:complete { report, verdicts }
```

**Sequencing rules:** never overlap Phase 1 (idle baseline) with any throughput; during Phases 4/5 reserve one connection slot for WS (5+1 split) so RTT/loss sampling isn't head-of-line blocked; saturate the link **once** per direction and watch latency+loss simultaneously (don't pay twice); on `session:abort` → abort all fetches, close the DataChannel, stop schedulers, emit `session:complete` with partial results. Phases 4 and 5 emit `download`/`upload` results **and** feed the `bufferbloat` + `loss(loaded*)` results.

### 6.2 Recommended build sequence (maps to the task list)

1. **Shared core first** (`shared/*`) — types, catalog, thresholds, grading, protocol. Add `grading.test.ts` golden cases (e.g. great-everything→S; ping>bad→capped C; bufferbloat F→capped C). *Unblocks both sides.*
2. **Server measurement plane** (task #2): route table + `/dl`, `/ul`, `/api/games`, then WS `session` FSM + `ping` echo, then `pinger` (TCP timing), then `webrtc` + `wsloss`. Verify each route with `curl`/`wscat` before wiring the client.
3. **Client engine** (task #3): `ws.ts` + `store.ts` first, then `latency` → `download` → `upload` → `bufferbloat` → `loss`, then `orchestrator` running the §6.1 timeline. Validate numbers against a known speedtest and against `waveform.com/tools/bufferbloat`.
4. **Dashboard UI** (task #4): tokens/`global.css` → `RankBadge`/`ArcGauge`/`ThroughputBar` → `Hero`/`GameCard`/`RegionSelector`/`PhaseStepper`/`ResultsPanel` → wire to `store`. Throttle repaints ≤10 fps.
5. **Run, verify, review** (task #5): full `pnpm dev`, run a real test, sanity-check throughput vs Ookla, bufferbloat vs Waveform, and confirm the honesty labels render (TCP-ping, ws-approx, region-proxy disclosure). Typecheck both workspaces (`pnpm typecheck`).

### 6.3 Implementer pitfalls checklist (carry forward)

- [ ] Report **base-10 Mbps** from **wire bytes**; discard the **2 s slow-start** warmup every throughput phase.
- [ ] Respect the **6-conn cap**; reserve a WS slot during loaded phases (5+1).
- [ ] `setNoDelay(true)` on all latency sockets; default on `/dl`/`/ul`.
- [ ] **CORS is a non-issue** (same-origin prod, Vite proxy dev) — don't add interfering middleware.
- [ ] Pre-generate the RAND buffer **once**; never `crypto.randomBytes` per chunk.
- [ ] `/dl`: `identity` + `no-store, no-transform` + `?n=nonce`.
- [ ] **TCP hides loss** — only WebRTC `{ordered:false, maxRetransmits:0}` is truthful; everything else is `ws-approx`, labeled.
- [ ] Unordered DataChannel: **reordering ≠ loss** — apply gap-tolerance(10) window.
- [ ] **Drift-free** scheduler (`start + k*interval`), never naive `setInterval`, for probes.
- [ ] Respect HTTP **backpressure** on `/dl` (`write()`/`drain`); stream-discard `/ul`.
- [ ] Game-endpoint timing is **TCP handshake RTT** (a latency proxy), root-free, rate-limited — labeled accordingly.
- [ ] `performance.now()` / `hrtime.bigint()` for intervals, never `Date.now()`.
- [ ] Drop the invented anycast IP; `me-south-1`→`me-central-1`; dedupe per-region host:port.
```
