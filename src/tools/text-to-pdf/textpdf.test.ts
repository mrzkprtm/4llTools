import { describe, expect, it } from 'vitest'
import { PAGE_KEYS, PAGE_SIZES, charsPerLine, estimateLinesPerPage, formatBytes, lineBaselines, paginate, pdfFileName, wrapText } from './textpdf'

describe('text to pdf layout', () => {
  it('offers A4, Letter and Legal with portrait point sizes', () => {
    expect(PAGE_KEYS).toEqual(['a4', 'letter', 'legal'])
    expect(PAGE_SIZES.a4.w).toBeCloseTo(595.28, 2)
    expect(PAGE_SIZES.a4.h).toBeCloseTo(841.89, 2)
    expect(PAGE_SIZES.letter).toMatchObject({ w: 612, h: 792 })
    expect(PAGE_SIZES.legal).toMatchObject({ w: 612, h: 1008 })
    for (const k of PAGE_KEYS) expect(PAGE_SIZES[k].h).toBeGreaterThan(PAGE_SIZES[k].w)
  })

  it('wraps text at word boundaries', () => {
    expect(wrapText('hello world', 20)).toEqual(['hello world'])
    expect(wrapText('one two three four', 7)).toEqual(['one two', 'three', 'four'])
    expect(wrapText('', 10)).toEqual([''])
  })

  it('hard-breaks words longer than the line', () => {
    expect(wrapText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
    expect(wrapText('hi abcdefgh', 4)).toEqual(['hi', 'abcd', 'efgh'])
    expect(wrapText('anything', 0)).toEqual(['a', 'n', 'y', 't', 'h', 'i', 'n', 'g'])
  })

  it('keeps blank lines and collapses runs of whitespace', () => {
    expect(wrapText('a\n\nb', 10)).toEqual(['a', '', 'b'])
    expect(wrapText('a\r\nb\tc', 10)).toEqual(['a', 'b c'])
    expect(wrapText('  spaced   out  ', 20)).toEqual(['spaced out'])
  })

  it('splits lines into pages', () => {
    expect(paginate(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']])
    expect(paginate([], 3)).toEqual([])
    expect(paginate(['a', 'b'], 0)).toEqual([['a'], ['b']])
    expect(paginate(['a', 'b'], 2.9)).toEqual([['a', 'b']])
  })

  it('estimates how many lines fit on a page', () => {
    expect(estimateLinesPerPage(841.89, 70, 11)).toBe(47)
    expect(estimateLinesPerPage(792, 0, 12)).toBe(48)
    expect(estimateLinesPerPage(100, 80, 12)).toBe(1)
  })

  it('fits characters per line to the width between margins', () => {
    expect(charsPerLine(595.28, 70, 11)).toBe(82)
    expect(charsPerLine(612, 72, 12)).toBe(78)
    expect(charsPerLine(100, 60, 12)).toBe(1)
  })

  it('stacks baselines downwards from the top margin', () => {
    const ys = lineBaselines(3, 800, 50, 10)
    expect(ys).toHaveLength(3)
    expect(ys[0]).toBeCloseTo(740.8, 4)
    expect(ys[1]).toBeCloseTo(731.6, 4)
    expect(ys[2]).toBeCloseTo(722.4, 4)
    expect(ys[0]).toBeLessThan(750)
    expect(lineBaselines(0, 800, 50, 10)).toEqual([])
  })

  it('builds safe file names and sizes', () => {
    expect(pdfFileName('My Notes')).toBe('My Notes.pdf')
    expect(pdfFileName('a/b:c')).toBe('a-b-c.pdf')
    expect(pdfFileName('report.PDF')).toBe('report.pdf')
    expect(pdfFileName('   ')).toBe('text.pdf')
    expect(formatBytes(900)).toBe('900 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
  })
})
