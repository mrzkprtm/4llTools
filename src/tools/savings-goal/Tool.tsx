import { useState, useEffect, useRef } from 'react'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Goal {
  name: string
  target: number
  current: number
  targetDate: string
  color: string
}

const COLORS = ['#e11d48', '#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899']

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function daysBetween(d1: string, d2: string): number {
  const t1 = new Date(d1).getTime()
  const t2 = new Date(d2).getTime()
  return Math.max(1, Math.ceil((t2 - t1) / 86400000))
}

export default function SavingsGoalJar() {
  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      const saved = localStorage.getItem('savings-goals')
      if (saved) return JSON.parse(saved) as Goal[]
    } catch {}
    return [{
      name: 'Emergency Fund',
      target: 10000,
      current: 2500,
      targetDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
      color: COLORS[0]
    }]
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({ name: '', target: '', targetDate: '', color: COLORS[0] })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef(0)

  useEffect(() => {
    try { localStorage.setItem('savings-goals', JSON.stringify(goals)) } catch {}
  }, [goals])

  const drawJar = (goal: Goal | undefined) => {
    const canvas = canvasRef.current
    if (!canvas || !goal) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr
    ctx.scale(dpr, dpr)

    const w = canvas.width / dpr
    const h = canvas.height / dpr
    const pct = goal.target > 0 ? Math.min(1, goal.current / goal.target) : 0

    ctx.clearRect(0, 0, w, h)

    // Jar outline
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--border-strong').trim() || '#999'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(w * 0.2, h * 0.1)
    ctx.lineTo(w * 0.2, h * 0.85)
    ctx.quadraticCurveTo(w * 0.2, h * 0.95, w * 0.3, h * 0.95)
    ctx.lineTo(w * 0.7, h * 0.95)
    ctx.quadraticCurveTo(w * 0.8, h * 0.95, w * 0.8, h * 0.85)
    ctx.lineTo(w * 0.8, h * 0.1)
    ctx.stroke()

    // Liquid fill
    const fillH = (h * 0.75) * pct
    const fillY = h * 0.85 - fillH
    const grad = ctx.createLinearGradient(0, fillY, 0, h * 0.85)
    grad.addColorStop(0, goal.color + 'CC')
    grad.addColorStop(1, goal.color)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(w * 0.22, h * 0.85)
    ctx.lineTo(w * 0.22, fillY)
    ctx.quadraticCurveTo(w * 0.22, fillY - 10, w * 0.32, fillY - 10)
    ctx.lineTo(w * 0.68, fillY - 10)
    ctx.quadraticCurveTo(w * 0.78, fillY - 10, w * 0.78, fillY)
    ctx.lineTo(w * 0.78, h * 0.85)
    ctx.closePath()
    ctx.fill()

    // Coins animation
    if (!reducedMotion() && pct < 1) {
      const now = Date.now()
      for (let i = 0; i < 3; i++) {
        const t = ((now / 1000 + i * 0.7) % 2) / 2
        const x = w * 0.35 + ((i * 0.37 + Math.floor(now / 2000 + i * 0.35) * 0.61) % 1) * w * 0.3
        const y = h * 0.15 + t * (fillY - h * 0.15)
        ctx.fillStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  useEffect(() => {
    const current = goals[editingId ?? 0]
    // Only keep animating while coins are falling; with reduced motion draw a single still frame
    const animated = !reducedMotion() && !!current && current.current < current.target
    const animate = () => {
      drawJar(current)
      if (animated) animationRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(animationRef.current)
  }, [goals, editingId])

  const addGoal = () => {
    if (!formData.name || !formData.target || !formData.targetDate) return
    setGoals([...goals, { ...formData, target: Number(formData.target), current: 0 }])
    setFormData({ name: '', target: '', targetDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0], color: COLORS[goals.length % COLORS.length] })
    setEditingId(goals.length)
  }

  const updateCurrent = (id: number, delta: number) => {
    setGoals(goals.map((g, i) => i === id ? { ...g, current: Math.max(0, Math.min(g.target, g.current + delta)) } : g))
  }

  const deleteGoal = (id: number) => {
    setGoals(goals.filter((_, i) => i !== id))
    setEditingId(e => e === null || e === id ? null : e > id ? e - 1 : e)
  }

  const goal = goals[editingId ?? 0]
  const daysLeft = goal ? daysBetween(new Date().toISOString().split('T')[0], goal.targetDate) : 0
  const weeksLeft = Math.ceil(daysLeft / 7)
  const selectedIdx = goal ? editingId ?? 0 : null
  const monthlyNeeded = goal && daysLeft > 0 ? (goal.target - goal.current) / (daysLeft / 30) : 0

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="text" placeholder="Goal name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ flex: 1, minWidth: 150 }} />
        <input type="number" min="1" step="100" placeholder="Target $" value={formData.target} onChange={e => setFormData({ ...formData, target: e.target.value })} style={{ width: 120 }} />
        <input type="date" value={formData.targetDate} onChange={e => setFormData({ ...formData, targetDate: e.target.value })} style={{ width: 160 }} />
        <select value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} style={{ width: 50 }}>
          {COLORS.map(c => <option key={c} value={c} style={{ background: c }} />)}
        </select>
        <button className="btn primary" onClick={addGoal} disabled={!formData.name || !formData.target || !formData.targetDate}>Add Goal</button>
      </div>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        {goals.map((g, i) => (
          <button
            key={i}
            className={`btn ${editingId === i ? 'primary' : ''}`}
            onClick={() => setEditingId(i)}
            style={{ padding: '8px 16px' }}
          >
            {g.name}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', height: 200, marginBottom: 16 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', borderRadius: 'var(--radius)', background: 'var(--sunken)' }} />
      </div>

      {goal && (
        <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat"><b><Roll>{formatCurrency(goal.current)}</Roll></b><span className="muted">Saved</span></div>
          <div className="stat"><b><Roll>{formatCurrency(goal.target)}</Roll></b><span className="muted">Target</span></div>
          <div className="stat"><b><Roll>{Math.round(goal.current / goal.target * 100)}</Roll>%</b><span className="muted">Progress</span></div>
          <div className="stat"><b><Roll>{formatCurrency(Math.round(monthlyNeeded))}</Roll>/mo</b><span className="muted">Needed</span></div>
        </div>
      )}

      {goal && selectedIdx !== null && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 }}>
          <button className="btn" onClick={() => updateCurrent(selectedIdx, -100)}>−$100</button>
          <button className="btn" onClick={() => updateCurrent(selectedIdx, 100)}>+$100</button>
          <button className="btn" onClick={() => updateCurrent(selectedIdx, 500)}>+$500</button>
          <button className="btn" onClick={() => deleteGoal(selectedIdx)} style={{ color: 'var(--danger)' }}>Delete Goal</button>
          <span className="muted" style={{ alignSelf: 'center' }}>{daysLeft} days ({weeksLeft} weeks) left</span>
        </div>
      )}

      {goal && goal.current >= goal.target && (
        <div className="settle" style={{ textAlign: 'center', padding: 16, background: 'color-mix(in srgb, var(--ok) 10%, transparent)', border: '1px solid var(--ok)', borderRadius: 'var(--radius)', marginTop: 16 }}>
          🎉 Goal reached! 🎉
        </div>
      )}

      <Hint>Tap a goal to select. Add or remove savings with the buttons and watch the jar fill up.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}