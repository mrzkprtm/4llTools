import { describe, expect, it } from 'vitest'
import { dbToGain, gainToDb, normalizePlan, recommendedGain, TARGETS } from './normalize'

describe('db <-> gain', () => {
  it('round-trips', () => {
    expect(dbToGain(0)).toBe(1)
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3)
    expect(gainToDb(1)).toBe(0)
    expect(gainToDb(2)).toBeCloseTo(6.02, 2)
  })

  it('handles zero and negative gains', () => {
    expect(gainToDb(0)).toBe(-Infinity)
    expect(recommendedGain(0, -1)).toBe(1)
  })
})

describe('recommendedGain', () => {
  it('boosts a quiet file up to the target', () => {
    expect(recommendedGain(0.25, 0)).toBeCloseTo(4)
  })

  it('attenuates a file that is too loud', () => {
    expect(recommendedGain(1, -6)).toBeCloseTo(0.501, 3)
  })
})

describe('normalizePlan', () => {
  it('reports the peak, target and gain', () => {
    const plan = normalizePlan(0.5, -3)
    expect(plan.peakDb).toBeCloseTo(-6.02, 2)
    expect(plan.outPeakDb).toBe(-3)
    expect(plan.gain).toBeGreaterThan(1)
    expect(plan.alreadyNormalized).toBe(false)
  })

  it('flags files already at the target', () => {
    const plan = normalizePlan(dbToGain(-3), -3)
    expect(plan.alreadyNormalized).toBe(true)
    expect(plan.gain).toBeCloseTo(1)
  })

  it('handles digital silence', () => {
    const plan = normalizePlan(0, -1)
    expect(plan.peakDb).toBe(-Infinity)
    expect(plan.gain).toBe(1)
  })
})

describe('TARGETS', () => {
  it('lists descending targets', () => {
    expect(TARGETS.map((t) => t.db)).toEqual([-1, -3, -6])
  })
})
