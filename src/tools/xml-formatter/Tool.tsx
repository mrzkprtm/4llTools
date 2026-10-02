import { useEffect, useMemo, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import './tool.css'

type Mod = typeof import('./xml')
type Mode = 'format' | 'minify' | 'xml2json' | 'json2xml'

const XML_EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<catalog><!-- sample feed --><book id="bk101" available="true"><author>Gambardella, Matthew</author><title>XML Developer's Guide</title><genre>Computer</genre><price currency="USD">44.95</price><publish_date>2000-10-01</publish_date></book><book id="bk102" available="false"><author>Ralls, Kim</author><title>Midnight Rain</title><genre>Fantasy</genre><price currency="USD">5.95</price><publish_date>2000-12-16</publish_date></book></catalog>`

const JSON_EXAMPLE = `{
  "order": {
    "@_id": "A-1001",
    "customer": { "name": "Budi Santoso", "email": "budi@example.com" },
    "items": {
      "item": [
        { "@_sku": "KB-01", "name": "Keyboard", "qty": 1, "price": 49.5 },
        { "@_sku": "MS-02", "name": "Mouse", "qty": 2, "price": 19.9 }
      ]
    },
    "paid": true
  }
}`

const MODES: [Mode, string][] = [
  ['format', 'Format'],
  ['minify', 'Minify'],
  ['xml2json', 'XML → JSON'],
  ['json2xml', 'JSON → XML'],
]

const bytes = (s: string) => new TextEncoder().encode(s).length

export default function XmlFormatter() {
  const [mod, setMod] = useState<Mod | null>(null)
  const [mode, setMode] = useState<Mode>('format')
  const [input, setInput] = useState(XML_EXAMPLE)
  const [indent, setIndent] = useState(2)
  const [prefix, setPrefix] = useState('@_')
  const [parseValues, setParseValues] = useState(true)
  const [rootName, setRootName] = useState('root')
  const [stripComments, setStripComments] = useState(false)

  useEffect(() => {
    let live = true
    import('./xml').then((m) => live && setMod(m))
    return () => {
      live = false
    }
  }, [])

  const isJsonIn = mode === 'json2xml'

  function switchMode(next: Mode) {
    const wasJson = mode === 'json2xml'
    const nowJson = next === 'json2xml'
    if (wasJson !== nowJson) {
      if (nowJson) setInput(result.output && mode === 'xml2json' ? result.output : JSON_EXAMPLE)
      else setInput(XML_EXAMPLE)
    }
    setMode(next)
  }

  const result = useMemo(() => {
    if (!mod) return { output: '', error: null as null | { message: string; line?: number; col?: number }, valid: false }
    try {
      if (isJsonIn) {
        return { output: mod.jsonToXml(input, { attrPrefix: prefix, indent, parseValues, rootName }), error: null, valid: true }
      }
      const v = mod.validate(input)
      if (!v.ok) return { output: '', error: { message: v.message, line: v.line, col: v.col }, valid: false }
      const output =
        mode === 'format'
          ? mod.format(input, { indent: indent === 0 ? '\t' : ' '.repeat(indent) })
          : mode === 'minify'
            ? mod.minify(input, { stripComments })
            : mod.xmlToJson(input, { attrPrefix: prefix, indent: indent || 2, parseValues, rootName })
      return { output, error: null, valid: true }
    } catch (e) {
      return { output: '', error: { message: e instanceof Error ? e.message : String(e) }, valid: false }
    }
  }, [mod, input, mode, indent, prefix, parseValues, rootName, stripComments, isJsonIn])

  const outExt = mode === 'xml2json' ? 'json' : 'xml'
  const errLine = result.error?.line ? input.split(/\r?\n/)[result.error.line - 1] : undefined

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([result.output], { type: outExt === 'json' ? 'application/json' : 'application/xml' }))
    a.download = `output.${outExt}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PillRow label="Mode">
        {MODES.map(([id, label]) => (
          <button key={id} type="button" className={`btn ${mode === id ? 'primary' : ''}`} aria-pressed={mode === id} onClick={() => switchMode(id)}>
            {label}
          </button>
        ))}
      </PillRow>

      <div className="xm-opts">
        {mode !== 'minify' && (
          <div>
            <label htmlFor="xm-indent">Indent</label>
            <select id="xm-indent" value={indent} onChange={(e) => setIndent(Number(e.target.value))}>
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value={0}>{mode === 'format' ? 'Tab' : mode === 'json2xml' ? 'None (one line)' : '2 spaces'}</option>
            </select>
          </div>
        )}
        {(mode === 'xml2json' || mode === 'json2xml') && (
          <div>
            <label htmlFor="xm-prefix">Attribute prefix</label>
            <input id="xm-prefix" type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="@_" spellCheck={false} />
          </div>
        )}
        {mode === 'json2xml' && (
          <div>
            <label htmlFor="xm-root">Root element (when needed)</label>
            <input id="xm-root" type="text" value={rootName} onChange={(e) => setRootName(e.target.value.replace(/[^\w:.-]/g, ''))} spellCheck={false} />
          </div>
        )}
        {mode === 'xml2json' && (
          <label><input type="checkbox" checked={parseValues} onChange={(e) => setParseValues(e.target.checked)} /> Numbers &amp; booleans as values</label>
        )}
        {mode === 'minify' && (
          <label><input type="checkbox" checked={stripComments} onChange={(e) => setStripComments(e.target.checked)} /> Remove comments</label>
        )}
      </div>

      <div className="two-col">
        <div style={{ minWidth: 0 }}>
          <label htmlFor="xm-in">{isJsonIn ? 'JSON input' : 'XML input'}</label>
          <textarea id="xm-in" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} style={{ minHeight: 320 }} aria-invalid={!!result.error} />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => setInput(isJsonIn ? JSON_EXAMPLE : XML_EXAMPLE)}>Example</button>
            <input
              type="file"
              accept={isJsonIn ? '.json,application/json' : '.xml,.svg,.rss,.atom,.xsd,.wsdl,.plist,text/xml,application/xml'}
              aria-label="Open a file"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setInput(await f.text())
                e.target.value = ''
              }}
            />
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <label htmlFor="xm-out">{outExt.toUpperCase()} output</label>
          {!mod ? (
            <div className="busy-bar" style={{ borderRadius: 'var(--radius-sm)' }}>
              <Busy label="Loading the XML parser…" />
            </div>
          ) : (
            <SettleOutput id="xm-out" key={mode} className="swap-code" value={result.output} motion="order" style={{ minHeight: 320 }} />
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <CopyButton text={result.output} />
            <button type="button" className="btn" onClick={download} disabled={!result.output}>Download .{outExt}</button>
          </div>
        </div>
      </div>

      <div aria-live="polite">
        {result.error ? (
          <div className="error shake-once" role="alert" key={result.error.message}>
            <p style={{ margin: '8px 0 0' }}>
              {result.error.line ? <b>Line {result.error.line}{result.error.col ? `, column ${result.error.col}` : ''}: </b> : null}
              {result.error.message}
            </p>
            {errLine !== undefined && (
              <pre className="output xm-caret">
                {errLine}
                {result.error.col ? `\n${' '.repeat(Math.max(0, result.error.col - 1))}^` : ''}
              </pre>
            )}
          </div>
        ) : mod && result.valid ? (
          <div className="xm-sizes">
            {!isJsonIn && (
              <span className="chip good pop" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check size={14} /> Well-formed XML
              </span>
            )}
            <span className="chip">
              <Roll>{bytes(input).toLocaleString()}</Roll>&nbsp;→&nbsp;<Roll>{bytes(result.output).toLocaleString()}</Roll>&nbsp;bytes
            </span>
          </div>
        ) : null}
      </div>
      <p className="muted">
        Validation checks that the XML is well-formed (matching tags, quoted attributes, one root), not that it matches a schema or DTD. Formatting puts each element on its own line, which can change whitespace inside mixed text like <code>&lt;p&gt;a &lt;b&gt;b&lt;/b&gt;&lt;/p&gt;</code>. In JSON, attributes get the prefix above and element text sits under <code>#text</code>; repeated elements become arrays. Everything runs in your browser.
      </p>
    </div>
  )
}
