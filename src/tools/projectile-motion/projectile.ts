import { rad } from '../../sim/math'

export interface Launch {
  /** Launch speed in m/s. */
  v: number
  /** Launch angle in degrees above the horizon. */
  angle: number
  /** Gravity in m/s². */
  g: number
  /** Launch height in metres. */
  h0: number
}

export interface Body {
  x: number
  y: number
  vx: number
  vy: number
}

/** Closed-form flight without air resistance: time in the air, horizontal range and peak height. */
export function idealFlight({ v, angle, g, h0 }: Launch) {
  const a = rad(angle)
  const vx = v * Math.cos(a)
  const vy = v * Math.sin(a)
  const time = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g
  return { time, range: vx * time, peak: h0 + (vy > 0 ? (vy * vy) / (2 * g) : 0) }
}

export function launchBody({ v, angle, h0 }: Launch): Body {
  const a = rad(angle)
  return { x: 0, y: h0, vx: v * Math.cos(a), vy: v * Math.sin(a) }
}

/** Advances a body by dt with gravity and quadratic air drag (k = drag force per unit mass per speed²). */
export function stepBody(b: Body, dt: number, g: number, k: number) {
  const s = Math.hypot(b.vx, b.vy)
  const ax = -k * s * b.vx
  const ay = -g - k * s * b.vy
  // Exact for constant acceleration, so drag-free flights match the closed form.
  b.x += b.vx * dt + 0.5 * ax * dt * dt
  b.y += b.vy * dt + 0.5 * ay * dt * dt
  b.vx += ax * dt
  b.vy += ay * dt
}

/** Simulates a whole flight numerically, returning the path and the same numbers as idealFlight. */
export function simulateFlight(launch: Launch, k: number, dt = 1 / 240) {
  const b = launchBody(launch)
  const path: [number, number][] = [[b.x, b.y]]
  let peak = b.y
  let t = 0
  while (t < 600) {
    const prev = { ...b }
    stepBody(b, dt, launch.g, k)
    t += dt
    peak = Math.max(peak, b.y)
    if (b.y < 0) {
      // Interpolate the landing point between the last two steps.
      const f = prev.y / (prev.y - b.y)
      const x = prev.x + (b.x - prev.x) * f
      path.push([x, 0])
      return { path, range: x, peak, time: t - dt + dt * f }
    }
    path.push([b.x, b.y])
  }
  return { path, range: b.x, peak, time: t }
}
