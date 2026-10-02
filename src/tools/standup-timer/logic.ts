import { rng } from '../../sim/math'

/** Fisher–Yates shuffle. Pass a seed for a repeatable order; without one it uses Math.random. */
export function shuffle<T>(items: readonly T[], seed?: number): T[] {
  const random = seed === undefined ? Math.random : rng(seed)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** A shuffle that never leaves the list in the same order it started (when that is possible). */
export function freshShuffle<T>(items: readonly T[], seed?: number): T[] {
  if (items.length < 2) return [...items]
  for (let k = 0; k < 20; k++) {
    const out = shuffle(items, seed === undefined ? undefined : seed + k)
    if (out.some((x, i) => x !== items[i])) return out
  }
  return [...items.slice(1), items[0]]
}

export interface Turn {
  name: string
  start: number
  end: number
}

/** Planned turns for everyone, in seconds from the start, with per-person extra time. */
export function planTurns(names: readonly string[], seconds: number, extra: readonly number[] = []): Turn[] {
  let t = 0
  return names.map((name, i) => {
    const start = t
    t += seconds + (extra[i] ?? 0)
    return { name, start, end: t }
  })
}

/** Index of the turn running at time t, or -1 once everyone is done. */
export function turnAt(turns: readonly Turn[], t: number): number {
  return turns.findIndex((x) => t >= x.start && t < x.end)
}

/** "m:ss" */
export function mmss(s: number): string {
  const v = Math.max(0, Math.ceil(s))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}
