import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

type Quadrant = 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important'

interface Task {
  id: number
  title: string
  quadrant: Quadrant
}

const QUADRANTS: { key: Quadrant; label: string; desc: string; color: string; icon: string }[] = [
  { key: 'urgent-important', label: 'Do First', desc: 'Urgent & Important', color: '#e11d48', icon: '🔥' },
  { key: 'not-urgent-important', label: 'Schedule', desc: 'Not Urgent & Important', color: '#2563eb', icon: '📅' },
  { key: 'urgent-not-important', label: 'Delegate', desc: 'Urgent & Not Important', color: '#f59e0b', icon: '👥' },
  { key: 'not-urgent-not-important', label: 'Eliminate', desc: 'Not Urgent & Not Important', color: '#64748b', icon: '🗑️' },
]

export default function EisenhowerMatrix() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('eisenhower-matrix')
    return saved ? JSON.parse(saved) : [
      { id: 1, title: 'Fix production bug', quadrant: 'urgent-important' },
      { id: 2, title: 'Plan Q3 roadmap', quadrant: 'not-urgent-important' },
      { id: 3, title: 'Reply to non-critical emails', quadrant: 'urgent-not-important' },
      { id: 4, title: 'Browse social media', quadrant: 'not-urgent-not-important' },
    ]
  })

  useEffect(() => {
    try { localStorage.setItem('eisenhower-matrix', JSON.stringify(tasks)) } catch {}
  }, [tasks])

  const addTask = (quadrant: Quadrant) => {
    setTasks([...tasks, { id: Date.now(), title: 'New Task', quadrant }])
  }

  const deleteTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id))
  }

  const updateTask = (id: number, field: string, value: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const moveTask = (id: number, quadrant: Quadrant) => {
    updateTask(id, 'quadrant', quadrant)
  }

  const getTasks = (quadrant: Quadrant) => tasks.filter(t => t.quadrant === quadrant)

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Eisenhower Matrix</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {QUADRANTS.map((q, qi) => (
          <div key={q.key} style={{
            background: 'var(--sunken)', border: `2px solid ${q.color}40`, borderRadius: 'var(--radius)',
            display: 'flex', flexDirection: 'column', minHeight: 350
          }}>
            <div style={{ padding: 12, background: q.color + '20', borderBottom: `2px solid ${q.color}`, borderRadius: 'var(--radius) var(--radius) 0 0' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5rem' }}>{q.icon}</span>
                  <span style={{ fontWeight: 700, color: q.color, fontSize: '1.1rem' }}>{q.label}</span>
                </div>
                <Roll value={getTasks(q.key).length} style={{ fontWeight: 700, color: q.color, fontSize: '1.2rem' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>{q.desc}</div>
            </div>

            <div style={{ flex: 1, padding: 12, overflowY: 'auto', minHeight: 200 }}>
              {getTasks(q.key).map((task, i) => (
                <div key={task.id} className="pop-row" style={{
                  background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  padding: 10, marginBottom: 8,
                  animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                  animationDelay: `${i * 40}ms`,
                  borderLeft: `3px solid ${q.color}`,
                }}>
                  <input type="text" value={task.title} onChange={e => updateTask(task.id, 'title', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500, width: '100%', marginBottom: 8 }} />
                  <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    {QUADRANTS.filter(oq => oq.key !== q.key).map(oq => (
                      <button key={oq.key} className="btn" onClick={() => moveTask(task.id, oq.key)} style={{ padding: '2px 8px', fontSize: '0.7rem', background: oq.color + '20', color: oq.color, border: `1px solid ${oq.color}40` }}>
                        → {oq.label}
                      </button>
                    ))}
                    <button className="btn" onClick={() => deleteTask(task.id)} style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--danger)' }}>Delete</button>
                  </div>
                </div>
              ))}
              <button className="btn" onClick={() => addTask(q.key)} style={{ width: '100%', marginTop: 8 }}>+ Add Task</button>
            </div>
          </div>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Drag not implemented — use "Move" buttons. Do First: do now. Schedule: plan time. Delegate: give to others. Eliminate: drop it.
      </p>
    </div>
  )
}