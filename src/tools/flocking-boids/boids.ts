import { TAU } from '../../sim/math'

export interface Flock {
  n: number
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
}

export interface BoidParams {
  separation: number
  alignment: number
  cohesion: number
  /** Neighbour radius in world units. */
  perception: number
  maxSpeed: number
}

export interface Obstacle {
  x: number
  y: number
  r: number
}

export interface Hawk {
  x: number
  y: number
  attract: boolean
}

export const MAX_BOIDS = 600
/** Neighbours considered per boid: real starlings watch only a handful. */
const MAX_NEIGHBOURS = 30

export function createFlock(w: number, h: number, speed: number, random: () => number): Flock {
  const f: Flock = { n: 0, x: new Float32Array(MAX_BOIDS), y: new Float32Array(MAX_BOIDS), vx: new Float32Array(MAX_BOIDS), vy: new Float32Array(MAX_BOIDS) }
  for (let i = 0; i < MAX_BOIDS; i++) {
    const a = random() * TAU
    f.x[i] = random() * w
    f.y[i] = random() * h
    f.vx[i] = Math.cos(a) * speed * 0.7
    f.vy[i] = Math.sin(a) * speed * 0.7
  }
  return f
}

/** Clamps the length of (x, y) to `max`. */
export function limit(x: number, y: number, max: number): [number, number] {
  const m = Math.hypot(x, y)
  return m > max && m > 0 ? [(x / m) * max, (y / m) * max] : [x, y]
}

/** Reynolds steering: the change of velocity that turns v toward direction (dx, dy) at full speed. */
export function steer(dx: number, dy: number, vx: number, vy: number, maxSpeed: number, maxForce: number): [number, number] {
  const m = Math.hypot(dx, dy)
  if (m === 0) return [0, 0]
  return limit((dx / m) * maxSpeed - vx, (dy / m) * maxSpeed - vy, maxForce)
}

/** Order parameter: length of the mean unit heading, 1 when all boids fly the same way, near 0 when disordered. */
export function polarization(vx: ArrayLike<number>, vy: ArrayLike<number>, n: number): number {
  let sx = 0
  let sy = 0
  for (let i = 0; i < n; i++) {
    const m = Math.hypot(vx[i], vy[i]) || 1
    sx += vx[i] / m
    sy += vy[i] / m
  }
  return n ? Math.hypot(sx, sy) / n : 0
}

export function averageSpeed(f: Flock): number {
  let s = 0
  for (let i = 0; i < f.n; i++) s += Math.hypot(f.vx[i], f.vy[i])
  return f.n ? s / f.n : 0
}

/**
 * Moves the flock by dt seconds on a wrapping w×h world. Neighbours are found
 * with a uniform grid whose cells are at least one perception radius wide.
 * Returns the mean number of neighbours per boid.
 */
