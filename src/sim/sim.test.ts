import { describe, expect, it } from 'vitest'
import { alpha } from './theme'
import { clamp, collide1D, fmt, gaussian, histogram, makeNoise, mean, niceStep, pushCap, rk4, rng, stdev } from './math'

describe('sim math', () => {
  it('clamps and formats numbers for readouts', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(fmt(1234.567)).toBe('1,235')
    expect(fmt(0.123456, 3)).toBe('0.123')
    expect(fmt(Infinity)).toBe('—')
  })

  it('makes repeatable random numbers from a seed', () => {
    const a = rng(42)
    const b = rng(42)
    const xs = Array.from({ length: 5 }, a)
    expect(xs).toEqual(Array.from({ length: 5 }, b))
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  })

  it('draws standard normal samples', () => {
    const r = rng(3)
    const xs = Array.from({ length: 20000 }, () => gaussian(r))
    expect(mean(xs)).toBeCloseTo(0, 1)
    expect(stdev(xs)).toBeCloseTo(1, 1)
  })

  it('integrates exponential growth with RK4', () => {
    let y = [1]
    for (let i = 0; i < 100; i++) y = rk4((_t, [v]) => [v], 0, y, 0.01)
    expect(y[0]).toBeCloseTo(Math.E, 6)
  })

  it('bins values into a histogram', () => {
    expect(histogram([0, 0.1, 0.5, 0.9, 1, 5], 2, 0, 1)).toEqual([2, 4])
  })

  it('keeps rolling series short', () => {
    const a = [1, 2, 3]
    expect(pushCap(a, 4, 3)).toEqual([2, 3, 4])
  })

  it('makes smooth, seeded noise', () => {
    const n = makeNoise(9)
    expect(n(1.5, 2.5)).toBe(makeNoise(9)(1.5, 2.5))
    expect(Math.abs(n(1.5, 2.5) - n(1.501, 2.5))).toBeLessThan(0.01)
    expect(n(3, 4)).toBeCloseTo(0, 6) // zero at lattice points
  })

  it('picks nice grid steps', () => {
    expect(niceStep(100, 10)).toBe(10)
    expect(niceStep(73, 8)).toBe(10)
    expect(niceStep(0.3, 6)).toBeCloseTo(0.05)
  })

  it('conserves momentum in collisions and energy only when elastic', () => {
    const [a, b] = collide1D(2, 3, 1, -1, 1)
    expect(2 * a + 1 * b).toBeCloseTo(2 * 3 - 1)
    expect(0.5 * 2 * a * a + 0.5 * b * b).toBeCloseTo(0.5 * 2 * 9 + 0.5)
    const [c, d] = collide1D(1, 5, 1, 0, 0)
    expect(c).toBe(d)
  })
})

describe('theme', () => {
  it('adds transparency to hex and rgb colours', () => {
    expect(alpha('#c2410c', 0.5)).toBe('rgba(194, 65, 12, 0.5)')
    expect(alpha('#fff', 1)).toBe('rgba(255, 255, 255, 1)')
    expect(alpha('rgb(1, 2, 3)', 0.2)).toBe('rgba(1, 2, 3, 0.2)')
  })
})
