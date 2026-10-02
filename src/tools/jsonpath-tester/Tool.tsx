import { useEffect, useMemo, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { EXAMPLE } from './example'
import './tool.css'

type Mod = typeof import('./evaluate')
type PathStyle = 'dot' | 'bracket' | 'pointer'

const preview = (v: unknown) => {
  const s = JSON.stringify(v, null, 2)
  return s === undefined ? String(v) : s.length > 2000 ? `${s.slice(0, 2000)}…` : s
}

export default function JsonPathTester() {
  const [mod, setMod] = useState<Mod | null>(null)
  const [json, setJson] = useState(EXAMPLE)
  const [expr, setExpr] = useState('$..book[?(@.price < 10)].title')
  const [style, setStyle] = useState<PathStyle>('dot')

  useEffect(() => {
    let live = true
    import('./evaluate').then((m) => live && setMod(m))
    return () => {
      live = false
    }
  }, [])

  const result = useMemo(() => (mod ? mod.evaluate(json, expr) : null), [mod, json, expr])
  const matches = result?.ok ? result.matches : []
  const values = useMemo(() => JSON.stringify(matches.map((m) => m.value), null, 2), [matches])
  const pathOf = (m: (typeof matches)[number]) => (style === 'dot' ? m.dotPath : style === 'bracket' ? m.path : m.pointer)

  return (
    <div>
      <label htmlFor="jp-expr">JSONPath expression</label>
      <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
        <input
          id="jp-expr"
          type="text"
          className="jp-expr"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={result?.ok === false && result.where === 'path'}
          aria-describedby="jp-status"
        />
        <CopyButton text={expr} label="" />
      </div>
      <div id="jp-status" aria-live="polite">
        {!result ? (
          <Busy label="Loading the JSONPath engine…" />
        ) : result.ok ? (
          <p className="row" style={{ margin: '10px 0' }}>
            <span className={`chip ${matches.length ? 'good' : ''} pop`} key={matches.length}>
              <Roll>{matches.length}</Roll>&nbsp;{matches.length === 1 ? 'match' : 'matches'}
            </span>
          </p>
        ) : (
          <p className="error shake-once" role="alert" key={result.error}>
            {result.where === 'json' ? 'Invalid JSON: ' : 'Expression error: '}
            {result.error}
          </p>
        )}
      </div>

      <div className="two-col">
        <div style={{ minWidth: 0 }}>
          <label htmlFor="jp-json">JSON document</label>
          <textarea id="jp-json" value={json} onChange={(e) => setJson(e.target.value)} spellCheck={false} style={{ minHeight: 360 }} aria-invalid={result?.ok === false && result.where === 'json'} />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => setJson(EXAMPLE)}>Sample store</button>
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Open a JSON file"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setJson(await f.text())
                e.target.value = ''
              }}
            />
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ margin: '0 0 6px', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>Results</span>
            <PillRow label="Path style" style={{ margin: 0 }}>
              {(['dot', 'bracket', 'pointer'] as PathStyle[]).map((s) => (
                <button key={s} type="button" className={`btn ${style === s ? 'primary' : ''}`} aria-pressed={style === s} onClick={() => setStyle(s)} style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
                  {s === 'dot' ? '$.a.b' : s === 'bracket' ? "$['a']" : '/a/b'}
                </button>
              ))}
            </PillRow>
          </div>
          {result?.ok && matches.length === 0 && <p className="muted">No matches. Try one of the examples below.</p>}
          <ol className="jp-results" aria-label="Matches" key={expr}>
            {matches.slice(0, 200).map((m, i) => (
              <li key={m.path} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <div className="jp-path">
                  <code>{pathOf(m)}</code>
                  <CopyButton text={pathOf(m)} label="" />
                </div>
                <pre className="jp-val">{preview(m.value)}</pre>
              </li>
            ))}
          </ol>
          {matches.length > 200 && <p className="muted">Showing the first 200 of {matches.length}. Copy all values to get the rest.</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <CopyButton text={matches.length ? values : ''} label="Copy values" />
            <CopyButton text={matches.map(pathOf).join('\n')} label="Copy paths" />
          </div>
        </div>
      </div>

      <h3 style={{ margin: '24px 0 8px', fontSize: '1rem' }}>Syntax cheat sheet</h3>
      <p className="muted" style={{ marginTop: 0 }}>Click an example to try it on the sample store.</p>
      <div className="jp-cheats">
        {(mod?.CHEATSHEET ?? []).map((c) => (
          <button
            key={c.expr}
            type="button"
            className={`jp-cheat ${expr === c.expr ? 'is-on' : ''}`}
            onClick={() => {
              setExpr(c.expr)
              if (json !== EXAMPLE && !json.includes('"book"')) setJson(EXAMPLE)
            }}
          >
            <code>{c.expr}</code>
            <span>{c.meaning}</span>
          </button>
        ))}
      </div>
      <p className="muted">
        Uses the jsonpath-plus engine (Goessner syntax plus extras like <code>~</code> for property names and <code>^</code> for parents). Filter scripts run in its safe evaluator, not with <code>eval</code>, so arbitrary JavaScript is not allowed. Your JSON never leaves the browser.
      </p>
    </div>
  )
}
