import type { CSSProperties } from 'react'
import type { ThroughputResult, BufferbloatResult } from '@shared/protocol'
import type { BloatGrade } from '@shared/grading'
import { fmtMbps, mbpsBarPct } from '../lib/format'
import { useLang, t, type Lang } from '../i18n'
import { InfoTip } from './InfoTip'

function bloatColor(g: BloatGrade | null): string {
  if (g === 'A+' || g === 'A') return 'var(--good)'
  if (g === 'B') return 'var(--teal)'
  if (g === 'C') return 'var(--warn)'
  if (g === 'D' || g === 'F') return 'var(--bad)'
  return 'var(--text-faint)'
}

interface Props {
  download: ThroughputResult | null
  upload: ThroughputResult | null
  liveDown: number
  liveUp: number
  bufferbloat: BufferbloatResult | null
}

function Bar({ label, dir, value, peak, lang }: { label: string; dir: 'down' | 'up'; value: number; peak?: number; lang: Lang }) {
  return (
    <div className="np-meter-row">
      <div className="np-meter-head">
        <span className="np-label">{label}</span>
        <span className="np-meter-val">
          {fmtMbps(value)}
          <span className="u">Mbps</span>
        </span>
      </div>
      <div className="np-meter-track">
        <div className={`np-meter-fill ${dir}`} style={{ width: `${mbpsBarPct(value)}%` }} />
      </div>
      <div className="np-meter-max">
        {peak != null && peak > 0 ? `${t(lang, 'peak')} ${fmtMbps(peak)} Mbps` : ' '}
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
    <div className="np-meters">
      <Bar label={t(lang, 'download')} dir="down" value={dlVal} peak={download?.peakMbps} lang={lang} />
      <Bar label={t(lang, 'upload')} dir="up" value={ulVal} peak={upload?.peakMbps} lang={lang} />
      <div className="np-bloat">
        <div>
          <div className="np-bloat-label">
            {t(lang, 'bufferbloat')}
            <InfoTip label={t(lang, 'bufferbloatInfo')}>{t(lang, 'bufferbloatHelp')}</InfoTip>
          </div>
          <div className="np-bloat-detail">
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
