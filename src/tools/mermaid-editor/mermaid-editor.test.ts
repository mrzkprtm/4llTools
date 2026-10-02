import { describe, expect, it, vi } from 'vitest'
import { cleanError, debounce, errorLine, pngSize, svgSize, TEMPLATES, withPixelSize } from './diagram'

describe('mermaid editor helpers', () => {
  it('has a template for each promised diagram type', () => {
    const firstWords = TEMPLATES.map((t) => t.code.trim().split(/\s/)[0])
    for (const kind of ['flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram-v2', 'erDiagram', 'gantt', 'pie', 'mindmap', 'timeline']) expect(firstWords).toContain(kind)
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length)
  })

  it('debounces to the last call and can cancel', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d(1)
    d(2)
    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(2)
    d(3)
    d.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('finds the line number in Mermaid errors', () => {
    expect(errorLine('Parse error on line 3:\n...--> B{\n-----^\nExpecting ...')).toBe(3)
    expect(errorLine('Lexical error on line 12. Unrecognized text.')).toBe(12)
    expect(errorLine('No diagram type detected')).toBeNull()
    expect(cleanError('Error: Parse error on line 1:\na\nb\nc\nd\ne\nf\ng')).toBe('Parse error on line 1:\na\nb\nc\nd\ne')
  })

  it('reads SVG size from the viewBox, falling back to width/height', () => {
    expect(svgSize('<svg width="100%" viewBox="-8 -8 420.5 300" style="max-width: 420px">')).toEqual({ width: 420.5, height: 300 })
    expect(svgSize('<svg width="200px" height="80">')).toEqual({ width: 200, height: 80 })
    expect(svgSize('<svg>')).toEqual({ width: 800, height: 600 })
  })

  it('sizes PNG exports at 2x but within canvas limits', () => {
    expect(pngSize(400, 300)).toEqual({ width: 800, height: 600, scale: 2 })
    const big = pngSize(10000, 2000, 2, 8192)
    expect(big.width).toBe(8192)
    expect(big.height).toBe(Math.round(2000 * (8192 / 10000)))
  })

  it('gives the root SVG pixel dimensions and a namespace', () => {
    const out = withPixelSize('<svg id="m" width="100%" style="max-width: 420px;" viewBox="0 0 420 300"><g/></svg>', 420, 300)
    expect(out).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="420" height="300" id="m" viewBox="0 0 420 300">/)
    expect(out).not.toContain('100%')
    expect(out).toContain('<g/></svg>')
  })
})
