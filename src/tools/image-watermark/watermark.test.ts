import { describe, expect, it } from 'vitest'
import { MIN_FONT, POSITIONS, clampFontSize, rotateFor, watermarkAnchor } from './watermark'

describe('POSITIONS', () => {
  it('covers a 3x3 grid with unique names', () => {
    expect(POSITIONS).toHaveLength(9)
    expect(new Set(POSITIONS).size).toBe(9)
    expect(POSITIONS[0]).toBe('top-left')
    expect(POSITIONS[8]).toBe('bottom-right')
    for (const p of POSITIONS) expect(p).toMatch(/^(top|middle|bottom)-(left|center|right)$/)
  })
})

describe('watermarkAnchor', () => {
  it('anchors the three left positions on the pad line', () => {
    expect(watermarkAnchor('top-left', 800, 600, 100, 40, 20)).toEqual({ x: 20, y: 60, textAlign: 'left' })
    expect(watermarkAnchor('middle-left', 800, 600, 100, 40, 20)).toEqual({ x: 20, y: 320, textAlign: 'left' })
    expect(watermarkAnchor('bottom-left', 800, 600, 100, 40, 20)).toEqual({ x: 20, y: 580, textAlign: 'left' })
  })

  it('anchors the three right positions on the far edge', () => {
    expect(watermarkAnchor('top-right', 800, 600, 100, 40, 20)).toEqual({ x: 780, y: 60, textAlign: 'right' })
    expect(watermarkAnchor('middle-right', 800, 600, 100, 40, 20)).toEqual({ x: 780, y: 320, textAlign: 'right' })
    expect(watermarkAnchor('bottom-right', 800, 600, 100, 40, 20)).toEqual({ x: 780, y: 580, textAlign: 'right' })
  })

  it('centers the middle column', () => {
    expect(watermarkAnchor('top-center', 800, 600, 100, 40, 20)).toEqual({ x: 400, y: 60, textAlign: 'center' })
    expect(watermarkAnchor('middle-center', 800, 600, 100, 40, 20)).toEqual({ x: 400, y: 320, textAlign: 'center' })
    expect(watermarkAnchor('bottom-center', 800, 600, 100, 40, 20)).toEqual({ x: 400, y: 580, textAlign: 'center' })
  })

  it('centers text that is wider than the padded image', () => {
    expect(watermarkAnchor('top-left', 200, 100, 260, 30, 10)).toEqual({ x: 100, y: 40, textAlign: 'center' })
    expect(watermarkAnchor('bottom-right', 200, 100, 181, 30, 10).textAlign).toBe('center')
    expect(watermarkAnchor('bottom-right', 200, 100, 180, 30, 10).textAlign).toBe('right')
  })

  it('keeps the anchor inside the image for thick text and bad input', () => {
    const thick = watermarkAnchor('bottom-right', 100, 100, 20, 200, -5)
    expect(thick.y).toBe(100)
    expect(thick.x).toBe(100)
    expect(watermarkAnchor('top-left', Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN)).toEqual({
      x: 0,
      y: 0,
      textAlign: 'left',
    })
  })
})

describe('clampFontSize', () => {
  it('keeps a sensible size untouched', () => {
    expect(clampFontSize(48, 800)).toBe(48)
  })

  it('never grows past a quarter of the image width', () => {
    expect(clampFontSize(400, 800)).toBe(200)
    expect(clampFontSize(60, 100)).toBe(25)
  })

  it('never drops below the minimum and copes with bad input', () => {
    expect(clampFontSize(2, 800)).toBe(MIN_FONT)
    expect(clampFontSize(Number.NaN, 800)).toBe(MIN_FONT)
    expect(clampFontSize(48, 0)).toBe(MIN_FONT)
  })
})

describe('rotateFor', () => {
  it('slants the corners and keeps the sides level', () => {
    expect(rotateFor('top-left')).toBe(-45)
    expect(rotateFor('top-right')).toBe(45)
    expect(rotateFor('bottom-left')).toBe(45)
    expect(rotateFor('bottom-right')).toBe(-45)
  })

  it('returns zero for the middle row and column', () => {
    expect(rotateFor('top-center')).toBe(0)
    expect(rotateFor('bottom-center')).toBe(0)
    expect(rotateFor('middle-left')).toBe(0)
    expect(rotateFor('middle-center')).toBe(0)
    expect(rotateFor('middle-right')).toBe(0)
  })
})
