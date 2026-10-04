import { describe, expect, it } from 'vitest'
import { computeGrid, fitCell } from './collage'

describe('computeGrid', () => {
  it('lays out a 2-column grid with the cell size and gap', () => {
    const grid = computeGrid(4, 2, 100, 10)
    expect(grid.cols).toBe(2)
    expect(grid.rows).toBe(2)
    expect(grid.width).toBe(2 * 100 + 3 * 10)
    expect(grid.height).toBe(2 * 100 + 3 * 10)
    expect(grid.cells).toEqual([
      { x: 10, y: 10, w: 100, h: 100 },
      { x: 120, y: 10, w: 100, h: 100 },
      { x: 10, y: 120, w: 100, h: 100 },
      { x: 120, y: 120, w: 100, h: 100 },
    ])
  })

  it('leaves a short last row left aligned', () => {
    const grid = computeGrid(5, 3, 50, 0)
    expect(grid.rows).toBe(2)
    expect(grid.cells).toHaveLength(5)
    expect(grid.cells[4]).toEqual({ x: 50, y: 50, w: 50, h: 50 })
    expect(grid.width).toBe(150)
    expect(grid.height).toBe(100)
  })

  it('returns an empty grid when there are no photos', () => {
    const grid = computeGrid(0, 3, 200, 8)
    expect(grid.cells).toEqual([])
    expect(grid.rows).toBe(0)
    expect(grid.height).toBe(0)
  })

  it('clamps the column count between 1 and 8', () => {
    expect(computeGrid(1, 0, 100, 0).cols).toBe(1)
    expect(computeGrid(1, -4, 100, 0).cols).toBe(1)
    expect(computeGrid(1, 99, 100, 0).cols).toBe(8)
    expect(computeGrid(3, 2.6, 100, 0).cells[2]).toEqual({ x: 200, y: 0, w: 100, h: 100 })
  })

  it('survives nonsense numbers and never returns a cell smaller than 1px', () => {
    expect(computeGrid(Number.NaN, Number.NaN, Number.NaN, Number.NaN)).toEqual({ cols: 1, rows: 0, width: 1, height: 0, cells: [] })
    expect(computeGrid(-3, 2, 0, -10).cells).toEqual([])
    expect(computeGrid(1, 2, 0, -10).cells[0]).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
})

describe('fitCell', () => {
  it('fits a landscape photo inside a square cell', () => {
    expect(fitCell(400, 200, 100, 100)).toEqual({ w: 100, h: 50 })
  })

  it('fits a portrait photo inside a wide box', () => {
    expect(fitCell(200, 800, 400, 200)).toEqual({ w: 50, h: 200 })
  })

  it('scales a small photo up to fill the cell', () => {
    expect(fitCell(10, 5, 200, 200)).toEqual({ w: 200, h: 100 })
  })

  it('never grows past the box', () => {
    const fit = fitCell(333, 777, 101, 103)
    expect(fit.w).toBeLessThanOrEqual(101)
    expect(fit.h).toBeLessThanOrEqual(103)
    expect(fit.w / fit.h).toBeCloseTo(333 / 777, 1)
  })

  it('returns an empty size for zero or missing dimensions', () => {
    expect(fitCell(0, 100, 50, 50)).toEqual({ w: 0, h: 0 })
    expect(fitCell(100, 0, 50, 50)).toEqual({ w: 0, h: 0 })
    expect(fitCell(100, 100, 0, 50)).toEqual({ w: 0, h: 0 })
    expect(fitCell(100, 100, 50, Number.NaN)).toEqual({ w: 0, h: 0 })
  })
})
