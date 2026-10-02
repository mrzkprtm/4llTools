import { describe, expect, it } from 'vitest'
import { charStates, consistency, makeWords, perSecondWpm, score } from './typing'
import { EN_WORDS, ID_WORDS } from './words'

describe('typing test', () => {
  it('has about 200 common words per language', () => {
    expect(EN_WORDS.length).toBeGreaterThanOrEqual(190)
    expect(ID_WORDS.length).toBeGreaterThanOrEqual(190)
    for (const w of [...EN_WORDS, ...ID_WORDS]) expect(w).toMatch(/^[a-z]+$/)
  })

  it('makes words without immediate repeats', () => {
    const words = makeWords(['a', 'b'], 20, () => 0)
    expect(words).toHaveLength(20)
    for (let i = 1; i < words.length; i++) expect(words[i]).not.toBe(words[i - 1])
  })

  it('marks characters as correct, incorrect or pending', () => {
    expect(charStates('cat', 'cx')).toEqual(['correct', 'incorrect', 'pending'])
  })

  it('computes net and raw WPM and accuracy', () => {
    // 50 chars, 45 right, in 30 seconds: net = 9 words / 0.5 min = 18, raw = 20.
    const target = 'x'.repeat(50)
    const typed = 'x'.repeat(45) + 'yyyyy'
    const s = score(target, typed, 30_000, 55, 5)
    expect(s.wpm).toBeCloseTo(18)
    expect(s.raw).toBeCloseTo(20)
    expect(s.correct).toBe(45)
    expect(s.incorrect).toBe(5)
    expect(s.accuracy).toBeCloseTo((50 / 55) * 100)
    expect(score('abc', '', 0, 0, 0)).toMatchObject({ wpm: 0, accuracy: 100 })
  })

  it('scores consistency from per-second speed', () => {
    expect(perSecondWpm([5, 10, 15])).toEqual([60, 60, 60])
    expect(consistency([60, 60, 60])).toBe(100)
    expect(consistency([30, 90])).toBeCloseTo(50)
    expect(consistency([0, 0])).toBe(0)
  })
})
