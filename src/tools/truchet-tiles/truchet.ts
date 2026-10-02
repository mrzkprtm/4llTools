import { rng } from '../../sim/math'

export type Style = 'arcs' | 'lines' | 'triangles' | 'print'

/** Distinct orientations of each tile style under quarter turns. */
export const STATES: Record<Style, number> = { arcs: 2, lines: 2, triangles: 4, print: 2 }

/** Random starting quarter-turns for a cols × rows grid; the same seed always gives the same pattern. */
export function orientations(cols: number, rows: number, seed: number, states = 2): Uint8Array {
  const random = rng(seed)
  const out = new Uint8Array(cols * rows)
  for (let i = 0; i < out.length; i++) out[i] = Math.floor(random() * states)
  return out
}

export interface Arc {
  cx: number
  cy: number
  r: number
  a0: number
  a1: number
}

/**
 * The two quarter-circle arcs of a Smith tile of size s with its top-left corner at the origin.
 * Orientation 0 curls around the top-left and bottom-right corners, orientation 1 around the other two.
 */
export function tileArcs(o: number, s: number): Arc[] {
  const h = s / 2
  const q = Math.PI / 2
  return o % 2 === 0
    ? [
        { cx: 0, cy: 0, r: h, a0: 0, a1: q },
        { cx: s, cy: s, r: h, a0: 2 * q, a1: 3 * q },
      ]
    : [
        { cx: s, cy: 0, r: h, a0: q, a1: 2 * q },
        { cx: 0, cy: s, r: h, a0: 3 * q, a1: 4 * q },
      ]
}

export const arcPoint = (a: Arc, t: number): [number, number] => [a.cx + a.r * Math.cos(t), a.cy + a.r * Math.sin(t)]

/**
 * Two-colouring of arc and line tiles. Every region touches grid corners of one checkerboard parity,
 * so colour the band by that parity and the corner pieces by the other.
 */
export function bandColor(i: number, j: number, o: number): number {
  return (i + j + 1 + (o % 2)) % 2
}

/** Which colour (0 or 1) covers the half of an edge that touches grid corner (cx, cy). */
export function cornerColor(i: number, j: number, o: number, cx: number, cy: number): number {
  const band = bandColor(i, j, o)
  // Orientation 0 has corner pieces at the top-left and bottom-right corners.
  const tlbr = (cx - i) === (cy - j)
  const isCorner = o % 2 === 0 ? tlbr : !tlbr
  return isCorner ? 1 - band : band
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Mixes two #rrggbb colours. */
export function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a
  if (t >= 1) return b
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (s: number) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

/** Colour at position u ∈ [0, 1] along a list of #rrggbb stops. */
export function gradient(stops: string[], u: number): string {
  if (stops.length === 1) return stops[0]
  const x = Math.min(0.9999, Math.max(0, u)) * (stops.length - 1)
  const k = Math.floor(x)
  return mix(stops[k], stops[k + 1], x - k)
}
