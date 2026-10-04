import { describe, expect, it } from 'vitest'
import { DEFAULT_PALETTES, nearestColor, quantize, targetSize, type RGB } from './pixelate'

describe('targetSize', () => {
  it('divides the photo into blocks', () => {
    expect(targetSize(1000, 500, 10)).toEqual({ w: 100, h: 50 })
    expect(targetSize(1920, 1080, 16)).toEqual({ w: 120, h: 68 })
  })

  it('never returns a zero-sized grid', () => {
    expect(targetSize(30, 30, 4000)).toEqual({ w: 1, h: 1 })
    expect(targetSize(0, 0, 8)).toEqual({ w: 1, h: 1 })
    expect(targetSize(Number.NaN, Number.NaN, Number.NaN)).toEqual({ w: 1, h: 1 })
  })

  it('treats a missing or tiny pixel size as one', () => {
    expect(targetSize(100, 100, 0)).toEqual({ w: 100, h: 100 })
    expect(targetSize(100, 100, -5)).toEqual({ w: 100, h: 100 })
  })
})

describe('DEFAULT_PALETTES', () => {
  it('offers a few small ramps', () => {
    const names = Object.keys(DEFAULT_PALETTES)
    expect(names.length).toBeGreaterThanOrEqual(4)
    for (const name of names) {
      const colors = DEFAULT_PALETTES[name]
      expect(colors.length).toBeGreaterThanOrEqual(2)
      expect(colors.length).toBeLessThanOrEqual(8)
    }
  })

  it('holds valid RGB triples', () => {
    for (const colors of Object.values(DEFAULT_PALETTES))
      for (const [r, g, b] of colors)
        for (const channel of [r, g, b]) {
          expect(Number.isInteger(channel)).toBe(true)
          expect(channel).toBeGreaterThanOrEqual(0)
          expect(channel).toBeLessThanOrEqual(255)
        }
  })
})

describe('nearestColor', () => {
  const palette: RGB[] = [
    [0, 0, 0],
    [255, 255, 255],
    [255, 0, 0],
  ]

  it('picks an exact match', () => {
    expect(nearestColor(palette, 255, 0, 0)).toEqual([255, 0, 0])
    expect(nearestColor(palette, 0, 0, 0)).toEqual([0, 0, 0])
  })

  it('picks the closest colour for a near miss', () => {
    expect(nearestColor(palette, 250, 10, 10)).toEqual([255, 0, 0])
    expect(nearestColor(palette, 200, 200, 210)).toEqual([255, 255, 255])
    expect(nearestColor(palette, 40, 40, 40)).toEqual([0, 0, 0])
  })

  it('falls back to black for an empty palette', () => {
    expect(nearestColor([], 12, 34, 56)).toEqual([0, 0, 0])
  })
})

describe('quantize', () => {
  const palette = DEFAULT_PALETTES.grayscale

  it('snaps every pixel and keeps alpha', () => {
    // Two pixels: near-black and near-white, both half transparent.
    const data = new Uint8ClampedArray([20, 20, 20, 128, 240, 240, 240, 64])
    quantize(data, palette)
    expect([...data]).toEqual([0, 0, 0, 128, 255, 255, 255, 64])
  })

  it('leaves the data untouched for an empty palette', () => {
    const data = new Uint8ClampedArray([1, 2, 3, 255])
    expect([...quantize(data, [])]).toEqual([1, 2, 3, 255])
  })

  it('handles a single-colour palette', () => {
    const data = new Uint8ClampedArray([200, 10, 10, 255, 0, 0, 0, 255])
    expect([...quantize(data, [[7, 7, 7]])]).toEqual([7, 7, 7, 255, 7, 7, 7, 255])
  })
})
