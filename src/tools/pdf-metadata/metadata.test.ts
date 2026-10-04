import { describe, expect, it } from 'vitest'
import { FIELD_LIMITS, cleanMeta, describeMeta, emptyMeta, fileNameFor, formatBytes, hasMeta, joinKeywords, pdfError, splitKeywords } from './metadata'

describe('pdf metadata fields', () => {
  it('splits keywords on commas, semicolons and new lines', () => {
    expect(splitKeywords('seo, pdf; report\nnotes')).toEqual(['seo', 'pdf', 'report', 'notes'])
    expect(splitKeywords('a, A,  b ')).toEqual(['a', 'b'])
    expect(splitKeywords('')).toEqual([])
    expect(splitKeywords(',, ; ')).toEqual([])
  })

  it('joins keywords back into a comma-separated list', () => {
    expect(joinKeywords([' a ', '', 'b'])).toBe('a, b')
    expect(joinKeywords([])).toBe('')
    expect(joinKeywords(['Report', 'report', '2026'])).toBe('Report, 2026')
  })

  it('trims, collapses whitespace and limits every field', () => {
    const raw = cleanMeta({
      title: '  Quarterly   Report ',
      author: ' Ada Lovelace ',
      subject: 'x'.repeat(500),
      keywords: 'finance; 2026; finance',
    })
    expect(raw.title).toBe('Quarterly Report')
    expect(raw.author).toBe('Ada Lovelace')
    expect(raw.subject).toHaveLength(FIELD_LIMITS.subject)
    expect(raw.keywords).toBe('finance, 2026')
  })

  it('falls back to empty values for missing or wrong-shaped input', () => {
    expect(cleanMeta({})).toEqual(emptyMeta)
    expect(cleanMeta(undefined)).toEqual(emptyMeta)
    expect(cleanMeta(null)).toEqual(emptyMeta)
    expect(cleanMeta({ title: '   ' }).title).toBe('')
  })

  it('knows when there is nothing to show', () => {
    expect(hasMeta(emptyMeta)).toBe(false)
    expect(hasMeta({ ...emptyMeta, author: 'Ada' })).toBe(true)
    expect(describeMeta(emptyMeta)).toBe('')
    expect(describeMeta({ ...emptyMeta, title: 'Report', author: 'Ada', keywords: 'a, b' })).toBe('“Report” · by Ada · 2 keywords')
  })

  it('names downloads and explains broken files', () => {
    expect(fileNameFor('Report.PDF')).toBe('Report-metadata.pdf')
    expect(fileNameFor(' a/b ')).toBe('a-b-metadata.pdf')
    expect(fileNameFor('')).toBe('document-metadata.pdf')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024 * 1024 * 3)).toBe('3.00 MB')
    expect(pdfError(new Error('encrypted'), 'a.pdf')).toContain('password-protected')
    expect(pdfError(new Error('boom'), 'a.pdf')).toContain('Could not read')
  })
})
