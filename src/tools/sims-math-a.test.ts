import { describe, expect, it } from 'vitest'
import { dft, epicycleSum, resample, sortByAmp, type Pt } from './fourier-drawing/fourier'
import { coefficients, partialSum, peak, target } from './fourier-series/series'
import { closedPeriod, gcd, lcm, lissajousPoint, piLabel, ratioLabel } from './lissajous-curves/lissajous'
import { closingTurns, gearCentre, petals, spiroPoint } from './spirograph/spiro'
import { buildLut, escapeTime, inMainBulbs, julia } from './mandelbrot-explorer/fractal'
import { compile, evaluate, tryCompile } from './function-grapher/expr'
import { exactTrig, quadrant, snapToSpecial, specialAngleLabel } from './unit-circle/trig'
import { estimatePi, standardError, throwDarts } from './monte-carlo-pi/montecarlo'
import { rng } from '../sim/math'
import { binStats, binomialPmf, simulateBins, theory } from './galton-board/galton'
import { BINS, RunningStats, histogramSource, makeSource, sampleMean } from './central-limit/clt'

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

describe('function-grapher', () => {
  it('follows operator precedence and associativity', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14)
    expect(evaluate('(2 + 3) * 4')).toBe(20)
    expect(evaluate('2^3^2')).toBe(512)
    expect(evaluate('-x^2', { x: 3 })).toBe(-9)
    expect(evaluate('2^-1')).toBe(0.5)
    expect(evaluate('10 / 4 / 5')).toBe(0.5)
    expect(evaluate('--2')).toBe(2)
    expect(evaluate('1.5e2 + .5')).toBe(150.5)
  })

  it('knows functions, constants, variables and implicit multiplication', () => {
    expect(evaluate('sin(pi/2)')).toBeCloseTo(1)
    expect(evaluate('ln(e^2) + log(1000) + sqrt(16) + abs(-2) + floor(2.7)')).toBeCloseTo(2 + 3 + 4 + 2 + 2)
    expect(evaluate('a*x^2 + b', { x: 3, a: 2, b: 1 })).toBe(19)
    expect(evaluate('2x', { x: 3 })).toBe(6)
    expect(evaluate('3sin(x)', { x: Math.PI / 2 })).toBeCloseTo(3)
    expect(evaluate('(x+1)(x-1)', { x: 4 })).toBe(15)
    expect(evaluate('2pi')).toBeCloseTo(2 * Math.PI)
    expect(evaluate('max(x, t)', { x: 2, t: 5 })).toBe(5)
    const f = compile('sin(x - t)')
    expect(f({ x: 1, t: 1, a: 0, b: 0 })).toBe(0)
  })

  it('reports errors instead of running arbitrary code', () => {
    for (const bad of ['2 +', '(1 + 2', 'foo(1)', 'alert(1)', 'eval(x)', 'x; 1', 'sin x', '', 'max(1)', '1 2 +'])
      expect(tryCompile(bad).error, bad).not.toBeNull()
    const r = tryCompile('(1 + 2')
    expect(r.error).toMatch(/Missing/)
  })
})

describe('unit-circle', () => {
  it('labels special angles as fractions of π', () => {
    expect(specialAngleLabel(0)).toBe('0')
    expect(specialAngleLabel(30)).toBe('π/6')
    expect(specialAngleLabel(90)).toBe('π/2')
    expect(specialAngleLabel(135)).toBe('3π/4')
    expect(specialAngleLabel(180)).toBe('π')
    expect(specialAngleLabel(330)).toBe('11π/6')
    expect(specialAngleLabel(360)).toBe('2π')
    expect(specialAngleLabel(15)).toBe('π/12')
    expect(specialAngleLabel(37)).toBeNull()
  })

  it('gives exact values with the right signs in every quadrant', () => {
    expect(exactTrig(60)).toEqual({ sin: '√3/2', cos: '1/2', tan: '√3' })
    expect(exactTrig(150)).toEqual({ sin: '1/2', cos: '−√3/2', tan: '−√3/3' })
    expect(exactTrig(225)).toEqual({ sin: '−√2/2', cos: '−√2/2', tan: '1' })
    expect(exactTrig(300)).toEqual({ sin: '−√3/2', cos: '1/2', tan: '−√3' })
    expect(exactTrig(90)?.tan).toBe('undefined')
    expect(exactTrig(180)).toEqual({ sin: '0', cos: '−1', tan: '0' })
    expect(exactTrig(20)).toBeNull()
    // The strings agree with the numbers.
    const num = (s: string) => Number(s.replace('−', '-').replace('√3', String(Math.sqrt(3))).replace('√2', String(Math.SQRT2)).split('/').reduce((a, b) => String(Number(a) / Number(b))))
    for (const d of [30, 45, 120, 210, 315]) {
      const e = exactTrig(d)!
      expect(num(e.sin)).toBeCloseTo(Math.sin((d * Math.PI) / 180))
      expect(num(e.cos)).toBeCloseTo(Math.cos((d * Math.PI) / 180))
    }
  })

  it('finds quadrants and snaps', () => {
    expect(quadrant(45)).toBe('I')
    expect(quadrant(100)).toBe('II')
    expect(quadrant(200)).toBe('III')
    expect(quadrant(-10)).toBe('IV')
    expect(quadrant(90)).toBe('+y axis')
    expect(snapToSpecial(43)).toBe(45)
    expect(snapToSpecial(52)).toBe(52)
    expect(snapToSpecial(58)).toBe(60)
  })
})

