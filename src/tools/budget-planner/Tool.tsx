import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { reducedMotion } from '../../motion/springs'

const DEFAULT_CATEGORIES = [
  { name: 'Housing', color: '#e11d48', percent: 30 },
  { name: 'Food', color: '#f97316', percent: 15 },
  { name: 'Transport', color: '#84cc16', percent: 10 },
  { name: 'Utilities', color: '#06b6d4', percent: 5 },
  { name: 'Insurance', color: '#8b5cf6', percent: 5 },
  { name: 'Savings', color: '#16a34a', percent: 20 },
  { name: 'Personal', color: '#ec4899', percent: 10 },
  { name: 'Other', color: '#a16207', percent: 5 },
]

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function BudgetPlanner() {
  const [income, setIncome] = useState(5000)
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('budget-planner-categories')
    if (saved) return JSON.parse(saved)
    return DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: i, amount: Math.round(income * c.percent / 100) }))
  })
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  useFlip(listRef, { max: 20 })

  useEffect(() => {
    try { localStorage.setItem('budget-planner-categories', JSON.stringify(categories)) } catch {}
  }, [categories])

  const totalAllocated = categories.reduce((sum, c) => sum + c.amount, 0)
  const remaining = income - totalAllocated
  const needs = categories.filter(c => ['Housing', 'Food', 'Transport', 'Utilities', 'Insurance'].includes(c.name)).reduce((s, c) => s + c.amount, 0)
  const wants = categories.filter(c => ['Personal', 'Other'].includes(c.name)).reduce((s, c) => s + c.amount, 0)
  const savings = categories.filter(c => c.name === 'Savings')[0]?.amount ?? 0
  const needsPct = income ? Math.round(needs / income * 100) : 0
  const wantsPct = income ? Math.round(wants / income * 100) : 0
  const savingsPct = income ? Math.round(savings / income * 100) : 0

  const handleDragStart = (id: number) => { setDraggedId(id) }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDrop = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return
    setCategories(cats => {
      const newCats = [...cats]
      const fromIdx = newCats.findIndex(c => c.id === draggedId)
      const toIdx = newCats.findIndex(c => c.id === targetId)
      const [removed] = newCats.splice(fromIdx, 1)
      newCats.splice(toIdx, 0, removed)
      return newCats
    })
    setDraggedId(null)
  }

  const updateAmount = (id: number, delta: number) => {
    setCategories(cats => cats.map(c => c.id === id ? { ...c, amount: Math.max(0, c.amount + delta) } : c))
  }

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ minWidth: 200 }}>
          <label>Monthly Income</label>
          <input type="number" min={0} step={100} value={income} onChange={e => setIncome(Number(e.target.value))} className="btn" style={{ width: '100%', textAlign: 'right', paddingRight: 40 }} />
        </div>
        <div className="stat" style={{ minWidth: 160 }}>
          <b><Roll>{formatCurrency(income)}</Roll></b>
          <span className="muted">Income</span>
        </div>
        <div className="stat" style={{ minWidth: 160 }}>
          <b style={{ color: remaining < 0 ? 'var(--danger)' : 'var(--ok)' }}><Roll>{formatCurrency(remaining)}</Roll></b>
          <span className="muted">Remaining</span>
        </div>
      </div>

      <div className="split-bar" style={{ marginTop: 16 }} aria-hidden="true">
        <i style={{ flexGrow: needsPct }}></i>
        <i style={{ flexGrow: wantsPct }}></i>
        <i className="key-dot interest" style={{ flexGrow: savingsPct }}></i>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)' }}>
        <span>Needs {needsPct}%</span>
        <span>Wants {wantsPct}%</span>
        <span className="key-dot" style={{ background: 'var(--ok)' }}></span>
        <span>Savings {savingsPct}%</span>
      </div>
      {needsPct > 50 && <div className="error" style={{ marginTop: 8, fontSize: '0.85rem' }}>⚠ Needs exceed 50%</div>}
      {wantsPct > 30 && <div className="error" style={{ marginTop: 8, fontSize: '0.85rem' }}>⚠ Wants exceed 30%</div>}
      {savingsPct < 20 && <div className="error" style={{ marginTop: 8, fontSize: '0.85rem' }}>⚠ Savings below 20%</div>}

      <div ref={listRef} className="row" style={{ flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className="pop-row"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '12px', opacity: draggedId === cat.id ? 0.5 : 1,
              animation: reducedMotion() ? 'none' : 'pop 0.4s var(--spring-bouncy) both',
              animationDelay: `${i * 40}ms`,
            }}
            draggable={!reducedMotion()}
            onDragStart={() => handleDragStart(cat.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(cat.id)}
          >
            <span className="pill" style={{ width: 12, height: 12, borderRadius: 4, background: cat.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 600 }}>{cat.name}</span>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => updateAmount(cat.id, -50)} aria-label="Decrease">−</button>
              <span style={{ fontFamily: 'var(--mono)', minWidth: 100, textAlign: 'right' }}><Roll>{formatCurrency(cat.amount)}</Roll></span>
              <button className="btn" onClick={() => updateAmount(cat.id, 50)} aria-label="Increase">+</button>
              <span className="muted" style={{ minWidth: 40, textAlign: 'right' }}>{income ? Math.round(cat.amount / income * 100) : 0}%</span>
            </div>
          </div>
        ))}
      </div>
      <Hint>Drag categories to reorder. Use ± buttons to adjust amounts. Green = good, red = over budget.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}