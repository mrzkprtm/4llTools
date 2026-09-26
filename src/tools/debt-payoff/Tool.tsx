import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Debt {
  id: number
  name: string
  balance: number
  rate: number
  minPayment: number
}

const METHOD_LABELS = { snowball: 'Snowball (smallest first)', avalanche: 'Avalanche (highest rate first)' }

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function calculatePayoff(debts: Debt[], extraPayment: number, method: 'snowball' | 'avalanche') {
  const sorted = [...debts].sort((a, b) => method === 'snowball' ? a.balance - b.balance : b.rate - a.rate)
  let month = 0
  const timeline: { month: number; balances: number[]; totalPaid: number; totalInterest: number }[] = []
  let totalPaid = 0
  let totalInterest = 0
  const working = sorted.map(d => ({ ...d }))

  while (working.some(d => d.balance > 0.5) && month < 600) {
    month++
    let extra = extraPayment
    const balances = working.map(d => d.balance)
    for (const debt of working) {
      if (debt.balance <= 0.5) continue
      const interest = debt.balance * debt.rate / 100 / 12
      let payment = Math.min(debt.minPayment + extra, debt.balance + interest)
      debt.balance = Math.max(0, debt.balance + interest - payment)
      extra = Math.max(0, payment - debt.minPayment - interest)
      totalPaid += payment
      totalInterest += interest
    }
    timeline.push({ month, balances: working.map(d => d.balance), totalPaid, totalInterest })
  }
  return { months: month, timeline, totalPaid, totalInterest }
}

export default function DebtPayoffPlanner() {
  const [debts, setDebts] = useState<Debt[]>(() => {
    const saved = localStorage.getItem('debt-payoff-debts')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Credit Card A', balance: 3000, rate: 22, minPayment: 90 },
      { id: 2, name: 'Student Loan', balance: 15000, rate: 5, minPayment: 150 },
      { id: 3, name: 'Car Loan', balance: 8000, rate: 4.5, minPayment: 250 },
    ]
  })
  const [extraPayment, setExtraPayment] = useState(200)
  const [method, setMethod] = useState<'snowball' | 'avalanche'>('snowball')
  const [showTimeline, setShowTimeline] = useState(false)

  useEffect(() => { try { localStorage.setItem('debt-payoff-debts', JSON.stringify(debts)) } catch {} }, [debts])

  const { months, timeline, totalPaid, totalInterest } = calculatePayoff(debts, extraPayment, method)
  const snowballResult = calculatePayoff(debts, extraPayment, 'snowball')
  const avalancheResult = calculatePayoff(debts, extraPayment, 'avalanche')

  const addDebt = () => {
    setDebts([...debts, { id: Date.now(), name: `Debt ${debts.length + 1}`, balance: 1000, rate: 10, minPayment: 50 }])
  }

  const updateDebt = (id: number, field: keyof Debt, value: string | number) => {
    setDebts(debts.map(d => d.id === id ? { ...d, [field]: value } : d))
  }

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="radio" value="snowball" checked={method === 'snowball'} onChange={() => setMethod('snowball')} />
          Snowball
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="radio" value="avalanche" checked={method === 'avalanche'} onChange={() => setMethod('avalanche')} />
          Avalanche
        </label>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label>Extra Payment $/mo</label>
          <input type="number" min={0} step={50} value={extraPayment} onChange={e => setExtraPayment(Number(e.target.value))} />
        </div>
        <button className="btn" onClick={addDebt}>+ Add Debt</button>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{formatCurrency(totalPaid)}</Roll></b><span className="muted">Total Paid</span></div>
        <div className="stat"><b><Roll>{formatCurrency(totalInterest)}</Roll></b><span className="muted">Total Interest</span></div>
        <div className="stat"><b><Roll>{months}</Roll></b><span className="muted">Months to Freedom</span></div>
        <div className="stat">
          <b style={{ color: 'var(--ok)' }}><Roll>{formatCurrency(snowballResult.totalInterest - avalancheResult.totalInterest)}</Roll></b>
          <span className="muted">Interest Saved vs Other</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {debts.map((debt, i) => (
          <div key={debt.id} className="pop-row" style={{
            display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 80px 40px', gap: 8, alignItems: 'center',
            padding: 10, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 40}ms`
          }}>
            <input type="text" value={debt.name} onChange={e => updateDebt(debt.id, 'name', e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
            <input type="number" step="100" min={0} value={debt.balance} onChange={e => updateDebt(debt.id, 'balance', Number(e.target.value))} placeholder="Balance" />
            <input type="number" step="0.1" min={0} max={50} value={debt.rate} onChange={e => updateDebt(debt.id, 'rate', Number(e.target.value))} placeholder="Rate %" />
            <input type="number" step="10" min={0} value={debt.minPayment} onChange={e => updateDebt(debt.id, 'minPayment', Number(e.target.value))} placeholder="Min Pay" />
            <span style={{ fontFamily: 'var(--mono)', textAlign: 'right' }}><Roll>{formatCurrency(debt.balance)}</Roll></span>
            <button className="btn" style={{ padding: '4px', color: 'var(--danger)' }} onClick={() => setDebts(debts.filter(d => d.id !== debt.id))}>✕</button>
          </div>
        ))}
      </div>

      <button className="btn" onClick={() => setShowTimeline(!showTimeline)} style={{ marginBottom: 16 }}>
        {showTimeline ? 'Hide' : 'Show'} Payoff Timeline
      </button>

      {showTimeline && (
        <div style={{ height: 300, position: 'relative', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <canvas
            width={800}
            height={300}
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
              const data = method === 'snowball' ? snowballResult.timeline : avalancheResult.timeline
              const maxMonth = data[data.length - 1]?.month || 1
              const maxBal = Math.max(...debts.map(d => d.balance))

              ctx.clearRect(0, 0, w, h)
              ctx.font = '11px var(--mono)'
              ctx.textAlign = 'right'

              debts.forEach((debt, i) => {
                ctx.strokeStyle = debt.color || ['#e11d48', '#f97316', '#84cc16', '#06b6d4', '#8b5cf6'][i % 5]
                ctx.lineWidth = 2
                ctx.beginPath()
                data.forEach((point, idx) => {
                  const x = (idx / Math.max(1, data.length - 1)) * (w - 40) + 20
                  const y = h - 20 - (point.balances[i] / maxBal) * (h - 60)
                  if (idx === 0) ctx.moveTo(x, y)
                  else ctx.lineTo(x, y)
                })
                ctx.stroke()
              })
            }}
          />
        </div>
      )}

      <Hint>Choose snowball (smallest balance first) or avalanche (highest rate first). Extra payment accelerates payoff.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}