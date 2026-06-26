import type { Endpoint } from './catalog.types'

// Neutral reference targets, always measured so users can compare game latency
// against a known-good Internet anchor.
export const BASELINES: Endpoint[] = [
  { region: 'NA-East', label: 'Cloudflare 1.1.1.1', host: '1.1.1.1', port: 443, kind: 'baseline', confidence: 'high' },
  { region: 'NA-East', label: 'Google DNS 8.8.8.8', host: '8.8.8.8', port: 443, kind: 'baseline', confidence: 'high' },
  { region: 'NA-East', label: 'AWS us-east-1 (Virginia)', host: 'ec2.us-east-1.amazonaws.com', port: 443, kind: 'baseline', confidence: 'high' },
  { region: 'EU-Central', label: 'AWS eu-central-1 (Frankfurt)', host: 'ec2.eu-central-1.amazonaws.com', port: 443, kind: 'baseline', confidence: 'high' },
  { region: 'Asia-SE', label: 'AWS ap-southeast-1 (Singapore)', host: 'ec2.ap-southeast-1.amazonaws.com', port: 443, kind: 'baseline', confidence: 'high' },
]
