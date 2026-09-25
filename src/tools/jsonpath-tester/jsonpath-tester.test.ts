import { describe, expect, it } from 'vitest'
import { CHEATSHEET, evaluate, toDotPath } from './evaluate'
import { EXAMPLE } from './example'

const run = (p: string) => {
  const r = evaluate(EXAMPLE, p)
  if (!r.ok) throw new Error(r.error)
  return r.matches
}

describe('jsonpath-tester', () => {
  it('evaluates filters and returns paths and pointers', () => {
    const m = run('$..book[?(@.price < 10)].title')
    expect(m.map((x) => x.value)).toEqual(['Sayings of the Century', 'Moby Dick'])
    expect(m[0].dotPath).toBe('$.store.book[0].title')
    expect(m[0].pointer).toBe('/store/book/0/title')
  })

  it('supports recursive descent and wildcards', () => {
    expect(run('$..author')).toHaveLength(4)
    expect(run('$.store.*').length).toBe(2)
  })

  it('returns an empty list when nothing matches', () => {
    expect(run('$.nope')).toEqual([])
  })

  it('reports invalid JSON and invalid expressions separately', () => {
    expect(evaluate('{bad', '$')).toMatchObject({ ok: false, where: 'json' })
    expect(evaluate(EXAMPLE, 'store')).toMatchObject({ ok: false, where: 'path' })
    expect(evaluate(EXAMPLE, '$..book[?(@.price <<)]')).toMatchObject({ ok: false, where: 'path' })
  })

  it('quotes odd keys in dot paths', () => {
    expect(toDotPath("$['a']['b c'][2]")).toBe('$.a["b c"][2]')
  })

  it('every cheat sheet example runs against the sample', () => {
    for (const c of CHEATSHEET) expect(evaluate(EXAMPLE, c.expr).ok, c.expr).toBe(true)
  })
})
