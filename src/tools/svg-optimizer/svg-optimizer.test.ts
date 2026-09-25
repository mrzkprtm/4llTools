import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS, optimizeSvg, svgDataUrl } from './optimize'

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Some Editor -->
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <metadata>junk</metadata>
  <g id="layer1">
    <path d="M 2.000000 2.000000 L 22.000000 2.000000 L 22.000000 22.000000 Z" fill="#ff0000"/>
  </g>
</svg>`

describe('svg optimizer', () => {
  it('removes comments, metadata and the XML declaration but keeps paths', () => {
    const r = optimizeSvg(SAMPLE)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).not.toContain('<!--')
    expect(r.data).not.toContain('metadata')
    expect(r.data).not.toContain('<?xml')
    expect(r.data).toContain('<path')
    expect(r.data).toContain('viewBox')
    expect(r.after).toBeLessThan(r.before)
  })

  it('removes the viewBox only when asked', () => {
    const r = optimizeSvg(SAMPLE, { ...DEFAULT_OPTIONS, removeViewBox: true })
    expect(r.ok && r.data.includes('viewBox')).toBe(false)
  })

  it('pretty prints on request', () => {
    const r = optimizeSvg(SAMPLE, { ...DEFAULT_OPTIONS, pretty: true })
    expect(r.ok && r.data.split('\n').length > 2).toBe(true)
  })

  it('keeps ids when asked', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="my-box" width="5" height="5"/></svg>'
    const r = optimizeSvg(svg, { ...DEFAULT_OPTIONS, keepIds: true })
    expect(r.ok && r.data.includes('my-box')).toBe(true)
  })

  it('reports errors for invalid input', () => {
    expect(optimizeSvg('hello').ok).toBe(false)
    expect(optimizeSvg('<svg><g></svg>').ok).toBe(false)
  })

  it('encodes a data url', () => {
    expect(svgDataUrl('<svg/>')).toBe('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')
  })
})
