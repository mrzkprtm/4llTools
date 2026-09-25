import { useMemo, useRef, useState, type PointerEvent } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { useReplay } from '../../motion/useReplay'
import { useSettled } from '../../motion/useSettled'
import { CURRENCIES, grow, money, type Currency, type Timing, type YearRow } from './compound'
import './tool.css'

const FREQS = [
  { n: 1, label: 'Yearly' },
  { n: 2, label: 'Every 6 months' },
  { n: 4, label: 'Quarterly' },
  { n: 12, label: 'Monthly' },
  { n: 365, label: 'Daily' },
]

const W = 640
const H = 260
const PAD = { l: 58, r: 12, t: 10, b: 26 }

function Chart({ rows, currency, showReal, animKey }: { rows: YearRow[]; currency: Currency; showReal: boolean; animKey: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const years = rows[rows.length - 1].year || 1
  const max = Math.max(1, ...rows.map((r) => r.balance))
  const x = (y: number) => PAD.l + (y / years) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b)
  const line = (f: (r: YearRow) => number) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.year).toFixed(1)},${y(f(r)).toFixed(1)}`).join(' ')
  const base = `L${x(years).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`
  const contrib = `${line((r) => r.contributed)} ${base}`
  const total = `${line((r) => r.balance)} ${base}`
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const step = Math.max(1, Math.ceil(years / 8))
  const xTicks = rows.filter((r) => Number.isInteger(r.year) && r.year % step === 0)
  const hv = hover !== null ? rows[hover] : rows[rows.length - 1]

  function move(e: PointerEvent<SVGSVGElement>) {
    const box = svg.current!.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const yr = ((px - PAD.l) / (W - PAD.l - PAD.r)) * years
    let best = 0
    rows.forEach((r, i) => { if (Math.abs(r.year - yr) < Math.abs(rows[best].year - yr)) best = i })
    setHover(best)
  }

  return (
    <div className="ci-chart-wrap">
      <svg ref={svg} className="ci-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Growth chart: ${money(hv.balance, currency)} after ${hv.year} years, of which ${money(hv.interest, currency)} is interest.`} onPointerMove={move} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="ci-grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text className="ci-axis" x={PAD.l - 6} y={y(t) + 3} textAnchor="end">{money(t, currency, true)}</text>
          </g>
        ))}
        {xTicks.map((r) => <text key={r.year} className="ci-axis" x={x(r.year)} y={H - 8} textAnchor="middle">{r.year}</text>)}
        <g key={animKey} className="ci-reveal">
          <path className="ci-area-i" d={total} />
          <path className="ci-area-c" d={contrib} />
          {showReal && <path className="ci-line-real" d={line((r) => r.real)} />}
        </g>
        <line className="ci-cursor" x1={0} x2={0} y1={PAD.t} y2={H - PAD.b} style={{ transform: `translateX(${x(hv.year)}px)` }} />
        <circle className="ci-dot" cx={0} cy={0} r={4.5} style={{ transform: `translate(${x(hv.year)}px, ${y(hv.balance)}px)` }} />
      </svg>
      <div className="ci-tip" aria-live="polite">
        <span>Year <b>{hv.year}</b></span>
        <span><i className="ci-key c" />Deposits <b>{money(hv.contributed, currency)}</b></span>
        <span><i className="ci-key i" />Interest <b>{money(hv.interest, currency)}</b></span>
        {showReal && <span><i className="ci-key r" />Today&apos;s money <b>{money(hv.real, currency)}</b></span>}
      </div>
    </div>
  )
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

