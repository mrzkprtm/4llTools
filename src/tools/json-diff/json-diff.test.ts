import { describe, expect, it } from 'vitest'
import { applyPatch, deepEqual, diff, summarize, toDisplayPath, toPatch, toPointer } from './diff'

const A = { name: 'api', version: 1, tags: ['a', 'b'], deps: { x: '1.0', y: '2.0' }, old: true }
const B = { deps: { y: '2.1', x: '1.0', z: '0.1' }, version: 2, name: 'api', tags: ['a', 'b', 'c'] }

describe('json-diff', () => {
  it('ignores object key order', () => {
    expect(diff({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toEqual([])
  })

  it('finds added, removed and changed values with paths', () => {
    const changes = diff(A, B)
    const byPath = Object.fromEntries(changes.map((c) => [toDisplayPath(c.path), c.op]))
    expect(byPath).toEqual({ '$.version': 'replace', '$.tags[2]': 'add', '$.deps.y': 'replace', '$.deps.z': 'add', '$.old': 'remove' })
    expect(summarize(changes)).toEqual({ add: 2, remove: 1, replace: 2 })
  })

  it('treats a type change as one replace', () => {
    expect(diff({ a: [1] }, { a: { 0: 1 } })).toEqual([{ op: 'replace', path: ['a'], oldValue: [1], value: { 0: 1 } }])
  })

  it('compares arrays by position unless told to ignore order', () => {
    expect(diff([1, 2, 3], [3, 2, 1]).length).toBe(2)
    expect(diff([1, 2, 3], [3, 2, 1], { ignoreArrayOrder: true })).toEqual([])
    expect(deepEqual([{ a: [1, 2] }], [{ a: [2, 1] }], true)).toBe(true)
    const c = diff([1, 2, 2], [2, 4], { ignoreArrayOrder: true })
    expect(c.map((x) => x.op)).toEqual(['remove', 'remove', 'add'])
  })

  it('escapes JSON Pointer tokens', () => {
    expect(toPointer(['a/b', 'm~n', '0'])).toBe('/a~1b/m~0n/0')
  })

  it('produces a JSON Patch that turns A into B', () => {
    const cases: [unknown, unknown][] = [
      [A, B],
      [[1, 2, 3, 4], [1, 9]],
      [{ list: [{ id: 1 }, { id: 2 }] }, { list: [{ id: 1, x: true }] }],
      [1, 'one'],
    ]
    for (const [a, b] of cases) expect(applyPatch(a, toPatch(diff(a, b)))).toEqual(b)
    const unordered = applyPatch([1, 2, 2], toPatch(diff([1, 2, 2], [2, 4], { ignoreArrayOrder: true }))) as number[]
    expect([...unordered].sort()).toEqual([2, 4])
  })
})
