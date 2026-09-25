import { useMemo, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { useFlip } from '../../motion/useFlip'
import { buildSchema, missingRequired, toScriptTag, TYPE_BY_ID, TYPES, type FieldDef, type FormData, type Row, type RowsDef, type SchemaType } from './schema'
import './tool.css'

let rowId = 1
const withIds = (rows: Row[]): Row[] => rows.map((r) => ({ ...r, _id: String(rowId++) }))
const fromExample = (t: SchemaType): FormData => ({
  fields: { ...t.example.fields },
  // Deterministic ids for the example rows, so prerendered HTML matches the first client render.
  rows: Object.fromEntries((t.rows ?? []).map((r) => [r.key, (t.example.rows[r.key] ?? []).map((row, i) => ({ ...row, _id: `x${i}` }))])),
})
const empty = (t: SchemaType): FormData => ({
  fields: Object.fromEntries(t.fields.filter((f) => f.kind === 'select').map((f) => [f.key, f.options?.[0]?.value ?? ''])),
  rows: Object.fromEntries((t.rows ?? []).map((r) => [r.key, withIds([{}])])),
})

function Field({ def, id, value, onChange }: { def: FieldDef; id: string; value: string; onChange: (v: string) => void }) {
  const common = { id, value, onChange: (e: { target: { value: string } }) => onChange(e.target.value) }
  let control
  if (def.kind === 'textarea') control = <textarea {...common} placeholder={def.placeholder} className="ld-textarea" />
  else if (def.kind === 'select')
    control = (
      <select {...common}>
        {def.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  else {
    const type = def.kind === 'datetime' ? 'datetime-local' : def.kind === 'url' ? 'url' : def.kind === 'number' ? 'number' : def.kind === 'date' ? 'date' : def.kind === 'time' ? 'time' : 'text'
    control = <input {...common} type={type} placeholder={def.placeholder} step={def.kind === 'number' ? 'any' : undefined} className={def.kind === 'time' ? 'ld-time' : undefined} />
  }
  return (
    <div className={def.kind === 'textarea' ? 'ld-wide' : undefined}>
      <label htmlFor={id}>
        {def.label}
        {def.required && <span className="ld-req" title="Recommended by Google"> *</span>}
      </label>
      {control}
      {def.help && <span className="muted ld-help">{def.help}</span>}
    </div>
  )
}

function RowGroup({ def, rows, onChange }: { def: RowsDef; rows: Row[]; onChange: (rows: Row[]) => void }) {
  const list = useRef<HTMLDivElement>(null)
  useFlip(list)
  const update = (i: number, key: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)))
  const move = (i: number, d: number) => {
    const next = [...rows]
    const [r] = next.splice(i, 1)
    next.splice(i + d, 0, r)
    onChange(next)
  }
  return (
    <fieldset className="ld-group">
      <legend>
        {def.label}
        {def.required && <span className="ld-req"> *</span>} <span className="muted ld-count">({rows.length})</span>
      </legend>
      <div ref={list}>
        {rows.map((r, i) => (
          <div key={r._id} data-flip={r._id} className="ld-row">
            <span className="ld-num" aria-hidden="true">{i + 1}</span>
            <div className="ld-row-fields">
              {def.fields.map((f) => (
                <Field key={f.key} def={f} id={`ld-${def.key}-${r._id}-${f.key}`} value={r[f.key] ?? ''} onChange={(v) => update(i, f.key, v)} />
              ))}
            </div>
            <div className="ld-row-actions">
              <button type="button" className="btn ld-mini" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${def.item} ${i + 1} up`}>↑</button>
              <button type="button" className="btn ld-mini" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${def.item} ${i + 1} down`}>↓</button>
              <button type="button" className="btn ld-mini ld-del" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove ${def.item} ${i + 1}`}>×</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="btn btn-icon ld-add" onClick={() => onChange([...rows, ...withIds([{}])])}>
        <Icon name="plus" size={16} /> Add {def.item}
      </button>
    </fieldset>
  )
}

export default function SchemaGenerator() {
  const [typeId, setTypeId] = useState('FAQPage')
  const [forms, setForms] = useState<Record<string, FormData>>(() => ({ FAQPage: fromExample(TYPE_BY_ID.get('FAQPage')!) }))
  const type = TYPE_BY_ID.get(typeId)!
  const data = forms[typeId]
  const pick = (t: SchemaType) => {
    setForms((f) => (f[t.id] ? f : { ...f, [t.id]: fromExample(t) }))
    setTypeId(t.id)
  }
  const setData = (d: FormData) => setForms((f) => ({ ...f, [typeId]: d }))

  const obj = useMemo(() => buildSchema(type, data), [type, data])
  const script = useMemo(() => toScriptTag(obj), [obj])
  const missing = missingRequired(type, data)
  const props = Object.keys(obj).filter((k) => !k.startsWith('@')).length

  return (
    <div>
      <PillRow role="tablist" label="Schema type" className="ld-types">
        {TYPES.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === typeId} className={`btn ${t.id === typeId ? 'primary' : ''}`} onClick={() => pick(t)}>{t.name}</button>
        ))}
      </PillRow>

      <div className="row" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: '0.86rem', marginRight: 'auto' }}>
          Schema.org type <code>{type.id}</code>. Fields marked <span className="ld-req">*</span> are required or recommended for rich results.
        </span>
        <button type="button" className="btn ld-mini-text" onClick={() => setData(fromExample(type))}>Load example</button>
        <button type="button" className="btn ld-mini-text" onClick={() => setData(empty(type))}>Clear form</button>
      </div>

      <div key={typeId} className="ld-form">
        {type.fields.length > 0 && (
          <div className="ld-fields">
            {type.fields.map((f) => (
              <Field key={f.key} def={f} id={`ld-${f.key}`} value={data.fields[f.key] ?? ''} onChange={(v) => setData({ ...data, fields: { ...data.fields, [f.key]: v } })} />
            ))}
          </div>
        )}
        {type.rows?.map((r) => (
          <RowGroup key={r.key} def={r} rows={data.rows[r.key] ?? []} onChange={(rows) => setData({ ...data, rows: { ...data.rows, [r.key]: rows } })} />
        ))}
      </div>

      <div className="row ld-status" aria-live="polite">
        {missing.length === 0 ? (
          <span className="chip good" key="ok"><Check size={14} /> All required fields filled</span>
        ) : (
          missing.map((m) => <span key={m} className="chip bad calm">Missing: {m}</span>)
        )}
        <span className="muted" style={{ fontSize: '0.85rem' }}>{props} properties</span>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label htmlFor="ld-out" style={{ margin: 0 }}>JSON-LD</label>
        <span className="row" style={{ margin: 0 }}>
          <CopyButton text={script} label="Copy script" />
          <CopyButton text={JSON.stringify(obj, null, 2)} label="Copy JSON" />
        </span>
      </div>
      <SettleOutput id="ld-out" value={script} motion="order" style={{ minHeight: 320 }} />

      <div className="row">
        <a className="btn btn-icon" href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer">
          <Icon name="search" size={18} /> Google Rich Results Test
        </a>
        <a className="btn btn-icon" href="https://validator.schema.org/" target="_blank" rel="noopener noreferrer">
          <Icon name="checkbox-list" size={18} /> Schema.org validator
        </a>
      </div>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Paste the script into your page's <code>&lt;head&gt;</code> or body. Empty fields are left out, so the output stays valid and minimal.
        The markup must match what visitors can see on the page, and Google decides whether to show a rich result. Test the live URL (or paste the code) in the Rich Results Test before publishing.
      </p>
    </div>
  )
}
