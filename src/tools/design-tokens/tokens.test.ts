import { describe, expect, it } from 'vitest'
import { DEFAULT_TOKENS, slugToken, toCss, toJson, toTailwind } from './tokens'

describe('design token exporter', () => {
  it('ships default groups', () => {
    expect(DEFAULT_TOKENS.map((g) => g.kind)).toEqual(['color', 'space', 'radius', 'font'])
    expect(DEFAULT_TOKENS.every((g) => g.tokens.length > 0)).toBe(true)
  })

  it('slugs token names safely', () => {
    expect(slugToken('Primary Brand!')).toBe('primary-brand')
    expect(slugToken('  ')).toBe('token')
    expect(slugToken('BG / 2')).toBe('bg-2')
    expect(slugToken('__leading__')).toBe('leading')
  })

  it('exports CSS custom properties', () => {
    const css = toCss(DEFAULT_TOKENS)
    expect(css.startsWith(':root {')).toBe(true)
    expect(css).toContain('  --color-primary: #c2410c;')
    expect(css).toContain('  --space-md: 16px;')
    expect(css).toContain('  --radius-sm: 6px;')
    expect(css).toContain("  --font-heading: 'Bricolage Grotesque', system-ui, sans-serif;")
  })

  it('exports a Tailwind theme block', () => {
    const tw = toTailwind(DEFAULT_TOKENS)
    expect(tw).toContain('theme: {')
    expect(tw).toContain('colors: {')
    expect(tw).toContain("'primary': '#c2410c',")
    expect(tw).toContain('borderRadius: {')
    expect(tw).toContain("'heading': '\\'Bricolage Grotesque\\', system-ui, sans-serif',")
  })

  it('exports grouped JSON that parses back', () => {
    const parsed = JSON.parse(toJson(DEFAULT_TOKENS)) as Record<string, Record<string, string>>
    expect(parsed.color.primary).toBe('#c2410c')
    expect(parsed.space.md).toBe('16px')
    expect(Object.keys(parsed)).toEqual(['color', 'space', 'radius', 'font'])
  })

  it('skips blank names', () => {
    const groups = [{ kind: 'color' as const, label: 'Colors', tokens: [{ name: '  ', value: '#fff' }] }]
    expect(toCss(groups)).toBe(':root {\n\n}')
  })
})
