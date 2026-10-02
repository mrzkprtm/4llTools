/** Zero-dimensional energy balance with one grey atmospheric layer. */

export const SIGMA = 5.670374e-8
export const SOLAR = 1361

/** Sunlight absorbed per square metre, averaged over the sphere: S(1 − α)/4. */
export const absorbedSolar = (S: number, albedo: number) => (S * (1 - albedo)) / 4

/** Temperature a planet would have with no greenhouse effect (about 255 K for Earth). */
export const effectiveTemp = (S: number, albedo: number) => (absorbedSolar(S, albedo) / SIGMA) ** 0.25

/**
 * Surface temperature (K) under one atmospheric layer that absorbs a fraction ε of the infrared
 * and re-emits it both up and down: T_s = T_e · (2 / (2 − ε))^¼. With `layers` fully absorbing
 * layers (ε = 1 each) this becomes T_e · (layers + 1)^¼.
 */
export function equilibriumTemp(S: number, albedo: number, emissivity: number, layers = 1): number {
  const te = effectiveTemp(S, albedo)
  if (layers > 1 && emissivity >= 1) return te * (layers + 1) ** 0.25
  const e = Math.min(1, Math.max(0, emissivity))
  return te * (2 / (2 - e)) ** 0.25
}

/**
 * Infrared absorptivity of the atmosphere for a CO₂ level, calibrated so 280 ppm gives about 14 °C
 * and each doubling adds about 3 °C (the logarithmic CO₂ forcing, with feedbacks folded in).
 */
export function emissivityFromCO2(ppm: number): number {
  return Math.min(0.98, Math.max(0, 0.7615 + 0.0726 * Math.log(Math.max(ppm, 10) / 280)))
}

export interface ClimateState {
  /** Surface and atmosphere temperatures in kelvin. */
  ts: number
  ta: number
}

/** Heat capacities in W·year/(m²·K): an ocean mixed layer for the surface and a light atmosphere. */
export const C_SURFACE = 22
export const C_AIR = 2.5

/** Energy leaving the top of the atmosphere: IR from the surface that slips through, plus the layer's own glow. */
export const outgoing = (s: ClimateState, emissivity: number) => (1 - emissivity) * SIGMA * s.ts ** 4 + emissivity * SIGMA * s.ta ** 4

/** Advances the two temperatures by dt years with small Euler steps. */
export function stepClimate(s: ClimateState, dt: number, S: number, albedo: number, emissivity: number): ClimateState {
  let { ts, ta } = s
  const n = Math.max(1, Math.ceil(dt / 0.02))
  const h = dt / n
  const sun = absorbedSolar(S, albedo)
  for (let k = 0; k < n; k++) {
    const up = SIGMA * ts ** 4
    const air = SIGMA * ta ** 4
    const dts = (sun + emissivity * air - up) / C_SURFACE
    const dta = (emissivity * up - 2 * emissivity * air) / C_AIR
    ts += dts * h
    ta += dta * h
  }
  return { ts, ta }
}
