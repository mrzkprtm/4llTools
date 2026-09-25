import { describe, expect, it } from 'vitest'
import { baseLang, groupVoices, pickDefaultVoice, splitForSpeech, wordAt } from './speech'

const voices = [
  { name: 'Zira', lang: 'en-US' },
  { name: 'Amelie', lang: 'fr-CA' },
  { name: 'Damayanti', lang: 'id-ID', localService: true },
  { name: 'Daniel', lang: 'en-GB' },
  { name: 'Anna', lang: 'de_DE' },
]

describe('voices', () => {
  it('normalises language codes', () => {
    expect(baseLang('en-US')).toBe('en')
    expect(baseLang('de_DE')).toBe('de')
    expect(baseLang('')).toBe('und')
  })

  it('groups voices with Indonesian and English first', () => {
    const g = groupVoices(voices)
    expect(g).toHaveLength(4)
    expect(g[0].code).toBe('id')
    expect(g[1].code).toBe('en')
    expect(g[1].voices.map((v) => v.lang)).toEqual(['en-GB', 'en-US'])
    expect(g.slice(2).map((x) => x.label)).toEqual([...g.slice(2).map((x) => x.label)].sort())
  })

  it('picks a preferred default voice', () => {
    expect(pickDefaultVoice(voices)?.name).toBe('Damayanti')
    expect(pickDefaultVoice([{ name: 'X', lang: 'ja-JP' }, { name: 'Y', lang: 'ko-KR', default: true }])?.name).toBe('Y')
    expect(pickDefaultVoice([])).toBeUndefined()
  })
})

describe('splitForSpeech', () => {
  it('keeps offsets that map back to the original text', () => {
    const text = 'One sentence here. Another one! And a third?\nNew line.'
    const chunks = splitForSpeech(text, 25)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(text.slice(c.start, c.start + c.text.length)).toBe(c.text)
    expect(chunks.map((c) => c.text).join('').replace(/\s+/g, ' ').trim()).toBe(text.replace(/\s+/g, ' ').trim())
  })

  it('hard-splits a very long sentence at spaces', () => {
    const text = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')
    const chunks = splitForSpeech(text, 50)
    expect(chunks.every((c) => c.text.length <= 50)).toBe(true)
    for (const c of chunks) expect(text.slice(c.start, c.start + c.text.length)).toBe(c.text)
  })

  it('returns nothing for blank text', () => {
    expect(splitForSpeech('   \n  ')).toEqual([])
  })
})

describe('wordAt', () => {
  it('finds the word around an index', () => {
    const t = 'hello brave world'
    expect(wordAt(t, 6)).toEqual([6, 11])
    expect(wordAt(t, 8)).toEqual([6, 11])
    expect(t.slice(...wordAt(t, 0))).toBe('hello')
  })
})