describe('monte-carlo-pi', () => {
  it('turns the inside fraction into an estimate of π', () => {
    expect(estimatePi(0, 0)).toBe(0)
    expect(estimatePi(785, 1000)).toBeCloseTo(3.14)
    expect(standardError(100)).toBeCloseTo(0.164, 2)
    expect(standardError(10000)).toBeCloseTo(standardError(100) / 10)
  })

  it('converges near π with a seeded sampler, for both targets', () => {
    const n = 200000
    for (const target of ['quarter', 'full'] as const) {
      const est = estimatePi(throwDarts(n, rng(42), target), n)
      expect(Math.abs(est - Math.PI)).toBeLessThan(5 * standardError(n))
    }
    // Same seed, same darts.
    expect(throwDarts(1000, rng(7))).toBe(throwDarts(1000, rng(7)))
  })
})

describe('galton-board', () => {
  it('has a proper binomial pmf', () => {
    expect(binomialPmf(4, 2, 0.5)).toBeCloseTo(6 / 16)
    expect(binomialPmf(10, 0, 0.3)).toBeCloseTo(0.7 ** 10)
    expect(binomialPmf(5, 6, 0.5)).toBe(0)
    for (const [n, p] of [[12, 0.5], [16, 0.2], [4, 0.9]]) {
      let sum = 0
      let mean = 0
      for (let k = 0; k <= n; k++) {
        sum += binomialPmf(n, k, p)
        mean += k * binomialPmf(n, k, p)
      }
      expect(sum).toBeCloseTo(1)
      expect(mean).toBeCloseTo(theory(n, p).mean)
    }
    expect(theory(12, 0.5).sd).toBeCloseTo(Math.sqrt(3))
  })

  it('bins simulated balls around np with spread √(np(1−p))', () => {
    const bins = simulateBins(10, 0.3, 20000, rng(3))
    expect(bins).toHaveLength(11)
    const st = binStats(bins)
    expect(st.total).toBe(20000)
    expect(Math.abs(st.mean - 3)).toBeLessThan(0.05)
    expect(Math.abs(st.sd - Math.sqrt(2.1))).toBeLessThan(0.05)
    expect(binStats([0, 2, 0]).mean).toBe(1)
  })
})

describe('central-limit', () => {
  it('knows the population mean and spread of each source', () => {
    const u = makeSource('uniform')
    expect(u.mean).toBeCloseTo(5, 3)
    expect(u.sd).toBeCloseTo(10 / Math.sqrt(12), 3)
    const dice = makeSource('dice')
    expect(dice.mean).toBe(3.5)
    const one = new Array(BINS).fill(0)
    one[10] = 1
    const spike = histogramSource(one)
    expect(spike.mean).toBeCloseTo(2.625)
    const random = rng(5)
    for (let i = 0; i < 100; i++) {
      const v = spike.sample(random)
      expect(v).toBeGreaterThanOrEqual(2.5)
      expect(v).toBeLessThan(2.75)
    }
  })

  it('samplers match their stated mean and sd', () => {
    const random = rng(11)
    for (const kind of ['uniform', 'exponential', 'dice', 'bimodal'] as const) {
      const src = makeSource(kind)
      const st = new RunningStats()
      for (let i = 0; i < 40000; i++) st.push(src.sample(random))
      expect(Math.abs(st.mean - src.mean), kind).toBeLessThan(0.05)
      expect(Math.abs(st.sd - src.sd) / src.sd, kind).toBeLessThan(0.03)
    }
  })

  it('sample means centre on μ with spread σ/√n', () => {
    const src = makeSource('exponential')
    const random = rng(21)
    const n = 25
    const st = new RunningStats()
    for (let i = 0; i < 8000; i++) st.push(sampleMean(src, n, random).mean)
    expect(Math.abs(st.mean - src.mean)).toBeLessThan(0.03)
    expect(Math.abs(st.sd - src.sd / Math.sqrt(n)) / (src.sd / Math.sqrt(n))).toBeLessThan(0.05)
  })
})
