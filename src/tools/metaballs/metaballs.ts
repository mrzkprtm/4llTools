export interface Ball {
  x: number
  y: number
  r: number
  vx: number
  vy: number
}

/** The metaball field Σ r²/d²: exactly 1 on the rim of a lone ball, higher inside. */
export function field(balls: readonly Ball[], x: number, y: number): number {
  let v = 0
  for (const b of balls) {
    const dx = x - b.x
    const dy = y - b.y
    v += (b.r * b.r) / Math.max(1e-6, dx * dx + dy * dy)
  }
  return v
}

/**
 * Marching-squares case (0–15) of a cell from its corner values: top-left = 8,
 * top-right = 4, bottom-right = 2, bottom-left = 1 for each corner at or above the threshold.
 */
export function caseIndex(tl: number, tr: number, br: number, bl: number, threshold: number): number {
  return (tl >= threshold ? 8 : 0) | (tr >= threshold ? 4 : 0) | (br >= threshold ? 2 : 0) | (bl >= threshold ? 1 : 0)
}

/** Edges crossed by the contour for each case: 0 top, 1 right, 2 bottom, 3 left. Saddles (5, 10) are resolved separately. */
const EDGES: Record<number, [number, number][]> = {
  1: [[3, 2]],
  2: [[2, 1]],
  3: [[3, 1]],
  4: [[0, 1]],
  6: [[0, 2]],
  7: [[3, 0]],
  8: [[3, 0]],
  9: [[0, 2]],
  11: [[0, 1]],
  12: [[3, 1]],
  13: [[2, 1]],
  14: [[3, 2]],
}

/**
 * Contour line segments [x1, y1, x2, y2, …] where a sampled grid crosses the threshold.
 * `grid` holds (cols + 1) × (rows + 1) corner values, row by row, spaced `cell` apart.
 * Crossing points are placed by linear interpolation along each cell edge.
 */
export function marchingSquares(grid: ArrayLike<number>, cols: number, rows: number, cell: number, threshold: number): number[] {
  const out: number[] = []
  const stride = cols + 1
  const lerp = (a: number, b: number) => (Math.abs(b - a) < 1e-12 ? 0.5 : (threshold - a) / (b - a))
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const tl = grid[j * stride + i]
      const tr = grid[j * stride + i + 1]
      const br = grid[(j + 1) * stride + i + 1]
      const bl = grid[(j + 1) * stride + i]
      const c = caseIndex(tl, tr, br, bl, threshold)
      if (c === 0 || c === 15) continue
      const x = i * cell
      const y = j * cell
      const point = (e: number): [number, number] => {
        if (e === 0) return [x + lerp(tl, tr) * cell, y]
        if (e === 1) return [x + cell, y + lerp(tr, br) * cell]
        if (e === 2) return [x + lerp(bl, br) * cell, y + cell]
        return [x, y + lerp(tl, bl) * cell]
      }
      let pairs = EDGES[c]
      if (c === 5 || c === 10) {
        // Saddle: the average of the corners decides whether the two inside corners connect.
        const centreIn = (tl + tr + br + bl) / 4 >= threshold
        pairs = (c === 5) === centreIn ? [[3, 0], [2, 1]] : [[3, 2], [0, 1]]
      }
      for (const [a, b] of pairs) {
        const p = point(a)
        const q = point(b)
        out.push(p[0], p[1], q[0], q[1])
      }
    }
  return out
}

/** Number of separate blobs: 4-connected regions of grid corners at or above the threshold. */
export function countBlobs(grid: ArrayLike<number>, cols: number, rows: number, threshold: number): number {
  const w = cols + 1
  const h = rows + 1
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  let blobs = 0
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || grid[s] < threshold) continue
    blobs++
    seen[s] = 1
    stack.push(s)
    while (stack.length) {
      const k = stack.pop()!
      const x = k % w
      const y = (k - x) / w
      for (const n of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1])
        if (n >= 0 && !seen[n] && grid[n] >= threshold) {
          seen[n] = 1
          stack.push(n)
        }
    }
  }
  return blobs
}
