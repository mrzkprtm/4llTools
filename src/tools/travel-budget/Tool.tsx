import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Choice, Hint, Legend, Slider, Toggle } from '../../sim/controls'
import Roll from '../../motion/Roll'
import { PALETTE } from '../../sim/theme'
import { budget, CAT_LABEL, CATS, resizeDays, type Basis, type Cat, type DayCosts, type OneOff } from './logic'
import './tool.css'

const KEY = '4lltools:travel-budget'
const CURRENCIES = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'AUD', 'THB', 'SAR'] as const
const COLOR: Record<Cat, string> = { stay: PALETTE[1], food: PALETTE[0], transport: PALETTE[3], activities: PALETTE[2], shopping: PALETTE[4], misc: PALETTE[7] }

interface State {
  currency: string
  travelers: number
  basis: Basis
  same: boolean
  template: DayCosts
  days: DayCosts[]
  oneOffs: OneOff[]
}

const TEMPLATE: DayCosts = { stay: 600000, food: 350000, transport: 200000, activities: 250000, shopping: 100000, misc: 50000 }
const DEFAULTS: State = {
  currency: 'IDR',
  travelers: 2,
  basis: 'group',
  same: false,
  template: TEMPLATE,
  days: [
    { ...TEMPLATE, activities: 0, shopping: 0, transport: 350000 },
    { ...TEMPLATE, activities: 500000 },
    TEMPLATE,
    { ...TEMPLATE, shopping: 600000 },
    { ...TEMPLATE, stay: 0, activities: 0, transport: 350000 },
  ],
  oneOffs: [
    { id: 'o1', name: 'Flights', amount: 3600000 },
    { id: 'o2', name: 'Travel insurance', amount: 300000 },
  ],
}

