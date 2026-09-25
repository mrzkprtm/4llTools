import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from './springs'

const POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789'

/**
 * Returns `text`, but whenever it changes the characters cycle through random
 * ones and lock into place from left to right, like a slot machine.
 * Only the first `limit` characters scramble; the rest appear at once.
 */
export function useScramble(text: string, { duration = 260, limit = 48, pool = POOL } = {}): string {
  const [shown, setShown] = useState(text)
  const first = useRef(true)

  useEffect(() => {
    if (first.current || reducedMotion() || !text) {
      first.current = false
      setShown(text)
      return
    }
    const n = Math.min(text.length, limit)
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = (now - start) / duration
      let out = ''
      for (let i = 0; i < n; i++) {
        // Each position locks at a staggered time, left to right.
        const lockAt = 0.35 + (0.65 * i) / Math.max(1, n - 1)
        const ch = text[i]
        out += t >= lockAt || /\s/.test(ch) ? ch : pool[(Math.random() * pool.length) | 0]
      }
      setShown(out + text.slice(n))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setShown(text)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, duration, limit, pool])

  return shown
}

/** Inline text that scrambles into each new value. */
export function Scramble({ text, ...opts }: { text: string; duration?: number; limit?: number; pool?: string }) {
  return useScramble(text, opts)
}
