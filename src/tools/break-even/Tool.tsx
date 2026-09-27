import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface CostItem {
  id: number
  name: string
  type: 'fixed' | 'variable'
  amount: number
}

export default function BreakEvenCalculator() {
  const [fixedCosts, setFixedCosts] = useState<CostItem[]>(() => {
    const saved = localStorage.getItem('break-even-fixed')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Rent', type: 'fixed', amount: 2000 },
      { id: 2, name: 'Salaries', type: 'fixed', amount: 5000 },
      { id: 3, name: 'Insurance', type: 'fixed', amount: 500 },
      { id: 4, name: 'Software', type: 'fixed', amount: 300 },
    ]
  })
  const [variableCosts, setVariableCosts] = useState<CostItem[]>(() => {
    const saved = localStorage.getItem('break-even-variable')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Materials', type: 'variable', amount: 15 },
      { id: 2, name: 'Labor per unit', type: 'variable', amount: 10 },
      { id: 3, name: 'Packaging', type: 'variable', amount: 3 },
      { id: 4, name: 'Shipping', type: 'variable', amount: 5 },
    ]
  })
  const [sellingPrice, setSellingPrice] = useState(50)
  const [targetProfit, setTargetProfit] = useState(0)
  const [taxRate, setTaxRate] = useState(0)

  useEffect(() => { try { localStorage.setItem('break-even-fixed', JSON.stringify(fixedCosts)) } catch {} }, [fixedCosts])
  useEffect(() => { try { localStorage.setItem('break-even-variable', JSON.stringify(variableCosts)) } catch {} }, [variableCosts])

  const addFixedCost = () => {
    setFixedCosts([...fixedCosts, { id: Date.now(), name: 'New Fixed Cost', type: 'fixed', amount: 0 }])
  }

  const removeFixedCost = (id: number) => {
    setFixedCosts(fixedCosts.filter(c => c.id !== id))
  }

  const updateFixedCost = (id: number, field: string, value: string | number) => {
    setFixedCosts(fixedCosts.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const addVariableCost = () => {
    setVariableCosts([...variableCosts, { id: Date.now(), name: 'New Variable Cost', type: 'variable', amount: 0 }])
  }

  const removeVariableCost = (id: number) => {
    setVariableCosts(variableCosts.filter(c => c.id !== id))
  }

  const updateVariableCost = (id: number, field: string, value: string | number) => {
    setVariableCosts(variableCosts.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const totalFixed = fixedCosts.reduce((sum, c) => sum + c.amount, 0)
  const variablePerUnit = variableCosts.reduce((sum, c) => sum + c.amount, 0)
  const contributionMargin = sellingPrice - variablePerUnit

  const breakEvenUnits = contributionMargin > 0 ? totalFixed / contributionMargin : Infinity
  const breakEvenRevenue = breakEvenUnits * sellingPrice

  const targetUnits = contributionMargin > 0 ? (totalFixed + targetProfit) / contributionMargin : Infinity
  const targetRevenue = targetUnits * sellingPrice

  const afterTaxProfit = targetProfit / (1 - taxRate / 100)
  const afterTaxUnits = contributionMargin > 0 ? (totalFixed + afterTaxProfit) / contributionMargin : Infinity

  const fmt = (n: number) => '$' + (n === Infinity ? '∞' : Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtUnits = (n: number) => n === Infinity ? '∞' : Math.round(n * 100) / 100

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Break-Even Calculator</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Selling Price per Unit</span>
          <input type="number" min={0.01} step={0.01} value={sellingPrice} onChange={e => setSellingPrice(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Target Profit (pre-tax)</span>
          <input type="number" min={0} step={100} value={targetProfit} onChange={e => setTargetProfit(Number(e.target.value))} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Tax Rate %</span>
          <input type="number" min={0} max={100} step={0.1} value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
        </label>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ color: 'var(--accent)' }}><Roll value={fmt(sellingPrice)} /></b><span className="muted">Selling Price</span></div>
        <div className="stat"><b style={{ color: 'var(--danger)' }}><Roll value={fmt(variablePerUnit)} /></b><span className="muted">Variable Cost/Unit</span></div>
        <div className="stat"><b style={{ color: 'var(--ok)' }}><Roll value={fmt(contributionMargin)} /></b><span className="muted">Contribution Margin</span></div>
        <div className="stat"><b><Roll value={fmt(totalFixed)} /></b><span className="muted">Fixed Costs/Month</span></div>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
          <h4 style={{ margin: '0 0 12px' }}>Break-Even Analysis</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, textAlign: 'center', border: breakEvenUnits === Infinity ? '2px solid var(--danger)' : '2px solid var(--ok)' }}>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Break-Even Units</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: breakEvenUnits === Infinity ? 'var(--danger)' : 'var(--ok)' }}>
                <Roll value={fmtUnits(breakEvenUnits)} />
              </div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Need to sell this many to cover costs</div>
            </div>
            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, textAlign: 'center', border: '2px solid var(--accent)' }}>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Break-Even Revenue</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                <Roll value={fmt(breakEvenRevenue)} />
              </div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Revenue needed to break even</div>
            </div>
            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, textAlign: 'center', border: '2px solid var(--ok)' }}>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Contribution Margin Ratio</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
                <Roll value={contributionMargin > 0 ? ((contributionMargin / sellingPrice) * 100).toFixed(1) : '0'} />%
              </div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>% of each sale covering fixed costs</div>
            </div>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '100ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Target Profit Analysis</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, textAlign: 'center', border: '2px solid var(--accent)' }}>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Units for Target Profit</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                <Roll value={fmtUnits(targetUnits)} />
              </div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Pre-tax profit: ${fmt(targetProfit)}</div>
            </div>
            <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, textAlign: 'center', border: '2px solid var(--ok)' }}>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Target Revenue</div>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
                <Roll value={fmt(targetRevenue)} />
              </div>
              <div className="muted" style={{ fontSize: '0.8rem' }}>Revenue needed for target profit</div>
            </div>
            {taxRate > 0 && (
              <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 4, textAlign: 'center', border: '2px solid var(--danger)' }}>
                <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>After-Tax Units (Tax: {taxRate}%)</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--danger)' }}>
                  <Roll value={fmtUnits(afterTaxUnits)} />
                </div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>Pre-tax profit needed: ${fmt(targetProfit / (1 - taxRate / 100))}</div>
              </div>
            )}
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '200ms' }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Fixed Costs
            <button className="btn" onClick={addFixedCost} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>+ Add</button>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {fixedCosts.map((cost, i) => (
              <div key={cost.id} className="pop-row" style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 50px', gap: 8, padding: 8,
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 30}ms`,
              }}>
                <input type="text" value={cost.name} onChange={e => updateFixedCost(cost.id, 'name', e.target.value)} placeholder="Cost name" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                <input type="number" min={0} step={1} value={cost.amount} onChange={e => updateFixedCost(cost.id, 'amount', Number(e.target.value))} style={{ textAlign: 'right' }} />
                <button className="btn" onClick={() => removeFixedCost(cost.id)} style={{ color: 'var(--danger)', justifySelf: 'end', padding: '2px 8px', fontSize: '0.7rem' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <span className="muted">Total Fixed: </span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: '1.2rem', color: 'var(--danger)' }}>{fmt(totalFixed)}</span>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '300ms' }}>
          <h4 style={{ margin: '0 0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Variable Costs per Unit
            <button className="btn" onClick={addVariableCost} style={{ padding: '4px 12px', fontSize: '0.8rem' }}>+ Add</button>
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {variableCosts.map((cost, i) => (
              <div key={cost.id} className="pop-row" style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 50px', gap: 8, padding: 8,
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
                animationDelay: `${i * 30}ms`,
              }}>
                <input type="text" value={cost.name} onChange={e => updateVariableCost(cost.id, 'name', e.target.value)} placeholder="Cost name" style={{ background: 'transparent', border: 'none', color: 'var(--text)' }} />
                <input type="number" min={0} step={0.01} value={cost.amount} onChange={e => updateVariableCost(cost.id, 'amount', Number(e.target.value))} style={{ textAlign: 'right' }} />
                <button className="btn" onClick={() => removeVariableCost(cost.id)} style={{ color: 'var(--danger)', justifySelf: 'end', padding: '2px 8px', fontSize: '0.7rem' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <span className="muted">Variable/Unit: </span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: '1.2rem', color: 'var(--danger)' }}>{fmt(variablePerUnit)}</span>
          </div>
        </div>

        <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both', animationDelay: '400ms' }}>
          <h4 style={{ margin: '0 0 12px' }}>Sensitivity Analysis</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {[-20, -10, 0, 10, 20].map(pct => {
              const newPrice = sellingPrice * (1 + pct / 100)
              const newMargin = newPrice - variablePerUnit
              const beUnits = newMargin > 0 ? totalFixed / newMargin : Infinity
              return (
                <div key={pct} style={{ padding: 12, background: 'var(--bg)', borderRadius: 4, textAlign: 'center', borderTop: pct === 0 ? '3px solid var(--accent)' : '3px solid transparent' }}>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>Price: {fmt(newPrice)} ({pct >= 0 ? '+' : ''}{pct}%)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--mono)', color: beUnits === Infinity ? 'var(--danger)' : 'var(--accent)' }}>
                    <Roll value={fmtUnits(beUnits)} /> units
                  </div>
                  <div className="muted" style={{ fontSize: '0.75rem' }}>Margin: {fmt(newMargin)}</div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Enter fixed and variable costs, selling price, and target profit. Break-even = Fixed Costs / (Price - Variable Cost). Sensitivity shows how price changes affect break-even.
        </p>
      </div>
    </div>
  )
}