import { describe, expect, it } from 'vitest'
import { SPRINGS } from '../../motion/springs'
import { PRESETS, ease, formatBezier, parseBezier, parseLinear, pointAt, toLinear, type Bezier } from './bezier'

const preset = (n: string) => PRESETS.find((p) => p.name === n)!.b

describe('bezier evaluation', () => {
  it('is the identity for linear and pinned at the ends', () => {
    for (const x of [0, 0.1, 0.37, 0.5, 0.9, 1]) expect(ease([0, 0, 1, 1], x)).toBeCloseTo(x, 6)
    expect(ease(preset('ease'), 0)).toBe(0)
    expect(ease(preset('ease'), 1)).toBe(1)
  })

  it('matches known browser values for ease and ease-in-out', () => {
    expect(ease(preset('ease'), 0.5)).toBeCloseTo(0.8024, 3)
    expect(ease(preset('ease-in-out'), 0.5)).toBeCloseTo(0.5, 6)
    expect(ease(preset('ease-in'), 0.25)).toBeCloseTo(0.0934, 3)
  })

  it('overshoots for back easings', () => {
    const b = preset('easeOutBack')
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => ease(b, i / 100)))
    expect(peak).toBeGreaterThan(1.05)
    const inBack = preset('easeInBack')
    expect(Math.min(...Array.from({ length: 101 }, (_, i) => ease(inBack, i / 100)))).toBeLessThan(-0.05)
  })

  it('returns curve points', () => {
    expect(pointAt([0.25, 0.1, 0.25, 1], 0)).toEqual({ x: 0, y: 0 })
    expect(pointAt([0.25, 0.1, 0.25, 1], 1)).toEqual({ x: 1, y: 1 })
  })
})

describe('format and parse', () => {
  it('round-trips', () => {
    const b: Bezier = [0.34, 1.56, 0.64, 1]
    expect(formatBezier(b)).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)')
    expect(parseBezier('cubic-bezier(0.34, 1.56, 0.64, 1);')).toEqual(b)
    expect(parseBezier('.34,1.56,.64,1')).toEqual(b)
    expect(parseBezier('ease-in-out')).toEqual([0.42, 0, 0.58, 1])
    expect(parseBezier('cubic-bezier(1.2, 0, 0, 1)')).toBeNull()
    expect(parseBezier('nope')).toBeNull()
    expect(formatBezier([0.123456, 0, 1, 1])).toBe('cubic-bezier(0.123, 0, 1, 1)')
  })

  it('reads the spring linear() presets and samples beziers to linear()', () => {
    const snap = parseLinear(SPRINGS.snap.easing)
    expect(snap[0]).toBe(0)
    expect(snap.at(-1)).toBe(1)
    expect(Math.max(...parseLinear(SPRINGS.bouncy.easing))).toBeGreaterThan(1.1)
    expect(toLinear([0, 0, 1, 1], 4)).toBe('linear(0, 0.25, 0.5, 0.75, 1)')
  })
})
