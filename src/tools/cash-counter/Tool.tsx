import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Denomination {
  value: number
  label: string
  color: string
  type: 'note' | 'coin'
  count: number
}

const IDR_DENOMS: Denomination[] = [
  { value: 100000, label: 'Rp100,000', color: '#e11d48', type: 'note', count: 0 },
  { value: 50000, label: 'Rp50,000', color: '#f97316', type: 'note', count: 0 },
  { value: 20000, label: 'Rp20,000', color: '#84cc16', type: 'note', count: 0 },
  { value: 10000, label: 'Rp10,000', color: '#06b6d4', type: 'note', count: 0 },
  { value: 5000, label: 'Rp5,000', color: '#8b5cf6', type: 'note', count: 0 },
  { value: 2000, label: 'Rp2,000', color: '#ec4899', type: 'note', count: 0 },
  { value: 1000, label: 'Rp1,000', color: '#f43f5e', type: 'coin', count: 0 },
  { value: 500, label: 'Rp500', color: '#14b8a6', type: 'coin', count: 0 },
  { value: 200, label: 'Rp200', color: '#a16207', type: 'coin', count: 0 },
  { value: 100, label: 'Rp100', color: '#64748b', type: 'coin', count: 0 },
]

const USD_DENOMS: Denomination[] = [
  { value: 10000, label: '$100', color: '#16a34a', type: 'note', count: 0 },
  { value: 5000, label: '$50', color: '#059669', type: 'note', count: 0 },
  { value: 2000, label: '$20', color: '#0d9488', type: 'note', count: 0 },
  { value: 1000, label: '$10', color: '#0891b2', type: 'note', count: 0 },
  { value: 500, label: '$5', color: '#0284c7', type: 'note', count: 0 },
  { value: 100, label: '$1', color: '#2563eb', type: 'coin', count: 0 },
  { value: 25, label: '25¢', color: '#7c3aed', type: 'coin', count: 0 },
  { value: 10, label: '10¢', color: '#db2777', type: 'coin', count: 0 },
  { value: 5, label: '5¢', color: '#f43f5e', type: 'coin', count: 0 },
  { value: 1, label: '1¢', color: '#a16207', type: 'coin', count: 0 },
]

function formatCurrency(n: number, currency: 'IDR' | 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: currency === 'IDR' ? 0 : 2 }).format(n)
}

function calculateChange(amount: number, denoms: Denomination[]): { value: number; count: number }[] {
  const sorted = [...denoms].sort((a, b) => b.value - a.value)
  const result: { value: number; count: number }[] = []
  let remaining = amount
  for (const d of sorted) {
    const count = Math.floor(remaining / d.value)
    if (count > 0) {
      result.push({ value: d.value, count })
      remaining -= count * d.value
    }
  }
  return result
}

export default function CashCounter() {
  const [currency, setCurrency] = useState<'IDR' | 'USD'>('IDR')
  const [denoms, setDenoms] = useState<Denomination[]>(() => {
    const saved = localStorage.getItem('cash-counter')
    return saved ? JSON.parse(saved) : IDR_DENOMS
  })
  const [targetAmount, setTargetAmount] = useState('')

  useEffect(() => {
    try { localStorage.setItem('cash-counter', JSON.stringify(denoms)) } catch {}
  }, [denoms])

  const total = denoms.reduce((sum, d) => sum + d.value * d.count, 0)
  const totalNotes = denoms.reduce((sum, d) => sum + d.count, 0)

  const increment = (id: number) => {
    setDenoms(denoms.map(d => d.value === id ? { ...d, count: d.count + 1 } : d))
  }
  const decrement = (id: number) => {
    setDenoms(denoms.map(d => d.value === id ? { ...d, count: Math.max(0, d.count - 1) } : d))
  }

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTargetAmount(e.target.value)
    if (e.target.value) {
      const amount = Number(e.target.value)
      const change = calculateChange(amount, denoms.filter(d => d.count > 0))
      setDenoms(denoms.map(d => {
        const c = change.find(c => c.value === d.value)
        return c ? { ...d, count: c.count } : { ...d, count: 0 }
      }))
    }
  }

  const resetAll = () => {
    setDenoms(denoms.map(d => ({ ...d, count: 0 })))
    setTargetAmount('')
  }

  const denomsToUse = currency === 'IDR' ? IDR_DENOMS : USD_DENOMS

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={currency} onChange={e => {
            const c = e.target.value as 'IDR' | 'USD'
            setCurrency(c)
            setDenoms(c === 'IDR' ? IDR_DENOMS.map(d => ({ ...d, count: 0 })) : USD_DENOMS.map(d => ({ ...d, count: 0 })))
          }}>
            <option value="IDR">Indonesian Rupiah (IDR)</option>
            <option value="USD">US Dollar (USD)</option>
          </select>
        </label>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label>Target Amount (for change calc)</label>
          <input type="number" min={0} step={currency === 'IDR' ? 100 : 0.01} placeholder="Enter amount to make change for" value={targetAmount} onChange={handleTargetChange} />
        </div>
        <button className="btn" onClick={resetAll}>Reset All</button>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{formatCurrency(total, currency)}</Roll></b><span className="muted">Total Value</span></div>
        <div className="stat"><b><Roll>{totalNotes}</Roll></b><span className="muted">Total Pieces</span></div>
        {targetAmount && (
          <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll>{calculateChange(Number(targetAmount), denoms.filter(d => d.count > 0)).length}</Roll></b><span className="muted">Denominations Used</span></div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {denomsToUse.map((d, i) => (
          <div key={d.value} className="pop-row" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 12,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            borderLeft: `4px solid ${d.color}`,
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 30}ms`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 12, height: 12, borderRadius: d.type === 'coin' ? '50%' : 4, background: d.color }} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.label}</span>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <button className="btn" style={{ padding: '4px 10px', fontSize: '1rem' }} onClick={() => decrement(d.value)}>−</button>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '1.2rem', minWidth: 40, textAlign: 'center' }}><Roll>{denoms.find(x => x.value === d.value)?.count ?? 0}</Roll></span>
              <button className="btn" style={{ padding: '4px 10px', fontSize: '1rem' }} onClick={() => increment(d.value)}>+</button>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', color: 'var(--muted)' }}>
              {formatCurrency(d.value * (denoms.find(x => x.value === d.value)?.count ?? 0), currency)}
            </span>
          </div>
        ))}
      </div>

      {targetAmount && (
        <div style={{ marginTop: 16, padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Change for {formatCurrency(Number(targetAmount), currency)} (fewest pieces):</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {calculateChange(Number(targetAmount), denoms.filter(d => d.count > 0)).map(c => (
              <span key={c.value} className="chip" style={{ background: 'var(--ok)', color: 'var(--ok-text, white)' }}>
                {c.count} × {formatCurrency(c.value, currency)}
              </span>
            ))}
          </div>
        </div>
      )}

      <Hint>Tap +/− to count notes and coins. Enter a target amount to calculate fewest pieces for change.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}