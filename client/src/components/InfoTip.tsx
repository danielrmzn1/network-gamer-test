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
    <span className="np-infotip" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btnRef}
        type="button"
        className="np-infotip-btn"
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
              className="np-infotip-pop"
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
