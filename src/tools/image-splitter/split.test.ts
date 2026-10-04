import { describe, expect, it } from 'vitest'
import { MAX_GRID, clampGrid, parseGrid, splitRects, tileName } from './split'

describe('splitRects', () => {
  it('splits a 100x60 image into six equal tiles', () => {
    const tiles = splitRects(100, 60, 3, 2)
    expect(tiles).toHaveLength(6)
    expect(tiles[0]).toEqual({ x: 0, y: 0, w: 33, h: 30 })
    expect(tiles[2]).toEqual({ x: 67, y: 0, w: 33, h: 30 })
    expect(tiles[5]).toEqual({ x: 67, y: 30, w: 33, h: 30 })
  })

  it('covers the whole image with no gaps or overlaps', () => {
    const tiles = splitRects(101, 77, 4, 3)
    const area = tiles.reduce((n, t) => n + t.w * t.h, 0)
    expect(area).toBe(101 * 77)
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0)
      expect(t.y).toBeGreaterThanOrEqual(0)
      expect(t.x + t.w).toBeLessThanOrEqual(101)
      expect(t.y + t.h).toBeLessThanOrEqual(77)
    }
  })

  it('rounds uneven sizes into full-width tiles', () => {
    const tiles = splitRects(10, 10, 3, 1)
    expect(tiles.map((t) => t.w)).toEqual([3, 4, 3])
    expect(tiles.map((t) => t.x)).toEqual([0, 3, 7])
  })

  it('returns a single tile for a 1x1 grid', () => {
    expect(splitRects(320, 200, 1, 1)).toEqual([{ x: 0, y: 0, w: 320, h: 200 }])
    expect(splitRects(320, 200, 0, -4)).toHaveLength(1)
  })

  it('clamps the grid to 12 and copes with empty images', () => {
    expect(splitRects(100, 100, 40, 40)).toHaveLength(MAX_GRID * MAX_GRID)
    expect(splitRects(0, 0, 2, 2)).toEqual([
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 },
    ])
    expect(splitRects(Number.NaN, Number.NaN, 2, 2)).toHaveLength(4)
  })
})

describe('clampGrid', () => {
  it('keeps counts between 1 and 12', () => {
    expect(clampGrid(0)).toBe(1)
    expect(clampGrid(1)).toBe(1)
    expect(clampGrid(12)).toBe(12)
    expect(clampGrid(99)).toBe(12)
    expect(clampGrid(3.4)).toBe(3)
    expect(clampGrid(Number.NaN)).toBe(1)
  })
})

describe('parseGrid', () => {
  it('reads a rows-by-columns string', () => {
    expect(parseGrid('3x4')).toEqual({ cols: 3, rows: 4 })
    expect(parseGrid('2×2')).toEqual({ cols: 2, rows: 2 })
    expect(parseGrid('3,1')).toEqual({ cols: 3, rows: 1 })
  })

  it('uses one number for both sides', () => {
    expect(parseGrid('5')).toEqual({ cols: 5, rows: 5 })
    expect(parseGrid(3)).toEqual({ cols: 3, rows: 3 })
  })

  it('clamps out-of-range and unreadable values', () => {
    expect(parseGrid('99x2')).toEqual({ cols: 12, rows: 2 })
    expect(parseGrid('abc')).toEqual({ cols: 1, rows: 1 })
    expect(parseGrid('')).toEqual({ cols: 1, rows: 1 })
  })
})

describe('tileName', () => {
  it('reads in row-major order', () => {
    expect(tileName('photo', 0, 3, 2)).toBe('photo-r1c1.png')
    expect(tileName('photo', 2, 3, 2)).toBe('photo-r1c3.png')
    expect(tileName('photo', 4, 3, 2)).toBe('photo-r2c2.png')
  })

  it('zero pads a wide grid so the files sort correctly', () => {
    expect(tileName('photo', 8, 12, 2)).toBe('photo-r01c09.png')
    expect(tileName('photo', 23, 12, 2)).toBe('photo-r02c12.png')
  })

  it('falls back to a safe base name and clamps a bad grid', () => {
    expect(tileName('   ', 0, 2, 2)).toBe('image-r1c1.png')
    expect(tileName('photo', 1, 0, 0)).toBe('photo-r2c1.png')
  })
})
