export interface SplitRect {
  x: number
  y: number
  w: number
  h: number
}

export const MAX_GRID = 12

/** Rows and columns kept inside 1…12 so a split always produces real tiles. */
export function clampGrid(n: number): number {
  const v = Math.round(n)
  return Number.isFinite(v) ? Math.min(MAX_GRID, Math.max(1, v)) : 1
}

/**
 * Tiles that cover the whole image exactly: the cut lines are rounded so the
 * tiles share the edges and no pixel is lost when the size does not divide.
 */
export function splitRects(w: number, h: number, cols: number, rows: number): SplitRect[] {
  const c = clampGrid(cols)
  const r = clampGrid(rows)
  const width = Math.max(0, Math.round(w) || 0)
  const height = Math.max(0, Math.round(h) || 0)
  const xs = Array.from({ length: c + 1 }, (_, i) => Math.round((i * width) / c))
  const ys = Array.from({ length: r + 1 }, (_, i) => Math.round((i * height) / r))
  const tiles: SplitRect[] = []
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      tiles.push({
        x: xs[col],
        y: ys[row],
        w: xs[col + 1] - xs[col],
        h: ys[row + 1] - ys[row],
      })
    }
  }
  return tiles
}

/** Reads "3x4", "3" or 3 into a clamped grid, falling back to 1x1. */
export function parseGrid(value: string | number): { cols: number; rows: number } {
  if (typeof value === 'number') {
    const n = clampGrid(value)
    return { cols: n, rows: n }
  }
  const parts = String(value).toLowerCase().split(/[x×,]/)
  return {
    cols: clampGrid(Number(parts[0])),
    rows: clampGrid(Number(parts[1] ?? parts[0])),
  }
}

/** A row/column file name, zero padded so the tiles sort in reading order. */
export function tileName(base: string, index: number, cols: number, rows: number): string {
  const c = clampGrid(cols)
  const r = clampGrid(rows)
  const i = Math.max(0, Math.floor(index) || 0)
  const digits = String(Math.max(c, r)).length
  const pad = (n: number) => String(n).padStart(digits, '0')
  return `${base.trim() || 'image'}-r${pad(Math.floor(i / c) + 1)}c${pad((i % c) + 1)}.png`
}
