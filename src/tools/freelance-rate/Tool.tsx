import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { Choice, Hint, Slider } from '../../sim/controls'
import { freelanceRate, niceRound } from './logic'
import './tool.css'

const KEY = '4lltools:freelance-rate'

interface Cost {
  id: number
  name: string
  amount: number
  per: 'month' | 'year'
}

interface State {
  currency: 'IDR' | 'USD'
  goal: number
  goalPer: 'month' | 'year'
  costs: Cost[]
  taxPct: number
  savingsPct: number
  vacationWeeks: number
  holidays: number
  sickDays: number
  daysPerWeek: number
  hoursPerDay: number
  billablePct: number
  market: number
  projectHours: number
}

const DEFAULT: State = {
  currency: 'IDR',
  goal: 15_000_000,
  goalPer: 'month',
  costs: [
    { id: 1, name: 'Software and subscriptions', amount: 600_000, per: 'month' },
    { id: 2, name: 'Laptop and equipment', amount: 9_000_000, per: 'year' },
    { id: 3, name: 'Internet and phone', amount: 450_000, per: 'month' },
    { id: 4, name: 'Coworking space', amount: 1_200_000, per: 'month' },
  ],
  taxPct: 10,
  savingsPct: 15,
  vacationWeeks: 3,
  holidays: 17,
  sickDays: 6,
  daysPerWeek: 5,
  hoursPerDay: 8,
  billablePct: 65,
  market: 250_000,
  projectHours: 40,
}

