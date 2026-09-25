import { collide1D } from '../../sim/math'

/** One ball on its string: angle from vertical (radians, positive = to the right) and angular velocity. */
export interface Ball {
  th: number
  w: number
}

export interface Rig {
  /** String length (m). */
  L: number
  /** Ball radius (m); neighbouring pivots are exactly 2r apart so resting balls just touch. */
  r: number
  g: number
  /** Ball mass (kg). */
  m: number
}

export const pivotX = (i: number, n: number, r: number) => (i - (n - 1) / 2) * 2 * r
export const ballX = (b: Ball, i: number, n: number, rig: Rig) => pivotX(i, n, rig.r) + rig.L * Math.sin(b.th)
/** Horizontal velocity of a ball. */
export const ballU = (b: Ball, rig: Rig) => rig.L * b.w * Math.cos(b.th)

/** Advances every pendulum by dt (semi-implicit Euler; call with small dt). */
export function stepPendulums(balls: Ball[], dt: number, rig: Rig, damping = 0) {
  for (const b of balls) {
    b.w += (-(rig.g / rig.L) * Math.sin(b.th) - damping * b.w) * dt
    b.th += b.w * dt
  }
}

/**
 * Resolves collisions between touching neighbours with sequential 1D impulses (restitution e),
 * sweeping the row until no touching pair is still closing. Returns the number of impulses and the
 * largest closing speed, so a pulse can pass ball to ball through the whole row in one call.
 */
export function resolveContacts(balls: Ball[], rig: Rig, e = 1, tol = 1e-6): { hits: number; speed: number } {
  const n = balls.length
  let hits = 0
  let speed = 0
  for (let pass = 0; pass < 4 * n * n; pass++) {
    let any = false
    for (let i = 0; i < n - 1; i++) {
      const a = balls[i]
      const b = balls[i + 1]
      const gap = ballX(b, i + 1, n, rig) - ballX(a, i, n, rig) - 2 * rig.r
      const ua = ballU(a, rig)
      const ub = ballU(b, rig)
      if (gap > tol || ua - ub <= 1e-9) continue
      const [na, nb] = collide1D(rig.m, ua, rig.m, ub, e)
      speed = Math.max(speed, ua - ub)
      a.w = na / (rig.L * Math.cos(a.th))
      b.w = nb / (rig.L * Math.cos(b.th))
      hits++
      any = true
    }
    if (!any) break
  }
  return { hits, speed }
}

export function momentum(balls: Ball[], rig: Rig) {
  return balls.reduce((s, b) => s + rig.m * ballU(b, rig), 0)
}

export function energy(balls: Ball[], rig: Rig) {
  return balls.reduce((s, b) => s + 0.5 * rig.m * (rig.L * b.w) ** 2 + rig.m * rig.g * rig.L * (1 - Math.cos(b.th)), 0)
}
