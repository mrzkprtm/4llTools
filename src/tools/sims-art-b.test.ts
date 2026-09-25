import { describe, expect, it } from 'vitest'
import { EMPTY, SAND, STONE, WATER, makeGrid, place, step } from './falling-sand/sand'
import { makeSwarm, retarget, sampleText, stepSwarm } from './text-particles/particles'
import { addDrop, stepWave, waveEnergy } from './water-ripples/ripples'
import { fbm, project } from './terrain-generator/terrain'
import { makeNoise, rng } from '../sim/math'
import { maurer, polar, rosePeriod, rosePetals } from './rose-curves/rose'
import { buildCurve, hilbertD2xy, hilbertXy2d, mortonD2xy } from './space-filling-curves/curves'
import { coverage, makePacker, stepPacker } from './circle-packing/packing'
import { BURSTS, SPLIT, addParticle, burstVelocities, launchVelocity, makeParticles, stepParticles } from './fireworks/fireworks'
import { makeColumn, parseGlyphs, restart, spell, stepColumn } from './matrix-rain/rain'
import { arcPoint, cornerColor, orientations, tileArcs } from './truchet-tiles/truchet'

describe('falling-sand', () => {
  const fixed = () => 0.1

  it('drops sand one cell per tick', () => {
    const g = makeGrid(5, 5)
    place(g, 2, SAND, fixed)
    step(g, fixed)
    expect(g.mat[2]).toBe(EMPTY)
    expect(g.mat[5 + 2]).toBe(SAND)
  })

  it('spreads water sideways along the floor', () => {
    const g = makeGrid(7, 3)
    const i = 2 * 7 + 3
    place(g, i, WATER, fixed)
    step(g, fixed)
    expect(g.mat[i]).toBe(EMPTY)
    const row = Array.from(g.mat.subarray(14, 21))
    expect(row.filter((m) => m === WATER)).toHaveLength(1)
  })

  it('lets sand sink through water by swapping places', () => {
    const g = makeGrid(3, 2)
    place(g, 0, STONE, fixed)
    place(g, 2, STONE, fixed)
    place(g, 3, STONE, fixed)
    place(g, 5, STONE, fixed)
    place(g, 1, SAND, fixed)
    place(g, 4, WATER, fixed)
    step(g, fixed)
    expect(g.mat[4]).toBe(SAND)
    expect(g.mat[1]).toBe(WATER)
  })
})

describe('truchet-tiles', () => {
  it('derives the same orientations from the same seed', () => {
    const a = orientations(12, 8, 42, 2)
    expect(Array.from(orientations(12, 8, 42, 2))).toEqual(Array.from(a))
    expect(Array.from(orientations(12, 8, 43, 2))).not.toEqual(Array.from(a))
    expect(a.every((o) => o === 0 || o === 1)).toBe(true)
    expect(Array.from(orientations(6, 6, 1, 4)).some((o) => o > 1)).toBe(true)
  })

  it('ends every arc at an edge midpoint, using each midpoint once, so neighbours join up', () => {
    const s = 40
    const key = ([x, y]: [number, number]) => `${Math.round(x * 1e6) / 1e6},${Math.round(y * 1e6) / 1e6}`
    for (const o of [0, 1]) {
      const ends = tileArcs(o, s).flatMap((a) => [arcPoint(a, a.a0), arcPoint(a, a.a1)].map(key))
      expect(ends.sort()).toEqual(['0,20', '20,0', '20,40', '40,20'].sort())
    }
    // A tile's right-edge endpoint is exactly its right neighbour's left-edge endpoint.
    for (const a of [0, 1])
      for (const b of [0, 1]) {
        const right = tileArcs(a, s).flatMap((c) => [arcPoint(c, c.a0), arcPoint(c, c.a1)]).filter(([x]) => Math.abs(x - s) < 1e-9)
        const left = tileArcs(b, s).flatMap((c) => [arcPoint(c, c.a0), arcPoint(c, c.a1)]).filter(([x]) => Math.abs(x) < 1e-9).map(([x, y]) => [x + s, y] as [number, number])
        expect(right.map(key)).toEqual(left.map(key))
      }
  })

  it('two-colours any arrangement consistently across shared edges', () => {
    const cols = 9
    const rows = 7
    const o = orientations(cols, rows, 5, 2)
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols - 1; i++) {
        const a = o[j * cols + i]
        const b = o[j * cols + i + 1]
        for (const cy of [j, j + 1]) expect(cornerColor(i, j, a, i + 1, cy)).toBe(cornerColor(i + 1, j, b, i + 1, cy))
      }
  })
})

