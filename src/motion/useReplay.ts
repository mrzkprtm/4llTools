import { useEffect, useRef, type RefObject } from 'react'
import { reducedMotion } from './springs'

export const REPLAYS = {
  /** A fresh result: a brief orange tint that fades while the box settles up 3px. */
  refresh: [
    { transform: 'translateY(3px)', boxShadow: '0 0 0 3px var(--accent-soft)' },
    { transform: 'none', boxShadow: '0 0 0 0 transparent' },
  ],
  /** Chaos to order: slightly blurred and shrunk, then snapping sharp into place. */
  order: [
    { filter: 'blur(2px)', transform: 'scale(0.98)', opacity: 0.6 },
    { filter: 'blur(0)', transform: 'scale(1.004)', opacity: 1, offset: 0.7 },
    { filter: 'blur(0)', transform: 'none', opacity: 1 },
  ],
} satisfies Record<string, Keyframe[]>

/**
 * Plays a short animation on `ref` every time `trigger` changes (not on first render).
 * Pair it with useSettled so it plays once typing pauses.
 */
export function useReplay(ref: RefObject<HTMLElement | null>, trigger: unknown, kind: keyof typeof REPLAYS = 'refresh', duration = 380) {
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!ref.current || reducedMotion()) return
    ref.current.animate(REPLAYS[kind], { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
  }, [trigger])
}
