import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const CURRENCIES = [
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', rate: 15500 },
  { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1 },
  { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.92 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', rate: 1.34 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', rate: 4.7 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', rate: 36 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', rate: 150 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', rate: 1330 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', rate: 7.2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', rate: 1.52 },
  { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.79 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', rate: 1.35 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', rate: 0.89 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', rate: 7.8 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', rate: 32 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', rate: 56 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', rate: 24500 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 83 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate: 3.67 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', rate: 3.75 },
]

export default function CurrencyConverter() {
  const [amount, setAmount] = useState(100)
  const [fromCurrency, setFromCurrency] = useState('USD')
  const [toCurrency, setToCurrency] = useState('IDR')
  const [swapDirection, setSwapDirection] = useState(false)

  const from = CURRENCIES.find(c => c.code === fromCurrency)!
  const to = CURRENCIES.find(c => c.code === toCurrency)!

  const converted = useMemo(() => {
    const usdAmount = amount / from.rate
    return usdAmount * to.rate
  }, [amount, fromCurrency, toCurrency])

  const rate = useMemo(() => to.rate / from.rate, [fromCurrency, toCurrency])

  const swap = () => {
    setSwapDirection(!swapDirection)
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  const formatAmount = (value: number, currency: typeof CURRENCIES[0]) => {
    return `${currency.symbol} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const quickAmounts = [10, 50, 100, 500, 1000, 5000, 10000]

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Currency Converter</h3>

      <div className="pop-row" style={{ padding: 20, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="muted">From</span>
                <select value={fromCurrency} onChange={e => setFromCurrency(e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px 12px', fontSize: '1rem', minWidth: 150 }}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                </select>
              </div>
              <input type="number" step="0.01" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '12px 16px', fontSize: '1.5rem', fontFamily: 'var(--mono)', width: '100%', textAlign: 'right' }} />
            </label>
          </div>

          <button className="btn" onClick={swap} style={{ padding: '12px 16px', fontSize: '1.2rem', borderRadius: '50%', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ↻
          </button>

          <div style={{ flex: 1, minWidth: 200, textAlign: 'right' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <select value={toCurrency} onChange={e => setToCurrency(e.target.value)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px 12px', fontSize: '1rem', minWidth: 150 }}>
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                </select>
                <span className="muted">To</span>
              </div>
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px 16px', fontSize: '1.5rem', fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', minWidth: 200, textAlign: 'right' }}>
                <Roll value={formatAmount(converted, to)} />
              </div>
            </label>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {quickAmounts.map(q => (
            <button key={q} className="btn" onClick={() => setAmount(q)} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>{from.symbol}{q}</button>
          ))}
        </div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div className="row" style={{ gap: 24 }}>
            <div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Exchange Rate</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                1 {from.code} = <Roll value={rate.toFixed(4)} /> {to.code}
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Inverse Rate</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                1 {to.code} = <Roll value={(1/rate).toFixed(4)} /> {from.code}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="muted" style={{ fontSize: '0.8rem' }}>Spread (est. 2%)</div>
            <div style={{ fontSize: '1rem', color: 'var(--danger)' }}>
              <Roll value={(rate * 1.02).toFixed(4)} /> {to.code} (buy)
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Quick Conversion Table (1 {from.code} = {rate.toFixed(2)} {to.code})</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)' }}>{from.code}</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)' }}>{to.code}</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)' }}>{to.code}</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '2px solid var(--border)' }}>{from.code}</th>
              </tr>
            </thead>
            <tbody>
              {[1, 5, 10, 25, 50, 100, 250, 500, 1000].map(val => (
                <tr key={val} style={{ animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
                  <td style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)' }}>{from.symbol}{val.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>{to.symbol}{(val * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)' }}>{to.symbol}{val.toLocaleString()}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>{from.symbol}{(val / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Rates are mock/static for demo. In production, connect to a live API. Click ↻ to swap currencies. Quick amounts for common values.
      </p>
    </div>
  )
}