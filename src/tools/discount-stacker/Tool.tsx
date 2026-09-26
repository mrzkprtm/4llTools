import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Voucher {
  id: number
  type: 'percent' | 'fixed' | 'cashback' | 'cap'
  value: number
  maxCap?: number
  active: boolean
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

function applyVouchers(price: number, vouchers: Voucher[]): { final: number; steps: { label: string; price: number }[] } {
  let current = price
  const steps = [{ label: 'Original', price: current }]
  for (const v of vouchers) {
    if (!v.active) continue
    let before = current
    if (v.type === 'percent') {
      current = current * (1 - v.value / 100)
    } else if (v.type === 'fixed') {
      current = Math.max(0, current - v.value)
    } else if (v.type === 'cashback') {
      current = current // cashback doesn't reduce price, just returns money
    } else if (v.type === 'cap') {
      // cap is handled after other discounts
    }
    steps.push({ label: v.type === 'cashback' ? `Cashback ${formatCurrency(v.value)}` : `${v.type === 'percent' ? v.value + '% off' : formatCurrency(v.value) + ' off'}`, price: current })
  }
  // Apply cap if any
  const capVoucher = vouchers.find(v => v.active && v.type === 'cap')
  if (capVoucher && capVoucher.maxCap !== undefined) {
    const discount = price - current
    if (discount > capVoucher.maxCap) {
      current = price - capVoucher.maxCap
      steps.push({ label: `Cap at ${formatCurrency(capVoucher.maxCap)}`, price: current })
    }
  }
  return { final: current, steps }
}

export default function DiscountStacker() {
  const [price, setPrice] = useState(100)
  const [vouchers, setVouchers] = useState<Voucher[]>(() => {
    const saved = localStorage.getItem('discount-stacker')
    return saved ? JSON.parse(saved) : [
      { id: 1, type: 'percent', value: 20, active: true },
      { id: 2, type: 'fixed', value: 10, active: true },
      { id: 3, type: 'cashback', value: 5, active: false },
      { id: 4, type: 'cap', value: 0, maxCap: 30, active: true },
    ]
  })
  const [showBestOrder, setShowBestOrder] = useState(false)

  useEffect(() => { try { localStorage.setItem('discount-stacker', JSON.stringify(vouchers)) } catch {} }, [vouchers])

  const { final, steps } = applyVouchers(price, vouchers)
  const savings = price - final

  const addVoucher = (type: Voucher['type']) => {
    const defaults: Record<Voucher['type'], Partial<Voucher>> = {
      percent: { value: 10 },
      fixed: { value: 5 },
      cashback: { value: 5 },
      cap: { value: 0, maxCap: 50 },
    }
    setVouchers([...vouchers, { id: Date.now(), type, active: true, ...defaults[type] }])
  }

  const updateVoucher = (id: number, field: string, value: string | number | boolean) => {
    setVouchers(vouchers.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  // Find best order by trying permutations (simplified: fixed first, then percent, then cashback, then cap)
  const bestOrder = [...vouchers].sort((a, b) => {
    const order = { fixed: 0, percent: 1, cashback: 2, cap: 3 }
    return order[a.type] - order[b.type]
  })
  const { final: bestFinal } = applyVouchers(price, bestOrder)

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label>Original Price</label>
          <input type="number" min={0} step={0.01} value={price} onChange={e => setPrice(Number(e.target.value))} />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => addVoucher('percent')}>% Off</button>
          <button className="btn" onClick={() => addVoucher('fixed')}>$ Off</button>
          <button className="btn" onClick={() => addVoucher('cashback')}>Cashback</button>
          <button className="btn" onClick={() => addVoucher('cap')}>Max Cap</button>
          <button className="btn primary" onClick={() => setShowBestOrder(true)}>Find Best Order</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>Price: <b><Roll>{formatCurrency(price)}</Roll></b></span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ok)' }}>→ <b><Roll>{formatCurrency(final)}</Roll></b></span>
          <span style={{ fontSize: '1.2rem', color: 'var(--ok)' }}>Save <b><Roll>{formatCurrency(savings)}</Roll></b></span>
          {showBestOrder && bestFinal < final && (
            <span className="chip good">Best: {formatCurrency(bestFinal)} (save {formatCurrency(price - bestFinal)})</span>
          )}
        </div>

        <div style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
          {steps.map((step, i) => (
            <div key={i} className="pop-row" style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : 'none',
              animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
              animationDelay: `${i * 60}ms`
            }}>
              <span>{step.label}</span>
              <span style={{ fontFamily: 'var(--mono)' }}><Roll>{formatCurrency(step.price)}</Roll></span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {vouchers.map((v, i) => (
          <div key={v.id} className="pop-row" style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 10,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
            animationDelay: `${i * 40}ms`
          }}>
            <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={v.active} onChange={e => updateVoucher(v.id, 'active', e.target.checked)} />
              {v.type.charAt(0).toUpperCase() + v.type.slice(1)}
            </label>
            {v.type !== 'cap' && (
              <input type="number" step={v.type === 'percent' ? 1 : 0.01} min={0} value={v.value} onChange={e => updateVoucher(v.id, 'value', Number(e.target.value))} style={{ width: 80 }} />
            )}
            {v.type === 'cap' && (
              <>
                <input type="number" step={0.01} min={0} placeholder="Max cap" value={v.maxCap ?? ''} onChange={e => updateVoucher(v.id, 'maxCap', Number(e.target.value))} style={{ width: 100 }} />
                <span className="muted">Max discount</span>
              </>
            )}
            <button className="btn" style={{ padding: '4px 8px', color: 'var(--danger)', marginLeft: 'auto' }} onClick={() => setVouchers(vouchers.filter(v2 => v2.id !== v.id))}>✕</button>
          </div>
        ))}
      </div>

      <Hint>Stack vouchers in order. Fixed discounts first, then percent, then cashback. Cap limits total discount. Tap "Find Best Order" to optimize.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}