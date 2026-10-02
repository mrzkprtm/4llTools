import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { Choice, Hint } from '../../sim/controls'
import { PALETTE } from '../../sim/theme'
import Chart from './Chart'
import { addDays, daysBetween, end, findCycle, schedule, wouldCycle, type Task } from './logic'
import { exportPng } from './render'
import './tool.css'

const KEY = '4lltools:gantt-chart'

function isoToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sample(): { start: string; tasks: Task[] } {
  const t = isoToday()
  const dow = new Date(t + 'T00:00:00Z').getUTCDay()
  const start = addDays(t, -((dow + 6) % 7) - 7) // Monday of last week
  const tasks: Task[] = [
    { id: 1, name: 'Kickoff', start: 0, duration: 1, progress: 100, color: PALETTE[0], deps: [] },
    { id: 2, name: 'Research', start: 1, duration: 4, progress: 100, color: PALETTE[1], deps: [1] },
    { id: 3, name: 'Design', start: 5, duration: 5, progress: 60, color: PALETTE[3], deps: [2] },
    { id: 4, name: 'Build', start: 10, duration: 9, progress: 10, color: PALETTE[2], deps: [3] },
    { id: 5, name: 'Content', start: 8, duration: 6, progress: 30, color: PALETTE[4], deps: [2] },
    { id: 6, name: 'Testing', start: 19, duration: 4, progress: 0, color: PALETTE[5], deps: [4] },
    { id: 7, name: 'Launch', start: 23, duration: 1, progress: 0, color: PALETTE[6], deps: [6, 5] },
  ]
  return { start, tasks: schedule(tasks) }
}

export default function GanttChart() {
  const [start, setStart] = useState(() => sample().start)
  const [tasks, setTasks] = useState<Task[]>(() => sample().tasks)
  const [zoom, setZoom] = useState<'days' | 'weeks'>('days')
  const [selected, setSelected] = useState<number | null>(3)
  const [msg, setMsg] = useState('')
  const ready = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const s = JSON.parse(raw) as { start: string; tasks: Task[]; zoom?: 'days' | 'weeks' }
        if (Array.isArray(s.tasks) && /^\d{4}-\d\d-\d\d$/.test(s.start)) {
          setStart(s.start)
          setTasks(s.tasks)
          if (s.zoom) setZoom(s.zoom)
        }
      }
    } catch {
      // Keep the sample.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify({ start, tasks, zoom }))
    } catch {
      // Storage is optional.
    }
  }, [start, tasks, zoom])

  const today = daysBetween(start, isoToday())
  const dayW = zoom === 'days' ? 34 : 13
  const update = (id: number, patch: Partial<Task>) => setTasks((ts) => schedule(ts.map((t) => (t.id === id ? { ...t, ...patch } : t))))

  function setDep(id: number, pred: number) {
    const rest = (tasks.find((t) => t.id === id)?.deps ?? []).slice(1).filter((d) => d !== pred)
    if (pred && wouldCycle(tasks, id, pred)) return setMsg('That would make a loop of dependencies, so it was not added.')
    setMsg('')
    update(id, { deps: pred ? [pred, ...rest] : rest })
  }
  function addTask() {
    const id = Math.max(0, ...tasks.map((t) => t.id)) + 1
    const last = tasks[tasks.length - 1]
    setTasks([...tasks, { id, name: `Task ${id}`, start: last ? end(last) : 0, duration: 3, progress: 0, color: PALETTE[id % PALETTE.length], deps: last ? [last.id] : [] }])
    setSelected(id)
  }
  function remove(id: number) {
    setTasks(tasks.filter((t) => t.id !== id).map((t) => ({ ...t, deps: t.deps.filter((d) => d !== id) })))
  }

  const finish = tasks.length ? Math.max(...tasks.map(end)) : 0
  const cycle = findCycle(tasks)

  return (
    <div>
      <div className="row gc-bar-top">
        <Choice value={zoom} options={[['days', 'Days'], ['weeks', 'Weeks']] as const} onChange={setZoom} />
        <label className="gc-start">Project start <input type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></label>
        <button type="button" className="btn btn-icon" onClick={() => exportPng(tasks, start, dayW, today)}><Icon name="image" size={18} /> Save PNG</button>
      </div>
      <div className="gc-scroll">
        <Chart tasks={tasks} start={start} dayW={dayW} today={today} selected={selected} onSelect={setSelected} onChange={setTasks} />
      </div>
      <p className="muted gc-sum">
        {tasks.length} tasks · finishes <b>{addDays(start, Math.max(0, finish - 1))}</b> ({finish} days){cycle && <span className="error"> · dependency loop found</span>}
      </p>
      {msg && <p className="error">{msg}</p>}

      <div className="gc-table">
        {tasks.map((t) => (
          <div key={t.id} className={`gc-row ${selected === t.id ? 'sel' : ''}`} onFocus={() => setSelected(t.id)}>
            <input type="color" aria-label="Color" value={t.color} onChange={(e) => update(t.id, { color: e.target.value })} />
            <input type="text" aria-label="Task name" value={t.name} onChange={(e) => update(t.id, { name: e.target.value })} />
            <input type="date" aria-label="Start date" value={addDays(start, t.start)} onChange={(e) => e.target.value && update(t.id, { start: Math.max(0, daysBetween(start, e.target.value)) })} />
            <label className="gc-num">Days<input type="number" min={1} max={365} value={t.duration} onChange={(e) => update(t.id, { duration: Math.max(1, Number(e.target.value) || 1) })} /></label>
            <label className="gc-num">Done %<input type="number" min={0} max={100} step={5} value={t.progress} onChange={(e) => update(t.id, { progress: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} /></label>
            <select aria-label="Starts after" value={t.deps[0] ?? 0} onChange={(e) => setDep(t.id, Number(e.target.value))}>
              <option value={0}>No dependency</option>
              {tasks.filter((o) => o.id !== t.id).map((o) => <option key={o.id} value={o.id} disabled={wouldCycle(tasks, t.id, o.id)}>After {o.name}</option>)}
            </select>
            {t.deps.length > 1 && <span className="muted gc-more">+{t.deps.length - 1} more</span>}
            <button type="button" className="gc-x" aria-label={`Delete ${t.name}`} onClick={() => remove(t.id)}>×</button>
          </div>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn primary" onClick={addTask}>+ Add task</button>
        <button type="button" className="btn" onClick={() => { const s = sample(); setStart(s.start); setTasks(s.tasks) }}>Load example</button>
      </div>
      <Hint>Drag a bar to move it, or drag its right edge to change the length; everything snaps to whole days and tasks that depend on it shift along. Plans save in this browser.</Hint>
    </div>
  )
}
