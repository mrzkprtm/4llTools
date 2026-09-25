import { describe, expect, it } from 'vitest'
import { applyCase, englishInt, indonesianInt, ordinalize, parseNumber, toCents, toEnglish, toIndonesian, type ParsedNumber } from './words'

const p = (s: string, sep: '.' | ',' | 'auto' = 'auto'): ParsedNumber => {
  const r = parseNumber(s, sep)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('number-to-words: parsing', () => {
  it('reads thousands and decimal separators in both conventions', () => {
    expect(p('1,250,000.75')).toEqual({ negative: false, int: '1250000', frac: '75' })
    expect(p('1.250.000,75')).toEqual({ negative: false, int: '1250000', frac: '75' })
    expect(p('1.250.000')).toMatchObject({ int: '1250000', frac: '' })
    expect(p('12.500')).toMatchObject({ int: '12500' })
    expect(p('3,14')).toMatchObject({ int: '3', frac: '14' })
    expect(p('0.125')).toMatchObject({ int: '0', frac: '125' })
    expect(p('12.500', '.')).toMatchObject({ int: '12', frac: '5' })
    expect(p('Rp 1.500.000')).toMatchObject({ int: '1500000' })
    expect(p('-0042')).toEqual({ negative: true, int: '42', frac: '' })
    expect(p('-0')).toMatchObject({ negative: false })
  })

  it('rejects junk, bad grouping and huge numbers', () => {
    expect(parseNumber('abc').ok).toBe(false)
    expect(parseNumber('1,25,000').ok).toBe(false)
    expect(parseNumber('9'.repeat(19)).ok).toBe(false)
    expect(parseNumber('9'.repeat(18)).ok).toBe(true)
  })

  it('rounds money half up with carry', () => {
    expect(toCents(p('1.005', '.'))).toEqual({ int: '1', cents: 1 })
    expect(toCents(p('9.999', '.'))).toEqual({ int: '10', cents: 0 })
  })
})

describe('number-to-words: English', () => {
  it('writes cardinals', () => {
    expect(englishInt('0')).toBe('zero')
    expect(englishInt('21')).toBe('twenty-one')
    expect(englishInt('105')).toBe('one hundred five')
    expect(englishInt('105', true)).toBe('one hundred and five')
    expect(englishInt('1005', true)).toBe('one thousand and five')
    expect(englishInt('1250000')).toBe('one million two hundred fifty thousand')
    expect(englishInt('1000000000000000')).toBe('one quadrillion')
    expect(englishInt('999999999999999999')).toMatch(/^nine hundred ninety-nine quadrillion .* nine hundred ninety-nine$/)
  })

  it('writes decimals, negatives and ordinals', () => {
    expect(toEnglish(p('-3.05'), { style: 'cardinal' })).toBe('negative three point zero five')
    expect(ordinalize('twenty-one')).toBe('twenty-first')
    expect(toEnglish(p('112'), { style: 'ordinal' })).toBe('one hundred twelfth')
    expect(toEnglish(p('40'), { style: 'ordinal' })).toBe('fortieth')
    expect(toEnglish(p('0'), { style: 'ordinal' })).toBe('zeroth')
    expect(() => toEnglish(p('1.5'), { style: 'ordinal' })).toThrow()
  })

  it('writes currency and check amounts', () => {
    expect(toEnglish(p('1250.75'), { style: 'currency' })).toBe('one thousand two hundred fifty dollars and seventy-five cents')
    expect(toEnglish(p('1.01'), { style: 'currency' })).toBe('one dollar and one cent')
    expect(toEnglish(p('2'), { style: 'currency', major: ['euro', 'euros'] })).toBe('two euros')
    expect(applyCase(toEnglish(p('1250.75'), { style: 'check' }), 'upper')).toBe('ONE THOUSAND TWO HUNDRED FIFTY AND 75/100 DOLLARS')
  })
})

describe('number-to-words: Indonesian terbilang', () => {
  const cases: [string, string][] = [
    ['0', 'nol'],
    ['1', 'satu'],
    ['10', 'sepuluh'],
    ['11', 'sebelas'],
    ['12', 'dua belas'],
    ['19', 'sembilan belas'],
    ['20', 'dua puluh'],
    ['21', 'dua puluh satu'],
    ['100', 'seratus'],
    ['101', 'seratus satu'],
    ['111', 'seratus sebelas'],
    ['200', 'dua ratus'],
    ['1000', 'seribu'],
    ['1001', 'seribu satu'],
    ['1100', 'seribu seratus'],
    ['1111', 'seribu seratus sebelas'],
    ['2000', 'dua ribu'],
    ['11000', 'sebelas ribu'],
    ['101000', 'seratus satu ribu'],
    ['1000000', 'satu juta'],
    ['1001000', 'satu juta seribu'],
    ['1250000', 'satu juta dua ratus lima puluh ribu'],
    ['1000000000', 'satu miliar'],
    ['2000000000000', 'dua triliun'],
    ['1000000000000000', 'satu kuadriliun'],
  ]
  it.each(cases)('%s → %s', (n, words) => {
    expect(indonesianInt(n)).toBe(words)
  })

  it('handles decimals (koma), negatives and rupiah', () => {
    expect(toIndonesian(p('1,5'), { rupiah: false })).toBe('satu koma lima')
    expect(toIndonesian(p('0,05'), { rupiah: false })).toBe('nol koma nol lima')
    expect(toIndonesian(p('-7'), { rupiah: false })).toBe('minus tujuh')
    expect(toIndonesian(p('Rp1.250.000'), { rupiah: true })).toBe('satu juta dua ratus lima puluh ribu rupiah')
    expect(toIndonesian(p('1500,50'), { rupiah: true })).toBe('seribu lima ratus rupiah lima puluh sen')
    expect(applyCase(toIndonesian(p('1.000'), { rupiah: true }), 'title')).toBe('Seribu Rupiah')
  })
})
