import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Scenario {
  id: number
  name: string
  initialInvestment: number
  annualReturn: number
  annualCost: number
  years: number
  salvageValue: number
}

const DEFAULT_SCENARIOS: Scenario[] = [
  { id: 1, name: 'Marketing Campaign', initialInvestment: 50000, annualReturn: 80000, annualCost: 10000, years: 3, salvageValue: 0 },
  { id: 2, name: 'Equipment Purchase', initialInvestment: 100000, annualReturn: 40000, annualCost: 5000, years: 5, salvageValue: 20000 },
  { id: 3, name: 'Software Development', initialInvestment: 75000, annualReturn: 60000, annualCost: 15000, years: 2, salvageValue: 0 },
]

export default function ROICalculator() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    const saved = localStorage.getItem('roi-calculator')
    return saved ? JSON.parse(saved) : DEFAULT_SCENARIOS
  })
  const [discountRate, setDiscountRate] = useState(10)
  const [newScenario, setNewScenario] = useState({ name: '', initialInvestment: 0, annualReturn: 0, annualCost: 0, years: 1, salvageValue: 0 })

  useEffect(() => {
    try { localStorage.setItem('roi-calculator', JSON.stringify(scenarios)) } catch {}
  }, [scenarios])

  const addScenario = () => {
    if (!newScenario.name.trim()) return
    setScenarios([...scenarios, { ...newScenario, id: Date.now() }])
    setNewScenario({ name: '', initialInvestment: 0, annualReturn: 0, annualCost: 0, years: 1, salvageValue: 0 })
  }

  const removeScenario = (id: number) => {
    setScenarios(scenarios.filter(s => s.id !== id))
  }

  const updateScenario = (id: number, field: string, value: string | number) => {
    setScenarios(scenarios.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const calculateROI = (scenario: Scenario) => {
    const netAnnual = scenario.annualReturn - scenario.annualCost
    const totalReturns = netAnnual * scenario.years + scenario.salvageValue
    const totalInvestment = scenario.initialInvestment
    const netProfit = totalReturns - totalInvestment
    const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0

    // NPV calculation
    const r = discountRate / 100
    let npv = -scenario.initialInvestment
    for (let year = 1; year <= scenario.years; year++) {
      npv += (scenario.annualReturn - scenario.annualCost) / Math.pow(1 + r, year)
    }
    if (scenario.salvageValue > 0) {
      npv += scenario.salvageValue / Math.pow(1 + r, scenario.years)
    }

    // Payback period
    let payback = 0
    let cumulative = -scenario.initialInvestment
    for (let year = 1; year <= scenario.years; year++) {
      cumulative += netAnnual
      if (cumulative >= 0 && payback === 0) {
        payback = year - 1 + (-cumulative + netAnnual) / netAnnual
      }
    }
    if (cumulative < 0 && scenario.salvageValue > 0) {
      cumulative += scenario.salvageValue
      if (cumulative >= 0 && payback === 0) {
        payback = scenario.years
      }
    }

    return { netAnnual, totalReturns, netProfit, roi, npv, payback: payback > 0 ? payback : null }
  }

  const results = useMemo(() => scenarios.map(s => ({ ...s, ...calculateROI(s) })), [scenarios, discountRate])
  const bestScenario = results.reduce((best, curr) => curr.roi > best.roi ? curr : best, results[0] || { roi: -Infinity })

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
  const fmtPct = (n: number) => n.toFixed(1) + '%'

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>ROI Calculator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Discount Rate % (for NPV)</span>
          <input type="number" min={0} max={50} step={0.1} value={discountRate} onChange={e => setDiscountRate(Number(e.target.value))} />
        </label>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        {scenarios.map((scenario, i) => {
          const r = calculateROI(scenario)
          return (
            <div key={scenario.id} className="stat" style={{ borderLeft: `4px solid ${scenario.id === bestScenario.id ? 'var(--ok)' : 'var(--border)'}` }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{scenario.name}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: r.roi >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                <Roll value={fmtPct(r.roi)} />
              </div>
              <div className="muted" style={{ fontSize: '0.75rem' }}>NPV: {fmt(r.npv)}</div>
            </div>
          )
        })}
        {scenarios.length === 0 && <div className="stat">No scenarios yet</div>}
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Add Scenario
            <button className="btn" onClick={addScenario} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Add</button>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <input type="text" placeholder="Scenario Name" value={newScenario.name} onChange={e => setNewScenario({ ...newScenario, name: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
              <input type="number" min={0} step={1000} placeholder="Initial Investment" value={newScenario.initialInvestment} onChange={e => setNewScenario({ ...newScenario, initialInvestment: Number(e.target.value) })} style={{ width: 180 }} />
              <input type="number" min={0} step={1000} placeholder="Annual Return" value={newScenario.annualReturn} onChange={e => setNewScenario({ ...newScenario, annualReturn: Number(e.target.value) })} style={{ width: 180 }} />
              <input type="number" min={0} step={1000} placeholder="Annual Cost" value={newScenario.annualCost} onChange={e => setNewScenario({ ...newScenario, annualCost: Number(e.target.value) })} style={{ width: 180 }} />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input type="number" min={1} max={50} placeholder="Years" value={newScenario.years} onChange={e => setNewScenario({ ...newScenario, years: Number(e.target.value) })} style={{ width: 80 }} />
              <input type="number" min={0} step={1000} placeholder="Salvage Value" value={newScenario.salvageValue} onChange={e => setNewScenario({ ...newScenario, salvageValue: Number(e.target.value) })} style={{ width: 150 }} />
              <button className="btn" onClick={addScenario} style={{ justifySelf: 'start', padding: '8px 16px' }}>Add Scenario</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {scenarios.map((scenario, i) => {
            const r = calculateROI(scenario)
            return (
              <div key={scenario.id} className="pop-row" style={{
                padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                borderLeft: `4px solid ${scenario.id === bestScenario.id ? 'var(--ok)' : 'var(--border)'}`,
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 80}ms`,
              }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.2rem' }}>{scenario.name}</div>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      Investment: <b>{fmt(scenario.initialInvestment)}</b> • Years: {scenario.years} • Discount Rate: {discountRate}%
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn" onClick={() => removeScenario(scenario.id)} style={{ color: 'var(--danger)' }}>Delete</button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div className="stat"><b style={{ color: r.netProfit >= 0 ? 'var(--ok)' : 'var(--danger)' }}><Roll value={fmt(r.netProfit)} /></b><span className="muted">Net Profit</span></div>
                  <div className="stat"><b style={{ color: r.roi >= 0 ? 'var(--ok)' : 'var(--danger)' }}><Roll value={fmtPct(r.roi)} /></b><span className="muted">ROI</span></div>
                  <div className="stat"><b style={{ color: r.npv >= 0 ? 'var(--ok)' : 'var(--danger)' }}><Roll value={fmt(r.npv)} /></b><span className="muted">NPV (@{discountRate}%)</span></div>
                  <div className="stat"><b><Roll value={r.payback ? r.payback.toFixed(1) : '∞'} /></b><span className="muted">Payback (years)</span></div>
                </div>

                <div style={{ marginTop: 16, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                  <h5 style={{ margin: '0 0 8px' }}>Cash Flow Projection</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, fontSize: '0.85rem' }}>
                    <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg)', borderRadius: 4 }}>
                      <div className="muted">Year 0</div>
                      <div style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(-scenario.initialInvestment)}</div>
                    </div>
                    {Array.from({ length: scenario.years }, (_, i) => {
                      const year = i + 1
                      const cashFlow = scenario.annualReturn - scenario.annualCost
                      return (
                        <div key={year} style={{ textAlign: 'center', padding: 8, background: 'var(--bg)', borderRadius: 4 }}>
                          <div className="muted">Year {year}</div>
                          <div style={{ color: cashFlow >= 0 ? 'var(--ok)' : 'var(--danger)', fontWeight: 600 }}>{fmt(cashFlow)}</div>
                        </div>
                      )
                    })}
                    {scenario.salvageValue > 0 && (
                      <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg)', borderRadius: 4 }}>
                        <div className="muted">Salvage</div>
                        <div style={{ color: 'var(--ok)', fontWeight: 600 }}>{fmt(scenario.salvageValue)}</div>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
                    Total Returns: <b>{fmt(r.totalReturns)}</b> • Net Profit: <b style={{ color: r.netProfit >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmt(r.netProfit)}</b>
                    {r.payback && <span className="muted" style={{ marginLeft: 16 }}>Payback: {r.payback.toFixed(1)} years</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Comparison Summary</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Scenario</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Investment</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Net Profit</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>ROI</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>NPV</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Payback</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario, i) => {
                  const r = calculateROI(scenario)
                  return (
                    <tr key={scenario.id} style={{ animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: `${i * 60}ms` }}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{scenario.name} {scenario.id === bestScenario.id && <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'var(--ok)', color: 'white', borderRadius: 4, marginLeft: 8 }}>BEST</span>}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{fmt(scenario.initialInvestment)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: r.netProfit >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmt(r.netProfit)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: r.roi >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmtPct(r.roi)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: r.npv >= 0 ? 'var(--ok)' : 'var(--danger)' }}>{fmt(r.npv)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{r.payback ? r.payback.toFixed(1) + ' yr' : 'Never'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Enter investment scenarios with initial cost, annual returns/costs, and time horizon. Calculates ROI, NPV (with discount rate), and payback period. Compare multiple scenarios side by side.
        </p>
      </div>
    </div>
  )
}