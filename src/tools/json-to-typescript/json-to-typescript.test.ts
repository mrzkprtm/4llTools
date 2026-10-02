import { describe, expect, it } from 'vitest'
import { generate, infer, pascalCase, propKey, singular, type GenOptions } from './infer'

const base: GenOptions = { mode: 'interface', rootName: 'Root', exported: true, readonly: false }
const ts = (v: unknown, o: Partial<GenOptions> = {}) => generate(v, { ...base, ...o })

describe('json-to-typescript inference', () => {
  it('builds nested interfaces with PascalCase names', () => {
    const out = ts({ id: 1, name: 'Ada', home_address: { city: 'Paris', zip: '75001' } })
    expect(out).toContain('export interface Root {\n  id: number;\n  name: string;\n  home_address: HomeAddress;\n}')
    expect(out).toContain('export interface HomeAddress {\n  city: string;\n  zip: string;\n}')
    expect(out.indexOf('interface Root')).toBeLessThan(out.indexOf('interface HomeAddress'))
  })

  it('merges array element shapes and marks missing fields optional', () => {
    const out = ts({ users: [{ id: 1, email: 'a@x.io' }, { id: 2, nick: null }] })
    expect(out).toContain('users: User[];')
    expect(out).toMatch(/interface User \{\n {2}id: number;\n {2}email\?: string;\n {2}nick\?: null;\n\}/)
  })

  it('unions primitives, keeps null last and parenthesises array unions', () => {
    const out = ts({ v: [1, 'a', null], w: [1, 2.5], x: [] })
    expect(out).toContain('v: (string | number | null)[];')
    expect(out).toContain('w: number[];')
    expect(out).toContain('x: unknown[];')
  })

  it('quotes keys that are not identifiers', () => {
    expect(propKey('first-name')).toBe('"first-name"')
    expect(propKey('$ok_1')).toBe('$ok_1')
    expect(ts({ 'first-name': 'a', '2x': 1 })).toContain('"first-name": string;')
  })

  it('names things sensibly', () => {
    expect(pascalCase('home_address')).toBe('HomeAddress')
    expect(pascalCase('userId')).toBe('UserId')
    expect(pascalCase('123')).toBe('T123')
    expect(singular('Categories')).toBe('Category')
    expect(singular('Boxes')).toBe('Box')
    expect(singular('Data')).toBe('DataItem')
  })

  it('reuses one declaration for identical shapes and avoids clashing with the root name', () => {
    const out = ts({ from: { x: 1, y: 2 }, to: { x: 3, y: 4 }, root: { a: true } })
    expect(out.match(/interface From/g)).toHaveLength(1)
    expect(out).toContain('to: From;')
    expect(out).toContain('root: Root2;')
  })

  it('supports type aliases, readonly and no export', () => {
    const out = ts({ tags: ['a'] }, { mode: 'type', readonly: true, exported: false })
    expect(out).toBe('type Root = {\n  readonly tags: readonly string[];\n};\n')
  })

  it('handles array and primitive roots', () => {
    expect(ts([{ a: 1 }], { rootName: 'products' })).toContain('export type Products = ProductsItem[];')
    expect(ts('hi')).toBe('export type Root = string;\n')
  })

  it('emits Zod with children declared before parents', () => {
    const out = ts({ id: 1, price: 2.5, meta: { tag: 'x', note: null }, list: [{ a: 1 }, {}] }, { mode: 'zod' })
    expect(out).toContain('import { z } from "zod";')
    expect(out.indexOf('const MetaSchema')).toBeLessThan(out.indexOf('const RootSchema'))
    expect(out).toContain('id: z.number().int(),')
    expect(out).toContain('price: z.number(),')
    expect(out).toContain('note: z.null(),')
    expect(out).toContain('a: z.number().int().optional(),')
    expect(out).toContain('export type Root = z.infer<typeof RootSchema>;')
  })

  it('emits a draft 2020-12 JSON Schema with $defs and required', () => {
    const doc = JSON.parse(ts({ id: 1, tags: ['a'], owner: { name: 'x', age: null } }, { mode: 'schema' }))
    expect(doc.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(doc.required).toEqual(['id', 'tags', 'owner'])
    expect(doc.properties.id).toEqual({ type: 'integer' })
    expect(doc.properties.tags).toEqual({ type: 'array', items: { type: 'string' } })
    expect(doc.properties.owner).toEqual({ $ref: '#/$defs/Owner' })
    expect(doc.$defs.Owner.properties.age).toEqual({ type: 'null' })
  })

  it('treats integer + float as number', () => {
    const s = infer([1, 2.5])
    expect([...s.arr!.prims]).toEqual(['number'])
  })
})
