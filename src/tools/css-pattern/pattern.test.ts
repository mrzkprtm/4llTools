import { describe, expect, it } from 'vitest'
import { PATTERNS, patternCss, patternSvg } from './pattern'

const opts = { fg: '#000000', bg: '#ffffff', size: 20, angle: 0 }

describe('css patterns', () => {
  it('offers every requested preset', () => {
    expect(PATTERNS.map((p) => p.id)).toEqual(['polka', 'stripes', 'diagonal', 'checker', 'grid', 'zigzag', 'dots', 'cross'])
  })

  it('builds radial patterns for the dot styles', () => {
    const polka = patternCss('polka', opts)
    expect(polka).toContain('radial-gradient')
    expect(polka).toContain('#000000')
    expect(polka.endsWith('#ffffff')).toBe(true)
    expect(patternCss('dots', opts).match(/radial-gradient/g)).toHaveLength(2)
  })

  it('builds gradient patterns for lines and checks', () => {
    expect(patternCss('stripes', opts)).toContain('repeating-linear-gradient')
    expect(patternCss('stripes', opts)).toContain('20px')
    expect(patternCss('checker', opts)).toContain('conic-gradient')
    expect(patternCss('grid', opts).match(/repeating-linear-gradient/g)).toHaveLength(2)
    expect(patternCss('zigzag', opts)).toContain('linear-gradient(135deg')
  })

  it('clamps the size and wraps the angle', () => {
    expect(patternCss('stripes', { ...opts, size: 1000 })).toContain('200px')
    expect(patternCss('stripes', { ...opts, size: -5 })).toContain('4px')
    expect(patternCss('stripes', { ...opts, angle: 400 })).toContain('40deg')
    expect(patternCss('stripes', { ...opts, angle: -90 })).toContain('270deg')
  })

  it('renders a tiled SVG for exports', () => {
    const svg = patternSvg('polka', opts)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<pattern')
    expect(svg).toContain('patternUnits="userSpaceOnUse"')
    expect(svg).toContain('fill="#ffffff"')
    expect(svg).toContain('fill="url(#p)"')
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(patternSvg('checker', opts, 100, 50)).toContain('viewBox="0 0 100 50"')
  })
})
