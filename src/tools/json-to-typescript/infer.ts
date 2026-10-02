/**
 * Infers a type shape from sample JSON and prints it as TypeScript, Zod or JSON Schema.
 *
 * A shape is a set of possibilities: the primitive kinds seen, plus at most one
 * merged object shape and one merged array-element shape. Merging two samples
 * just unions those parts, so `[{a:1},{a:"x",b:null}]` becomes one object with
 * `a: number | string` and an optional `b: null`.
 */

export type Prim = 'string' | 'integer' | 'number' | 'boolean' | 'null'

export interface Shape {
  prims: Set<Prim>
  obj?: ObjShape
  /** Element shape when an array was seen. */
  arr?: Shape
}

export interface ObjShape {
  /** How many object samples were merged. A field seen fewer times is optional. */
  count: number
  fields: Map<string, { shape: Shape; count: number }>
}

const empty = (): Shape => ({ prims: new Set() })

export function infer(value: unknown): Shape {
  const s = empty()
  if (value === null) s.prims.add('null')
  else if (typeof value === 'string') s.prims.add('string')
  else if (typeof value === 'number') s.prims.add(Number.isInteger(value) ? 'integer' : 'number')
  else if (typeof value === 'boolean') s.prims.add('boolean')
  else if (Array.isArray(value)) s.arr = value.reduce<Shape>((acc, v) => merge(acc, infer(v)), empty())
  else if (typeof value === 'object') {
    const fields = new Map<string, { shape: Shape; count: number }>()
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) fields.set(k, { shape: infer(v), count: 1 })
    s.obj = { count: 1, fields }
  }
  return s
}

export function merge(a: Shape, b: Shape): Shape {
  const prims = new Set([...a.prims, ...b.prims])
  if (prims.has('number')) prims.delete('integer')
  const out: Shape = { prims }
  if (a.arr || b.arr) out.arr = a.arr && b.arr ? merge(a.arr, b.arr) : (a.arr ?? b.arr)
  if (a.obj || b.obj) out.obj = a.obj && b.obj ? mergeObj(a.obj, b.obj) : (a.obj ?? b.obj)
  return out
}

function mergeObj(a: ObjShape, b: ObjShape): ObjShape {
  const fields = new Map<string, { shape: Shape; count: number }>()
  for (const [k, f] of a.fields) fields.set(k, { ...f })
  for (const [k, f] of b.fields) {
    const prev = fields.get(k)
    fields.set(k, prev ? { shape: merge(prev.shape, f.shape), count: prev.count + f.count } : { ...f })
  }
  return { count: a.count + b.count, fields }
}

const isEmpty = (s: Shape) => s.prims.size === 0 && !s.obj && !s.arr

// ---------------------------------------------------------------- naming

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const RESERVED = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with'.split(' '))

/** A property key as written in TS/JS source: bare when it's a valid identifier, otherwise quoted. */
export function propKey(key: string): string {
  return IDENT.test(key) ? key : JSON.stringify(key)
}

export function pascalCase(raw: string): string {
  const words = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
  let name = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  if (!name) name = 'Item'
  if (/^\d/.test(name)) name = `T${name}`
  if (RESERVED.has(name.toLowerCase()) && name === name.toLowerCase()) name = `${name}Type`
  return name
}

export function singular(word: string): string {
  if (/ies$/i.test(word) && word.length > 4) return word.slice(0, -3) + 'y'
  if (/(ss|us|is)$/i.test(word)) return word
  if (/(ches|shes|xes|sses)$/i.test(word)) return word.slice(0, -2)
  if (/s$/i.test(word) && word.length > 3) return word.slice(0, -1)
  return `${word}Item`
}

// ---------------------------------------------------------------- naming pass

interface Named {
  name: string
  obj: ObjShape
  /** Structural signature used to reuse identical declarations. */
  sig: string
}

class Namer {
  decls: Named[] = []
  private byObj = new Map<ObjShape, Named>()
  private bySig = new Map<string, Named>()
  private used = new Set<string>()

  constructor(reserved: string[]) {
    reserved.forEach((r) => this.used.add(r))
  }

  /** Names every object shape reachable from `s`, children first (so Zod consts are declared before use). */
  visit(s: Shape, hint: string) {
    if (s.arr) this.visit(s.arr, singular(hint))
    if (s.obj) this.nameObj(s.obj, hint)
  }

