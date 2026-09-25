/** Boltzmann constant in the simulation's units (mass 1, px/s), chosen so 150 px/s rms ≈ 300 K. */
export const KB = 37.5

/** Maxwell–Boltzmann speed distribution in two dimensions. Integrates to 1 over v ≥ 0. */
export function mb2d(v: number, T: number, m: number): number {
  const kT = KB * T
  return ((m * v) / kT) * Math.exp((-m * v * v) / (2 * kT))
}

/** Temperature from the particles' mean kinetic energy (two degrees of freedom per particle in 2D). */
export function temperatureOf(vx: ArrayLike<number>, vy: ArrayLike<number>, m: ArrayLike<number>, n: number): number {
  if (!n) return 0
  let ke = 0
  for (let i = 0; i < n; i++) ke += 0.5 * m[i] * (vx[i] * vx[i] + vy[i] * vy[i])
  return ke / n / KB
}
