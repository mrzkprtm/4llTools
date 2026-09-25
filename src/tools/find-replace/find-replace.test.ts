import { describe, expect, it } from 'vitest'
import { applyRules, buildRegex, findMatches, type Options, type Rule } from './replace'

const plain: Options = { regex: false, caseSensitive: false, wholeWord: false, multiline: false, dotAll: false }
const regex: Options = { ...plain, regex: true }
const rule = (find: string, replace: string, enabled = true): Rule => ({ id: find, find, replace, enabled })

describe('find', () => {
  it('escapes plain text and respects case', () => {
    const b = buildRegex('a.b', plain)
    if (!b.ok) throw new Error()
    expect(findMatches('a.b axb A.B', b.re).map((m) => m.text)).toEqual(['a.b', 'A.B'])
    const c = buildRegex('a.b', { ...plain, caseSensitive: true })
    if (!c.ok) throw new Error()
    expect(findMatches('a.b A.B', c.re)).toHaveLength(1)
  })

  it('matches whole words, including accented ones', () => {
    const b = buildRegex('cat', { ...plain, wholeWord: true })
    if (!b.ok) throw new Error()
    expect(findMatches('cat concat cat_ cats, cat.', b.re).map((m) => m.index)).toEqual([0, 22])
    const e = buildRegex('café', { ...plain, wholeWord: true })
    if (!e.ok) throw new Error()
    expect(findMatches('café cafés', e.re)).toHaveLength(1)
  })

  it('reports invalid regex', () => {
    const b = buildRegex('(unclosed', regex)
    expect(b.ok).toBe(false)
    if (!b.ok) expect(b.error).toMatch(/unterminated|missing|\)/i)
    expect(buildRegex('', regex)).toEqual({ ok: false, error: '' })
  })

  it('does not loop on empty matches', () => {
    const b = buildRegex('^', { ...regex, multiline: true })
    if (!b.ok) throw new Error()
    expect(findMatches('a\nb\nc', b.re)).toHaveLength(3)
  })
})

describe('replace', () => {
  it('applies rules in order', () => {
    const { output, results } = applyRules('red green red', [rule('red', 'blue'), rule('blue', 'navy'), rule('green', 'x', false)], plain)
    expect(output).toBe('navy green navy')
    expect(results.map((r) => r.count)).toEqual([2, 2, 0])
  })

  it('supports numbered and named groups in regex mode', () => {
    expect(applyRules('2026-09-25', [rule('(\\d{4})-(\\d{2})-(\\d{2})', '$3/$2/$1')], regex).output).toBe('25/09/2026')
    expect(applyRules('John Smith', [rule('(?<first>\\w+) (?<last>\\w+)', '$<last>, $<first>')], regex).output).toBe('Smith, John')
    expect(applyRules('a b', [rule(' ', '\\n')], regex).output).toBe('a\nb')
  })

  it('treats $ literally in plain mode', () => {
    expect(applyRules('price', [rule('price', '$1.00')], plain).output).toBe('$1.00')
  })

  it('keeps going past a broken rule and reports it', () => {
    const { output, results } = applyRules('aa', [rule('[', 'x'), rule('a', 'b')], regex)
    expect(output).toBe('bb')
    expect(results[0].error).not.toBe('')
  })

  it('handles multiline and dotAll', () => {
    expect(applyRules('one\ntwo', [rule('^', '> ')], { ...regex, multiline: true }).output).toBe('> one\n> two')
    expect(applyRules('a\nb', [rule('a.b', 'X')], { ...regex, dotAll: true }).output).toBe('X')
  })
})
