import type { PhaseName } from '@shared/protocol'
import type { Status } from '../state/store'
import { useLang, phaseShort } from '../i18n'

const STEPS: PhaseName[] = ['regions', 'loss', 'download', 'upload', 'compute']

const STEP = {
  pending: 'shadow-[inset_0_0_0_1px_var(--gold-line)] bg-white/[0.02]',
  done: 'shadow-[inset_0_0_0_1px_var(--teal-line)] bg-teal/5',
  active: 'shadow-[inset_0_0_0_1px_rgb(201_168_92/0.55)] bg-white/[0.02] animate-pulse-hud',
} as const
const NODE = { pending: 'text-ink-lo', done: 'text-teal', active: 'text-gold-light' } as const
const LABEL = { pending: 'text-ink-lo', done: 'text-ink-mid', active: 'text-gold-light' } as const

export function PhaseStepper({ phase, status }: { phase: PhaseName | null; status: Status }) {
  const lang = useLang()
  const activeIdx = phase ? STEPS.indexOf(phase) : -1
  return (
    <div className="mt-3.5 flex gap-2.5 flex-wrap">
      {STEPS.map((p, i) => {
        const done = status === 'done' || (activeIdx > -1 && i < activeIdx)
        const active = status === 'running' && i === activeIdx
        const state = done ? 'done' : active ? 'active' : 'pending'
        return (
          <div
            className={`flex items-center gap-2 px-4 py-[7px] [clip-path:var(--cut-8)] ${STEP[state]}`}
            key={p}
          >
            <span className={`font-ui text-xs ${NODE[state]}`}>{done ? '✓' : i + 1}</span>
            <span className={`text-xs tracking-[0.16em] uppercase ${LABEL[state]}`}>
              {phaseShort(lang, p)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
