export interface SpringParams {
  /** Spring constant in N/m. */
  k: number
  /** Mass in kg. */
  m: number
  /** Damping coefficient in N·s/m. */
  c: number
  /** Driving force amplitude in N. */
  F: number
  /** Driving angular frequency in rad/s. */
  wd: number
}

/** Derivative of [displacement, velocity] for a damped, driven mass on a spring. */
export const springDeriv = ({ k, m, c, F, wd }: SpringParams) => (t: number, [x, v]: number[]) => [v, (-k * x - c * v + F * Math.cos(wd * t)) / m]

export const naturalFrequency = (k: number, m: number) => Math.sqrt(k / m)
export const dampingRatio = (k: number, m: number, c: number) => c / (2 * Math.sqrt(k * m))

export function dampingRegime(k: number, m: number, c: number): 'undamped' | 'underdamped' | 'critically damped' | 'overdamped' {
  const z = dampingRatio(k, m, c)
  if (z === 0) return 'undamped'
  if (Math.abs(z - 1) < 0.02) return 'critically damped'
  return z < 1 ? 'underdamped' : 'overdamped'
}

/** Steady-state amplitude of the driven oscillator. */
export function steadyAmplitude({ k, m, c, F, wd }: SpringParams): number {
  return F / Math.sqrt((k - m * wd * wd) ** 2 + (c * wd) ** 2)
}
