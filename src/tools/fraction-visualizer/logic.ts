/** A fraction n/d with d > 0. Not simplified unless a function says so. */
export interface Frac {
  n: number
  d: number
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

export const lcm = (a: number, b: number) => (a && b ? Math.abs(a * b) / gcd(a, b) : 0)

/** Builds n/d with the sign moved to the numerator. Throws on a zero denominator. */
export function frac(n: number, d = 1): Frac {
  if (!d) throw new Error('Denominator cannot be zero')
  return d < 0 ? { n: -n, d: -d } : { n, d }
}

export function simplify(f: Frac): Frac {
  const g = gcd(f.n, f.d) || 1
  return frac(f.n / g, f.d / g)
}

export const add = (a: Frac, b: Frac) => simplify(frac(a.n * b.d + b.n * a.d, a.d * b.d))
export const sub = (a: Frac, b: Frac) => simplify(frac(a.n * b.d - b.n * a.d, a.d * b.d))
export const mul = (a: Frac, b: Frac) => simplify(frac(a.n * b.n, a.d * b.d))
export const div = (a: Frac, b: Frac) => simplify(frac(a.n * b.d, a.d * b.n))
/** -1, 0 or 1. */
export const compare = (a: Frac, b: Frac) => Math.sign(a.n * b.d - b.n * a.d)
export const equals = (a: Frac, b: Frac) => compare(a, b) === 0

/** Rewrites f with denominator `d` (which must be a multiple of f.d). */
export const expandTo = (f: Frac, d: number): Frac => ({ n: (f.n * d) / f.d, d })

export interface Mixed {
  negative: boolean
  whole: number
  n: number
  d: number
}

export function toMixed(f: Frac): Mixed {
  const s = simplify(f)
  const abs = Math.abs(s.n)
  return { negative: s.n < 0, whole: Math.floor(abs / s.d), n: abs % s.d, d: s.d }
}

export const fromMixed = (whole: number, n: number, d: number, negative = false): Frac => {
  const f = frac(Math.abs(whole) * d + n, d)
  return negative || whole < 0 ? { n: -f.n, d: f.d } : f
}

/** Text form: "3/4", "1 1/2", "-2" (mixed) or "3/2" (improper). */
export function format(f: Frac, mixed = true): string {
  const s = simplify(f)
  if (s.d === 1) return String(s.n)
  if (!mixed) return `${s.n}/${s.d}`
  const m = toMixed(s)
  const sign = m.negative ? '-' : ''
  return m.whole ? `${sign}${m.whole} ${m.n}/${m.d}` : `${sign}${m.n}/${m.d}`
}

/** Reads "3/4", "1 1/2", "-2 1/3", "5" or "0.75". Returns null when it can't. */
export function parseFraction(text: string): Frac | null {
  const t = text.trim().replace(/\s+/g, ' ')
  let m = t.match(/^(-?)(\d+) (\d+)\/(\d+)$/)
  if (m) return +m[4] ? fromMixed(+m[2], +m[3], +m[4], m[1] === '-') : null
  m = t.match(/^(-?\d+)\s?\/\s?(-?\d+)$/)
  if (m) return +m[2] ? frac(+m[1], +m[2]) : null
  m = t.match(/^-?\d+(\.\d+)?$/)
  if (m) {
    const places = m[1] ? m[1].length - 1 : 0
    const d = 10 ** places
    return simplify(frac(Math.round(parseFloat(t) * d), d))
  }
  return null
}
