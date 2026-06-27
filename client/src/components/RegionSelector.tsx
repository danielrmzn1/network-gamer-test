import type { CSSProperties } from 'react'
import type { ProbeStats } from '@shared/protocol'
import type { Region } from '@shared/catalog.types'
import { REGIONS, REGION_BY_ID } from '@shared/regions'
import { fmt } from '../lib/format'

function msColor(median: number | null): string {
  if (median == null) return 'var(--color-ink-faint)'
  if (median <= 60) return 'var(--color-teal)'
  if (median <= 130) return 'var(--color-warn)'
  return 'var(--color-bad)'
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
    <div className="grid grid-cols-5 gap-3 max-[980px]:grid-cols-3 max-[760px]:grid-cols-2 max-[460px]:grid-cols-1">
      {REGIONS.filter((info) => allow.size === 0 || allow.has(info.region)).map((info) => {
        const stats = regions[info.region]
        const median = stats?.median ?? null
        const reachable = stats && stats.received > 0
        return (
          <button
            key={info.region}
            type="button"
            className="text-left border-none px-4 py-3.5 [clip-path:var(--cut-12)] [background:linear-gradient(150deg,#0e1d2b,#0a1521)] shadow-[inset_0_0_0_1px_var(--gold-line)] [transition:box-shadow_0.18s_ease] hover:shadow-[inset_0_0_0_1px_var(--gold-line-strong)] aria-pressed:[background:linear-gradient(150deg,rgb(201_168_92/0.12),#0c1a28)] aria-pressed:shadow-[inset_0_0_0_1px_rgb(201_168_92/0.5),0_0_16px_rgb(201_168_92/0.18)]"
            style={{ '--rc': msColor(median) } as CSSProperties}
            aria-pressed={selected === info.region}
            onClick={() => onSelect(info.region)}
          >
            <div className="text-xs tracking-[0.14em] uppercase text-ink-mid">{REGION_BY_ID[info.region].label}</div>
            <div className="text-[11px] text-ink-lo mt-0.5">{info.metro}</div>
            <div className="mt-2.5 font-display text-[26px] [color:var(--rc)]">
              {reachable ? fmt(median, 0) : '—'}
              <span className="font-ui text-[11px] text-ink-lo ml-[3px]">ms</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
