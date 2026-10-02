/** Tap-tempo estimation with outlier rejection. Times are in milliseconds. */

export const RESET_GAP = 2000

export interface Estimate {
  bpm: number
  /** Standard deviation of the kept intervals, ms. */
  sd: number
  /** 0 (all over the place) … 1 (machine steady). */
  stability: number
  /** Intervals used, ms. */
  kept: number[]
  /** Intervals thrown away as outliers, by index into all intervals. */
  rejected: number[]
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const intervals = (times: number[]) => times.slice(1).map((t, i) => t - times[i])

/**
 * BPM from the most recent taps. Intervals more than 25% away from the median
 * are rejected, except near-doubles (a skipped tap), which count as two beats.
 */
export function estimateBpm(times: number[], window = 16): Estimate | null {
  const all = intervals(times.slice(-window - 1))
  if (!all.length) return null
  const med = median(all)
  const kept: number[] = []
  const rejected: number[] = []
  all.forEach((d, i) => {
    if (Math.abs(d - med) <= med * 0.25) kept.push(d)
    else if (all.length >= 4 && Math.abs(d - 2 * med) <= med * 0.2) kept.push(d / 2)
    else rejected.push(i)
  })
  if (!kept.length) return null
  const mean = kept.reduce((a, b) => a + b, 0) / kept.length
  const sd = Math.sqrt(kept.reduce((a, b) => a + (b - mean) ** 2, 0) / kept.length)
  const cv = sd / mean
  return { bpm: 60000 / mean, sd, stability: Math.max(0, Math.min(1, 1 - cv * 8)), kept, rejected }
}

/** A new tap starts a fresh run when the previous tap is older than RESET_GAP. */
export function addTap(times: number[], now: number, gap = RESET_GAP): number[] {
  const last = times[times.length - 1]
  if (last !== undefined && now - last > gap) return [now]
  return [...times.slice(-31), now]
}

export function steadiness(stability: number): string {
  if (stability > 0.85) return 'Rock steady'
  if (stability > 0.65) return 'Steady'
  if (stability > 0.4) return 'A bit loose'
  return 'All over the place'
}
