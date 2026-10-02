import { TAU } from '../../sim/math'

/** A grid of cells holding two pheromone fields, walls and food. */
export interface Field {
  cols: number
  rows: number
  cell: number
  /** "To home" pheromone, laid by ants that are searching (they came from the nest). */
  home: Float32Array
  /** "To food" pheromone, laid by ants carrying food back. */
  food: Float32Array
  walls: Uint8Array
  /** Units of food in each cell. */
  stock: Uint8Array
  tmp: Float32Array
}

export function createField(cols: number, rows: number, cell: number): Field {
  const n = cols * rows
  return { cols, rows, cell, home: new Float32Array(n), food: new Float32Array(n), walls: new Uint8Array(n), stock: new Uint8Array(n), tmp: new Float32Array(n) }
}

/** Exponential evaporation: every value is multiplied by e^(−rate·dt). */
export function evaporate(grid: Float32Array, rate: number, dt: number) {
  const f = Math.exp(-rate * dt)
  for (let i = 0; i < grid.length; i++) grid[i] *= f
}

/**
 * One explicit diffusion step on a cols×rows grid: each cell exchanges k/4 of the
 * difference with each open 4-neighbour. Edges and walls do not let anything
 * through, so the total amount is conserved.
 */
export function diffuse(grid: Float32Array, cols: number, rows: number, k: number, walls?: Uint8Array, tmp: Float32Array = new Float32Array(grid.length)) {
  const q = Math.min(k, 1) / 4
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x
      const v = grid[i]
      if (walls?.[i]) {
        tmp[i] = v
        continue
      }
      let flow = 0
      if (x > 0 && !walls?.[i - 1]) flow += grid[i - 1] - v
      if (x < cols - 1 && !walls?.[i + 1]) flow += grid[i + 1] - v
      if (y > 0 && !walls?.[i - cols]) flow += grid[i - cols] - v
      if (y < rows - 1 && !walls?.[i + cols]) flow += grid[i + cols] - v
      tmp[i] = v + q * flow
    }
  grid.set(tmp)
}

/** Sum of a pheromone grid over the 3×3 cells around world point (x, y); −1 outside the grid or in a wall. */
export function sense(grid: Float32Array, f: Pick<Field, 'cols' | 'rows' | 'cell' | 'walls'>, x: number, y: number): number {
  const cx = Math.floor(x / f.cell)
  const cy = Math.floor(y / f.cell)
  if (cx < 0 || cy < 0 || cx >= f.cols || cy >= f.rows || f.walls[cy * f.cols + cx]) return -1
  let s = 0
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox
      const gy = cy + oy
      if (gx >= 0 && gy >= 0 && gx < f.cols && gy < f.rows) s += grid[gy * f.cols + gx]
    }
  return s
}

/** Which way to turn given left, centre and right sensor readings: −1 left, 0 straight, 1 right. */
export function turnToward(l: number, c: number, r: number): -1 | 0 | 1 {
  if (c >= l && c >= r) return 0
  return l > r ? -1 : 1
}

export interface Ants {
  n: number
  x: Float32Array
  y: Float32Array
  a: Float32Array
  carrying: Uint8Array
  /** Seconds since the ant last touched the nest or food; its trail fades with this. */
  age: Float32Array
}

export const MAX_ANTS = 500

export function createAnts(nx: number, ny: number, random: () => number): Ants {
  const a: Ants = { n: 0, x: new Float32Array(MAX_ANTS), y: new Float32Array(MAX_ANTS), a: new Float32Array(MAX_ANTS), carrying: new Uint8Array(MAX_ANTS), age: new Float32Array(MAX_ANTS) }
  for (let i = 0; i < MAX_ANTS; i++) {
    a.x[i] = nx
    a.y[i] = ny
    a.a[i] = random() * TAU
  }
  return a
}

export interface AntParams {
  sensorAngle: number
  sensorDist: number
  speed: number
  nest: { x: number; y: number; r: number }
}

const SEE = 60

/** Moves every ant by dt seconds. Returns how many units of food reached the nest. */
export function stepAnts(ants: Ants, f: Field, p: AntParams, dt: number, random: () => number): number {
  let delivered = 0
  const { cols, rows, cell } = f
  const W = cols * cell
  const H = rows * cell
  const { nest } = p
  for (let i = 0; i < ants.n; i++) {
    let a = ants.a[i]
    const carrying = ants.carrying[i] === 1
    const x = ants.x[i]
    const y = ants.y[i]
    const trail = carrying ? f.home : f.food
    const read = (ang: number) => {
      const sx = x + Math.cos(ang) * p.sensorDist
      const sy = y + Math.sin(ang) * p.sensorDist
      let v = sense(trail, f, sx, sy)
      if (v < 0) return v
      if (carrying) {
        if (Math.hypot(sx - nest.x, sy - nest.y) < nest.r + cell) v += SEE
      } else {
        const k = Math.floor(sy / cell) * cols + Math.floor(sx / cell)
        if (f.stock[k] > 0) v += SEE
      }
      return v
    }
    const l = read(a - p.sensorAngle)
    const c = read(a)
    const r = read(a + p.sensorAngle)
    a += turnToward(l, c, r) * 7 * dt + (random() - 0.5) * 4 * Math.sqrt(dt)
    // With no scent at all, a loaded ant falls back on its rough sense of where home is (path integration).
    if (carrying && Math.max(l, c, r) < 0.05) {
      let d = Math.atan2(nest.y - y, nest.x - x) - a
      d -= TAU * Math.round(d / TAU)
      a += d * 0.8 * dt
    }
    // Close to home an ant with food just heads straight in.
    if (carrying && Math.hypot(x - nest.x, y - nest.y) < nest.r + 30) a = Math.atan2(nest.y - y, nest.x - x)
    let nx = x + Math.cos(a) * p.speed * dt
    let ny = y + Math.sin(a) * p.speed * dt
    const k = Math.floor(ny / cell) * cols + Math.floor(nx / cell)
    const from = Math.floor(y / cell) * cols + Math.floor(x / cell)
    // Walls block a step into them; an ant buried by a freshly drawn wall may walk out.
    if (nx < 1 || ny < 1 || nx > W - 1 || ny > H - 1 || (f.walls[k] && !f.walls[from])) {
      a += Math.PI + (random() - 0.5) * 1.2
      nx = x
      ny = y
    }
    ants.x[i] = nx
    ants.y[i] = ny
    ants.age[i] += dt
    const here = Math.floor(ny / cell) * cols + Math.floor(nx / cell)
    if (!carrying && f.stock[here] > 0) {
      f.stock[here]--
      ants.carrying[i] = 1
      ants.age[i] = 0
      a += Math.PI
    } else if (carrying && Math.hypot(nx - nest.x, ny - nest.y) < nest.r) {
      ants.carrying[i] = 0
      ants.age[i] = 0
      delivered++
      a += Math.PI
    }
    if (!carrying && Math.hypot(nx - nest.x, ny - nest.y) < nest.r) ants.age[i] = 0
    // Lay the trail that leads back to where the ant came from, weaker the longer it has walked.
    const strength = Math.exp(-ants.age[i] / 6) * dt * 8
    const g = ants.carrying[i] ? f.food : f.home
    g[here] = Math.min(20, g[here] + strength)
    ants.a[i] = a
  }
  return delivered
}