export default function TravelBudget() {
  const [s, setS] = useState<State>(DEFAULTS)
  const [sel, setSel] = useState(0)
  const ready = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setS({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<State>) })
    } catch {
      // Storage is optional.
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

  const days = s.same ? s.days.map(() => s.template) : s.days
  const r = useMemo(() => budget({ days, oneOffs: s.oneOffs, travelers: s.travelers, basis: s.basis }), [days, s.oneOffs, s.travelers, s.basis])
  const money = useMemo(() => {
    try {
      const f = new Intl.NumberFormat('en-US', { style: 'currency', currency: s.currency, maximumFractionDigits: s.currency === 'IDR' || s.currency === 'JPY' ? 0 : 2 })
      return (n: number) => f.format(n)
    } catch {
      return (n: number) => `${s.currency} ${Math.round(n)}`
    }
  }, [s.currency])
  const max = Math.max(1, ...r.dayTotals)
  const day = Math.min(sel, days.length - 1)
  const editing = s.same ? s.template : days[day]
  const k = s.basis === 'person' ? s.travelers : 1

  function setCost(c: Cat, v: string) {
    const n = Math.max(0, Number(v) || 0)
    if (s.same) setS({ ...s, template: { ...s.template, [c]: n } })
    else setS({ ...s, days: s.days.map((d, i) => (i === day ? { ...d, [c]: n } : d)) })
  }

  return (
    <div>
      <div className="tb-top">
        <Slider label="Trip days" value={days.length} min={1} max={30} onChange={(n) => setS({ ...s, days: resizeDays(s.days, n) })} />
        <Slider label="Travelers" value={s.travelers} min={1} max={12} onChange={(n) => setS({ ...s, travelers: n })} />
        <div className="sim-field">
          <label className="sim-label" htmlFor="tb-cur">Currency</label>
          <select id="tb-cur" value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="row">
        <Choice value={s.basis} options={[['group', 'Amounts for the group'], ['person', 'Per person']]} onChange={(b) => setS({ ...s, basis: b })} />
        <Toggle label="Same every day" checked={s.same} onChange={(v) => setS(v ? { ...s, same: true, template: days[day] } : { ...s, same: false, days: s.days.map(() => ({ ...s.template })) })} />
      </div>

      <div className="stats tb-stats">
        <div className="stat tb-total"><b><Roll>{money(r.total)}</Roll></b>Total trip budget</div>
        <div className="stat"><b><Roll>{money(r.perPerson)}</Roll></b>Per person ({s.travelers})</div>
        <div className="stat"><b>{money(r.avgPerDay)}</b>Average per day</div>
        <div className="stat"><b>{money(r.oneOff)}</b>One-off costs</div>
      </div>

      <div className="tb-chart" role="group" aria-label="Daily costs, tap a day to edit">
        {r.dayTotals.map((t, i) => (
          <button key={i} type="button" className={`tb-col ${i === day && !s.same ? 'sel' : ''}`} style={{ '--i': i } as CSSProperties} onClick={() => { setSel(i); if (s.same) setS({ ...s, same: false, days: s.days.map(() => ({ ...s.template })) }) }} aria-label={`Day ${i + 1}: ${money(t)}`}>
            <span className="tb-stack" style={{ height: `calc(${(t / max).toFixed(4)} * (100% - 20px))` }}>
              {CATS.map((c) => {
                const v = Math.max(0, days[i][c] || 0) * k
                return v > 0 ? <i key={c} style={{ flexGrow: v, background: COLOR[c] }} /> : null
              })}
            </span>
            <small>{i + 1}</small>
          </button>
        ))}
      </div>
      <Legend items={CATS.map((c) => [COLOR[c], `${CAT_LABEL[c]} ${r.daily ? Math.round((r.byCat[c] / r.daily) * 100) : 0}%`] as const)} />

      <div className="tb-edit">
        <h3>{s.same ? 'Every day' : `Day ${day + 1}`} <span className="muted">{money(r.dayTotals[day] ?? 0)}</span></h3>
        <div className="tb-fields">
          {CATS.map((c) => (
            <label key={c} className="tb-field">
              <span><i style={{ background: COLOR[c] }} />{CAT_LABEL[c]}</span>
              <input type="number" inputMode="decimal" min={0} value={editing[c]} onChange={(e) => setCost(c, e.target.value)} />
            </label>
          ))}
        </div>
        {!s.same && days.length > 1 && (
          <div className="row">
            <button type="button" className="btn" disabled={day === 0} onClick={() => setSel(day - 1)}>← Prev day</button>
            <button type="button" className="btn" disabled={day >= days.length - 1} onClick={() => setSel(day + 1)}>Next day →</button>
            <button type="button" className="btn" onClick={() => setS({ ...s, days: s.days.map(() => ({ ...days[day] })) })}>Copy to all days</button>
          </div>
        )}
      </div>

      <div className="tb-edit">
        <h3>One-off costs <span className="muted">flights, visa, insurance</span></h3>
        {s.oneOffs.map((o) => (
          <div key={o.id} className="tb-oneoff settle-in">
            <input type="text" aria-label="Cost name" value={o.name} onChange={(e) => setS({ ...s, oneOffs: s.oneOffs.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)) })} />
            <input type="number" inputMode="decimal" min={0} aria-label={`${o.name} amount`} value={o.amount} onChange={(e) => setS({ ...s, oneOffs: s.oneOffs.map((x) => (x.id === o.id ? { ...x, amount: Math.max(0, Number(e.target.value) || 0) } : x)) })} />
            <button type="button" className="tb-x" aria-label={`Remove ${o.name}`} onClick={() => setS({ ...s, oneOffs: s.oneOffs.filter((x) => x.id !== o.id) })}>×</button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setS({ ...s, oneOffs: [...s.oneOffs, { id: `o${Date.now().toString(36)}`, name: 'Visa', amount: 0 }] })}>+ Add one-off cost</button>
      </div>
      <Hint>Set days and travelers, then tap a day&apos;s bar to edit what you expect to spend, or switch on &quot;Same every day&quot;. Amounts are in the chosen currency (no conversion) and your plan is saved on this device.</Hint>
    </div>
  )
}
