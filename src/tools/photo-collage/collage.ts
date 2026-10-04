export interface CollageCell {
  x: number
  y: number
  w: number
  h: number
}

export interface CollageGrid {
  cols: number
  rows: number
  width: number
  height: number
  cells: CollageCell[]
}

export const MAX_COLS = 8

/** Column count kept inside 1…MAX_COLS so a grid always has at least one column. */
export function clampCols(cols: number): number {
  const n = Math.round(cols)
  return Number.isFinite(n) ? Math.min(MAX_COLS, Math.max(1, n)) : 1
}

/**
 * Lays photos out in a grid of square cells: `gap` around the outside and
 * between cells, `cellSize` per cell, at most `cols` per row. A short last row
 * stays left aligned.
 */
export function computeGrid(count: number, cols: number, cellSize: number, gap: number): CollageGrid {
  const photos = Math.max(0, Math.floor(count) || 0)
  const c = clampCols(cols)
  const cell = Math.max(1, Math.round(cellSize) || 1)
  const g = Math.max(0, Math.round(gap) || 0)
  const rows = photos === 0 ? 0 : Math.ceil(photos / c)
  const cells: CollageCell[] = []
  for (let i = 0; i < photos; i++) {
    cells.push({
      x: g + (i % c) * (cell + g),
      y: g + Math.floor(i / c) * (cell + g),
      w: cell,
      h: cell,
    })
  }
  return {
    cols: c,
    rows,
    width: c * cell + (c + 1) * g,
    height: rows === 0 ? 0 : rows * cell + (rows + 1) * g,
    cells,
  }
}

/** The largest size that keeps a photo's aspect ratio inside a cell. */
export function fitCell(srcW: number, srcH: number, boxW: number, boxH: number): { w: number; h: number } {
  if (!(srcW > 0) || !(srcH > 0) || !(boxW > 0) || !(boxH > 0)) return { w: 0, h: 0 }
  const scale = Math.min(boxW / srcW, boxH / srcH)
  return { w: Math.min(boxW, Math.round(srcW * scale)), h: Math.min(boxH, Math.round(srcH * scale)) }
}
