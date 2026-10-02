/** Refraction angle from Snell's law n1 sin θ1 = n2 sin θ2 (radians), or null on total internal reflection. */
export function refractAngle(n1: number, n2: number, theta: number): number | null {
  const s = (n1 / n2) * Math.sin(theta)
  if (Math.abs(s) > 1) return null
  return Math.asin(s)
}

/** Critical angle for light going from n1 into n2, or null when n1 ≤ n2 (no total internal reflection). */
export function criticalAngle(n1: number, n2: number): number | null {
  return n1 > n2 ? Math.asin(n2 / n1) : null
}

/** Brewster's angle, where p-polarised light is not reflected at all. */
export function brewsterAngle(n1: number, n2: number): number {
  return Math.atan(n2 / n1)
}

/** Fraction of unpolarised light reflected at the interface (average of the s and p Fresnel reflectances). */
export function fresnelReflectance(n1: number, n2: number, thetaI: number): number {
  const thetaT = refractAngle(n1, n2, thetaI)
  if (thetaT === null) return 1
  const ci = Math.cos(thetaI)
  const ct = Math.cos(thetaT)
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)
  const rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci)
  return (rs * rs + rp * rp) / 2
}
