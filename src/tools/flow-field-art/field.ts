import { TAU, makeNoise, rng } from '../../sim/math'

export interface Palette {
  label: string
  bg: string
  colors: string[]
  /** 'lighter' makes overlapping strokes glow (for dark palettes). */
  blend: GlobalCompositeOperation
}

export const PALETTES = {
  sunset: { label: 'Sunset', bg: '#1b0f2e', colors: ['#ff6b6b', '#feca57', '#ff9f43', '#ee5a6f', '#f8b4d9'], blend: 'lighter' },
  ocean: { label: 'Ocean', bg: '#04192b', colors: ['#48dbfb', '#0abde3', '#1dd1a1', '#c8f7ff', '#5f7cff'], blend: 'lighter' },
  ink: { label: 'Mono ink', bg: '#f3eee2', colors: ['#1b1a17', '#2f2c27', '#4a463e'], blend: 'source-over' },
  neon: { label: 'Neon on black', bg: '#050507', colors: ['#ff2bd6', '#00f0ff', '#faff00', '#8f5bff'], blend: 'lighter' },
  paper: { label: 'Paper', bg: '#f6f1e7', colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'], blend: 'source-over' },
  forest: { label: 'Forest', bg: '#0f1a12', colors: ['#a7c957', '#6a994e', '#f2e8cf', '#e9c46a', '#386641'], blend: 'lighter' },
} satisfies Record<string, Palette>

export type PaletteKey = keyof typeof PALETTES

/**
 * A seeded flow field. The heading at (x, y) is Perlin noise at (x·scale, y·scale, z),
 * scaled so that `turns` = 1 lets the heading sweep roughly one full turn across the field.
 */
export function makeField(seed: number) {
  const noise = makeNoise(seed)
  // Gradient noise is exactly 0 on integer lattice points; a fractional z offset hides those seams.
  return (x: number, y: number, z: number, scale: number, turns: number) => noise(x * scale, y * scale, z + 0.43) * TAU * turns
}

/**
 * Bends a heading towards a vortex around (cx, cy): inside `radius` the particle is
 * steered along the tangent (slightly inwards), fading smoothly to the plain field at the rim.
 */
export function swirl(angle: number, x: number, y: number, cx: number, cy: number, radius: number): number {
  const dx = x - cx
  const dy = y - cy
  const d = Math.hypot(dx, dy)
  if (d >= radius || d < 1e-6) return angle
  const w = (1 - d / radius) ** 2
  const tangent = Math.atan2(dy, dx) + Math.PI / 2 + 0.25
  const vx = Math.cos(angle) * (1 - w) + Math.cos(tangent) * w
  const vy = Math.sin(angle) * (1 - w) + Math.sin(tangent) * w
  return Math.atan2(vy, vx)
}

export interface Particles {
  n: number
  x: Float32Array
  y: Float32Array
  px: Float32Array
  py: Float32Array
  life: Float32Array
  color: Uint8Array
}

export function makeParticles(max: number): Particles {
  return {
    n: 0,
    x: new Float32Array(max),
    y: new Float32Array(max),
    px: new Float32Array(max),
    py: new Float32Array(max),
    life: new Float32Array(max),
    color: new Uint8Array(max),
  }
}

/** Places particle i at a random spot with a fresh lifetime; its stroke restarts there. */
export function spawn(p: Particles, i: number, w: number, h: number, colors: number, random: () => number) {
  p.x[i] = p.px[i] = random() * w
  p.y[i] = p.py[i] = random() * h
  p.life[i] = 60 + random() * 240
  p.color[i] = Math.floor(random() * colors)
}

export function seedParticles(p: Particles, n: number, w: number, h: number, colors: number, seed: number) {
  const random = rng(seed * 7919 + 13)
  p.n = Math.min(n, p.x.length)
  for (let i = 0; i < p.n; i++) spawn(p, i, w, h, colors, random)
  return random
}

/**
 * Moves every particle one step of length `step` along `heading(x, y)`. Particles that
 * leave the field or run out of life respawn (with px/py reset so no streak is drawn).
 */
export function stepParticles(p: Particles, heading: (x: number, y: number) => number, step: number, w: number, h: number, colors: number, random: () => number) {
  for (let i = 0; i < p.n; i++) {
    p.px[i] = p.x[i]
    p.py[i] = p.y[i]
    const a = heading(p.x[i], p.y[i])
    p.x[i] += Math.cos(a) * step
    p.y[i] += Math.sin(a) * step
    p.life[i] -= 1
    if (p.life[i] <= 0 || p.x[i] < -2 || p.x[i] > w + 2 || p.y[i] < -2 || p.y[i] > h + 2) spawn(p, i, w, h, colors, random)
  }
}
