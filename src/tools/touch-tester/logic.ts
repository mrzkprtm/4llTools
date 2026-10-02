/** Coverage grid for finding touchscreen dead zones. */

export interface Grid {
  cols: number
  rows: number
  cell: number
  cells: Uint8Array
  painted: number
}

/** A grid of roughly `cell`-pixel squares covering a w × h area. */
export function makeGrid(w: number, h: number, cell: number): Grid {
  const cols = Math.max(1, Math.ceil(w / cell))
  const rows = Math.max(1, Math.ceil(h / cell))
  return { cols, rows, cell, cells: new Uint8Array(cols * rows), painted: 0 }
}

/** Marks every cell whose area a circle of radius r at (x, y) touches. Returns cells newly painted. */
export function paintDot(g: Grid, x: number, y: number, r: number): number {
  let added = 0
  const c0 = Math.max(0, Math.floor((x - r) / g.cell))
  const c1 = Math.min(g.cols - 1, Math.floor((x + r) / g.cell))
  const r0 = Math.max(0, Math.floor((y - r) / g.cell))
  const r1 = Math.min(g.rows - 1, Math.floor((y + r) / g.cell))
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      // Closest point of the cell to the circle center.
      const nx = Math.max(col * g.cell, Math.min(x, (col + 1) * g.cell))
      const ny = Math.max(row * g.cell, Math.min(y, (row + 1) * g.cell))
      if ((nx - x) ** 2 + (ny - y) ** 2 > r * r) continue
      const i = row * g.cols + col
      if (!g.cells[i]) {
        g.cells[i] = 1
        added++
      }
    }
  }
  g.painted += added
  return added
}

/** Paints along a stroke so fast swipes leave no gaps. */
export function paintLine(g: Grid, x0: number, y0: number, x1: number, y1: number, r: number): number {
  const d = Math.hypot(x1 - x0, y1 - y0)
  const steps = Math.max(1, Math.ceil(d / Math.max(1, r * 0.5)))
  let added = 0
  for (let i = 0; i <= steps; i++) added += paintDot(g, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, r)
  return added
}

export function coverage(g: Grid): number {
  return g.painted / g.cells.length
}
