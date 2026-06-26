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

export function ArcGauge({ value, max, unit, name, tone, decimals = 0, stateLabel }: Props) {
  const frac = value == null || !Number.isFinite(value) ? 0 : Math.min(1, Math.max(0, value / max))
  const offset = ARC * (1 - frac)
  const display = value == null || !Number.isFinite(value) ? '—' : value.toFixed(decimals)

  return (
    <div className={`np-gauge tone-${tone}`}>
      <svg viewBox="0 0 120 120" role="img" aria-label={`${name}: ${display} ${unit}`}>
        <g transform={`rotate(135 ${CX} ${CY})`}>
          <circle
            className="np-gauge-track"
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${C}`}
          />
          <circle
            className="np-gauge-fill"
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
        <text className="np-gauge-value" x={CX} y={58} textAnchor="middle" dominantBaseline="middle">
          {display}
        </text>
        <text className="np-gauge-unit" x={CX} y={78} textAnchor="middle">
          {unit}
        </text>
      </svg>
      <span className="np-gauge-name">{name}</span>
      <span className="np-gauge-state">{stateLabel ?? ' '}</span>
    </div>
  )
}
