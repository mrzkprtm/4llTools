import { useEffect, useState } from 'react'
import { Hint, Select } from '../../sim/controls'
import Guide from './Guide'
import { lookup, matchMeasure, MEASURE_LABEL, TABLES, valuesOf, type MeasureKey } from './sizes'
import './tool.css'

const STORE = '4lltools:clothing-size'
type Measures = Partial<Record<MeasureKey, number>>
const EXAMPLE: Measures = { chest: 90, waist: 72, hip: 98, foot: 25.3, height: 110 }

export default function ClothingSize() {
  const [tableId, setTableId] = useState('women-tops')
  const t = TABLES.find((x) => x.id === tableId) ?? TABLES[0]
  const [system, setSystem] = useState(t.systems[0].key)
  const [value, setValue] = useState('M')
  const [m, setM] = useState<Measures>(EXAMPLE)
  const [focus, setFocus] = useState<MeasureKey | null>(null)
  const [unit, setUnit] = useState<'cm' | 'in'>('cm')

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null')
      if (s?.m && typeof s.m === 'object') setM({ ...EXAMPLE, ...s.m })
      if (s?.unit === 'in') setUnit('in')
    } catch {
      // Example values.
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ m, unit }))
    } catch {
      // Not saved.
    }
  }, [m, unit])

  function chooseTable(id: string) {
    const nt = TABLES.find((x) => x.id === id) ?? TABLES[0]
    setTableId(id)
    setSystem(nt.systems[0].key)
    setValue(nt.rows[Math.floor(nt.rows.length / 2)].sizes[nt.systems[0].key])
  }
  function chooseSystem(k: string) {
    const row = Math.max(0, lookup(t, system, value))
    setSystem(k)
    const v = t.rows[row].sizes[k]
    setValue(v === '–' ? valuesOf(t, k)[0] : v)
  }

  const picked = lookup(t, system, value)
  const match = matchMeasure(t, m)
  const isFoot = t.measures.includes('foot')
  const factor = unit === 'in' ? 2.54 : 1
  const show = (k: MeasureKey) => (m[k] ? +(m[k]! / factor).toFixed(1) : '')

  return (
    <div className="cz">
      <div className="cz-top">
        <Select label="Chart" value={tableId} options={TABLES.map((x) => [x.id, x.name] as const)} onChange={chooseTable} />
        <Select label="I know my size in" value={system} options={t.systems.map((s) => [s.key, s.label] as const)} onChange={chooseSystem} />
        <div className="sim-field">
          <span className="sim-label">Size</span>
          <div className="cz-chips" role="group" aria-label="Size">
            {valuesOf(t, system).map((v) => (
              <button key={v} type="button" className={`cz-chip ${v === value ? 'on' : ''}`} onClick={() => setValue(v)} aria-pressed={v === value}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="cz-table-wrap">
        <table className="simple cz-table">
          <thead>
            <tr>{t.systems.map((s) => <th key={s.key} className={s.key === system ? 'src' : ''}>{s.label}</th>)}</tr>
          </thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr key={i} className={`${i === picked ? 'on' : ''} ${match && i === match.index ? 'fit' : ''}`} onClick={() => setValue(r.sizes[system] === '–' ? value : r.sizes[system])}>
                {t.systems.map((s) => <td key={s.key}>{r.sizes[s.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {picked >= 0 && (
        <div className="cz-result" key={`${tableId}-${picked}`}>
          {t.systems.filter((s) => s.key !== system).map((s, i) => (
            <div key={s.key} className="cz-card" style={{ animationDelay: `${i * 50}ms` }}>
              <span className="muted">{s.label}</span>
              <b>{t.rows[picked].sizes[s.key]}</b>
            </div>
          ))}
        </div>
      )}

      <h3 className="cz-h">Find my size from measurements</h3>
      <div className="cz-find">
        <Guide active={focus ?? (isFoot ? 'foot' : t.measures[0])} foot={isFoot} />
        <div className="cz-inputs">
          <div className="row cz-units">
            {(['cm', 'in'] as const).map((u) => <button key={u} type="button" className={`btn ${unit === u ? 'primary' : ''}`} onClick={() => setUnit(u)}>{u}</button>)}
          </div>
          {t.measures.map((k) => (
            <label key={k}>
              {MEASURE_LABEL[k]} ({unit})
              <input type="number" inputMode="decimal" step="0.5" min={0} value={show(k)} onFocus={() => setFocus(k)} onBlur={() => setFocus(null)} onChange={(e) => { const v = parseFloat(e.target.value); setM({ ...m, [k]: Number.isFinite(v) && v > 0 ? v * factor : undefined }) }} />
            </label>
          ))}
          {match ? (
            <p className="cz-fit" key={`${tableId}-${match.index}`}>
              Best fit: <b>{t.systems.map((s) => `${s.label} ${t.rows[match.index].sizes[s.key]}`).slice(0, 3).join(' · ')}</b>
              {!match.exact && <span className="muted"> Your measurements fall between sizes, so we suggest the larger one. Check the brand's own chart.</span>}
            </p>
          ) : (
            <p className="muted">Enter a measurement to see your size.</p>
          )}
          <p className="muted cz-small">{isFoot ? 'Stand on paper with your heel against a wall and mark the tip of your longest toe; measure in the evening when feet are largest.' : 'Measure over light clothing, around the fullest part, with the tape level and snug but not tight.'}</p>
        </div>
      </div>
      <Hint>Pick a chart and the size you know to see it in every system, or type your measurements for a suggestion. Sizes vary between brands, and many Indonesian and Asian labels run about one size smaller than Western ones.</Hint>
    </div>
  )
}
