import { describe, expect, it } from 'vitest'
import { EMPTY, SAND, STONE, WATER, makeGrid, place, step } from './falling-sand/sand'
import { makeSwarm, retarget, sampleText, stepSwarm } from './text-particles/particles'
import { addDrop, stepWave, waveEnergy } from './water-ripples/ripples'
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
