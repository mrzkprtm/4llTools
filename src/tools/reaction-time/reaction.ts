/** Reaction-time statistics and a comparison with typical human results. */

/** Typical simple visual reaction time on a web test: roughly normal, mean ~273 ms, sd ~50 ms (approximate). */
export const TYPICAL = { simple: { mean: 273, sd: 50 }, choice: { mean: 380, sd: 65 } } as const
export type Mode = keyof typeof TYPICAL

export interface Stats {
  count: number
  mean: number
  median: number
  best: number
  worst: number
  sd: number
}

export function stats(values: number[]): Stats {
  const v = values.filter((x) => Number.isFinite(x))
  if (!v.length) return { count: 0, mean: 0, median: 0, best: 0, worst: 0, sd: 0 }
  const sorted = [...v].sort((a, b) => a - b)
  const mean = v.reduce((s, x) => s + x, 0) / v.length
  const mid = sorted.length >> 1
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const sd = v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (v.length - 1)) : 0
  return { count: v.length, mean, median, best: sorted[0], worst: sorted[sorted.length - 1], sd }
}

/** Error function (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function erf(x: number): number {
  const s = Math.sign(x)
  const a = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * a)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)
  return s * y
}

export function normalCdf(x: number, mean: number, sd: number): number {
  return 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)))
}

export function normalPdf(x: number, mean: number, sd: number): number {
  return Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI))
}

/** Percent of people you are faster than (0–100) for an average time in ms. */
export function fasterThan(ms: number, mode: Mode = 'simple'): number {
  const { mean, sd } = TYPICAL[mode]
  return (1 - normalCdf(ms, mean, sd)) * 100
}

/** A random wait before the signal, in ms (1.5–5 s by default). */
export function randomDelay(random: () => number = Math.random, min = 1500, max = 5000): number {
  return min + random() * (max - min)
}

export function verdict(ms: number, mode: Mode = 'simple'): string {
  const p = fasterThan(ms, mode)
  if (p >= 95) return 'Lightning fast'
  if (p >= 75) return 'Very quick'
  if (p >= 45) return 'About average'
  if (p >= 20) return 'A little slow'
  return 'Take a breath and try again'
}
