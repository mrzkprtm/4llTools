import { TAU } from '../../sim/math'

/** Position of (possibly fractional) point number t out of n around a circle, starting at the left and going round. */
export function pointOnCircle(t: number, n: number, cx: number, cy: number, r: number): [number, number] {
  const a = Math.PI + (TAU * t) / n
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

/** The target of point i in the "times k mod n" table; fractional k gives a fractional target. */
export function target(i: number, k: number, n: number): number {
  const v = (i * k) % n
  return v < 0 ? v + n : v
}

/** Start and end of the chord from point i to point i·k mod n. */
export function chord(i: number, k: number, n: number, cx: number, cy: number, r: number): [number, number, number, number] {
  const [x1, y1] = pointOnCircle(i, n, cx, cy, r)
  const [x2, y2] = pointOnCircle(target(i, k, n), n, cx, cy, r)
  return [x1, y1, x2, y2]
}

/**
 * The envelope of the chords for whole-number k is an epicycloid with k − 1 cusps
 * (cardioid for 2, nephroid for 3, …). Returns '' for fractional k.
 */
export function curveName(k: number, n: number): string {
  if (Math.abs(k - Math.round(k)) > 1e-6) return ''
  const m = ((Math.round(k) % n) + n) % n
  if (m === 1) return 'Every point maps to itself'
  if (m === 0) return 'Every line meets point 0'
  const cusps = m - 1
  const names: Record<number, string> = { 1: 'Cardioid', 2: 'Nephroid', 3: 'Trefoil epicycloid', 4: 'Quatrefoil epicycloid', 5: 'Ranunculoid' }
  if (names[cusps]) return names[cusps]
  if (m === n - 1) return 'Parallel chords (mirror)'
  // With many cusps the finite set of points aliases, so name the residue instead.
  return cusps <= 16 ? `${cusps}-cusp epicycloid` : 'Aliased pattern'
}