  nameObj(o: ObjShape, hint: string, exact = false): Named {
    const known = this.byObj.get(o)
    if (known) return known
    for (const [k, f] of o.fields) this.visit(f.shape, pascalCase(k))
    const sig = this.signature(o)
    const same = exact ? undefined : this.bySig.get(sig)
    if (same) {
      this.byObj.set(o, same)
      return same
    }
    let name = pascalCase(hint)
    if (!exact) for (let i = 2; this.used.has(name); i++) name = `${pascalCase(hint)}${i}`
    this.used.add(name)
    const n: Named = { name, obj: o, sig }
    this.decls.push(n)
    this.byObj.set(o, n)
    this.bySig.set(sig, n)
    return n
  }

  get(o: ObjShape): Named {
    return this.byObj.get(o)!
  }

  private signature(o: ObjShape): string {
    const parts = [...o.fields.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, f]) => `${JSON.stringify(k)}${f.count < o.count ? '?' : ''}:${this.shapeSig(f.shape)}`)
    return `{${parts.join(',')}}`
  }

  private shapeSig(s: Shape): string {
    const parts: string[] = [...s.prims].sort()
    if (s.arr) parts.push(`[${this.shapeSig(s.arr)}]`)
    if (s.obj) parts.push(`#${this.byObj.get(s.obj)?.name ?? '?'}`)
    return parts.join('|')
  }
}

// ---------------------------------------------------------------- output

export type Mode = 'interface' | 'type' | 'zod' | 'schema'

export interface GenOptions {
  mode: Mode
  rootName: string
  exported: boolean
  readonly: boolean
  /** Spaces per indent level (default 2). */
  indent?: number
}

export function parseJsonInput(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!text.trim()) return { ok: false, error: 'Paste some JSON to infer types from.' }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function generate(value: unknown, opts: GenOptions): string {
  const rootName = pascalCase(opts.rootName || 'Root')
  const shape = infer(value)
  // The root name is reserved so a nested key can't take it.
  const namer = new Namer([rootName])
  if (shape.obj && !shape.arr && shape.prims.size === 0) namer.nameObj(shape.obj, rootName, true)
  else {
    if (shape.arr) namer.visit(shape.arr, `${rootName}Item`)
    if (shape.obj) namer.nameObj(shape.obj, `${rootName}Object`)
  }
  const ind = ' '.repeat(opts.indent ?? 2)
  switch (opts.mode) {
    case 'interface':
    case 'type':
      return emitTs(shape, rootName, namer, opts, ind)
    case 'zod':
      return emitZod(shape, rootName, namer, opts, ind)
    case 'schema':
      return emitSchema(shape, rootName, namer, opts.indent ?? 2)
  }
}

// ---- TypeScript

function tsType(s: Shape, namer: Namer, ro: boolean): string {
  const parts: string[] = []
  if (s.obj) parts.push(namer.get(s.obj).name)
  if (s.arr) {
    const inner = tsType(s.arr, namer, ro)
    const wrapped = /[| ]/.test(inner) ? `(${inner})` : inner
    parts.push(`${ro ? 'readonly ' : ''}${wrapped}[]`)
  }
  const order: Prim[] = ['string', 'number', 'integer', 'boolean', 'null']
  const prims = order.filter((p) => s.prims.has(p)).map((p) => (p === 'integer' ? 'number' : p))
  for (const p of prims) if (!parts.includes(p)) parts.push(p)
  if (parts.length === 0) return 'unknown'
  // Keep null last so `string | null` reads naturally.
  return parts.join(' | ')
}

function emitTs(shape: Shape, rootName: string, namer: Namer, opts: GenOptions, ind: string): string {
  const exp = opts.exported ? 'export ' : ''
  const ro = opts.readonly ? 'readonly ' : ''
  const blocks: string[] = []
  const body = (o: ObjShape) => {
    const lines = [...o.fields.entries()].map(([k, f]) => `${ind}${ro}${propKey(k)}${f.count < o.count ? '?' : ''}: ${tsType(f.shape, namer, opts.readonly)};`)
    return lines.length ? `{\n${lines.join('\n')}\n}` : '{}'
  }
  const rootIsObj = shape.obj && !shape.arr && shape.prims.size === 0
  if (!rootIsObj) blocks.push(`${exp}type ${rootName} = ${tsType(shape, namer, opts.readonly)};`)
  // Root declaration first, then the rest in discovery order.
  const decls = [...namer.decls].reverse()
  for (const d of decls) {
    blocks.push(opts.mode === 'interface' ? `${exp}interface ${d.name} ${body(d.obj)}` : `${exp}type ${d.name} = ${body(d.obj)};`)
  }
  return blocks.join('\n\n') + '\n'
}

