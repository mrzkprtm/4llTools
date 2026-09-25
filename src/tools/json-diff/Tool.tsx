import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import { diff, summarize, toDisplayPath, toPatch, toPointer, type Change } from './diff'
import './tool.css'

const LEFT = `{
  "name": "orders-api",
  "version": "1.4.0",
  "replicas": 2,
  "env": { "LOG_LEVEL": "info", "REGION": "eu-west-1" },
  "features": ["search", "export"],
  "maintainer": { "name": "Rina", "team": "platform" },
  "deprecated": false
}`

const RIGHT = `{
  "version": "1.5.0",
  "name": "orders-api",
  "replicas": 3,
  "env": { "REGION": "eu-west-1", "LOG_LEVEL": "debug", "CACHE_TTL": 300 },
  "features": ["search", "export", "webhooks"],
  "maintainer": { "name": "Rina", "team": "platform" }
}`

type View = 'unified' | 'split' | 'patch'

function parse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

const show = (v: unknown) => {
  const s = JSON.stringify(v)
  return s.length > 400 ? `${s.slice(0, 400)}…` : s
}

const SIGN = { add: '+', remove: '−', replace: '~' }

export default function JsonDiff() {
  const [left, setLeft] = useState(LEFT)
  const [right, setRight] = useState(RIGHT)
  const [unordered, setUnordered] = useState(false)
  const [view, setView] = useState<View>('unified')
  const [turns, setTurns] = useState(0)

  const a = useMemo(() => parse(left), [left])
  const b = useMemo(() => parse(right), [right])
  const changes: Change[] = useMemo(() => (a.ok && b.ok ? diff(a.value, b.value, { ignoreArrayOrder: unordered }) : []), [a, b, unordered])
  const counts = summarize(changes)
  const patch = useMemo(() => JSON.stringify(toPatch(changes), null, 2), [changes])
  const ready = a.ok && b.ok

  function swap() {
    setTurns((t) => t + 1)
    setLeft(right)
    setRight(left)
  }

  function download() {
    const el = document.createElement('a')
    el.href = URL.createObjectURL(new Blob([patch], { type: 'application/json-patch+json' }))
    el.download = 'changes.patch.json'
    el.click()
    URL.revokeObjectURL(el.href)
  }

  const fileInput = (set: (s: string) => void, label: string) => (
    <input
      type="file"
      accept=".json,application/json"
      aria-label={label}
      onChange={async (e) => {
        const f = e.target.files?.[0]
        if (f) set(await f.text())
        e.target.value = ''
      }}
    />
  )

  return (
    <div>
      <div className="two-col">
        <div style={{ minWidth: 0 }}>
          <label htmlFor="jd-a">Original (A)</label>
          <textarea id="jd-a" value={left} onChange={(e) => setLeft(e.target.value)} spellCheck={false} style={{ minHeight: 260 }} aria-invalid={!a.ok} />
          {!a.ok && <p className="error shake-once" role="alert" key={a.error}>A: {a.error}</p>}
          <div className="row" style={{ marginTop: 6 }}>{fileInput(setLeft, 'Open original JSON file')}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <label htmlFor="jd-b">Changed (B)</label>
          <textarea id="jd-b" value={right} onChange={(e) => setRight(e.target.value)} spellCheck={false} style={{ minHeight: 260 }} aria-invalid={!b.ok} />
          {!b.ok && <p className="error shake-once" role="alert" key={b.error}>B: {b.error}</p>}
          <div className="row" style={{ marginTop: 6 }}>{fileInput(setRight, 'Open changed JSON file')}</div>
        </div>
      </div>

      <div className="row">
        <button type="button" className="btn" onClick={swap} aria-label="Swap A and B">
          <span className="spin-icon" style={{ display: 'inline-block', transition: 'transform var(--spring-snap-ms) var(--spring-snap)', transform: `rotate(${turns * 180}deg)` }}>⇄</span> Swap
        </button>
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={unordered} onChange={(e) => setUnordered(e.target.checked)} /> Ignore array order
        </label>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Object key order is always ignored.</span>
      </div>

      {ready && (
        <div className="row" aria-live="polite" style={{ gap: 6 }}>
          <span className="chip good" key={`a${counts.add}`}>+<Roll>{counts.add}</Roll>&nbsp;added</span>
          <span className="chip bad calm" key={`r${counts.remove}`}>−<Roll>{counts.remove}</Roll>&nbsp;removed</span>
          <span className="chip" key={`c${counts.replace}`}>~<Roll>{counts.replace}</Roll>&nbsp;changed</span>
        </div>
      )}

      <PillRow label="View">
        {([
          ['unified', 'Unified'],
          ['split', 'Side by side'],
          ['patch', 'JSON Patch'],
        ] as [View, string][]).map(([id, label]) => (
          <button key={id} type="button" className={`btn ${view === id ? 'primary' : ''}`} aria-pressed={view === id} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </PillRow>

      {ready && changes.length === 0 ? (
        <div className="jd-same" role="status">
          <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}><Check size={20} /></span>
          The two documents are equivalent{unordered ? ' (ignoring array order)' : ''}.
        </div>
      ) : !ready ? null : view === 'unified' ? (
        <ol className="jd-list" aria-label="Differences" key={`${left.length}-${right.length}-${unordered}`}>
          {changes.map((c, i) => (
            <li key={i} className={`jd-${c.op}`} style={{ animationDelay: `${Math.min(i, 14) * 28}ms` }}>
              <span className="jd-sign" aria-label={c.op}>{SIGN[c.op]}</span>
              <span className="jd-path">{toDisplayPath(c.path)}</span>
              <span className="jd-vals">
                {c.op !== 'add' && <span className="jd-old">{show(c.oldValue)}</span>}
                {c.op === 'replace' && <span aria-hidden="true"> → </span>}
                {c.op !== 'remove' && <span className="jd-new">{show(c.value)}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : view === 'split' ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="jd-table">
            <thead>
              <tr><th scope="col">Path</th><th scope="col">A</th><th scope="col">B</th></tr>
            </thead>
            <tbody key={`${left.length}-${right.length}-${unordered}`}>
              {changes.map((c, i) => (
                <tr key={i} style={{ animationDelay: `${Math.min(i, 14) * 28}ms` }}>
                  <td>{toDisplayPath(c.path)}</td>
                  {c.op === 'add' ? <td className="jd-none">(missing)</td> : <td className="jd-l">{show(c.oldValue)}</td>}
                  {c.op === 'remove' ? <td className="jd-none">(missing)</td> : <td className="jd-r">{show(c.value)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <label htmlFor="jd-patch">JSON Patch (RFC 6902) that turns A into B</label>
          <SettleOutput id="jd-patch" value={patch} motion="order" style={{ minHeight: 240 }} />
          <div className="row" style={{ marginTop: 8 }}>
            <CopyButton text={patch} />
            <button type="button" className="btn" onClick={download}>Download .json</button>
          </div>
          {unordered && <p className="muted">With “ignore array order”, array items are removed and re-appended (<code>/-</code>) rather than moved, so the result has the same items but maybe in a different order.</p>}
        </div>
      )}
      {ready && changes.length > 0 && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Paths use <code>$.key[index]</code> notation; the patch uses JSON Pointers like <code>{toPointer(changes[0].path) || '/'}</code>.
        </p>
      )}
      <p className="muted">
        Compares values, not text: formatting, whitespace and key order don't count, and <code>1</code> equals <code>1.0</code>. Arrays are compared index by index; extra items show as added or removed. Both documents stay in your browser.
      </p>
    </div>
  )
}
