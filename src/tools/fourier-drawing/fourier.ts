/** Discrete Fourier transform of a closed 2D path, for drawing it with epicycles. */

export type Pt = [number, number]

export interface Term {
  /** Signed frequency in turns per lap (−N/2 … N/2). */
  freq: number
  /** Radius of the circle. */
  amp: number
  /** Starting angle in radians. */
  phase: number
  re: number
  im: number
}

const TAU = Math.PI * 2

/** Total length of a path, including the closing segment when `closed`. */
export function pathLength(path: Pt[], closed = true): number {
  let len = 0
  for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
  if (closed && path.length > 1) len += Math.hypot(path[0][0] - path[path.length - 1][0], path[0][1] - path[path.length - 1][1])
  return len
}

/** `n` points spaced evenly by arc length along a path (closed by default, so the last point is not the first). */
export function resample(path: Pt[], n: number, closed = true): Pt[] {
  if (!path.length || n <= 0) return []
  const pts = closed ? [...path, path[0]] : path
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const total = cum[cum.length - 1]
  if (total === 0) return Array.from({ length: n }, () => [path[0][0], path[0][1]] as Pt)
  const out: Pt[] = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const d = closed ? (i / n) * total : (i / Math.max(1, n - 1)) * total
    while (j < cum.length - 2 && cum[j + 1] < d) j++
    const seg = cum[j + 1] - cum[j] || 1
    const u = Math.min(1, Math.max(0, (d - cum[j]) / seg))
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u])
  }
  return out
}

/**
 * Complex DFT of the points (x + iy): X_k = 1/N Σ z_n e^(−2πikn/N).
 * Frequencies above N/2 are reported as negative, which gives the smoothest curve between samples.
 */
export function dft(points: Pt[]): Term[] {
  const N = points.length
  const cos = new Float64Array(N)
  const sin = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    cos[i] = Math.cos((TAU * i) / N)
    sin[i] = Math.sin((TAU * i) / N)
  }
  const out: Term[] = []
  for (let k = 0; k < N; k++) {
    let re = 0
    let im = 0
    for (let n = 0; n < N; n++) {
      const idx = (k * n) % N
      const [x, y] = points[n]
      re += x * cos[idx] + y * sin[idx]
      im += y * cos[idx] - x * sin[idx]
    }
    re /= N
    im /= N
    out.push({ freq: k <= N / 2 ? k : k - N, amp: Math.hypot(re, im), phase: Math.atan2(im, re), re, im })
  }
  return out
}

/** Terms sorted from the biggest circle to the smallest. */
export function sortByAmp(terms: Term[]): Term[] {
  return [...terms].sort((a, b) => b.amp - a.amp)
}

/** The tip of the epicycle chain made from the first `count` terms at lap fraction t ∈ [0, 1). */
export function epicycleSum(terms: Term[], count: number, t: number): Pt {
  let x = 0
  let y = 0
  const n = Math.min(count, terms.length)
  for (let i = 0; i < n; i++) {
    const { freq, amp, phase } = terms[i]
    const a = TAU * freq * t + phase
    x += amp * Math.cos(a)
    y += amp * Math.sin(a)
  }
  return [x, y]
}

/** Share of the path's "energy" (Σ amp²) captured by the first `count` terms, 0…1. */
export function energyShare(terms: Term[], count: number): number {
  let used = 0
  let total = 0
  terms.forEach((t, i) => {
    total += t.amp * t.amp
    if (i < count) used += t.amp * t.amp
  })
  return total > 0 ? used / total : 1
}

/** Built-in shapes as closed outlines roughly within [−1, 1]², y pointing down. */
export const PRESETS = [
  ['heart', 'Heart'],
  ['star', 'Star'],
  ['note', 'Music note'],
  ['pi', 'π'],
  ['wave', 'Wave'],
] as const
export type Preset = (typeof PRESETS)[number][0]

export function presetPath(kind: Preset): Pt[] {
  const out: Pt[] = []
  if (kind === 'heart') {
    for (let i = 0; i < 200; i++) {
      const t = (i / 200) * TAU
      const x = 16 * Math.sin(t) ** 3
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
      out.push([x / 17, -y / 17 - 0.1])
    }
  } else if (kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? 0.42 : 1
      out.push([r * Math.cos(a), r * Math.sin(a) + 0.08])
    }
  } else if (kind === 'note') {
    out.push([0.08, 0.45], [0.08, -0.5], [0.24, -0.4], [0.4, -0.24], [0.46, -0.02], [0.52, -0.26], [0.44, -0.52], [0.26, -0.7], [0.12, -0.86], [0.08, -0.96], [-0.04, -0.96], [-0.04, 0.42])
    // The note head: a tilted ellipse around (−0.26, 0.56), from the stem round the left and back.
    for (let i = 0; i <= 40; i++) {
      const t = -0.4 - (i / 40) * (TAU - 0.9)
      const ex = 0.32 * Math.cos(t)
      const ey = 0.21 * Math.sin(t)
      const tilt = -0.35
      out.push([-0.24 + ex * Math.cos(tilt) - ey * Math.sin(tilt), 0.56 + ex * Math.sin(tilt) + ey * Math.cos(tilt)])
    }
  } else if (kind === 'pi') {
    out.push(
      [-0.9, -0.72], [0.9, -0.72], [0.9, -0.48], [0.42, -0.48], [0.42, 0.46], [0.5, 0.58], [0.62, 0.52], [0.66, 0.7], [0.48, 0.82],
      [0.28, 0.74], [0.22, 0.5], [0.22, -0.48], [-0.28, -0.48], [-0.34, 0.3], [-0.46, 0.8], [-0.7, 0.8], [-0.54, 0.3], [-0.48, -0.48], [-0.9, -0.48],
    )
  } else {
    for (let i = 0; i <= 60; i++) {
      const x = -1 + (i / 60) * 2
      out.push([x, 0.28 * Math.sin(x * 3 * Math.PI) - 0.16])
    }
    for (let i = 60; i >= 0; i--) {
      const x = -1 + (i / 60) * 2
      out.push([x, 0.28 * Math.sin(x * 3 * Math.PI) + 0.16])
    }
  }
  return out
}
