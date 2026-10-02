import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Expense {
  id: number
  date: string
  category: string
  vendor: string
  amount: number
  currency: string
  taxDeductible: boolean
  description: string
  receipt: string
}

const CATEGORIES = [
  'Meals & Entertainment', 'Travel', 'Office Supplies', 'Software & Subscriptions',
  'Marketing & Advertising', 'Professional Services', 'Equipment', 'Training & Education',
  'Utilities', 'Rent', 'Insurance', 'Shipping', 'Other'
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'IDR', 'SGD', 'AUD', 'CAD']

export default function ExpenseTracker() {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem('4lltools:expense-tracker')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [newExpense, setNewExpense] = useState({ date: new Date().toISOString().split('T')[0], category: 'Meals & Entertainment', vendor: '', amount: 0, currency: 'USD', taxDeductible: true, description: '', receipt: '' })

  useEffect(() => {
    try { localStorage.setItem('4lltools:expense-tracker', JSON.stringify(expenses)) } catch {}
  }, [expenses])

  const addExpense = () => {
    if (!newExpense.vendor.trim() || newExpense.amount <= 0) return
    setExpenses([...expenses, { ...newExpense, id: Date.now() }])
    setNewExpense({ date: new Date().toISOString().split('T')[0], category: 'Meals & Entertainment', vendor: '', amount: 0, currency: 'USD', taxDeductible: true, description: '', receipt: '' })
  }

  const removeExpense = (id: number) => {
    setExpenses(expenses.filter(e => e.id !== id))
  }

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter(e => !filterCategory || e.category === filterCategory)
      .filter(e => e.date.startsWith(filterMonth))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [expenses, filterCategory, filterMonth])

  const totals = useMemo(() => {
    const all = expenses.filter(e => e.date.startsWith(filterMonth))
    return {
      total: all.reduce((s, e) => s + e.amount, 0),
      deductible: all.filter(e => e.taxDeductible).reduce((s, e) => s + e.amount, 0),
      nonDeductible: all.filter(e => !e.taxDeductible).reduce((s, e) => s + e.amount, 0),
      byCategory: all.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount
        return acc
      }, {} as Record<string, number>),
    }
  }, [expenses, filterMonth])

  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const exportCSV = () => {
    const headers = ['Date', 'Category', 'Vendor', 'Amount', 'Currency', 'Tax Deductible', 'Description', 'Receipt']
    const rows = expenses.filter(e => e.date.startsWith(filterMonth))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(e => [e.date, e.category, e.vendor, e.amount, e.currency, e.taxDeductible ? 'Yes' : 'No', e.description, e.receipt])
    const csv = [['Date', 'Category', 'Vendor', 'Amount', 'Currency', 'Tax Deductible', 'Description', 'Receipt'], ...rows]
      .map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-${filterMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmtCurrency = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Expense Tracker</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(expenses, null, 2)], { type: 'application/json' })); a.download = 'expenses-backup.json'; a.click() }}>Backup JSON</button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Filter by Month</span>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Filter by Category</span>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={fmt(totals.total)} /></b><span className="muted">Total Expenses</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={fmt(totals.deductible)} /></b><span className="muted">Tax Deductible</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={fmt(totals.nonDeductible)} /></b><span className="muted">Non-Deductible</span></div>
        <div className="stat"><b><Roll value={filteredExpenses.length} /></b><span className="muted">Entries</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add Expense
          <span className="muted" style={{ fontSize: '0.85rem' }}>{expenses.filter(e => e.date.startsWith(filterMonth)).length} entries this month</span>
        </h4>
        <div style={{ display: 'grid', gap: 8, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="row" style={{ gap: 8 }}>
            <input type="date" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} style={{ width: 120 }} />
            <select value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })} style={{ minWidth: 200 }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="text" placeholder="Vendor/Payee" value={newExpense.vendor} onChange={e => setNewExpense({ ...newExpense, vendor: e.target.value })} style={{ flex: 1, minWidth: 150 }} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input type="number" min={0.01} step={0.01} placeholder="Amount" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: Number(e.target.value) })} style={{ width: 100 }} />
            <select value={newExpense.currency} onChange={e => setNewExpense({ ...newExpense, currency: e.target.value })} style={{ width: 100 }}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={newExpense.taxDeductible} onChange={e => setNewExpense({ ...newExpense, taxDeductible: e.target.checked })} />
              <span>Tax Deductible</span>
            </label>
          </div>
          <input type="text" placeholder="Description/Notes" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} />
          <div className="row" style={{ gap: 8 }}>
            <input type="text" placeholder="Receipt/Invoice #" value={newExpense.receipt} onChange={e => setNewExpense({ ...newExpense, receipt: e.target.value })} style={{ flex: 1 }} />
            <button className="btn" onClick={addExpense} style={{ justifySelf: 'start' }}>Add Expense</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Category Breakdown</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            {Object.entries(totals.byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, amount]) => (
                <div key={cat} style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>{cat}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(amount)}</div>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>{((amount / totals.total) * 100).toFixed(1)}%</div>
                </div>
              ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {filteredExpenses.length === 0 ? (
            <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <p className="muted">No expenses for this month/category. Add your first expense above.</p>
            </div>
          ) : (
            filteredExpenses.map((expense, i) => (
              <div key={expense.id} className="pop-row" style={{
                display: 'grid', gridTemplateColumns: '100px 120px 1fr 100px 80px 80px 50px', gap: 8, padding: 12,
                background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 30}ms`,
              }}>
                <span style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{expense.date}</span>
                <span className="muted" style={{ fontSize: '0.8rem' }}>{expense.category}</span>
                <div>
                  <div style={{ fontWeight: 500 }}>{expense.vendor}</div>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>{expense.description}</div>
                </div>
                <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--danger)', textAlign: 'right' }}>{fmt(expense.amount)} {expense.currency}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={expense.taxDeductible} disabled />
                  <span className="muted" style={{ fontSize: '0.75rem' }}>{expense.taxDeductible ? 'Deductible' : 'Non-Ded'}</span>
                </label>
                <span className="muted" style={{ fontSize: '0.7rem' }}>{expense.receipt || '—'}</span>
                <button className="btn" onClick={() => setExpenses(expenses.filter(e => e.id !== expense.id))} style={{ color: 'var(--danger)', justifySelf: 'end', padding: '2px 8px', fontSize: '0.7rem' }}>Delete</button>
              </div>
            ))
          )}
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Monthly Summary</h4>
          <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
            <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={fmt(totals.total)} /></b><span className="muted">Total</span></div>
            <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={fmt(totals.deductible)} /></b><span className="muted">Deductible</span></div>
            <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={fmt(totals.nonDeductible)} /></b><span className="muted">Non-Deductible</span></div>
            <div className="stat"><b><Roll value={filteredExpenses.length} /></b><span className="muted">Entries</span></div>
            <button className="btn" onClick={exportCSV} style={{ alignSelf: 'flex-end' }}>Export CSV</button>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Track business expenses with categories, tax-deductible flags, and receipt references. Filter by month/category. Export to CSV for accounting.
        </p>
      </div>
    </div>
  )
}