// ---- Zod

function zodType(s: Shape, namer: Namer): string {
  const nullable = s.prims.has('null')
  const options: string[] = []
  if (s.prims.has('string')) options.push('z.string()')
  if (s.prims.has('number')) options.push('z.number()')
  else if (s.prims.has('integer')) options.push('z.number().int()')
  if (s.prims.has('boolean')) options.push('z.boolean()')
  if (s.obj) options.push(`${namer.get(s.obj).name}Schema`)
  if (s.arr) options.push(`z.array(${zodType(s.arr, namer)})`)
  let base: string
  if (options.length === 0) base = nullable ? 'z.null()' : 'z.unknown()'
  else base = options.length === 1 ? options[0] : `z.union([${options.join(', ')}])`
  return options.length && nullable ? `${base}.nullable()` : base
}

function emitZod(shape: Shape, rootName: string, namer: Namer, opts: GenOptions, ind: string): string {
  const exp = opts.exported ? 'export ' : ''
  const blocks = ['import { z } from "zod";']
  const ro = opts.readonly ? '.readonly()' : ''
  for (const d of namer.decls) {
    const lines = [...d.obj.fields.entries()].map(([k, f]) => `${ind}${propKey(k)}: ${zodType(f.shape, namer)}${f.count < d.obj.count ? '.optional()' : ''},`)
    blocks.push(`${exp}const ${d.name}Schema = z.object(${lines.length ? `{\n${lines.join('\n')}\n}` : '{}'})${ro};`)
  }
  const rootIsObj = shape.obj && !shape.arr && shape.prims.size === 0
  if (!rootIsObj) blocks.push(`${exp}const ${rootName}Schema = ${zodType(shape, namer)};`)
  const types = namer.decls.map((d) => d.name)
  if (!rootIsObj) types.push(rootName)
  blocks.push(types.map((t) => `${exp}type ${t} = z.infer<typeof ${t}Schema>;`).join('\n'))
  return blocks.join('\n\n') + '\n'
}

// ---- JSON Schema (draft 2020-12)

type Json = null | boolean | number | string | Json[] | { [k: string]: Json }

function schemaOf(s: Shape, namer: Namer, rootObj: ObjShape | undefined): { [k: string]: Json } {
  const variants: { [k: string]: Json }[] = []
  const simple: string[] = []
  const order: Prim[] = ['string', 'number', 'integer', 'boolean', 'null']
  for (const p of order) if (s.prims.has(p)) simple.push(p)
  if (s.obj) variants.push({ $ref: s.obj === rootObj ? '#' : `#/$defs/${namer.get(s.obj).name}` })
  if (s.arr) variants.push(isEmpty(s.arr) ? { type: 'array' } : { type: 'array', items: schemaOf(s.arr, namer, rootObj) })
  if (variants.length === 0) {
    if (simple.length === 0) return {}
    return { type: simple.length === 1 ? simple[0] : simple }
  }
  if (simple.length) variants.push({ type: simple.length === 1 ? simple[0] : simple })
  return variants.length === 1 ? variants[0] : { anyOf: variants }
}

function objectSchema(o: ObjShape, namer: Namer, rootObj: ObjShape | undefined): { [k: string]: Json } {
  const properties: { [k: string]: Json } = {}
  const required: string[] = []
  for (const [k, f] of o.fields) {
    properties[k] = schemaOf(f.shape, namer, rootObj)
    if (f.count === o.count) required.push(k)
  }
  const out: { [k: string]: Json } = { type: 'object', properties }
  if (required.length) out.required = required
  return out
}

function emitSchema(shape: Shape, rootName: string, namer: Namer, indent: number): string {
  const rootObj = shape.obj && !shape.arr && shape.prims.size === 0 ? shape.obj : undefined
  const head: { [k: string]: Json } = { $schema: 'https://json-schema.org/draft/2020-12/schema', title: rootName }
  const body = rootObj ? objectSchema(rootObj, namer, rootObj) : schemaOf(shape, namer, undefined)
  const defs: { [k: string]: Json } = {}
  for (const d of namer.decls) if (d.obj !== rootObj) defs[d.name] = objectSchema(d.obj, namer, rootObj)
  const doc = { ...head, ...body, ...(Object.keys(defs).length ? { $defs: defs } : {}) }
  return JSON.stringify(doc, null, indent) + '\n'
}
