/** A charged particle moving in the plane (x right, y up; z points out of the screen). */
export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * One Boris push for F = q(E + v × B) with E in the plane and B = Bz ẑ.
 * The magnetic part is an exact rotation, so the speed never drifts in a pure magnetic field.
 */
export function borisStep(p: Particle, qm: number, Ex: number, Ey: number, Bz: number, dt: number): Particle {
  const h = (qm * dt) / 2
  // Half electric kick.
  const mx = p.vx + h * Ex
  const my = p.vy + h * Ey
  // Magnetic rotation.
  const t = h * Bz
  const s = (2 * t) / (1 + t * t)
  const px = mx + my * t
  const py = my - mx * t
  const nx = mx + py * s
  const ny = my - px * s
  // Second half electric kick, then drift.
  p.vx = nx + h * Ex
  p.vy = ny + h * Ey
  p.x += p.vx * dt
  p.y += p.vy * dt
  return p
}

/** Radius of the circular (Larmor) orbit, r = mv / |qB|. */
export function larmorRadius(m: number, v: number, q: number, B: number): number {
  return B === 0 || q === 0 ? Infinity : (m * Math.abs(v)) / Math.abs(q * B)
}

/** Time for one full circle, T = 2πm / |qB| (independent of speed). */
export function cyclotronPeriod(m: number, q: number, B: number): number {
  return B === 0 || q === 0 ? Infinity : (2 * Math.PI * m) / Math.abs(q * B)
}

/** Speed of the E × B drift, E / B, the same for every charge and mass. */
export function driftSpeed(E: number, B: number): number {
  return B === 0 ? Infinity : E / B
}
