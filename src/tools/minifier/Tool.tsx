import { useEffect, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { byteSize, run, type Lang, type Mode, type Result } from './process'

const SAMPLES: Record<Lang, string> = {
  js: `/*! demo.js – MIT */
import { format } from './utils.js'

// Greets every user in the list after a short delay
export async function greetAll(users, delayMs = 250) {
  const results = []
  for (const user of users) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    const message = \`Hello, \${format(user.name)}!\`
    results.push({ id: user.id, message })
  }
  return results
}
`,
  css: `/* Card component */
.card {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  width: calc(100% - 2 * 16px);
  background: url("img/bg.png") no-repeat center / cover;
  font-family: "Open Sans", system-ui, sans-serif;
}

.card > .title,
.card .subtitle::after {
  content: " — ";
  color: #333333 !important;
}

@media (min-width: 768px) {
  .card { flex-direction: row; }
}
`,
}

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(2)} KB`)

export default function Minifier() {
  const [lang, setLang] = useState<Lang>('js')
  const [mode, setMode] = useState<Mode>('minify')
  const [code, setCode] = useState(SAMPLES.js)
  const [indent, setIndent] = useState<number | 'tab'>(2)
  const [mangle, setMangle] = useState(true)
  const [keepLicense, setKeepLicense] = useState(true)
  const [result, setResult] = useState<Result>({ ok: true, output: '' })
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    setBusy(true)
    const t = setTimeout(() => {
      run(lang, mode, code, { indent, mangle, keepLicense }).then((r) => {
        if (cancelled) return
        setResult(r)
        setBusy(false)
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [lang, mode, code, indent, mangle, keepLicense])

  function switchLang(l: Lang) {
    if (l === lang) return
    if (code === SAMPLES[lang] || !code.trim()) setCode(SAMPLES[l])
    setLang(l)
  }

  function jumpTo(line?: number, col?: number) {
    const el = inputRef.current
    if (!el || !line) return
    const lines = code.split('\n')
    let pos = 0
    for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1
    pos += col ?? 0
    el.focus()
    el.setSelectionRange(pos, Math.min(pos + 1, code.length))
  }

  const output = result.ok ? result.output : ''
  const before = byteSize(code)
  const after = byteSize(output)
  const saved = before > 0 && output ? Math.round((1 - after / before) * 1000) / 10 : 0

  function download() {
    const blob = new Blob([output], { type: lang === 'js' ? 'text/javascript' : 'text/css' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${mode === 'minify' ? 'output.min' : 'output'}.${lang}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <div className="row">
        <button type="button" className={`btn ${lang === 'js' ? 'primary' : ''}`} onClick={() => switchLang('js')}>JavaScript</button>
        <button type="button" className={`btn ${lang === 'css' ? 'primary' : ''}`} onClick={() => switchLang('css')}>CSS</button>
        <span style={{ width: 8 }} />
        <button type="button" className={`btn ${mode === 'minify' ? 'primary' : ''}`} onClick={() => setMode('minify')}>Minify</button>
        <button type="button" className={`btn ${mode === 'beautify' ? 'primary' : ''}`} onClick={() => setMode('beautify')}>Beautify</button>
      </div>
      <div className="row">
        {mode === 'beautify' ? (
          <select value={String(indent)} onChange={(e) => setIndent(e.target.value === 'tab' ? 'tab' : Number(e.target.value))} style={{ width: 'auto' }} aria-label="Indent">
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tabs</option>
          </select>
        ) : lang === 'js' ? (
          <>
            <label style={{ fontWeight: 400 }}><input type="checkbox" checked={mangle} onChange={(e) => setMangle(e.target.checked)} /> Shorten variable names</label>
            <label style={{ fontWeight: 400 }}><input type="checkbox" checked={keepLicense} onChange={(e) => setKeepLicense(e.target.checked)} /> Keep licence comments</label>
          </>
        ) : (
          <span className="muted" style={{ fontSize: '0.88rem' }}>Keeps strings, url(), /*! comments and the spaces calc() needs.</span>
        )}
      </div>
      <label htmlFor="min-in">Input</label>
      <textarea id="min-in" ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} style={{ minHeight: 220 }} />
      <label htmlFor="min-file">Or open a file</label>
      <input
        id="min-file"
        type="file"
        accept=".js,.mjs,.cjs,.css,text/javascript,text/css"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) {
            setLang(/\.css$/i.test(f.name) ? 'css' : 'js')
            setCode(await f.text())
          }
          e.target.value = ''
        }}
      />
      {!result.ok && (
        <p className="error" role="alert">
          {result.message}
          {result.line ? ` (line ${result.line}, column ${(result.col ?? 0) + 1})` : ''}{' '}
          {result.line && <button type="button" className="btn" style={{ padding: '3px 9px', fontSize: '0.82rem' }} onClick={() => jumpTo(result.line, result.col)}>Show</button>}
        </p>
      )}
      <div className="stats">
        <div className="stat"><b>{formatBytes(before)}</b>Before</div>
        <div className="stat"><b>{formatBytes(after)}</b>After</div>
        <div className="stat"><b className={saved > 0 ? 'ok' : undefined}>{saved > 0 ? `${saved}%` : saved < 0 ? `+${-saved}%` : '0%'}</b>{saved >= 0 ? 'Saved' : 'Larger'}</div>
      </div>
      <label htmlFor="min-out">
        Output {busy && <span className="muted" style={{ fontWeight: 400 }} aria-live="polite">· working…</span>}
      </label>
      <textarea id="min-out" readOnly value={output} spellCheck={false} style={{ minHeight: 200, opacity: busy ? 0.6 : 1, transition: 'opacity .2s' }} />
      <div className="row">
        <CopyButton text={output} />
        <button type="button" className="btn" onClick={download} disabled={!output}>Download</button>
      </div>
      <p className="muted" style={{ fontSize: '0.85rem' }}>JavaScript is minified with Terser and beautified with js-beautify; everything runs in your browser.</p>
    </div>
  )
}
