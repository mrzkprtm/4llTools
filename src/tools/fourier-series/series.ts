/** Fourier series of the classic periodic waves (period 2π, swinging between −1 and 1). */

export type WaveKind = 'square' | 'sawtooth' | 'triangle' | 'pulse'

export interface Harmonic {
  /** Harmonic number: the term spins n times per period. */
  n: number
  /** Radius of the rotating circle (always ≥ 0). */
  amp: number
  /** The term is amp · sin(n t + phase). */
  phase: number
}

/** Fraction of the period a pulse wave is "on". */
export const DUTY = 0.25

const TAU = Math.PI * 2

/** Constant (DC) part of the series. */
export function offset(kind: WaveKind): number {
  return kind === 'pulse' ? 2 * DUTY - 1 : 0
}

/** Signed coefficient b of b · sin(n t + base phase) for harmonic n, or 0 when the harmonic is absent. */
function coef(kind: WaveKind, n: number): number {
  switch (kind) {
    case 'square':
      return n % 2 ? 4 / (Math.PI * n) : 0
    case 'sawtooth':
      return ((n % 2 ? 1 : -1) * 2) / (Math.PI * n)
    case 'triangle':
      return n % 2 ? ((n % 4 === 1 ? 1 : -1) * 8) / (Math.PI * Math.PI * n * n) : 0
    case 'pulse': {
      const b = (4 / (Math.PI * n)) * Math.sin(n * Math.PI * DUTY)
      return Math.abs(b) < 1e-12 ? 0 : b
    }
  }
}

/** The first `count` non-zero harmonics of the wave. */
export function coefficients(kind: WaveKind, count: number): Harmonic[] {
  const out: Harmonic[] = []
  // The pulse is centred on t = 0, so it is a cosine series: cos x = sin(x + π/2).
  const base = kind === 'pulse' ? Math.PI / 2 : 0
  for (let n = 1; out.length < count && n < 100000; n++) {
    const b = coef(kind, n)
    if (b !== 0) out.push({ n, amp: Math.abs(b), phase: b < 0 ? base + Math.PI : base })
  }
  return out
}

/** The sum of the first `count` non-zero harmonics at time t. */
export function partialSum(kind: WaveKind, count: number, t: number, terms = coefficients(kind, count)): number {
  let s = offset(kind)
  for (let i = 0; i < Math.min(count, terms.length); i++) s += terms[i].amp * Math.sin(terms[i].n * t + terms[i].phase)
  return s
}

/** The exact wave the series converges to. */
export function target(kind: WaveKind, t: number): number {
  const u = ((t % TAU) + TAU) % TAU // 0 … 2π
  switch (kind) {
    case 'square':
      return u === 0 || u === Math.PI ? 0 : u < Math.PI ? 1 : -1
    case 'sawtooth':
      return u === Math.PI ? 0 : u < Math.PI ? u / Math.PI : u / Math.PI - 2
    case 'triangle':
      return u < Math.PI / 2 ? u / (Math.PI / 2) : u < (3 * Math.PI) / 2 ? 2 - u / (Math.PI / 2) : u / (Math.PI / 2) - 4
    case 'pulse': {
      const d = Math.min(u, TAU - u)
      return d < Math.PI * DUTY ? 1 : -1
    }
  }
}

/** Human-readable formula of harmonic number `n` of the wave, e.g. "(4/π)·sin(3t)/3". */
export function termFormula(kind: WaveKind, n: number): string {
  const t = n === 1 ? 't' : `${n}t`
  const sign = (neg: boolean) => (neg ? '−' : '+')
  switch (kind) {
    case 'square':
      return `(4/π)·sin(${t})/${n}`
    case 'sawtooth':
      return `${sign(n % 2 === 0)}(2/π)·sin(${t})/${n}`
    case 'triangle':
      return `${sign(n % 4 === 3)}(8/π²)·sin(${t})/${n * n}`
    case 'pulse':
      return `(4/π)·sin(${n === 1 ? '' : n}π/4)·cos(${t})/${n}`
  }
}

/** Highest value of the partial sum over one period (sampled), to show the Gibbs overshoot. */
export function peak(kind: WaveKind, count: number, samples = 2000): number {
  const terms = coefficients(kind, count)
  let best = -Infinity
  for (let i = 0; i < samples; i++) best = Math.max(best, partialSum(kind, count, (i / samples) * TAU, terms))
  return best
}
