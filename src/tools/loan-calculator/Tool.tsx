import { useState } from 'react'
import { monthlyPayment, schedule } from './loan'

const money = (n: number) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—')

export default function LoanCalculator() {
  const [amount, setAmount] = useState('100000000')
  const [down, setDown] = useState('0')
  const [rate, setRate] = useState('10')
  const [years, setYears] = useState('5')
  const [showTable, setShowTable] = useState(false)

  const principal = Math.max(0, Number(amount) - Number(down))
  const months = Math.round(Number(years) * 12)
  const valid = principal > 0 && months > 0 && months <= 600 && Number(rate) >= 0
  const pay = valid ? monthlyPayment(principal, Number(rate), months) : NaN
  const total = pay * months
  const rows = valid && showTable ? schedule(principal, Number(rate), months) : []

  return (
    <div>
      <div className="two-col">
        <div><label htmlFor="loan-amount">Price or loan amount</label><input id="loan-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label htmlFor="loan-down">Down payment (DP)</label><input id="loan-down" type="number" min={0} value={down} onChange={(e) => setDown(e.target.value)} /></div>
        <div><label htmlFor="loan-rate">Interest rate per year (%)</label><input id="loan-rate" type="number" min={0} step={0.1} value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        <div><label htmlFor="loan-years">Term (years)</label><input id="loan-years" type="number" min={0.5} max={50} step={0.5} value={years} onChange={(e) => setYears(e.target.value)} /></div>
      </div>
      {!valid && <p className="error">Enter an amount above the down payment and a term of up to 50 years.</p>}
      {valid && (
        <>
          <div className="stats">
            <div className="stat"><b>{money(pay)}</b><span className="muted">Monthly payment</span></div>
            <div className="stat"><b>{money(total - principal)}</b><span className="muted">Total interest</span></div>
            <div className="stat"><b>{money(total)}</b><span className="muted">Total paid</span></div>
            <div className="stat"><b>{months}</b><span className="muted">Months</span></div>
          </div>
          <p className="muted">Uses a fixed rate with equal monthly payments (anuitas). Real offers may add fees or insurance.</p>
          <button type="button" className="btn" onClick={() => setShowTable(!showTable)}>{showTable ? 'Hide' : 'Show'} payment schedule</button>
          {showTable && (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table className="simple">
                <thead><tr><th>Month</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Remaining</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.month}><td>{r.month}</td><td>{money(r.payment)}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.balance)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
