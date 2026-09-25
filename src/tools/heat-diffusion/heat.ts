export type Boundary = 'insulated' | 'cold'

/** Temperature held at a "cold" edge. */
export const COLD = 0
/** Largest stable k = α·dt/dx² for the explicit scheme (0.25 in theory; kept a little below). */
export const K_MAX = 0.24

/**
 * One explicit FTCS step of the heat equation on a w × h grid:
 * T' = T + k·(T_left + T_right + T_up + T_down − 4T) with k = α·dt/dx².
 * An insulated edge mirrors the edge cell (no heat crosses it); a cold edge is held at COLD.
 * Writes into `out` (allocated if missing) and returns it.
 */
export function diffuseStep(grid: Float64Array, w: number, h: number, k: number, boundary: Boundary, out: Float64Array = new Float64Array(grid.length)): Float64Array {
  const kk = Math.min(k, K_MAX)
  const ins = boundary === 'insulated'
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = j * w + i
      const t = grid[c]
      const l = i > 0 ? grid[c - 1] : ins ? t : COLD
      const r = i < w - 1 ? grid[c + 1] : ins ? t : COLD
      const u = j > 0 ? grid[c - w] : ins ? t : COLD
      const d = j < h - 1 ? grid[c + w] : ins ? t : COLD
      out[c] = t + kk * (l + r + u + d - 4 * t)
    }
  return out
}

/** How to split a frame into stable sub-steps: returns the count and the k to use for each. */
export function subSteps(alpha: number, dt: number): { n: number; k: number } {
  const total = alpha * dt
  const n = Math.max(1, Math.ceil(total / K_MAX))
  return { n, k: total / n }
}

export function stats(grid: ArrayLike<number>) {
  let min = Infinity
  let max = -Infinity
  let sum = 0
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i]
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  return { min, max, mean: sum / grid.length, sum }
}