export default function CompoundInterest() {
  const [currency, setCurrency] = useState<Currency>('IDR')
  const [principal, setPrincipal] = useState('10000000')
  const [monthly, setMonthly] = useState('1000000')
  const [rate, setRate] = useState('6')
  const [years, setYears] = useState('10')
  const [perYear, setPerYear] = useState(12)
  const [timing, setTiming] = useState<Timing>('end')
  const [inflation, setInflation] = useState('3')
  const [showTable, setShowTable] = useState(false)
  const result = useRef<HTMLDivElement>(null)

  const p = num(principal)
  const m = num(monthly) || 0
  const r = num(rate)
  const yrs = num(years)
  const inf = num(inflation) || 0
  const error =
    !(p >= 0) ? 'Enter a starting amount of 0 or more.'
    : m < 0 ? 'Monthly deposit cannot be negative.'
    : !(r > -100 && r <= 1000) ? 'Enter an interest rate between -99 and 1000%.'
    : !(yrs > 0 && yrs <= 100) ? 'Enter a period between 1 month (0.1) and 100 years.'
    : p === 0 && m === 0 ? 'Enter a starting amount or a monthly deposit.'
    : ''
  const rows = useMemo(() => (error ? [] : grow({ principal: p, monthly: m, rate: r, years: yrs, perYear, timing, inflation: inf })), [error, p, m, r, yrs, perYear, timing, inf])
  const end = rows[rows.length - 1]
  const settled = useSettled(`${p}|${m}|${r}|${yrs}|${perYear}|${timing}|${inf}`, 350)
  useReplay(result, settled)
  const f = (n: number) => money(n, currency)
  const csv = rows.map((row) => [row.year, row.contributed.toFixed(2), row.interest.toFixed(2), row.balance.toFixed(2), row.real.toFixed(2)].join(',')).join('\n')

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 0 }}>
        <PillRow label="Currency" style={{ margin: 0 }}>
          {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
            <button key={c} type="button" className={`btn ${currency === c ? 'primary' : ''}`} aria-pressed={currency === c} onClick={() => setCurrency(c)}>{c}</button>
          ))}
        </PillRow>
        <PillRow label="Deposit timing" style={{ margin: 0 }}>
          <button type="button" className={`btn ${timing === 'start' ? 'primary' : ''}`} aria-pressed={timing === 'start'} onClick={() => setTiming('start')}>Deposit at start of month</button>
          <button type="button" className={`btn ${timing === 'end' ? 'primary' : ''}`} aria-pressed={timing === 'end'} onClick={() => setTiming('end')}>At end</button>
        </PillRow>
      </div>
      <div className="ci-inputs">
        <div><label htmlFor="ci-p">Starting amount</label><input id="ci-p" type="number" inputMode="decimal" min={0} value={principal} onChange={(e) => setPrincipal(e.target.value)} /></div>
        <div><label htmlFor="ci-m">Monthly deposit</label><input id="ci-m" type="number" inputMode="decimal" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} /></div>
        <div><label htmlFor="ci-r">Interest / return per year (%)</label><input id="ci-r" type="number" inputMode="decimal" step={0.1} value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        <div><label htmlFor="ci-y">Years</label><input id="ci-y" type="number" inputMode="decimal" min={0.1} max={100} step={1} value={years} onChange={(e) => setYears(e.target.value)} /></div>
        <div>
          <label htmlFor="ci-n">Compounding</label>
          <select id="ci-n" value={perYear} onChange={(e) => setPerYear(Number(e.target.value))}>
            {FREQS.map((q) => <option key={q.n} value={q.n}>{q.label}</option>)}
          </select>
        </div>
        <div><label htmlFor="ci-inf">Inflation per year (%, optional)</label><input id="ci-inf" type="number" inputMode="decimal" min={0} step={0.1} value={inflation} onChange={(e) => setInflation(e.target.value)} /></div>
      </div>

      {error ? (
        <p className="error">{error}</p>
      ) : (
        <div ref={result}>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))' }}>
            <div className="stat"><b><Roll>{f(end.balance)}</Roll></b>Final balance</div>
            <div className="stat"><b><Roll>{f(end.contributed)}</Roll></b>Total deposits</div>
            <div className="stat"><b><Roll>{f(end.interest)}</Roll></b>Interest earned ({end.contributed > 0 ? Math.round((end.interest / end.contributed) * 100) : 0}% on top)</div>
            {inf > 0 && <div className="stat"><b><Roll>{f(end.real)}</Roll></b>In today&apos;s money ({inf}% inflation)</div>}
          </div>
          <Chart rows={rows} currency={currency} showReal={inf > 0} animKey={settled} />
          <div className="row">
            <button type="button" className="btn" aria-expanded={showTable} onClick={() => setShowTable(!showTable)}>{showTable ? 'Hide' : 'Show'} yearly table</button>
            <CopyButton text={`Year,Deposits,Interest,Balance,Real value\n${csv}`} label="Copy as CSV" />
          </div>
          {showTable && (
            <div style={{ overflowX: 'auto' }}>
              <table className="simple">
                <thead><tr><th>Year</th><th>Deposits</th><th>Interest</th><th>Balance</th>{inf > 0 && <th>Today&apos;s money</th>}</tr></thead>
                <tbody>
                  {rows.slice(1).map((row) => (
                    <tr key={row.year}><td>{row.year}</td><td>{f(row.contributed)}</td><td>{f(row.interest)}</td><td><b>{f(row.balance)}</b></td>{inf > 0 && <td>{f(row.real)}</td>}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <p className="muted">
        Interest is added at the chosen compounding frequency and each monthly deposit starts earning from the month it goes in. Returns on stocks or mutual funds (reksa dana) are not fixed, so treat the result as an estimate, not a promise; taxes and fees are not included. Inflation shows what the final amount would buy in today&apos;s money.
      </p>
    </div>
  )
}
