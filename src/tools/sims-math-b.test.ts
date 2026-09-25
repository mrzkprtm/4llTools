import { describe, expect, it } from 'vitest'
import { rng } from '../sim/math'
import { centroid, rmsDistance, stepAll, theoryRms, theoryWithin, type WalkMode } from './random-walk/walk'

describe('random walk', () => {
  it('spreads like √n · step for every mode', () => {
    for (const mode of ['1d', 'lattice', 'brownian'] as WalkMode[]) {
      const random = rng(42)
      const xs = new Float64Array(4000)
      const ys = new Float64Array(4000)
      for (let k = 0; k < 100; k++) stepAll(mode, xs, ys, 2, 0, random)
      expect(theoryRms(100, mode, 2, 0)).toBeCloseTo(20, 9)
      expect(rmsDistance(xs, ys) / 20).toBeGreaterThan(0.96)
      expect(rmsDistance(xs, ys) / 20).toBeLessThan(1.04)
    }
  })
  it('drifts at bias × step per step and matches the drift theory', () => {
    const random = rng(7)
    const xs = new Float64Array(3000)
    const ys = new Float64Array(3000)
    for (let k = 0; k < 200; k++) stepAll('1d', xs, ys, 1, 0.2, random)
    expect(centroid(xs, ys)[0]).toBeGreaterThan(38)
    expect(centroid(xs, ys)[0]).toBeLessThan(42)
    expect(rmsDistance(xs, ys) / theoryRms(200, '1d', 1, 0.2)).toBeCloseTo(1, 1)
  })
  it('predicts the share within one RMS radius', () => {
    expect(theoryWithin('brownian', 50, 1, 0, Math.sqrt(50))).toBeCloseTo(1 - Math.exp(-1), 6)
    expect(theoryWithin('1d', 100, 1, 0, 10)).toBeCloseTo(0.6827, 3)
  })
})

import { compile, curl, divergence, rk4Field } from './vector-field/field'

describe('vector field parser', () => {
  it('follows precedence, powers and implicit multiplication', () => {
    expect(compile('x^2 + 3*y')(2, 1, 0)).toBe(7)
    expect(compile('-x^2')(2, 0, 0)).toBe(-4)
    expect(compile('2^3^2')(0, 0, 0)).toBe(512)
    expect(compile('2x + 3(y - 1)')(1, 2, 0)).toBe(5)
    expect(compile('xy')(3, 4, 0)).toBe(12)
    expect(compile('sin(pi/2) + cos(0) * exp(0) + sqrt(abs(-9)) + log(e)')(0, 0, 0)).toBeCloseTo(6, 12)
    expect(compile('(1 - x^2) y - x')(2, 1, 0)).toBe(-5)
    expect(compile('t * 2')(0, 0, 1.5)).toBe(3)
  })
  it('rejects anything that is not maths', () => {
    for (const bad of ['alert(1)', 'x +', '(x', 'x)', 'sin x', 'constructor', 'x;y', '']) expect(() => compile(bad)).toThrow()
  })
  it('measures divergence and curl and integrates a rotation', () => {
    const rot = { P: compile('-y'), Q: compile('x') }
    const src = { P: compile('x'), Q: compile('y') }
    expect(divergence(src, 0.4, -1.2)).toBeCloseTo(2, 6)
    expect(curl(src, 0.4, -1.2)).toBeCloseTo(0, 6)
    expect(curl(rot, 1, 2)).toBeCloseTo(2, 6)
    expect(divergence(rot, 1, 2)).toBeCloseTo(0, 6)
    let p: [number, number] = [1, 0]
    const n = 200
    for (let i = 0; i < n; i++) p = rk4Field(rot, p[0], p[1], 0, (2 * Math.PI) / n, [0, 0])
    expect(p[0]).toBeCloseTo(1, 6)
    expect(p[1]).toBeCloseTo(0, 6)
  })
})

import { apply, det, eigen2x2, IDENTITY, lerpMatrix, trace, type Mat } from './matrix-transform/matrix'

describe('2×2 matrices', () => {
  it('computes det, trace and interpolation', () => {
    const m: Mat = [1, 2, 3, 4]
    expect(det(m)).toBe(-2)
    expect(trace(m)).toBe(5)
    expect(lerpMatrix(IDENTITY, m, 0.5)).toEqual([1, 1, 1.5, 2.5])
    expect(lerpMatrix(IDENTITY, m, 0)).toEqual(IDENTITY)
  })
  it('finds real eigenpairs that satisfy Av = λv', () => {
    for (const m of [[2, 1, 1, 2], [1, 2, 0.5, 1], [3, 0, 0, -1], [1, 1, 0, 1]] as Mat[]) {
      const e = eigen2x2(m)
      expect(e.real).toBe(true)
      if (!e.real) continue
      expect(e.values[0] + e.values[1]).toBeCloseTo(trace(m), 9)
      expect(e.values[0] * e.values[1]).toBeCloseTo(det(m), 9)
      e.vectors.forEach((v, k) => {
        const [x, y] = apply(m, v[0], v[1])
        expect(x).toBeCloseTo(e.values[k] * v[0], 9)
        expect(y).toBeCloseTo(e.values[k] * v[1], 9)
      })
    }
    const shear = eigen2x2([1, 1, 0, 1])
    expect(shear.real && shear.vectors.length).toBe(1)
    const scalar = eigen2x2([2, 0, 0, 2])
    expect(scalar.real && scalar.all).toBe(true)
  })
  it('reports complex eigenvalues for rotations', () => {
    const e = eigen2x2([0, -1, 1, 0])
    expect(e.real).toBe(false)
    if (!e.real) {
      expect(e.re).toBeCloseTo(0, 12)
      expect(e.im).toBeCloseTo(1, 12)
    }
  })
})

