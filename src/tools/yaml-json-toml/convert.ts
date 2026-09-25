import { parse as parseToml, stringify as stringifyToml, TomlError } from 'smol-toml'
import { parseAllDocuments, stringify as stringifyYaml, YAMLError } from 'yaml'

export type Format = 'json' | 'yaml' | 'toml'
export const FORMATS: Format[] = ['json', 'yaml', 'toml']
export const FORMAT_LABEL: Record<Format, string> = { json: 'JSON', yaml: 'YAML', toml: 'TOML' }

export class ConvertError extends Error {
  line?: number
  column?: number
  constructor(message: string, line?: number, column?: number) {
    super(message)
    this.line = line
    this.column = column
  }
}

/** Best-effort guess of the format of a text document. */
export function detectFormat(text: string): Format {
  const t = text.trim()
  if (!t) return 'json'
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      JSON.parse(t)
      return 'json'
    } catch {
      /* TOML tables also start with "[" */
    }
  }
  const lines = t.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'))
  const tomlish = lines.filter((l) => /^\s*\[\[?[\w."' -]+\]\]?\s*(#.*)?$/.test(l) || /^\s*[\w."'-]+\s*=\s*\S/.test(l)).length
  const yamlish = lines.filter((l) => /^\s*[\w"'.-]+\s*:(\s|$)/.test(l) || /^\s*-\s/.test(l) || l.trim() === '---').length
  if (tomlish > yamlish) return 'toml'
  if (t.startsWith('{') || t.startsWith('[')) return tomlish > 0 ? 'toml' : 'json'
  return 'yaml'
}

function lineColFromOffset(text: string, pos: number): [number, number] {
  const before = text.slice(0, pos).split('\n')
  return [before.length, before[before.length - 1].length + 1]
}

export interface Parsed {
  value: unknown
  /** Number of YAML documents that were merged into an array (0 when not applicable). */
  documents: number
}

export function parseInput(text: string, format: Format): Parsed {
  if (format === 'json') {
    try {
      return { value: JSON.parse(text), documents: 0 }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const lc = msg.match(/line (\d+) column (\d+)/i)
      const pos = msg.match(/position (\d+)/i)
      if (lc) throw new ConvertError(msg, Number(lc[1]), Number(lc[2]))
      if (pos) {
        const [l, c] = lineColFromOffset(text, Number(pos[1]))
        throw new ConvertError(`${msg} (line ${l}, column ${c})`, l, c)
      }
      throw new ConvertError(msg)
    }
  }
  if (format === 'yaml') {
    const docs = parseAllDocuments(text, { uniqueKeys: true })
    const list = Array.isArray(docs) ? docs : [docs]
    for (const d of list) {
      const e = d.errors[0] as YAMLError | undefined
      if (e) {
        const lp = e.linePos?.[0]
        throw new ConvertError(e.message.split('\n')[0], lp?.line, lp?.col)
      }
    }
    const nonEmpty = list.filter((d) => d.contents !== null || list.length === 1)
    if (nonEmpty.length > 1) return { value: nonEmpty.map((d) => d.toJS()), documents: nonEmpty.length }
    return { value: nonEmpty[0] ? nonEmpty[0].toJS() : null, documents: 0 }
  }
  try {
    // TOML dates become ISO strings so every output format can hold them.
    return { value: JSON.parse(JSON.stringify(parseToml(text))), documents: 0 }
  } catch (err) {
    if (err instanceof TomlError) throw new ConvertError(err.message.split('\n')[0].replace(/^Invalid TOML document: /, ''), err.line, err.column)
    throw new ConvertError(err instanceof Error ? err.message : String(err))
  }
}

function findNull(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return path || '(root)'
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const p = findNull(value[i], `${path}[${i}]`)
      if (p) return p
    }
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = findNull(v, path ? `${path}.${k}` : k)
      if (p) return p
    }
  }
  return null
}

export interface SerializeOptions {
  indent?: number
}

export function serialize(value: unknown, format: Format, opts: SerializeOptions = {}): string {
  const indent = opts.indent ?? 2
  if (format === 'json') return JSON.stringify(value, null, indent === 0 ? undefined : indent) ?? 'null'
  if (format === 'yaml') return stringifyYaml(value, { indent: Math.max(indent, 2), lineWidth: 0 })
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConvertError(
      Array.isArray(value)
        ? 'TOML needs a table (key/value object) at the top level, but this data is a list. Wrap it in a key, e.g. { "items": [...] }.'
        : 'TOML needs a table (key/value object) at the top level, not a single value.',
    )
  }
  const nullAt = findNull(value, '')
  if (nullAt) throw new ConvertError(`TOML has no null value, but "${nullAt}" is null. Remove it or give it a value (e.g. an empty string).`)
  return stringifyToml(value as Record<string, unknown>)
}

export interface ConvertResult {
  output: string
  documents: number
}

export function convert(text: string, from: Format, to: Format, opts: SerializeOptions = {}): ConvertResult {
  if (!text.trim()) return { output: '', documents: 0 }
  const { value, documents } = parseInput(text, from)
  let out =
    to === 'yaml' && documents > 0 && Array.isArray(value)
      ? value.map((v) => serialize(v, 'yaml', opts)).join('---\n')
      : serialize(value, to, opts)
  if (to !== 'json' && !out.endsWith('\n')) out += '\n'
  return { output: out, documents }
}
