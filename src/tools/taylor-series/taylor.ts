export type FnId = 'sin' | 'cos' | 'exp' | 'ln1p' | 'geom' | 'atan'

export const FUNCTIONS: { id: FnId; name: string; view: [number, number, number, number]; aRange: [number, number] }[] = [
  { id: 'sin', name: 'sin x', view: [-8, 8, -3, 3], aRange: [-6, 6] },
  { id: 'cos', name: 'cos x', view: [-8, 8, -3, 3], aRange: [-6, 6] },
  { id: 'exp', name: 'eˣ', view: [-5, 4, -3, 14], aRange: [-3, 3] },
  { id: 'ln1p', name: 'ln(1 + x)', view: [-2, 5, -4, 3], aRange: [-0.8, 3.5] },
  { id: 'geom', name: '1 / (1 − x)', view: [-3, 3, -5, 7], aRange: [-2.5, 0.8] },
  { id: 'atan', name: 'arctan x', view: [-5, 5, -3, 3], aRange: [-3, 3] },
]

export function evalF(fn: FnId, x: number): number {
  switch (fn) {
    case 'sin':
      return Math.sin(x)
    case 'cos':
      return Math.cos(x)
    case 'exp':
      return Math.exp(x)
    case 'ln1p':
      return x > -1 ? Math.log1p(x) : NaN
    case 'geom':
      return 1 / (1 - x)
    case 'atan':
      return Math.atan(x)
  }
}

/** The first n Taylor coefficients cₖ = f⁽ᵏ⁾(a) / k! of f around a. */
export function taylorCoeffs(fn: FnId, a: number, n: number): number[] {
  const c: number[] = []
  let fact = 1
  for (let k = 0; k < n; k++) {
    if (k > 0) fact *= k
    switch (fn) {
      case 'sin':
        c.push(Math.sin(a + (k * Math.PI) / 2) / fact)
        break
      case 'cos':
        c.push(Math.cos(a + (k * Math.PI) / 2) / fact)
        break
      case 'exp':
        c.push(Math.exp(a) / fact)
        break
      case 'ln1p':
        // f⁽ᵏ⁾(a) = (−1)^(k−1)·(k−1)! / (1 + a)^k, so cₖ = (−1)^(k−1) / (k·(1 + a)^k).
        c.push(k === 0 ? Math.log1p(a) : ((k % 2 ? 1 : -1) / k) * (1 + a) ** -k)
        break
      case 'geom':
        c.push((1 - a) ** -(k + 1))
        break
      case 'atan':
        c.push(0)
        break
    }
  }
  if (fn === 'atan' && n > 0) {
    // arctan′(a + h) = 1 / q(h) with q(h) = (1 + a²) + 2a·h + h². Expand the reciprocal, then integrate.
    const q0 = 1 + a * a
    const r: number[] = []
    for (let k = 0; k < n; k++) r.push(k === 0 ? 1 / q0 : -(2 * a * r[k - 1] + (k >= 2 ? r[k - 2] : 0)) / q0)
    c[0] = Math.atan(a)
    for (let k = 1; k < n; k++) c[k] = r[k - 1] / k
  }
  return c
}

/** Evaluates Σ cₖ (x − a)ᵏ with Horner's rule. */
export function taylorEval(coeffs: number[], a: number, x: number): number {
  const h = x - a
  let s = 0
  for (let k = coeffs.length - 1; k >= 0; k--) s = s * h + coeffs[k]
  return s
}

/** Radius of convergence: the distance from a to the nearest (possibly complex) singularity. */
export function radius(fn: FnId, a: number): number {
  if (fn === 'ln1p') return Math.abs(a + 1)
  if (fn === 'geom') return Math.abs(1 - a)
  if (fn === 'atan') return Math.hypot(a, 1)
  return Infinity
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (k: number) => [...String(k)].map((d) => SUP[Number(d)]).join('')

/** The polynomial written out, showing at most `max` non-zero terms. */
export function polyString(coeffs: number[], a: number, max = 5): string {
  const h = Math.abs(a) < 1e-9 ? 'x' : `(x ${a > 0 ? '−' : '+'} ${+Math.abs(a).toFixed(2)})`
  const parts: string[] = []
  let shown = 0
  let more = false
  coeffs.forEach((c, k) => {
    if (Math.abs(c) < 1e-12) return
    if (shown >= max) {
      more = true
      return
    }
    const mag = Math.abs(c)
    const num = k > 0 && Math.abs(mag - 1) < 1e-9 ? '' : +mag.toPrecision(4) + (k > 0 ? '·' : '')
    const term = `${num}${k > 0 ? h : ''}${k > 1 ? sup(k) : ''}`
    parts.push(`${parts.length ? (c < 0 ? ' − ' : ' + ') : c < 0 ? '−' : ''}${term}`)
    shown++
  })
  return (parts.join('') || '0') + (more ? ' + …' : '')
}
