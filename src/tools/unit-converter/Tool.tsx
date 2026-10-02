import { useState } from 'react'
import Roll from '../../motion/Roll'
import { GROUPS, convert, formatNumber, unitsOf } from './units'

export default function UnitConverter() {
  const [group, setGroup] = useState('Length')
  const [from, setFrom] = useState('Meter')
  const [to, setTo] = useState('Foot')
  const [value, setValue] = useState('1')
  const [turns, setTurns] = useState(0)

  function changeGroup(g: string) {
    const units = unitsOf(g)
    setGroup(g)
    setFrom(units[0])
    setTo(units[1])
  }

  const num = Number(value)
  const result = value.trim() !== '' && Number.isFinite(num) ? formatNumber(convert(num, group, from, to)) : '—'

  return (
    <div>
      <label htmlFor="uc-group">Type</label>
      <select id="uc-group" value={group} onChange={(e) => changeGroup(e.target.value)}>
        {GROUPS.map((g) => <option key={g}>{g}</option>)}
      </select>
      <label htmlFor="uc-value">Value</label>
      <input id="uc-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="row">
        <select aria-label="From unit" value={from} onChange={(e) => setFrom(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
          {unitsOf(group).map((u) => <option key={u}>{u}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => { setFrom(to); setTo(from); setTurns((t) => t + 1) }} aria-label="Swap units">
          <span className="spin-icon" style={{ transform: `rotate(${turns * 180}deg)` }}>⇄</span>
        </button>
        <select aria-label="To unit" value={to} onChange={(e) => setTo(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
          {unitsOf(group).map((u) => <option key={u}>{u}</option>)}
        </select>
      </div>
      <div className="output" style={{ fontSize: '1.3rem' }}>
        <Roll>{result}</Roll> <span key={to} className="muted swap-code" style={{ display: 'inline-block' }}>{to}</span>
      </div>
    </div>
  )
}
