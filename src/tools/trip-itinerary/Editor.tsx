import { useState } from 'react'
import { DAY_END, DAY_START, durLabel, place, TYPES, type Activity, type ActType } from './logic'

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const DURS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480]

interface Props {
  act: Activity | null
  days: number
  onChange: (patch: Partial<Activity>) => void
  onDelete: () => void
  onClose: () => void
  onAdd: (a: Omit<Activity, 'id' | 'day' | 'start'>) => void
}

/** Edits the selected stop, or adds a new idea when nothing is selected. */
export default function Editor({ act, days, onChange, onDelete, onClose, onAdd }: Props) {
  const [name, setName] = useState('')
  const [where, setWhere] = useState('')
  const [type, setType] = useState<ActType>('sight')
  const [dur, setDur] = useState(60)

  if (!act) {
    return (
      <form className="ti-editor" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd({ name: name.trim(), place: where.trim(), type, dur }); setName(''); setWhere('') } }}>
        <h3>New idea</h3>
        <input type="text" placeholder="What (e.g. Uluwatu Temple)" aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="text" placeholder="Where (optional)" aria-label="Place" value={where} onChange={(e) => setWhere(e.target.value)} />
        <div className="ti-pair">
          <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as ActType)}>
            {(Object.keys(TYPES) as ActType[]).map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
          </select>
          <select aria-label="Duration" value={dur} onChange={(e) => setDur(Number(e.target.value))}>
            {DURS.map((d) => <option key={d} value={d}>{durLabel(d)}</option>)}
          </select>
        </div>
        <button type="submit" className="btn primary" disabled={!name.trim()}>Add to ideas</button>
      </form>
    )
  }

  return (
    <div className="ti-editor settle-in" key={act.id}>
      <h3>Edit stop <button type="button" className="ti-close" aria-label="Close editor" onClick={onClose}>×</button></h3>
      <input type="text" aria-label="Name" value={act.name} onChange={(e) => onChange({ name: e.target.value })} />
      <input type="text" aria-label="Place" placeholder="Place" value={act.place} onChange={(e) => onChange({ place: e.target.value })} />
      <div className="ti-pair">
        <select aria-label="Type" value={act.type} onChange={(e) => onChange({ type: e.target.value as ActType })}>
          {(Object.keys(TYPES) as ActType[]).map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
        </select>
        <select aria-label="Day" value={act.day ?? -1} onChange={(e) => { const d = Number(e.target.value); onChange({ day: d < 0 ? null : d }) }}>
          <option value={-1}>Ideas (unscheduled)</option>
          {Array.from({ length: days }, (_, i) => <option key={i} value={i}>Day {i + 1}</option>)}
        </select>
      </div>
      <div className="ti-pair">
        <label>Start<input type="time" step={900} min={hm(DAY_START)} value={hm(act.start)} onChange={(e) => onChange(place(toMin(e.target.value), act.dur))} /></label>
        <label>Length<select value={act.dur} onChange={(e) => onChange(place(act.start, Number(e.target.value)))}>
          {(DURS.includes(act.dur) ? DURS : [...DURS, act.dur].sort((a, b) => a - b)).filter((d) => d <= DAY_END - DAY_START).map((d) => <option key={d} value={d}>{durLabel(d)}</option>)}
        </select></label>
      </div>
      <button type="button" className="btn" onClick={onDelete}>Delete stop</button>
    </div>
  )
}
