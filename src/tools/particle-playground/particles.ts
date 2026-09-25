/** A fixed-capacity particle pool in typed arrays. Live particles are packed into [0, n). */
export interface Pool {
  n: number
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  age: Float32Array
  life: Float32Array
}

export function makePool(max: number): Pool {
  return {
    n: 0,
    x: new Float32Array(max),
    y: new Float32Array(max),
    vx: new Float32Array(max),
    vy: new Float32Array(max),
    age: new Float32Array(max),
    life: new Float32Array(max),
  }
}

/** Adds one particle unless the pool (or the soft cap) is full. Returns false when it was dropped. */
export function emit(p: Pool, x: number, y: number, vx: number, vy: number, life: number, cap = p.x.length): boolean {
  if (p.n >= Math.min(cap, p.x.length)) return false
  const i = p.n++
  p.x[i] = x
  p.y[i] = y
  p.vx[i] = vx
  p.vy[i] = vy
  p.age[i] = 0
  p.life[i] = life
  return true
}

export interface Well {
  x: number
  y: number
  /** Positive attracts, negative repels. */
  strength: number
}

export interface Forces {
  gravity: number
  wind: number
  /** Linear drag per second (0 = none). */
  drag: number
  wells: Well[]
  /** Particles further than this outside [0, w] × [0, h] are removed. */
  bounds?: { w: number; h: number; margin: number }
}

/** Softening (in world units squared) so the pull near a well stays finite. */
export const SOFT2 = 400

/** Acceleration on a particle at (x, y) from one well: strength / (r² + soft²), pointing at the well. */
export function wellAccel(w: Well, x: number, y: number): [number, number] {
  const dx = w.x - x
  const dy = w.y - y
  const r2 = dx * dx + dy * dy + SOFT2
  const k = w.strength / (r2 * Math.sqrt(r2))
  return [dx * k, dy * k]
}

/**
 * Advances every particle by dt with semi-implicit Euler (velocity first, then position),
 * then removes the ones whose age passed their lifetime or that left the bounds, by
 * swapping the last live particle into their slot. Returns the number removed.
 */
export function stepPool(p: Pool, dt: number, f: Forces): number {
  const damp = Math.max(0, 1 - f.drag * dt)
  for (let i = 0; i < p.n; i++) {
    let ax = f.wind
    let ay = f.gravity
    for (const w of f.wells) {
      const [wx, wy] = wellAccel(w, p.x[i], p.y[i])
      ax += wx
      ay += wy
    }
    p.vx[i] = (p.vx[i] + ax * dt) * damp
    p.vy[i] = (p.vy[i] + ay * dt) * damp
    p.x[i] += p.vx[i] * dt
    p.y[i] += p.vy[i] * dt
    p.age[i] += dt
  }
  return cull(p, f.bounds)
}

/** Removes dead or escaped particles in place, keeping the live ones packed. */
export function cull(p: Pool, bounds?: { w: number; h: number; margin: number }): number {
  let removed = 0
  let i = 0
  while (i < p.n) {
    const out = bounds && (p.x[i] < -bounds.margin || p.x[i] > bounds.w + bounds.margin || p.y[i] < -bounds.margin || p.y[i] > bounds.h + bounds.margin)
    if (p.age[i] >= p.life[i] || out) {
      const j = --p.n
      p.x[i] = p.x[j]
      p.y[i] = p.y[j]
      p.vx[i] = p.vx[j]
      p.vy[i] = p.vy[j]
      p.age[i] = p.age[j]
      p.life[i] = p.life[j]
      removed++
    } else i++
  }
  return removed
}
