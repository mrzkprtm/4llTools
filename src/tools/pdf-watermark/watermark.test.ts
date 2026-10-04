import { describe, expect, it } from 'vitest'
import { POSITIONS, anchorFor, clampOpacity, diagonalAngle, fileNameFor, hexToRgb, pdfError, rotatedOrigin, tileAnchors, watermarkFontSize } from './watermark'

describe('watermark layout', () => {
  it('clamps opacity into 0…1', () => {
    expect(clampOpacity(0.4)).toBe(0.4)
    expect(clampOpacity(-2)).toBe(0)
    expect(clampOpacity(9)).toBe(1)
    expect(clampOpacity(Number.NaN)).toBe(0)
  })

  it('follows the page diagonal', () => {
    expect(diagonalAngle(100, 100)).toBeCloseTo(45, 6)
    expect(diagonalAngle(200, 100)).toBeCloseTo(26.565, 3)
    expect(diagonalAngle(595.28, 841.89)).toBeCloseTo(54.7, 1)
    expect(diagonalAngle(0, 100)).toBe(0)
    expect(diagonalAngle(Number.NaN, 100)).toBe(0)
  })

  it('scales the font to the page width', () => {
    expect(watermarkFontSize(595.28)).toBe(66)
    expect(watermarkFontSize(100)).toBe(18)
    expect(watermarkFontSize(4000)).toBe(160)
    expect(watermarkFontSize(-10)).toBe(18)
  })

  it('lists the corners and the tiled option', () => {
    expect(POSITIONS.map((p) => p.id)).toEqual(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'tile'])
    expect(POSITIONS.every((p) => p.label.length > 0)).toBe(true)
  })

  it('anchors the text box in the requested corner', () => {
    expect(anchorFor('center', 600, 800, 200, 40)).toEqual({ x: 300, y: 400 })
    expect(anchorFor('top-left', 600, 800, 200, 40)).toEqual({ x: 136, y: 744 })
    expect(anchorFor('top-right', 600, 800, 200, 40)).toEqual({ x: 464, y: 744 })
    expect(anchorFor('bottom-left', 600, 800, 200, 40)).toEqual({ x: 136, y: 56 })
    expect(anchorFor('bottom-right', 600, 800, 200, 40)).toEqual({ x: 464, y: 56 })
    expect(anchorFor('tile', 600, 800, 200, 40)).toEqual({ x: 300, y: 400 })
  })

  it('keeps rotated text centred on its anchor', () => {
    expect(rotatedOrigin(300, 400, 200, 40, 0)).toEqual({ x: 200, y: 380 })
    const turned = rotatedOrigin(300, 400, 200, 40, 90)
    expect(turned.x).toBeCloseTo(320, 6)
    expect(turned.y).toBeCloseTo(300, 6)
    const back = rotatedOrigin(300, 400, 200, 40, 180)
    expect(back.x).toBeCloseTo(400, 6)
    expect(back.y).toBeCloseTo(420, 6)
  })

  it('spreads tiles evenly across the page', () => {
    const t = tileAnchors(100, 200, 50, 50)
    expect(t).toHaveLength(8)
    expect([...new Set(t.map((p) => p.x))]).toEqual([25, 75])
    expect([...new Set(t.map((p) => p.y))]).toEqual([25, 75, 125, 175])
    expect(tileAnchors(100, 100, 0, 0)).toEqual([{ x: 50, y: 50 }])
    expect(tileAnchors(595.28, 841.89, 2, 2).length).toBeLessThanOrEqual(2000)
  })

  it('reads hex colours', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(hexToRgb('000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb('#e11d48')).toEqual({ r: 225 / 255, g: 29 / 255, b: 72 / 255 })
    expect(hexToRgb('red')).toBeNull()
  })

  it('names downloads and explains broken files', () => {
    expect(fileNameFor('Report.PDF')).toBe('Report-watermarked.pdf')
    expect(fileNameFor('')).toBe('document-watermarked.pdf')
    expect(pdfError(new Error('encrypted'), 'a.pdf')).toContain('password-protected')
    expect(pdfError(new Error('No PDF header found'), 'a.pdf')).toContain('not look like a valid PDF')
  })
})
