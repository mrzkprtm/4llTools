import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { htmlToJsx } from './convert'
import './tool.css'

const EXAMPLE = `<!-- Sign-up card -->
<div class="card" style="padding: 16px; border-radius: 12px; background-color: #fff">
  <h2 class="card-title">Join the beta</h2>
  <p>Get early access. <a href="/terms" target="_blank">Terms apply</a>.</p>
  <form onsubmit="handleSubmit(event)">
    <label for="email">Email</label>
    <input id="email" type="email" placeholder="you@example.com" required autofocus tabindex="1">
    <input type="checkbox" id="news" checked> <label for="news">Send me news</label>
    <button type="submit" class="btn primary">Sign up</button>
  </form>
  <svg width="24" height="24" viewBox="0 0 24 24"><path stroke-width="2" stroke-linecap="round" d="M5 12l5 5L20 7"/></svg>
</div>`

export default function HtmlToJsx() {
  const [html, setHtml] = useState(EXAMPLE)
  const [wrap, setWrap] = useState(true)
  const [name, setName] = useState('SignupCard')
  const [indent, setIndent] = useState('  ')
  const [uncontrolled, setUncontrolled] = useState(true)
  const [ext, setExt] = useState<'jsx' | 'tsx'>('jsx')

  const result = useMemo(() => {
    try {
      return { ...htmlToJsx(html, { indent, component: wrap ? name || 'Component' : null, uncontrolled }), error: '' }
    } catch (e) {
      return { jsx: '', roots: 0, notes: [], error: e instanceof Error ? e.message : String(e) }
    }
  }, [html, wrap, name, indent, uncontrolled])

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([result.jsx], { type: 'text/plain' }))
    a.download = `${(wrap && name) || 'component'}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="jx-opts">
        <label><input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} /> Wrap in component</label>
        <label htmlFor="jx-name" className="muted" style={{ fontSize: '0.9rem' }}>Name</label>
        <input id="jx-name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={!wrap} style={{ width: 160 }} spellCheck={false} />
        <label title="value/checked become defaultValue/defaultChecked so React doesn't warn about read-only fields">
          <input type="checkbox" checked={uncontrolled} onChange={(e) => setUncontrolled(e.target.checked)} /> defaultValue for form fields
        </label>
        <select value={indent} onChange={(e) => setIndent(e.target.value)} aria-label="Indentation" style={{ width: 'auto' }}>
          <option value="  ">2 spaces</option>
          <option value="    ">4 spaces</option>
          <option value={'\t'}>Tabs</option>
        </select>
      </div>
      <div className="two-col">
        <div style={{ minWidth: 0 }}>
          <label htmlFor="jx-in">HTML</label>
          <textarea id="jx-in" value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false} style={{ minHeight: 360 }} />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => setHtml(EXAMPLE)}>Example</button>
            <button type="button" className="btn" onClick={() => setHtml('')}>Clear</button>
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ margin: '0 0 6px', justifyContent: 'space-between' }}>
            <label htmlFor="jx-out" style={{ margin: 0 }}>JSX</label>
            <PillRow label="File type" style={{ margin: 0 }}>
              {(['jsx', 'tsx'] as const).map((x) => (
                <button key={x} type="button" className={`btn ${ext === x ? 'primary' : ''}`} aria-pressed={ext === x} onClick={() => setExt(x)} style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
                  .{x}
                </button>
              ))}
            </PillRow>
          </div>
          <SettleOutput id="jx-out" value={result.jsx} motion="order" style={{ minHeight: 360 }} />
          <div className="row" style={{ marginTop: 8 }}>
            <CopyButton text={result.jsx} />
            <button type="button" className="btn" onClick={download} disabled={!result.jsx}>Download .{ext}</button>
          </div>
        </div>
      </div>
      {result.error && <p className="error shake-once" role="alert">{result.error}</p>}
      <div aria-live="polite">
        {result.roots > 1 && (
          <p className="row" style={{ margin: '8px 0' }}>
            <span className="chip pop" key={result.roots}>{result.roots} top-level nodes wrapped in a &lt;&gt;fragment&lt;/&gt;</span>
          </p>
        )}
        {result.notes.length > 0 && (
          <ul className="jx-notes">
            {result.notes.map((n, i) => (
              <li key={n} style={{ animationDelay: `${i * 40}ms` }}>{n}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="muted">
        Converts <code>class</code> → <code>className</code>, <code>for</code> → <code>htmlFor</code>, inline <code>style</code> strings to objects, hyphenated SVG attributes (<code>stroke-width</code> → <code>strokeWidth</code>) and events (<code>onclick</code> → <code>onClick</code>), self-closes void tags like <code>&lt;img /&gt;</code> and turns comments into <code>{'{/* */}'}</code>. The parser is forgiving but not a full browser engine, so check heavily broken HTML. Nothing is uploaded.
      </p>
    </div>
  )
}
