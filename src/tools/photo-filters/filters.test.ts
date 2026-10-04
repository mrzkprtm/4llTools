import { describe, expect, it } from 'vitest'
import { FILTERS, clampIntensity, filterCss } from './filters'

describe('FILTERS', () => {
  it('ships the seven presets with unique ids and labels', () => {
    expect(FILTERS).toHaveLength(7)
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(7)
    expect(new Set(FILTERS.map((f) => f.label)).size).toBe(7)
    expect(FILTERS.map((f) => f.id)).toEqual(['grayscale', 'sepia', 'warm', 'cool', 'vintage', 'dramatic', 'fade'])
  })

  it('describes every preset as a valid CSS filter chain', () => {
    const chain = /^(?:[a-z-]+\(-?[\d.]+(?:deg)?\))(?: [a-z-]+\(-?[\d.]+(?:deg)?\))*$/
    for (const f of FILTERS) expect(f.css).toMatch(chain)
  })
})

describe('clampIntensity', () => {
  it('keeps values inside 0…1', () => {
    expect(clampIntensity(0.5)).toBe(0.5)
    expect(clampIntensity(-3)).toBe(0)
    expect(clampIntensity(7)).toBe(1)
  })

  it('treats nonsense as no filter', () => {
    expect(clampIntensity(Number.NaN)).toBe(0)
    expect(clampIntensity(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('filterCss', () => {
  it('returns the full preset at strength 1', () => {
    expect(filterCss('grayscale', 1)).toBe('grayscale(1)')
    expect(filterCss('vintage', 1)).toBe('sepia(0.55) contrast(0.85) brightness(1.08) saturate(0.8)')
  })

  it('scales zero-neutral functions straight down', () => {
    expect(filterCss('grayscale', 0.5)).toBe('grayscale(0.5)')
    expect(filterCss('sepia', 0.25)).toBe('sepia(0.25)')
    expect(filterCss('cool', 0.5)).toBe('hue-rotate(-6deg) saturate(1.075) brightness(1.01)')
  })

  it('blends functions whose neutral value is 1 towards that neutral', () => {
    expect(filterCss('warm', 0.5)).toBe('sepia(0.2) saturate(1.15) brightness(1.025)')
    expect(filterCss('dramatic', 0.5)).toBe('contrast(1.25) saturate(1.05) brightness(0.975)')
  })

  it('turns the filter off at strength 0 or for an unknown preset', () => {
    expect(filterCss('grayscale', 0)).toBe('none')
    expect(filterCss('nope', 1)).toBe('none')
    expect(filterCss('nope', 0.4)).toBe('none')
  })

  it('treats an over-range strength as full strength', () => {
    expect(filterCss('sepia', 4)).toBe('sepia(1)')
  })
})
