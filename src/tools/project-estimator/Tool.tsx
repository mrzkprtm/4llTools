import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Task {
  id: number
  name: string
  category: string
  effort: number
  rate: number
  assignee: string
  dependencies: string
  risk: 'low' | 'medium' | 'high'
  notes: string
}

interface Category {
  id: number
  name: string
  color: string
}

const CATEGORIES: Category[] = [
  { id: 1, name: 'Planning', color: '#3b82f6' },
  { id: 2, name: 'Design', color: '#8b5cf6' },
  { id: 3, name: 'Development', color: '#16a34a' },
  { id: 4, name: 'Testing', color: '#f59e0b' },
  { id: 4, name: 'Deployment', color: '#e11d48' },
  { id: 5, name: 'Documentation', color: '#64748b' },
  { id: 6, name: 'Meetings', color: '#ec4899' },
  { id: 7, name: 'Other', color: '#78716c' },
]

const RISK_MULTIPLIERS = { low: 1.0, medium: 1.25, high: 1.5 }

export default function ProjectEstimator() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('project-estimator')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Requirements gathering', category: 'Planning', effort: 16, rate: 100, assignee: 'BA', dependencies: '', risk: 'low', notes: '' },
      { id: 2, name: 'UI/UX Design', category: 'Design', effort: 40, rate: 120, assignee: 'Designer', dependencies: '1', risk: 'medium', notes: '' },
      { id: 3, name: 'Frontend Development', category: 'Development', effort: 80, rate: 110, assignee: 'Frontend Dev', dependencies: '2', risk: 'high', notes: '' },
      { id: 4, name: 'Backend API', category: 'Development', effort: 60, rate: 115, assignee: 'Backend Dev', dependencies: '1', risk: 'medium', notes: '' },
      { id: 5, name: 'Integration Testing', category: 'Testing', effort: 24, rate: 90, assignee: 'QA', dependencies: '3,4', risk: 'low', notes: '' },
      { id: 6, name: 'Documentation', category: 'Documentation', effort: 16, rate: 80, assignee: 'Tech Writer', dependencies: '5', risk: 'low', notes: '' },
    ]
  })
  const [contingency, setContingency] = useState(20)
  const [hourlyRate, setHourlyRate] = useState(100)
  const [newTask, setNewTask] = useState({ name: '', category: 'Development', effort: 8, rate: 100, assignee: '', dependencies: '', risk: 'medium' as const, notes: '' })

  useEffect(() => {
    try { localStorage.setItem('project-estimator', JSON.stringify(tasks)) } catch {}
  }, [tasks])

  const addTask = () => {
    if (!newTask.name.trim()) return
    setTasks([...tasks, { ...newTask, id: Date.now() }])
    setNewTask({ name: '', category: 'Development', effort: 8, rate: 100, assignee: '', dependencies: '', risk: 'medium', notes: '' })
  }

  const removeTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id))
  }

  const updateTask = (id: number, field: string, value: string | number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  const taskTotals = useMemo(() => {
    return tasks.map(task => {
      const baseCost = task.effort * task.rate
      const riskCost = baseCost * (RISK_MULTIPLIERS[task.risk] - 1)
      return { ...task, baseCost, riskCost, totalCost: baseCost + riskCost }
    })
  }, [tasks])

  const totals = useMemo(() => {
    const subtotal = taskTotals.reduce((sum, t) => sum + t.baseCost, 0)
    const riskTotal = taskTotals.reduce((sum, t) => sum + t.riskCost, 0)
    const contingencyAmount = (subtotal + riskTotal) * contingency / 100
    return {
      subtotal,
      riskTotal,
      contingencyAmount,
      grandTotal: subtotal + riskTotal + contingencyAmount,
      totalHours: tasks.reduce((s, t) => s + t.effort, 0),
    }
  }, [taskTotals, contingency])

  const addTaskForm = () => {
    setTasks([...tasks, { ...newTask, id: Date.now() }])
    setNewTask({ name: '', category: 'Development', effort: 8, rate: 100, assignee: '', dependencies: '', risk: 'medium', notes: '' })
  }

  const riskColors = { low: 'var(--ok)', medium: 'var(--accent)', high: 'var(--danger)' }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Project Estimator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Global Hourly Rate ($)</span>
          <input type="number" min={0} step={5} value={hourlyRate} onChange={e => setHourlyRate(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Contingency %</span>
          <input type="number" min={0} max={100} step={1} value={contingency} onChange={e => setContingency(Number(e.target.value))} />
        </label>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll value={totals.totalHours} /></b><span className="muted">Total Hours</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}>$<Roll value={totals.subtotal.toLocaleString()} /></b><span className="muted">Base Cost</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}>$<Roll value={totals.riskTotal.toLocaleString()} /></b><span className="muted">Risk Buffer</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}>$<Roll value={totals.contingencyAmount.toLocaleString()} /></b><span className="muted">Contingency ({contingency}%)</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)', fontSize: '1.2rem' }>$<Roll value={totals.grandTotal.toLocaleString()} /></b><span className="muted">Grand Total</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Add Task
            <button className="btn" onClick={addTaskForm} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Add Task</button>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Task name" value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
              <select value={newTask.category} onChange={e => setNewTask({ ...newTask, category: e.target.value })} style={{ width: 150 }}>
                {CATEGORIES.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <input type="number" min={0.5} max={500} step={0.5} placeholder="Hours" value={newTask.effort} onChange={e => setNewTask({ ...newTask, effort: Number(e.target.value) })} style={{ width: 80 }} />
              <input type="number" min={0} step={5} placeholder="Rate/hr" value={newTask.rate} onChange={e => setNewTask({ ...newTask, rate: Number(e.target.value) })} style={{ width: 100 }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Assignee" value={newTask.assignee} onChange={e => setNewTask({ ...newTask, assignee: e.target.value })} style={{ width: 120 }} />
              <input type="text" placeholder="Dependencies (e.g., 1,2)" value={newTask.dependencies} onChange={e => setNewTask({ ...newTask, dependencies: e.target.value })} style={{ width: 150 }} />
              <select value={newTask.risk} onChange={e => setNewTask({ ...newTask, risk: e.target.value as any })} style={{ width: 100 }}>
                <option value="low">Low Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="high">High Risk</option>
              </select>
            </div>
            <input type="text" placeholder="Notes" value={newTask.notes} onChange={e => setNewTask({ ...newTask, notes: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {CATEGORIES.map(cat => {
            const catTasks = taskTotals.filter(t => t.category === cat.name)
            if (catTasks.length === 0) return null
            const catHours = catTasks.reduce((s, t) => s + t.effort, 0)
            const catCost = catTasks.reduce((s, t) => s + t.baseCost, 0)
            const catRisk = catTasks.reduce((s, t) => s + t.riskCost, 0)

            return (
              <details key={cat.id} defaultOpen style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <summary style={{ padding: 12, background: cat.color + '20', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 600, color: cat.color }}>{cat.name}</span>
                    <span className="muted">{catTasks.length} tasks • {catHours}h</span>
                  </div>
                  <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                    <span style={{ color: cat.color }}>Base: ${catCost.toLocaleString()}</span>
                    <span style={{ color: 'var(--accent)' }}>Risk: ${catRisk.toLocaleString()}</span>
                  </div>
                </summary>
                <div style={{ padding: 12 }}>
                  {catTasks.map((task, i) => (
                    <div key={task.id} className="pop-row" style={{
                      display: 'grid', gridTemplateColumns: '40px 1fr 60px 80px 80px 100px 80px 80px 50px', gap: 8, padding: 8,
                      background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                      animationDelay: `${i * 30}ms`,
                    }}>
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>{task.id}</span>
                      <input type="text" value={task.name} onChange={e => updateTask(task.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500, minWidth: 200 }} />
                      <input type="number" min={0.5} step={0.5} value={task.effort} onChange={e => updateTask(task.id, 'effort', Number(e.target.value))} style={{ width: 60 }} />
                      <input type="number" min={0} step={5} value={task.rate} onChange={e => updateTask(task.id, 'rate', Number(e.target.value))} style={{ width: 80 }} />
                      <input type="text" value={task.assignee} onChange={e => updateTask(task.id, 'assignee', e.target.value)} style={{ width: 80 }} />
                      <input type="text" value={task.dependencies} onChange={e => updateTask(task.id, 'dependencies', e.target.value)} placeholder="Deps" style={{ width: 80 }} />
                      <select value={task.risk} onChange={e => updateTask(task.id, 'risk', e.target.value as any)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px', width: 100 }}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <span style={{ color: riskColors[task.risk], fontWeight: 600, fontSize: '0.75rem' }}>{task.risk.toUpperCase()}</span>
                      <button className="btn" onClick={() => removeTask(task.id)} style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '0.7rem' }}>×</button>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 60px 80px 80px 100px 80px 80px 50px', gap: 8, padding: 8, marginTop: 8 }}>
                    <span></span>
                    <input type="text" placeholder="New task name" value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                    <input type="number" min={0.5} step={0.5} placeholder="Hrs" value={newTask.effort} onChange={e => setNewTask({ ...newTask, effort: Number(e.target.value) })} style={{ width: 60 }} />
                    <input type="number" min={0} step={5} placeholder="Rate" value={newTask.rate} onChange={e => setNewTask({ ...newTask, rate: Number(e.target.value) })} style={{ width: 80 }} />
                    <input type="text" placeholder="Assignee" value={newTask.assignee} onChange={e => setNewTask({ ...newTask, assignee: e.target.value })} style={{ width: 80 }} />
                    <input type="text" placeholder="Deps" value={newTask.dependencies} onChange={e => setNewTask({ ...newTask, dependencies: e.target.value })} style={{ width: 80 }} />
                    <select value={newTask.risk} onChange={e => setNewTask({ ...newTask, risk: e.target.value as any })} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px', width: 100 }}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <button className="btn" onClick={addTaskForm} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>Add</button>
                  </div>
                </div>
              </details>
            )
          })}
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Summary</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Total Hours</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)' }}><Roll value={totals.totalHours} />h</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Base Cost</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>$<Roll value={totals.subtotal.toLocaleString()} /></div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Risk Buffer</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>$<Roll value={totals.riskTotal.toLocaleString()} /></div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Contingency ({contingency}%)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>$<Roll value={totals.contingencyAmount.toLocaleString()} /></div>
            </div>
            <div style={{ padding: 12, background: 'var(--ok)20', border: '1px solid var(--ok)40', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Grand Total</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>$<Roll value={totals.grandTotal.toLocaleString()} /></div>
            </div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Break down project into tasks with effort hours and rates. Risk multipliers: Low 1.0x, Medium 1.25x, High 1.5x. Contingency applied to base + risk.
        </p>
      </div>
    </div>
  )
}