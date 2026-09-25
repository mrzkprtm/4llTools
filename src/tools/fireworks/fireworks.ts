/** Firework bursts and a typed-array particle system. */

export type Burst = 'peony' | 'chrysanthemum' | 'ring' | 'willow' | 'crossette' | 'heart'

export const BURSTS: Burst[] = ['peony', 'chrysanthemum', 'ring', 'willow', 'crossette', 'heart']

/** Particle count, base speed (px/s), life (s) and drag for each burst type. */
export const BURST_SPEC: Record<Burst, { n: number; speed: number; life: number; drag: number }> = {
  peony: { n: 160, speed: 175, life: 1.6, drag: 1.3 },
  chrysanthemum: { n: 200, speed: 185, life: 2.1, drag: 1.2 },
  ring: { n: 90, speed: 165, life: 1.6, drag: 1.2 },
  willow: { n: 140, speed: 130, life: 3.6, drag: 2.2 },
  crossette: { n: 18, speed: 150, life: 0.55, drag: 0.9 },
  heart: { n: 120, speed: 9, life: 1.7, drag: 1.1 },
}

/**
 * Initial velocities for a burst: `n` pairs [vx, vy] (y down).
 * Peony-style shells pick random 3D directions and project them, which fills the disc the way a real
 * spherical shell looks from the ground; rings use one exact speed; hearts follow the heart curve.
 */
export function burstVelocities(type: Burst, n: number, speed: number, random: () => number = Math.random): Float32Array {
  const out = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    let vx: number
    let vy: number
    if (type === 'ring' || type === 'crossette') {
      const a = (i / n) * Math.PI * 2
      vx = Math.cos(a) * speed
      vy = Math.sin(a) * speed
    } else if (type === 'heart') {
      const t = (i / n) * Math.PI * 2
      vx = 16 * Math.sin(t) ** 3 * speed
      vy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * speed
    } else {
      // Uniform direction on a sphere, seen from the side.
      const z = random() * 2 - 1
      const a = random() * Math.PI * 2
      const s = Math.sqrt(1 - z * z) * speed * (0.92 + random() * 0.08)
      vx = Math.cos(a) * s
      vy = Math.sin(a) * s
    }
    out[2 * i] = vx
    out[2 * i + 1] = vy
  }
  return out
}

/** Launch velocity that makes a rocket from (x0, y0) peak exactly at (tx, ty) under gravity g (y down). */
export function launchVelocity(x0: number, y0: number, tx: number, ty: number, g: number): [number, number] {
  const rise = Math.max(1, y0 - ty)
  const vy = -Math.sqrt(2 * g * rise)
  const t = -vy / g
  return [(tx - x0) / t, vy]
}

/** Particle flags. */
export const TRAIL = 1
export const SPLIT = 2
export const SPARK = 4

export interface Particles {
  n: number
  cap: number
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  life: Float32Array
  max: Float32Array
  drag: Float32Array
  color: Uint8Array
  flags: Uint8Array
}

export function makeParticles(cap: number): Particles {
  const f = () => new Float32Array(cap)
  return { n: 0, cap, x: f(), y: f(), vx: f(), vy: f(), life: f(), max: f(), drag: f(), color: new Uint8Array(cap), flags: new Uint8Array(cap) }
}

export function addParticle(p: Particles, x: number, y: number, vx: number, vy: number, life: number, drag: number, color: number, flags = 0): boolean {
  if (p.n >= p.cap) return false
  const i = p.n++
  p.x[i] = x
  p.y[i] = y
  p.vx[i] = vx
  p.vy[i] = vy
  p.life[i] = life
  p.max[i] = life
  p.drag[i] = drag
  p.color[i] = color
  p.flags[i] = flags
  return true
}

/**
 * Advances every particle: gravity, air drag (exponential slow-down), motion and ageing.
 * Dead particles are swap-removed. Crossette stars that expire split into four sideways stars,
 * and trailing stars shed faint sparks.
 */
export function stepParticles(p: Particles, dt: number, g: number, dragScale: number, random: () => number = Math.random) {
  const { x, y, vx, vy, life, drag, flags } = p
  const born: number[] = []
  for (let i = 0; i < p.n; i++) {
    const k = Math.exp(-drag[i] * dragScale * dt)
    vx[i] *= k
    vy[i] = vy[i] * k + g * dt
    x[i] += vx[i] * dt
    y[i] += vy[i] * dt
    life[i] -= dt
    // Trailing stars shed sparks, but never crowd out room for new shells.
    if (flags[i] & TRAIL && p.n + born.length / 3 < p.cap * 0.7 && random() < 0.15) born.push(x[i], y[i], p.color[i])
    if (life[i] <= 0 && flags[i] & SPLIT) {
      const a = Math.atan2(vy[i], vx[i])
      for (let s = 0; s < 4; s++) {
        const b = a + Math.PI / 4 + (s * Math.PI) / 2
        addParticle(p, x[i], y[i], Math.cos(b) * 85 + vx[i] * 0.3, Math.sin(b) * 85 + vy[i] * 0.3, 0.9 + random() * 0.3, 1.2, p.color[i], 0)
      }
    }
  }
  for (let q = 0; q < born.length; q += 3) addParticle(p, born[q], born[q + 1], (random() - 0.5) * 10, (random() - 0.5) * 10 + 8, 0.4 + random() * 0.4, 2, born[q + 2], SPARK)
  for (let i = p.n - 1; i >= 0; i--)
    if (life[i] <= 0) {
      const j = --p.n
      if (i !== j) {
        x[i] = x[j]
        y[i] = y[j]
        vx[i] = vx[j]
        vy[i] = vy[j]
        life[i] = life[j]
        p.max[i] = p.max[j]
        drag[i] = drag[j]
        p.color[i] = p.color[j]
        flags[i] = flags[j]
      }
    }
}
