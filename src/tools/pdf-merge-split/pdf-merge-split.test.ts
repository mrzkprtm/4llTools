import { describe, expect, it } from 'vitest'
import { describePages, moveItem, normAngle, parseRanges, pdfError } from './ranges'

describe('pdf page ranges', () => {
  it('parses lists and ranges into groups', () => {
    expect(parseRanges('1-3, 5, 7-9', 10)).toEqual({ ok: true, groups: [[1, 2, 3], [5], [7, 8, 9]] })
  })

  it('accepts spaces, semicolons, open ends, last and reversed ranges', () => {
    expect(parseRanges('1 - 2; 4', 5)).toEqual({ ok: true, groups: [[1, 2], [4]] })
    expect(parseRanges('8-', 10)).toEqual({ ok: true, groups: [[8, 9, 10]] })
    expect(parseRanges('-2 last', 6)).toEqual({ ok: true, groups: [[1, 2], [6]] })
    expect(parseRanges('3-1', 3)).toEqual({ ok: true, groups: [[3, 2, 1]] })
    expect(parseRanges('2–4', 4)).toEqual({ ok: true, groups: [[2, 3, 4]] })
  })

  it('rejects pages out of range and junk', () => {
    const out = parseRanges('1-12', 10)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error).toMatch(/12 does not exist; this PDF has 10 pages/)
    expect(parseRanges('0', 3).ok).toBe(false)
    expect(parseRanges('a-b', 3).ok).toBe(false)
    expect(parseRanges('1-2-3', 3).ok).toBe(false)
    expect(parseRanges('  ', 3).ok).toBe(false)
  })
})

describe('pdf helpers', () => {
  it('describes page lists compactly', () => {
    expect(describePages([1, 2, 3, 5, 7, 8])).toBe('1-3, 5, 7-8')
    expect(describePages([])).toBe('')
  })

  it('moves items and normalizes angles', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(normAngle(-90)).toBe(270)
    expect(normAngle(450)).toBe(90)
  })

  it('explains encrypted and broken files', () => {
    expect(pdfError(new Error('Input document to `PDFDocument.load` is encrypted.'), 'a.pdf')).toMatch(/password-protected/)
    expect(pdfError(new Error('Failed to parse PDF document (line:0 col:0 offset=0): No PDF header found'), 'b.pdf')).toMatch(/not look like a valid PDF/)
  })
})

describe('pdf operations (pdf-lib)', async () => {
  const { editPages, extractPages, mergePdfs, pageCount, pageRotations, samplePdf, splitPdf } = await import('./ops')

  it('merges, splits, extracts, rotates and deletes', async () => {
    const a = await samplePdf('A', 3, [0.2, 0.3, 0.8])
    const b = await samplePdf('B', 2, [0.8, 0.3, 0.2])
    const merged = await mergePdfs([a, b])
    expect(await pageCount(merged)).toBe(5)

    const parts = await splitPdf(merged, [[1, 2], [5]])
    expect(await Promise.all(parts.map(pageCount))).toEqual([2, 1])
    expect(await pageCount(await extractPages(merged, [5, 1, 1]))).toBe(3)

    const edited = await editPages(merged, [{ rotate: 90, deleted: false }, { rotate: 0, deleted: true }, { rotate: -90, deleted: false }])
    expect(await pageCount(edited)).toBe(4)
    expect((await pageRotations(edited)).slice(0, 2)).toEqual([90, 270])
    await expect(editPages(b, [{ rotate: 0, deleted: true }, { rotate: 0, deleted: true }])).rejects.toThrow(/at least one/)
  })

  it('refuses garbage with an error', async () => {
    await expect(pageCount(new TextEncoder().encode('hello'))).rejects.toThrow()
  })
})
