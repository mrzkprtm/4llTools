import { describe, expect, it } from 'vitest'
import { STOPWORDS, density, ngrams, toCsv, tokenize } from './density'

describe('tokenize', () => {
  it('lowercases and keeps internal apostrophes', () => {
    expect(tokenize("It's a Nice-Day, isn't it?")).toEqual(["it's", 'a', 'nice', 'day', "isn't", 'it'])
  })

  it('returns an empty array for text without word characters', () => {
    expect(tokenize('!!! ---')).toEqual([])
    expect(tokenize('')).toEqual([])
  })
})

describe('ngrams', () => {
  it('builds word pairs and triples in order', () => {
    expect(ngrams(['a', 'b', 'c'], 2)).toEqual(['a b', 'b c'])
    expect(ngrams(['a', 'b', 'c'], 3)).toEqual(['a b c'])
  })

  it('returns nothing when the text is shorter than n', () => {
    expect(ngrams(['a'], 2)).toEqual([])
    expect(ngrams([], 1)).toEqual([])
  })
})

describe('density', () => {
  const base = { maxRows: 50, skipStopwords: false }

  it('counts unigram frequencies and percentage shares', () => {
    const { rows, totalGrams } = density('cat dog cat', { ...base, n: 1 })
    expect(totalGrams).toBe(3)
    expect(rows[0]).toEqual({ term: 'cat', count: 2, pct: (2 / 3) * 100 })
  })

  it('counts phrases for bigrams', () => {
    const { rows } = density('fast tools fast tools make fast sites', { ...base, n: 2 })
    const top = rows[0]
    expect(top.term).toBe('fast tools')
    expect(top.count).toBe(2)
  })

  it('filters grams made only of stopwords when asked', () => {
    const { rows } = density('the cat and the dog', { ...base, n: 1, skipStopwords: true })
    expect(rows.map((r) => r.term)).toEqual(['cat', 'dog'])
    expect([...STOPWORDS]).toContain('the')
  })

  it('respects maxRows and sorts by count then term', () => {
    const { rows } = density('b a c b a c b', { ...base, n: 1, maxRows: 2 })
    expect(rows).toHaveLength(2)
    expect(rows[0].term).toBe('b')
    expect(rows[1].term).toBe('a')
  })

  it('handles empty input safely', () => {
    const { rows, totalGrams, tokens } = density('', { ...base, n: 2 })
    expect(rows).toEqual([])
    expect(totalGrams).toBe(0)
    expect(tokens).toBe(0)
  })
})

describe('toCsv', () => {
  it('emits a header and one line per row', () => {
    const csv = toCsv([{ term: 'cat', count: 3, pct: 33.3333 }])
    expect(csv).toBe('term,count,density_pct\ncat,3,33.33')
  })

  it('quotes terms containing commas or quotes', () => {
    const csv = toCsv([{ term: 'say "hi", ok', count: 1, pct: 100 }])
    expect(csv).toContain('"say ""hi"", ok",1,100.00')
  })
})
