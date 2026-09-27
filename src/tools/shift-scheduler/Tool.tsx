import { useEffect, useRef, useState, type PointerEvent } from 'react'
import Icon from '../../components/Icon'
import { Hint } from '../../sim/controls'
import { autoFill, cellKey, coverage, DAYS, hoursPerStaff, required, shiftHours, toCsv, type Grid, type Shift, type Staff } from './logic'
import './tool.css'

const KEY = '4lltools:shift-scheduler'

interface Store {
  staff: Staff[]
  shifts: Shift[]
  grid: Grid
}

const SAMPLE: Store = {
  staff: [
    { id: 1, name: 'Ani', maxHours: 40 },
    { id: 2, name: 'Bagus', maxHours: 40 },
    { id: 3, name: 'Clara', maxHours: 40 },
    { id: 4, name: 'Doni', maxHours: 32 },
    { id: 5, name: 'Eva', maxHours: 40 },
    { id: 6, name: 'Fajar', maxHours: 24 },
  ],
  shifts: [
    { id: 'm', name: 'Morning', start: 7, end: 15, color: '#f59f00', need: 2 },
    { id: 'e', name: 'Evening', start: 15, end: 23, color: '#1c7ed6', need: 2 },
    { id: 'n', name: 'Night', start: 23, end: 7, color: '#7048e8', need: 1 },
  ],
  grid: { '1:0': 'm', '2:0': 'm', '3:0': 'e', '4:0': 'e', '5:0': 'n', '1:1': 'm', '3:1': 'e', '5:1': 'n', '2:2': 'm', '4:2': 'e', '1:3': 'm', '1:4': 'm', '1:5': 'm' },
}

const hh = (h: number) => String(h % 24).padStart(2, '0')

