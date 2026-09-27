import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Expense {
  id: number
  category: string
  name: string
  monthly: number
  annual: number
}

const EXPENSE_CATEGORIES = [
  'Housing', 'Utilities', 'Food', 'Transportation', 'Insurance',
  'Healthcare', 'Software/Tools', 'Marketing', 'Education', 'Taxes',
  'Retirement', 'Emergency Fund', 'Other'
]

const DEFAULT_EXPENSES: Expense[] = [
  { id: 1, category: 'Housing', name: 'Rent/Mortgage', monthly: 1500, annual: 18000 },
  { id: 2, category: 'Utilities', name: 'Internet/Phone/Electric', monthly: 300, annual: 3600 },
  { id: 3, category: 'Food', name: 'Groceries/Dining', monthly: 600, annual: 7200 },
  { id: 4, category: 'Transportation', name: 'Car/Transit', monthly: 400, annual: 4800 },
  { id: 5, category: 'Insurance', name: 'Health/Life/Business', monthly: 400, annual: 4800 },
  { id: 5, category: 'Software/Tools', name: 'Subscriptions/Licenses', monthly: 200, annual: 2400 },
  { id: 6, category: 'Marketing', name: 'Ads/Portfolio/Networking', monthly: 300, annual: 3600 },
  { id: 7, category: 'Taxes', name: 'Estimated Quarterly', monthly: 800, annual: 9600 },
  { id: 8, category: 'Retirement', name: 'IRA/401k/Investments', monthly: 500, annual: 6000 },
  { id: 9, category: 'Emergency Fund', name: 'Savings Buffer', monthly: 300, annual: 3600 },
]