import { bernstein, bezierPoint, deCasteljau, type Pt } from './bezier-construction/bezier'

describe('Bézier curves', () => {
  const pts: Pt[] = [[0, 0], [1, 3], [4, 3], [6, -1], [7, 2]]
  it('returns every de Casteljau level down to one point that matches the Bernstein sum', () => {
    const levels = deCasteljau(pts, 0.3)
    expect(levels.map((l) => l.length)).toEqual([5, 4, 3, 2, 1])
    const [x, y] = bezierPoint(pts, 0.3)
    expect(levels[4][0][0]).toBeCloseTo(x, 12)
    expect(levels[4][0][1]).toBeCloseTo(y, 12)
    expect(deCasteljau(pts, 0)[4][0]).toEqual([0, 0])
    expect(deCasteljau(pts, 1)[4][0]).toEqual([7, 2])
  })
  it('has Bernstein weights that sum to one', () => {
    for (let n = 1; n <= 6; n++)
      for (const t of [0, 0.2, 0.5, 0.77, 1]) {
        let s = 0
        for (let i = 0; i <= n; i++) s += bernstein(n, i, t)
        expect(s).toBeCloseTo(1, 12)
      }
    expect(bernstein(3, 1, 0.5)).toBeCloseTo(0.375, 12)
  })
})

import { evalF, polyString, radius, taylorCoeffs, taylorEval, type FnId } from './taylor-series/taylor'

describe('Taylor series', () => {
  it('matches sin with 10 terms around 0', () => {
    const c = taylorCoeffs('sin', 0, 10)
    for (const x of [-1.5, -0.4, 0.3, 1, 1.5]) expect(Math.abs(taylorEval(c, 0, x) - Math.sin(x))).toBeLessThan(1e-5)
    expect(c[1]).toBeCloseTo(1, 12)
    expect(c[3]).toBeCloseTo(-1 / 6, 12)
  })
  it('converges inside the radius for every function and centre', () => {
    const cases: [FnId, number, number][] = [['cos', 1, 2.5], ['exp', 0.5, -1.5], ['ln1p', 0.5, 1.2], ['geom', -0.5, 0.3], ['atan', 0.8, 1.3], ['atan', 0, 0.6]]
    for (const [fn, a, x] of cases) {
      expect(Math.abs(x - a)).toBeLessThan(radius(fn, a))
      const c = taylorCoeffs(fn, a, 60)
      expect(taylorEval(c, a, x)).toBeCloseTo(evalF(fn, x), 5)
    }
    expect(radius('atan', 0)).toBe(1)
    expect(radius('sin', 3)).toBe(Infinity)
  })
  it('writes the polynomial out', () => {
    expect(polyString(taylorCoeffs('exp', 0, 3), 0)).toBe('1 + x + 0.5·x²')
    expect(polyString(taylorCoeffs('sin', 0, 8), 0, 3)).toBe('x − 0.1667·x³ + 0.008333·x⁵ + …')
  })
})

import { integrate, riemann } from './riemann-sums/riemann'

describe('Riemann sums', () => {
  const sq = (x: number) => x * x
  it('gives the textbook values for x² on [0, 1] with n = 4', () => {
    expect(riemann(sq, 0, 1, 4, 'left')).toBeCloseTo(14 / 64, 12)
    expect(riemann(sq, 0, 1, 4, 'right')).toBeCloseTo(30 / 64, 12)
    expect(riemann(sq, 0, 1, 4, 'mid')).toBeCloseTo(84 / 256, 12)
    expect(riemann(sq, 0, 1, 4, 'trap')).toBeCloseTo(22 / 64, 12)
    expect(riemann(sq, 0, 1, 4, 'simpson')).toBeCloseTo(1 / 3, 12)
    expect(integrate(sq, 0, 1)).toBeCloseTo(1 / 3, 12)
  })
  it('converges at the expected order', () => {
    const exact = integrate(Math.exp, -1, 2)
    expect(exact).toBeCloseTo(Math.exp(2) - Math.exp(-1), 10)
    const err = (m: 'left' | 'mid' | 'simpson', n: number) => Math.abs(riemann(Math.exp, -1, 2, n, m) - exact)
    expect(err('left', 20) / err('left', 40)).toBeCloseTo(2, 0)
    expect(err('mid', 20) / err('mid', 40)).toBeCloseTo(4, 0)
    expect(err('simpson', 20) / err('simpson', 40)).toBeGreaterThan(14)
    expect(riemann(Math.sin, 0, 2 * Math.PI, 7, 'mid')).toBeCloseTo(0, 12)
  })
})
