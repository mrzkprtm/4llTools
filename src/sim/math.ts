/** Small numeric helpers shared by the simulations. Everything here is pure and tested. */

export const TAU = Math.PI * 2
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay)
export const deg = (rad: number) => (rad * 180) / Math.PI
export const rad = (d: number) => (d * Math.PI) / 180
export const round = (v: number, digits = 2) => {
  const f = 10 ** digits
  return Math.round(v * f) / f
}

/** Seeded pseudo-random generator (mulberry32) returning numbers in [0, 1). */
export function rng(seed = 1): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A standard normal sample (Box–Muller). */
export function gaussian(random: () => number = Math.random): number {
  const u = 1 - random()
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v)
}

/** One classic 4th-order Runge–Kutta step for dy/dt = f(t, y). */
export function rk4(f: (t: number, y: number[]) => number[], t: number, y: number[], dt: number): number[] {
  const k1 = f(t, y)
  const k2 = f(t + dt / 2, y.map((v, i) => v + (dt / 2) * k1[i]))
  const k3 = f(t + dt / 2, y.map((v, i) => v + (dt / 2) * k2[i]))
  const k4 = f(t + dt, y.map((v, i) => v + dt * k3[i]))
  return y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
}

/** Counts of `values` in `bins` equal buckets across [min, max]; values outside are clamped in. */
export function histogram(values: ArrayLike<number>, bins: number, min: number, max: number): number[] {
  const out = new Array<number>(bins).fill(0)
  const span = max - min || 1
  for (let i = 0; i < values.length; i++) {
    const b = Math.floor(((values[i] - min) / span) * bins)
    out[clamp(b, 0, bins - 1)]++
  }
  return out
}

export function mean(values: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < values.length; i++) s += values[i]
  return values.length ? s / values.length : 0
}

export function stdev(values: ArrayLike<number>): number {
  const m = mean(values)
  let s = 0
  for (let i = 0; i < values.length; i++) s += (values[i] - m) ** 2
  return values.length > 1 ? Math.sqrt(s / (values.length - 1)) : 0
}

/** Appends to a rolling series, dropping the oldest values past `max`. */
export function pushCap<T>(arr: T[], v: T, max: number): T[] {
  arr.push(v)
  if (arr.length > max) arr.splice(0, arr.length - max)
  return arr
}

/** 2D gradient noise (Perlin) in roughly [-1, 1]. Build one per seed with `makeNoise`. */
export function makeNoise(seed = 1): (x: number, y: number, z?: number) => number {
  const random = rng(seed)
  const p = new Uint8Array(512)
  const perm = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255]
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const grad = (h: number, x: number, y: number, z: number) => {
    const g = h & 15
    const u = g < 8 ? x : y
    const v = g < 4 ? y : g === 12 || g === 14 ? x : z
    return ((g & 1) === 0 ? u : -u) + ((g & 2) === 0 ? v : -v)
  }
  return (x: number, y: number, z = 0) => {
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const Z = Math.floor(z) & 255
    x -= Math.floor(x)
    y -= Math.floor(y)
    z -= Math.floor(z)
    const u = fade(x)
    const v = fade(y)
    const w = fade(z)
    const A = p[X] + Y
    const AA = p[A] + Z
    const AB = p[A + 1] + Z
    const B = p[X + 1] + Y
    const BA = p[B] + Z
    const BB = p[B + 1] + Z
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    )
  }
}

/** Formats a number compactly for readouts: 12 345, 1.23, 0.0012, 1.2e9. */
export function fmt(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e7 || a < 1e-3)) return v.toExponential(1)
  if (a >= 1000) return Math.round(v).toLocaleString('en-US')
  return String(round(v, digits))
}

/** A "nice" grid step (1, 2 or 5 × 10ⁿ) that splits `span` into about `target` parts. */
export function niceStep(span: number, target = 8): number {
  const raw = Math.abs(span) / Math.max(1, target)
  if (!(raw > 0) || !Number.isFinite(raw)) return 1
  const p = 10 ** Math.floor(Math.log10(raw))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p
}

/** Velocities after a head-on collision of masses m1 and m2 with restitution e (1 = elastic, 0 = they stick). */
export function collide1D(m1: number, v1: number, m2: number, v2: number, e = 1): [number, number] {
  const p = m1 * v1 + m2 * v2
  const M = m1 + m2
  return [(p + m2 * e * (v2 - v1)) / M, (p + m1 * e * (v1 - v2)) / M]
}
