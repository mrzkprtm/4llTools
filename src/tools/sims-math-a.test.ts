import { describe, expect, it } from 'vitest'
import { dft, epicycleSum, resample, sortByAmp, type Pt } from './fourier-drawing/fourier'
import { coefficients, partialSum, peak, target } from './fourier-series/series'
import { closedPeriod, gcd, lcm, lissajousPoint, piLabel, ratioLabel } from './lissajous-curves/lissajous'
import { closingTurns, gearCentre, petals, spiroPoint } from './spirograph/spiro'
import { buildLut, escapeTime, inMainBulbs, julia } from './mandelbrot-explorer/fractal'

describe('fourier-drawing', () => {
  it('resamples a closed path evenly by arc length', () => {
    const square: Pt[] = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const pts = resample(square, 8)
    expect(pts).toHaveLength(8)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[1][0]).toBeCloseTo(2)
    expect(pts[2]).toEqual([4, 0])
    expect(pts[5][1]).toBeCloseTo(4)
  })

  it('reconstructs the sample points from the DFT, in any term order', () => {
    const pts: Pt[] = Array.from({ length: 32 }, (_, i) => [Math.cos(i) * 50 + i, Math.sin(i * 3) * 20 - i * 2])
    const terms = sortByAmp(dft(pts))
    expect(terms[0].amp).toBeGreaterThanOrEqual(terms[1].amp)
    pts.forEach(([x, y], n) => {
      const [rx, ry] = epicycleSum(terms, terms.length, n / pts.length)
      expect(rx).toBeCloseTo(x, 6)
      expect(ry).toBeCloseTo(y, 6)
    })
  })

  it('finds a single circle for a circle traced once', () => {
    const pts: Pt[] = Array.from({ length: 16 }, (_, i) => [10 * Math.cos((i / 16) * Math.PI * 2), 10 * Math.sin((i / 16) * Math.PI * 2)])
    const [top, next] = sortByAmp(dft(pts))
    expect(top.freq).toBe(1)
    expect(top.amp).toBeCloseTo(10)
    expect(next.amp).toBeCloseTo(0)
  })
})

describe('fourier-series', () => {
  it('square wave partial sums approach ±1 away from the jumps', () => {
    expect(partialSum('square', 1, Math.PI / 2)).toBeCloseTo(4 / Math.PI)
    expect(Math.abs(partialSum('square', 200, Math.PI / 2) - 1)).toBeLessThan(0.005)
    expect(Math.abs(partialSum('square', 200, -Math.PI / 2) + 1)).toBeLessThan(0.005)
    // More harmonics → closer at a point near the jump.
    const err = (n: number) => Math.abs(partialSum('square', n, 0.4) - 1)
    expect(err(50)).toBeLessThan(err(3))
  })

  it('keeps a Gibbs overshoot of about 9% of the jump', () => {
    const over = (peak('square', 50, 20000) - 1) / 2
    expect(over).toBeGreaterThan(0.085)
    expect(over).toBeLessThan(0.095)
    expect(peak('triangle', 50)).toBeLessThan(1.0001)
  })

  it('uses the right harmonics and converges for each wave', () => {
    expect(coefficients('square', 3).map((h) => h.n)).toEqual([1, 3, 5])
    expect(coefficients('pulse', 4).map((h) => h.n)).toEqual([1, 2, 3, 5])
    for (const kind of ['sawtooth', 'triangle', 'pulse'] as const)
      for (const t of [0.3, 1.2, 2.5, 4])
        expect(Math.abs(partialSum(kind, 50, t) - target(kind, t))).toBeLessThan(kind === 'triangle' ? 0.01 : 0.08)
  })
})

