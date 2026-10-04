import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS, PRESETS, cleanStats, cleanText, type CleanOptions } from './clean'

const opts = (over: Partial<CleanOptions> = {}): CleanOptions => ({ ...DEFAULT_OPTIONS, ...over })

describe('cleanText', () => {
  it('normalises line endings and trims lines', () => {
    expect(cleanText('  hello  \r\n\tworld\r\n', opts())).toBe('hello\nworld')
  })

  it('collapses runs of blank lines into one', () => {
    expect(cleanText('a\n\n\n\nb\n\n\n', opts())).toBe('a\n\nb')
  })

  it('collapses internal runs of spaces but keeps single separators', () => {
    expect(cleanText('a    b\t\tc', opts())).toBe('a b c')
  })

  it('converts smart quotes, dashes and ellipses', () => {
    expect(cleanText('\u201Che said\u201D \u2014 wait\u2026 \u2018ok\u2019', opts())).toBe('"he said" - wait... \'ok\'')
  })

  it('strips emoji and non-ASCII when asked', () => {
    expect(cleanText('hi \u{1F600} caf\u00E9', opts({ removeEmojis: true, removeNonAscii: true }))).toBe('hi caf')
  })

  it('removes digits and punctuation when asked', () => {
    expect(cleanText('a1, b2!', opts({ removeNumbers: true, removePunctuation: true }))).toBe('a b')
  })

  it('strips leading bullet characters', () => {
    expect(cleanText('- one\n* two\n\u2022 three', opts({ bullets: true }))).toBe('one\ntwo\nthree')
  })

  it('dedupes repeated lines but keeps blanks', () => {
    expect(cleanText('a\nb\na\nc\nb', opts({ dedupeLines: true }))).toBe('a\nb\nc')
  })

  it('sorts content lines case-insensitively', () => {
    expect(cleanText('banana\nApple\ncherry', opts({ sortLines: true }))).toBe('Apple\nbanana\ncherry')
  })

  it('applies case transforms last', () => {
    expect(cleanText('Hello World', opts({ uppercase: true }))).toBe('HELLO WORLD')
    expect(cleanText('Hello World', opts({ lowercase: true }))).toBe('hello world')
  })

  it('returns empty string for empty input', () => {
    expect(cleanText('', opts())).toBe('')
  })
})

describe('cleanStats', () => {
  it('reports before/after sizes and removed percentage', () => {
    const s = cleanStats('aaaa    bbbb', 'aaaa bbbb')
    expect(s.charsBefore).toBe(12)
    expect(s.charsAfter).toBe(9)
    expect(s.linesBefore).toBe(1)
    expect(s.linesAfter).toBe(1)
    expect(s.removedPct).toBe(25)
  })

  it('handles empty input without dividing by zero', () => {
    const s = cleanStats('', '')
    expect(s).toEqual({ charsBefore: 0, charsAfter: 0, linesBefore: 0, linesAfter: 0, removedPct: 0 })
  })
})

describe('PRESETS', () => {
  it('has unique names and valid option sets', () => {
    const names = PRESETS.map((p) => p.name)
    expect(new Set(names).size).toBe(names.length)
    for (const p of PRESETS) {
      expect(Object.keys(p.options).sort()).toEqual(Object.keys(DEFAULT_OPTIONS).sort())
    }
  })
})
