import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { reducedMotion } from '../../motion/springs'
import { Hint, Slider } from '../../sim/controls'
import { PALETTE } from '../../sim/theme'
import { cycleLength, load, mondayOf, schedule } from './logic'
import Wheel from './Wheel'
import './tool.css'

const KEY = '4lltools:chore-rotation'
const SPIN_MS = 2600

interface Saved {
  people: string[]
  chores: string[]
  turn: number
  weeks: number
}

const DEFAULT: Saved = {
  people: ['Ayu', 'Budi', 'Citra', 'Dimas'],
  chores: ['🍽️ Dishes', '🧹 Sweep & mop', '🗑️ Trash out', '🧺 Laundry', '🚽 Bathroom'],
  turn: 0,
  weeks: 8,
}

export default function ChoreRotation() {
  const [s, setS] = useState<Saved>(DEFAULT)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [person, setPerson] = useState('')
  const [chore, setChore] = useState('')
  const [monday, setMonday] = useState<Date | null>(null)
  const ready = useRef(false)
  const timer = useRef(0)

  const P = s.people.length
  const step = 360 / Math.max(1, P)

  useEffect(() => {
    let loaded = DEFAULT
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) loaded = { ...DEFAULT, ...(JSON.parse(raw) as Partial<Saved>) }
    } catch {
      // Keep the defaults.
    }
    setS(loaded)
    setRotation(-loaded.turn * (360 / Math.max(1, loaded.people.length)))
    setMonday(mondayOf(new Date()))
    ready.current = true
    return () => clearTimeout(timer.current)
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      // Storage is optional.
    }
  }, [s])

  // Keep the disc aligned when people are added or removed.
  useEffect(() => {
    if (ready.current && !spinning) setRotation(-s.turn * step)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [P])

  function rotate(dir = 1) {
    if (spinning || P === 0) return
    const calm = reducedMotion()
    setRotation((r) => r - dir * step - (calm || dir < 0 ? 0 : 720))
    setSpinning(!calm)
    clearTimeout(timer.current)
    const commit = () => {
      setS((x) => ({ ...x, turn: x.turn + dir }))
      setSpinning(false)
    }
    if (calm) commit()
    else timer.current = window.setTimeout(commit, dir < 0 ? 500 : SPIN_MS)
  }

  const plan = schedule(P, s.chores.length, s.weeks, s.turn)
  const thisWeek = plan[0] ?? []
  const loads = load(thisWeek, P)
  const fmt = (k: number) => (monday ? mondayOf(monday, k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : `Week ${k + 1}`)
  const patch = (p: Partial<Saved>) => setS((x) => ({ ...x, ...p }))

  return (
    <div className="cr">
      <div className="cr-top">
        <div className="cr-wheel-wrap">
          <Wheel people={s.people} chores={s.chores} rotation={rotation} spinning={spinning} />
          <div className="row cr-spin">
            <button type="button" className="btn dm-x" aria-label="Previous week" disabled={spinning || !P} onClick={() => rotate(-1)}><Icon name="chevron-left" /></button>
            <button type="button" className="btn primary btn-icon cr-go" disabled={spinning || !P} onClick={() => rotate(1)}>
              <Icon name="reload-circle" size={20} /> {spinning ? 'Spinning…' : 'Rotate to next week'}
            </button>
          </div>
        </div>
        <div className="cr-week" aria-live="polite">
          <h3>Week of {fmt(0)}</h3>
          {spinning ? (
            <p className="muted">The wheel is turning…</p>
          ) : (
            <ul key={s.turn} className="cr-assign">
              {s.people.map((p, i) => (
                <li key={p + i} style={{ '--pc': PALETTE[i % PALETTE.length], animationDelay: `${i * 70}ms` } as React.CSSProperties}>
                  <b>{p}</b>
                  <span>{s.chores.filter((_, c) => thisWeek[c] === i).join(', ') || 'Free week 🎉'}</span>
                </li>
              ))}
            </ul>
          )}
          {P > 0 && <p className="muted cr-fair">Every {cycleLength(P)} weeks each person does each chore once. This week: {Math.min(...loads)}–{Math.max(...loads)} chores each.</p>}
        </div>
      </div>

      <div className="two-col cr-edit">
        <div>
          <h3>People</h3>
          <div className="cr-chips">
            {s.people.map((p, i) => (
              <span key={p + i} className="chip cr-chip" style={{ '--pc': PALETTE[i % PALETTE.length] } as React.CSSProperties}>
                {p}
                <button type="button" aria-label={`Remove ${p}`} onClick={() => patch({ people: s.people.filter((_, j) => j !== i) })}><Icon name="close" size={14} /></button>
              </span>
            ))}
          </div>
          <form className="cr-add" onSubmit={(e) => { e.preventDefault(); if (person.trim()) patch({ people: [...s.people, person.trim()] }); setPerson('') }}>
            <input type="text" placeholder="Name" value={person} maxLength={24} onChange={(e) => setPerson(e.target.value)} aria-label="New person" />
            <button type="submit" className="btn" disabled={!person.trim() || P >= 12}>Add</button>
          </form>
        </div>
        <div>
          <h3>Chores</h3>
          <div className="cr-chips">
            {s.chores.map((c, i) => (
              <span key={c + i} className="chip cr-chip">
                {c}
                <button type="button" aria-label={`Remove ${c}`} onClick={() => patch({ chores: s.chores.filter((_, j) => j !== i) })}><Icon name="close" size={14} /></button>
              </span>
            ))}
          </div>
          <form className="cr-add" onSubmit={(e) => { e.preventDefault(); if (chore.trim()) patch({ chores: [...s.chores, chore.trim()] }); setChore('') }}>
            <input type="text" placeholder="e.g. 🌿 Water plants" value={chore} maxLength={30} onChange={(e) => setChore(e.target.value)} aria-label="New chore" />
            <button type="submit" className="btn" disabled={!chore.trim() || s.chores.length >= 20}>Add</button>
          </form>
        </div>
      </div>

      <div className="cr-printable">
        <h3 className="cr-print-title">Chore rotation</h3>
        <div className="cr-table-wrap">
          <table className="simple cr-table">
            <thead>
              <tr><th>Week of</th>{s.chores.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {plan.map((week, k) => (
                <tr key={s.turn + k} className={k === 0 ? 'now' : ''}>
                  <td>{fmt(k)}</td>
                  {week.map((p, c) => <td key={c}><span className="cr-tag" style={{ '--pc': PALETTE[p % PALETTE.length] } as React.CSSProperties}>{s.people[p] ?? '—'}</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="row cr-actions">
        <div className="cr-weeks"><Slider label="Weeks to show" value={s.weeks} min={2} max={16} onChange={(weeks) => patch({ weeks })} /></div>
        <button type="button" className="btn btn-icon" onClick={() => window.print()}><Icon name="printer" size={18} /> Print</button>
        <button type="button" className="btn" onClick={() => { setS(DEFAULT); setRotation(0) }}>Reset</button>
      </div>
      <Hint>Add the people and chores in your home, then press Rotate each week: the inner disc of names turns one slot, just like a paper chore wheel. Print the table to stick on the fridge.</Hint>
    </div>
  )
}
