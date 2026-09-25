export interface Body {
  x: number
  y: number
  vx: number
  vy: number
  m: number
}

/** Gravitational accelerations on every body, with Plummer softening to keep close passes finite. */
export function accelerations(bodies: Body[], G: number, soft: number): [Float64Array, Float64Array] {
  const n = bodies.length
  const ax = new Float64Array(n)
  const ay = new Float64Array(n)
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const dx = bodies[j].x - bodies[i].x
      const dy = bodies[j].y - bodies[i].y
      const d2 = dx * dx + dy * dy + soft * soft
      const inv = G / (d2 * Math.sqrt(d2))
      ax[i] += dx * inv * bodies[j].m
      ay[i] += dy * inv * bodies[j].m
      ax[j] -= dx * inv * bodies[i].m
      ay[j] -= dy * inv * bodies[i].m
    }
  return [ax, ay]
}

/** One kick–drift–kick leapfrog step, which keeps orbits stable over long runs. */
export function leapfrog(bodies: Body[], dt: number, G: number, soft: number) {
  let [ax, ay] = accelerations(bodies, G, soft)
  bodies.forEach((b, i) => {
    b.vx += (ax[i] * dt) / 2
    b.vy += (ay[i] * dt) / 2
    b.x += b.vx * dt
    b.y += b.vy * dt
  })
  ;[ax, ay] = accelerations(bodies, G, soft)
  bodies.forEach((b, i) => {
    b.vx += (ax[i] * dt) / 2
    b.vy += (ay[i] * dt) / 2
  })
}

export const circularSpeed = (G: number, M: number, r: number) => Math.sqrt((G * M) / r)

export function totalEnergy(bodies: Body[], G: number, soft: number): number {
  let e = 0
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]
    e += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy)
    for (let j = i + 1; j < bodies.length; j++) {
      const c = bodies[j]
      e -= (G * b.m * c.m) / Math.sqrt((c.x - b.x) ** 2 + (c.y - b.y) ** 2 + soft * soft)
    }
  }
  return e
}

/** Merges bodies that touch, conserving mass and momentum. `radius` maps mass to size. */
export function mergeTouching<T extends Body>(bodies: T[], radius: (m: number) => number): T[] {
  const out = [...bodies]
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i]
      const b = out[j]
      if (Math.hypot(b.x - a.x, b.y - a.y) > (radius(a.m) + radius(b.m)) * 0.7) continue
      const m = a.m + b.m
      const big = a.m >= b.m ? a : b
      Object.assign(big, { x: (a.x * a.m + b.x * b.m) / m, y: (a.y * a.m + b.y * b.m) / m, vx: (a.vx * a.m + b.vx * b.m) / m, vy: (a.vy * a.m + b.vy * b.m) / m, m })
      out.splice(big === a ? j : i, 1)
      j = i
    }
  return out
}
