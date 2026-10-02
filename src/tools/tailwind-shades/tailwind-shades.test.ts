import { describe, expect, it } from 'vitest'
import { parseColor, rgbToOklch } from '../color-palette/oklch'
import { STEPS, buildShades, configV3, nearestStep, slugName, themeV4 } from './shades'

describe('tailwind shades', () => {
  it('builds 11 steps with monotonically decreasing lightness', () => {
    const shades = buildShades(parseColor('#0ea5e9')!)
    expect(shades.map((s) => s.step)).toEqual([...STEPS])
    for (let i = 1; i < shades.length; i++) expect(shades[i].color.l).toBeLessThan(shades[i - 1].color.l)
    for (const s of shades) expect(s.hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('keeps the input color at the nearest step', () => {
    for (const hex of ['#0ea5e9', '#fef3c7', '#1e1b4b', '#ef4444', '#808080']) {
      const shades = buildShades(parseColor(hex)!)
      const input = shades.filter((s) => s.isInput)
      expect(input).toHaveLength(1)
      expect(input[0].hex).toBe(hex)
      expect(input[0].step).toBe(STEPS[nearestStep(rgbToOklch(parseColor(hex)!).l)])
    }
  })

  it('labels text contrast', () => {
    const shades = buildShades(parseColor('#3b82f6')!)
    expect(shades[0].text).toBe('black')
    expect(shades[0].aa).toBe(true)
    expect(shades[10].text).toBe('white')
    expect(shades[10].onWhite).toBeGreaterThan(7)
  })

  it('keeps grays gray', () => {
    for (const s of buildShades(parseColor('#737373')!)) expect(s.color.c).toBeLessThan(0.002)
  })

  it('writes v4 @theme and v3 config', () => {
    const shades = buildShades(parseColor('#0ea5e9')!)
    const v4 = themeV4('My Brand!', shades)
    expect(v4.startsWith('@theme {\n  --color-my-brand-50: oklch(')).toBe(true)
    expect(v4.split('\n')).toHaveLength(13)
    expect(themeV4('x', shades, 'hex')).toContain('--color-x-500: #0ea5e9;')
    const v3 = configV3('my brand', shades)
    expect(v3).toContain("'my-brand': {")
    expect(v3).toContain("500: '#0ea5e9',")
    expect(configV3('ocean', shades)).toContain('ocean: {')
    expect(slugName('  ')).toBe('brand')
  })
})
