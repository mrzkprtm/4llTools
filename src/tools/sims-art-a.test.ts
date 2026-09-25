import { describe, expect, it } from 'vitest'
import { symmetryPoints, runCount } from './kaleidoscope-draw/symmetry'
import { centroid, circumcircle, clipToward, delaunay, voronoiCells, type Pt } from './voronoi-diagram/voronoi'
import { rng } from '../sim/math'
import { chord, curveName, target } from './times-table-circle/times'
import { GOLDEN_ANGLE, isFibonacci, parastichies, seedPosition } from './phyllotaxis/phyllo'
import { makeField, makeParticles, seedParticles, stepParticles, swirl } from './flow-field-art/field'

describe('flow-field-art', () => {
  it('gives the same field angle for the same seed and a different one for another seed', () => {
    const a = makeField(42)
    const b = makeField(42)
    const c = makeField(43)
    const pts = [[10, 20], [123.4, 56.7], [700, 400]]
    for (const [x, y] of pts) expect(a(x, y, 0.3, 0.004, 1.5)).toBe(b(x, y, 0.3, 0.004, 1.5))
    expect(pts.some(([x, y]) => Math.abs(a(x, y, 0, 0.004, 1.5) - c(x, y, 0, 0.004, 1.5)) > 1e-6)).toBe(true)
    // Turns scale the angle linearly.
    expect(a(300, 200, 0, 0.005, 2)).toBeCloseTo(2 * a(300, 200, 0, 0.005, 1))
  })

  it('steps particles along the heading and respawns them when they leave', () => {
    const p = makeParticles(10)
    const random = seedParticles(p, 10, 100, 100, 3, 1)
    const x0 = p.x[0]
    const y0 = p.y[0]
    stepParticles(p, () => 0, 2, 100, 100, 3, random)
    expect(p.px[0]).toBe(x0)
    expect(p.y[0]).toBeCloseTo(y0)
    if (x0 + 2 <= 102) expect(p.x[0]).toBeCloseTo(x0 + 2)
    for (let k = 0; k < 200; k++) stepParticles(p, () => 0, 2, 100, 100, 3, random)
    for (let i = 0; i < p.n; i++) expect(p.x[i]).toBeLessThanOrEqual(102)
  })

  it('swirls headings into a tangent near the vortex and leaves them alone outside it', () => {
    expect(swirl(1, 500, 500, 0, 0, 100)).toBe(1)
    const a = swirl(0, 1, 0, 0, 0, 100) // right next to the centre: almost fully tangential (pointing down in screen space)
    expect(Math.sin(a)).toBeGreaterThan(0.9)
  })
})

