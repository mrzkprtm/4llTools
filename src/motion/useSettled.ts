import { useEffect, useRef, useState } from 'react'

/**
 * Counts how many times `value` has changed and then stayed put for `delay` ms.
 * Use it as a React key to replay a "done" animation once typing pauses.
 */
export function useSettled(value: unknown, delay = 400): number {
  const [n, setN] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => setN((x) => x + 1), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return n
}
