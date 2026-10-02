import { JSONPath } from 'jsonpath-plus'

export interface Match {
  /** Normalised bracket path, e.g. $['store']['book'][0]. */
  path: string
  /** Dot-style path, e.g. $.store.book[0]. */
  dotPath: string
  /** RFC 6901 JSON Pointer. */
  pointer: string
  value: unknown
}

export type EvalResult = { ok: true; matches: Match[] } | { ok: false; where: 'json' | 'path'; error: string }

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** Turns $['a']['b c'][0] into $.a["b c"][0]. */
export function toDotPath(bracket: string): string {
  const parts = JSONPath.toPathArray(bracket) as string[]
  let out = '$'
  for (const p of parts.slice(1)) {
    if (/^\d+$/.test(p)) out += `[${p}]`
    else if (IDENT.test(p)) out += `.${p}`
    else out += `[${JSON.stringify(p)}]`
  }
  return out
}

export function parseJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export function evaluate(jsonText: string, path: string): EvalResult {
  const parsed = parseJson(jsonText)
  if (!parsed.ok) return { ok: false, where: 'json', error: parsed.error }
  const expr = path.trim()
  if (!expr) return { ok: false, where: 'path', error: 'Type a JSONPath expression, e.g. $.store.book[*].title' }
  if (!expr.startsWith('$') && !expr.startsWith('@')) return { ok: false, where: 'path', error: 'A JSONPath expression starts with $ (the root).' }
  try {
    const raw = JSONPath({ path: expr, json: parsed.value as object, resultType: 'all', wrap: true, eval: 'safe' }) as { path: string; value: unknown; pointer: string }[] | undefined
    const matches = (raw ?? []).map((r) => ({ path: r.path, dotPath: toDotPath(r.path), pointer: r.pointer, value: r.value }))
    return { ok: true, matches }
  } catch (e) {
    return { ok: false, where: 'path', error: e instanceof Error ? e.message : String(e) }
  }
}

export const CHEATSHEET: { expr: string; meaning: string }[] = [
  { expr: '$', meaning: 'The root object' },
  { expr: '$.store.bicycle.color', meaning: 'Child by name (dot notation)' },
  { expr: "$['store']['bicycle']", meaning: 'Child by name (bracket notation)' },
  { expr: '$.store.book[0]', meaning: 'Array item by index' },
  { expr: '$.store.book[-1:]', meaning: 'Last array item (slice)' },
  { expr: '$.store.book[0,1]', meaning: 'Several indexes' },
  { expr: '$.store.book[:2]', meaning: 'Slice: first two items' },
  { expr: '$.store.book[*].author', meaning: 'Wildcard: every item' },
  { expr: '$..author', meaning: 'Recursive descent: all authors, any depth' },
  { expr: '$.store.*', meaning: 'All direct children of store' },
  { expr: '$..book[?(@.price < 10)]', meaning: 'Filter: books cheaper than 10' },
  { expr: '$..book[?(@.isbn)]', meaning: 'Filter: books that have an isbn' },
  { expr: "$..book[?(@.category === 'fiction')].title", meaning: 'Filter by string equality' },
  { expr: '$..book.length', meaning: 'Array length' },
  { expr: '$.store.*~', meaning: 'Property names (jsonpath-plus ~)' },
  { expr: '$..*', meaning: 'Every value in the document' },
]
