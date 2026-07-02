import { useEffect, useState } from 'react'
import type { NetReport } from '@shared/protocol'
import type { Game } from '@shared/catalog.types'
import { useLang, t, type StrKey } from '../i18n'
import { shareResult, type ShareOutcome } from '../lib/shareCard'

type BtnState = 'idle' | 'busy' | ShareOutcome

const FEEDBACK: Partial<Record<BtnState, StrKey>> = {
  copied: 'shareCopied',
  downloaded: 'shareDownloaded',
  failed: 'shareFailed',
}

/**
 * Renders the report as a 1200×630 share-card PNG and hands it to the native
 * share sheet / clipboard / a download (see lib/shareCard.ts). Only mounted
 * once a report exists, so the SSG prerender never reaches it.
 */
export function ShareButton({ report, game, compact }: { report: NetReport; game: Game; compact?: boolean }) {
  const lang = useLang()
  const [state, setState] = useState<BtnState>('idle')

  // Let copy/download/failure feedback linger briefly, then re-arm the button.
  useEffect(() => {
    if (!FEEDBACK[state]) return
    const id = setTimeout(() => setState('idle'), 2500)
    return () => clearTimeout(id)
  }, [state])

  const onClick = (): void => {
    if (state === 'busy') return
    setState('busy')
    void shareResult(report, game, lang).then((outcome) =>
      // 'shared'/'cancelled' need no confirmation — the OS sheet was the feedback.
      setState(outcome === 'shared' || outcome === 'cancelled' ? 'idle' : outcome),
    )
  }

  const label = t(lang, FEEDBACK[state] ?? 'share')
  return (
    <button
      type="button"
      className={`font-ui font-semibold tracking-[0.16em] uppercase text-teal bg-transparent border-none [clip-path:var(--cut-8)] shadow-[inset_0_0_0_1px_var(--teal-line)] [transition:all_0.16s_ease] hover:shadow-[inset_0_0_0_1px_rgb(63_214_201/0.55),0_0_14px_rgb(63_214_201/0.22)] disabled:opacity-70 disabled:cursor-progress ${
        compact ? 'w-full text-[12px] px-4 py-2.5' : 'text-[13px] px-6 py-3'
      }`}
      onClick={onClick}
      disabled={state === 'busy'}
      aria-live="polite"
    >
      {state === 'busy' ? '…' : label}
    </button>
  )
}
