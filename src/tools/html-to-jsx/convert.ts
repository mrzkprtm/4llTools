/**
 * HTML → JSX. A small forgiving HTML parser (no DOM needed, so it runs in tests
 * and during prerender) plus a JSX printer.
 */

export type Node =
  | { type: 'element'; name: string; attrs: [string, string | null][]; children: Node[] }
  | { type: 'text'; value: string }
  | { type: 'comment'; value: string }

export const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title'])
/** Opening one of these closes an open element of the listed names (a tiny subset of HTML's implied end tags). */
const AUTO_CLOSE: Record<string, string[]> = {
  li: ['li'],
  dt: ['dt', 'dd'],
  dd: ['dt', 'dd'],
  tr: ['tr', 'td', 'th'],
  td: ['td', 'th'],
  th: ['td', 'th'],
  option: ['option'],
  p: ['p'],
}
const BLOCK_CLOSES_P = new Set(['div', 'ul', 'ol', 'table', 'section', 'article', 'header', 'footer', 'nav', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote', 'hr', 'main', 'aside', 'figure'])

const ATTR = /\s*([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/y

export function parseHtml(html: string): Node[] {
  const root: Node & { type: 'element' } = { type: 'element', name: '#root', attrs: [], children: [] }
  const stack: (Node & { type: 'element' })[] = [root]
  const top = () => stack[stack.length - 1]
  let i = 0
  const n = html.length
  while (i < n) {
    if (html.startsWith('<!--', i)) {
      const j = html.indexOf('-->', i + 4)
      const end = j < 0 ? n : j
      top().children.push({ type: 'comment', value: html.slice(i + 4, end) })
      i = j < 0 ? n : j + 3
      continue
    }
    if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
      const j = html.indexOf('>', i)
      i = j < 0 ? n : j + 1
      continue
    }
    if (html.startsWith('</', i)) {
      const m = /^<\/\s*([A-Za-z][\w:.-]*)\s*>/.exec(html.slice(i))
      if (m) {
        const name = m[1]
        const lower = name.toLowerCase()
        const idx = stack.map((e) => e.name.toLowerCase()).lastIndexOf(lower)
        if (idx > 0) stack.length = idx
        i += m[0].length
        continue
      }
    }
    if (html[i] === '<' && /[A-Za-z]/.test(html[i + 1] ?? '')) {
      const nm = /^<([A-Za-z][\w:.-]*)/.exec(html.slice(i))!
      const name = nm[1]
      const lower = name.toLowerCase()
      let j = i + nm[0].length
      const attrs: [string, string | null][] = []
      for (;;) {
        ATTR.lastIndex = j
        const m = ATTR.exec(html)
        if (!m || m.index !== j || !m[1]) break
        attrs.push([m[1], m[2] ?? m[3] ?? m[4] ?? null])
        j = ATTR.lastIndex
      }
      const close = /^\s*(\/?)>/.exec(html.slice(j))
      const selfClose = !!close?.[1]
      i = close ? j + close[0].length : j
      const closes = AUTO_CLOSE[lower] ?? (BLOCK_CLOSES_P.has(lower) ? ['p'] : [])
      if (closes.length && closes.includes(top().name.toLowerCase())) stack.pop()
      const el: Node & { type: 'element' } = { type: 'element', name, attrs, children: [] }
      top().children.push(el)
      if (selfClose || VOID.has(lower)) continue
      if (RAW_TEXT.has(lower)) {
        const endRe = new RegExp(`</${lower}\\s*>`, 'i')
        const rest = html.slice(i)
        const m = endRe.exec(rest)
        const body = m ? rest.slice(0, m.index) : rest
        if (body) el.children.push({ type: 'text', value: body })
        i += m ? m.index + m[0].length : rest.length
        continue
      }
      stack.push(el)
      continue
    }
    const j = html.indexOf('<', i + 1)
    const end = j < 0 ? n : j
    const value = html.slice(i, end)
    const last = top().children[top().children.length - 1]
    if (last?.type === 'text') last.value += value
    else top().children.push({ type: 'text', value })
    i = end
  }
  return root.children
}

// ---------------------------------------------------------------- attribute mapping

const ATTR_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  contenteditable: 'contentEditable',
  crossorigin: 'crossOrigin',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  enctype: 'encType',
  frameborder: 'frameBorder',
  novalidate: 'noValidate',
  srcset: 'srcSet',
  srcdoc: 'srcDoc',
  usemap: 'useMap',
  datetime: 'dateTime',
  accesskey: 'accessKey',
  spellcheck: 'spellCheck',
  cellpadding: 'cellPadding',
  cellspacing: 'cellSpacing',
  charset: 'charSet',
  formaction: 'formAction',
  formmethod: 'formMethod',
  formnovalidate: 'formNoValidate',
  formtarget: 'formTarget',
  'http-equiv': 'httpEquiv',
  'accept-charset': 'acceptCharset',
  allowfullscreen: 'allowFullScreen',
  inputmode: 'inputMode',
  referrerpolicy: 'referrerPolicy',
  playsinline: 'playsInline',
  marginwidth: 'marginWidth',
  marginheight: 'marginHeight',
  hreflang: 'hrefLang',
  itemprop: 'itemProp',
  itemscope: 'itemScope',
  itemtype: 'itemType',
  itemid: 'itemID',
  itemref: 'itemRef',
  enterkeyhint: 'enterKeyHint',
  fetchpriority: 'fetchPriority',
  popovertarget: 'popoverTarget',
  popovertargetaction: 'popoverTargetAction',
  contextmenu: 'contextMenu',
  controlslist: 'controlsList',
  mediagroup: 'mediaGroup',
  nomodule: 'noModule',
  radiogroup: 'radioGroup',
  // SVG attributes that HTML parsers lowercase
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio',
  gradientunits: 'gradientUnits',
  gradienttransform: 'gradientTransform',
  patternunits: 'patternUnits',
  patterncontentunits: 'patternContentUnits',
  patterntransform: 'patternTransform',
  clippathunits: 'clipPathUnits',
  markerwidth: 'markerWidth',
  markerheight: 'markerHeight',
  markerunits: 'markerUnits',
  refx: 'refX',
  refy: 'refY',
  stddeviation: 'stdDeviation',
  textlength: 'textLength',
  lengthadjust: 'lengthAdjust',
  maskunits: 'maskUnits',
  maskcontentunits: 'maskContentUnits',
  filterunits: 'filterUnits',
  primitiveunits: 'primitiveUnits',
  spreadmethod: 'spreadMethod',
  startoffset: 'startOffset',
  pathlength: 'pathLength',
  'xlink:href': 'xlinkHref',
  'xlink:title': 'xlinkTitle',
  'xlink:actuate': 'xlinkActuate',
  'xlink:arcrole': 'xlinkArcrole',
  'xlink:role': 'xlinkRole',
  'xlink:show': 'xlinkShow',
  'xlink:type': 'xlinkType',
  'xml:space': 'xmlSpace',
  'xml:lang': 'xmlLang',
  'xml:base': 'xmlBase',
  'xmlns:xlink': 'xmlnsXlink',
}

const EVENT_WORDS = ['double', 'click', 'context', 'menu', 'mouse', 'pointer', 'touch', 'key', 'down', 'up', 'press', 'over', 'out', 'enter', 'leave', 'move', 'change', 'input', 'submit', 'focus', 'in', 'blur', 'load', 'error', 'start', 'end', 'scroll', 'wheel', 'drag', 'drop', 'animation', 'transition', 'iteration', 'copy', 'cut', 'paste', 'select', 'reset', 'invalid', 'play', 'playing', 'pause', 'ended', 'cancel', 'toggle', 'resize', 'abort', 'can', 'through', 'time', 'update', 'volume', 'seeked', 'seeking', 'waiting', 'loaded', 'data', 'metadata', 'duration', 'changed', 'emptied', 'stalled', 'suspend', 'progress', 'rate', 'composition', 'got', 'lost', 'capture', 'before', 'aux', 'close', 'encrypted', 'fullscreen']

/** onclick → onClick, onmouseenter → onMouseEnter, ondblclick → onDoubleClick. */
export function eventName(attr: string): string {
  let rest = attr.slice(2).toLowerCase()
  if (rest === 'dblclick') return 'onDoubleClick'
  let out = 'on'
  while (rest) {
    const word = EVENT_WORDS.filter((w) => rest.startsWith(w)).sort((a, b) => b.length - a.length)[0]
    if (!word) return out + rest[0].toUpperCase() + rest.slice(1)
    out += word[0].toUpperCase() + word.slice(1)
    rest = rest.slice(word.length)
  }
  return out
}

const camel = (s: string) => s.replace(/[-:]([a-z0-9])/g, (_, c: string) => c.toUpperCase())

export function attrName(raw: string, tag: string): string {
  const lower = raw.toLowerCase()
  if (lower.startsWith('data-') || lower.startsWith('aria-')) return lower
  if (ATTR_MAP[lower]) return ATTR_MAP[lower]
  if (/^on[a-z]+$/.test(lower) && lower.length > 3) return eventName(lower)
  if (raw.includes('-') || raw.includes(':')) return camel(raw)
  void tag
  return raw
}

// ---------------------------------------------------------------- style

/** "color: red; font-size:12px" → { color: 'red', fontSize: '12px' } as JSX source. */
export function styleToObject(css: string): string {
  const decls: string[] = []
  let depth = 0
  let quote = ''
  let cur = ''
  for (const c of css) {
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ';' && depth === 0) {
      decls.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  decls.push(cur)
  const entries: string[] = []
  for (const d of decls) {
    const k = d.indexOf(':')
    if (k < 0) continue
    const prop = d.slice(0, k).trim()
    const value = d.slice(k + 1).trim()
    if (!prop || !value) continue
    let key: string
    if (prop.startsWith('--')) key = `'${prop}'`
    else {
      key = prop.toLowerCase().startsWith('-ms-') ? prop.slice(1).toLowerCase() : prop.toLowerCase()
      key = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    }
    const v = /^-?\d+(\.\d+)?$/.test(value) && !prop.startsWith('--') ? value : `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
    entries.push(`${key}: ${v}`)
  }
  return entries.length ? `{{ ${entries.join(', ')} }}` : '{{}}'
}

// ---------------------------------------------------------------- printer

export interface JsxOptions {
  indent: string
  /** Wrap in `export default function Name() { return (...) }`. */
  component: string | null
  /** value/checked → defaultValue/defaultChecked on form fields, to avoid React's read-only warnings. */
  uncontrolled: boolean
}

const escapeText = (s: string) => s.replace(/[{}<>]/g, (c) => `{'${c}'}`)

function attrSource(name: string, value: string | null, tag: string, opts: JsxOptions): string {
  const lowerTag = tag.toLowerCase()
  let key = attrName(name, tag)
  if (opts.uncontrolled && ['input', 'textarea', 'select'].includes(lowerTag)) {
    if (key === 'value') key = 'defaultValue'
    if (key === 'checked') key = 'defaultChecked'
  }
  if (lowerTag === 'option' && key === 'selected') return ''
  if (value === null) return key
  if (key === 'style') return `style=${styleToObject(value)}`
  if (/^on[A-Z]/.test(key)) return `${key}={(event) => { ${value.trim().replace(/;$/, '')} }}`
  if (key === 'tabIndex' && /^-?\d+$/.test(value)) return `tabIndex={${value}}`
  if (value.includes('"')) return `${key}={${JSON.stringify(value)}}`
  return `${key}="${value}"`
}

export interface ConvertResult {
  jsx: string
  roots: number
  notes: string[]
}

export function htmlToJsx(html: string, opts: JsxOptions): ConvertResult {
  const notes = new Set<string>()
  const nodes = trimNodes(parseHtml(html))
  const out: string[] = []
  const print = (node: Node, depth: number, siblings: Node[], idx: number) => {
    const pad = opts.indent.repeat(depth)
    if (node.type === 'comment') {
      out.push(`${pad}{/*${node.value.replace(/\*\//g, '* /')}*/}`)
      return
    }
    if (node.type === 'text') {
      const collapsed = node.value.replace(/\s+/g, ' ')
      const core = collapsed.trim()
      if (!core) {
        // A lone space between two inline elements on one line is meaningful: <b>a</b> <i>b</i>
        if (collapsed && !node.value.includes('\n') && idx > 0 && idx < siblings.length - 1) out.push(`${pad}{" "}`)
        return
      }
      const lead = collapsed.startsWith(' ') && idx > 0 ? '{" "}' : ''
      const trail = collapsed.endsWith(' ') && idx < siblings.length - 1 ? '{" "}' : ''
      out.push(pad + lead + escapeText(core) + trail)
      return
    }
    const lower = node.name.toLowerCase()
    const attrs = node.attrs.map(([k, v]) => attrSource(k, v, node.name, opts)).filter(Boolean)
    if (node.attrs.some(([k]) => /^on/i.test(k))) notes.add('Inline event handlers became arrow functions; move the logic into your component.')
    if (lower === 'option' && node.attrs.some(([k]) => k.toLowerCase() === 'selected')) notes.add('<option selected> was removed: set value/defaultValue on the <select> instead.')
    const open = `<${node.name}${attrs.length ? ' ' + attrs.join(' ') : ''}`
    if (RAW_TEXT.has(lower) && node.children.length && node.children[0].type === 'text' && (lower === 'script' || lower === 'style')) {
      const body = (node.children[0] as { value: string }).value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
      out.push(`${pad}${open}>{\`${body}\`}</${node.name}>`)
      if (lower === 'script') notes.add('React does not run <script> tags rendered from JSX; load scripts another way.')
      return
    }
    const kids = node.children.filter((c) => c.type !== 'text' || c.value.trim())
    if (lower === 'textarea' && kids.length === 1 && kids[0].type === 'text') {
      const k = opts.uncontrolled ? 'defaultValue' : 'value'
      out.push(`${pad}${open} ${k}={${JSON.stringify((kids[0] as { value: string }).value)}} />`)
      return
    }
    if (kids.length === 0) {
      out.push(`${pad}${open} />`)
      return
    }
    if (kids.length === 1 && kids[0].type === 'text') {
      const t = kids[0].value.replace(/\s+/g, ' ').trim()
      const line = `${pad}${open}>${escapeText(t)}</${node.name}>`
      if (line.length <= 100) {
        out.push(line)
        return
      }
    }
    out.push(`${pad}${open}>`)
    node.children.forEach((c, i) => print(c, depth + 1, node.children, i))
    out.push(`${pad}</${node.name}>`)
  }

  const top = nodes.filter((c) => c.type !== 'text' || c.value.trim())
  const multi = top.length > 1
  const baseDepth = opts.component ? 2 : 0
  if (multi) out.push(`${opts.indent.repeat(baseDepth)}<>`)
  nodes.forEach((c, i) => print(c, baseDepth + (multi ? 1 : 0), nodes, i))
  if (multi) out.push(`${opts.indent.repeat(baseDepth)}</>`)

  let jsx = out.join('\n')
  if (opts.component) {
    const name = componentName(opts.component)
    jsx = `export default function ${name}() {\n${opts.indent}return (\n${jsx}\n${opts.indent});\n}\n`
  }
  return { jsx, roots: top.length, notes: [...notes] }
}

export function componentName(raw: string): string {
  const s = raw.replace(/[^A-Za-z0-9_$]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^[^A-Za-z_$]+/, '')
  return s ? s[0].toUpperCase() + s.slice(1) : 'Component'
}

/** Drops the doctype-level whitespace around the top-level nodes. */
function trimNodes(nodes: Node[]): Node[] {
  return nodes.filter((nd, i) => !(nd.type === 'text' && !nd.value.trim() && (i === 0 || i === nodes.length - 1)))
}
