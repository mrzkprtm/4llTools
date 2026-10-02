import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser'

// ---------------------------------------------------------------- tokenizer

export type Token =
  | { t: 'decl' | 'comment' | 'cdata' | 'doctype' | 'pi'; raw: string }
  | { t: 'open'; raw: string; name: string; selfClose: boolean }
  | { t: 'close'; raw: string; name: string }
  | { t: 'text'; raw: string }

const TAG = /<(\/?)([A-Za-z_:][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/y

export function tokenize(xml: string): Token[] {
  const out: Token[] = []
  let i = 0
  const n = xml.length
  while (i < n) {
    if (xml[i] !== '<') {
      const j = xml.indexOf('<', i)
      const end = j < 0 ? n : j
      out.push({ t: 'text', raw: xml.slice(i, end) })
      i = end
      continue
    }
    const take = (t: 'decl' | 'comment' | 'cdata' | 'pi', close: string) => {
      const j = xml.indexOf(close, i)
      const end = j < 0 ? n : j + close.length
      out.push({ t, raw: xml.slice(i, end) })
      i = end
    }
    if (xml.startsWith('<!--', i)) take('comment', '-->')
    else if (xml.startsWith('<![CDATA[', i)) take('cdata', ']]>')
    else if (xml.startsWith('<?xml', i) && i === xml.search(/\S/)) take('decl', '?>')
    else if (xml.startsWith('<?', i)) take('pi', '?>')
    else if (/^<!DOCTYPE/i.test(xml.slice(i, i + 9))) {
      // Skip over an internal subset in [ ... ].
      let j = i + 9
      let depth = 0
      while (j < n) {
        const c = xml[j]
        if (c === '[') depth++
        else if (c === ']') depth--
        else if (c === '>' && depth <= 0) break
        j++
      }
      out.push({ t: 'doctype', raw: xml.slice(i, j + 1) })
      i = j + 1
    } else {
      TAG.lastIndex = i
      const m = TAG.exec(xml)
      if (!m) {
        out.push({ t: 'text', raw: xml.slice(i, i + 1) })
        i++
        continue
      }
      if (m[1]) out.push({ t: 'close', raw: m[0], name: m[2] })
      else out.push({ t: 'open', raw: m[0], name: m[2], selfClose: m[4] === '/' })
      i = TAG.lastIndex
    }
  }
  return out
}

/** Collapses whitespace inside a tag: `<a   x="1"\n y="2" >` → `<a x="1" y="2">`. */
function tidyTag(raw: string): string {
  let s = ''
  let quote = ''
  for (const c of raw) {
    if (quote) {
      s += c
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      quote = c
      s += c
    } else if (/\s/.test(c)) {
      if (!s.endsWith(' ')) s += ' '
    } else s += c
  }
  return s.replace(/ (\/?>)$/, '$1').replace(/ ?\/>$/, ' />').replace(/^<(\S+) \/>$/, '<$1 />')
}

export interface FormatOptions {
  indent: string
  /** Drop comments (minify only). */
  stripComments?: boolean
}

export function format(xml: string, { indent }: FormatOptions): string {
  const toks = tokenize(xml.trim())
  const lines: string[] = []
  let depth = 0
  const pad = () => indent.repeat(Math.max(0, depth))
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k]
    if (tok.t === 'text') {
      const text = tok.raw.trim()
      if (text) lines.push(pad() + text.replace(/\s*\n\s*/g, ' '))
      continue
    }
    if (tok.t === 'open' && !tok.selfClose) {
      // <a>short text</a> stays on one line
      const next = toks[k + 1]
      const after = toks[k + 2]
      if (next?.t === 'text' && after?.t === 'close' && after.name === tok.name && !next.raw.includes('\n')) {
        lines.push(pad() + tidyTag(tok.raw) + next.raw.trim() + after.raw)
        k += 2
        continue
      }
      if (next?.t === 'close' && next.name === tok.name) {
        lines.push(pad() + tidyTag(tok.raw) + next.raw)
        k += 1
        continue
      }
      lines.push(pad() + tidyTag(tok.raw))
      depth++
      continue
    }
    if (tok.t === 'close') {
      depth--
      lines.push(pad() + tok.raw)
      continue
    }
    lines.push(pad() + (tok.t === 'open' ? tidyTag(tok.raw) : tok.raw))
  }
  return lines.join('\n')
}

export function minify(xml: string, opts: { stripComments?: boolean } = {}): string {
  return tokenize(xml.trim())
    .map((tok) => {
      if (tok.t === 'text') return tok.raw.trim() ? tok.raw.replace(/\s+/g, ' ').trim() : ''
      if (tok.t === 'comment') return opts.stripComments ? '' : tok.raw
      if (tok.t === 'open') return tidyTag(tok.raw).replace(' />', '/>')
      return tok.raw
    })
    .join('')
}

// ---------------------------------------------------------------- validation

export type Validation = { ok: true } | { ok: false; message: string; line: number; col: number }

export function validate(xml: string): Validation {
  if (!xml.trim()) return { ok: false, message: 'The document is empty.', line: 1, col: 1 }
  const r = XMLValidator.validate(xml, { allowBooleanAttributes: true })
  if (r === true) return { ok: true }
  return { ok: false, message: r.err.msg, line: r.err.line, col: r.err.col }
}

// ---------------------------------------------------------------- conversion

export interface ConvertOptions {
  attrPrefix: string
  indent: number
  /** Turn "42" / "true" into numbers and booleans. */
  parseValues: boolean
  /** Element name to wrap an array or multi-key JSON root in. */
  rootName: string
}

export function xmlToJson(xml: string, o: ConvertOptions): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: o.attrPrefix,
    textNodeName: '#text',
    parseTagValue: o.parseValues,
    parseAttributeValue: o.parseValues,
    allowBooleanAttributes: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
    trimValues: true,
    cdataPropName: false,
    commentPropName: false,
  })
  return JSON.stringify(parser.parse(xml), null, o.indent)
}

export function jsonToXml(json: string, o: ConvertOptions): string {
  let data: unknown = JSON.parse(json)
  const needsRoot = Array.isArray(data) || typeof data !== 'object' || data === null || Object.keys(data).filter((k) => !k.startsWith('?')).length !== 1
  if (needsRoot) data = { [o.rootName || 'root']: Array.isArray(data) ? { item: data } : data }
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: o.attrPrefix,
    textNodeName: '#text',
    format: o.indent > 0,
    indentBy: ' '.repeat(o.indent),
    suppressEmptyNode: true,
    suppressBooleanAttributes: false,
  })
  const out = String(builder.build(data)).trim()
  return `<?xml version="1.0" encoding="UTF-8"?>\n${out}`
}