describe('text-particles', () => {
  it('samples only pixels inside the drawn text', () => {
    const w = 40
    const h = 20
    const data = new Uint8ClampedArray(w * h * 4)
    // A fake "glyph": an opaque block from x 10–29, y 5–14.
    for (let y = 5; y < 15; y++) for (let x = 10; x < 30; x++) data[(y * w + x) * 4 + 3] = 255
    const pts = sampleText(data, w, h, 2)
    expect(pts.length / 2).toBe(10 * 5)
    for (let i = 0; i < pts.length; i += 2) {
      expect(pts[i]).toBeGreaterThanOrEqual(10)
      expect(pts[i]).toBeLessThan(30)
      expect(pts[i + 1]).toBeGreaterThanOrEqual(5)
      expect(pts[i + 1]).toBeLessThan(15)
    }
    expect(sampleText(new Uint8ClampedArray(w * h * 4), w, h, 2)).toHaveLength(0)
  })

  it('springs particles onto their targets and fades out spares', () => {
    const s = makeSwarm(10)
    retarget(s, [100, 50, 120, 50], () => [0, 0, 0])
    expect(s.n).toBe(2)
    for (let k = 0; k < 600; k++) stepSwarm(s, 1 / 60, { stiffness: 40, damping: 8, px: null, py: 0, radius: 50, force: 0 })
    expect(s.x[0]).toBeCloseTo(100, 1)
    expect(s.y[0]).toBeCloseTo(50, 1)
    retarget(s, [10, 10], () => [0, 0, 0])
    for (let k = 0; k < 120; k++) stepSwarm(s, 1 / 60, { stiffness: 40, damping: 8, px: null, py: 0, radius: 50, force: 0 })
    expect(s.n).toBe(1)
    expect(s.tx[0]).toBe(10)
  })
})

describe('water-ripples', () => {
  const w = 40
  const h = 30
  function pond() {
    let cur = new Float32Array(w * h)
    let prev = new Float32Array(w * h)
    addDrop(cur, w, h, 20, 15, 4, 1)
    addDrop(prev, w, h, 20, 15, 4, 1)
    return {
      step(d: number) {
        stepWave(cur, prev, w, h, d)
        ;[cur, prev] = [prev, cur]
      },
      energy: () => waveEnergy(cur, prev, w, h),
      cur: () => cur,
    }
  }

  it('conserves the scheme energy without damping and loses energy every step with it', () => {
    const a = pond()
    a.step(1)
    const e0 = a.energy()
    expect(e0).toBeGreaterThan(0)
    for (let k = 0; k < 200; k++) a.step(1)
    expect(a.energy()).toBeCloseTo(e0, 6)
    const b = pond()
    b.step(0.98)
    let last = b.energy()
    for (let k = 0; k < 100; k++) {
      b.step(0.98)
      const e = b.energy()
      expect(e).toBeLessThan(last)
      last = e
    }
  })

  it('holds the border at zero so waves reflect instead of leaking', () => {
    const a = pond()
    for (let k = 0; k < 300; k++) a.step(0.995)
    const c = a.cur()
    for (let x = 0; x < w; x++) {
      expect(c[x]).toBe(0)
      expect(c[(h - 1) * w + x]).toBe(0)
    }
    for (let y = 0; y < h; y++) {
      expect(c[y * w]).toBe(0)
      expect(c[y * w + w - 1]).toBe(0)
    }
    expect(c.every(Number.isFinite)).toBe(true)
  })
})

