import { useEffect, useMemo, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { FIELD_TYPES, generateRowsAsync, toCSV, toJSON, toSQL, type Field, type FieldType, type Row, type SqlDialect } from './mock'

type Output = 'json' | 'csv' | 'sql'
const MAX_ROWS = 10000
const PREVIEW_CHARS = 60_000

let nextId = 100
const DEFAULT_FIELDS: Field[] = [
  { id: 1, name: 'id', type: 'id' },
  { id: 2, name: 'full_name', type: 'fullName' },
  { id: 3, name: 'email', type: 'email' },
  { id: 4, name: 'city', type: 'city' },
  { id: 5, name: 'age', type: 'integer', min: 18, max: 65 },
  { id: 6, name: 'is_active', type: 'boolean' },
  { id: 7, name: 'joined_at', type: 'date', from: '2022-01-01', to: '2026-06-30' },
  { id: 8, name: 'plan', type: 'pick', list: 'free, pro, business' },
]

const inputStyle = { minWidth: 0 }

export default function MockData() {
  const [fields, setFields] = useState<Field[]>(DEFAULT_FIELDS)
  const [count, setCount] = useState(10)
  const [seed, setSeed] = useState('4lltools')
  const [format, setFormat] = useState<Output>('json')
  const [table, setTable] = useState('users')
  const [dialect, setDialect] = useState<SqlDialect>('standard')
  const [rows, setRows] = useState<Row[]>([])
  const [progress, setProgress] = useState<number | null>(null)
  const [runs, setRuns] = useState(0)
  const cancelRef = useRef(0)

  const nameProblem = useMemo(() => {
    const names = fields.map((f) => f.name.trim())
    if (!fields.length) return 'Add at least one field.'
    if (names.some((n) => !n)) return 'Every field needs a name.'
    const dup = names.find((n, i) => names.indexOf(n) !== i)
    return dup ? `The field name "${dup}" is used twice.` : ''
  }, [fields])

  const safeCount = Math.min(MAX_ROWS, Math.max(1, Math.floor(count) || 1))

  useEffect(() => {
    if (nameProblem) return
    const token = ++cancelRef.current
    const trimmed = fields.map((f) => ({ ...f, name: f.name.trim() }))
    const timer = setTimeout(() => {
      if (safeCount > 2000) setProgress(0)
      generateRowsAsync(trimmed, safeCount, seed, (d) => token === cancelRef.current && safeCount > 2000 && setProgress(d), () => token !== cancelRef.current).then((r) => {
        if (r && token === cancelRef.current) {
          setRows(r)
          setProgress(null)
        }
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [fields, safeCount, seed, nameProblem, runs])

  const cleanFields = useMemo(() => fields.map((f) => ({ ...f, name: f.name.trim() })), [fields])
  const output = useMemo(() => {
    if (nameProblem || !rows.length) return ''
    if (format === 'json') return toJSON(rows)
    if (format === 'csv') return toCSV(cleanFields, rows)
    return toSQL(table.trim() || 'mock_data', cleanFields, rows, 500, dialect)
  }, [rows, format, cleanFields, table, dialect, nameProblem])

  function update(id: number, patch: Partial<Field>) {
    setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }
  function move(id: number, dir: -1 | 1) {
    setFields((fs) => {
      const i = fs.findIndex((f) => f.id === id)
      const j = i + dir
      if (j < 0 || j >= fs.length) return fs
      const copy = [...fs]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function download() {
    const ext = format
    const mime = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'application/sql'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([output], { type: mime }))
    a.download = `${(table.trim() || 'mock_data').replace(/[^\w.-]+/g, '_')}.${ext}`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const sizeKb = useMemo(() => (new TextEncoder().encode(output).length / 1024).toFixed(1), [output])
  const preview = output.length > PREVIEW_CHARS ? `${output.slice(0, PREVIEW_CHARS)}\n… (preview cut here; Copy and Download include all ${rows.length.toLocaleString()} rows)` : output

  return (
    <div>
      <style>{`@keyframes mb-spin{to{transform:rotate(360deg)}}@keyframes mb-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
      <label>Fields</label>
      <div style={{ display: 'grid', gap: 8 }}>
        {fields.map((f, i) => (
          <div
            key={f.id}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: 8, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--sunken)', animation: 'mb-in .18s ease-out' }}
          >
            <input type="text" aria-label="Field name" value={f.name} onChange={(e) => update(f.id, { name: e.target.value })} style={{ ...inputStyle, flex: '1 1 130px' }} spellCheck={false} />
            <select aria-label="Field type" value={f.type} onChange={(e) => update(f.id, { type: e.target.value as FieldType })} style={{ ...inputStyle, flex: '1 1 150px' }}>
              {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
            {(f.type === 'integer' || f.type === 'decimal') && (
              <>
                <input type="number" aria-label="Minimum" placeholder="min" value={f.min ?? 0} onChange={(e) => update(f.id, { min: Number(e.target.value) })} style={{ ...inputStyle, flex: '0 1 90px' }} />
                <input type="number" aria-label="Maximum" placeholder="max" value={f.max ?? 1000} onChange={(e) => update(f.id, { max: Number(e.target.value) })} style={{ ...inputStyle, flex: '0 1 90px' }} />
              </>
            )}
            {f.type === 'id' && (
              <input type="number" aria-label="Start at" title="Start at" value={f.min ?? 1} onChange={(e) => update(f.id, { min: Number(e.target.value) })} style={{ ...inputStyle, flex: '0 1 90px' }} />
            )}
            {(f.type === 'date' || f.type === 'datetime') && (
              <>
                <input type="date" aria-label="From date" value={f.from ?? '2020-01-01'} onChange={(e) => update(f.id, { from: e.target.value })} style={{ ...inputStyle, flex: '0 1 150px' }} />
                <input type="date" aria-label="To date" value={f.to ?? '2026-12-31'} onChange={(e) => update(f.id, { to: e.target.value })} style={{ ...inputStyle, flex: '0 1 150px' }} />
              </>
            )}
            {f.type === 'pick' && (
              <input type="text" aria-label="Comma-separated values" placeholder="red, green, blue" value={f.list ?? ''} onChange={(e) => update(f.id, { list: e.target.value })} style={{ ...inputStyle, flex: '2 1 160px' }} />
            )}
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              <button type="button" className="btn" onClick={() => move(f.id, -1)} disabled={i === 0} aria-label="Move up" style={{ padding: '6px 9px' }}>↑</button>
              <button type="button" className="btn" onClick={() => move(f.id, 1)} disabled={i === fields.length - 1} aria-label="Move down" style={{ padding: '6px 9px' }}>↓</button>
              <button type="button" className="btn" onClick={() => setFields((fs) => fs.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.name}`} style={{ padding: '6px 9px' }}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={() => setFields((fs) => [...fs, { id: ++nextId, name: `field_${fs.length + 1}`, type: 'firstName' }])}>+ Add field</button>
        <button type="button" className="btn" onClick={() => setFields(DEFAULT_FIELDS)}>Reset example</button>
      </div>
      {nameProblem && <p className="error">{nameProblem}</p>}

      <div className="two-col">
        <div>
          <label htmlFor="mb-count">Rows (max {MAX_ROWS.toLocaleString()})</label>
          <input id="mb-count" type="number" min={1} max={MAX_ROWS} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="mb-seed">Seed (same seed = same data)</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input id="mb-seed" type="text" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ minWidth: 0, flex: 1 }} />
            <button type="button" className="btn" onClick={() => { setSeed(Math.random().toString(36).slice(2, 10)); setRuns((r) => r + 1) }}>Random</button>
          </div>
        </div>
      </div>
      {count > MAX_ROWS && <p className="muted">Limited to {MAX_ROWS.toLocaleString()} rows.</p>}

      <div className="row">
        {(['json', 'csv', 'sql'] as Output[]).map((o) => (
          <button key={o} type="button" className={`btn ${format === o ? 'primary' : ''}`} onClick={() => setFormat(o)}>{o.toUpperCase()}</button>
        ))}
        {format === 'sql' && (
          <>
            <input type="text" aria-label="Table name" value={table} onChange={(e) => setTable(e.target.value)} placeholder="table name" style={{ width: 'auto', flex: '1 1 120px', minWidth: 0 }} />
            <select aria-label="SQL quoting style" value={dialect} onChange={(e) => setDialect(e.target.value as SqlDialect)} style={{ width: 'auto' }}>
              <option value="standard">PostgreSQL / SQLite ("name")</option>
              <option value="mysql">MySQL / MariaDB (`name`)</option>
            </select>
          </>
        )}
      </div>

      {progress !== null && (
        <p className="muted" role="status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'mb-spin .7s linear infinite', display: 'inline-block' }} />
          Generating… {progress.toLocaleString()} / {safeCount.toLocaleString()} rows
        </p>
      )}
      <textarea readOnly value={preview} spellCheck={false} aria-label="Generated data" style={{ minHeight: 300, whiteSpace: 'pre', overflowX: 'auto', opacity: progress !== null ? 0.5 : 1, transition: 'opacity .2s' }} />
      <div className="row">
        <CopyButton text={output} />
        <button type="button" className="btn" onClick={download} disabled={!output}>Download .{format}</button>
        <span className="muted" style={{ fontSize: '0.88rem' }}>{rows.length.toLocaleString()} rows · {sizeKb} KB</span>
      </div>
      <p className="muted">Data is random and fictional, drawn from a mix of Indonesian and international names and cities. Emails match the name in the same row. SQL inserts are batched 500 rows per statement.</p>
    </div>
  )
}
