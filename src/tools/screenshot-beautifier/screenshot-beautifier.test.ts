import { describe, expect, it } from 'vitest'
import { barHeight, computeLayout, coverRect, safeScale } from './layout'

describe('screenshot layout', () => {
  it('hugs the content with padding when the ratio is auto', () => {
    const l = computeLayout({ imgW: 1000, imgH: 600, padding: 0.1, frame: 'none', ratio: null })
    expect(l).toMatchObject({ width: 1200, height: 800, winX: 100, winY: 100, bar: 0, imgX: 100, imgY: 100, unit: 1 })
  })

  it('adds a title bar above the screenshot', () => {
    const l = computeLayout({ imgW: 1000, imgH: 600, padding: 0, frame: 'mac', ratio: null })
    expect(l.bar).toBe(barHeight('mac', 1000))
    expect(l.bar).toBeGreaterThan(0)
    expect(l.height).toBe(600 + l.bar)
    expect(l.imgY).toBe(l.winY + l.bar)
    expect(barHeight('browser', 1000)).toBeGreaterThan(barHeight('mac', 1000))
  })

  it('grows the short side to reach a fixed ratio and centers the window', () => {
    const square = computeLayout({ imgW: 1600, imgH: 900, padding: 0.05, frame: 'none', ratio: 1 })
    expect(square.width).toBe(1760)
    expect(square.height).toBe(1760)
    expect(square.winY).toBe(Math.round((1760 - 900) / 2))
    const wide = computeLayout({ imgW: 400, imgH: 800, padding: 0, frame: 'none', ratio: 16 / 9 })
    expect(wide.height).toBe(800)
    expect(wide.width).toBe(Math.round(800 * 16 / 9))
    expect(wide.winX).toBe(Math.round((wide.width - 400) / 2))
  })

  it('caps export scale at the canvas limit', () => {
    expect(safeScale(1000, 800, 2)).toBe(2)
    expect(safeScale(6000, 3000, 2)).toBeCloseTo(8192 / 6000)
  })

  it('crops a background image to cover', () => {
    const r = coverRect(2000, 1000, 500, 500)
    expect(r.sw).toBeCloseTo(1000)
    expect(r.sh).toBeCloseTo(1000)
    expect(r.sx).toBeCloseTo(500)
    expect(r.sy).toBeCloseTo(0)
  })
})
