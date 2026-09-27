import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const CATEGORIES = [
  { id: 'transport', name: 'Transport', color: '#3b82f6', icon: '🚌' },
  { id: 'accommodation', name: 'Accommodation', color: '#16a34a', icon: '🏨' },
  { id: 'food', name: 'Food & Drink', color: '#f59e0b', icon: '🍽️' },
  { id: 'activities', name: 'Activities', color: '#9333ea', icon: '🎯' },
  { id: 'shopping', name: 'Shopping', color: '#ec4899', icon: '🛍️' },
  { id: 'other', name: 'Other', color: '#64748b', icon: '📦' },
]

interface Expense {
  id: number
  category: string
  name: string
  planned: number
  actual: number
  date: string
}

export default function TravelBudget() {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('travel-budget')
    return saved ? JSON.parse(saved) : []
  })
  const [tripName, setTripName] = useState(() => {
    const saved = localStorage.getItem('travel-budget-name')
    return saved || 'My Trip'
  })
  const [tripDays, setTripDays] = useState(() => {
    const saved = localStorage.getItem('travel-budget-days')
    return saved ? Number(saved) : 7
  })
  const [currency, setCurrency] = useState(() => {
    const saved = localStorage.getItem('travel-budget-currency')
    return saved || 'IDR'
  })

  useEffect(() => {
    try { localStorage.setItem('travel-budget', JSON.stringify(expenses)) } catch {}
  }, [expenses])
  useEffect(() => { try { localStorage.setItem('travel-budget-name', tripName) } catch {} }, [tripName])
  useEffect(() => { try { localStorage.setItem('travel-budget-days', String(tripDays)) } catch {} }, [tripDays])
  useEffect(() => { try { localStorage.setItem('travel-budget-currency', currency) } catch {} }, [currency])

  const addExpense = (category: string) => {
    setExpenses([...expenses, { id: Date.now(), category, name: 'New Expense', planned: 0, actual: 0, date: new Date().toISOString().split('T')[0] }])
  }

  const removeExpense = (id: number) => {
    setExpenses(expenses.filter(e => e.id !== id))
  }

  const updateExpense = (id: number, field: string, value: string | number) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  const totals = useMemo(() => {
    const byCategory = CATEGORIES.map(cat => {
      const catExpenses = expenses.filter(e => e.category === cat.id)
      return {
        ...cat,
        planned: catExpenses.reduce((s, e) => s + e.planned, 0),
        actual: catExpenses.reduce((s, e) => s + e.actual, 0),
        expenses: catExpenses,
      }
    })
    const totalPlanned = byCategory.reduce((s, c) => s + c.planned, 0)
    const totalActual = byCategory.reduce((s, c) => s + c.actual, 0)
    return { byCategory, totalPlanned, totalActual }
  }, [expenses])

  const fmt = (n: number) => currency + ' ' + Math.round(n).toLocaleString()

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div className="row" style={{ gap: 16, alignItems: 'center' }}>
          <input type="text" value={tripName} onChange={e => setTripName(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700, width: 200 }} />
          <div className="row" style={{ gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="muted">Days:</span>
              <input type="number" min={1} max={365} value={tripDays} onChange={e => setTripDays(Number(e.target.value))} style={{ width: 60 }} />
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="muted">Currency:</span>
              <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ width: 80 }}>
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="SGD">SGD</option>
                <option value="JPY">JPY</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={fmt(totals.totalPlanned)} /></b><span className="muted">Planned</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={fmt(totals.totalActual)} /></b><span className="muted">Actual</span></div>
        <div className="stat"><b style={{ color: totals.totalActual > totals.totalPlanned ? 'var(--danger)' : 'var(--ok)' }}><Roll value={fmt(totals.totalActual - totals.totalPlanned)} /></b><span className="muted">Diff</span></div>
        <div className="stat"><b><Roll value={fmt(tripDays > 0 ? totals.totalPlanned / tripDays : 0)} /></b><span className="muted">/Day Planned</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {CATEGORIES.map((cat, ci) => {
          const catData = totals.byCategory.find(c => c.id === cat.id)!
          const catExpenses = catData.expenses
          return (
            <details key={cat.id} defaultOpen style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <summary style={{ padding: 12, background: cat.color + '20', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                  <span style={{ fontWeight: 600, color: cat.color }}>{cat.name}</span>
                </div>
                <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                  <span><b>Planned:</b> {fmt(catData.planned)}</span>
                  <span style={{ color: catData.actual > catData.planned ? 'var(--danger)' : 'var(--ok)' }}><b>Actual:</b> {fmt(catData.actual)}</span>
                  <button className="btn" onClick={() => addExpense(cat.id)} style={{ padding: '4px 12px' }}>+ Add</button>
                </div>
              </summary>
              <div style={{ padding: 12 }}>
                {catExpenses.map((expense, i) => (
                  <div key={expense.id} className="pop-row" style={{
                    display: 'grid', gap: 8, padding: 10,
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    gridTemplateColumns: '1fr 100px 100px 80px auto',
                    animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                    animationDelay: `${i * 30}ms`,
                  }}>
                    <input type="text" value={expense.name} onChange={e => updateExpense(expense.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 500 }} />
                    <input type="number" min={0} step={1000} value={expense.planned} onChange={e => updateExpense(expense.id, 'planned', Number(e.target.value))} style={{ textAlign: 'right' }} />
                    <input type="number" min={0} step={1000} value={expense.actual} onChange={e => updateExpense(expense.id, 'actual', Number(e.target.value))} style={{ textAlign: 'right' }} />
                    <input type="date" value={expense.date} onChange={e => updateExpense(expense.id, 'date', e.target.value)} style={{ width: '100%' }} />
                    <button className="btn" onClick={() => removeExpense(expense.id)} style={{ color: 'var(--danger)', justifySelf: 'end' }}>✕</button>
                  </div>
                ))}
                {catExpenses.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No expenses yet. Click + Add to start.</p>}
              </div>
            </details>
          )
        })}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Add expenses by category. Planned vs actual tracked. Daily average calculated. Data saved locally.
      </p>
    </div>
  )
}