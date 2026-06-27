import type { CSSProperties } from 'react'
import type { EngineState } from '../../state/store'
import type { Region } from '@shared/catalog.types'
import type { Lang } from '../../i18n'
import { REGIONS, REGION_BY_ID } from '@shared/regions'
import { gameRegions } from '@shared/catalog'
import { msColor } from '../RegionSelector'
import { fmt } from '../../lib/format'
import { t } from '../../i18n'
import { SectionTitle } from './SectionTitle'

export interface MobileRegionsProps {
  s: EngineState
  lang: Lang
  onPickRegion: (r: Region) => void
}

const CHIP_SEL = '[clip-path:var(--cut-10)] [background:linear-gradient(150deg,rgb(201_168_92/0.12),#0c1a28)] shadow-[inset_0_0_0_1px_rgb(201_168_92/0.5),0_0_14px_rgb(201_168_92/0.16)]'
const CHIP_DEF = '[clip-path:var(--cut-10)] [background:linear-gradient(150deg,#0e1d2b,#0a1521)] shadow-[inset_0_0_0_1px_rgb(201_168_92/0.16)]'

export function MobileRegions({ s, lang, onPickRegion }: MobileRegionsProps) {
  const allow = new Set(gameRegions(s.selectedGameId))
  const list = REGIONS.filter((info) => allow.size === 0 || allow.has(info.region))
    .map((info) => {
      const stats = s.regions[info.region]
      const reachable = Boolean(stats && stats.received > 0)
      const median = reachable ? stats!.median : null
      return { info, median, reachable }
    })
    .sort((a, b) => (a.median ?? Infinity) - (b.median ?? Infinity))

  const maxMedian = Math.max(1, ...list.map((r) => r.median ?? 0))

  return (
    <div>
      <SectionTitle>{t(lang, 'regionMap')}</SectionTitle>

      <div className="grid grid-cols-2 gap-2.5">
        {list.map(({ info, median, reachable }) => {
          const sel = s.selectedRegion === info.region
          const color = msColor(median)
          const pct = reachable && median != null ? Math.round((median / maxMedian) * 100) : 0
          return (
            <button
              key={info.region}
              type="button"
              aria-pressed={sel}
              onClick={() => onPickRegion(info.region)}
              className={`relative overflow-hidden text-left border-none w-full py-2.5 px-3 ${sel ? CHIP_SEL : CHIP_DEF}`}
              style={{ '--rc': color } as CSSProperties}
            >
              <div className="text-[11px] tracking-[0.12em] uppercase text-ink-mid whitespace-nowrap overflow-hidden text-ellipsis">{REGION_BY_ID[info.region].label}</div>
              <div className="text-[10px] text-ink-lo mt-px whitespace-nowrap overflow-hidden text-ellipsis">{info.metro}</div>
              <div className="mt-1.5">
                <span className="font-display text-[23px] [color:var(--rc)]">{reachable ? fmt(median, 0) : '—'}</span>
                <span className="font-ui text-[10px] text-ink-lo"> ms</span>
              </div>
              <div className="h-1 mt-1.5 bg-white/[0.06] rounded-sm overflow-hidden">
                <div className="h-full bg-[var(--rc)] shadow-[0_0_6px_var(--rc)] [transition:width_0.9s_cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${pct}%` }} />
              </div>
            </button>
          )
        })}
      </div>

      {s.mode === 'hosted' && (
        <p className="mt-2.5 text-xs leading-normal text-ink-faint">
          {Object.values(s.regions).some((r) => r.received > 0) ? t(lang, 'hostedRegionNote') : t(lang, 'hostedRegionUnreachable')}
        </p>
      )}
    </div>
  )
}
