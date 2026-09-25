import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { ConvertError, FORMAT_LABEL, FORMATS, convert, detectFormat, type Format } from './convert'

const EXAMPLE = `# docker-compose style service
version: "3.9"
services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
    environment:
      APP_ENV: production
      DEBUG: false
  db:
    image: postgres:16
    volumes:
      - db-data:/var/lib/postgresql/data
`

const EXT: Record<Format, string> = { json: 'json', yaml: 'yaml', toml: 'toml' }
const MIME: Record<Format, string> = { json: 'application/json', yaml: 'application/yaml', toml: 'application/toml' }

export default function YamlJsonToml() {
  const [input, setInput] = useState(EXAMPLE)
  const [from, setFrom] = useState<Format | 'auto'>('auto')
  const [to, setTo] = useState<Format>('json')
  const [indent, setIndent] = useState(2)

  const detected = useMemo(() => detectFormat(input), [input])
  const source: Format = from === 'auto' ? detected : from

  const result = useMemo(() => {
    try {
      return { ...convert(input, source, to, { indent }), error: null as ConvertError | null }
    } catch (err) {
      const e = err instanceof ConvertError ? err : new ConvertError(err instanceof Error ? err.message : String(err))
      return { output: '', documents: 0, error: e }
    }
  }, [input, source, to, indent])

  function swap() {
    if (result.output) setInput(result.output)
    setFrom(to)
    setTo(source === to ? (to === 'json' ? 'yaml' : 'json') : source)
  }

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([result.output], { type: MIME[to] }))
    a.download = `converted.${EXT[to]}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const errorLine = result.error?.line ? input.split(/\r?\n/)[result.error.line - 1] : undefined

  return (
    <div>
      <div className="row">
        <label htmlFor="yj-from" style={{ fontWeight: 400 }}>From</label>
        <select id="yj-from" value={from} onChange={(e) => setFrom(e.target.value as Format | 'auto')} style={{ width: 'auto' }}>
          <option value="auto">Auto-detect ({FORMAT_LABEL[detected]})</option>
          {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
        </select>
        <button type="button" className="btn" onClick={swap} title="Use the output as input and swap directions" aria-label="Swap input and output">⇄ Swap</button>
        <label htmlFor="yj-to" style={{ fontWeight: 400 }}>To</label>
        <select id="yj-to" value={to} onChange={(e) => setTo(e.target.value as Format)} style={{ width: 'auto' }}>
          {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
        </select>
        {to !== 'toml' && (
          <select value={indent} onChange={(e) => setIndent(Number(e.target.value))} style={{ width: 'auto' }} aria-label="Indentation">
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
            {to === 'json' && <option value={0}>Minified</option>}
          </select>
        )}
      </div>
      <div className="two-col">
        <div style={{ minWidth: 0 }}>
          <label htmlFor="yj-in">{FORMAT_LABEL[source]} input</label>
          <textarea id="yj-in" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} style={{ minHeight: 320 }} />
          <input
            type="file"
            aria-label="Open a file"
            accept=".json,.yaml,.yml,.toml,.txt"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) {
                setInput(await f.text())
                const ext = f.name.split('.').pop()?.toLowerCase()
                setFrom(ext === 'json' ? 'json' : ext === 'toml' ? 'toml' : ext === 'yaml' || ext === 'yml' ? 'yaml' : 'auto')
              }
              e.target.value = ''
            }}
            style={{ marginTop: 8 }}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <label htmlFor="yj-out">{FORMAT_LABEL[to]} output</label>
          <textarea id="yj-out" readOnly value={result.output} spellCheck={false} style={{ minHeight: 320 }} />
          <div className="row" style={{ marginTop: 8 }}>
            <CopyButton text={result.output} />
            <button type="button" className="btn" onClick={download} disabled={!result.output}>Download .{EXT[to]}</button>
          </div>
        </div>
      </div>
      {result.error && (
        <div className="error" role="alert">
          <p style={{ margin: '8px 0 4px' }}>
            {result.error.line ? <b>Line {result.error.line}{result.error.column ? `, column ${result.error.column}` : ''}: </b> : null}
            {result.error.message}
          </p>
          {errorLine !== undefined && (
            <pre className="output" style={{ overflowX: 'auto', whiteSpace: 'pre', wordBreak: 'normal', margin: 0 }}>
              {errorLine}
              {result.error.column ? `\n${' '.repeat(Math.max(0, result.error.column - 1))}^` : ''}
            </pre>
          )}
        </div>
      )}
      {result.documents > 0 && (
        <p className="muted">
          The YAML input has {result.documents} documents (separated by <code>---</code>).{' '}
          {to === 'yaml' ? 'They are kept as separate documents.' : 'They were combined into one array, one item per document.'}
        </p>
      )}
      <p className="muted">
        TOML limits: the top level must be a table (key/value object) and there is no <code>null</code>. YAML comments and anchors are not kept, and TOML dates become ISO date strings.
      </p>
    </div>
  )
}
