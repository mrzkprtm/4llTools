import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import { generate, parseJsonInput, type Mode } from './infer'
import './tool.css'

const EXAMPLE = `{
  "id": 1042,
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "is_active": true,
  "rating": 4.8,
  "tags": ["admin", "beta"],
  "address": { "city": "London", "postal-code": "N1 9GU" },
  "orders": [
    { "id": "ord_1", "total": 19.99, "shipped_at": "2026-03-01T10:00:00Z" },
    { "id": "ord_2", "total": 5, "shipped_at": null, "coupon": "SPRING" }
  ]
}`

const MODES: { id: Mode; label: string; ext: string; note: string }[] = [
  { id: 'interface', label: 'TS interfaces', ext: 'ts', note: 'One interface per object shape. Fields missing from some array items become optional (?).' },
  { id: 'type', label: 'TS types', ext: 'ts', note: 'Type aliases instead of interfaces, handy when you want to intersect or map them later.' },
  { id: 'zod', label: 'Zod schema', ext: 'ts', note: 'Runtime validation with Zod. Nested schemas are declared first, and a z.infer type is exported for each.' },
  { id: 'schema', label: 'JSON Schema', ext: 'json', note: 'Draft 2020-12 schema with $defs for nested objects and a "required" list for fields present in every sample.' },
]

export default function JsonToTypescript() {
  const [input, setInput] = useState(EXAMPLE)
  const [mode, setMode] = useState<Mode>('interface')
  const [rootName, setRootName] = useState('User')
  const [exported, setExported] = useState(true)
  const [readonly, setReadonly] = useState(false)

  const parsed = useMemo(() => parseJsonInput(input), [input])
  const output = useMemo(() => (parsed.ok ? generate(parsed.value, { mode, rootName, exported, readonly }) : ''), [parsed, mode, rootName, exported, readonly])
  const current = MODES.find((m) => m.id === mode)!
  const declCount = (output.match(/\b(interface|type|const) \w+/g) ?? []).length

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([output], { type: current.ext === 'json' ? 'application/json' : 'text/plain' }))
    a.download = `${rootName || 'types'}.${current.ext === 'json' ? 'schema.json' : 'ts'}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <PillRow label="Output format">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={`btn ${mode === m.id ? 'primary' : ''}`} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </PillRow>
      <div className="row">
        <label htmlFor="jt-root">Root name</label>
        <input id="jt-root" type="text" value={rootName} onChange={(e) => setRootName(e.target.value)} style={{ width: 160 }} spellCheck={false} />
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={exported} onChange={(e) => setExported(e.target.checked)} /> export</label>
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={readonly} onChange={(e) => setReadonly(e.target.checked)} disabled={mode === 'schema'} /> readonly</label>
      </div>
      <div className="two-col">
        <div style={{ minWidth: 0 }}>
          <label htmlFor="jt-in">Sample JSON</label>
          <textarea id="jt-in" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} style={{ minHeight: 340 }} aria-invalid={!parsed.ok} />
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => setInput(EXAMPLE)}>Example</button>
            <button type="button" className="btn" onClick={() => setInput('')}>Clear</button>
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Open a JSON file"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setInput(await f.text())
                e.target.value = ''
              }}
            />
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <label htmlFor="jt-out">{current.label}</label>
          <SettleOutput id="jt-out" key={mode} className="jt-out swap-code" value={output} motion="order" />
          <div className="row" style={{ marginTop: 8 }}>
            <CopyButton text={output} />
            <button type="button" className="btn" onClick={download} disabled={!output}>Download .{current.ext}</button>
          </div>
        </div>
      </div>
      {!parsed.ok ? (
        <p className="error shake-once" role="alert" key={parsed.error}>{parsed.error}</p>
      ) : (
        <div className="jt-stats" aria-live="polite">
          <span className="chip good pop" key={mode}><Roll>{declCount}</Roll>&nbsp;declarations</span>
          <span className="chip">{output.split('\n').length - 1} lines</span>
        </div>
      )}
      <p className="muted jt-mode-note" key={mode + '-n'}>{current.note}</p>
      <p className="muted">
        Types are inferred from the sample only, so paste an array with several items to learn which fields are optional or nullable. Whole numbers become <code>number</code> in TypeScript, <code>.int()</code> in Zod and <code>integer</code> in JSON Schema. Keys that aren't valid identifiers are quoted. Everything runs in your browser.
      </p>
    </div>
  )
}
