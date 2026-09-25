import { describe, expect, it } from 'vitest'
import { decodeBase64, encodeBase64 } from './base64/codec'
import { formatJson } from './json-formatter/format'
import { generatePassword } from './password-generator/generate'
import { isHttpUrl } from './qr-reader/decode'
import { convert } from './unit-converter/units'
import { countText } from './word-counter/count'
import { searchTools, tools } from './registry'

describe('registry', () => {
  it('finds every tool folder', () => {
    expect(tools.map((t) => t.slug)).toContain('qr-reader')
    expect(tools.length).toBeGreaterThanOrEqual(8)
  })

  it('searches by keyword, including Indonesian ones', () => {
    expect(searchTools(tools, 'kamera').map((t) => t.slug)).toEqual(['qr-reader'])
  })
})

describe('base64', () => {
  it('round-trips unicode', () => {
    const text = 'Halo dunia 👋 é'
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('accepts url-safe input without padding', () => {
    expect(decodeBase64('aGk_')).toBe(decodeBase64('aGk/'))
  })

  it('rejects garbage', () => {
    expect(() => decodeBase64('%%%')).toThrow()
  })
})

describe('json', () => {
  it('formats and minifies', () => {
    expect(formatJson('{"a":[1,2]}', 2)).toEqual({ ok: true, text: '{\n  "a": [\n    1,\n    2\n  ]\n}' })
    expect(formatJson('{ "a" : 1 }', 'min')).toEqual({ ok: true, text: '{"a":1}' })
  })

  it('reports invalid json', () => {
    expect(formatJson('{a:1}', 2).ok).toBe(false)
  })
})

describe('password', () => {
  it('uses the requested length and every chosen set', () => {
    const pw = generatePassword({ length: 12, lower: true, upper: true, digits: true, symbols: false, avoidAmbiguous: false })
    expect(pw).toHaveLength(12)
    expect(pw).toMatch(/[a-z]/)
    expect(pw).toMatch(/[A-Z]/)
    expect(pw).toMatch(/[0-9]/)
    expect(pw).not.toMatch(/[^a-zA-Z0-9]/)
  })

  it('returns nothing when no set is chosen', () => {
    expect(generatePassword({ length: 12, lower: false, upper: false, digits: false, symbols: false, avoidAmbiguous: false })).toBe('')
  })
})

describe('units', () => {
  it('converts length and temperature', () => {
    expect(convert(1, 'Length', 'Kilometer', 'Meter')).toBe(1000)
    expect(convert(100, 'Temperature', 'Celsius', 'Fahrenheit')).toBe(212)
    expect(convert(0, 'Temperature', 'Celsius', 'Kelvin')).toBeCloseTo(273.15)
  })
})

describe('word counter', () => {
  it('counts words, sentences and paragraphs', () => {
    const s = countText('Hello there. How are you?\n\nFine!')
    expect(s.words).toBe(6)
    expect(s.sentences).toBe(3)
    expect(s.paragraphs).toBe(2)
  })

  it('handles empty text', () => {
    expect(countText('   ').words).toBe(0)
  })
})

describe('qr reader', () => {
  it('only treats http(s) links as openable', () => {
    expect(isHttpUrl('https://example.com')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('WIFI:S:home;;')).toBe(false)
  })
})