describe('lissajous-curves', () => {
  it('computes the parametric point, with damping', () => {
    expect(lissajousPoint(0, { a: 3, b: 2, delta: Math.PI / 2 })).toEqual([1, 0])
    const [x, y] = lissajousPoint(Math.PI / 4, { a: 1, b: 2, delta: 0, A: 2, B: 3 })
    expect(x).toBeCloseTo(Math.SQRT2)
    expect(y).toBeCloseTo(3)
    const [dx] = lissajousPoint(10, { a: 1, b: 1, delta: Math.PI / 2 - 10, damping: 0.1 })
    expect(dx).toBeCloseTo(Math.exp(-1))
  })

  it('closes after 2π / gcd(a, b)', () => {
    expect(gcd(12, 8)).toBe(4)
    expect(lcm(4, 6)).toBe(12)
    expect(closedPeriod(3, 2)).toBeCloseTo(2 * Math.PI)
    expect(closedPeriod(4, 6)).toBeCloseTo(Math.PI)
    for (const [a, b] of [[3, 2], [4, 6], [5, 4], [9, 3]]) {
      const T = closedPeriod(a, b)
      const p0 = lissajousPoint(0.37, { a, b, delta: 0.8 })
      const p1 = lissajousPoint(0.37 + T, { a, b, delta: 0.8 })
      expect(p1[0]).toBeCloseTo(p0[0])
      expect(p1[1]).toBeCloseTo(p0[1])
    }
    expect(ratioLabel(6, 4)).toBe('3:2')
    expect(piLabel(2, 1)).toBe('2π')
    expect(piLabel(2, 2)).toBe('π')
    expect(piLabel(2, 3)).toBe('2π/3')
  })
})

describe('spirograph', () => {
  it('starts the pen where the formulas say', () => {
    expect(spiroPoint(0, { R: 100, r: 30, d: 20, inside: true })).toEqual([90, 0])
    expect(spiroPoint(0, { R: 100, r: 30, d: 20, inside: false })).toEqual([110, 0])
    // With d = r the hypotrochoid is a hypocycloid whose cusps touch the ring.
    const [x, y] = spiroPoint(Math.PI / 2, { R: 120, r: 30, d: 30, inside: true })
    expect(Math.hypot(x, y)).toBeCloseTo(120)
    expect(gearCentre(Math.PI, { R: 100, r: 30, d: 0, inside: true })[0]).toBeCloseTo(-70)
  })

  it('closes after r / gcd(R, r) trips and not before', () => {
    expect(closingTurns(96, 36)).toBe(3)
    expect(petals(96, 36)).toBe(8)
    expect(closingTurns(100, 50)).toBe(1)
    for (const inside of [true, false]) {
      const g = { R: 96, r: 36, d: 25, inside }
      const start = spiroPoint(0, g)
      const end = spiroPoint(2 * Math.PI * closingTurns(96, 36), g)
      expect(end[0]).toBeCloseTo(start[0])
      expect(end[1]).toBeCloseTo(start[1])
      const early = spiroPoint(2 * Math.PI, g)
      expect(Math.hypot(early[0] - start[0], early[1] - start[1])).toBeGreaterThan(1)
    }
  })
})

describe('mandelbrot-explorer', () => {
  it('knows which points are inside the Mandelbrot set', () => {
    expect(escapeTime(0, 0, 100)).toBe(-1)
    expect(escapeTime(-1, 0, 100)).toBe(-1)
    expect(escapeTime(-0.1226, 0.7449, 500)).toBe(-1) // centre of the period-3 bulb
    expect(inMainBulbs(0, 0)).toBe(true)
    expect(inMainBulbs(-1, 0)).toBe(true)
    expect(inMainBulbs(0.3, 0)).toBe(false)
  })

  it('gives escaping points a smooth, growing count', () => {
    const one = escapeTime(1, 0, 100)
    expect(one).toBeGreaterThan(0)
    expect(one).toBeLessThan(5)
    // Just past the cusp at 1/4, points take longer and longer to escape.
    expect(escapeTime(0.26, 0, 2000)).toBeGreaterThan(20)
    expect(escapeTime(0.2501, 0, 2000)).toBeGreaterThan(escapeTime(0.26, 0, 2000))
    // Smooth colouring changes gradually between neighbours.
    expect(Math.abs(escapeTime(-0.75, 0.1, 500) - escapeTime(-0.75, 0.1001, 500))).toBeLessThan(1)
  })

  it('computes Julia sets and colour tables', () => {
    expect(julia(0.5, 0.5, 0, 0, 100)).toBe(-1)
    expect(julia(1.5, 0, 0, 0, 100)).toBeGreaterThan(0)
    expect(julia(0, 0, -1, 0, 100)).toBe(-1)
    const lut = buildLut(['#000000', '#ffffff'], 4)
    expect(Array.from(lut.slice(0, 3))).toEqual([0, 0, 0])
    expect(lut[6]).toBe(255)
  })
})
