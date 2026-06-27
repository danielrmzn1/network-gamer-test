export function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2.5 mx-0.5 mb-2.5">
      <span className="w-1.5 h-1.5 bg-teal rotate-45 shadow-[0_0_7px_var(--color-teal)] shrink-0" />
      <span className="font-ui font-semibold tracking-[0.2em] text-[11px] text-gold uppercase whitespace-nowrap">{children}</span>
      <span className="flex-1 h-px [background:linear-gradient(90deg,var(--gold-line-strong),transparent)]" />
    </div>
  )
}
