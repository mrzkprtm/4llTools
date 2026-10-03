import { describe, expect, it } from 'vitest'
import { CARD, THEMES, initialsFrom, layoutTweet } from './tweet'

describe('initialsFrom', () => {
  it('takes first letters of first and last word', () => {
    expect(initialsFrom('Ada Lovelace')).toBe('AL')
    expect(initialsFrom('cher')).toBe('C')
    expect(initialsFrom('  jean   luc picard ')).toBe('JP')
    expect(initialsFrom('')).toBe('?')
  })
})

describe('layoutTweet', () => {
  const charW = (size: number) => (s: string) => s.length * size * 0.5

  it('respects paragraph breaks', () => {
    const { paragraphs } = layoutTweet(charW, 'hello\nworld wide web', 1000, 46, 30, 10000)
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]).toEqual(['hello'])
  })

  it('shrinks the font until the text fits the height', () => {
    const maxHeight = 46 * 1.35 * 8
    const r = layoutTweet(charW, 'word '.repeat(80), 1000, 46, 30, maxHeight)
    expect(r.size).toBeLessThan(46)
    const lines = r.paragraphs.flat().length
    expect(lines * r.size * 1.35).toBeLessThanOrEqual(maxHeight)
  })

  it('keeps the start size for short text', () => {
    const r = layoutTweet(charW, 'hi', 1000, 46, 30, 10000)
    expect(r.size).toBe(46)
  })
})

describe('themes', () => {
  it('define every colour for each theme', () => {
    for (const t of Object.values(THEMES)) {
      expect(t.bg).toMatch(/^#/)
      expect(t.text).toMatch(/^#/)
      expect(t.sub).toMatch(/^#/)
      expect(t.line).toMatch(/^#/)
      expect(t.accent).toMatch(/^#/)
    }
  })

  it('renders a square card', () => {
    expect(CARD).toBe(1080)
  })
})
