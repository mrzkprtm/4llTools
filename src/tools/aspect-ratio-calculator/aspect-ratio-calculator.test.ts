import { describe, expect, it } from 'vitest'
import { convertUnit, gcd, heightFor, nearestNamed, parseRatio, ppi, simplify, widthFor } from './ratio'

const ctx = { rootPx: 16, parentPx: 20, viewportW: 1440, viewportH: 900 }

describe('aspect ratio', () => {
  it('computes the gcd and simplifies ratios', () => {
    expect(gcd(1920, 1080)).toBe(120)
    expect(simplify(1920, 1080)).toEqual({ w: 16, h: 9 })
    expect(simplify(2560, 1080)).toEqual({ w: 64, h: 27 })
    expect(simplify(1.5, 1)).toEqual({ w: 3, h: 2 })
    expect(simplify(0, 10)).toBeNull()
  })

  it('finds the nearest named ratio', () => {
    expect(nearestNamed(2560, 1080).label).toBe('21:9')
    expect(nearestNamed(1280, 720)).toMatchObject({ label: '16:9', diff: 0 })
  })

  it('fills in the missing side', () => {
    expect(heightFor(1280, { w: 16, h: 9 })).toBe(720)
    expect(widthFor(1080, { w: 4, h: 3 })).toBe(1440)
    expect(parseRatio('21:9')).toEqual({ w: 21, h: 9 })
    expect(parseRatio('3x2')).toEqual({ w: 3, h: 2 })
    expect(parseRatio('abc')).toBeNull()
  })

  it('computes screen density', () => {
    const r = ppi(1920, 1080, 24)!
    expect(r.ppi).toBeCloseTo(91.79, 1)
    expect(r.widthIn).toBeCloseTo(20.92, 1)
    expect(ppi(0, 1080, 24)).toBeNull()
  })

  it('converts css units', () => {
    expect(convertUnit(24, 'px', 'rem', ctx)).toBe(1.5)
    expect(convertUnit(2, 'em', 'px', ctx)).toBe(40)
    expect(convertUnit(12, 'pt', 'px', ctx)).toBe(16)
    expect(convertUnit(50, 'vw', 'px', ctx)).toBe(720)
    expect(convertUnit(90, 'px', 'vh', ctx)).toBe(10)
    expect(convertUnit(150, '%', 'px', ctx)).toBe(30)
  })
})
