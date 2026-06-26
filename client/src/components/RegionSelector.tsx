import type { CSSProperties } from 'react'
import type { ProbeStats } from '@shared/protocol'
import type { Region } from '@shared/catalog.types'
import { REGIONS, REGION_BY_ID } from '@shared/regions'
import { fmt } from '../lib/format'

function msColor(median: number | null): string {
  if (median == null) return 'var(--text-faint)'
  if (median <= 60) return 'var(--teal)'
  if (median <= 130) return 'var(--warn)'
  return 'var(--bad)'
}

export function RegionSelector({
  regions,
  selected,
  allowed,
  onSelect,
}: {
  regions: Record<string, ProbeStats>
  selected: Region | null
  allowed: Region[]
  onSelect: (r: Region) => void
}) {
  const allow = new Set(allowed)
  return (
    <div className="np-regions">
      {REGIONS.filter((info) => allow.size === 0 || allow.has(info.region)).map((info) => {
        const stats = regions[info.region]
        const median = stats?.median ?? null
        const reachable = stats && stats.received > 0
        return (
          <button
            key={info.region}
            type="button"
            className="np-region-chip"
            style={{ '--rc': msColor(median) } as CSSProperties}
            aria-pressed={selected === info.region}
            onClick={() => onSelect(info.region)}
          >
            <div className="np-region-name">{REGION_BY_ID[info.region].label}</div>
            <div className="np-region-metro">{info.metro}</div>
            <div className="np-region-ping">
              {reachable ? fmt(median, 0) : '—'}
              <span className="u">ms</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
