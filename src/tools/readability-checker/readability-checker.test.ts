import { describe, expect, it } from 'vitest'
import { analyze, easeLabel, findHints, sentenceLevel, splitSentences, syllables } from './readability'

describe('syllables', () => {
  const cases: [string, number][] = [
    ['cat', 1], ['the', 1], ['yes', 1], ['young', 1], ['make', 1], ['times', 1], ['jumped', 1], ['played', 1],
    ['table', 2], ['happy', 2], ['wanted', 2], ['boxes', 2], ['pages', 2], ['nation', 2], ['question', 2], ['special', 2],
    ['syllable', 3], ['beautiful', 3], ['piano', 3], ['video', 3], ['radio', 3], ['usual', 3], ['easier', 3],
    ['readability', 5], ['university', 5], ['communication', 5],
  ]
  it.each(cases)('%s has %i', (word, n) => {
    expect(syllables(word)).toBe(n)
  })

  it('ignores punctuation and case, and returns 0 for non-words', () => {
    expect(syllables('Table,')).toBe(2)
    expect(syllables('123')).toBe(0)
  })
})

describe('sentences', () => {
  it('splits on end punctuation and line breaks, not abbreviations or decimals', () => {
    const s = splitSentences('Dr. Smith paid $3.50 today. Was it fair?\nYes! See example.com for more')
    expect(s.map((x) => x.text)).toEqual(['Dr. Smith paid $3.50 today.', 'Was it fair?', 'Yes!', 'See example.com for more'])
    expect(s[1].start).toBe(28)
  })

  it('grades sentence length', () => {
    expect(sentenceLevel(10)).toBe('ok')
    expect(sentenceLevel(26)).toBe('long')
    expect(sentenceLevel(40)).toBe('very-long')
  })
})

describe('scores', () => {
  it('scores simple text as easy', () => {
    const r = analyze('The cat sat on the mat. The dog ran to the park. We had fun in the sun.')!
    expect(r.words).toBe(18)
    expect(r.sentences).toBe(3)
    expect(r.fleschEase).toBeGreaterThan(95)
    expect(r.fleschKincaid).toBeLessThan(2)
    expect(easeLabel(r.fleschEase).label).toBe('Very easy')
  })

  it('scores dense academic text as hard', () => {
    const r = analyze('Institutional accountability mechanisms necessitate comprehensive organizational transparency, particularly regarding administrative decision-making procedures.')!
    expect(r.fleschEase).toBeLessThan(10)
    expect(r.fleschKincaid).toBeGreaterThan(18)
    expect(r.gunningFog).toBeGreaterThan(20)
    expect(r.smog).toBeGreaterThan(15)
    expect(easeLabel(r.fleschEase).label).toBe('Very difficult')
  })

  it('matches the Flesch formula on a known example', () => {
    // 2 sentences, 12 words, 14 syllables → 206.835 − 1.015×6 − 84.6×14/12 = 102.0
    const r = analyze('I like to read good books. They make me feel very happy.')!
    expect(r.words).toBe(12)
    expect(r.syllables).toBe(14)
    expect(r.fleschEase).toBe(102)
  })

  it('returns null for empty text', () => {
    expect(analyze('   ')).toBeNull()
  })
})

describe('hints', () => {
  it('finds passive voice and adverbs but skips -ly nouns and adjectives', () => {
    const text = 'The report was written quickly by the family. Mistakes were made. She really likes her friendly reply.'
    const hints = findHints(text).map((h) => [h.kind, text.slice(h.start, h.end)])
    expect(hints).toContainEqual(['passive', 'was written'])
    expect(hints).toContainEqual(['passive', 'were made'])
    expect(hints).toContainEqual(['adverb', 'quickly'])
    expect(hints).toContainEqual(['adverb', 'really'])
    expect(hints.map((h) => h[1])).not.toContain('family')
    expect(hints.map((h) => h[1])).not.toContain('friendly')
    expect(hints.map((h) => h[1])).not.toContain('reply')
  })
})
