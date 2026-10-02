/** Collision theory for A + B ⇌ C + D: energy thresholds, barriers and the equilibrium constant. */

/** Gas constant in kJ/(mol·K), so R·T is the thermal energy per mole. */
export const R = 0.008314

export const thermalEnergy = (T: number) => R * T

/**
 * Energy of a collision along the line of centres: ½·μ·u², where u is the closing speed along
 * the unit normal (nx, ny) from particle 1 to 2. Only this part of the motion can break bonds.
 * `scale` converts speed² into the energy unit. Returns 0 when the particles are moving apart.
 */
export function collisionEnergy(m1: number, m2: number, vx1: number, vy1: number, vx2: number, vy2: number, nx: number, ny: number, scale = 1): number {
  const u = (vx1 - vx2) * nx + (vy1 - vy2) * ny
  if (u <= 0) return 0
  const mu = (m1 * m2) / (m1 + m2)
  return (0.5 * mu * u * u) / scale
}

/** A collision reacts when its energy reaches the barrier. */
export const reacts = (energy: number, barrier: number) => energy >= barrier

/**
 * Forward and reverse barriers from the activation energy and the reaction enthalpy ΔH.
 * The forward barrier can never be below ΔH (an uphill reaction must at least climb to the products).
 */
export function barriers(Ea: number, dH: number): { forward: number; reverse: number } {
  const forward = Math.max(Ea, dH, 0)
  return { forward, reverse: forward - dH }
}

/** K = [C][D] / ([A][B]). Infinite when a reactant runs out. */
export function equilibriumK(a: number, b: number, c: number, d: number): number {
  if (a * b === 0) return c * d > 0 ? Infinity : NaN
  return (c * d) / (a * b)
}

/** Detailed balance for equal-mass particles: K = e^(−ΔH/RT). */
export const predictedK = (dH: number, T: number) => Math.exp(-dH / thermalEnergy(T))

/** Fraction of collisions (by line-of-centres energy) that clear a barrier: e^(−E/RT). */
export const fractionAbove = (barrier: number, T: number) => Math.exp(-barrier / thermalEnergy(T))

/** Energy along the reaction coordinate s ∈ [0, 1]: reactants at 0, peak at the barrier, products at ΔH. */
export function energyProfile(s: number, Ea: number, dH: number): number {
  const { forward } = barriers(Ea, dH)
  const smooth = s * s * (3 - 2 * s)
  const base = dH * smooth
  return base + (forward - dH / 2) * Math.exp(-(((s - 0.5) / 0.12) ** 2))
}
