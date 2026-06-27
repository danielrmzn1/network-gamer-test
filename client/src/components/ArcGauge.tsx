import type { CSSProperties } from 'react'
import type { Tone } from '../lib/tone'

interface Props {
  value: number | null
  max: number
  unit: string
  name: string
  tone: Tone
  decimals?: number
  stateLabel?: string
}

const R = 52
const CX = 60
const CY = 60
const SW = 10
const C = 2 * Math.PI * R
const ARC = 0.75 * C // 270° sweep

const TONE: Record<Tone, string> = {
  good: 'var(--color-teal)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)',
  neutral: 'var(--color-teal-dim)',
}

export function ArcGauge({ value, max, unit, name, tone, decimals = 0, stateLabel }: Props) {
  const frac = value == null || !Number.isFinite(value) ? 0 : Math.min(1, Math.max(0, value / max))
  const offset = ARC * (1 - frac)
  const display = value == null || !Number.isFinite(value) ? '—' : value.toFixed(decimals)

  return (
    <div className="flex flex-col items-center gap-3" style={{ '--g-color': TONE[tone] } as CSSProperties}>
      <svg className="w-32 h-32 overflow-visible" viewBox="0 0 120 120" role="img" aria-label={`${name}: ${display} ${unit}`}>
        <g transform={`rotate(135 ${CX} ${CY})`}>
          <circle
            className="stroke-white/[0.06]"
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${C}`}
          />
          <circle
            className="stroke-[var(--g-color)] [filter:drop-shadow(0_0_6px_var(--g-color))] [transition:stroke-dashoffset_0.9s_cubic-bezier(0.16,1,0.3,1),stroke_0.4s_ease]"
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${C}`}
            strokeDashoffset={offset}
          />
        </g>
        <text className="font-display text-[30px] fill-ink-hi" x={CX} y={58} textAnchor="middle" dominantBaseline="middle">
          {display}
        </text>
        <text className="font-ui text-xs fill-ink-lo" x={CX} y={78} textAnchor="middle">
          {unit}
        </text>
      </svg>
      <span className="text-xs tracking-[0.18em] uppercase text-ink-mid">{name}</span>
      <span className="text-[11px] tracking-[0.16em] uppercase [color:var(--g-color)] mt-[3px]">{stateLabel ?? ' '}</span>
    </div>
  )
}
