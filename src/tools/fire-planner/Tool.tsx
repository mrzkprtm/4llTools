import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface SimulationPoint {
  age: number
  portfolio: number
  contributions: number
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

function runMonteCarlo(
  currentAge: number,
  retirementAge: number,
  currentPortfolio: number,
  monthlyContribution: number,
  expectedReturn: number,
  volatility: number,
  simulations: number = 200
): SimulationPoint[][] {
  const years = retirementAge - currentAge
  const allPaths: SimulationPoint[][] = []

  for (let s = 0; s < simulations; s++) {
    const path: SimulationPoint[] = []
    let portfolio = currentPortfolio
    for (let y = 0; y <= years; y++) {
      const age = currentAge + y
      const annualReturn = expectedReturn + (Math.random() - 0.5) * volatility * 2
      portfolio = portfolio * (1 + annualReturn) + monthlyContribution * 12
      path.push({ age, portfolio: Math.max(0, portfolio), contributions: currentPortfolio + monthlyContribution * 12 * y })
    }
    allPaths.push(path)
  }
  return allPaths
}

export default function FirePlanner() {
  const [currentAge, setCurrentAge] = useState(30)
  const [retirementAge, setRetirementAge] = useState(55)
  const [currentPortfolio, setCurrentPortfolio] = useState(50000)
  const [monthlyContribution, setMonthlyContribution] = useState(2000)
  const [expectedReturn, setExpectedReturn] = useState(7)
  const [volatility, setVolatility] = useState(15)
  const [withdrawalRate, setWithdrawalRate] = useState(4)
  const [simulations, setSimulations] = useState(() => runMonteCarlo(30, 55, 50000, 2000, 0.07, 0.15))

  useEffect(() => {
    setSimulations(runMonteCarlo(currentAge, retirementAge, currentPortfolio, monthlyContribution, expectedReturn / 100, volatility / 100))
  }, [currentAge, retirementAge, currentPortfolio, monthlyContribution, expectedReturn, volatility])

  const years = retirementAge - currentAge
  const finalPortfolios = simulations.map(p => p[p.length - 1].portfolio)
  const medianFinal = finalPortfolios.sort((a, b) => a - b)[Math.floor(finalPortfolios.length / 2)]
  const fireNumber = medianFinal
  const safeWithdrawal = fireNumber * withdrawalRate / 100
  const yearsToFire = currentPortfolio >= fireNumber ? 0 : Math.ceil(Math.log(fireNumber / currentPortfolio) / Math.log(1 + expectedReturn / 100 + monthlyContribution * 12 / currentPortfolio))

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Current Age</label>
          <input type="number" min={18} max={80} value={currentAge} onChange={e => setCurrentAge(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Target Retirement Age</label>
          <input type="number" min={currentAge + 1} max={80} value={retirementAge} onChange={e => setRetirementAge(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Current Portfolio $</label>
          <input type="number" min={0} step={1000} value={currentPortfolio} onChange={e => setCurrentPortfolio(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Monthly Contribution $</label>
          <input type="number" min={0} step={100} value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Expected Return %/yr</label>
          <input type="number" min={0} max={20} step={0.5} value={expectedReturn} onChange={e => setExpectedReturn(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Volatility %</label>
          <input type="number" min={0} max={50} step={1} value={volatility} onChange={e => setVolatility(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Withdrawal Rate %</label>
          <input type="number" min={2} max={8} step={0.1} value={withdrawalRate} onChange={e => setWithdrawalRate(Number(e.target.value))} />
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b><Roll>{formatCurrency(fireNumber)}</Roll></b><span className="muted">FIRE Number</span></div>
        <div className="stat"><b><Roll>{formatCurrency(safeWithdrawal)}</Roll></b><span className="muted">Safe Withdrawal/yr</span></div>
        <div className="stat"><b><Roll>{yearsToFire}</Roll></b><span className="muted">Years to FIRE</span></div>
        <div className="stat"><b><Roll>{retirementAge}</Roll></b><span className="muted">Retirement Age</span></div>
      </div>

      <div style={{ position: 'relative', height: 300, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
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
            const maxPortfolio = Math.max(...simulations.flatMap(p => p.map(d => d.portfolio)))
            const minAge = simulations[0][0].age
            const maxAge = simulations[0][simulations[0].length - 1].age

            // Draw Monte Carlo fan (percentile bands)
            const percentiles = [10, 25, 50, 75, 90]
            const percentileData = percentiles.map(pct => {
              const vals: number[] = []
              for (let y = 0; y <= years; y++) {
                const sorted = simulations.map(s => s[y].portfolio).sort((a, b) => a - b)
                vals.push(sorted[Math.floor(sorted.length * pct / 100)])
              }
              return vals
            })

            // Draw fan areas
            const colors = [
              'rgba(225, 29, 72, 0.08)', // 10-90
              'rgba(249, 115, 22, 0.12)', // 25-75
              'rgba(132, 204, 22, 0.18)', // 50
            ]

            percentileData.forEach((vals, idx) => {
              if (idx >= 3) return // Only draw 10-90, 25-75, 50
              const other = percentileData[percentiles.length - 1 - idx]
              ctx.fillStyle = colors[idx]
              ctx.beginPath()
              vals.forEach((v, y) => {
                const x = (y / years) * (w - 40) + 20
                const yPos = h - 20 - (v / maxPortfolio) * (h - 60)
                if (y === 0) ctx.moveTo(x, yPos)
                else ctx.lineTo(x, yPos)
              })
              other.slice().reverse().forEach((v, y) => {
                const x = ((years - y) / years) * (w - 40) + 20
                const yPos = h - 20 - (v / maxPortfolio) * (h - 60)
                ctx.lineTo(x, yPos)
              })
              ctx.closePath()
              ctx.fill()
            })

            // Draw median line
            ctx.strokeStyle = '#84cc16'
            ctx.lineWidth = 3
            ctx.beginPath()
            percentileData[2].forEach((v, y) => {
              const x = (y / years) * (w - 40) + 20
              const yPos = h - 20 - (v / maxPortfolio) * (h - 60)
              if (y === 0) ctx.moveTo(x, yPos)
              else ctx.lineTo(x, yPos)
            })
            ctx.stroke()

            // Draw contributions line
            ctx.strokeStyle = 'var(--accent)'
            ctx.lineWidth = 2
            ctx.setLineDash([5, 5])
            ctx.beginPath()
            simulations[0].forEach((d, y) => {
              const x = (y / years) * (w - 40) + 20
              const yPos = h - 20 - (d.contributions / maxPortfolio) * (h - 60)
              if (y === 0) ctx.moveTo(x, yPos)
              else ctx.lineTo(x, yPos)
            })
            ctx.stroke()
            ctx.setLineDash([])

            // Axes
            ctx.strokeStyle = 'var(--border)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(20, 20)
            ctx.lineTo(20, h - 20)
            ctx.lineTo(w - 20, h - 20)
            ctx.stroke()

            // Labels
            ctx.fillStyle = 'var(--muted)'
            ctx.font = '11px var(--mono)'
            ctx.textAlign = 'center'
            for (let y = 0; y <= 4; y++) {
              const val = (maxPortfolio * y / 4)
              const yPos = h - 20 - (y / 4) * (h - 40)
              ctx.fillText(formatCurrency(val), 12, yPos + 4)
            }
            for (let y = 0; y <= years; y += Math.max(1, Math.floor(years / 5))) {
              const x = (y / years) * (w - 40) + 20
              ctx.fillText(String(minAge + y), x, h - 8)
            }
          }}
        />
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="muted" style={{ fontSize: '0.85rem' }}>Portfolio at Retirement</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700 }}><Roll>{formatCurrency(medianFinal)}</Roll></div>
        </div>
        <div style={{ padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="muted" style={{ fontSize: '0.85rem' }}>Monthly Income (4% Rule)</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ok)' }}><Roll>{formatCurrency(safeWithdrawal / 12)}</Roll></div>
        </div>
        <div style={{ padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="muted" style={{ fontSize: '0.85rem' }}>Success Rate (≥$0)</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--ok)' }}><Roll>{Math.round(simulations.filter(s => s[s.length - 1].portfolio > 0).length / simulations.length * 100)}</Roll>%</div>
        </div>
      </div>

      <Hint>Portfolio "mountain" grows with Monte Carlo fan (10-90, 25-75, 50th percentiles). Dashed line = contributions only. Adjust return/volatility to see risk.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}