describe('terrain-generator', () => {
  const opts = { octaves: 6, persistence: 0.55, lacunarity: 2.1 }

  it('makes the same terrain from the same seed and different terrain from another', () => {
    const a = makeNoise(99)
    const b = makeNoise(99)
    const c = makeNoise(100)
    const pts = Array.from({ length: 50 }, (_, i) => [i * 0.37, i * 0.21 - 3] as const)
    expect(pts.map(([x, y]) => fbm(a, x, y, opts))).toEqual(pts.map(([x, y]) => fbm(b, x, y, opts)))
    expect(pts.map(([x, y]) => fbm(a, x, y, opts))).not.toEqual(pts.map(([x, y]) => fbm(c, x, y, opts)))
  })

  it('stays within [-1, 1] for any octave settings', () => {
    const n = makeNoise(5)
    let lo = Infinity
    let hi = -Infinity
    for (const o of [opts, { octaves: 1, persistence: 0.5, lacunarity: 2 }, { octaves: 8, persistence: 0.8, lacunarity: 3 }])
      for (let i = 0; i < 4000; i++) {
        const v = fbm(n, (i % 71) * 0.173, Math.floor(i / 71) * 0.191, o)
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
    expect(lo).toBeGreaterThanOrEqual(-1)
    expect(hi).toBeLessThanOrEqual(1)
    expect(hi - lo).toBeGreaterThan(0.5)
  })

  it('projects farther points closer to the horizon', () => {
    const cam = { x: 0, y: 50, z: 0, f: 400, cx: 400, horizon: 200 }
    const near = project(cam, 0, 0, 100)!
    const far = project(cam, 0, 0, 1000)!
    expect(near[1]).toBeGreaterThan(far[1])
    expect(far[1]).toBeGreaterThan(200)
    expect(project(cam, 0, 0, -5)).toBeNull()
  })
})

describe('rose-curves', () => {
  it('counts petals: k odd gives k, k even gives 2k, and n/d follows the same parity rule', () => {
    expect(rosePetals(3, 1)).toBe(3)
    expect(rosePetals(5, 1)).toBe(5)
    expect(rosePetals(2, 1)).toBe(4)
    expect(rosePetals(4, 1)).toBe(8)
    expect(rosePetals(4, 2)).toBe(4) // 4/2 reduces to 2
    expect(rosePetals(5, 4)).toBe(10)
    expect(rosePetals(7, 3)).toBe(7)
  })

  it('closes after exactly the reported period and not before', () => {
    const at = (n: number, d: number, t: number) => [Math.cos((n / d) * t) * Math.cos(t), Math.cos((n / d) * t) * Math.sin(t)]
    const same = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9
    for (const [n, d] of [[1, 1], [2, 1], [3, 1], [5, 4], [7, 3], [2, 3], [1, 2]]) {
      const m = rosePeriod(n, d)
      const e = 0.01
      expect(same(at(n, d, m * Math.PI), at(n, d, 0)) && same(at(n, d, m * Math.PI + e), at(n, d, e))).toBe(true)
      for (let k = 1; k < m; k++) expect(same(at(n, d, k * Math.PI), at(n, d, 0)) && same(at(n, d, k * Math.PI + e), at(n, d, e))).toBe(false)
    }
    expect(rosePeriod(3, 1)).toBe(1)
    expect(rosePeriod(5, 4)).toBe(8)
    expect(polar('rose', 5, 4).span).toBeCloseTo(8 * Math.PI)
  })

  it('builds a Maurer rose from one point per degree step', () => {
    const pts = maurer(polar('rose', 2, 1), 39)
    expect(pts.length / 2).toBe(361)
    expect(pts[0]).toBeCloseTo(1)
    expect(pts[1]).toBeCloseTo(0)
    const t = (39 * Math.PI) / 180
    expect(pts[2]).toBeCloseTo(Math.cos(2 * t) * Math.cos(t))
  })
})

describe('space-filling-curves', () => {
  it('round-trips Hilbert index ↔ cell', () => {
    for (const N of [2, 4, 16, 64])
      for (let d = 0; d < N * N; d++) {
        const [x, y] = hilbertD2xy(N, d)
        expect(hilbertXy2d(N, x, y)).toBe(d)
      }
    expect(mortonD2xy(0b1101)).toEqual([0b11, 0b10])
  })

  it('visits every cell exactly once, moving to a neighbouring cell each step', () => {
    for (const [kind, order] of [['hilbert', 5], ['moore', 4], ['peano', 3], ['zorder', 3]] as const) {
      const c = buildCurve(kind, order)
      const seen = new Set<string>()
      for (let i = 0; i < c.pts.length; i += 2) seen.add(`${c.pts[i]},${c.pts[i + 1]}`)
      expect(seen.size).toBe(c.n * c.n)
      expect(c.pts.length / 2).toBe(c.n * c.n)
      if (kind === 'zorder') continue
      for (let i = 2; i < c.pts.length; i += 2) expect(Math.abs(c.pts[i] - c.pts[i - 2]) + Math.abs(c.pts[i + 1] - c.pts[i - 1])).toBe(1)
    }
    expect(buildCurve('peano', 2).n).toBe(9)
    const moore = buildCurve('moore', 3)
    const last = moore.pts.length - 2
    // The Moore curve is a closed loop.
    expect(Math.abs(moore.pts[last] - moore.pts[0]) + Math.abs(moore.pts[last + 1] - moore.pts[1])).toBe(1)
  })

  it('coarsens order n into order n − 1, which is what the morph animation relies on', () => {
    for (const [kind, order, f] of [['hilbert', 5, 2], ['moore', 4, 2], ['peano', 3, 3]] as const) {
      const fine = buildCurve(kind, order).pts
      const coarse = buildCurve(kind, order - 1).pts
      const seq: string[] = []
      for (let i = 0; i < fine.length; i += 2) {
        const key = `${Math.floor(fine[i] / f)},${Math.floor(fine[i + 1] / f)}`
        if (seq[seq.length - 1] !== key) seq.push(key)
      }
      const want: string[] = []
      for (let i = 0; i < coarse.length; i += 2) want.push(`${coarse[i]},${coarse[i + 1]}`)
      expect(seq).toEqual(want)
    }
  })

  it('builds the Gosper curve with 7^n segments', () => {
    expect(buildCurve('gosper', 2).pts.length / 2).toBe(7 ** 2 + 1)
  })
})

describe('circle-packing', () => {
  function run(inside?: (x: number, y: number) => boolean) {
    const random = rng(12)
    const p = makePacker({ w: 300, h: 200, minR: 2, maxR: 30, spacing: 1.5, inside })
    for (let k = 0; k < 3000 && p.idle < 40; k++) stepPacker(p, random, 1.5, 8, 60)
    return p
  }

  it('grows circles that never overlap each other or the edges', () => {
    const p = run()
    const cs = p.circles
    expect(cs.length).toBeGreaterThan(100)
    expect(cs.every((c) => !c.growing)).toBe(true)
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i]
      expect(a.x - a.r).toBeGreaterThanOrEqual(-1e-9)
      expect(a.y + a.r).toBeLessThanOrEqual(200 + 1e-9)
      expect(a.r).toBeLessThanOrEqual(30)
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j]
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r + 1.5 - 1e-9)
      }
    }
    // Growth packs the space densely.
    expect(coverage(cs, 300 * 200)).toBeGreaterThan(0.5)
  })

  it('keeps every circle inside a mask shape', () => {
    const inside = (x: number, y: number) => Math.hypot(x - 150, y - 100) < 80
    const p = run(inside)
    for (const c of p.circles) expect(Math.hypot(c.x - 150, c.y - 100) + c.r).toBeLessThanOrEqual(80.5)
  })

  it('computes coverage as circle area over total area', () => {
    expect(coverage([{ r: 1 }, { r: 2 }], 5 * Math.PI)).toBeCloseTo(1)
    expect(coverage([], 100)).toBe(0)
  })
})

