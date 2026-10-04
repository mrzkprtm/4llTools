import { describe, expect, it } from 'vitest'
import { BUCKETS, buildHistogram, luminance, stats, type Histogram } from './histogram'

const empty = (): Histogram => ({ r: new Array(256).fill(0), g: new Array(256).fill(0), b: new Array(256).fill(0), lum: new Array(256).fill(0) })

describe('luminance', () => {
  it('covers the full range for black and white', () => {
    expect(luminance(0, 0, 0)).toBe(0)
    expect(luminance(255, 255, 255)).toBe(255)
  })

  it('weighs green heaviest and blue lightest', () => {
    expect(luminance(255, 0, 0)).toBe(54)
    expect(luminance(0, 255, 0)).toBe(182)
    expect(luminance(0, 0, 255)).toBe(18)
  })
})

describe('buildHistogram', () => {
  it('returns 256 buckets for every channel', () => {
    const hist = buildHistogram([])
    for (const channel of [hist.r, hist.g, hist.b, hist.lum]) {
      expect(channel).toHaveLength(BUCKETS)
      expect(channel.every((n) => n === 0)).toBe(true)
    }
  })

  it('counts each pixel once per channel', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255, 10, 20, 30, 255, 200, 100, 50, 255])
    const hist = buildHistogram(data)
    expect(hist.r[10]).toBe(2)
    expect(hist.r[200]).toBe(1)
    expect(hist.g[20]).toBe(2)
    expect(hist.b[30]).toBe(2)
    expect(hist.b[50]).toBe(1)
    expect(hist.r.reduce((n, v) => n + v, 0)).toBe(3)
    expect(hist.lum.reduce((n, v) => n + v, 0)).toBe(3)
  })

  it('skips fully transparent pixels', () => {
    const data = new Uint8ClampedArray([255, 255, 255, 0, 0, 0, 0, 255])
    const hist = buildHistogram(data)
    expect(hist.lum[255]).toBe(0)
    expect(hist.lum[0]).toBe(1)
  })

  it('ignores a trailing partial pixel and clamps odd values', () => {
    const hist = buildHistogram([300, -20, 40, 255, 9, 9, 9])
    expect(hist.r[255]).toBe(1)
    expect(hist.g[0]).toBe(1)
    expect(hist.r.reduce((n, v) => n + v, 0)).toBe(1)
  })
})

describe('stats', () => {
  it('reports zeros for an empty histogram', () => {
    expect(stats(empty())).toEqual({ mean: 0, median: 0, shadowsClipped: 0, highlightsClipped: 0 })
  })

  it('finds the mean and median of a flat tone', () => {
    const hist = empty()
    hist.lum[128] = 400
    const s = stats(hist)
    expect(s.mean).toBe(128)
    expect(s.median).toBe(128)
    expect(s.shadowsClipped).toBe(0)
    expect(s.highlightsClipped).toBe(0)
  })

  it('measures the share of clipped shadows and highlights', () => {
    const hist = empty()
    hist.lum[0] = 3
    hist.lum[255] = 1
    const s = stats(hist)
    expect(s.shadowsClipped).toBeCloseTo(75)
    expect(s.highlightsClipped).toBeCloseTo(25)
    expect(s.mean).toBeCloseTo(63.75)
    expect(s.median).toBe(0)
  })

  it('walks up to the bucket that crosses the half way point', () => {
    const hist = empty()
    hist.lum[10] = 30
    hist.lum[200] = 70
    const s = stats(hist)
    expect(s.median).toBe(200)
    expect(s.mean).toBeCloseTo(143)
    expect(s.shadowsClipped).toBe(0)
    expect(s.highlightsClipped).toBe(0)
  })
})
