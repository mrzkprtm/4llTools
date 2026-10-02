import { TAU } from '../../sim/math'

/** A 2×2 linear map [a, b, c, d] sending (x, y) to (a·x + c·y, b·x + d·y), the same layout as canvas setTransform. */
export type Mat = [number, number, number, number]

/**
 * The symmetry group of a kaleidoscope with `n` slices: n rotations by k·360°/n, plus
 * (with `mirror`) n reflections, which together form the dihedral group Dₙ.
 */
export function symmetryMatrices(n: number, mirror: boolean): Mat[] {
  const out: Mat[] = []
  for (let k = 0; k < n; k++) {
    const a = (k * TAU) / n
    const c = Math.cos(a)
    const s = Math.sin(a)
    out.push([c, s, -s, c])
    // Reflect across the x axis, then rotate: a reflection across the line at angle a/2.
    if (mirror) out.push([c, s, s, -c])
  }
  return out
}

/** Every copy of the point (x, y) (relative to the centre) under the kaleidoscope's symmetry. */
export function symmetryPoints(x: number, y: number, n: number, mirror: boolean): [number, number][] {
  return symmetryMatrices(n, mirror).map(([a, b, c, d]) => [a * x + c * y, b * x + d * y])
}

/** Rotates (x, y) by angle a. */
export function rotate(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [c * x - s * y, s * x + c * y]
}

export interface Stroke {
  /** Flat list of x, y, hue triples in art space (origin at the centre). */
  pts: number[]
  n: number
  mirror: boolean
  size: number
  /** Fixed colour, or null when the hue cycles along the stroke. */
  color: string | null
  glow: boolean
}

/** The colour of a stroke near point index i. */
export function strokeColor(s: Stroke, i: number, dark: boolean): string {
  if (s.color) return s.color
  const h = Math.round(s.pts[i * 3 + 2]) % 360
  return dark ? `hsl(${h} 95% 62%)` : `hsl(${h} 80% 42%)`
}

/** Points per colour run. Runs are aligned to multiples of RUN so redraws always match the live drawing. */
export const RUN = 6

/** Number of runs a stroke with `count` points is split into (a single point is one run: a dot). */
export const runCount = (count: number) => (count <= 1 ? count : Math.ceil((count - 1) / RUN))

/**
 * Draws runs [j0, j1) of a stroke, once for every symmetry copy. Run j joins points
 * j·RUN … (j+1)·RUN. `base` is the canvas transform [a, b, c, d, e, f] from art space
 * (origin at the kaleidoscope centre) to the target canvas.
 */
export function drawRuns(ctx: CanvasRenderingContext2D, s: Stroke, j0: number, j1: number, base: [number, number, number, number, number, number], dark: boolean) {
  const count = s.pts.length / 3
  const last = count - 1
  if (count < 1 || j1 <= j0) return
  const mats = symmetryMatrices(s.n, s.mirror)
  const [A, B, C, D, E, F] = base
  const additive = dark && s.glow
  // Additive runs meet end to end, so round caps would double up into beads at every join.
  ctx.lineCap = additive ? 'butt' : 'round'
  ctx.lineJoin = 'round'
  ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over'
  for (let j = j0; j < j1; j++) {
    const i0 = j * RUN
    if (i0 > last) break
    const stop = Math.min(i0 + RUN, last)
    const path = new Path2D()
    path.moveTo(s.pts[i0 * 3], s.pts[i0 * 3 + 1])
    if (stop === i0) {
      path.lineTo(s.pts[i0 * 3] + 0.01, s.pts[i0 * 3 + 1])
      ctx.lineCap = 'round'
    }
    for (let i = i0 + 1; i <= stop; i++) path.lineTo(s.pts[i * 3], s.pts[i * 3 + 1])
    const color = strokeColor(s, i0, dark)
    ctx.strokeStyle = color
    for (const [a, b, c, d] of mats) {
      ctx.setTransform(A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, E, F)
      if (s.glow) {
        ctx.globalAlpha = dark ? 0.18 : 0.12
        ctx.lineWidth = s.size * 3.2
        ctx.stroke(path)
      }
      ctx.globalAlpha = 1
      ctx.lineWidth = s.size
      ctx.stroke(path)
    }
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
