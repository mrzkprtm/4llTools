import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'

/**
 * A row of toggle buttons where the active one (`.btn.primary`) sits on an
 * orange pill that slides between buttons on a spring.
 */
export default function PillRow({ children, className = '', style, label, role }: { children: ReactNode; className?: string; style?: CSSProperties; label?: string; role?: string }) {
  const row = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  useLayoutEffect(() => {
    const r = row.current
    const p = pill.current
    if (!r || !p) return
    const place = () => {
      const active = r.querySelector<HTMLElement>(':scope > .btn.primary')
      if (!active) {
        p.style.opacity = '0'
        return
      }
      p.style.opacity = '1'
      p.style.width = `${active.offsetWidth}px`
      p.style.height = `${active.offsetHeight}px`
      p.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`
    }
    if (!placed.current) {
      p.style.transition = 'none'
      place()
      void p.offsetWidth
      p.style.transition = ''
      placed.current = true
    } else place()
    const ro = new ResizeObserver(place)
    ro.observe(r)
    return () => ro.disconnect()
  })

  return (
    <div ref={row} className={`row pill-row ${className}`} style={style} role={role ?? (label ? 'group' : undefined)} aria-label={label}>
      <span ref={pill} className="pill" aria-hidden="true" />
      {children}
    </div>
  )
}
