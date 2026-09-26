/** Click speed, switch bounce detection, polling-rate and wheel-step estimates. */

export const BOUNCE_MS = 80

/** Clicks per second over a test of `durationMs`. */
export function cps(clicks: number, durationMs: number): number {
  return durationMs > 0 ? clicks / (durationMs / 1000) : 0
}

export interface Bounce {
  t: number
  gap: number
}

/**
 * Finds presses of the same button that follow the previous one faster than a
 * finger can (default 80 ms): the classic sign of a worn switch double-clicking.
 */
export function findBounces(downTimes: readonly number[], threshold = BOUNCE_MS): Bounce[] {
  const out: Bounce[] = []
  for (let i = 1; i < downTimes.length; i++) {
    const gap = downTimes[i] - downTimes[i - 1]
    if (gap >= 0 && gap < threshold) out.push({ t: downTimes[i], gap })
  }
  return out
}

export const POLL_RATES = [125, 250, 500, 1000, 2000, 4000, 8000] as const

/**
 * Estimates the mouse polling rate from event timestamps (ms). Uses the median
 * interval of distinct timestamps, then snaps to a standard USB rate when close.
 */
export function pollingRate(stamps: readonly number[]): { hz: number; raw: number } {
  const iv: number[] = []
  for (let i = 1; i < stamps.length; i++) {
    const d = stamps[i] - stamps[i - 1]
    if (d > 0.05 && d < 50) iv.push(d)
  }
  if (iv.length < 5) return { hz: 0, raw: 0 }
  iv.sort((a, b) => a - b)
  const med = iv[iv.length >> 1]
  const raw = 1000 / med
  let best: number = POLL_RATES[0]
  for (const r of POLL_RATES) if (Math.abs(Math.log(r / raw)) < Math.abs(Math.log(best / raw))) best = r
  return { hz: Math.abs(best - raw) / best < 0.2 ? best : Math.round(raw), raw }
}

/** Approximate wheel notches for one wheel event (pixel mode ≈ 100–120 px per notch, line mode ≈ 3 lines). */
export function wheelSteps(delta: number, deltaMode: number): number {
  if (delta === 0) return 0
  const per = deltaMode === 1 ? 3 : deltaMode === 2 ? 1 : 100
  return Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / per))
}

export const BUTTONS = ['Left', 'Middle', 'Right', 'Back', 'Forward'] as const