describe('kaleidoscope-draw', () => {
  it('makes n rotated copies, or 2n with mirroring, all at the same radius', () => {
    const rot = symmetryPoints(30, 40, 6, false)
    expect(rot).toHaveLength(6)
    const mir = symmetryPoints(30, 40, 6, true)
    expect(mir).toHaveLength(12)
    for (const [x, y] of mir) expect(Math.hypot(x, y)).toBeCloseTo(50)
    // Rotations are spaced 60° apart.
    const a0 = Math.atan2(rot[0][1], rot[0][0])
    const a1 = Math.atan2(rot[1][1], rot[1][0])
    expect(a1 - a0).toBeCloseTo(Math.PI / 3)
    // The first mirrored copy is the reflection across the x axis.
    expect(mir[1][0]).toBeCloseTo(30)
    expect(mir[1][1]).toBeCloseTo(-40)
    // Every copy is distinct for a generic point.
    const keys = new Set(mir.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`))
    expect(keys.size).toBe(12)
  })

  it('splits strokes into runs of segments', () => {
    expect(runCount(0)).toBe(0)
    expect(runCount(1)).toBe(1)
    expect(runCount(7)).toBe(1)
    expect(runCount(8)).toBe(2)
  })
})

describe('voronoi-diagram', () => {
  const random = rng(99)
  const pts: Pt[] = Array.from({ length: 80 }, () => [random() * 800, random() * 500])

  it('Bowyer–Watson triangles have empty circumcircles and cover the convex hull', () => {
    const tris = delaunay(pts)
    // A triangulation of n points with h on the hull has 2n − 2 − h triangles; h ≥ 3.
    expect(tris.length).toBeGreaterThan(80)
    expect(tris.length).toBeLessThanOrEqual(2 * 80 - 5)
    for (const [a, b, c] of tris) {
      const cc = circumcircle(pts[a], pts[b], pts[c])!
      for (let i = 0; i < pts.length; i++) {
        if (i === a || i === b || i === c) continue
        const d2 = (pts[i][0] - cc.x) ** 2 + (pts[i][1] - cc.y) ** 2
        expect(d2).toBeGreaterThanOrEqual(cc.r2 * (1 - 1e-9))
      }
    }
    expect(delaunay([[0, 0], [1, 0], [0, 1], [1, 1]])).toHaveLength(2)
  })

  it('Voronoi cells tile the rectangle and contain their own seed', () => {
    const cells = voronoiCells(pts, delaunay(pts), 800, 500)
    let area = 0
    cells.forEach((poly, i) => {
      let a = 0
      for (let k = 0; k < poly.length; k++) {
        const [x0, y0] = poly[k]
        const [x1, y1] = poly[(k + 1) % poly.length]
        a += x0 * y1 - x1 * y0
      }
      area += Math.abs(a) / 2
      // Every vertex is at least as close to its own seed as to any other seed.
      for (const v of poly) {
        const own = Math.hypot(v[0] - pts[i][0], v[1] - pts[i][1])
        for (const q of pts) expect(Math.hypot(v[0] - q[0], v[1] - q[1])).toBeGreaterThanOrEqual(own - 1e-6)
      }
    })
    expect(area).toBeCloseTo(800 * 500, 0)
  })

  it('clips half-planes and finds centroids', () => {
    const square: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]]
    const left = clipToward(square, [2, 5], [8, 5])
    expect(centroid(left)).toEqual([2.5, 5])
    expect(centroid(square)).toEqual([5, 5])
  })
})

describe('times-table-circle', () => {
  it('joins point i to i·k mod n on the circle', () => {
    expect(target(3, 2, 10)).toBe(6)
    expect(target(7, 2, 10)).toBe(4)
    expect(target(4, 2.5, 10)).toBe(0)
    const [x1, y1, x2, y2] = chord(0, 2, 10, 0, 0, 1)
    // Point 0 is on the left and maps to itself.
    expect(x1).toBeCloseTo(-1)
    expect(y1).toBeCloseTo(0)
    expect([x2, y2].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([x1, y1].map((v) => Math.round(v * 1e9) / 1e9))
    // Point 5 of 10 is diametrically opposite point 0; with k = 3 it maps to 15 mod 10 = 5 again.
    const c = chord(5, 3, 10, 0, 0, 1)
    expect(c[0]).toBeCloseTo(1)
    expect(c[2]).toBeCloseTo(1)
    for (let i = 0; i < 10; i++) {
      const [a, b, cc, d] = chord(i, 2.37, 10, 5, 5, 3)
      expect(Math.hypot(a - 5, b - 5)).toBeCloseTo(3)
      expect(Math.hypot(cc - 5, d - 5)).toBeCloseTo(3)
    }
  })

  it('names the epicycloids for whole-number k', () => {
    expect(curveName(2, 200)).toBe('Cardioid')
    expect(curveName(3, 200)).toBe('Nephroid')
    expect(curveName(6, 200)).toBe('Ranunculoid')
    expect(curveName(2.5, 200)).toBe('')
    expect(curveName(202, 200)).toBe('Cardioid')
  })
})

describe('phyllotaxis', () => {
  it('uses the golden angle 360°(2 − φ)', () => {
    const phi = (1 + Math.sqrt(5)) / 2
    expect(GOLDEN_ANGLE).toBeCloseTo(137.50776, 4)
    expect(GOLDEN_ANGLE).toBeCloseTo(360 * (2 - phi), 10)
    expect(GOLDEN_ANGLE).toBeCloseTo(360 / phi ** 2, 10)
  })

  it('places seed n at radius c√n and angle n·α', () => {
    const [x, y] = seedPosition(16, 90, 3)
    expect(Math.hypot(x, y)).toBeCloseTo(12)
    // 16 × 90° = 1440° = 4 full turns, so it sits on the positive x axis.
    expect(x).toBeCloseTo(12)
    expect(y).toBeCloseTo(0)
    expect(seedPosition(0, GOLDEN_ANGLE, 5)).toEqual([0, 0])
  })

  it('finds consecutive Fibonacci spiral counts for the golden angle', () => {
    for (const m of [100, 300, 900]) {
      const [a, b] = parastichies(m, GOLDEN_ANGLE)
      expect(isFibonacci(a) && isFibonacci(b)).toBe(true)
      expect(b / a).toBeCloseTo((1 + Math.sqrt(5)) / 2, 1)
    }
    // 90° puts seeds on four straight rays.
    expect(parastichies(400, 90)).toEqual([4, 0])
  })
})
