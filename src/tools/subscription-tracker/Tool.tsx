import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Subscription {
  id: number
  name: string
  cost: number
  cycle: 'monthly' | 'yearly'
  renewalDate: string
  active: boolean
  color: string
}

const COLORS = ['#e11d48', '#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function getMonthlyCost(sub: Subscription): number {
  return sub.cycle === 'yearly' ? sub.cost / 12 : sub.cost
}

export default function SubscriptionTracker() {
  const [subs, setSubs] = useState<Subscription[]>(() => {
    const saved = localStorage.getItem('subscription-tracker')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Netflix', cost: 15.99, cycle: 'monthly', renewalDate: '2025-01-15', active: true, color: COLORS[0] },
      { id: 2, name: 'Spotify', cost: 9.99, cycle: 'monthly', renewalDate: '2025-01-20', active: true, color: COLORS[1] },
      { id: 3, name: 'Amazon Prime', cost: 139, cycle: 'yearly', renewalDate: '2025-03-01', active: true, color: COLORS[2] },
    ]
  })
  const [formData, setFormData] = useState({ name: '', cost: '', cycle: 'monthly' as 'monthly' | 'yearly', renewalDate: '', color: COLORS[0] })

  useEffect(() => { try { localStorage.setItem('subscription-tracker', JSON.stringify(subs)) } catch {} }, [subs])

  const activeSubs = subs.filter(s => s.active)
  const yearlyTotal = activeSubs.reduce((sum, s) => sum + getMonthlyCost(s) * 12, 0)

  const addSub = () => {
    if (!formData.name || !formData.cost || !formData.renewalDate) return
    setSubs([...subs, { ...formData, id: Date.now(), active: true, cost: Number(formData.cost) }])
    setFormData({ name: '', cost: '', cycle: 'monthly', renewalDate: '', color: COLORS[subs.length % COLORS.length] })
  }

  const toggleSub = (id: number) => {
    setSubs(subs.map(s => s.id === id ? { ...s, active: !s.active } : s))
  }

  const deleteSub = (id: number) => {
    setSubs(subs.filter(s => s.id !== id))
  }

  const today = new Date()
  const daysInYear = 365

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="text" placeholder="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={{ flex: 1, minWidth: 150 }} />
        <input type="number" step="0.01" min="0" placeholder="Cost" value={formData.cost} onChange={e => setFormData({ ...formData, cost: e.target.value })} style={{ width: 100 }} />
        <select value={formData.cycle} onChange={e => setFormData({ ...formData, cycle: e.target.value as 'monthly' | 'yearly' })} style={{ width: 100 }}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input type="date" value={formData.renewalDate} onChange={e => setFormData({ ...formData, renewalDate: e.target.value })} style={{ width: 160 }} />
        <select value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} style={{ width: 50 }}>
          {COLORS.map(c => <option key={c} value={c} style={{ background: c }} />)}
        </select>
        <button className="btn primary" onClick={addSub} disabled={!formData.name || !formData.cost || !formData.renewalDate}>Add</button>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{formatCurrency(yearlyTotal)}</Roll></b><span className="muted">Yearly Total</span></div>
        <div className="stat"><b><Roll>{formatCurrency(yearlyTotal / 12)}</Roll></b><span className="muted">Monthly Avg</span></div>
        <div className="stat"><b><Roll>{activeSubs.length}</Roll></b><span className="muted">Active Subs</span></div>
        <div className="stat"><b><Roll>{subs.length - activeSubs.length}</Roll></b><span className="muted">Paused</span></div>
      </div>

      <div style={{ position: 'relative', height: 200, marginBottom: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <canvas
          width={600}
          height={200}
          style={{ width: '100%', height: '100%', display: 'block' }}
          ref={canvas => {
            if (!canvas) return
            const ctx = canvas.getContext('2d')!
            const dpr = window.devicePixelRatio || 1
            canvas.width = canvas.offsetWidth * dpr
            canvas.height = canvas.offsetHeight * dpr
            ctx.scale(dpr, dpr)

            const w = canvas.width / dpr
            const h = canvas.height / dpr
            const centerX = w / 2
            const centerY = h / 2
            const radius = Math.min(w, h) / 2 - 20

            // Draw ring segments for each month
            activeSubs.forEach((sub, i) => {
              const renewal = new Date(sub.renewalDate)
              const month = renewal.getMonth()
              const angle = (month / 12) * Math.PI * 2 - Math.PI / 2
              ctx.beginPath()
              ctx.arc(centerX, centerY, radius, angle - 0.15, angle + 0.15)
              ctx.strokeStyle = sub.color
              ctx.lineWidth = 12
              ctx.stroke()

              // Dot
              const dotX = centerX + Math.cos(angle) * radius
              const dotY = centerY + Math.sin(angle) * radius
              ctx.fillStyle = sub.color
              ctx.beginPath()
              ctx.arc(dotX, dotY, 8, 0, Math.PI * 2)
              ctx.fill()
            })

            // Center text
            ctx.fillStyle = 'var(--text)'
            ctx.font = 'bold 24px var(--mono)'
            ctx.textAlign = 'center'
            ctx.fillText(formatCurrency(yearlyTotal), centerX, centerY + 8)
            ctx.font = '11px var(--mono)'
            ctx.fillStyle = 'var(--muted)'
            ctx.fillText('Yearly Total', centerX, centerY + 28)
          }}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {subs.map((sub, i) => (
          <div key={sub.id} className="pop-row" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 10,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            opacity: sub.active ? 1 : 0.5,
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 40}ms`
          }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: sub.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 500 }}>{sub.name}</span>
            <span style={{ fontFamily: 'var(--mono)' }}><Roll>{formatCurrency(getMonthlyCost(sub))}</Roll>/mo</span>
            <span className="muted" style={{ minWidth: 120 }}>{new Date(sub.renewalDate).toLocaleDateString()}</span>
            <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={sub.active} onChange={() => toggleSub(sub.id)} />
              {sub.active ? 'Active' : 'Paused'}
            </label>
            <button className="btn" style={{ padding: '4px 8px', color: 'var(--danger)' }} onClick={() => deleteSub(sub.id)}>✕</button>
          </div>
        ))}
      </div>

      <Hint>Toggle subscriptions off to animate savings. Ring shows renewal dates around the year.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}