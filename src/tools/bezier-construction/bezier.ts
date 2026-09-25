export type Pt = [number, number]

/** Binomial coefficient C(n, k). */
export function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/** Bernstein basis polynomial b(i, n)(t) = C(n, i)·tⁱ·(1 − t)ⁿ⁻ⁱ: the weight of control point i. */
export function bernstein(n: number, i: number, t: number): number {
  return binom(n, i) * t ** i * (1 - t) ** (n - i)
}

/**
 * de Casteljau's algorithm: repeatedly interpolate neighbouring points at t.
 * Returns every level, from the control points (level 0) down to the single curve point.
 */
export function deCasteljau(points: Pt[], t: number): Pt[][] {
  const levels: Pt[][] = [points]
  let cur = points
  while (cur.length > 1) {
    const next: Pt[] = []
    for (let i = 0; i < cur.length - 1; i++) next.push([cur[i][0] + (cur[i + 1][0] - cur[i][0]) * t, cur[i][1] + (cur[i + 1][1] - cur[i][1]) * t])
    levels.push(next)
    cur = next
  }
  return levels
}

/** The curve point as a Bernstein-weighted sum of the control points. */
export function bezierPoint(points: Pt[], t: number): Pt {
  const n = points.length - 1
  let x = 0
  let y = 0
  points.forEach(([px, py], i) => {
    const b = bernstein(n, i, t)
    x += b * px
    y += b * py
  })
  return [x, y]
}

/** Samples the curve at `steps + 1` evenly spaced t values. */
export function sampleCurve(points: Pt[], steps = 120): Pt[] {
  return Array.from({ length: steps + 1 }, (_, k) => deCasteljau(points, k / steps).at(-1)![0])
}

/** Approximate arc length from a polyline sample. */
export function arcLength(points: Pt[], steps = 200): number {
  const s = sampleCurve(points, steps)
  let L = 0
  for (let i = 1; i < s.length; i++) L += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1])
  return L
}
