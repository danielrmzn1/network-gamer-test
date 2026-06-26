import type { ReactNode } from 'react'

/** Notched panel with the signature gold→teal gradient edge. */
export function Frame({
  children,
  hero = false,
  className = '',
}: {
  children: ReactNode
  hero?: boolean
  className?: string
}) {
  return (
    <div className={`np-frame ${hero ? 'hero' : ''} ${className}`.trim()}>
      <div className="np-frame-in">{children}</div>
    </div>
  )
}
