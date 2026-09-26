import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import Icon from '../../components/Icon'
import { Hint } from '../../sim/controls'
import { DAY_END, DAY_START, freeSlot, hhmm, lanes, moveBlock, overlapping, plannedMinutes, resizeBlock, spanFromDrag, STEP, type Block } from './logic'
import './tool.css'

const KEY = '4lltools:day-planner'
const PX = 1.2 // pixels per minute
const COLORS = ['#1c7ed6', '#2f9e44', '#e8590c', '#ae3ec9', '#f59f00', '#0ca678', '#e03131']
const dur = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`
const uid = () => Math.random().toString(36).slice(2, 9)

type Plans = Record<string, Block[]>
type Drag = { mode: 'create' | 'move' | 'resize'; id: string; pointerId: number; anchor: number; orig: Block; moved: boolean }

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function shift(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n))
}

function example(): Block[] {
  const b = (s: number, e: number, title: string, color: string): Block => ({ id: uid(), start: s * 60, end: e * 60, title, color })
  return [b(7, 7.5, 'Breakfast & news', COLORS[4]), b(8, 10.5, 'Deep work: report', COLORS[0]), b(10.5, 11, 'Team stand-up', COLORS[3]), b(12, 13, 'Lunch & Dzuhur', COLORS[1]), b(14, 16, 'Client calls', COLORS[2]), b(17, 18, 'Gym', COLORS[5]), b(19.5, 21, 'Family time', COLORS[1])]
}

export default function DayPlanner() {
  const [plans, setPlans] = useState<Plans>({})
  const [day, setDay] = useState('')
  const [nowMin, setNowMin] = useState(-1)
  const [today, setToday] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const press = useRef({ timer: 0, y: 0 })
  const ready = useRef(false)

  useEffect(() => {
    const t = dayKey(new Date())
    let saved: Plans | null = null
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Plans | null
    } catch {
      saved = null
    }
    setPlans(saved && typeof saved === 'object' ? saved : { [t]: example() })
    setDay(t)
    setToday(t)
    ready.current = true
    const tick = () => {
      const n = new Date()
      setNowMin(n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60)
      setToday(dayKey(n))
    }
    tick()
    const id = setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [])

  // Start the view near the current time.
  useEffect(() => {
    if (day && scroller.current) scroller.current.scrollTop = Math.max(0, ((day === today ? nowMin : 8 * 60) - DAY_START - 60) * PX)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(plans))
    } catch {
      // Storage is optional.
    }
  }, [plans])

  // Block page scrolling on touch while a drag is running.
  useEffect(() => {
    const el = grid.current
    if (!el) return
    const stop = (e: TouchEvent) => drag.current && e.cancelable && e.preventDefault()
    el.addEventListener('touchmove', stop, { passive: false })
    return () => el.removeEventListener('touchmove', stop)
  }, [day])

  const blocks = plans[day] ?? []
  const setBlocks = (f: (b: Block[]) => Block[]) => setPlans((p) => ({ ...p, [day]: f(p[day] ?? []) }))
  const minAt = (clientY: number) => DAY_START + (clientY - grid.current!.getBoundingClientRect().top) / PX

  function begin(e: RPointerEvent, mode: Drag['mode'], b?: Block) {
    e.stopPropagation()
    const anchor = minAt(e.clientY)
    const start = () => {
      let orig = b
      if (mode === 'create') {
        const span = spanFromDrag(anchor, anchor)
        orig = { id: uid(), ...span, title: 'New block', color: COLORS[blocks.length % COLORS.length] }
        setBlocks((bs) => [...bs, orig!])
        setSel(orig.id)
      }
      drag.current = { mode, id: orig!.id, pointerId: e.pointerId, anchor, orig: orig!, moved: mode === 'create' }
      try {
        grid.current?.setPointerCapture(e.pointerId)
      } catch {
        // The finger already lifted.
      }
    }
    // On touch, empty space needs a long press so a quick swipe still scrolls.
    if (mode === 'create' && e.pointerType === 'touch') press.current = { timer: window.setTimeout(start, 350), y: e.clientY }
    else start()
  }

  function move(e: RPointerEvent) {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) {
      if (Math.abs(e.clientY - press.current.y) > 8) clearTimeout(press.current.timer)
      return
    }
    const m = minAt(e.clientY)
    if (Math.abs(m - d.anchor) * PX > 4) d.moved = true
    const next = d.mode === 'move' ? moveBlock(d.orig, m - d.anchor) : d.mode === 'resize' ? resizeBlock(d.orig, m) : { ...d.orig, ...spanFromDrag(d.anchor, m) }
    setBlocks((bs) => bs.map((x) => (x.id === d.id ? next : x)))
  }

  function end() {
    clearTimeout(press.current.timer)
    const d = drag.current
    drag.current = null
    if (d && !d.moved) setSel(d.id)
  }

  const ov = overlapping(blocks)
  const lane = lanes(blocks)
  const planned = plannedMinutes(blocks)
  const total = DAY_END - DAY_START
  const chosen = blocks.find((b) => b.id === sel)
  const update = (patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === sel ? { ...b, ...patch } : b)))
  const date = day ? new Date(day + 'T00:00') : null
  const times = Array.from({ length: (DAY_END - DAY_START) / STEP + 1 }, (_, i) => DAY_START + i * STEP)

  return (
    <div className="dp">
      <div className="dp-top">
        <button type="button" className="btn dp-nav" aria-label="Previous day" onClick={() => setDay(shift(day, -1))}><Icon name="chevron-left" /></button>
        <div className="dp-date">
          <b>{date?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</b>
          {day !== today ? <button type="button" className="dp-today" onClick={() => setDay(today)}>Back to today</button> : <span className="muted">Today</span>}
        </div>
        <button type="button" className="btn dp-nav" aria-label="Next day" onClick={() => setDay(shift(day, 1))}><Icon name="chevron-right" /></button>
      </div>

      <div className="dp-stats">
        <div className="dp-bar" aria-hidden="true"><i style={{ width: `${(planned / total) * 100}%` }} /></div>
        <span><b>{dur(planned)}</b> planned · <b>{dur(total - planned)}</b> free{ov.size > 0 && <span className="dp-warn"> · {ov.size} overlapping</span>}</span>
      </div>

      <div ref={scroller} className="dp-scroll">
        <div ref={grid} className="dp-grid" style={{ height: total * PX }} onPointerDown={(e) => e.button === 0 && begin(e, 'create')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} className="dp-hour" style={{ top: i * 60 * PX, height: 60 * PX }}>
              <span>{String(6 + i).padStart(2, '0')}:00</span>
            </div>
          ))}
          {blocks.map((b) => {
            const l = lane.get(b.id) ?? { lane: 0, of: 1 }
            return (
              <div
                key={b.id}
                className={`dp-block ${ov.has(b.id) ? 'clash' : ''} ${sel === b.id ? 'sel' : ''}`}
                style={{ top: (b.start - DAY_START) * PX, height: (b.end - b.start) * PX, left: `calc(52px + (100% - 56px) * ${l.lane / l.of})`, width: `calc((100% - 56px) / ${l.of} - 3px)`, '--bc': b.color } as CSSProperties}
                onPointerDown={(e) => e.button === 0 && begin(e, 'move', b)}
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSel(b.id)}
              >
                <b>{b.title}</b>
                <span>{hhmm(b.start)}–{hhmm(b.end)}</span>
                <i className="dp-handle" aria-hidden="true" onPointerDown={(e) => e.button === 0 && begin(e, 'resize', b)} />
              </div>
            )
          })}
          {day === today && nowMin >= DAY_START && (
            <div className="dp-now" style={{ top: (nowMin - DAY_START) * PX }} aria-label={`Now ${hhmm(Math.floor(nowMin))}`}>
              <span>{hhmm(Math.floor(nowMin))}</span>
            </div>
          )}
        </div>
      </div>

      {chosen ? (
        <div className="dp-edit pop" key={chosen.id}>
          <input type="text" aria-label="Block title" value={chosen.title} onChange={(e) => update({ title: e.target.value })} />
          <div className="row dp-edit-row">
            <select aria-label="Start" value={chosen.start} onChange={(e) => { const s = Number(e.target.value); update({ start: s, end: Math.max(s + STEP, chosen.end) }) }}>
              {times.slice(0, -1).map((t) => <option key={t} value={t}>{hhmm(t)}</option>)}
            </select>
            <span>to</span>
            <select aria-label="End" value={chosen.end} onChange={(e) => update({ end: Number(e.target.value) })}>
              {times.filter((t) => t > chosen.start).map((t) => <option key={t} value={t}>{hhmm(t)}</option>)}
            </select>
            <span className="dp-swatches">
              {COLORS.map((c) => <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={c === chosen.color} style={{ background: c }} onClick={() => update({ color: c })} />)}
            </span>
          </div>
          <div className="row dp-edit-row">
            <button type="button" className="btn primary" onClick={() => setSel(null)}>Done</button>
            <button type="button" className="btn btn-icon dp-del" onClick={() => { setBlocks((bs) => bs.filter((b) => b.id !== sel)); setSel(null) }}><Icon name="delete-bin" size={16} /> Delete</button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button type="button" className="btn btn-icon" onClick={() => {
            const s = freeSlot(blocks, 60, day === today ? nowMin : 9 * 60)
            if (s === null) return
            const b = { id: uid(), start: s, end: s + 60, title: 'Focus time', color: COLORS[blocks.length % COLORS.length] }
            setBlocks((bs) => [...bs, b])
            setSel(b.id)
          }}><Icon name="plus" size={18} /> Add 1-hour block</button>
          <button type="button" className="btn" disabled={!blocks.length} onClick={() => confirm('Clear every block on this day?') && setBlocks(() => [])}>Clear day</button>
        </div>
      )}
      <Hint>Drag on empty space to draw a block (long-press first on phones), drag a block to move it and its bottom edge to resize. Everything snaps to 15 minutes; tap a block to rename, recolor or delete it.</Hint>
    </div>
  )
}
