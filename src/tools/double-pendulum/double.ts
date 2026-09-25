export interface DoubleParams {
  m1: number
  m2: number
  L1: number
  L2: number
  g: number
}

/** Derivative of [θ1, ω1, θ2, ω2] for a frictionless double pendulum with point masses. */
export function doubleDeriv({ m1, m2, L1, L2, g }: DoubleParams) {
  return (_t: number, [t1, w1, t2, w2]: number[]) => {
    const d = t1 - t2
    const den = 2 * m1 + m2 - m2 * Math.cos(2 * d)
    const a1 = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * Math.cos(d))) / (L1 * den)
    const a2 = (2 * Math.sin(d) * (w1 * w1 * L1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * L2 * m2 * Math.cos(d))) / (L2 * den)
    return [w1, a1, w2, a2]
  }
}

/** Total mechanical energy, which an exact solution keeps constant. */
export function doubleEnergy({ m1, m2, L1, L2, g }: DoubleParams, [t1, w1, t2, w2]: number[]): number {
  const y1 = -L1 * Math.cos(t1)
  const y2 = y1 - L2 * Math.cos(t2)
  const kinetic = 0.5 * m1 * L1 * L1 * w1 * w1 + 0.5 * m2 * (L1 * L1 * w1 * w1 + L2 * L2 * w2 * w2 + 2 * L1 * L2 * w1 * w2 * Math.cos(t1 - t2))
  return kinetic + m1 * g * y1 + m2 * g * y2
}
