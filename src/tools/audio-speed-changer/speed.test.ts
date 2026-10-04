import { describe, expect, it } from 'vitest'
import { clampSpeed, labelForSpeed, newDuration, SPEEDS } from './speed'

describe('clampSpeed', () => {
  it('clamps to the supported range', () => {
    expect(clampSpeed(0.1)).toBe(0.25)
    expect(clampSpeed(10)).toBe(4)
    expect(clampSpeed(1.5)).toBe(1.5)
    expect(clampSpeed(NaN)).toBe(1)
  })
})

describe('labelForSpeed', () => {
  it('formats with a multiplication sign', () => {
    expect(labelForSpeed(1.5)).toBe('1.5×')
    expect(labelForSpeed(2)).toBe('2×')
  })
})

describe('newDuration', () => {
  it('halves duration at double speed', () => {
    expect(newDuration(60, 2)).toBe(30)
  })

  it('doubles duration at half speed', () => {
    expect(newDuration(60, 0.5)).toBe(120)
  })

  it('is unchanged at 1×', () => {
    expect(newDuration(60, 1)).toBe(60)
  })
})

describe('SPEEDS', () => {
  it('includes 1× and stays sorted', () => {
    expect(SPEEDS).toContain(1)
    expect([...SPEEDS].sort((a, b) => a - b)).toEqual([...SPEEDS])
  })
})
