export interface Histogram {
  r: number[]
  g: number[]
  b: number[]
  lum: number[]
}

export interface HistogramStats {
  mean: number
  median: number
  shadowsClipped: number
  highlightsClipped: number
}

export const BUCKETS = 256

/** Rec. 709 relative luminance, rounded to a bucket index. */
export function luminance(r: number, g: number, b: number): number {
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
}

const zeroed = () => new Array<number>(BUCKETS).fill(0)
const bucket = (v: number) => (Number.isFinite(v) ? Math.min(BUCKETS - 1, Math.max(0, Math.round(v))) : 0)

/** Counts how often each 0…255 value appears, per channel and for luminance. */
export function buildHistogram(data: ArrayLike<number>): Histogram {
  const hist: Histogram = { r: zeroed(), g: zeroed(), b: zeroed(), lum: zeroed() }
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    const r = bucket(data[i])
    const g = bucket(data[i + 1])
    const b = bucket(data[i + 2])
    hist.r[r]++
    hist.g[g]++
    hist.b[b]++
    hist.lum[bucket(luminance(r, g, b))]++
  }
  return hist
}

/**
 * Mean and median tone of the luminance histogram plus the share of pixels
 * sitting in the darkest and brightest five buckets.
 */
export function stats(hist: Histogram): HistogramStats {
  const total = hist.lum.reduce((n, v) => n + v, 0)
  if (total === 0) return { mean: 0, median: 0, shadowsClipped: 0, highlightsClipped: 0 }

  let sum = 0
  for (let i = 0; i < BUCKETS; i++) sum += i * hist.lum[i]

  let running = 0
  let median = 0
  for (let i = 0; i < BUCKETS; i++) {
    running += hist.lum[i]
    if (running >= total / 2) {
      median = i
      break
    }
  }

  const dark = hist.lum.slice(0, 5).reduce((n, v) => n + v, 0)
  const light = hist.lum.slice(BUCKETS - 5).reduce((n, v) => n + v, 0)
  return {
    mean: sum / total,
    median,
    shadowsClipped: (dark / total) * 100,
    highlightsClipped: (light / total) * 100,
  }
}
