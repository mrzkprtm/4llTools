export type Method = 'left' | 'right' | 'mid' | 'trap' | 'simpson'
type F = (x: number) => number

/**
 * Approximates ∫ f from a to b with n equal subintervals. Simpson's rule pairs
 * subintervals, so an odd n is rounded up to the next even number.
 */
export function riemann(f: F, a: number, b: number, n: number, method: Method): number {
  if (method === 'simpson' && n % 2) n++
  const h = (b - a) / n
  let s = 0
  switch (method) {
    case 'left':
      for (let i = 0; i < n; i++) s += f(a + i * h)
      return s * h
    case 'right':
      for (let i = 1; i <= n; i++) s += f(a + i * h)
      return s * h
    case 'mid':
      for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h)
      return s * h
    case 'trap':
      s = (f(a) + f(b)) / 2
      for (let i = 1; i < n; i++) s += f(a + i * h)
      return s * h
    case 'simpson':
      s = f(a) + f(b)
      for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h)
      return (s * h) / 3
  }
}

/** A high-precision reference value by adaptive Simpson quadrature. */
export function integrate(f: F, a: number, b: number, tol = 1e-12): number {
  const simpson = (l: number, r: number, fl: number, fm: number, fr: number) => ((r - l) / 6) * (fl + 4 * fm + fr)
  const rec = (l: number, r: number, fl: number, fm: number, fr: number, whole: number, eps: number, depth: number): number => {
    const m = (l + r) / 2
    const lm = (l + m) / 2
    const rm = (m + r) / 2
    const flm = f(lm)
    const frm = f(rm)
    const left = simpson(l, m, fl, flm, fm)
    const right = simpson(m, r, fm, frm, fr)
    if (depth <= 0 || Math.abs(left + right - whole) <= 15 * eps) return left + right + (left + right - whole) / 15
    return rec(l, m, fl, flm, fm, left, eps / 2, depth - 1) + rec(m, r, fm, frm, fr, right, eps / 2, depth - 1)
  }
  if (a === b) return 0
  // Split into pieces first so narrow features are not missed.
  const pieces = 16
  const h = (b - a) / pieces
  let total = 0
  for (let i = 0; i < pieces; i++) {
    const l = a + i * h
    const r = l + h
    const fl = f(l)
    const fm = f((l + r) / 2)
    const fr = f(r)
    total += rec(l, r, fl, fm, fr, simpson(l, r, fl, fm, fr), tol / pieces, 40)
  }
  return total
}

export const FUNCS: { id: string; name: string; f: F; view: [number, number]; ab: [number, number]; min?: number }[] = [
  { id: 'sq', name: 'x²', f: (x) => x * x, view: [-1, 2.6], ab: [0, 2] },
  { id: 'sin15', name: 'sin x + 1.5', f: (x) => Math.sin(x) + 1.5, view: [-0.8, 7], ab: [0, 6] },
  { id: 'sqrt', name: '√x', f: (x) => Math.sqrt(Math.max(0, x)), view: [-0.5, 5], ab: [0, 4], min: 0 },
  { id: 'exp', name: 'eˣ', f: Math.exp, view: [-2, 2.4], ab: [-1, 2] },
  { id: 'sin', name: 'sin x (signed area)', f: Math.sin, view: [-0.8, 7], ab: [0, 5] },
  { id: 'cubic', name: 'x³ − 3x', f: (x) => x ** 3 - 3 * x, view: [-2.4, 2.4], ab: [-1.5, 2] },
  { id: 'bell', name: '1 / (1 + x²)', f: (x) => 1 / (1 + x * x), view: [-4, 4], ab: [-3, 3] },
  { id: 'xsin', name: 'x·sin x', f: (x) => x * Math.sin(x), view: [-0.8, 9], ab: [0, 8] },
]
