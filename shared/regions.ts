import type { Region } from './catalog.types'

// Canonical region metadata + the public TCP-443 endpoint we probe as a
// geographic latency proxy for that metro (see BUILD_SPEC §1.2). Most games
// host in AWS; we use the AWS region endpoint as the neutral per-region probe.

export interface RegionInfo {
  region: Region
  label: string
  metro: string
  host: string
  port: number
  lat: number // metro latitude — used to pick the geographically nearest region
  lon: number // metro longitude
}

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

export const REGION_BY_ID: Record<Region, RegionInfo> = Object.fromEntries(
  REGIONS.map((r) => [r.region, r]),
) as Record<Region, RegionInfo>
