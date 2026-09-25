/** Growth-based circle packing: seed circles in free space, grow them until they touch. */

export interface Circle {
  x: number
  y: number
  r: number
  growing: boolean
  /** Largest radius this circle may reach. */
  max: number
  /** A random number used to pick its colour. */
  tone: number
}

export interface PackOpts {
  w: number
  h: number
  minR: number
  maxR: number
  /** Gap kept between neighbouring circles. */
  spacing: number
  /** Optional shape: circles must stay where this is true. */
  inside?: (x: number, y: number) => boolean
}

const CELL = 24

export interface Packer {
  opts: PackOpts
  circles: Circle[]
  grid: Map<number, number[]>
  /** Consecutive steps in which nothing was added and nothing grew. */
  idle: number
  /** Largest radius so far, which bounds how far neighbour searches must reach. */
  biggest: number
}

export function makePacker(opts: PackOpts): Packer {
  return { opts, circles: [], grid: new Map(), idle: 0, biggest: 0 }
}

const key = (cx: number, cy: number) => cy * 4096 + cx

function insert(p: Packer, i: number) {
  const c = p.circles[i]
  const k = key(Math.floor(c.x / CELL), Math.floor(c.y / CELL))
  const list = p.grid.get(k)
  if (list) list.push(i)
  else p.grid.set(k, [i])
}

/** Calls fn for every circle whose centre lies within `reach` (plus a cell) of (x, y). */
function near(p: Packer, x: number, y: number, reach: number, fn: (j: number) => void) {
  const r = Math.ceil(reach / CELL)
  const cx = Math.floor(x / CELL)
  const cy = Math.floor(y / CELL)
  for (let gy = cy - r; gy <= cy + r; gy++)
    for (let gx = cx - r; gx <= cx + r; gx++) {
      const list = p.grid.get(key(gx, gy))
      if (list) for (const j of list) fn(j)
    }
}

/** Largest radius a circle at (x, y) could have without crossing the edges, the shape or any other circle (capped at `cap`). */
export function room(p: Packer, x: number, y: number, cap: number, skip = -1): number {
  const { w, h, spacing, inside } = p.opts
  let best = Math.min(cap, x, y, w - x, h - y)
  // The largest neighbour so far bounds how far we need to look.
  const reach = cap + spacing + p.biggest
  near(p, x, y, reach, (j) => {
    if (j === skip) return
    const c = p.circles[j]
    best = Math.min(best, Math.hypot(c.x - x, c.y - y) - c.r - spacing)
  })
  if (inside && best > 0) {
    // Shrink until the rim stays inside the shape.
    const n = Math.max(12, Math.ceil((2 * Math.PI * best) / 3))
    for (let k = 0; k < n && best > 0; k++) {
      const a = (k / n) * Math.PI * 2
      if (!inside(x + Math.cos(a) * best, y + Math.sin(a) * best)) {
        // Binary-search the distance to the shape's edge along this direction.
        let lo = 0
        let hi = best
        for (let s = 0; s < 8; s++) {
          const mid = (lo + hi) / 2
          if (inside(x + Math.cos(a) * mid, y + Math.sin(a) * mid)) lo = mid
          else hi = mid
        }
        best = lo
      }
    }
  }
  return best
}

/** Adds a circle of radius minR at (x, y) if there is room; returns its index or -1. */
export function seed(p: Packer, x: number, y: number, random: () => number, max = p.opts.maxR): number {
  const { minR, inside } = p.opts
  if (inside && !inside(x, y)) return -1
  if (room(p, x, y, minR) < minR) return -1
  p.circles.push({ x, y, r: minR, growing: true, max, tone: random() })
  p.biggest = Math.max(p.biggest, minR)
  insert(p, p.circles.length - 1)
  return p.circles.length - 1
}

/**
 * One step: try `attempts` random spots and seed up to `spawn` circles, then grow every growing circle
 * by `growth`. A circle stops the moment it would touch a neighbour, an edge or the shape outline,
 * and is snapped to exactly touching. Circles are updated one at a time, so they never overlap.
 */
export function stepPacker(p: Packer, random: () => number, growth: number, spawn: number, attempts: number): number {
  const { w, h } = p.opts
  let added = 0
  for (let a = 0; a < attempts && added < spawn; a++) if (seed(p, random() * w, random() * h, random) >= 0) added++
  let grew = 0
  for (let i = 0; i < p.circles.length; i++) {
    const c = p.circles[i]
    if (!c.growing) continue
    const want = Math.min(c.max, c.r + growth)
    const limit = room(p, c.x, c.y, want, i)
    if (limit >= want && want < c.max) {
      c.r = want
      grew++
    } else {
      c.r = Math.max(c.r, Math.min(want, limit))
      c.growing = false
    }
    if (c.r > p.biggest) p.biggest = c.r
  }
  p.idle = added || grew ? 0 : p.idle + 1
  return added
}

/** Fraction of the area (or of `area` when given) covered by the circles. */
export function coverage(circles: readonly { r: number }[], area: number): number {
  let s = 0
  for (const c of circles) s += Math.PI * c.r * c.r
  return area > 0 ? s / area : 0
}
