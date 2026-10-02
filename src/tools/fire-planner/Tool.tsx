import { useState, useEffect } from 'react'
import Roll from '../../motion/Roll'

interface SimulationPoint {
  age: number
  portfolio: number
  contributions: number
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

/** Small seeded PRNG so the same inputs always give the same simulation (and prerender matches the client). */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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
  const years = Math.max(1, retirementAge - currentAge)
  const allPaths: SimulationPoint[][] = []
  const random = mulberry32(12345)

  for (let s = 0; s < simulations; s++) {
    const path: SimulationPoint[] = []
    let portfolio = currentPortfolio
    for (let y = 0; y <= years; y++) {
      // Year 0 is today's portfolio; each later year adds a random return plus a year of contributions
      if (y > 0) {
        const annualReturn = expectedReturn + (random() - 0.5) * volatility * 2
        portfolio = Math.max(0, portfolio * (1 + annualReturn) + monthlyContribution * 12)
      }
      path.push({ age: currentAge + y, portfolio, contributions: currentPortfolio + monthlyContribution * 12 * y })
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

  const years = simulations[0].length - 1
  const finalPortfolios = simulations.map(p => p[p.length - 1].portfolio)
  const medianFinal = finalPortfolios.sort((a, b) => a - b)[Math.floor(finalPortfolios.length / 2)]
  const fireNumber = medianFinal
  const safeWithdrawal = fireNumber * withdrawalRate / 100
  const yearsToFire = currentPortfolio >= fireNumber ? 0 : currentPortfolio <= 0 ? years : Math.ceil(Math.log(fireNumber / currentPortfolio) / Math.log(1 + expectedReturn / 100 + monthlyContribution * 12 / currentPortfolio))

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
            const css = getComputedStyle(canvas)
            const cssVar = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
            const maxPortfolio = Math.max(1, ...simulations.flatMap(p => p.map(d => d.portfolio)))
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
            ctx.strokeStyle = cssVar('--accent', '#e11d48')
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
            ctx.strokeStyle = cssVar('--border', '#ccc')
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(20, 20)
            ctx.lineTo(20, h - 20)
            ctx.lineTo(w - 20, h - 20)
            ctx.stroke()

            // Labels
            ctx.fillStyle = cssVar('--muted', '#888')
            ctx.font = `11px ${cssVar('--mono', 'monospace')}`
            ctx.textAlign = 'left'
            for (let y = 1; y <= 4; y++) {
              const val = (maxPortfolio * y / 4)
              const yPos = h - 20 - (y / 4) * (h - 60)
              ctx.fillText(formatCurrency(val), 24, yPos - 4)
            }
            ctx.textAlign = 'center'
            const step = Math.max(1, Math.floor(years / 5))
            for (let y = 0; y <= years; y += step) {
              if (years - y < step / 2 && y !== years) continue
              const x = (y / years) * (w - 40) + 20
              ctx.fillText(String(minAge + y), x, h - 6)
            }
            if (years % step !== 0) ctx.fillText(String(maxAge), w - 20, h - 6)
          }}
        />
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="muted" style={{ fontSize: '0.85rem' }}>Portfolio at Retirement</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700 }}><Roll>{formatCurrency(medianFinal)}</Roll></div>
        </div>
        <div style={{ padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div className="muted" style={{ fontSize: '0.85rem' }}>Monthly Income ({withdrawalRate}% Rule)</div>
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