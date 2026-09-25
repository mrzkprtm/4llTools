import { describe, expect, it } from 'vitest'
import { encodeBase64 } from './base64/codec'
import { CASES, splitWords } from './case-converter/cases'
import { contrast, hslToRgb, parseColor, rgbToHex, rgbToHsl } from './color-converter/color'
import { csvToJson, jsonToCsv, parseCsv } from './csv-json/csv'
import { daysBetween, diffYmd, parseDate } from './date-calculator/dates'
import { groupByCategory } from './grouping'
import { hashText } from './hash-generator/hash'
import { escapeHtml } from './html-entities/entities'
import { decodeJwt, timeClaims } from './jwt-decoder/jwt'
import { applyLineAction } from './line-tools/lines'
import { monthlyPayment, schedule } from './loan-calculator/loan'
import { lorem } from './lorem-ipsum/lorem'
import { formatInBase, parseInBase } from './number-base/base'
import { afterDiscount, percentChange, percentOf, whatPercent } from './percentage-calculator/percent'
import { findMatches } from './regex-tester/regex'
import { tools } from './registry'
import { slugify } from './slug-generator/slug'
import { formatDuration } from './stopwatch-timer/format'
import { diffLines } from './text-diff/diff'
import { parseTimestamp } from './timestamp-converter/parse'

/** Deterministic random numbers so shuffles and lorem text are testable. */
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

describe('registry with all tools', () => {
  it('finds all 28 tools with unique names', () => {
    expect(tools).toHaveLength(28)
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length)
  })

  it('gives every tool a unique 1–3 character symbol', () => {
    for (const t of tools) expect([...t.symbol].length, t.slug).toBeGreaterThan(0)
    for (const t of tools) expect([...t.symbol].length, t.slug).toBeLessThanOrEqual(3)
    expect(new Set(tools.map((t) => t.symbol)).size).toBe(tools.length)
  })

  it('groups tools by category in alphabetical order', () => {
    const names = groupByCategory(tools).map(([c]) => c)
    expect(names).toEqual([...names].sort())
    expect(groupByCategory(tools).reduce((n, [, list]) => n + list.length, 0)).toBe(tools.length)
  })
})

describe('case converter', () => {
  const convert = (name: string, t: string) => CASES.find((c) => c.name === name)!.convert(t)

  it('splits camelCase and snake_case into words', () => {
    expect(splitWords('helloWorld_fooBar-baz')).toEqual(['hello', 'World', 'foo', 'Bar', 'baz'])
  })

  it('converts between cases', () => {
    expect(convert('camelCase', 'hello big world')).toBe('helloBigWorld')
    expect(convert('snake_case', 'Hello Big World')).toBe('hello_big_world')
    expect(convert('CONSTANT_CASE', 'maxValue')).toBe('MAX_VALUE')
    expect(convert('Title Case', 'hello wORLD')).toBe('Hello World')
    expect(convert('Sentence case', 'HELLO. HOW ARE YOU?')).toBe('Hello. How are you?')
  })
})

describe('lorem ipsum', () => {
  it('generates the requested amount', () => {
    expect(lorem(5, 'words', false, seeded()).split(' ')).toHaveLength(5)
    expect(lorem(3, 'paragraphs', true, seeded()).split('\n\n')).toHaveLength(3)
    expect(lorem(2, 'sentences', true, seeded())).toMatch(/^Lorem ipsum dolor sit amet, /)
  })
})

describe('text diff', () => {
  it('marks added and removed lines', () => {
    expect(diffLines('a\nb\nc', 'a\nc\nd')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'same', text: 'c' },
      { type: 'add', text: 'd' },
    ])
  })
})

describe('line tools', () => {
  it('sorts naturally, dedupes and removes empty lines', () => {
    expect(applyLineAction('b\na10\na2', 'sort')).toBe('a2\na10\nb')
    expect(applyLineAction('x\nX\nx', 'dedupe', false)).toBe('x')
    expect(applyLineAction('x\nX\nx', 'dedupe', true)).toBe('x\nX')
    expect(applyLineAction('a\n\n \nb', 'remove-empty')).toBe('a\nb')
  })

  it('shuffles without losing lines', () => {
    expect(applyLineAction('1\n2\n3\n4', 'shuffle', true, seeded()).split('\n').sort()).toEqual(['1', '2', '3', '4'])
  })
})

describe('slug', () => {
  it('strips accents and symbols', () => {
    expect(slugify('Café & Crème Brûlée!!')).toBe('cafe-and-creme-brulee')
    expect(slugify('  Hello World  ', '_')).toBe('hello_world')
  })
})

