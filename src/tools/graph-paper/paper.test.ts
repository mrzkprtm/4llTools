import { describe, expect, it } from 'vitest'
import { HEAVY_EVERY, MAX_ELEMENTS, MODES, MM_TO_PT, PAGE_KEYS, PAGE_SIZES, clipSegment, dotPoints, fileNameFor, gridSpec, hexToRgb, isHeavy, isoLines, mmToPt, normalizeHex, opsFor } from './paper'

describe('printable graph paper', () => {
  it('offers A4, Letter and Legal in points', () => {
    expect(PAGE_KEYS).toEqual(['a4', 'letter', 'legal'])
    expect(PAGE_SIZES.a4.w).toBeCloseTo(595.28, 2)
    expect(PAGE_SIZES.letter.h).toBe(792)
    expect(PAGE_SIZES.legal.h).toBe(1008)
    expect(mmToPt(25.4)).toBeCloseTo(72, 6)
    expect(MM_TO_PT).toBeCloseTo(2.8346, 4)
    expect(mmToPt(Number.NaN)).toBe(0)
  })

  it('counts the squares that fit between the margins', () => {
    const spec = gridSpec(600, 800, 20, 50)
    expect(spec.x0).toBe(50)
    expect(spec.y0).toBe(50)
    expect(spec.x1).toBe(550)
    expect(spec.y1).toBe(750)
    expect(spec.cols).toBe(25)
    expect(spec.rows).toBe(35)
    expect(spec.xs).toHaveLength(26)
    expect(spec.ys).toHaveLength(36)
    expect(spec.xs.at(-1)).toBeCloseTo(550, 6)
    expect(spec.ys.at(-1)).toBeCloseTo(750, 6)
  })

  it('keeps the grid inside the page for odd input', () => {
    const tiny = gridSpec(100, 100, 0, -5)
    expect(tiny.spacing).toBe(1)
    expect(tiny.x0).toBe(0)
    expect(tiny.cols).toBe(100)
    const clamped = gridSpec(600, 800, 20, 900)
    expect(clamped.x0).toBe(300)
    expect(clamped.cols).toBe(0)
    expect(gridSpec(600, 800, 1000, 0).cols).toBe(0)
    expect(gridSpec(Number.NaN, Number.NaN, 10, 10).x1).toBe(0.5)
  })

  it('marks every fifth line as heavy', () => {
    expect(HEAVY_EVERY).toBe(5)
    expect(isHeavy(0)).toBe(true)
    expect(isHeavy(5)).toBe(true)
    expect(isHeavy(4)).toBe(false)
    expect(isHeavy(4, 0)).toBe(false)
  })

  it('clips a segment to the drawing area', () => {
    const rect = { x0: 0, y0: 0, x1: 100, y1: 100 }
    expect(clipSegment({ x1: 10, y1: 10, x2: 90, y2: 90 }, rect)).toEqual({ x1: 10, y1: 10, x2: 90, y2: 90 })
    expect(clipSegment({ x1: -50, y1: 50, x2: 150, y2: 50 }, rect)).toEqual({ x1: 0, y1: 50, x2: 100, y2: 50 })
    expect(clipSegment({ x1: 200, y1: 200, x2: 300, y2: 300 }, rect)).toBeNull()
    expect(clipSegment({ x1: -10, y1: 40, x2: -5, y2: 60 }, rect)).toBeNull()
    const corner = clipSegment({ x1: -20, y1: -20, x2: 20, y2: 20 }, rect)
    expect(corner?.x1).toBeCloseTo(0, 6)
    expect(corner?.y1).toBeCloseTo(0, 6)
    expect(corner?.x2).toBeCloseTo(20, 6)
  })

  it('draws two families of 30° diagonals inside the margin box', () => {
    const lines = isoLines(600, 800, 40, 50)
    expect(lines.length).toBeGreaterThan(10)
    for (const l of lines) {
      for (const v of [l.x1, l.x2]) {
        expect(v).toBeGreaterThanOrEqual(50 - 1e-6)
        expect(v).toBeLessThanOrEqual(550 + 1e-6)
      }
      for (const v of [l.y1, l.y2]) {
        expect(v).toBeGreaterThanOrEqual(50 - 1e-6)
        expect(v).toBeLessThanOrEqual(750 + 1e-6)
      }
    }
    const slope = Math.abs((lines[0].y2 - lines[0].y1) / (lines[0].x2 - lines[0].x1))
    expect(slope).toBeCloseTo(Math.tan(Math.PI / 6), 4)
    expect(isoLines(600, 800, 0, 50).length).toBeGreaterThan(0)
  })

  it('places a dot at every intersection', () => {
    const dots = dotPoints(600, 800, 20, 50)
    expect(dots).toHaveLength(26 * 36)
    expect(dots[0]).toEqual({ x: 50, y: 50 })
    expect(dots.at(-1)).toEqual({ x: 550, y: 750 })
    expect(gridSpec(600, 800, 20, 50).xs.length * gridSpec(600, 800, 20, 50).ys.length).toBe(dots.length)
  })

  it('counts the elements each pattern needs', () => {
    const spec = gridSpec(600, 800, 20, 50)
    expect(opsFor('grid', spec)).toBe(26 + 36)
    expect(opsFor('dots', spec)).toBe(26 * 36)
    expect(opsFor('isometric', spec, 20)).toBe(26 + 36 + 20)
    expect(MAX_ELEMENTS).toBeGreaterThan(opsFor('graph', gridSpec(595.28, 841.89, 14.173, 42.5)))
  })

  it('lists the four patterns with sensible minimum spacings', () => {
    expect(MODES.map((m) => m.id)).toEqual(['graph', 'grid', 'dots', 'isometric'])
    for (const m of MODES) {
      expect(m.minSpacingMm).toBeGreaterThanOrEqual(2)
      expect(m.hint.length).toBeGreaterThan(10)
    }
  })

  it('normalises colours for both the preview and the PDF', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('7c9cc4')).toBe('#7c9cc4')
    expect(normalizeHex('nope')).toBe('#8aa0c0')
    expect(hexToRgb('#ffffff')).toEqual({ r: 1, g: 1, b: 1 })
    expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(fileNameFor('dots')).toBe('dots-paper.pdf')
  })
})
