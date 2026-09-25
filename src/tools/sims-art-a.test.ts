import { describe, expect, it } from 'vitest'
import { symmetryPoints, runCount } from './kaleidoscope-draw/symmetry'
import { centroid, circumcircle, clipToward, delaunay, voronoiCells, type Pt } from './voronoi-diagram/voronoi'
import { rng } from '../sim/math'
import { chord, curveName, target } from './times-table-circle/times'
import { GOLDEN_ANGLE, isFibonacci, parastichies, seedPosition } from './phyllotaxis/phyllo'
import { cull, emit, makePool, stepPool, wellAccel } from './particle-playground/particles'
import { envelope, penAt, settleTime, swing, type Machine } from './harmonograph/harmonograph'
import { bandLevels, binFrequency, frequencyBin, logEdges, midiFrequency, noteName, peakFrequency, risingZero, rmsDb } from './audio-visualizer/analysis'
import { caseIndex, countBlobs, field, marchingSquares } from './metaballs/metaballs'
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

describe('particle-playground', () => {
  it('integrates velocity then position (semi-implicit Euler) under gravity and wind', () => {
    const p = makePool(4)
    emit(p, 0, 0, 10, 0, 5)
    stepPool(p, 0.1, { gravity: 20, wind: 5, drag: 0, wells: [] })
    expect(p.vx[0]).toBeCloseTo(10.5)
    expect(p.vy[0]).toBeCloseTo(2)
    expect(p.x[0]).toBeCloseTo(1.05)
    expect(p.y[0]).toBeCloseTo(0.2)
    expect(p.age[0]).toBeCloseTo(0.1)
  })

  it('culls particles past their lifetime and keeps the rest packed', () => {
    const p = makePool(10)
    emit(p, 1, 0, 0, 0, 0.15)
    emit(p, 2, 0, 0, 0, 1)
    emit(p, 3, 0, 0, 0, 0.15)
    emit(p, 4, 0, 0, 0, 1)
    const removed = stepPool(p, 0.2, { gravity: 0, wind: 0, drag: 0, wells: [] })
    expect(removed).toBe(2)
    expect(p.n).toBe(2)
    expect([p.x[0], p.x[1]].sort()).toEqual([2, 4])
    // The cap stops emission.
    expect(emit(p, 0, 0, 0, 0, 1, 2)).toBe(false)
    // Escaped particles go too.
    p.x[0] = 5000
    expect(cull(p, { w: 800, h: 500, margin: 50 })).toBe(1)
  })

  it('pulls towards attractors and pushes from repellers', () => {
    const [ax] = wellAccel({ x: 100, y: 0, strength: 1e6 }, 0, 0)
    const [rx] = wellAccel({ x: 100, y: 0, strength: -1e6 }, 0, 0)
    expect(ax).toBeGreaterThan(0)
    expect(rx).toBeCloseTo(-ax)
  })
})

describe('harmonograph', () => {
  const m: Machine = {
    x: { A: 1, f: 2, p: Math.PI / 2, d: 0.1 },
    y: { A: 0.5, f: 3, p: 0, d: 0.2 },
    table: { A: 0.3, f: 1, p: 0, d: 0.05 },
    rotary: true,
  }

  it('sums damped sines for the pen position', () => {
    const t = 1.3
    const [x, y] = penAt(m, t)
    const ex = Math.sin(2 * t + Math.PI / 2) * Math.exp(-0.1 * t) + 0.3 * Math.sin(t) * Math.exp(-0.05 * t)
    const ey = 0.5 * Math.sin(3 * t) * Math.exp(-0.2 * t) + 0.3 * Math.sin(t + Math.PI / 2) * Math.exp(-0.05 * t)
    expect(x).toBeCloseTo(ex, 12)
    expect(y).toBeCloseTo(ey, 12)
    // At t = 0 with these phases the pen starts at (A₁, A₃) on the rotary table.
    expect(penAt(m, 0)[0]).toBeCloseTo(1)
    expect(penAt(m, 0)[1]).toBeCloseTo(0.3)
  })

  it('decays exponentially', () => {
    const q = { A: 2, f: 5, p: Math.PI / 2, d: 0.5 }
    // Peaks of cos(5t) at t = 2π/5·k shrink by e^(−d t).
    const t = (2 * Math.PI) / 5
    expect(swing(q, t)).toBeCloseTo(2 * Math.exp(-0.5 * t))
    expect(envelope(m, 10)).toBeCloseTo(Math.exp(-0.05 * 10))
    // The slowest-damped pendulum sets the settle time: e^(−0.05 t) = 0.02.
    expect(settleTime(m, 0.02)).toBeCloseTo(Math.log(50) / 0.05)
  })
})

