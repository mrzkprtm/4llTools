/** Diffusion and osmosis through a porous membrane: pore rules and concentrations. */

/** A particle fits through a pore when its diameter is smaller than the pore. */
export function fitsPore(diameter: number, poreSize: number): boolean {
  return diameter < poreSize
}

/** Centre y of each of `count` pores spread evenly over [top, bottom]. */
export function poreCentres(count: number, top: number, bottom: number): number[] {
  const out: number[] = []
  const gap = (bottom - top) / Math.max(1, count)
  for (let k = 0; k < count; k++) out.push(top + (k + 0.5) * gap)
  return out
}

/**
 * Whether a particle of `diameter` that reaches the membrane at height `y` goes through:
 * it must be small enough and its centre must line up with one of the pore openings.
 */
export function passesMembrane(diameter: number, y: number, poreSize: number, centres: number[]): boolean {
  if (!fitsPore(diameter, poreSize)) return false
  for (const c of centres) if (Math.abs(y - c) < poreSize / 2) return true
  return false
}

/** Particles per unit volume. */
export function concentration(count: number, volume: number): number {
  return volume > 0 ? count / volume : 0
}

/**
 * Fraction of "free" water on one side (a simple water activity). Each solute particle ties up
 * `bound` water molecules in its hydration shell, so a salty side sends fewer molecules back.
 */
export function waterActivity(water: number, solute: number, bound = 3): number {
  const total = water + bound * solute
  return total > 0 ? water / total : 1
}

/** Liquid height on one side when every particle takes up `area` of the chamber's cross-section. */
export function liquidLevel(particles: number, width: number, area: number): number {
  return width > 0 ? (particles * area) / width : 0
}