function money(v: number, cur: State['currency']) {
  if (!Number.isFinite(v)) return '—'
  if (cur === 'IDR') return 'Rp ' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return '$' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const PARTS = [
  ['takeHome', 'Take-home', '#2f9e44'],
  ['tax', 'Tax', '#e03131'],
  ['savings', 'Savings & insurance', '#1c7ed6'],
  ['costs', 'Business costs', '#f08c00'],
] as const

export default function FreelanceRate() {
  const [s, setS] = useState<State>(DEFAULT)
  const ready = useRef(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setS({ ...DEFAULT, ...(JSON.parse(raw) as Partial<State>) })
    } catch {
      // Defaults.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      // Storage is optional.
    }
  }, [s])

  const set = <K extends keyof State>(k: K) => (v: State[K]) => setS((p) => ({ ...p, [k]: v }))
  const costsYear = s.costs.reduce((t, c) => t + (c.per === 'month' ? c.amount * 12 : c.amount), 0)
  const r = freelanceRate({ ...s, takeHome: s.goalPer === 'month' ? s.goal * 12 : s.goal, costs: costsYear })
  const step = s.currency === 'IDR' ? 1000 : 1
  const hourly = niceRound(r.hourly, step)
  const m = (v: number) => money(v, s.currency)
  const setCost = (id: number, p: Partial<Cost>) => setS((x) => ({ ...x, costs: x.costs.map((c) => (c.id === id ? { ...c, ...p } : c)) }))

  // Waterfall: each part starts where the previous ended.
  let acc = 0
  const top = Math.max(r.hourly, s.market) || 1
  const steps = PARTS.map(([k, name, color]) => {
    const v = r.perHour[k]
    const from = acc
    acc += v
    return { k, name, color, v, from }
  })
  const diff = s.market > 0 && r.ok ? (s.market / r.hourly - 1) * 100 : NaN

  return (
    <div>
      <div className="fr-cols">
        <div>
          <div className="row fr-top">
            <Choice value={s.currency} options={[['IDR', 'Rupiah'], ['USD', 'Dollar']] as const} onChange={set('currency')} />
          </div>
          <label className="fr-l">Take-home you want
            <span className="fr-inline">
              <input type="number" min={0} step={s.currency === 'IDR' ? 500000 : 100} value={s.goal} onChange={(e) => set('goal')(Math.max(0, Number(e.target.value)))} />
              <select aria-label="Per" value={s.goalPer} onChange={(e) => set('goalPer')(e.target.value as State['goalPer'])}>
                <option value="month">per month</option>
                <option value="year">per year</option>
              </select>
            </span>
          </label>
          <h3 className="fr-h">Business costs <span className="muted">{m(costsYear)}/year</span></h3>
          {s.costs.map((c) => (
            <div key={c.id} className="fr-cost">
              <input type="text" aria-label="Cost name" value={c.name} onChange={(e) => setCost(c.id, { name: e.target.value })} />
              <input type="number" aria-label="Amount" min={0} value={c.amount} onChange={(e) => setCost(c.id, { amount: Math.max(0, Number(e.target.value)) })} />
              <select aria-label="Per" value={c.per} onChange={(e) => setCost(c.id, { per: e.target.value as Cost['per'] })}>
                <option value="month">/mo</option>
                <option value="year">/yr</option>
              </select>
              <button type="button" className="fr-x" aria-label={`Remove ${c.name}`} onClick={() => setS((x) => ({ ...x, costs: x.costs.filter((y) => y.id !== c.id) }))}>×</button>
            </div>
          ))}
          <button type="button" className="btn fr-add" onClick={() => setS((x) => ({ ...x, costs: [...x.costs, { id: Date.now(), name: 'Other', amount: 0, per: 'month' }] }))}>+ Add cost</button>
          <div className="fr-sliders">
            <Slider label="Income tax" value={s.taxPct} min={0} max={40} step={0.5} unit="%" onChange={set('taxPct')} />
            <Slider label="Savings, pension, insurance" value={s.savingsPct} min={0} max={40} unit="%" onChange={set('savingsPct')} />
            <Slider label="Vacation" value={s.vacationWeeks} min={0} max={10} unit=" wk" onChange={set('vacationWeeks')} />
            <Slider label="Public holidays" value={s.holidays} min={0} max={30} unit=" days" onChange={set('holidays')} />
            <Slider label="Sick days" value={s.sickDays} min={0} max={30} unit=" days" onChange={set('sickDays')} />
            <Slider label="Work days per week" value={s.daysPerWeek} min={1} max={7} onChange={set('daysPerWeek')} />
            <Slider label="Hours per day" value={s.hoursPerDay} min={1} max={12} step={0.5} unit=" h" onChange={set('hoursPerDay')} />
            <Slider label="Billable share of your time" value={s.billablePct} min={10} max={100} unit="%" onChange={set('billablePct')} />
          </div>
        </div>

        <div className="fr-out">
          <div className="fr-big">
            <small>Your minimum hourly rate</small>
            <b><Roll>{r.ok ? m(hourly) : '—'}</Roll></b>
          </div>
          <div className="stats fr-stats">
            <div className="stat"><b><Roll>{r.ok ? m(niceRound(r.daily, step * 10)) : '—'}</Roll></b>day rate ({s.hoursPerDay} h)</div>
            <div className="stat"><b><Roll>{r.ok ? m(niceRound(hourly * s.projectHours, step * 10)) : '—'}</Roll></b>
              project of <input className="fr-ph" type="number" min={1} aria-label="Project hours" value={s.projectHours} onChange={(e) => set('projectHours')(Math.max(1, Number(e.target.value)))} /> h
            </div>
            <div className="stat"><b><Roll>{String(Math.round(r.billableHours))}</Roll></b>billable hours / year</div>
            <div className="stat"><b><Roll>{m(r.revenue / 12)}</Roll></b>revenue needed / month</div>
          </div>
          {!r.ok && <p className="error">Tax plus savings must be under 100%, and you need some billable hours.</p>}

          <h3 className="fr-h">How one hour is built</h3>
          <div className="fr-fall" role="img" aria-label={steps.map((x) => `${x.name} ${m(x.v)}`).join(', ')}>
            {steps.map((x, i) => (
              <div key={x.k} className="fr-col">
                <div className="fr-bar" style={{ bottom: `${(x.from / top) * 100}%`, height: `${(Math.max(0, x.v) / top) * 100}%`, background: x.color, transitionDelay: `${i * 60}ms` }} />
                <span className="fr-cap">{x.name}<br /><b>{m(x.v)}</b></span>
              </div>
            ))}
            <div className="fr-col">
              <div className="fr-bar total" style={{ bottom: 0, height: `${(r.ok ? r.hourly / top : 0) * 100}%` }} />
              <span className="fr-cap">Rate<br /><b>{m(r.hourly)}</b></span>
            </div>
            {s.market > 0 && <div className="fr-plot"><div className="fr-market" style={{ bottom: `${(s.market / top) * 100}%` }}><span>market {m(s.market)}</span></div></div>}
          </div>

          <label className="fr-l">Market rate for your work (per hour)
            <input type="number" min={0} step={s.currency === 'IDR' ? 10000 : 5} value={s.market} onChange={(e) => set('market')(Math.max(0, Number(e.target.value)))} />
          </label>
          {Number.isFinite(diff) && (
            <p className={`fr-verdict ${diff >= 0 ? 'ok' : 'error'}`} key={Math.sign(diff)}>
              {diff >= 0 ? `The market pays ${Math.round(diff)}% more than you need. You have room to charge more.` : `The market pays ${Math.round(-diff)}% less than you need. Cut costs, bill more hours, or find better-paying clients.`}
            </p>
          )}
        </div>
      </div>
      <Hint>Set what you want to take home and what your business costs; the rate updates as you type. The waterfall shows what each billed hour pays for.</Hint>
    </div>
  )
}