export default function ShiftScheduler() {
  const [data, setData] = useState<Store>(SAMPLE)
  const { staff, shifts, grid } = data
  const [brush, setBrush] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ sid: string; x: number; y: number } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const ready = useRef(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null
      if (s && Array.isArray(s.staff) && Array.isArray(s.shifts) && s.grid) setData(s)
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
  const byId = new Map(shifts.map((s) => [s.id, s]))
  const hours = hoursPerStaff(grid, shifts)
  const cov = coverage(grid, shifts)
  const req = required(shifts)
  const gaps = cov.reduce((n, row) => n + row.filter((c, h) => c < req[h]).length, 0)

  function assign(key: string, sid: string | null, from?: string) {
    setData((d) => {
      const g = { ...d.grid }
      if (from && from !== key) {
        const other = g[key]
        delete g[from]
        if (other) g[from] = other
      }
      if (sid) g[key] = sid
      else delete g[key]
      return { ...d, grid: g }
    })
  }

  function startDrag(e: PointerEvent<Element>, sid: string, from?: string) {
    const x0 = e.clientX
    const y0 = e.clientY
    let moved = false
    const cellAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('[data-cell]')?.getAttribute('data-cell') ?? null
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
      moved = true
      setGhost({ sid, x: ev.clientX, y: ev.clientY })
      setHover(cellAt(ev.clientX, ev.clientY))
    }
    const onUp = (ev: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setGhost(null)
      setHover(null)
      if (!moved) {
        if (from) assign(from, brush === '' ? null : brush ?? sid)
        else setBrush((b) => (b === sid ? null : sid))
        return
      }
      const target = cellAt(ev.clientX, ev.clientY)
      if (target) assign(target, sid, from)
      else if (from) assign(from, null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(grid, staff, shifts)], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'shift-schedule.csv'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const patchShift = (id: string, p: Partial<Shift>) => set({ shifts: shifts.map((s) => (s.id === id ? { ...s, ...p } : s)) })
  const patchStaff = (id: number, p: Partial<Staff>) => set({ staff: staff.map((s) => (s.id === id ? { ...s, ...p } : s)) })
  function addStaff() {
    const n = newName.trim()
    if (!n) return
    set({ staff: [...staff, { id: Math.max(0, ...staff.map((s) => s.id)) + 1, name: n, maxHours: 40 }] })
    setNewName('')
  }
  function removeStaff(id: number) {
    set({ staff: staff.filter((s) => s.id !== id), grid: Object.fromEntries(Object.entries(grid).filter(([k]) => Number(k.split(':')[0]) !== id)) })
  }

  return (
    <div>
      <div className="ss-palette" role="toolbar" aria-label="Shifts">
        {shifts.map((s) => (
          <button key={s.id} type="button" className={`ss-chip ${brush === s.id ? 'on' : ''}`} style={{ background: s.color }} onPointerDown={(e) => startDrag(e, s.id)}>
            {s.name} <small>{hh(s.start)}–{hh(s.end)}</small>
          </button>
        ))}
        <button type="button" className={`ss-chip ss-erase ${brush === '' ? 'on' : ''}`} onClick={() => setBrush((b) => (b === '' ? null : ''))}>Erase</button>
      </div>
      <div className="row">
        <button type="button" className="btn primary" onClick={() => set({ grid: autoFill(grid, staff, shifts) })}>Auto-fill gaps</button>
        <button type="button" className="btn" onClick={() => set({ grid: {} })}>Clear week</button>
        <button type="button" className="btn btn-icon" onClick={exportCsv}><Icon name="file" size={18} /> CSV</button>
        {gaps ? <span className="chip bad calm" key={gaps}>{gaps} understaffed hours</span> : <span className="chip good">Fully covered</span>}
      </div>

      <div className="ss-scroll">
        <table className="ss-grid">
          <thead>
            <tr><th>Staff</th>{DAYS.map((d) => <th key={d}>{d}</th>)}<th>Hours</th></tr>
          </thead>
          <tbody>
            {staff.map((p) => {
              const h = hours.get(p.id) ?? 0
              return (
                <tr key={p.id}>
                  <th className="ss-name">{p.name}</th>
                  {DAYS.map((_, d) => {
                    const key = cellKey(p.id, d)
                    const s = byId.get(grid[key] ?? '')
                    return (
                      <td key={d} data-cell={key} className={`ss-cell ${hover === key ? 'hover' : ''}`} onClick={() => { if (!s && brush) assign(key, brush) }}>
                        {s && (
                          <span key={s.id} className="ss-pill" style={{ background: s.color }} onPointerDown={(e) => startDrag(e, s.id, key)}>
                            {s.name.slice(0, 3)}<small>{hh(s.start)}</small>
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className={`ss-hours ${h > p.maxHours ? 'over' : ''}`}>
                    <b>{h}</b>/{p.maxHours}
                    <i className="bar"><i style={{ transform: `scaleX(${Math.min(1, h / Math.max(1, p.maxHours))})` }} /></i>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h3 className="ss-h">Coverage <span className="muted">people on duty vs. needed, per hour</span></h3>
      <div className="ss-scroll">
        <div className="ss-heat" role="img" aria-label={`Coverage heatmap, ${gaps} understaffed hours`}>
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="ss-hh">{h % 3 === 0 ? hh(h) : ''}</span>)}
          {cov.map((row, d) => [
            <span key={`d${d}`} className="ss-day">{DAYS[d]}</span>,
            ...row.map((c, h) => {
              const diff = c - req[h]
              return <i key={`${d}-${h}`} className={`ss-hc ${diff < 0 ? 'under' : diff > 0 ? 'over' : req[h] ? 'ok' : ''}`} style={{ animationDelay: `${(d * 24 + h) * 3}ms` }} title={`${DAYS[d]} ${hh(h)}:00 — ${c} on duty, ${req[h]} needed`}>{c || ''}</i>
            }),
          ])}
        </div>
      </div>
      <div className="ss-legend"><span><i className="under" />Understaffed</span><span><i className="ok" />Covered</span><span><i className="over" />Extra</span></div>

      <div className="ss-cols">
        <div>
          <h3 className="ss-h">Shifts</h3>
          {shifts.map((s) => (
            <div key={s.id} className="ss-row">
              <input type="color" aria-label="Color" value={s.color} onChange={(e) => patchShift(s.id, { color: e.target.value })} />
              <input type="text" aria-label="Shift name" value={s.name} onChange={(e) => patchShift(s.id, { name: e.target.value })} />
              <label>Start<input type="number" min={0} max={23} value={s.start} onChange={(e) => patchShift(s.id, { start: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })} /></label>
              <label>End<input type="number" min={0} max={24} value={s.end} onChange={(e) => patchShift(s.id, { end: Math.max(0, Math.min(24, Number(e.target.value) || 0)) })} /></label>
              <label>Need<input type="number" min={0} max={20} value={s.need} onChange={(e) => patchShift(s.id, { need: Math.max(0, Number(e.target.value) || 0) })} /></label>
              <span className="muted ss-len">{shiftHours(s)} h</span>
            </div>
          ))}
        </div>
        <div>
          <h3 className="ss-h">Staff</h3>
          {staff.map((p) => (
            <div key={p.id} className="ss-row staff">
              <input type="text" aria-label="Name" value={p.name} onChange={(e) => patchStaff(p.id, { name: e.target.value })} />
              <label>Max h/week<input type="number" min={1} max={80} value={p.maxHours} onChange={(e) => patchStaff(p.id, { maxHours: Math.max(1, Number(e.target.value) || 1) })} /></label>
              <button type="button" className="ss-x" aria-label={`Remove ${p.name}`} onClick={() => removeStaff(p.id)}>×</button>
            </div>
          ))}
          <div className="ss-add">
            <input type="text" placeholder="Add staff…" aria-label="New staff name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addStaff()} />
            <button type="button" className="btn" onClick={addStaff} disabled={!newName.trim()}>Add</button>
          </div>
        </div>
      </div>
      {ghost && byId.get(ghost.sid) && <div className="ss-ghost" style={{ left: ghost.x, top: ghost.y, background: byId.get(ghost.sid)!.color }}>{byId.get(ghost.sid)!.name}</div>}
      <Hint>Drag a shift from the palette onto a day, or tap a shift and then tap cells to paint it. Drag a placed shift to move it, or off the grid to remove it. The heatmap shows gaps in red and overtime shows in the Hours column.</Hint>
    </div>
  )
}
