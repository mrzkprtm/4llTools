import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { Hint } from '../../sim/controls'
import Icon from '../../components/Icon'
import { DAY_END, DAY_START, dayActs, durLabel, endOf, firstFree, gaps, hhmm, overlaps, place, TYPES, type Activity, type ActType } from './logic'
import { SAMPLE } from './sample'
import { exportPng } from './exportPng'
import Editor from './Editor'
import './tool.css'

const KEY = '4lltools:trip-itinerary'
const SPAN = DAY_END - DAY_START
const pct = (m: number) => `${((m - DAY_START) / SPAN) * 100}%`

interface Plan {
  title: string
  startDate: string
  days: number
  acts: Activity[]
}

interface Drag {
  id: string
  mode: 'move' | 'resize'
  grab: number
  x: number
  y: number
  moved: boolean
  fromIdea: boolean
}

export default function TripItinerary() {
  const [plan, setPlan] = useState<Plan>(SAMPLE)
  const [selected, setSelected] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; id: string } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const ready = useRef(false)
  const cols = useRef<(HTMLDivElement | null)[]>([])
  const ideasBox = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const planRef = useRef(plan)
  planRef.current = plan

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setPlan({ ...SAMPLE, ...(JSON.parse(raw) as Partial<Plan>) })
    } catch {
      // Storage is optional.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(plan))
    } catch {
      // Storage is optional.
    }
  }, [plan])

  const clashes = useMemo(() => overlaps(plan.acts), [plan.acts])
  const ideas = plan.acts.filter((a) => a.day === null || a.day >= plan.days)
  const labels = Array.from({ length: plan.days }, (_, i) => {
    if (!plan.startDate) return `Day ${i + 1}`
    const d = new Date(`${plan.startDate}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + i)
    return `Day ${i + 1} · ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}`
  })

  const update = (id: string, patch: Partial<Activity>) => setPlan((p) => ({ ...p, acts: p.acts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))

  function colAt(x: number, y: number): [number, DOMRect] | null {
    for (let i = 0; i < plan.days; i++) {
      const r = cols.current[i]?.getBoundingClientRect()
      if (r && x >= r.left && x <= r.right && y >= r.top - 20 && y <= r.bottom + 20) return [i, r]
    }
    return null
  }
  const minuteAt = (r: DOMRect, y: number) => DAY_START + ((y - r.top) / r.height) * SPAN

  function begin(e: RPointerEvent, a: Activity, mode: Drag['mode'], fromIdea = false) {
    if (e.button !== 0) return
    e.stopPropagation()
    const col = a.day !== null ? cols.current[a.day]?.getBoundingClientRect() : undefined
    drag.current = { id: a.id, mode, grab: col && !fromIdea ? minuteAt(col, e.clientY) - a.start : a.dur / 2, x: e.clientX, y: e.clientY, moved: false, fromIdea }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function onMove(e: PointerEvent) {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return
    if (!d.moved) setDragId(d.id)
    d.moved = true
    e.preventDefault()
    const a = planRef.current.acts.find((x) => x.id === d.id)
    if (!a) return
    if (d.mode === 'resize') {
      const r = a.day !== null ? cols.current[a.day]?.getBoundingClientRect() : null
      if (r) update(a.id, place(a.start, minuteAt(r, e.clientY) - a.start))
      return
    }
    const hit = colAt(e.clientX, e.clientY)
    if (hit) {
      const [day, r] = hit
      const p = place(minuteAt(r, e.clientY) - d.grab, a.dur)
      if (a.day !== day || a.start !== p.start) update(a.id, { day, start: p.start })
      setGhost(null)
    } else {
      setGhost({ x: e.clientX, y: e.clientY, id: a.id })
    }
  }

  function onUp(e: PointerEvent) {
    const d = drag.current
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    setGhost(null)
    setDragId(null)
    if (!d) return
    if (!d.moved) {
      setSelected(d.id)
      return
    }
    const box = ideasBox.current?.getBoundingClientRect()
    const overIdeas = box && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom
    if (overIdeas && d.mode === 'move') update(d.id, { day: null })
  }

  function quickAdd(a: Activity) {
    for (let day = 0; day < plan.days; day++) {
      const t = firstFree(plan.acts.filter((x) => x.id !== a.id), day, a.dur)
      if (t !== null) {
        update(a.id, { day, start: t })
        setSelected(a.id)
        return
      }
    }
  }

  function addIdea(a: Omit<Activity, 'id' | 'day' | 'start'>) {
    const id = `a${Date.now().toString(36)}`
    setPlan((p) => ({ ...p, acts: [...p.acts, { ...a, id, day: null, start: 9 * 60 }] }))
  }

  const sel = plan.acts.find((a) => a.id === selected) ?? null
  const ghostAct = ghost && plan.acts.find((a) => a.id === ghost.id)

  return (
    <div className="ti">
      <div className="ti-head ti-noprint">
        <input type="text" className="ti-title" aria-label="Trip name" value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} />
        <label className="ti-inline">Start <input type="date" value={plan.startDate} onChange={(e) => setPlan({ ...plan, startDate: e.target.value })} /></label>
        <span className="ti-inline">Days
          <button type="button" className="btn" aria-label="Fewer days" onClick={() => setPlan({ ...plan, days: Math.max(1, plan.days - 1) })}>−</button>
          <b>{plan.days}</b>
          <button type="button" className="btn" aria-label="More days" onClick={() => setPlan({ ...plan, days: Math.min(10, plan.days + 1) })}>+</button>
        </span>
        <button type="button" className="btn btn-icon" onClick={() => exportPng(plan.title, labels, plan.acts.filter((a) => a.day !== null && a.day < plan.days), clashes)}><Icon name="image" size={18} />PNG</button>
        <button type="button" className="btn btn-icon" onClick={() => window.print()}><Icon name="printer" size={18} />Print</button>
      </div>
      <h2 className="ti-print-title">{plan.title}</h2>

      <div className="ti-layout">
        <div className="ti-board" style={{ '--days': plan.days } as CSSProperties}>
          {labels.map((label, d) => (
            <section key={d} className="ti-day">
              <h3>{label}</h3>
              <div className="ti-col" ref={(el) => { cols.current[d] = el }}>
                {Array.from({ length: SPAN / 60 }, (_, h) => (
                  <span key={h} className="ti-hour" style={{ top: pct(DAY_START + h * 60) }}>{hhmm(DAY_START + h * 60)}</span>
                ))}
                {gaps(plan.acts, d).map((g) => (
                  <span key={`${g.from}-${g.to}`} className="ti-gap" style={{ top: pct(g.start), height: `${(g.minutes / SPAN) * 100}%` }}>
                    <small>{durLabel(g.minutes)}</small>
                  </span>
                ))}
                {dayActs(plan.acts, d).map((a) => (
                  <div
                    key={a.id}
                    className={`ti-block ${clashes.has(a.id) ? 'clash' : ''} ${selected === a.id ? 'sel' : ''} ${a.dur <= 45 ? 'short' : ''} ${dragId === a.id ? 'dragging' : ''}`}
                    style={{ top: pct(a.start), height: `${(a.dur / SPAN) * 100}%`, '--c': TYPES[a.type].color } as CSSProperties}
                    onPointerDown={(e) => begin(e, a, 'move')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(a.id) } }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${a.name}, ${hhmm(a.start)} to ${hhmm(endOf(a))}${clashes.has(a.id) ? ', overlaps another stop' : ''}`}
                  >
                    <b>{clashes.has(a.id) && '⚠ '}{a.name}</b>
                    <span>{hhmm(a.start)}–{hhmm(endOf(a))}{a.place && ` · ${a.place}`}</span>
                    <i className="ti-resize" onPointerDown={(e) => begin(e, a, 'resize')} aria-hidden="true" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="ti-side ti-noprint">
          <div ref={ideasBox} className={`ti-ideas ${ghost ? 'drop' : ''}`}>
            <h3>Ideas <span className="muted">drag onto a day</span></h3>
            {ideas.length === 0 && <p className="muted ti-empty">Drop a stop here to unschedule it.</p>}
            {ideas.map((a) => (
              <div key={a.id} className="ti-idea pop" style={{ '--c': TYPES[a.type].color } as CSSProperties} onPointerDown={(e) => begin(e, a, 'move', true)}>
                <span><b>{a.name}</b><small>{durLabel(a.dur)}{a.place && ` · ${a.place}`}</small></span>
                <button type="button" className="ti-add" aria-label={`Add ${a.name} to the first free slot`} onPointerDown={(e) => e.stopPropagation()} onClick={() => quickAdd(a)}>+</button>
              </div>
            ))}
          </div>
          <Editor act={sel} days={plan.days} onChange={(patch) => sel && update(sel.id, patch)} onDelete={() => { if (sel) { setPlan({ ...plan, acts: plan.acts.filter((a) => a.id !== sel.id) }); setSelected(null) } }} onAdd={addIdea} onClose={() => setSelected(null)} />
          <div className="ti-legend">
            {(Object.keys(TYPES) as ActType[]).map((t) => <span key={t}><i style={{ background: TYPES[t].color }} />{TYPES[t].label}</span>)}
          </div>
        </aside>
      </div>

      {ghostAct && ghost && (
        <div className="ti-ghost" style={{ left: ghost.x, top: ghost.y, '--c': TYPES[ghostAct.type].color } as CSSProperties}>{ghostAct.name}</div>
      )}
      <div className="ti-noprint">
        <Hint>Drag stops to move them between days and times, drag the bottom edge to resize, and drag ideas from the side list onto a day (or tap +). Dashed lines show free time between stops and red outlines flag overlaps. Your plan is saved on this device.</Hint>
      </div>
    </div>
  )
}
