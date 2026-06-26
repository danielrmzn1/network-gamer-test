import type { PhaseName } from '@shared/protocol'
import type { Status } from '../state/store'
import { useLang, phaseShort } from '../i18n'

const STEPS: PhaseName[] = ['regions', 'loss', 'download', 'upload', 'compute']

export function PhaseStepper({ phase, status }: { phase: PhaseName | null; status: Status }) {
  const lang = useLang()
  const activeIdx = phase ? STEPS.indexOf(phase) : -1
  return (
    <div className="np-stepper">
      {STEPS.map((p, i) => {
        const done = status === 'done' || (activeIdx > -1 && i < activeIdx)
        const active = status === 'running' && i === activeIdx
        const stateCls = done ? 'done' : active ? 'active' : 'pending'
        return (
          <div className={`np-step ${stateCls}`} key={p}>
            <span className="np-step-node">{done ? '✓' : i + 1}</span>
            <span className="np-step-label">{phaseShort(lang, p)}</span>
          </div>
        )
      })}
    </div>
  )
}
