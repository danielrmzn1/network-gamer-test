import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const MAX_W = 280
const MARGIN = 12
const GAP = 9

interface Placement {
  top: number
  left: number
  width: number
}

/**
 * Small "i" info button with an accessible explanatory tooltip.
 * The bubble renders in a portal (position: fixed) so it escapes the
 * clip-path / overflow of notched panels, and clamps to the viewport.
 */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<Placement | null>(null)

  const place = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.min(MAX_W, window.innerWidth - MARGIN * 2)
    const center = r.left + r.width / 2
    // Left-align the bubble to the icon, then clamp inside the viewport.
    let left = Math.min(center - 24, window.innerWidth - MARGIN - width)
    left = Math.max(MARGIN, left)
    setPos({ top: r.top - GAP, left, width })
  }, [])

  const show = useCallback(() => place(), [place])
  const hide = useCallback(() => setPos(null), [])

  // A fixed-position bubble goes stale on scroll/resize — dismiss it.
  useEffect(() => {
    if (!pos) return
    const onMove = () => hide()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [pos, hide])

  const open = pos != null

  return (
    <span className="inline-flex leading-[0]" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btnRef}
        type="button"
        className="inline-grid place-items-center w-[17px] h-[17px] p-0 m-0 border-0 rounded-full bg-transparent text-ink-lo cursor-pointer [transition:color_0.15s_ease,box-shadow_0.15s_ease] [-webkit-tap-highlight-color:transparent] hover:text-teal focus-visible:text-teal focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-teal)_55%,transparent)]"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide()
        }}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="8" cy="4.7" r="0.95" fill="currentColor" />
          <rect x="7.15" y="6.7" width="1.7" height="5" rx="0.85" fill="currentColor" />
        </svg>
      </button>
      {open
        ? createPortal(
            <span
              role="tooltip"
              id={id}
              className="fixed z-[1000] -translate-y-full px-3.5 py-3 font-ui text-[12.5px] font-medium leading-normal tracking-normal normal-case text-ink-mid [background:linear-gradient(150deg,var(--color-panel-2),var(--color-inset))] [clip-path:var(--cut-8)] shadow-[inset_0_0_0_1px_var(--gold-line-strong),0_12px_34px_rgb(0_0_0/0.55)] pointer-events-none animate-infotip-in motion-reduce:animate-none"
              style={
                {
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                } as CSSProperties
              }
            >
              {children}
            </span>,
            document.body,
          )
        : null}
    </span>
  )
}
