import { describe, expect, it } from 'vitest'
import { FORMATS, POSITIONS, cornerPosition, fileNameFor, formatBytes, pageLabel, pdfError } from './pagenumbers'

describe('pdf page numbers', () => {
  it('formats the plain number', () => {
    expect(pageLabel(1, 5, '1', 1)).toBe('1')
    expect(pageLabel(3, 5, '1', 1)).toBe('3')
  })

  it('formats the slash and page-of styles', () => {
    expect(pageLabel(2, 5, '1 / N', 1)).toBe('2 / 5')
    expect(pageLabel(1, 5, '1/N', 1)).toBe('1/5')
    expect(pageLabel(5, 5, 'Page 1 of N', 1)).toBe('Page 5 of 5')
    expect(FORMATS).toHaveLength(4)
  })

  it('counts from the starting number', () => {
    expect(pageLabel(1, 3, '1 / N', 10)).toBe('10 / 12')
    expect(pageLabel(3, 3, 'Page 1 of N', 10)).toBe('Page 12 of 12')
    expect(pageLabel(4, 12, '1', 5)).toBe('8')
  })

  it('falls back safely for odd input', () => {
    expect(pageLabel(1, 4, '1', 0)).toBe('1')
    expect(pageLabel(2, 5, 'total: N', 1)).toBe('2')
    expect(pageLabel(0, 5, '1', 1)).toBe('1')
    expect(pageLabel(1, 4, '1', Number.NaN)).toBe('1')
    expect(pageLabel(2, 4, ' 1/N ', 1)).toBe('2/4')
  })

  it('offers the six corners', () => {
    expect(POSITIONS.map((p) => p.id)).toEqual(['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left'])
    expect(new Set(POSITIONS.map((p) => p.label)).size).toBe(POSITIONS.length)
  })

  it('insets the number from the chosen corner', () => {
    expect(cornerPosition('bottom-left', 600, 800, 28, 40)).toEqual({ x: 28, y: 28 })
    expect(cornerPosition('bottom-right', 600, 800, 28, 40)).toEqual({ x: 532, y: 28 })
    expect(cornerPosition('bottom-center', 600, 800, 28, 40)).toEqual({ x: 280, y: 28 })
    expect(cornerPosition('top-center', 600, 800, 28, 40)).toEqual({ x: 280, y: 772 })
    expect(cornerPosition('top-center', 600, 800, 28, 40, 10)).toEqual({ x: 280, y: 762 })
    expect(cornerPosition('top-left', 600, 800, 28, 40, 10)).toEqual({ x: 28, y: 762 })
  })

  it('keeps the number on the page for silly sizes', () => {
    expect(cornerPosition('bottom-left', 600, 800, 1000, 40)).toEqual({ x: 300, y: 300 })
    expect(cornerPosition('bottom-right', 600, 800, 0, 900)).toEqual({ x: 0, y: 0 })
    expect(cornerPosition('top-right', 600, 800, Number.NaN, 40)).toEqual({ x: 560, y: 800 })
    expect(cornerPosition('top-right', 600, 800, 28, 40, 9)).toEqual({ x: 532, y: 763 })
  })

  it('names downloads and explains broken files', () => {
    expect(fileNameFor('Thesis.PDF')).toBe('Thesis-numbered.pdf')
    expect(fileNameFor('')).toBe('document-numbered.pdf')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(pdfError(new Error('encrypted'), 'a.pdf')).toContain('password-protected')
    expect(pdfError(new Error('bad'), 'a.pdf')).toContain('bad')
  })
})
