import { describe, expect, it } from 'vitest'
import { CSS_COLORS, hexToRgb, nearestName, nearestNames, rgbDistance } from './names'

describe('color name finder', () => {
  it('holds a full CSS color table', () => {
    expect(Object.keys(CSS_COLORS).length).toBeGreaterThanOrEqual(140)
    expect(CSS_COLORS.red).toBe('#ff0000')
    expect(CSS_COLORS.rebeccapurple).toBe('#663399')
  })

  it('parses hex in several lengths', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 })
    expect(hexToRgb('#ff0000ff')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('#12345')).toBeNull()
    expect(hexToRgb('nope')).toBeNull()
  })

  it('measures distance', () => {
    expect(rgbDistance({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(0)
    expect(rgbDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeGreaterThan(0)
  })

  it('finds the exact name for pure colors', () => {
    expect(nearestName(255, 0, 0)).toEqual({ name: 'red', hex: '#ff0000', distance: 0 })
    expect(nearestName(0, 0, 0).name).toBe('black')
    expect(nearestName(255, 255, 255).name).toBe('white')
  })

  it('ranks the nearest names by distance', () => {
    const list = nearestNames(0, 0, 0, 3)
    expect(list).toHaveLength(3)
    expect(list[0].name).toBe('black')
    for (let i = 1; i < list.length; i++) expect(list[i].distance).toBeGreaterThanOrEqual(list[i - 1].distance)
  })

  it('clamps odd input and honours a zero count', () => {
    expect(nearestNames(-50, -50, -50, 1)[0].name).toBe('black')
    expect(nearestNames(10, 20, 30, 0)).toEqual([])
    expect(nearestNames(10, 20, 30, 5)).toHaveLength(5)
  })
})
