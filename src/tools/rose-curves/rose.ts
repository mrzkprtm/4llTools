/** Polar rose r = cos(kθ) with k = n/d, a few classic polar curves, and Maurer roses. */

export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/** k = n/d in lowest terms. */
export function reduce(n: number, d: number): [number, number] {
  const g = gcd(n, d) || 1
  return [n / g, d / g]
}

/** Petals of r = cos(nθ/d): n when n and d are both odd, otherwise 2n (in lowest terms). */
export function rosePetals(n: number, d: number): number {
  const [a, b] = reduce(n, d)
  return a % 2 === 1 && b % 2 === 1 ? a : 2 * a
}

/** The rose closes after θ = m·π; returns m (d when n and d are both odd, else 2d). */
export function rosePeriod(n: number, d: number): number {
  const [a, b] = reduce(n, d)
  return a % 2 === 1 && b % 2 === 1 ? b : 2 * b
}

export type Curve = 'rose' | 'cardioid' | 'limacon' | 'lemniscate' | 'spiral' | 'butterfly'

export interface Polar {
  r: (t: number) => number
  /** θ runs from 0 to span. */
  span: number
}

export function polar(curve: Curve, n: number, d: number): Polar {
  switch (curve) {
    case 'cardioid':
      return { r: (t) => 1 + Math.cos(t), span: 2 * Math.PI }
    case 'limacon':
      return { r: (t) => 0.5 + Math.cos(t), span: 2 * Math.PI }
    case 'lemniscate':
      return { r: (t) => Math.sqrt(Math.max(0, Math.cos(2 * t))), span: 2 * Math.PI }
    case 'spiral':
      return { r: (t) => t / (6 * Math.PI), span: 6 * Math.PI }
    case 'butterfly':
      return { r: (t) => Math.exp(Math.sin(t)) - 2 * Math.cos(4 * t) + Math.sin((2 * t - Math.PI) / 24) ** 5, span: 24 * Math.PI }
    default: {
      const [a, b] = reduce(n, d)
      return { r: (t) => Math.cos((a / b) * t), span: rosePeriod(a, b) * Math.PI }
    }
  }
}

/** Samples the curve as flat [x0, y0, x1, y1, …] with y pointing up (maths convention). */
export function tracePolar(p: Polar, samples: number): Float32Array {
  const out = new Float32Array((samples + 1) * 2)
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * p.span
    const r = p.r(t)
    out[2 * i] = r * Math.cos(t)
    out[2 * i + 1] = r * Math.sin(t)
  }
  return out
}

/** Maurer rose: the curve's points at θ = i·step degrees, joined by straight lines, for one full period. */
export function maurer(p: Polar, stepDeg: number, maxPoints = 3601): Float32Array {
  const count = Math.min(maxPoints, Math.round((360 * p.span) / (2 * Math.PI)) + 1)
  const out = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const tt = ((i * stepDeg * Math.PI) / 180) % p.span
    const r = p.r(tt)
    out[2 * i] = r * Math.cos(tt)
    out[2 * i + 1] = r * Math.sin(tt)
  }
  return out
}

/** Largest distance from the origin among flat [x, y, …] points. */
export function extent(pts: Float32Array): number {
  let m = 0
  for (let i = 0; i < pts.length; i += 2) m = Math.max(m, Math.hypot(pts[i], pts[i + 1]))
  return m || 1
}
