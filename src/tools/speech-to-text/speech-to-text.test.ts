import { describe, expect, it } from 'vitest'
import { LANGUAGES, appendPhrase, applyCommands, describeError, tidy } from './transcript'

describe('applyCommands', () => {
  it('turns English punctuation words into symbols', () => {
    expect(applyCommands('hello comma how are you question mark')).toBe('Hello, how are you?')
    expect(applyCommands('first line new line second line full stop')).toBe('First line\nSecond line.')
  })

  it('understands Indonesian commands', () => {
    expect(applyCommands('halo semua koma apa kabar tanda tanya')).toBe('Halo semua, apa kabar?')
    expect(applyCommands('catatan titik dua beli susu titik')).toBe('Catatan: beli susu.')
    expect(applyCommands('satu paragraf baru dua')).toBe('Satu\n\nDua')
  })

  it('leaves words that only contain a command alone', () => {
    expect(applyCommands('the comma-separated list')).toBe('The comma-separated list')
    expect(applyCommands('periodically')).toBe('Periodically')
  })
})

describe('tidy and append', () => {
  it('fixes spacing and capitalises sentences', () => {
    expect(tidy('hi , there .  next one ! ok')).toBe('Hi, there. Next one! Ok')
  })

  it('joins phrases with one space', () => {
    expect(appendPhrase('', ' hello ')).toBe('hello')
    expect(appendPhrase('hello', 'world')).toBe('hello world')
    expect(appendPhrase('hello\n', 'world')).toBe('hello\nworld')
    expect(appendPhrase('hello', '')).toBe('hello')
  })
})

describe('misc', () => {
  it('lists Indonesian first and explains errors', () => {
    expect(LANGUAGES[0][0]).toBe('id-ID')
    expect(describeError('not-allowed')).toMatch(/blocked/)
    expect(describeError('weird')).toContain('weird')
  })
})
