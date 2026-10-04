import { describe, expect, it } from 'vitest'
import { REDACT_MODES, clampRect, normalizeRect, pixelate, redactLabel } from './redact'

/** A 4x4 image whose red channel is x * 10 + y, so every pixel has a known value. */
function sample(): Uint8ClampedArray {
  const data = new Uint8ClampedArray(4 * 4 * 4)
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const i = (y * 4 + x) * 4
      data[i] = x * 10 + y
      data[i + 1] = 100
      data[i + 2] = 200
      data[i + 3] = 255
    }
  }
  return data
}

const red = (data: Uint8ClampedArray, x: number, y: number) => data[(y * 4 + x) * 4]

describe('normalizeRect', () => {
  it('builds the same rectangle whichever way the drag goes', () => {
    expect(normalizeRect({ x: 10, y: 20 }, { x: 40, y: 60 })).toEqual({ x: 10, y: 20, w: 30, h: 40 })
    expect(normalizeRect({ x: 40, y: 60 }, { x: 10, y: 20 })).toEqual({ x: 10, y: 20, w: 30, h: 40 })
    expect(normalizeRect({ x: 40, y: 20 }, { x: 10, y: 60 })).toEqual({ x: 10, y: 20, w: 30, h: 40 })
  })

  it('rounds fractional pointer positions and allows a zero-size drag', () => {
    expect(normalizeRect({ x: 10.4, y: 20.6 }, { x: 10.4, y: 20.6 })).toEqual({ x: 10, y: 21, w: 0, h: 0 })
  })
})

describe('clampRect', () => {
  it('trims a rectangle that starts outside the image', () => {
    expect(clampRect({ x: -10, y: -5, w: 50, h: 50 }, 100, 100)).toEqual({ x: 0, y: 0, w: 40, h: 45 })
  })

  it('trims a rectangle that runs past the far edge', () => {
    expect(clampRect({ x: 90, y: 90, w: 50, h: 50 }, 100, 100)).toEqual({ x: 90, y: 90, w: 10, h: 10 })
  })

  it('collapses a fully outside rectangle and copes with zero-sized images', () => {
    expect(clampRect({ x: 200, y: 200, w: 10, h: 10 }, 100, 100)).toEqual({ x: 100, y: 100, w: 0, h: 0 })
    expect(clampRect({ x: 5, y: 5, w: 10, h: 10 }, 0, 0)).toEqual({ x: 0, y: 0, w: 0, h: 0 })
  })
})

describe('pixelate', () => {
  it('averages the block and fills it back', () => {
    const data = sample()
    pixelate(data, 4, 4, { x: 0, y: 0, w: 2, h: 2 }, 2)
    // (0,0), (1,0), (0,1), (1,1) held 0, 10, 1, 11 — the block average is 6 (5.5 rounds up).
    expect(red(data, 0, 0)).toBe(6)
    expect(red(data, 1, 0)).toBe(6)
    expect(red(data, 0, 1)).toBe(6)
    expect(red(data, 1, 1)).toBe(6)
  })

  it('leaves everything outside the rectangle alone', () => {
    const data = sample()
    pixelate(data, 4, 4, { x: 0, y: 0, w: 2, h: 2 }, 2)
    expect(red(data, 2, 0)).toBe(20)
    expect(red(data, 3, 3)).toBe(33)
    expect(data[3]).toBe(255)
  })

  it('clamps the rectangle to the image before working', () => {
    const data = sample()
    pixelate(data, 4, 4, { x: -50, y: -50, w: 60, h: 60 }, 4)
    // The whole 4x4 image averages to 16.5, which rounds up.
    expect(red(data, 0, 0)).toBe(17)
    expect(red(data, 3, 3)).toBe(17)
  })

  it('handles a block bigger than the rectangle and a one-pixel rectangle', () => {
    const data = sample()
    pixelate(data, 4, 4, { x: 1, y: 1, w: 2, h: 2 }, 99)
    expect(red(data, 1, 1)).toBe(17)
    expect(red(data, 2, 2)).toBe(17)

    const single = sample()
    pixelate(single, 4, 4, { x: 3, y: 0, w: 1, h: 1 }, 3)
    expect(red(single, 3, 0)).toBe(30)
  })

  it('does nothing for an empty rectangle and falls back to a 2px block', () => {
    const data = sample()
    const before = [...data]
    pixelate(data, 4, 4, { x: 1, y: 1, w: 0, h: 2 }, 4)
    expect([...data]).toEqual(before)
    pixelate(data, 4, 4, { x: 1, y: 1, w: 2, h: 2 }, Number.NaN)
    expect(red(data, 1, 1)).toBe(17)
  })
})

describe('redactLabel', () => {
  it('names every mode', () => {
    expect(REDACT_MODES).toEqual(['blur', 'pixelate', 'blackout'])
    expect(REDACT_MODES.map(redactLabel)).toEqual(['Blur', 'Pixelate', 'Blackout'])
  })
})
