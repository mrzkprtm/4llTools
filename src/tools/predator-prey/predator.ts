import { TAU, rk4 } from '../../sim/math'

export interface LV {
  alpha: number
  beta: number
  gamma: number
  delta: number
}

/** Lotka–Volterra: prey x grows at α and is eaten at βxy; predators y grow at δxy and die at γ. */
export function lotkaVolterra({ alpha, beta, gamma, delta }: LV) {
  return (_t: number, s: number[]): number[] => {
    const [x, y] = s
    return [alpha * x - beta * x * y, delta * x * y - gamma * y]
  }
}

/** The quantity V = δx − γ ln x + βy − α ln y is constant along every orbit. */
export function lvInvariant(x: number, y: number, { alpha, beta, gamma, delta }: LV): number {
  return delta * x - gamma * Math.log(x) + beta * y - alpha * Math.log(y)
}

export function equilibrium({ alpha, beta, gamma, delta }: LV): [number, number] {
  return [gamma / delta, alpha / beta]
}

/**
 * Follows one full loop around the equilibrium from (x0, y0) with RK4 and returns
 * the path and its period (the time for the angle about the equilibrium to turn 2π).
 */
export function lvOrbit(p: LV, x0: number, y0: number, dt = 0.005, maxT = 400): { period: number; path: [number, number][] } {
  const f = lotkaVolterra(p)
  const [ex, ey] = equilibrium(p)
  let s = [x0, y0]
  let t = 0
  let turned = 0
  let prev = Math.atan2(y0 - ey, x0 - ex)
  const path: [number, number][] = [[x0, y0]]
  while (t < maxT) {
    const next = rk4(f, t, s, dt)
    const a = Math.atan2(next[1] - ey, next[0] - ex)
    let d = a - prev
    if (d > Math.PI) d -= TAU
    if (d < -Math.PI) d += TAU
    if (Math.abs(turned + d) >= TAU) {
      // Interpolate the moment the loop closes.
      const frac = (TAU - Math.abs(turned)) / Math.abs(d)
      return { period: t + frac * dt, path }
    }
    turned += d
    prev = a
    s = next
    t += dt
    if (path.length < 4000 && Math.round(t / dt) % 4 === 0) path.push([s[0], s[1]])
  }
  return { period: NaN, path }
}

/**
 * Estimates the period of an oscillating series from the spacing of its upward
 * crossings of the mean (with a little hysteresis so noise is not counted).
 */
export function estimatePeriod(values: ArrayLike<number>, dt: number): number {
  const n = values.length
  if (n < 8) return NaN
  let m = 0
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < n; i++) {
    m += values[i]
    lo = Math.min(lo, values[i])
    hi = Math.max(hi, values[i])
  }
  m /= n
  const band = (hi - lo) * 0.1
  if (band <= 0) return NaN
  const ups: number[] = []
  let armed = values[0] < m - band
  for (let i = 1; i < n; i++) {
    if (values[i] < m - band) armed = true
    if (armed && values[i - 1] < m && values[i] >= m) {
      ups.push(i - 1 + (m - values[i - 1]) / (values[i] - values[i - 1]))
      armed = false
    }
  }
  if (ups.length < 2) return NaN
  return ((ups[ups.length - 1] - ups[0]) / (ups.length - 1)) * dt
}

/* ---------- Agent world: grass, rabbits and foxes on a wrapping grid of patches ---------- */

export interface Animal {
  x: number
  y: number
  a: number
  e: number
}

export interface EcoParams {
  rabbitBirth: number
  foxBirth: number
  regrow: number
  rabbitGain: number
  foxGain: number
}

export interface Eco {
  cols: number
  rows: number
  /** Ticks until each patch of grass is grown back (0 = grass). */
  grass: Int16Array
  rabbits: Animal[]
  foxes: Animal[]
  tick: number
}

export function createEco(cols: number, rows: number, rabbits: number, foxes: number, p: EcoParams, random: () => number): Eco {
  const grass = new Int16Array(cols * rows)
  for (let i = 0; i < grass.length; i++) grass[i] = random() < 0.5 ? 0 : Math.floor(random() * p.regrow)
  const spawn = (gain: number): Animal => ({ x: random() * cols, y: random() * rows, a: random() * TAU, e: random() * 2 * gain })
  return {
    cols,
    rows,
    grass,
    rabbits: Array.from({ length: rabbits }, () => spawn(p.rabbitGain)),
    foxes: Array.from({ length: foxes }, () => spawn(p.foxGain)),
    tick: 0,
  }
}

const MAX_RABBITS = 2500
const MAX_FOXES = 800

function move(an: Animal, cols: number, rows: number, random: () => number) {
  an.a += (random() - random()) * 0.9
  an.x = (an.x + Math.cos(an.a) + cols) % cols
  an.y = (an.y + Math.sin(an.a) + rows) % rows
}

/** One tick of the classic wolf–sheep–grass model. */
export function stepEco(eco: Eco, p: EcoParams, random: () => number) {
  const { cols, rows, grass } = eco
  const born: Animal[] = []
  for (const r of eco.rabbits) {
    move(r, cols, rows, random)
    r.e -= 1
    const k = Math.floor(r.y) * cols + Math.floor(r.x)
    if (grass[k] === 0) {
      grass[k] = p.regrow
      r.e += p.rabbitGain
    }
    if (r.e >= 0 && random() < p.rabbitBirth && eco.rabbits.length + born.length < MAX_RABBITS) {
      r.e /= 2
      born.push({ x: r.x, y: r.y, a: random() * TAU, e: r.e })
    }
  }
  eco.rabbits.push(...born)
  // Patch → rabbits index so a fox can find a rabbit on its own patch.
  const head = new Int32Array(cols * rows).fill(-1)
  const next = new Int32Array(eco.rabbits.length)
  eco.rabbits.forEach((r, i) => {
    const k = Math.floor(r.y) * cols + Math.floor(r.x)
    next[i] = head[k]
    head[k] = i
  })
  const eaten = new Uint8Array(eco.rabbits.length)
  const cubs: Animal[] = []
  for (const f of eco.foxes) {
    move(f, cols, rows, random)
    f.e -= 1
    const k = Math.floor(f.y) * cols + Math.floor(f.x)
    for (let j = head[k]; j >= 0; j = next[j])
      if (!eaten[j] && eco.rabbits[j].e >= 0) {
        eaten[j] = 1
        f.e += p.foxGain
        break
      }
    if (f.e >= 0 && random() < p.foxBirth && eco.foxes.length + cubs.length < MAX_FOXES) {
      f.e /= 2
      cubs.push({ x: f.x, y: f.y, a: random() * TAU, e: f.e })
    }
  }
  eco.rabbits = eco.rabbits.filter((r, i) => !eaten[i] && r.e >= 0)
  eco.foxes = eco.foxes.concat(cubs).filter((f) => f.e >= 0)
  for (let i = 0; i < grass.length; i++) if (grass[i] > 0) grass[i]--
  eco.tick++
}

export function grassCover(eco: Eco): number {
  let g = 0
  for (let i = 0; i < eco.grass.length; i++) if (eco.grass[i] === 0) g++
  return g / eco.grass.length
}