describe('fireworks', () => {
  it('makes the requested number of stars with speeds in range, and rings at one exact speed', () => {
    const random = rng(4)
    for (const type of BURSTS) {
      const v = burstVelocities(type, 64, 150, random)
      expect(v.length).toBe(128)
      expect(v.every(Number.isFinite)).toBe(true)
    }
    const peony = burstVelocities('peony', 500, 150, random)
    for (let i = 0; i < 500; i++) expect(Math.hypot(peony[2 * i], peony[2 * i + 1])).toBeLessThanOrEqual(150 + 1e-6)
    const ring = burstVelocities('ring', 90, 160, random)
    for (let i = 0; i < 90; i++) expect(Math.hypot(ring[2 * i], ring[2 * i + 1])).toBeCloseTo(160, 3)
    // A ring's stars are spread evenly, so their velocities cancel out.
    let sx = 0
    let sy = 0
    for (let i = 0; i < 90; i++) {
      sx += ring[2 * i]
      sy += ring[2 * i + 1]
    }
    expect(Math.hypot(sx, sy)).toBeLessThan(1e-3)
  })

  it('launches rockets that peak at the target point', () => {
    const g = 90
    const [vx, vy] = launchVelocity(100, 500, 300, 120, g)
    let x = 100
    let y = 500
    let v = vy
    const dt = 1e-4
    while (v < 0) {
      v += g * dt
      x += vx * dt
      y += v * dt
    }
    expect(x).toBeCloseTo(300, 0)
    expect(y).toBeCloseTo(120, 0)
  })

  it('splits crossette stars into four when they burn out', () => {
    const p = makeParticles(100)
    addParticle(p, 0, 0, 10, 0, 0.05, 0, 1, SPLIT)
    stepParticles(p, 0.1, 0, 1, rng(1))
    expect(p.n).toBe(4)
  })
})