describe('hash', () => {
  it('matches a known SHA-256', async () => {
    expect(await hashText('SHA-256', 'abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('jwt', () => {
  // Built at runtime so the repo holds no literal token for secret scanners to flag.
  const b64url = (o: object) => encodeBase64(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const token = [b64url({ alg: 'HS256', typ: 'JWT' }), b64url({ sub: '42', name: 'John Doe', iat: 1516239022 }), 'signature'].join('.')

  it('decodes header and payload', () => {
    const r = decodeJwt('Bearer ' + token)
    expect(r.ok && r.payload.name).toBe('John Doe')
    expect(r.ok && timeClaims(r.payload)[0].claim).toBe('iat')
  })

  it('rejects malformed tokens', () => {
    expect(decodeJwt('abc').ok).toBe(false)
    expect(decodeJwt('a.b.c').ok).toBe(false)
  })
})

describe('regex', () => {
  it('finds matches with groups', () => {
    const r = findMatches('(\\w+)@(\\w+)', 'g', 'a@b and c@d')
    expect(r.ok && r.matches.map((m) => m.groups)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('stops after the first match without the g flag', () => {
    const r = findMatches('\\d', '', '1 2 3')
    expect(r.ok && r.matches).toHaveLength(1)
  })

  it('reports bad patterns', () => {
    expect(findMatches('(', 'g', 'x').ok).toBe(false)
  })
})

describe('timestamp', () => {
  it('reads seconds and milliseconds', () => {
    expect(parseTimestamp('0')?.toISOString()).toBe('1970-01-01T00:00:00.000Z')
    expect(parseTimestamp('1700000000')?.getTime()).toBe(1700000000000)
    expect(parseTimestamp('1700000000000')?.getTime()).toBe(1700000000000)
    expect(parseTimestamp('abc')).toBeNull()
  })
})

describe('number base', () => {
  it('converts between bases exactly', () => {
    expect(parseInBase('0xff', 16)).toBe(255n)
    expect(formatInBase(255n, 2)).toBe('11111111')
    expect(parseInBase('12', 2)).toBeNull()
    expect(formatInBase(parseInBase('18446744073709551615', 10)!, 16)).toBe('ffffffffffffffff')
  })
})

describe('html entities', () => {
  it('escapes special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;')
    expect(escapeHtml('é', true)).toBe('&#233;')
  })
})

describe('csv', () => {
  it('parses quoted fields', () => {
    expect(parseCsv('a,"b,c","d ""q"""\r\n1,2,3')).toEqual([
      ['a', 'b,c', 'd "q"'],
      ['1', '2', '3'],
    ])
  })

  it('round-trips through JSON', () => {
    const csv = 'name,city\nBudi,"Bandung, Jabar"'
    expect(csvToJson(csv)).toEqual([{ name: 'Budi', city: 'Bandung, Jabar' }])
    expect(jsonToCsv(csvToJson(csv))).toBe(csv)
  })
})

describe('color', () => {
  it('converts between formats', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(rgbToHex({ r: 79, g: 70, b: 229 })).toBe('#4f46e5')
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 })
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 })
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3 })
    expect(parseColor('nope')).toBeNull()
  })

  it('computes contrast', () => {
    expect(contrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21)
  })
})

describe('percentage', () => {
  it('computes the common cases', () => {
    expect(percentOf(20, 150)).toBe(30)
    expect(whatPercent(30, 120)).toBe(25)
    expect(percentChange(100, 125)).toBe(25)
    expect(afterDiscount(200, 15)).toBe(170)
  })
})

describe('dates', () => {
  it('computes age and days between', () => {
    expect(diffYmd(parseDate('2000-01-31')!, parseDate('2024-03-01')!)).toEqual({ years: 24, months: 1, days: 1 })
    expect(daysBetween(parseDate('2024-01-01')!, parseDate('2025-01-01')!)).toBe(366)
    expect(parseDate('bad')).toBeNull()
  })
})

describe('loan', () => {
  it('matches the annuity formula and pays off fully', () => {
    expect(monthlyPayment(100_000, 12, 12)).toBeCloseTo(8884.88, 2)
    expect(monthlyPayment(1200, 0, 12)).toBe(100)
    const rows = schedule(100_000, 12, 12)
    expect(rows).toHaveLength(12)
    expect(rows.at(-1)!.balance).toBe(0)
  })
})

describe('stopwatch', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('00:00.00')
    expect(formatDuration(61_230)).toBe('01:01.23')
    expect(formatDuration(3_661_000, false)).toBe('1:01:01')
  })
})

describe('dates edge cases', () => {
  it('handles birthdays and month ends', () => {
    expect(diffYmd(parseDate('1990-05-10')!, parseDate('2026-05-10')!)).toEqual({ years: 36, months: 0, days: 0 })
    expect(diffYmd(parseDate('1990-05-10')!, parseDate('2026-05-09')!)).toEqual({ years: 35, months: 11, days: 29 })
    expect(diffYmd(parseDate('2024-01-15')!, parseDate('2024-01-20')!)).toEqual({ years: 0, months: 0, days: 5 })
  })
})
