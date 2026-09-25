/** Gray–Scott reaction–diffusion on a wrapping grid: A + 2B → 3B, fed with A, B removed. */

export interface Preset {
  id: string
  name: string
  F: number
  k: number
}

export const PRESETS: Preset[] = [
  { id: 'mitosis', name: 'Mitosis', F: 0.0367, k: 0.0649 },
  { id: 'coral', name: 'Coral', F: 0.0545, k: 0.062 },
  { id: 'spots', name: 'Spots', F: 0.035, k: 0.065 },
  { id: 'stripes', name: 'Stripes', F: 0.05, k: 0.063 },
  { id: 'worms', name: 'Worms', F: 0.078, k: 0.061 },
  { id: 'maze', name: 'Maze', F: 0.029, k: 0.057 },
  { id: 'solitons', name: 'Solitons', F: 0.03, k: 0.062 },
  { id: 'uskate', name: 'U-skate world', F: 0.062, k: 0.06093 },
]

/** 9-point Laplacian weights: centre −1, edge neighbours 0.2, corners 0.05 (they sum to zero). */
export const EDGE = 0.2
export const CORNER = 0.05

/** Laplacian of field f at (x, y), wrapping at the edges. */
export function laplacian(f: ArrayLike<number>, w: number, h: number, x: number, y: number): number {
  const xl = (x - 1 + w) % w
  const xr = (x + 1) % w
  const yu = ((y - 1 + h) % h) * w
  const yd = ((y + 1) % h) * w
  const yc = y * w
  return (
    -f[yc + x] +
    EDGE * (f[yc + xl] + f[yc + xr] + f[yu + x] + f[yd + x]) +
    CORNER * (f[yu + xl] + f[yu + xr] + f[yd + xl] + f[yd + xr])
  )
}

export interface GSParams {
  Da: number
  Db: number
  F: number
  k: number
  dt: number
}

/**
 * One explicit Euler step from (a, b) into (a2, b2):
 *   a' = a + (Da∇²a − ab² + F(1 − a))·dt
 *   b' = b + (Db∇²b + ab² − (k + F)b)·dt
 * Results are clamped to [0, 1].
 */
export function stepGrayScott(a: Float32Array, b: Float32Array, a2: Float32Array, b2: Float32Array, w: number, h: number, p: GSParams) {
  const { Da, Db, F, k, dt } = p
  const kf = k + F
  for (let y = 0; y < h; y++) {
    const yc = y * w
    const yu = ((y - 1 + h) % h) * w
    const yd = ((y + 1) % h) * w
    for (let x = 0; x < w; x++) {
      const xl = x === 0 ? w - 1 : x - 1
      const xr = x === w - 1 ? 0 : x + 1
      const i = yc + x
      const av = a[i]
      const bv = b[i]
      const la = -av + EDGE * (a[yc + xl] + a[yc + xr] + a[yu + x] + a[yd + x]) + CORNER * (a[yu + xl] + a[yu + xr] + a[yd + xl] + a[yd + xr])
      const lb = -bv + EDGE * (b[yc + xl] + b[yc + xr] + b[yu + x] + b[yd + x]) + CORNER * (b[yu + xl] + b[yu + xr] + b[yd + xl] + b[yd + xr])
      const r = av * bv * bv
      const na = av + (Da * la - r + F * (1 - av)) * dt
      const nb = bv + (Db * lb + r - kf * bv) * dt
      a2[i] = na < 0 ? 0 : na > 1 ? 1 : na
      b2[i] = nb < 0 ? 0 : nb > 1 ? 1 : nb
    }
  }
}

/** Resets to A = 1, B = 0 and drops a few square seeds of B. */
export function seedField(a: Float32Array, b: Float32Array, w: number, h: number, seeds: number, random: () => number = Math.random) {
  a.fill(1)
  b.fill(0)
  const put = (cx: number, cy: number, r: number) => {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        const i = ((y + h) % h) * w + ((x + w) % w)
        b[i] = 1
        a[i] = 0.5
      }
  }
  put(Math.floor(w / 2), Math.floor(h / 2), 6)
  for (let s = 0; s < seeds; s++) put(Math.floor(random() * w), Math.floor(random() * h), 2 + Math.floor(random() * 4))
}
