import type { CSSProperties } from 'react'
import type { ThroughputResult, BufferbloatResult } from '@shared/protocol'
import type { BloatGrade } from '@shared/grading'
import { fmtMbps, mbpsBarPct } from '../lib/format'
import { useLang, t, type Lang } from '../i18n'
import { InfoTip } from './InfoTip'

export function bloatColor(g: BloatGrade | null): string {
  if (g === 'A+' || g === 'A') return 'var(--color-good)'
  if (g === 'B') return 'var(--color-teal)'
  if (g === 'C') return 'var(--color-warn)'
  if (g === 'D' || g === 'F') return 'var(--color-bad)'
  return 'var(--color-ink-faint)'
}

const FILL = {
  down: 'bg-gradient-to-r from-teal-dim to-teal shadow-[0_0_10px_rgb(63_214_201/0.5)]',
  up: '[background:linear-gradient(90deg,var(--up-gold-a),var(--up-gold-b))] shadow-[0_0_10px_rgb(201_168_92/0.45)]',
} as const

interface Props {
  download: ThroughputResult | null
  upload: ThroughputResult | null
  liveDown: number
  liveUp: number
  bufferbloat: BufferbloatResult | null
}

function Bar({ label, dir, value, peak, lang }: { label: string; dir: 'down' | 'up'; value: number; peak?: number; lang: Lang }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span className="font-ui text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-lo">{label}</span>
        <span className="font-display text-2xl text-ink-hi">
          {fmtMbps(value)}
          <span className="font-ui text-xs text-ink-lo ml-1">Mbps</span>
        </span>
      </div>
      <div className="h-2 bg-white/[0.06] [clip-path:polygon(4px_0,100%_0,100%_100%,0_100%)] relative">
        <div
          className={`absolute inset-y-0 left-0 [transition:width_0.5s_cubic-bezier(0.16,1,0.3,1)] ${FILL[dir]}`}
          style={{ width: `${mbpsBarPct(value)}%` }}
        />
      </div>
      <div className="text-right text-[10px] tracking-[0.1em] uppercase text-ink-lo min-h-[1lh]">
        {peak != null && peak > 0 ? `${t(lang, 'peak')} ${fmtMbps(peak)} Mbps` : ' '}
      </div>
    </div>
  )
}

export function Meters({ download, upload, liveDown, liveUp, bufferbloat }: Props) {
  const lang = useLang()
  const dlVal = download?.meanMbps ?? liveDown
  const ulVal = upload?.meanMbps ?? liveUp
  const bb = bufferbloat

  return (
    <div className="p-[26px] flex flex-col justify-center gap-[22px] h-full">
      <Bar label={t(lang, 'download')} dir="down" value={dlVal} peak={download?.peakMbps} lang={lang} />
      <Bar label={t(lang, 'upload')} dir="up" value={ulVal} peak={upload?.peakMbps} lang={lang} />
      <div className="flex items-center justify-between [border-top:1px_solid_var(--gold-line)] pt-[18px]">
        <div>
          <div className="flex items-center gap-[7px] text-xs tracking-[0.16em] uppercase text-ink-body">
            {t(lang, 'bufferbloat')}
            <InfoTip label={t(lang, 'bufferbloatInfo')}>{t(lang, 'bufferbloatHelp')}</InfoTip>
          </div>
          <div className="text-xs text-ink-lo mt-[3px]">
            {!bb
              ? t(lang, 'latencyUnderLoad')
              : bb.available
                ? `+${Math.max(0, Math.round(bb.worstDeltaMs))} ms ${t(lang, 'latencyUnderLoad')}`
                : t(lang, 'couldntMeasure')}
          </div>
        </div>
        <div className="np-bloat-grade" style={{ '--g': bloatColor(bb?.grade ?? null) } as CSSProperties}>
          {bb ? (bb.grade ?? 'N/A') : '—'}
        </div>
      </div>
    </div>
  )
}
