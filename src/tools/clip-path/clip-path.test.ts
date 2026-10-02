import { describe, expect, it } from 'vitest'
import { PRESETS, addMidpoint, insertPoint, removePoint, snap, toCss, type Pt } from './shapes'

const shape = (name: string) => PRESETS.find((p) => p.name === name)!.shape

describe('clip-path serializer', () => {
  it('serializes polygons, circles, ellipses and insets', () => {
    expect(toCss(shape('Triangle'))).toBe('polygon(50% 0%, 100% 100%, 0% 100%)')
    expect(toCss(shape('Circle'))).toBe('circle(50% at 50% 50%)')
    expect(toCss(shape('Ellipse'))).toBe('ellipse(50% 35% at 50% 50%)')
    expect(toCss(shape('Inset'))).toBe('inset(10% 10% 10% 10% round 24px)')
    expect(toCss({ kind: 'inset', top: 5, right: 0, bottom: 5, left: 0, round: 0 })).toBe('inset(5% 0% 5% 0%)')
  })

  it('rounds to one decimal', () => {
    expect(toCss({ kind: 'polygon', points: [{ x: 33.333, y: 0 }, { x: 66.66, y: 12.05 }, { x: 0, y: 100 }] })).toBe('polygon(33.3% 0%, 66.7% 12.1%, 0% 100%)')
  })

  it('has every requested preset', () => {
    const names = PRESETS.map((p) => p.name)
    for (const n of ['Triangle', 'Trapezoid', 'Parallelogram', 'Rhombus', 'Pentagon', 'Hexagon', 'Octagon', 'Star', 'Arrow', 'Chevron', 'Message', 'Circle', 'Ellipse', 'Inset']) expect(names).toContain(n)
    const star = shape('Star')
    expect(star.kind === 'polygon' && star.points.length).toBe(10)
  })
})

describe('point editing', () => {
  const square: Pt[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]

  it('snaps and clamps', () => {
    expect(snap(47, 5)).toBe(45)
    expect(snap(48, 5)).toBe(50)
    expect(snap(-3, 5)).toBe(0)
    expect(snap(120, 0)).toBe(100)
    expect(snap(12.345, 0)).toBe(12.3)
  })

  it('inserts a point into the nearest edge', () => {
    const { points, index } = insertPoint(square, { x: 100, y: 40 })
    expect(index).toBe(2)
    expect(points[2]).toEqual({ x: 100, y: 40 })
    expect(points).toHaveLength(5)
  })

  it('adds a midpoint on the longest edge', () => {
    const tri: Pt[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 100 }]
    const { points, index } = addMidpoint(tri)
    expect(index).toBe(2)
    expect(points[2]).toEqual({ x: 5, y: 50 })
  })

  it('never removes below three points', () => {
    expect(removePoint(square, 1)).toHaveLength(3)
    const tri = square.slice(0, 3)
    expect(removePoint(tri, 0)).toBe(tri)
  })
})
