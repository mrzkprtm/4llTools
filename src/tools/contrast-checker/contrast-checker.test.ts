import { describe, expect, it } from 'vitest'
import { parseColor } from '../color-palette/oklch'
import { apcaContrast, apcaGuidance, contrastRatio, formatRatio, suggestPassing, wcagChecks } from './contrast'

const c = (s: string) => parseColor(s)!

describe('wcag', () => {
  it('computes known ratios and pass chips', () => {
    expect(contrastRatio(c('#000'), c('#fff'))).toBeCloseTo(21, 6)
    expect(formatRatio(contrastRatio(c('#767676'), c('#fff')))).toBe('4.54:1')
    const checks = wcagChecks(contrastRatio(c('#777777'), c('#ffffff')))
    expect(checks.find((x) => x.id === 'normal-aa')!.pass).toBe(false)
    expect(checks.find((x) => x.id === 'large-aa')!.pass).toBe(true)
    expect(checks.find((x) => x.id === 'ui')!.pass).toBe(true)
  })

  it('truncates rather than rounds the displayed ratio', () => {
    expect(formatRatio(4.4999)).toBe('4.49:1')
  })
})

describe('apca 0.0.98G-4g', () => {
  // Reference values from the apca-w3 test suite.
  it.each([
    ['#888', '#fff', 63.056469930209424],
    ['#fff', '#888', -68.54146436644962],
    ['#000', '#aaa', 58.146262578561334],
    ['#aaa', '#000', -56.24113336839742],
    ['#000', '#fff', 106.04067321268862],
    ['#fff', '#000', -107.88473318309848],
  ])('text %s on %s', (text, bg, lc) => {
    expect(apcaContrast(c(text), c(bg))).toBeCloseTo(lc, 6)
  })

  it('returns 0 for identical or near colors', () => {
    expect(apcaContrast(c('#777'), c('#777'))).toBe(0)
    expect(apcaContrast(c('#777'), c('#787878'))).toBe(0)
  })

  it('gives font guidance by Lc tier', () => {
    expect(apcaGuidance(-95).level).toBe('Lc 90+')
    expect(apcaGuidance(62).level).toBe('Lc 60+')
    expect(apcaGuidance(5).tone).toBe('bad')
  })
})

describe('suggest a passing color', () => {
  it('returns null when already passing', () => {
    expect(suggestPassing(c('#000'), c('#fff'), 4.5)).toBeNull()
  })

  it('darkens light gray text on white until it passes AA', () => {
    const s = suggestPassing(c('#999999'), c('#ffffff'), 4.5)!
    expect(s.direction).toBe('darker')
    expect(s.ratio).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(c(s.hex), c('#fff'))).toBeGreaterThanOrEqual(4.5)
    // It should be close to the threshold, not jump to black.
    expect(s.ratio).toBeLessThan(4.8)
  })

  it('lightens text on a dark background and keeps the hue', () => {
    const s = suggestPassing(c('#3b3bd6'), c('#101020'), 7)!
    expect(s.direction).toBe('lighter')
    expect(s.ratio).toBeGreaterThanOrEqual(7)
    const rgb = c(s.hex)
    expect(rgb.b).toBeGreaterThan(rgb.r)
  })
})