describe('matrix-rain', () => {
  it('parses glyph sets and cleans custom strings', () => {
    expect(parseGlyphs('binary')).toEqual(['0', '1'])
    expect(parseGlyphs('digits')).toHaveLength(10)
    expect(parseGlyphs('latin')[25]).toBe('Z')
    const kata = parseGlyphs('katakana')
    expect(kata).toContain('ｱ')
    expect(kata.length).toBeGreaterThan(50)
    expect(parseGlyphs('custom', 'ab 😀c\taé👍🏽b')).toEqual(['a', 'b', 'c', 'é'])
    expect(parseGlyphs('custom', '  🎉 ')).toEqual(['0', '1'])
  })

  it('moves the head down by speed × dt and queues a new drop after it leaves the screen', () => {
    const random = rng(3)
    const c = makeColumn(30, ['x'], random)
    restart(c, 30, random, 1)
    c.wait = 0
    c.y = 5
    c.speed = 10
    expect(stepColumn(c, 0.5, 30, random, 1)).toBe(false)
    expect(c.y).toBeCloseTo(10)
    c.y = 30 + c.len - 0.1
    expect(stepColumn(c, 0.1, 30, random, 1)).toBe(true)
    expect(c.y).toBeLessThanOrEqual(0)
    // At low density the next drop waits before it starts.
    restart(c, 30, () => 0.9, 0.2)
    expect(c.wait).toBeGreaterThan(0)
    const y = c.y
    stepColumn(c, 0.1, 30, random, 0.2)
    expect(c.y).toBe(y)
  })

  it('writes a message word into the column', () => {
    const c = makeColumn(20, ['x'], rng(1))
    spell(c, 'NEO', 20)
    expect(c.glyphs.slice(c.msgRow, c.msgRow + 3).join('')).toBe('NEO')
    expect(c.len).toBeGreaterThanOrEqual(3)
  })
})
