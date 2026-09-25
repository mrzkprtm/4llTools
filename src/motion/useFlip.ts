import { useLayoutEffect, useRef, type RefObject } from 'react'
import { reducedMotion, SPRINGS, type SpringName } from './springs'

type Opts = { spring?: SpringName; max?: number; enter?: boolean }

/**
 * Layout morphing (FLIP). Children of `ref` that carry a `data-flip` key are
 * measured after every render; when one moves, it animates from its old
 * position to the new one on a spring. New children fade and rise in.
 * Only the first `max` children animate, so long lists stay fast.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, { spring = 'snap', max = 120, enter = true }: Opts = {}) {
  const last = useRef(new Map<string, DOMRect>())
  const ready = useRef(false)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const items = [...root.querySelectorAll<HTMLElement>('[data-flip]')].slice(0, max)
    const base = root.getBoundingClientRect()
    const next = new Map<string, DOMRect>()
    const animate = ready.current && !reducedMotion()
    const { easing, duration } = SPRINGS[spring]

    items.forEach((el, i) => {
      const key = el.dataset.flip!
      const r = el.getBoundingClientRect()
      const rel = new DOMRect(r.left - base.left, r.top - base.top, r.width, r.height)
      next.set(key, rel)
      if (!animate) return
      const prev = last.current.get(key)
      if (!prev) {
        if (enter) el.animate([{ opacity: 0, transform: 'translateY(6px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', delay: Math.min(i, 12) * 14, fill: 'backwards' })
        return
      }
      const dx = prev.left - rel.left
      const dy = prev.top - rel.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing })
    })
    last.current = next
    ready.current = true
  })
}

/** Animates an element's height from its previous size to its new one after each render. */
export function useFlipHeight(ref: RefObject<HTMLElement | null>, spring: SpringName = 'soft') {
  const last = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const h = el.getBoundingClientRect().height
    const prev = last.current
    last.current = h
    if (prev === null || Math.abs(prev - h) < 2 || reducedMotion()) return
    const { easing, duration } = SPRINGS[spring]
    el.animate([{ height: `${prev}px`, overflow: 'hidden' }, { height: `${h}px`, overflow: 'hidden' }], { duration, easing })
  })
}