export function stepFlock(f: Flock, p: BoidParams, dt: number, w: number, h: number, obstacles: Obstacle[] = [], hawk: Hawk | null = null): number {
  const { n, x, y, vx, vy } = f
  const R = p.perception
  const cols = Math.max(1, Math.floor(w / R))
  const rows = Math.max(1, Math.floor(h / R))
  const cw = w / cols
  const ch = h / rows
  const head = new Int32Array(cols * rows).fill(-1)
  const next = new Int32Array(n)
  const cellOf = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    const cx = Math.max(0, Math.min(cols - 1, Math.floor(x[i] / cw)))
    const cy = Math.max(0, Math.min(rows - 1, Math.floor(y[i] / ch)))
    const k = cy * cols + cx
    cellOf[i] = k
    next[i] = head[k]
    head[k] = i
  }
  const ax = new Float32Array(n)
  const ay = new Float32Array(n)
  const maxForce = p.maxSpeed * 2.5
  const sepR = R * 0.45
  let total = 0
  const dxs = cols >= 3 ? [-1, 0, 1] : cols === 2 ? [0, 1] : [0]
  const dys = rows >= 3 ? [-1, 0, 1] : rows === 2 ? [0, 1] : [0]
  for (let i = 0; i < n; i++) {
    let count = 0
    let avx = 0
    let avy = 0
    let cx = 0
    let cy = 0
    let sx = 0
    let sy = 0
    const gx = cellOf[i] % cols
    const gy = Math.floor(cellOf[i] / cols)
    outer: for (const oy of dys)
      for (const ox of dxs) {
        const k = ((gy + oy + rows) % rows) * cols + ((gx + ox + cols) % cols)
        for (let j = head[k]; j >= 0; j = next[j]) {
          if (j === i) continue
          let dx = x[j] - x[i]
          let dy = y[j] - y[i]
          dx -= w * Math.round(dx / w)
          dy -= h * Math.round(dy / h)
          const d2 = dx * dx + dy * dy
          if (d2 > R * R) continue
          count++
          avx += vx[j]
          avy += vy[j]
          cx += dx
          cy += dy
          if (d2 < sepR * sepR && d2 > 0) {
            const d = Math.sqrt(d2)
            sx -= dx / d / d
            sy -= dy / d / d
          }
          if (count >= MAX_NEIGHBOURS) break outer
        }
      }
    total += count
    if (count > 0) {
      const [a1, b1] = steer(avx, avy, vx[i], vy[i], p.maxSpeed, maxForce)
      const [a2, b2] = steer(cx, cy, vx[i], vy[i], p.maxSpeed, maxForce)
      ax[i] += a1 * p.alignment + a2 * p.cohesion
      ay[i] += b1 * p.alignment + b2 * p.cohesion
      if (sx || sy) {
        const [a3, b3] = steer(sx, sy, vx[i], vy[i], p.maxSpeed, maxForce)
        ax[i] += a3 * p.separation * 1.5
        ay[i] += b3 * p.separation * 1.5
      }
    }
    for (const o of obstacles) {
      const dx = x[i] - o.x
      const dy = y[i] - o.y
      const d = Math.hypot(dx, dy)
      const reach = o.r + R * 0.7
      if (d < reach && d > 0) {
        const [a4, b4] = steer(dx, dy, vx[i], vy[i], p.maxSpeed, maxForce)
        const s = 3 * (1 - (d - o.r) / (reach - o.r))
        ax[i] += a4 * Math.max(0, s)
        ay[i] += b4 * Math.max(0, s)
      }
    }
    if (hawk) {
      let dx = x[i] - hawk.x
      let dy = y[i] - hawk.y
      dx -= w * Math.round(dx / w)
      dy -= h * Math.round(dy / h)
      const d = Math.hypot(dx, dy)
      if (!hawk.attract && d < 110) {
        const [a5, b5] = steer(dx, dy, vx[i], vy[i], p.maxSpeed * 1.4, maxForce * 3)
        ax[i] += a5 * 2
        ay[i] += b5 * 2
      } else if (hawk.attract && d < 260 && d > 0) {
        const [a5, b5] = steer(-dx, -dy, vx[i], vy[i], p.maxSpeed, maxForce)
        ax[i] += a5 * 1.2
        ay[i] += b5 * 1.2
      }
    }
  }
  for (let i = 0; i < n; i++) {
    let nvx = vx[i] + ax[i] * dt
    let nvy = vy[i] + ay[i] * dt
    ;[nvx, nvy] = limit(nvx, nvy, p.maxSpeed * (hawk && !hawk.attract ? 1.4 : 1))
    // Birds never hover: speed relaxes toward a cruising speed and never drops below half of it.
    const m = Math.hypot(nvx, nvy)
    const cruise = p.maxSpeed * 0.85
    const want = Math.max(cruise * 0.5, m + (cruise - m) * Math.min(1, 1.5 * dt))
    if (m > 0) {
      nvx *= want / m
      nvy *= want / m
    } else nvx = want
    vx[i] = nvx
    vy[i] = nvy
    x[i] = (x[i] + vx[i] * dt + w) % w
    y[i] = (y[i] + vy[i] * dt + h) % h
    for (const o of obstacles) {
      const dx = x[i] - o.x
      const dy = y[i] - o.y
      const d = Math.hypot(dx, dy)
      if (d < o.r && d > 0) {
        x[i] = (o.x + (dx / d) * o.r + w) % w
        y[i] = (o.y + (dy / d) * o.r + h) % h
      }
    }
  }
  return n ? total / n : 0
}
