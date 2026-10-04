import { describe, expect, it } from 'vitest'
import { blobPoints, seededRandom, smoothPath } from './blob'

describe('svg blob', () => {
  it('repeats a seed and stays in range', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    for (let i = 0; i < 5; i++) expect(a()).toBe(b())
    const r = seededRandom(7)
    for (let i = 0; i < 200; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    expect(seededRandom(1)()).toBe(seededRandom(1)())
  })

  it('spaces points evenly around the circle', () => {
    const pts = blobPoints(6, 100, 0, () => 0.5)
    expect(pts).toHaveLength(6)
    expect(pts[0]).toEqual({ x: 100, y: 0 })
    expect(pts[1].x).toBeCloseTo(50)
    expect(pts[1].y).toBeCloseTo(86.6)
    expect(pts[3].x).toBeCloseTo(-100)
  })

  it('clamps the point count', () => {
    expect(blobPoints(1, 50, 0, () => 0.5)).toHaveLength(3)
    expect(blobPoints(100, 50, 0, () => 0.5)).toHaveLength(24)
  })

  it('is deterministic for a given seed', () => {
    const p1 = blobPoints(8, 80, 0.3, seededRandom(11))
    const p2 = blobPoints(8, 80, 0.3, seededRandom(11))
    expect(p1).toEqual(p2)
    expect(p1).not.toEqual(blobPoints(8, 80, 0.3, seededRandom(12)))
  })

  it('rejects too few points', () => {
    expect(smoothPath([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe('')
    expect(smoothPath([])).toBe('')
  })

  it('draws a closed cubic-bezier path', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const d = smoothPath(square)
    expect(d).toBe(
      'M 0 0 C 1.67 -1.67 8.33 -1.67 10 0 C 11.67 1.67 11.67 8.33 10 10 C 8.33 11.67 1.67 11.67 0 10 C -1.67 8.33 -1.67 1.67 0 0 Z',
    )
    expect(d.match(/C/g)).toHaveLength(4)
    expect(d.endsWith('Z')).toBe(true)
  })
})