export default function FreelanceRate() {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('freelance-rate')
    return saved ? JSON.parse(saved) : DEFAULT_EXPENSES
  })
  const [billableHoursPerWeek, setBillableHoursPerWeek] = useState(25)
  const [weeksPerYear, setWeeksPerYear] = useState(46)
  const [utilizationRate, setUtilizationRate] = useState(70)
  const [profitMargin, setProfitMargin] = useState(20)
  const [currency, setCurrency] = useState('USD')
  const [showBreakdown, setShowBreakdown] = useState(true)

  useEffect(() => {
    try { localStorage.setItem('freelance-rate', JSON.stringify(expenses)) } catch {}
  }, [expenses])

  const addExpense = (category: string) => {
    setExpenses([...expenses, { id: Date.now(), category, name: 'New Expense', monthly: 0, annual: 0 }])
  }

  const removeExpense = (id: number) => {
    setExpenses(expenses.filter(e => e.id !== id))
  }

  const updateExpense = (id: number, field: string, value: string | number) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  const totalMonthly = expenses.reduce((sum, e) => sum + e.monthly, 0)
  const totalAnnual = expenses.reduce((sum, e) => sum + e.annual, 0)

  const billableHoursPerYear = billableHoursPerWeek * weeksPerYear
  const effectiveBillableHours = billableHoursPerYear * (utilizationRate / 100)

  const baseHourlyRate = totalAnnual / effectiveBillableHours
  const withProfitRate = baseHourlyRate * (1 + profitMargin / 100)
  const dailyRate = withProfitRate * 8
  const weeklyRate = withProfitRate * billableHoursPerWeek
  const monthlyRate = withProfitRate * billableHoursPerWeek * (weeksPerYear / 12)

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

  const marketRates = {
    'Junior Developer': 50,
    'Mid Developer': 90,
    'Senior Developer': 150,
    'Designer': 75,
    'Project Manager': 100,
    'Consultant': 200,
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Freelance Rate Calculator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          <span>Billable Hours/Week</span>
          <input type="number" min={1} max={60} value={billableHoursPerWeek} onChange={e => setBillableHoursPerWeek(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Weeks Worked/Year</span>
          <input type="number" min={1} max={52} value={weeksPerYear} onChange={e => setWeeksPerYear(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Utilization Rate %</span>
          <input type="number" min={10} max={100} value={utilizationRate} onChange={e => setUtilizationRate(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Desired Profit Margin %</span>
          <input type="number" min={0} max={100} value={profitMargin} onChange={e => setProfitMargin(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Currency</span>
          <select value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="IDR">IDR (Rp)</option>
            <option value="SGD">SGD (S$)</option>
          </select>
        </label>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ color: 'var(--ok)', fontSize: '1.5rem' }}>$<Roll value={Math.round(withProfitRate)} /></b><span className="muted">/hour</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}>$<Roll value={Math.round(dailyRate)} /></b><span className="muted">/day (8h)</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}>$<Roll value={Math.round(weeklyRate)} /></b><span className="muted">/week</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}>$<Roll value={Math.round(monthlyRate)} /></b><span className="muted">/month</span></div>
        <div className="stat"><b>$<Roll value={Math.round(withProfitRate * effectiveBillableHours)} /></b><span className="muted">Annual Target</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Expenses (Monthly / Annual)
            <span className="muted">Total: $<Roll value={Math.round(totalMonthly)} /> / $<Roll value={Math.round(totalAnnual)} /></span>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {EXPENSE_CATEGORIES.map(cat => {
              const catExpenses = expenses.filter(e => e.category === cat)
              if (catExpenses.length === 0) return null
              return (
                <details key={cat} defaultOpen style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 8 }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                    {cat} (${catExpenses.reduce((s, e) => s + e.monthly, 0)}/mo)
                  </summary>
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    {catExpenses.map((expense, i) => (
                      <div key={expense.id} className="pop-row" style={{
                        display: 'grid', gridTemplateColumns: '1fr 100px 100px 50px', gap: 8, padding: 8,
                        background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                        animationDelay: `${i * 30}ms`,
                      }}>
                        <input type="text" value={expense.name} onChange={e => updateExpense(expense.id, 'name', e.target.value)} placeholder="Name" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                        <input type="number" min={0} step={10} value={expense.monthly} onChange={e => updateExpense(expense.id, 'monthly', Number(e.target.value))} placeholder="Monthly" style={{ textAlign: 'right' }} />
                        <input type="number" min={0} step={100} value={expense.annual} onChange={e => updateExpense(expense.id, 'annual', Number(e.target.value))} placeholder="Annual" style={{ textAlign: 'right' }} />
                        <button className="btn" onClick={() => removeExpense(expense.id)} style={{ color: 'var(--danger)', justifySelf: 'end', padding: '2px 8px', fontSize: '0.7rem' }}>×</button>
                      </div>
                    ))}
                    <button className="btn" onClick={() => addExpense(cat)} style={{ justifySelf: 'start', padding: '4px 12px', fontSize: '0.8rem' }}>+ Add</button>
                  </div>
                </details>
              )
            })}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Rate Breakdown</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Annual Expenses</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--danger)' }}>$<Roll value={Math.round(totalAnnual)} /></div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Billable Hours/Year</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)' }}><Roll value={effectiveBillableHours} />h</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Base Hourly (Cost Recovery)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>$<Roll value={Math.round(baseHourlyRate)} /></div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Profit Margin (+{profitMargin}%)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>$<Roll value={Math.round(withProfitRate - baseHourlyRate)} /></div>
            </div>
            <div style={{ padding: 12, background: 'var(--ok)20', border: '1px solid var(--ok)40', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Recommended Rate</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>$<Roll value={Math.round(withProfitRate)} />/hr</div>
            </div>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Market Rate Comparison</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {Object.entries(marketRates).map(([role, rate]) => (
              <div key={role} style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: '0.8rem' }}>{role}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: withProfitRate > rate ? 'var(--ok)' : withProfitRate < rate * 0.8 ? 'var(--danger)' : 'var(--accent)' }}>
                  ${rate}/hr
                </div>
                <div className="muted" style={{ fontSize: '0.75rem' }}>
                  {withProfitRate > rate ? 'Above market' : withProfitRate < rate * 0.8 ? 'Below market' : 'Competitive'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>What to Charge</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Hourly</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>$<Roll value={Math.round(withProfitRate)} /></div>
            </div>
            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Daily (8h)</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>$<Roll value={Math.round(dailyRate)} /></div>
            </div>
            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Weekly</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>$<Roll value={Math.round(weeklyRate)} /></div>
            </div>
            <div style={{ padding: 16, background: 'var(--ok)20', border: '1px solid var(--ok)40', borderRadius: 4, textAlign: 'center' }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Monthly Retainer</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>$<Roll value={Math.round(monthlyRate)} /></div>
            </div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Enter your monthly/annual expenses. Tool calculates minimum rate to cover costs + profit. Adjust utilization for non-billable time. Compare against market rates.
        </p>
      </div>
    </div>
  )
}