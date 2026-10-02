import { describe, expect, it } from 'vitest'
import { outlinePath, shouldAdd, smoothLine, strokesBounds, strokesToSvg, strokeWidths, textToSvg, type Pt, type Stroke } from './strokes'

const pt = (x: number, y: number, t = 0, p = 0.5): Pt => ({ x, y, t, p })

describe('signature smoothing', () => {
  it('builds quadratic curves through midpoints', () => {
    expect(smoothLine([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 10 }])).toBe('M0 0 Q10 0 15 5 L20 10')
    expect(smoothLine([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('M1 2 L3 4')
    expect(smoothLine([])).toBe('')
  })

  it('thins points that are too close', () => {
    expect(shouldAdd(undefined, pt(0, 0))).toBe(true)
    expect(shouldAdd(pt(0, 0), pt(1, 0))).toBe(false)
    expect(shouldAdd(pt(0, 0), pt(3, 4))).toBe(true)
  })
})

describe('signature widths', () => {
  it('follows pen pressure', () => {
    const w = strokeWidths([pt(0, 0, 0, 0.1), pt(5, 0, 10, 0.9), pt(10, 0, 20, 0.9), pt(15, 0, 30, 0.9)], 4, true)
    expect(w[0]).toBeCloseTo(4 * (0.3 + 0.12))
    expect(w[3]).toBeGreaterThan(w[1])
  })

  it('gets thinner when the mouse moves fast, eased and bounded', () => {
    const slow = strokeWidths([pt(0, 0, 0), pt(2, 0, 20), pt(4, 0, 40), pt(6, 0, 60)], 4, false)
    const fast = strokeWidths([pt(0, 0, 0), pt(40, 0, 5), pt(80, 0, 10), pt(120, 0, 15)], 4, false)
    expect(fast[3]).toBeLessThan(slow[3])
    expect(Math.min(...fast)).toBeGreaterThanOrEqual(4 * 0.45 - 1e-9)
    expect(Math.max(...slow)).toBeLessThanOrEqual(4 * 1.45 + 1e-9)
  })
})

describe('signature outlines and svg', () => {
  it('draws a dot for a single tap and a closed outline for a line', () => {
    expect(outlinePath([pt(10, 10)], [4])).toMatch(/^M8 10 a2 2 0 1 0 4 0/)
    const d = outlinePath([pt(0, 0), pt(10, 0), pt(20, 0)], [2, 2, 2])
    expect(d.startsWith('M0 1')).toBe(true) // left edge sits below a rightward stroke
    expect(d).toContain('A1 1 0 0 0 20 -1')
    expect(d.endsWith('Z')).toBe(true)
  })

  it('crops the SVG to the strokes and keeps paths', () => {
    const s: Stroke = { points: [pt(100, 50, 0), pt(140, 60, 16), pt(180, 50, 32)], color: '#1d4ed8', size: 2, pressure: false }
    const b = strokesBounds([s])!
    expect(b.x).toBeCloseTo(97)
    expect(b.w).toBeCloseTo(86)
    const svg = strokesToSvg([s], 5)
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="92 42 96 26"/)
    expect(svg).toContain('fill="#1d4ed8"')
    expect(svg.match(/<path /g)).toHaveLength(1)
    expect(strokesToSvg([])).toBe('')
    expect(strokesBounds([])).toBeNull()
  })

  it('escapes typed signatures', () => {
    expect(textToSvg('A & <B>', 'cursive', 40, '#000', 300, 100)).toContain('A &amp; &lt;B&gt;')
  })
})
