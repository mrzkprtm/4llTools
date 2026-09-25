import { describe, expect, it } from 'vitest'
import { contrastRatio, formatOklch, inGamut, oklchToHex, parseColor, rgbToHex, rgbToOklch } from './oklch'
import { exportCss, exportJson, exportTailwind, generate, harmony, mergeLocked, seeded } from './palette'

describe('oklch color math', () => {
  it('matches reference OKLCH values', () => {
    const white = rgbToOklch({ r: 255, g: 255, b: 255 })
    expect(white.l).toBeCloseTo(1, 3)
    expect(white.c).toBeLessThan(1e-3)
    const red = rgbToOklch({ r: 255, g: 0, b: 0 })
    expect(red.l).toBeCloseTo(0.628, 3)
    expect(red.c).toBeCloseTo(0.2577, 3)
    expect(red.h).toBeCloseTo(29.23, 1)
  })

  it('round-trips hex through OKLCH', () => {
    for (const hex of ['#4f46e5', '#000000', '#ffffff', '#16a34a', '#f59e0b', '#808080']) {
      expect(oklchToHex(rgbToOklch(parseColor(hex)!))).toBe(hex)
    }
  })

  it('maps out-of-gamut colors back into sRGB by lowering chroma', () => {
    const wild = { l: 0.7, c: 0.5, h: 150 }
    expect(inGamut(wild)).toBe(false)
    expect(oklchToHex(wild)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('parses css color syntaxes', () => {
    expect(rgbToHex(parseColor('rgb(79 70 229)')!)).toBe('#4f46e5')
    expect(rgbToHex(parseColor('hsl(0, 100%, 50%)')!)).toBe('#ff0000')
    expect(rgbToHex(parseColor('#abc')!)).toBe('#aabbcc')
    expect(rgbToHex(parseColor('oklch(62.8% 0.2577 29.23)')!)).toBe('#ff0000')
    expect(parseColor('nope')).toBeNull()
    expect(formatOklch(rgbToOklch({ r: 255, g: 0, b: 0 }))).toBe('oklch(62.8% 0.258 29.2)')
  })

  it('computes WCAG contrast', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5)
    expect(contrastRatio(parseColor('#767676')!, parseColor('#fff')!)).toBeCloseTo(4.54, 2)
  })
})

describe('palettes', () => {
  const base = rgbToOklch(parseColor('#4f46e5')!)

  it('keeps the base color and applies harmony hue offsets', () => {
    const tri = harmony(base, 'triadic')
    expect(tri).toHaveLength(5)
    expect(oklchToHex(tri[0])).toBe('#4f46e5')
    const d = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
    expect(d(tri[2].h, base.h + 120)).toBeLessThan(1)
    const comp = harmony(base, 'complementary')
    expect(d(comp[3].h, base.h + 180)).toBeLessThan(1)
    const mono = harmony(base, 'monochromatic')
    expect(mono.map(oklchToHex)).toContain('#4f46e5')
    expect(new Set(mono.map((c) => Math.round(c.h))).size).toBeLessThanOrEqual(2)
  })

  it('every generated color is a valid in-gamut hex, and random is repeatable with a seed', () => {
    const a = generate(base, 'random', seeded(7)).map(oklchToHex)
    const b = generate(base, 'random', seeded(7)).map(oklchToHex)
    expect(a).toEqual(b)
    for (const hex of a) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('keeps locked swatches when regenerating', () => {
    const first = mergeLocked([], harmony(base, 'analogous'))
    first[1] = { ...first[1], locked: true }
    const next = mergeLocked(first, generate(base, 'random', seeded(3)))
    expect(next[1]).toBe(first[1])
    expect(next[0].hex).not.toBe(first[0].hex)
  })

  it('exports css, tailwind and json', () => {
    expect(exportCss(['#111111', '#222222'])).toBe(':root {\n  --primary: #111111;\n  --secondary: #222222;\n}')
    expect(exportTailwind(['#111111'])).toContain("primary: '#111111',")
    const json = JSON.parse(exportJson([base]))
    expect(json[0]).toMatchObject({ name: 'primary', hex: '#4f46e5', rgb: 'rgb(79, 70, 229)' })
  })
})
