import { rad } from '../../sim/math'

export interface InclineInput {
  /** Ramp angle in degrees. */
  angle: number
  /** Block mass (kg). */
  m: number
  g: number
  /** Static and kinetic friction coefficients. */
  mus: number
  muk: number
  /** Applied force along the incline (N), positive pushing up the slope. */
  F: number
  /** Current velocity along the incline (m/s), positive down the slope. */
  v: number
}

export interface InclineForces {
  /** Acceleration along the incline (m/s²), positive down the slope. */
  a: number
  normal: number
  /** Gravity's components along (down the slope) and into the surface. */
  gravityAlong: number
  gravityPerp: number
  /** Friction along the incline (N), positive down the slope. */
  friction: number
  /** Net force along the incline (N), positive down the slope. */
  net: number
  /** True when static friction is holding the block still. */
  holds: boolean
}

/** Forces and acceleration of a block on a ramp with Coulomb friction. */
export function inclineAcceleration({ angle, m, g, mus, muk, F, v }: InclineInput): InclineForces {
  const th = rad(angle)
  const normal = m * g * Math.cos(th)
  const gravityAlong = m * g * Math.sin(th)
  const gravityPerp = normal
  const drive = gravityAlong - F
  let friction: number
  let holds = false
  if (Math.abs(v) < 1e-9) {
    if (Math.abs(drive) <= mus * normal) {
      friction = -drive
      holds = true
    } else friction = -Math.sign(drive) * muk * normal
  } else friction = -Math.sign(v) * muk * normal
  const net = drive + friction
  return { a: net / m, normal, gravityAlong, gravityPerp, friction, net, holds }
}

/**
 * Advances (s, v) along the incline by dt. Kinetic friction can stop the block but never
 * reverse it within a step; once stopped, static friction gets its say on the next step.
 */
export function stepIncline(s: number, v: number, dt: number, input: Omit<InclineInput, 'v'>): { s: number; v: number; forces: InclineForces } {
  const forces = inclineAcceleration({ ...input, v })
  let nv = v + forces.a * dt
  if (v !== 0 && Math.sign(nv) !== Math.sign(v)) nv = 0
  return { s: s + ((v + nv) / 2) * dt, v: nv, forces }
}
