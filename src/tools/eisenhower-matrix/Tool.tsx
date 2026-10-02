import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import { reducedMotion, SPRINGS } from '../../motion/springs'
import { useFlip } from '../../motion/useFlip'
import { Hint } from '../../sim/controls'
import { counts, moveTask, QUADRANTS, type Quadrant, type Task } from './logic'
import './tool.css'

const KEY = '4lltools:eisenhower-matrix'
const uid = () => Math.random().toString(36).slice(2, 9)
const t = (text: string, q: Quadrant, done = false): Task => ({ id: uid(), text, q, done })
const EXAMPLE = (): Task[] => [
  t('Reply to boss about deadline', 'inbox'),
  t('Renew SIM card photo', 'inbox'),
  t('Scroll social media', 'inbox'),
  t('Submit tax report (SPT) today', 'do'),
  t('Fix production bug', 'do', true),
  t('Plan weekly workouts', 'schedule'),
  t('Learn TypeScript generics', 'schedule'),
  t('Book meeting room', 'delegate'),
  t('Sort old emails', 'delete'),
]

interface Drag {
  id: string
  pointerId: number
  x: number
  y: number
  ox: number
  oy: number
  w: number
  to: Quadrant
  index: number
}

export default function EisenhowerMatrix() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const pending = useRef<{ task: Task; pointerId: number; sx: number; sy: number; ox: number; oy: number; w: number } | null>(null)
  const dropped = useRef<{ id: string; left: number; top: number } | null>(null)
  const moved = useRef(false)
  const ready = useRef(false)
  dragRef.current = drag
  useFlip(root)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      setTasks(raw ? (JSON.parse(raw) as Task[]) : EXAMPLE())
    } catch {
      setTasks(EXAMPLE())
    }
    ready.current = true
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(tasks))
    } catch {
      // Storage is optional.
    }
  }, [tasks])

  useLayoutEffect(() => {
    const d = dropped.current
    if (!d || !root.current) return
    dropped.current = null
    const el = root.current.querySelector<HTMLElement>(`[data-task="${d.id}"]`)
    if (!el || reducedMotion()) return
    const r = el.getBoundingClientRect()
    el.animate([{ transform: `translate(${d.left - r.left}px, ${d.top - r.top}px) scale(1.05)` }, { transform: 'none' }], { duration: SPRINGS.bouncy.duration, easing: SPRINGS.bouncy.easing })
  })

  useEffect(() => {
    const zoneAt = (x: number, y: number, id: string) => {
      const zones = [...(root.current?.querySelectorAll<HTMLElement>('[data-zone]') ?? [])]
      let best: HTMLElement | null = null
      let bd = Infinity
      for (const z of zones) {
        const r = z.getBoundingClientRect()
        const dx = Math.max(r.left - x, 0, x - r.right)
        const dy = Math.max(r.top - y, 0, y - r.bottom)
        if (dx * dx + dy * dy < bd) [best, bd] = [z, dx * dx + dy * dy]
      }
      if (!best) return null
      const items = [...best.querySelectorAll<HTMLElement>('[data-task]')].filter((e) => e.dataset.task !== id)
      const index = items.filter((e) => {
        const r = e.getBoundingClientRect()
        return r.top + r.height / 2 < y
      }).length
      return { to: best.dataset.zone as Quadrant, index }
    }
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      const p = pending.current
      if (d && e.pointerId === d.pointerId) {
        e.preventDefault()
        setDrag({ ...d, x: e.clientX, y: e.clientY, ...(zoneAt(e.clientX, e.clientY, d.id) ?? {}) })
      } else if (p && e.pointerId === p.pointerId && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) {
        pending.current = null
        moved.current = true
        setOpen(null)
        const q = p.task.q
        setDrag({ id: p.task.id, pointerId: p.pointerId, x: e.clientX, y: e.clientY, ox: p.ox, oy: p.oy, w: p.w, to: q, index: 0, ...(zoneAt(e.clientX, e.clientY, p.task.id) ?? {}) })
      }
    }
    const up = (e: PointerEvent) => {
      pending.current = null
      const d = dragRef.current
      if (!d || e.pointerId !== d.pointerId) return
      dropped.current = { id: d.id, left: d.x - d.ox, top: d.y - d.oy }
      setTasks((ts) => moveTask(ts, d.id, d.to, d.index))
      setDrag(null)
      setTimeout(() => (moved.current = false), 0)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  function down(e: RPointerEvent<HTMLElement>, task: Task) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.em-check, .em-moves')) return
    if (e.pointerType === 'touch' && !(e.target as HTMLElement).closest('.em-grip')) return
    const r = e.currentTarget.getBoundingClientRect()
    pending.current = { task, pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width }
  }

  const view = drag ? moveTask(tasks, drag.id, drag.to, drag.index) : tasks
  const ghost = drag ? tasks.find((x) => x.id === drag.id) : null
  const n = counts(tasks)

  const item = (task: Task) => (
    <li key={task.id} data-flip={task.id} data-task={task.id} className={`em-task ${task.done ? 'done' : ''} ${drag?.id === task.id ? 'placeholder' : ''}`} onPointerDown={(e) => down(e, task)} onClick={() => !moved.current && setOpen(open === task.id ? null : task.id)}>
      <span className="em-grip" aria-hidden="true">⠿</span>
      <button type="button" className="em-check" aria-pressed={task.done} aria-label={`Mark "${task.text}" ${task.done ? 'not done' : 'done'}`} onClick={(e) => { e.stopPropagation(); setTasks((ts) => ts.map((x) => (x.id === task.id ? { ...x, done: !x.done } : x))) }}>
        {task.done && <Check size={14} />}
      </button>
      <span className="em-text">{task.text}</span>
      {open === task.id && (
        <span className="em-moves pop" role="group" aria-label="Move to">
          {[['inbox', 'Inbox', '#868e96'] as const, ...QUADRANTS.map((q) => [q.id, q.title, q.color] as const)].filter(([id]) => id !== task.q).map(([id, title, color]) => (
            <button key={id} type="button" style={{ '--qc': color } as CSSProperties} onClick={() => { setTasks((ts) => moveTask(ts, task.id, id, Infinity)); setOpen(null) }}>{title}</button>
          ))}
          <button type="button" className="em-del" aria-label="Delete task" onClick={() => setTasks((ts) => ts.filter((x) => x.id !== task.id))}><Icon name="delete-bin" size={14} /></button>
        </span>
      )}
    </li>
  )

  return (
    <div ref={root} className={`em ${drag ? 'dragging' : ''}`}>
      <section className="em-inbox" data-zone="inbox">
        <form className="em-add" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setTasks((ts) => [t(draft.trim(), 'inbox'), ...ts]); setDraft('') }}>
          <input type="text" placeholder="Add a task to the inbox…" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="New task" />
          <button type="submit" className="btn primary btn-icon" disabled={!draft.trim()}><Icon name="plus" size={18} /> Add</button>
        </form>
        <h3>Inbox <span className="em-n">{n.inbox.open}</span></h3>
        <ul className="em-list">{view.filter((x) => x.q === 'inbox').map(item)}</ul>
        {!view.some((x) => x.q === 'inbox') && <p className="muted em-empty">Inbox zero. Add a task or drag one back here.</p>}
      </section>

      <div className="em-axes" aria-hidden="true"><span>Urgent</span><span>Not urgent</span></div>
      <div className="em-matrix">
        {QUADRANTS.map((q) => (
          <section key={q.id} className={`em-q ${drag?.to === q.id ? 'target' : ''}`} data-zone={q.id} style={{ '--qc': q.color } as CSSProperties}>
            <header>
              <b>{q.title}</b>
              <span>{q.sub}</span>
              <span key={n[q.id].open} className="em-n pop">{n[q.id].open}{n[q.id].done > 0 && <small> +{n[q.id].done}✓</small>}</span>
            </header>
            <ul className="em-list">{view.filter((x) => x.q === q.id).map(item)}</ul>
          </section>
        ))}
      </div>

      {drag && ghost && (
        <div className="em-task em-ghost" style={{ left: drag.x - drag.ox, top: drag.y - drag.oy, width: drag.w }} aria-hidden="true">
          <span className="em-grip">⠿</span><span className="em-check" /><span className="em-text">{ghost.text}</span>
        </div>
      )}
      <div className="row">
        <button type="button" className="btn" disabled={!tasks.some((x) => x.done)} onClick={() => setTasks((ts) => ts.filter((x) => !x.done))}>Clear done tasks</button>
        <button type="button" className="btn" onClick={() => confirm('Replace your tasks with the example?') && setTasks(EXAMPLE())}>Load example</button>
      </div>
      <Hint>Drag tasks from the inbox into a quadrant (on phones, drag by the ⠿ grip), or tap a task to move it with buttons. Do the red ones first, put blue ones in your calendar, hand off yellow ones and drop gray ones.</Hint>
    </div>
  )
}
