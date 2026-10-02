/** Refresh rate estimation from requestAnimationFrame intervals. */

export const COMMON_HZ = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 170, 180, 200, 240, 280, 300, 360] as const

export function median(values: readonly number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export interface Estimate {
  /** Refresh rate straight from the median interval. */
  raw: number
  /** Rounded or snapped rate to show. */
  hz: number
  /** True when `hz` was snapped to a common panel rate. */
  snapped: boolean
  /** Median frame time in ms. */
  frameMs: number
  /** Standard deviation of the kept intervals, in ms. */
  jitter: number
  /** Intervals that looked like skipped frames (much longer than the median). */
  dropped: number
  samples: number
}

/**
 * Estimates the display refresh rate from frame intervals (ms). Uses the median so
 * dropped frames and hiccups do not drag the result down, then snaps to a common
 * rate when within `tolerance` (a fraction, 3% by default).
 */
export function estimateHz(intervals: readonly number[], tolerance = 0.03): Estimate {
  const clean = intervals.filter((v) => v > 0.5 && v < 250)
  const med = median(clean)
  if (!med) return { raw: 0, hz: 0, snapped: false, frameMs: 0, jitter: 0, dropped: 0, samples: 0 }
  const kept = clean.filter((v) => v < med * 1.5)
  const dropped = clean.length - kept.length
  const frameMs = median(kept)
  const raw = 1000 / frameMs
  let best: number = COMMON_HZ[0]
  for (const c of COMMON_HZ) if (Math.abs(c - raw) < Math.abs(best - raw)) best = c
  const snapped = Math.abs(best - raw) / best <= tolerance
  const mean = kept.reduce((s, v) => s + v, 0) / kept.length
  const jitter = Math.sqrt(kept.reduce((s, v) => s + (v - mean) ** 2, 0) / kept.length)
  return { raw, hz: snapped ? best : Math.round(raw), snapped, frameMs, jitter, dropped, samples: clean.length }
}

/** Frames per second from timestamps (ms) in the last `windowMs`. */
export function liveFps(stamps: readonly number[], now: number, windowMs = 1000): number {
  let n = 0
  let first = now
  for (let i = stamps.length - 1; i >= 0 && now - stamps[i] <= windowMs; i--) {
    n++
    first = stamps[i]
  }
  return n > 1 ? ((n - 1) * 1000) / (now - first || 1) : 0
}
