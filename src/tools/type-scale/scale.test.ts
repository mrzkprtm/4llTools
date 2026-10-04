import { describe, expect, it } from 'vitest'
import { RATIOS, modularScale, pxToRem, toCssVars, toTailwind } from './scale'

describe('type scale', () => {
  it('ships the six named ratios', () => {
    expect(RATIOS).toHaveLength(6)
    expect(RATIOS.map((r) => r.name)).toEqual(['Minor second', 'Major second', 'Minor third', 'Major third', 'Perfect fourth', 'Golden ratio'])
    expect(RATIOS.find((r) => r.name === 'Golden ratio')!.value).toBe(1.618)
    expect(RATIOS[0].value).toBe(1.067)
  })

  it('builds px values around the base for a ratio', () => {
    const scale = modularScale(16, 1.25, 2, 1)
    expect(scale.map((s) => s.step)).toEqual([-1, 0, 1, 2])
    expect(scale.map((s) => s.px)).toEqual([12.8, 16, 20, 25])
    expect(scale.map((s) => s.rem)).toEqual([0.8, 1, 1.25, 1.5625])
    expect(scale.find((s) => s.step === 0)!.px).toBe(16)
  })

  it('returns just the base when there are no steps', () => {
    expect(modularScale(18, 1.5, 0, 0)).toEqual([{ step: 0, px: 18, rem: 1.125 }])
  })

  it('clamps rogue inputs instead of throwing', () => {
    expect(modularScale(16, 1.25, 99, 99)).toHaveLength(25)
    expect(modularScale(0, 1.25, 0, 0)[0].px).toBe(1)
    expect(modularScale(16, NaN, 0, 0)[0].px).toBe(16)
  })

  it('converts px to rem and copes with bad roots', () => {
    expect(pxToRem(24)).toBe(1.5)
    expect(pxToRem(16, 10)).toBe(1.6)
    expect(pxToRem(18)).toBe(1.125)
    expect(pxToRem(10, 0)).toBe(0)
    expect(pxToRem(NaN)).toBe(0)
  })

  it('writes CSS variables and a Tailwind object', () => {
    const scale = modularScale(16, 1.25, 1, 1)
    expect(toCssVars(scale)).toBe(':root {\n  --step--1: 0.8rem;\n  --step-0: 1rem;\n  --step-1: 1.25rem;\n}')
    expect(toCssVars(scale, 10)).toContain('--step-1: 2rem;')
    expect(toTailwind(scale)).toBe("fontSize: {\n  'step--1': '0.8rem',\n  'step-0': '1rem',\n  'step-1': '1.25rem',\n}")
  })
})
