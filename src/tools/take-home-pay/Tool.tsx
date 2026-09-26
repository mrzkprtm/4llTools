import { useState, useEffect } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface TaxBracket {
  min: number
  max: number
  rate: number
}

const INDONESIA_TER_2024: TaxBracket[] = [
  { min: 0, max: 60000000, rate: 0.05 },
  { min: 60000000, max: 250000000, rate: 0.15 },
  { min: 250000000, max: 500000000, rate: 0.25 },
  { min: 500000000, max: 5000000000, rate: 0.30 },
  { min: 5000000000, max: Infinity, rate: 0.35 },
]

const BPJS_KESEHATAN = 0.01
const BPJS_KETENAGAKERJAAN = 0.02
const BPJS_PENSIUN = 0.01

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}

function calculateTax(income: number, brackets: TaxBracket[]): { tax: number; details: { bracket: string; taxable: number; tax: number }[] } {
  let remaining = income
  let tax = 0
  const details: { bracket: string; taxable: number; tax: number }[] = []
  for (const b of brackets) {
    const taxableInBracket = Math.min(remaining, b.max - b.min)
    if (taxableInBracket <= 0) break
    const bracketTax = taxableInBracket * b.rate
    tax += bracketTax
    details.push({ bracket: `${b.rate * 100}%`, taxable: taxableInBracket, tax: bracketTax })
    remaining -= taxableInBracket
  }
  return { tax, details }
}

export default function TakeHomePayCalculator() {
  const [grossMonthly, setGrossMonthly] = useState(15000000)
  const [mode, setMode] = useState<'indonesia' | 'generic'>('indonesia')
  const [genericRate, setGenericRate] = useState(20)
  const [bpjsKesehatan, setBpjsKesehatan] = useState(true)
  const [bpjsKetenagakerjaan, setBpjsKetenagakerjaan] = useState(true)
  const [bpjsPensiun, setBpjsPensiun] = useState(true)

  const grossYearly = grossMonthly * 12
  const { tax: yearlyTax, details: taxDetails } = calculateTax(grossYearly, INDONESIA_TER_2024)
  const monthlyTax = yearlyTax / 12

  const bpjsKesehatanAmt = bpjsKesehatan ? grossMonthly * BPJS_KESEHATAN : 0
  const bpjsKetenagakerjaanAmt = bpjsKetenagakerjaan ? grossMonthly * BPJS_KETENAGAKERJAAN : 0
  const bpjsPensiunAmt = bpjsPensiun ? grossMonthly * BPJS_PENSIUN : 0
  const totalBpjs = bpjsKesehatanAmt + bpjsKetenagakerjaanAmt + bpjsPensiunAmt

  const genericTax = mode === 'generic' ? grossMonthly * genericRate / 100 : 0
  const totalDeductions = mode === 'indonesia' ? monthlyTax + totalBpjs : genericTax
  const netMonthly = grossMonthly - totalDeductions

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label>Gross Monthly Salary (IDR)</label>
          <input type="number" min={0} step={500000} value={grossMonthly} onChange={e => setGrossMonthly(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label>Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value as 'indonesia' | 'generic')}>
            <option value="indonesia">Indonesia (PPh 21 TER + BPJS)</option>
            <option value="generic">Generic Flat Tax</option>
          </select>
        </div>
        {mode === 'generic' && (
          <div style={{ flex: 1, minWidth: 200 }}>
            <label>Flat Tax Rate %</label>
            <input type="number" min={0} max={50} step={0.5} value={genericRate} onChange={e => setGenericRate(Number(e.target.value))} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
          <input type="checkbox" checked={bpjsKesehatan} onChange={e => setBpjsKesehatan(e.target.checked)} /> BPJS Kesehatan (1%)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
          <input type="checkbox" checked={bpjsKetenagakerjaan} onChange={e => setBpjsKetenagakerjaan(e.target.checked)} /> BPJS Ketenagakerjaan (2%)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={bpjsPensiun} onChange={e => setBpjsPensiun(e.target.checked)} /> BPJS Pensiun (1%)
        </label>
      </div>

      <div style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: '1.2rem', marginBottom: 8 }}>
          <span>Gross Salary</span>
          <span><b><Roll>{formatCurrency(grossMonthly)}</Roll></b></span>
        </div>

        <div className="split-bar" style={{ marginBottom: 12 }} aria-hidden="true">
          <i style={{ flexGrow: mode === 'indonesia' ? monthlyTax / grossMonthly * 100 : genericTax / grossMonthly * 100 }}></i>
          {mode === 'indonesia' && totalBpjs > 0 && <i style={{ flexGrow: totalBpjs / grossMonthly * 100, background: 'color-mix(in srgb, var(--accent) 35%, var(--sunken))' }}></i>}
          <i style={{ flexGrow: Math.max(0, 100 - (mode === 'indonesia' ? (monthlyTax + totalBpjs) / grossMonthly * 100 : genericTax / grossMonthly * 100)) }}></i>
        </div>

        <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--muted)' }}>
          <span>Tax</span>
          {mode === 'indonesia' && <span>BPJS</span>}
          <span>Net</span>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll>{formatCurrency(totalDeductions)}</Roll></b><span className="muted">Total Deductions</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll>{formatCurrency(netMonthly)}</Roll></b><span className="muted">Take-Home Pay</span></div>
        <div className="stat"><b><Roll>{Math.round(netMonthly / grossMonthly * 100)}</Roll>%</b><span className="muted">Retention Rate</span></div>
      </div>

      {mode === 'indonesia' && (
        <details style={{ marginBottom: 16 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>PPh 21 TER Breakdown</summary>
          <table className="simple" style={{ marginTop: 12 }}>
            <thead><tr><th>Bracket</th><th>Taxable</th><th>Rate</th><th>Tax</th></tr></thead>
            <tbody>
              {taxDetails.map((d, i) => (
                <tr key={i} className="pop-row" style={{ animation: reducedMotion() ? 'none' : 'rise 0.3s var(--ease-out) both', animationDelay: `${i * 30}ms` }}>
                  <td>{d.bracket}</td>
                  <td><Roll>{formatCurrency(d.taxable)}</Roll></td>
                  <td>{d.bracket}</td>
                  <td><Roll>{formatCurrency(d.tax)}</Roll></td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3} style={{ textAlign: 'right' }}>Total Yearly Tax</td>
                <td><Roll>{formatCurrency(yearlyTax)}</Roll></td>
              </tr>
            </tbody>
          </table>
        </details>
      )}

      <Hint>Waterfall shows gross → tax → BPJS → net. Indonesia mode uses 2024 PPh 21 TER brackets and standard BPJS rates.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}