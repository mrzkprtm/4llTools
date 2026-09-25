/** Lissajous figures: x = A·sin(a·t + δ), y = B·sin(b·t), optionally decaying like a harmonograph. */

export interface Params {
  a: number
  b: number
  /** Phase shift of the x oscillation, in radians. */
  delta: number
  A?: number
  B?: number
  /** Exponential decay rate per unit time (0 = none). */
  damping?: number
}

export function lissajousPoint(t: number, { a, b, delta, A = 1, B = 1, damping = 0 }: Params): [number, number] {
  const k = damping ? Math.exp(-damping * t) : 1
  return [A * k * Math.sin(a * t + delta), B * k * Math.sin(b * t)]
}

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a))
  b = Math.abs(Math.round(b))
  while (b) [a, b] = [b, a % b]
  return a
}

export function lcm(a: number, b: number): number {
  const g = gcd(a, b)
  return g ? Math.abs(Math.round(a) * Math.round(b)) / g : 0
}

/** Time for the undamped curve to close up (integer frequencies): 2π / gcd(a, b). */
export function closedPeriod(a: number, b: number): number {
  return (2 * Math.PI) / Math.max(1, gcd(a, b))
}

/** The frequency ratio in lowest terms, e.g. (6, 4) → "3:2". */
export function ratioLabel(a: number, b: number): string {
  const g = Math.max(1, gcd(a, b))
  return `${Math.round(a) / g}:${Math.round(b) / g}`
}

/** A multiple of π as text: 2π, π, 2π/3 … */
export function piLabel(numer: number, denom: number): string {
  const g = Math.max(1, gcd(numer, denom))
  const n = numer / g
  const d = denom / g
  return `${n === 1 ? '' : n}π${d === 1 ? '' : `/${d}`}`
}
