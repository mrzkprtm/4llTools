import { describe, expect, it } from 'vitest'
import { ConvertError, convert, detectFormat, parseInput } from './convert'

describe('yaml-json-toml', () => {
  const json = '{"name":"app","port":8080,"tags":["a","b"],"db":{"host":"localhost","ssl":true}}'

  it('round-trips JSON → YAML → TOML → JSON', () => {
    const yaml = convert(json, 'json', 'yaml').output
    expect(yaml).toContain('port: 8080')
    const toml = convert(yaml, 'yaml', 'toml').output
    expect(toml).toContain('[db]')
    const back = convert(toml, 'toml', 'json', { indent: 0 }).output
    expect(JSON.parse(back)).toEqual(JSON.parse(json))
  })

  it('detects formats', () => {
    expect(detectFormat(json)).toBe('json')
    expect(detectFormat('a: 1\nb:\n  - x')).toBe('yaml')
    expect(detectFormat('[server]\nport = 80\nhost = "x"')).toBe('toml')
    expect(detectFormat('title = "x"')).toBe('toml')
  })

  it('turns multiple YAML documents into a JSON array and back', () => {
    const r = convert('a: 1\n---\nb: 2\n', 'yaml', 'json', { indent: 0 })
    expect(r.documents).toBe(2)
    expect(JSON.parse(r.output)).toEqual([{ a: 1 }, { b: 2 }])
    expect(convert('a: 1\n---\nb: 2\n', 'yaml', 'yaml').output).toBe('a: 1\n---\nb: 2\n')
  })

  it('reports parse errors with line and column', () => {
    const cases: [string, 'json' | 'yaml' | 'toml'][] = [
      ['{\n  "a": 1,\n}', 'json'],
      ['a: 1\nb: [1,\nc: 2', 'yaml'],
      ['a = 1\nb = = 2', 'toml'],
    ]
    for (const [text, fmt] of cases) {
      try {
        parseInput(text, fmt)
        throw new Error('should fail')
      } catch (e) {
        expect(e).toBeInstanceOf(ConvertError)
        expect((e as ConvertError).line).toBeGreaterThan(1)
      }
    }
  })

  it('explains TOML limits', () => {
    expect(() => convert('[1,2]', 'json', 'toml')).toThrow(/top level/)
    expect(() => convert('{"a":{"b":null}}', 'json', 'toml')).toThrow(/a\.b/)
    expect(() => convert('{"a":[1,null]}', 'json', 'toml')).toThrow(/null/)
  })

  it('keeps TOML dates as strings', () => {
    expect(JSON.parse(convert('d = 1979-05-27T07:32:00Z', 'toml', 'json').output)).toEqual({ d: '1979-05-27T07:32:00.000Z' })
  })
})
