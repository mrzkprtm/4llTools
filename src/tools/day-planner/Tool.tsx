import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const SLOT_MINUTES = 30
const DAY_START = 6
const DAY_END = 23

interface Task {
  id: number
  title: string
  startSlot: number
  durationSlots: number
  color: string
  completed: boolean
}

const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#db2777', '#ea580c']

export default function DayPlanner() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('day-planner')
    return saved ? JSON.parse(saved) : [
      { id: 1, title: 'Morning Routine', startSlot: 0, durationSlots: 2, color: COLORS[0], completed: false },
      { id: 2, title: 'Deep Work', startSlot: 4, durationSlots: 6, color: COLORS[1], completed: false },
      { id: 3, title: 'Lunch Break', startSlot: 12, durationSlots: 2, color: COLORS[2], completed: false },
      { id: 4, title: 'Meetings', startSlot: 16, durationSlots: 4, color: COLORS[3], completed: false },
    ]
  })

  useEffect(() => {
    try { localStorage.setItem('day-planner', JSON.stringify(tasks)) } catch {}
  }, [tasks])

  const totalSlots = (DAY_END - DAY_START) * 60 / SLOT_MINUTES
  const [focusMode, setFocusMode] = useState<Task | null>(null)
  const [focusTime, setFocusTime] = useState(0)
  const [focusRunning, setFocusRunning] = useState(false)

  const addTask = () => {
    setTasks([...tasks, { id: Date.now(), title: `Task ${tasks.length + 1}`, startSlot: 0, durationSlots: 2, color: COLORS[tasks.length % COLORS.length], completed: false }])
  }

  const deleteTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id))
  }

  const updateTask = (id: number, field: string, value: string | number | boolean) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const getSlotTime = (slot: number) => {
    const totalMinutes = DAY_START * 60 + slot * SLOT_MINUTES
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  const getTaskAtSlot = (slot: number) => {
    return tasks.find(t => slot >= t.startSlot && slot < t.startSlot + t.durationSlots)
  }

  const occupiedSlots = useMemo(() => {
    const occupied = new Set<number>()
    tasks.forEach(t => {
      for (let i = 0; i < t.durationSlots; i++) occupied.add(t.startSlot + i)
    })
    return occupied
  }, [tasks])

  const totalPlannedMinutes = tasks.reduce((sum, t) => sum + t.durationSlots * SLOT_MINUTES, 0)
  const completedMinutes = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.durationSlots * SLOT_MINUTES, 0)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (focusRunning && focusMode) {
      interval = setInterval(() => setFocusTime(ft => ft + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [focusRunning, focusMode])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Day Planner</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={addTask}>+ Add Task</button>
          <div className="stat"><b><Roll value={Math.round(totalPlannedMinutes / 60 * 10) / 10} /></b><span className="muted">h planned</span></div>
          <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={Math.round(completedMinutes / 60 * 10) / 10} /></b><span className="muted">h done</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '60px 1fr', maxHeight: 500, overflowY: 'auto' }}>
          {Array.from({ length: totalSlots }, (_, i) => i).map(slot => {
            const task = getTaskAtSlot(slot)
            const isStart = task && task.startSlot === slot
            return (
              <div key={slot} style={{ display: 'contents' }}>
                <div style={{
                  padding: '4px 8px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--muted)',
                  borderBottom: '1px solid var(--border)', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-end'
                }}>
                  {slot % 2 === 0 ? getSlotTime(slot) : ''}
                </div>
                <div style={{ position: 'relative', borderBottom: '1px solid var(--border)', minHeight: 40 }}>
                  {isStart && (
                    <div
                      style={{
                        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                        background: task.color + '30', border: `2px solid ${task.color}`, borderRadius: 4,
                        zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 8px',
                        height: `${task.durationSlots * 40}px`,
                        animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                      }}
                    >
                      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: task.color }}>{task.title}</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={task.completed} onChange={e => updateTask(task.id, 'completed', e.target.checked)} />
                        </label>
                      </div>
                      <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                        <span>{getSlotTime(task.startSlot)} - {getSlotTime(task.startSlot + task.durationSlots)}</span>
                        <span>{task.durationSlots * SLOT_MINUTES} min</span>
                      </div>
                    </div>
                  )}
                  {!task && (
                    <div style={{ height: '100%', background: 'transparent' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <h4 style={{ margin: 0 }}>Task List</h4>
          {tasks.map((task, i) => (
            <div key={task.id} className="pop-row" style={{
              display: 'grid', gap: 8, padding: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
              gridTemplateColumns: 'auto 1fr auto auto auto', alignItems: 'center',
              borderLeft: `4px solid ${task.color}`,
              opacity: task.completed ? 0.6 : 1,
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: task.color }} />
              <input type="text" value={task.title} onChange={e => updateTask(task.id, 'title', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500 }} />
              <select value={task.startSlot} onChange={e => updateTask(task.id, 'startSlot', Number(e.target.value))} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', color: 'var(--text)', width: 100 }}>
                {Array.from({ length: totalSlots }, (_, i) => <option key={i} value={i}>{getSlotTime(i)}</option>)}
              </select>
              <select value={task.durationSlots} onChange={e => updateTask(task.id, 'durationSlots', Number(e.target.value))} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', color: 'var(--text)', width: 80 }}>
                {Array.from({ length: 24 }, (_, i) => <option key={i+1} value={i+1}>{(i+1) * SLOT_MINUTES} min</option>)}
              </select>
              <div className="row" style={{ gap: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={task.completed} onChange={e => updateTask(task.id, 'completed', e.target.checked)} />
                  <span className="muted" style={{ fontSize: '0.8rem' }}>Done</span>
                </label>
                <button className="btn" onClick={() => { setFocusMode(task); setFocusTime(0); setFocusRunning(true) }} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Focus</button>
                <button className="btn" onClick={() => deleteTask(task.id)} style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}>Delete</button>
              </div>
            </div>
          ))}
          <button className="btn" onClick={addTask}>+ Add Task</button>
        </div>

        {focusMode && (
          <div className="pop-row" style={{
            padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            borderLeft: `4px solid ${focusMode.color}`,
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
          }}>
            <h4 style={{ margin: '0 0 12px', color: focusMode.color }}>{focusMode.title}</h4>
            <div style={{ fontSize: '4rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
              {formatTime(focusTime)}
            </div>
            <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 16 }}>
              <button className="btn" onClick={() => setFocusRunning(!focusRunning)} style={{ minWidth: 100 }}>
                {focusRunning ? 'Pause' : 'Resume'}
              </button>
              <button className="btn" onClick={() => { setFocusRunning(false); setFocusMode(null); setFocusTime(0) }} style={{ minWidth: 100 }}>Stop</button>
            </div>
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        30-min slots from 6:00-23:00. Drag not implemented in this version — use dropdowns. Focus mode timer tracks session time.
      </p>
    </div>
  )
}