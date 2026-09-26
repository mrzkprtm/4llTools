import { useEffect, useRef, useState, type PointerEvent } from 'react'
import Icon from '../../components/Icon'
import { reducedMotion } from '../../motion/springs'
import { Hint } from '../../sim/controls'
import { PALETTE } from '../../sim/theme'
import Floor from './Floor'
import { brokenRules, optimize, type Guest, type Rule, type Seating, type Table } from './logic'
import { exportFloor } from './png'
import { SAMPLE, parseGuests } from './sample'
import './tool.css'

const KEY = '4lltools:seating-planner'

interface Store {
  tables: Table[]
  guests: Guest[]
  rules: Rule[]
  seating: Seating
}

export default function SeatingPlanner() {
  const [data, setData] = useState<Store>(SAMPLE)
  const { tables, guests, rules, seating } = data
  const [selGuest, setSelGuest] = useState<number | null>(null)
  const [selTable, setSelTable] = useState<number | null>(null)
  const [ghost, setGhost] = useState<{ id: number; x: number; y: number } | null>(null)
  const [arranging, setArranging] = useState(false)
  const [paste, setPaste] = useState('')
  const [ruleDraft, setRuleDraft] = useState<Rule>({ a: 0, b: 0, kind: 'together' })
  const ready = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      const s = raw ? (JSON.parse(raw) as Store) : null
      if (s && Array.isArray(s.tables) && Array.isArray(s.guests)) setData({ tables: s.tables, guests: s.guests, rules: s.rules ?? [], seating: s.seating ?? {} })
    } catch {
      // Keep the sample.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      // Storage is optional.
    }
  }, [data])

  const set = (p: Partial<Store>) => setData((d) => ({ ...d, ...p }))
  const groups = [...new Set(guests.map((g) => g.group.trim()).filter(Boolean))]
  const colorOf = (g: string) => (g.trim() ? PALETTE[groups.indexOf(g.trim()) % PALETTE.length] : '#868e96')
  const seatOf = new Map(Object.entries(seating).map(([k, g]) => [g, k]))
  const unseated = guests.filter((g) => !seatOf.has(g.id))
  const broken = brokenRules(seating, rules)
  const bad = new Set(broken.flatMap((i) => [rules[i].a, rules[i].b]))
  const name = (id: number) => guests.find((g) => g.id === id)?.name ?? '?'
  const capacity = tables.reduce((s, t) => s + t.seats, 0)

  function place(guest: number, key: string | null) {
    setData((d) => {
      const next = { ...d.seating }
      const from = Object.keys(next).find((k) => next[k] === guest)
      if (from) delete next[from]
      if (key) {
        const other = next[key]
        if (other !== undefined && from) next[from] = other
        next[key] = guest
      }
      return { ...d, seating: next }
    })
    setSelGuest(null)
  }

  function guestDown(e: PointerEvent<Element>, id: number) {
    const x0 = e.clientX
    const y0 = e.clientY
    let moved = false
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
      moved = true
      ev.preventDefault()
      setGhost({ id, x: ev.clientX, y: ev.clientY })
    }
    const onUp = (ev: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setGhost(null)
      if (!moved) return setSelGuest((s) => (s === id ? null : id))
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const seat = el?.closest('[data-seat]')?.getAttribute('data-seat')
      if (seat) place(id, seat)
      else if (el?.closest('[data-unseat]')) place(id, null)
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function autoArrange() {
    set({ seating: optimize(guests, tables, rules, (Date.now() % 100000) + 1) })
    setSelGuest(null)
    if (!reducedMotion()) {
      setArranging(true)
      setTimeout(() => setArranging(false), 1400)
    }
  }
  function addTable(shape: Table['shape']) {
    const id = Math.max(0, ...tables.map((t) => t.id)) + 1
    set({ tables: [...tables, { id, name: `Table ${id}`, shape, seats: shape === 'round' ? 8 : 6, x: 120 + ((id * 137) % 660), y: 120 + ((id * 89) % 320) }] })
    setSelTable(id)
  }
  function patchTable(id: number, p: Partial<Table>) {
    const nextTables = tables.map((t) => (t.id === id ? { ...t, ...p } : t))
    const t = nextTables.find((x) => x.id === id)!
    const nextSeating = Object.fromEntries(Object.entries(seating).filter(([k]) => { const [tid, s] = k.split(':').map(Number); return tid !== id || s < t.seats }))
    set({ tables: nextTables, seating: nextSeating })
  }
  function removeTable(id: number) {
    set({ tables: tables.filter((t) => t.id !== id), seating: Object.fromEntries(Object.entries(seating).filter(([k]) => Number(k.split(':')[0]) !== id)) })
    setSelTable(null)
  }
  function importGuests() {
    const list = parseGuests(paste)
    if (!list.length) return
    set({ guests: list, rules: [], seating: {} })
    setPaste('')
  }
  function addRule() {
    const r = ruleDraft
    if (!r.a || !r.b || r.a === r.b) return
    set({ rules: [...rules.filter((x) => !((x.a === r.a && x.b === r.b) || (x.a === r.b && x.b === r.a))), r] })
  }

  const st = tables.find((t) => t.id === selTable)
  return (
    <div>
      <div className="row">
        <button type="button" className="btn primary" onClick={autoArrange} disabled={!guests.length || !tables.length}>Auto-arrange</button>
        <button type="button" className="btn" onClick={() => addTable('round')}>+ Round table</button>
        <button type="button" className="btn" onClick={() => addTable('rect')}>+ Long table</button>
        <button type="button" className="btn" onClick={() => set({ seating: {} })}>Clear seats</button>
        <button type="button" className="btn btn-icon" onClick={() => exportFloor(tables, guests, seating, colorOf)}><Icon name="image" size={18} /> PNG</button>
      </div>
      <div className="sp-status">
        <span className="chip">{guests.length - unseated.length}/{guests.length} seated</span>
        <span className="chip">{capacity} seats</span>
        {broken.length ? <span className="chip bad" key={broken.length}>{broken.length} rule{broken.length > 1 ? 's' : ''} broken</span> : rules.length ? <span className="chip good">All rules kept</span> : null}
        {guests.length > capacity && <span className="chip bad calm">Not enough seats</span>}
      </div>

      <div className="sp-wrap">
        <Floor tables={tables} guests={guests} seating={seating} bad={bad} colorOf={colorOf} selectedGuest={selGuest} selectedTable={selTable} arranging={arranging}
          onMoveTable={(id, x, y) => setData((d) => ({ ...d, tables: d.tables.map((t) => (t.id === id ? { ...t, x, y } : t)) }))}
          onSelectTable={setSelTable} onSeatTap={(k) => { if (selGuest !== null) place(selGuest, k) }} onGuestDown={guestDown} />
      </div>

      {st && (
        <div className="sp-edit" key={st.id}>
          <label>Name<input type="text" value={st.name} onChange={(e) => patchTable(st.id, { name: e.target.value })} /></label>
          <label>Seats<input type="number" min={1} max={20} value={st.seats} onChange={(e) => patchTable(st.id, { seats: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} /></label>
          <label>Shape<select value={st.shape} onChange={(e) => patchTable(st.id, { shape: e.target.value as Table['shape'] })}><option value="round">Round</option><option value="rect">Long</option></select></label>
          <button type="button" className="btn" onClick={() => removeTable(st.id)}>Remove table</button>
        </div>
      )}

      <div className="sp-cols">
        <div>
          <h3 className="sp-h">Unseated guests <span className="muted">tap one, then a seat, or drag</span></h3>
          <div className={`sp-pool ${selGuest !== null && seatOf.has(selGuest) ? 'target' : ''}`} data-unseat onClick={() => { if (selGuest !== null && seatOf.has(selGuest)) place(selGuest, null) }}>
            {unseated.map((g) => (
              <button key={g.id} type="button" className={`sp-chip ${selGuest === g.id ? 'sel' : ''} ${bad.has(g.id) ? 'bad' : ''}`} style={{ borderColor: colorOf(g.group) }} onPointerDown={(e) => guestDown(e, g.id)}>
                <i style={{ background: colorOf(g.group) }} />{g.name}
              </button>
            ))}
            {!unseated.length && <span className="muted">Everyone has a seat. Drop a guest here to unseat them.</span>}
          </div>
          <div className="sp-legend">{groups.map((g) => <span key={g}><i style={{ background: colorOf(g) }} />{g}</span>)}</div>
          <details className="sp-details">
            <summary>Paste a guest list</summary>
            <p className="muted">One guest per line, optionally with a group: <code>Rina Putri, Bride's family</code>. This replaces the current list.</p>
            <textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Rina Putri, Bride family\nAndi Saputra, Friends'} />
            <button type="button" className="btn" onClick={importGuests} disabled={!paste.trim()}>Use this list</button>
          </details>
        </div>
        <div>
          <h3 className="sp-h">Rules</h3>
          <div className="sp-rule-add">
            <select aria-label="First guest" value={ruleDraft.a} onChange={(e) => setRuleDraft({ ...ruleDraft, a: Number(e.target.value) })}>
              <option value={0}>Guest…</option>
              {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select aria-label="Rule" value={ruleDraft.kind} onChange={(e) => setRuleDraft({ ...ruleDraft, kind: e.target.value as Rule['kind'] })}>
              <option value="together">sits with</option>
              <option value="apart">not with</option>
            </select>
            <select aria-label="Second guest" value={ruleDraft.b} onChange={(e) => setRuleDraft({ ...ruleDraft, b: Number(e.target.value) })}>
              <option value={0}>Guest…</option>
              {guests.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button type="button" className="btn" onClick={addRule} disabled={!ruleDraft.a || !ruleDraft.b || ruleDraft.a === ruleDraft.b}>Add</button>
          </div>
          <ul className="sp-rules">
            {rules.map((r, i) => (
              <li key={`${r.a}-${r.b}-${r.kind}`} className={broken.includes(i) ? 'bad' : 'ok'}>
                <span>{broken.includes(i) ? '✕' : '✓'}</span>
                <b>{name(r.a)}</b> {r.kind === 'together' ? 'sits with' : 'not with'} <b>{name(r.b)}</b>
                <button type="button" className="sp-x" aria-label="Remove rule" onClick={() => set({ rules: rules.filter((_, j) => j !== i) })}>×</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {ghost && <div className="sp-ghost" style={{ left: ghost.x, top: ghost.y }}>{name(ghost.id)}</div>}
      <Hint>Drag tables to lay out the room, then drag guests onto seats (or tap a guest and then a seat). Add rules and press Auto-arrange to seat everyone; broken rules show in red.</Hint>
    </div>
  )
}