describe('audio-visualizer', () => {
  it('maps between FFT bins and frequencies', () => {
    expect(binFrequency(1, 48000, 2048)).toBeCloseTo(23.4375)
    expect(frequencyBin(440, 44100, 4096)).toBe(41)
    for (const f of [100, 440, 1234, 8000]) expect(Math.abs(binFrequency(frequencyBin(f, 48000, 4096), 48000, 4096) - f)).toBeLessThanOrEqual(48000 / 4096 / 2)
    const edges = logEdges(3, 10, 1000)
    expect(edges[0]).toBeCloseTo(10)
    expect(edges[1]).toBeCloseTo(46.4159, 3)
    expect(edges[3]).toBeCloseTo(1000)
  })

  it('names notes relative to A4 = 440 Hz', () => {
    expect(noteName(440)?.label).toBe('A4 +0¢')
    expect(noteName(261.63)?.name).toBe('C')
    expect(noteName(261.63)?.octave).toBe(4)
    expect(noteName(27.5)?.label).toBe('A0 +0¢')
    expect(noteName(446)?.cents).toBe(23)
    expect(noteName(0)).toBeNull()
    expect(midiFrequency(69)).toBe(440)
    expect(midiFrequency(81)).toBeCloseTo(880)
  })

  it('finds the dominant frequency and level of a test tone', () => {
    const sr = 48000
    const fft = 4096
    const f0 = 1000
    // A peak between bins, shaped like a parabola in dB, is refined past the bin grid.
    const db = new Float32Array(fft / 2).fill(-120)
    const centre = (f0 * fft) / sr
    for (let i = Math.floor(centre) - 3; i <= Math.ceil(centre) + 3; i++) db[i] = -20 - 4 * (i - centre) ** 2
    expect(peakFrequency(db, sr, fft)).toBeCloseTo(f0, 3)
    expect(peakFrequency(new Float32Array(100).fill(-140), sr, fft)).toBe(0)
    const levels = bandLevels(db, logEdges(8, 30, 16000), sr, fft, new Float32Array(8))
    expect(Math.max(...levels)).toBeGreaterThan(-21)
    // A full-scale sine has an RMS of 1/√2, about −3 dBFS.
    const sine = Float32Array.from({ length: 4800 }, (_, i) => Math.sin((i / sr) * 2 * Math.PI * 100))
    expect(rmsDb(sine)).toBeCloseTo(-3.0103, 2)
    expect(risingZero(Float32Array.from([0.5, -0.2, -0.1, 0.3, 0.6, 0.1, -0.4, -0.5]))).toBe(3)
  })
})

describe('metaballs', () => {
  const ball = (x: number, y: number, r: number) => ({ x, y, r, vx: 0, vy: 0 })

  it('sums r²/d² so a lone ball has field 1 on its rim', () => {
    const one = [ball(0, 0, 10)]
    expect(field(one, 10, 0)).toBeCloseTo(1)
    expect(field(one, 0, 5)).toBeCloseTo(4)
    expect(field(one, 20, 0)).toBeCloseTo(0.25)
    // Two balls add, so the midpoint between close balls is inside the merged blob.
    const two = [ball(-12, 0, 10), ball(12, 0, 10)]
    expect(field(two, 0, 0)).toBeCloseTo(2 * (100 / 144))
    expect(field(two, 0, 0)).toBeGreaterThan(1)
  })

  it('computes marching-squares case indices from the corners', () => {
    expect(caseIndex(0, 0, 0, 0, 1)).toBe(0)
    expect(caseIndex(2, 2, 2, 2, 1)).toBe(15)
    expect(caseIndex(2, 0, 0, 0, 1)).toBe(8)
    expect(caseIndex(0, 2, 0, 0, 1)).toBe(4)
    expect(caseIndex(0, 0, 2, 0, 1)).toBe(2)
    expect(caseIndex(0, 0, 0, 2, 1)).toBe(1)
    expect(caseIndex(2, 0, 2, 0, 1)).toBe(10)
  })

  it('traces a closed contour close to the rim of a single ball', () => {
    const cols = 40
    const rows = 40
    const cell = 5
    const grid = new Float32Array((cols + 1) * (rows + 1))
    const one = [ball(100, 100, 50)]
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) grid[j * (cols + 1) + i] = field(one, i * cell, j * cell)
    const segs = marchingSquares(grid, cols, rows, cell, 1)
    expect(segs.length).toBeGreaterThan(40)
    for (let s = 0; s < segs.length; s += 2) expect(Math.hypot(segs[s] - 100, segs[s + 1] - 100)).toBeCloseTo(50, -0.5)
    expect(countBlobs(grid, cols, rows, 1)).toBe(1)
    const two = [ball(40, 40, 15), ball(160, 160, 15)]
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) grid[j * (cols + 1) + i] = field(two, i * cell, j * cell)
    expect(countBlobs(grid, cols, rows, 1)).toBe(2)
  })
})
