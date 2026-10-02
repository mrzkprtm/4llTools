import { describe, expect, it } from 'vitest'
import { bmiOf, bmr, bodyFatEstimate, classify, gaugePos, healthyRange, toMetric } from './bmi'

describe('bmi', () => {
  it('computes BMI from kg and cm', () => {
    expect(bmiOf(70, 175)).toBeCloseTo(22.86, 2)
    expect(bmiOf(0, 175)).toBeNaN()
  })

  it('uses stricter Asia-Pacific cut-offs', () => {
    expect(classify(24, 'who')!.label).toBe('Normal weight')
    expect(classify(24, 'asia')!.label).toBe('Overweight (at risk)')
    expect(classify(27, 'asia')!.label).toBe('Obesity class I')
    expect(classify(18.49, 'who')!.tone).toBe('low')
    expect(classify(41, 'who')!.label).toBe('Obesity class III')
  })

  it('gives the healthy weight range for a height', () => {
    const [lo, hi] = healthyRange(170, 'who')
    expect(lo).toBeCloseTo(53.5, 1)
    expect(hi).toBeCloseTo(72, 0)
    expect(healthyRange(170, 'asia')[1]).toBeCloseTo(66.2, 1)
  })

  it('uses Mifflin-St Jeor for BMR', () => {
    expect(bmr(70, 175, 30, 'male')).toBeCloseTo(1648.75, 2)
    expect(bmr(60, 165, 25, 'female')).toBeCloseTo(1345.25, 2)
  })

  it('converts imperial units and places the gauge', () => {
    const { kg, cm } = toMetric(154, 5, 9)
    expect(kg).toBeCloseTo(69.85, 2)
    expect(cm).toBeCloseTo(175.26, 2)
    expect(gaugePos(27.5)).toBeCloseTo(0.5)
    expect(gaugePos(50)).toBe(1)
    expect(bodyFatEstimate(22, 30, 'male')).toBeCloseTo(17.1, 1)
  })
})
