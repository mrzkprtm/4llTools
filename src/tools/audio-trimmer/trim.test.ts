import { describe, expect, it } from 'vitest'
import { clampRange, computePeaks, cutStats, formatRange } from './trim'

describe('clampRange', () => {
  it('keeps a valid range untouched', () => {
    expect(clampRange(1, 3, 10)).toEqual({ start: 1, end: 3 })
  })

  it('clamps negatives to zero and end to duration', () => {
    expect(clampRange(-2, 99, 10)).toEqual({ start: 0, end: 10 })
  })

  it('forces start before end', () => {
    expect(clampRange(8, 3, 10)).toEqual({ start: 8, end: 8 })
  })

  it('handles a zero duration', () => {
    expect(clampRange(1, 2, 0)).toEqual({ start: 0, end: 0 })
  })
})

describe('formatRange', () => {
  it('formats both endpoints', () => {
    expect(formatRange(12, 105)).toBe('0:12 – 1:45')
  })
})

describe('cutStats', () => {
  it('computes length and share of the original', () => {
    expect(cutStats(10, { start: 2, end: 7 })).toEqual({ length: 5, pct: 50 })
  })

  it('returns zero pct for a zero-length original', () => {
    expect(cutStats(0, { start: 0, end: 0 })).toEqual({ length: 0, pct: 0 })
  })
})

describe('computePeaks', () => {
  it('buckets min and max values', () => {
    const data = Float32Array.from([0.5, -0.25, 0.9, -0.9, 0.1, 0.2, -0.1, 0.4])
    const peaks = computePeaks(data, 4)
    expect(peaks).toHaveLength(4)
    expect(peaks[1].max).toBeCloseTo(0.9)
    expect(peaks[1].min).toBeCloseTo(-0.9)
  })

  it('returns empty for zero buckets', () => {
    expect(computePeaks(Float32Array.from([1, 2]), 0)).toEqual([])
  })

  it('handles fewer samples than buckets', () => {
    const peaks = computePeaks(Float32Array.from([0.3]), 8)
    expect(peaks).toHaveLength(8)
    expect(peaks[0].max).toBeCloseTo(0.3)
  })
})
