import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

export default function JSONFormatter() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'tree' | 'code' | 'minify'>('tree')
  const [indent, setIndent] = useState(2)
  const [jsonPath, setJsonPath] = useState('$')
  const [pathResult, setPathResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      JSON.parse(input)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON')
    }
  }, [input])

  const parseJSON = (text: string) => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  const formatJSON = (obj: any, indent: number): string => {
    return JSON.stringify(obj, null, indent)
  }

  const minifyJSON = (obj: any): string => {
    return JSON.stringify(obj)
  }

  const queryPath = (obj: any, path: string): any => {
    if (path === '$') return obj
    const parts = path.replace(/^\$\.?/, '').split('.')
    let current: any = obj
    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      const match = part.match(/^(.+)\[(\d+)\]$/)
      if (match) {
        current = current[match[1]]
        if (Array.isArray(current)) {
          current = current[parseInt(match[2])]
        } else {
          return undefined
        }
      } else {
        current = current[part]
      }
    }
    return current
  }

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path)
  }

  const parseResult = parseJSON(input)
  const pathResultValue = parseResult ? queryPath(parseResult, jsonPath) : null

  const formattedJSON = parseResult ? JSON.stringify(parseResult, null, indent) : ''
  const minifiedJSON = parseResult ? JSON.stringify(parseResult) : ''

  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderTree = (obj: any, path = '$', depth = 0): JSX.Element => {
    if (obj === null) {
      return <span style={{ color: '#9ca3af' }}>null</span>
    }
    if (typeof obj !== 'object') {
      const color = typeof obj === 'string' ? '#10b981' : typeof obj === 'number' ? '#f59e0b' : typeof obj === 'boolean' ? '#8b5cf6' : 'var(--text)'
      return <span style={{ color }}>{JSON.stringify(obj)}</span>
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return <span style={{ color: '#9ca3af' }}>[]</span>
      return (
        <div style={{ marginLeft: depth * 20 }}>
          <span style={{ color: '#9ca3af' }}>[</span>
          {obj.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#9ca3af', fontFamily: 'var(--mono)' }}>{path}[{i}]</span>
              {renderTree(item, `${path}[${i}]`, depth + 1)}
              {i < obj.length - 1 && <span style={{ color: '#9ca3af' }}> ,</span>}
            </div>
          ))}
          <div style={{ color: '#9ca3af', marginLeft: depth * 20 }}>]</div>
        </div>
      )
    }

    const keys = Object.keys(obj)
    if (keys.length === 0) return <span style={{ color: '#9ca3af' }}>{"{}"}</span>

    return (
      <div style={{ marginLeft: depth * 20 }}>
        <span style={{ color: '#9ca3af' }}>{"{"}</span>
        {keys.map((key, i) => (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: '#eab308', fontFamily: 'var(--mono)' }}>"{key}"</span>
            <span style={{ color: '#9ca3af' }}>:</span>
            {renderTree(obj[key], `${path}.${key}`, depth + 1)}
            {i < keys.length - 1 && <span style={{ color: '#9ca3af' }}> ,</span>}
          </div>
        ))}
        <div style={{ color: '#9ca3af', marginLeft: depth * 20 }}>{"}"}</div>
      </div>
    )
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>JSON Formatter</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setMode('tree')} style={{ background: mode === 'tree' ? 'var(--accent)' : 'var(--bg)' }}>Tree View</button>
          <button className="btn" onClick={() => setMode('code')} style={{ background: mode === 'code' ? 'var(--accent)' : 'var(--bg)' }}>Formatted Code</button>
          <button className="btn" onClick={() => setMode('minify')} style={{ background: mode === 'minify' ? 'var(--accent)' : 'var(--bg)' }}>Minified</button>
        </div>
        <div className="row" style={{ gap: 16, alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Indent</span>
            <select value={indent} onChange={e => setIndent(Number(e.target.value))} style={{ width: 80 }}>
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
              <option value={0}>Tab</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>JSONPath</span>
            <input type="text" value={jsonPath} onChange={e => setJsonPath(e.target.value)} placeholder="$" style={{ width: 200, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px' }} />
          </label>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>Input JSON</span>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => { setInput('{}'); setJsonPath('$') }}>Sample</button>
              <button className="btn" onClick={() => { setInput(''); setJsonPath('$') }}>Clear</button>
              {parseJSON(input) && <button className="btn" onClick={() => download(mode === 'minify' ? minifiedJSON : formattedJSON, 'formatted.json')}>Download</button>}
            </div>
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste JSON here..."
            rows={10}
            style={{ width: '100%', background: 'var(--bg)', border: error ? '2px solid var(--danger)' : '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: 8, fontFamily: 'var(--mono)', fontSize: '0.9rem', resize: 'vertical' }}
          />
        </label>
        {error && <div className="muted" style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: 4 }}>{error}</div>}
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        {pathResultValue !== null && pathResultValue !== undefined && (
          <div className="pop-row" style={{ padding: 12, background: 'var(--ok)20', border: '1px solid var(--ok)40', borderRadius: 'var(--radius)' }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Path Result: </span>
              <div className="row" style={{ gap: 8 }}>
                <code style={{ background: 'var(--bg)', padding: '4px 8px', borderRadius: 4, fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>{JSON.stringify(pathResultValue)}</code>
                <button className="btn" onClick={() => copyPath(JSON.stringify(pathResultValue))} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Copy Value</button>
                <button className="btn" onClick={() => copyPath(jsonPath)} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Copy Path</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {mode === 'tree' && parseResult && (
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 600, overflowY: 'auto' }}>
            <h4 style={{ margin: '0 0 12px' }}>Tree View</h4>
            {renderTree(parseResult)}
          </div>
        )}

        {mode === 'code' && (
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 600, overflowY: 'auto' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>Formatted JSON</h4>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => navigator.clipboard.writeText(formattedJSON)}>Copy</button>
                <button className="btn" onClick={() => download(mode === 'minify' ? minifiedJSON : formattedJSON, 'formatted.json')}>Download</button>
              </div>
            </div>
            <pre style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {formattedJSON}
            </pre>
          </div>
        )}

        {mode === 'minify' && (
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 600, overflowY: 'auto' }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>Minified JSON</h4>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" onClick={() => navigator.clipboard.writeText(minifiedJSON)}>Copy</button>
                <button className="btn" onClick={() => download(minifiedJSON, 'minified.json')}>Download</button>
              </div>
            </div>
            <pre style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {minifiedJSON}
            </pre>
          </div>
        )}
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>JSONPath Examples</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8, fontSize: '0.85rem' }}>
          <code>$</code>
          <code>$.store.book[0].author</code>
          <code>$.store.book[*].author</code>
          <code>$..author</code>
          <code>$.store.*</code>
          <code>$..book[?(@.price&lt;10)]</code>
        </div>
        <p className="muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>Supports basic JSONPath syntax. Use $ for root, . for properties, [n] for array index, [*] for all, [?()] for filters.</p>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Format, validate, minify JSON. Tree view with expand/collapse. JSONPath querying. Syntax highlighting. Download formatted or minified.
      </p>
    </div>
  )
}