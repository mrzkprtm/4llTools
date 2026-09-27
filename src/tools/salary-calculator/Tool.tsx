import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const TAX_BRACKETS = {
  ID: [
    { min: 0, max: 60000000, rate: 0.05 },
    { min: 60000000, max: 250000000, rate: 0.15 },
    { min: 250000000, max: 500000000, rate: 0.25 },
    { min: 500000000, max: 5000000000, rate: 0.30 },
    { min: 5000000000, max: Infinity, rate: 0.35 },
  ],
  US: [
    { min: 0, max: 11000, rate: 0.10 },
    { min: 11000, max: 44725, rate: 0.12 },
    { min: 44725, max: 95375, rate: 0.22 },
    { min: 95375, max: 182100, rate: 0.24 },
    { min: 182100, max: 231250, rate: 0.32 },
    { min: 231250, max: 578125, rate: 0.35 },
    { min: 578125, max: Infinity, rate: 0.37 },
  ],
  SG: [
    { min: 0, max: 20000, rate: 0 },
    { min: 20000, max: 30000, rate: 0.02 },
    { min: 30000, max: 40000, rate: 0.035 },
    { min: 40000, max: 80000, rate: 0.07 },
    { min: 80000, max: 120000, rate: 0.115 },
    { min: 120000, max: 160000, rate: 0.15 },
    { min: 160000, max: 200000, rate: 0.18 },
    { min: 200000, max: 240000, rate: 0.19 },
    { min: 240000, max: 280000, rate: 0.195 },
    { min: 280000, max: 320000, rate: 0.2 },
    { min: 320000, max: Infinity, rate: 0.22 },
  ],
}

const SOCIAL_SECURITY = {
  ID: { employee: 0.04, employer: 0.11, ceiling: 10428000 },
  US: { employee: 0.0765, employer: 0.0765, ceiling: 160200 },
  SG: { employee: 0.20, employer: 0.17, ceiling: 72000 },
}

const CURRENCIES = {
  ID: { code: 'IDR', symbol: 'Rp', locale: 'id-ID' },
  US: { code: 'USD', symbol: '$', locale: 'en-US' },
  SG: { code: 'SGD', symbol: 'S$', locale: 'en-SG' },
}

export default function SalaryCalculator() {
  const [country, setCountry] = useState<'ID' | 'US' | 'SG'>('ID')
  const [grossAnnual, setGrossAnnual] = useState(120000000)
  const [payFrequency, setPayFrequency] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly')
  const [dependents, setDependents] = useState(0)
  const [customDeductions, setCustomDeductions] = useState(0)
  const [age, setAge] = useState(30)

  const brackets = TAX_BRACKETS[country]
  const ss = SOCIAL_SECURITY[country]
  const currency = CURRENCIES[country]

  const calculateTax = (income: number) => {
    let tax = 0
    let remaining = income
    for (const bracket of brackets) {
      const taxableInBracket = Math.min(remaining, bracket.max - bracket.min)
      if (taxableInBracket <= 0) break
      tax += taxableInBracket * bracket.rate
      remaining -= taxableInBracket
    }
    return tax
  }

  const calculateSS = (income: number) => {
    const taxableIncome = Math.min(income, ss.ceiling)
    return {
      employee: taxableIncome * ss.employee,
      employer: taxableIncome * ss.employer,
    }
  }

  const taxableIncome = grossAnnual - customDeductions
  const incomeTax = calculateTax(taxableIncome)
  const ssContributions = calculateSS(grossAnnual)
  const totalDeductions = incomeTax + ssContributions.employee + customDeductions
  const netAnnual = grossAnnual - totalDeductions

  const periodsPerYear = payFrequency === 'monthly' ? 12 : payFrequency === 'biweekly' ? 26 : 52
  const grossPerPeriod = grossAnnual / periodsPerYear
  const netPerPeriod = netAnnual / periodsPerPeriod
  const taxPerPeriod = incomeTax / periodsPerPeriod
  const ssPerPeriod = ssContributions.employee / periodsPerPeriod

  const fmt = (n: number) => currency.symbol + ' ' + Math.round(n).toLocaleString(currency.locale)

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Salary Calculator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Country</span>
          <select value={country} onChange={e => setCountry(e.target.value as any)}>
            <option value="ID">Indonesia</option>
            <option value="US">United States</option>
            <option value="SG">Singapore</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Gross Annual Salary</span>
          <input type="number" min={0} step={1000000} value={grossAnnual} onChange={e => setGrossAnnual(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Pay Frequency</span>
          <select value={payFrequency} onChange={e => setPayFrequency(e.target.value as any)}>
            <option value="monthly">Monthly (12/yr)</option>
            <option value="biweekly">Bi-weekly (26/yr)</option>
            <option value="weekly">Weekly (52/yr)</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Dependents</span>
          <input type="number" min={0} max={10} value={dependents} onChange={e => setDependents(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
          <span>Age</span>
          <input type="number" min={18} max={100} value={age} onChange={e => setAge(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Other Deductions (annual)</span>
          <input type="number" min={0} step={1000000} value={customDeductions} onChange={e => setCustomDeductions(Number(e.target.value))} />
        </label>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ fontSize: '1.5rem', color: 'var(--ok)' }}><Roll value={fmt(netAnnual)} /></b><span className="muted">Net Annual</span></div>
        <div className="stat"><b style={{ fontSize: '1.5rem', color: 'var(--accent)' }}><Roll value={fmt(grossAnnual)} /></b><span className="muted">Gross Annual</span></div>
        <div className="stat"><b style={{ fontSize: '1.5rem', color: 'var(--danger)' }}><Roll value={fmt(totalDeductions)} /></b><span className="muted">Total Deductions</span></div>
        <div className="stat"><b><Roll value={fmt(netPerPeriod)} /></b><span className="muted">Net per {payFrequency}</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 12px' }}>Annual Breakdown</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Gross Salary</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(grossAnnual)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Income Tax</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--danger)' }}>{fmt(incomeTax)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Social Security (Employee)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(ssContributions.employee)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Other Deductions</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{fmt(customDeductions)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--ok)20', border: '1px solid var(--ok)40', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Net Salary</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>{fmt(netAnnual)}</div>
            </div>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Per {payFrequency.charAt(0).toUpperCase() + payFrequency.slice(1)} Paycheck</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Gross Pay</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)' }}>{fmt(grossPerPeriod)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Income Tax</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--danger)' }}>{fmt(taxPerPeriod)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Social Security</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(ssPerPeriod)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--ok)20', border: '1px solid var(--ok)40', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Net Pay</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>{fmt(netPerPeriod)}</div>
            </div>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Tax Bracket Details ({country})</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {brackets.map((bracket, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 4 }}>
                <span className="muted">{bracket.min > 0 ? fmt(bracket.min) : '0'} – {bracket.max === Infinity ? '∞' : fmt(bracket.max)}</span>
                <span style={{ fontWeight: 600 }}>{(bracket.rate * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '300ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Social Security Contributions</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Employee Contribution</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(ssContributions.employee)} /yr</div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>{(ss.employee * 100).toFixed(1)}% up to {fmt(ss.ceiling)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Employer Contribution</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>{fmt(ssContributions.employer)} /yr</div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>{(ss.employer * 100).toFixed(1)}% up to {fmt(ss.ceiling)}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 4 }}>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Total SS Cost (Employer)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>{fmt(ssContributions.employee + ssContributions.employer)} /yr</div>
            </div>
          </div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Calculates income tax using progressive brackets and social security. Rates are 2024 approximations. Consult a tax professional for actual filing.
      </p>
    </div>
  )
}