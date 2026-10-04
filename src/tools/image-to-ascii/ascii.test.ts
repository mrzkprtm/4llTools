import { describe, expect, it } from 'vitest'
import { CHAR_SETS, charRows, luminance, toAscii, toAsciiHtml } from './ascii'

/** Two pixels side by side: black then white, as RGBA. */
const blackWhite = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])

describe('CHAR_SETS', () => {
  it('offers several ramps of at least two glyphs', () => {
    const names = Object.keys(CHAR_SETS)
    expect(names.length).toBeGreaterThanOrEqual(3)
    for (const name of names) {
      const ramp = CHAR_SETS[name]
      expect(ramp.length).toBeGreaterThanOrEqual(2)
      expect(new Set(ramp).size).toBe(ramp.length)
    }
  })

  it('starts light and ends dense', () => {
    expect(CHAR_SETS.classic.startsWith(' ')).toBe(true)
    expect(CHAR_SETS.classic.endsWith('@')).toBe(true)
    expect(CHAR_SETS.blocks.endsWith('█')).toBe(true)
  })
})

describe('luminance', () => {
  it('maps black to 0 and white to 255', () => {
    expect(luminance(0, 0, 0)).toBe(0)
    expect(luminance(255, 255, 255)).toBe(255)
  })

  it('weighs green heaviest', () => {
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0))
    expect(luminance(255, 0, 0)).toBeGreaterThan(luminance(0, 0, 255))
  })
})

describe('charRows', () => {
  it('halves the row count so a wide photo stays proportional', () => {
    expect(charRows(1000, 500, 100)).toBe(25)
    expect(charRows(1000, 1000, 100)).toBe(50)
  })

  it('never returns fewer than one row', () => {
    expect(charRows(4000, 10, 20)).toBe(1)
    expect(charRows(0, 0, 0)).toBe(1)
  })
})

describe('toAscii', () => {
  it('gives a dense glyph to dark pixels and a space to white ones', () => {
    const rows = toAscii(blackWhite, 2, 1, CHAR_SETS.classic)
    expect(rows).toEqual(['@ '])
  })

  it('emits one row per pixel row, each as wide as the image', () => {
    const pixels = new Uint8ClampedArray(3 * 2 * 4).fill(128)
    const rows = toAscii(pixels, 3, 2, CHAR_SETS.blocks)
    expect(rows).toHaveLength(2)
    for (const row of rows) expect([...row]).toHaveLength(3)
  })

  it('handles a single-glyph ramp and an empty ramp', () => {
    expect(toAscii(blackWhite, 2, 1, '#')).toEqual(['##'])
    expect(toAscii(blackWhite, 2, 1, '')).toEqual(['  '])
  })

  it('treats missing pixel data as black and clamps out-of-range values', () => {
    expect(toAscii([], 1, 1, CHAR_SETS.simple)).toEqual(['#'])
    expect(toAscii([0, 0, 0, 0, 255, 255, 255, 0], 2, 1, CHAR_SETS.classic)).toEqual(['@ '])
    expect(toAscii([9999, 0, 0, 255], 1, 1, CHAR_SETS.simple)).toEqual([' '])
  })
})

describe('toAsciiHtml', () => {
  it('wraps every glyph in a colored span', () => {
    const html = toAsciiHtml(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1, CHAR_SETS.simple)
    expect(html).toBe('<span style="color:rgb(10 20 30)">#</span>')
  })

  it('joins rows with newlines and escapes glyphs', () => {
    const html = toAsciiHtml(blackWhite, 2, 1, CHAR_SETS.classic)
    expect(html).toBe('<span style="color:rgb(0 0 0)">@</span><span style="color:rgb(255 255 255)"> </span>')
    expect(toAsciiHtml(blackWhite, 2, 1, '<>')).not.toContain('<span style="color:rgb(0 0 0)"><')
  })
})
