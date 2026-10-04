import { describe, expect, it } from 'vitest'
import { describe as label, flipScale, normalizeTurns, rotatedSize } from './transform'

describe('normalizeTurns', () => {
  it('keeps quarter turns as they are', () => {
    expect(normalizeTurns(0)).toBe(0)
    expect(normalizeTurns(1)).toBe(1)
    expect(normalizeTurns(2)).toBe(2)
    expect(normalizeTurns(3)).toBe(3)
  })

  it('wraps past a full turn', () => {
    expect(normalizeTurns(4)).toBe(0)
    expect(normalizeTurns(5)).toBe(1)
    expect(normalizeTurns(9)).toBe(1)
  })

  it('wraps negative turns', () => {
    expect(normalizeTurns(-1)).toBe(3)
    expect(normalizeTurns(-4)).toBe(0)
    expect(normalizeTurns(-7)).toBe(1)
  })

  it('falls back to zero for nonsense', () => {
    expect(normalizeTurns(Number.NaN)).toBe(0)
    expect(normalizeTurns(Number.POSITIVE_INFINITY)).toBe(0)
    expect(normalizeTurns(1.4)).toBe(1)
  })
})

describe('rotatedSize', () => {
  it('swaps the sides on odd quarter turns', () => {
    expect(rotatedSize(300, 200, 1)).toEqual({ w: 200, h: 300 })
    expect(rotatedSize(300, 200, 3)).toEqual({ w: 200, h: 300 })
  })

  it('keeps the sides on even quarter turns', () => {
    expect(rotatedSize(300, 200, 0)).toEqual({ w: 300, h: 200 })
    expect(rotatedSize(300, 200, 2)).toEqual({ w: 300, h: 200 })
    expect(rotatedSize(300, 200, 4)).toEqual({ w: 300, h: 200 })
  })

  it('treats missing or negative sizes as zero', () => {
    expect(rotatedSize(0, 0, 1)).toEqual({ w: 0, h: 0 })
    expect(rotatedSize(-10, 40, 1)).toEqual({ w: 40, h: 0 })
    expect(rotatedSize(Number.NaN, Number.NaN, 1)).toEqual({ w: 0, h: 0 })
  })
})

describe('flipScale', () => {
  it('mirrors on the requested axes only', () => {
    expect(flipScale(false, false)).toEqual({ sx: 1, sy: 1 })
    expect(flipScale(true, false)).toEqual({ sx: -1, sy: 1 })
    expect(flipScale(false, true)).toEqual({ sx: 1, sy: -1 })
    expect(flipScale(true, true)).toEqual({ sx: -1, sy: -1 })
  })
})

describe('describe', () => {
  it('names each rotation', () => {
    expect(label(1, false, false)).toBe('Rotated 90° clockwise')
    expect(label(2, false, false)).toBe('Rotated 180°')
    expect(label(3, false, false)).toBe('Rotated 90° counter-clockwise')
  })

  it('names the flips on their own', () => {
    expect(label(0, false, false)).toBe('Original orientation')
    expect(label(0, true, false)).toBe('Flipped horizontally')
    expect(label(0, false, true)).toBe('Flipped vertically')
    expect(label(0, true, true)).toBe('Flipped horizontally and vertically')
  })

  it('combines rotation and flips', () => {
    expect(label(1, true, false)).toBe('Rotated 90° clockwise, flipped horizontally')
    expect(label(-1, false, true)).toBe('Rotated 90° counter-clockwise, flipped vertically')
  })
})
