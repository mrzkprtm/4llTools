/** Escape-time fractals with smooth (continuous) iteration counts, plus colour palettes. */

const BAIL = 256 * 256
const LN2 = Math.log(2)

/** True inside the main cardioid or the period-2 bulb, where every point is known to be in the set. */
export function inMainBulbs(cr: number, ci: number): boolean {
  const x = cr - 0.25
  const q = x * x + ci * ci
  if (q * (q + x) <= 0.25 * ci * ci) return true
  return (cr + 1) * (cr + 1) + ci * ci <= 0.0625
}

/** Smooth escape count of z → z² + c from z = (zr, zi), or −1 if it has not escaped after maxIter steps. */
export function julia(zr: number, zi: number, cr: number, ci: number, maxIter: number): number {
  let x = zr
  let y = zi
  let x2 = x * x
  let y2 = y * y
  let n = 0
  while (x2 + y2 <= BAIL && n < maxIter) {
    y = 2 * x * y + ci
    x = x2 - y2 + cr
    x2 = x * x
    y2 = y * y
    n++
  }
  if (n >= maxIter) return -1
  // n + 1 − log₂(log|z|) makes the count continuous across bands.
  return Math.max(0, n + 1 - Math.log(Math.log(x2 + y2) / 2) / LN2)
}

/** Smooth escape count for the Mandelbrot set at c, or −1 when c is (as far as we can tell) inside. */
export function escapeTime(cr: number, ci: number, maxIter: number): number {
  if (inMainBulbs(cr, ci)) return -1
  return julia(0, 0, cr, ci, maxIter)
}

export const PALETTES = {
  ember: ['#000764', '#206bcb', '#edffff', '#ffaa00', '#000200'],
  ocean: ['#03045e', '#0077b6', '#48cae4', '#caf0f8', '#0077b6'],
  rainbow: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'],
  mono: ['#111111', '#f5f5f5', '#444444', '#dddddd', '#222222'],
} as const
export type Palette = keyof typeof PALETTES

/** A cyclic colour lookup table (RGB triples) blending the palette's stops. */
export function buildLut(stops: readonly string[], size = 512): Uint8Array {
  const rgb = stops.map((s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)))
  const out = new Uint8Array(size * 3)
  for (let i = 0; i < size; i++) {
    const t = (i / size) * rgb.length
    const a = rgb[Math.floor(t) % rgb.length]
    const b = rgb[(Math.floor(t) + 1) % rgb.length]
    const u = t - Math.floor(t)
    const s = u * u * (3 - 2 * u)
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(a[c] + (b[c] - a[c]) * s)
  }
  return out
}

/** Maps a smooth escape count to a LUT slot; square-rooting keeps bands readable at any zoom. */
export function lutIndex(v: number, size = 512): number {
  return Math.floor(Math.sqrt(v) * 38) % size
}
