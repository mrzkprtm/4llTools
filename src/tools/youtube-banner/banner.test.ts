import { describe, expect, it } from 'vitest'
import { BANNER_H, BANNER_W, DEVICES, SAFE, gradientEnds, wrapText } from './banner'

describe('gradientEnds', () => {
  it('spans horizontally at 0° and vertically at 90°', () => {
    const [x0, y0, x1, y1] = gradientEnds(0, 100, 50)
    expect(y0).toBeCloseTo(25)
    expect(y1).toBeCloseTo(25)
    expect(x1 - x0).toBeCloseTo(100)
    const [a0, b0, a1, b1] = gradientEnds(90, 100, 50)
    expect(a1 - a0).toBeCloseTo(0)
    expect(b1 - b0).toBeCloseTo(50)
  })
})

describe('wrapText', () => {
  const ten = (s: string) => s.length * 10

  it('wraps on width and never exceeds max lines', () => {
    expect(wrapText(ten, 'aa bb cc dd', 50)).toEqual(['aa bb', 'cc dd'])
    expect(wrapText(ten, 'aa bb cc dd ee ff', 30, 2)).toEqual(['aa', 'bb'])
  })

  it('keeps a short line intact and empties to nothing', () => {
    expect(wrapText(ten, 'short', 100)).toEqual(['short'])
    expect(wrapText(ten, '   ', 100)).toEqual([])
  })
})

describe('device crops', () => {
  it('stay inside the banner and cover the safe area', () => {
    for (const d of DEVICES) {
      expect(d.x, d.name).toBeGreaterThanOrEqual(0)
      expect(d.y, d.name).toBeGreaterThanOrEqual(0)
      expect(d.x + d.w, d.name).toBeLessThanOrEqual(BANNER_W)
      expect(d.y + d.h, d.name).toBeLessThanOrEqual(BANNER_H)
    }
    const mobile = DEVICES.find((d) => d.name === 'Mobile')!
    expect(mobile.x).toBe(SAFE.x)
    expect(mobile.w).toBe(SAFE.w)
  })
})
