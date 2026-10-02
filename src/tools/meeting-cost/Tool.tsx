import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { Choice, Hint, Select } from '../../sim/controls'
import CoinPile from './CoinPile'
import { coinValue, comparisons, costPerSecond, CURRENCIES, HOURS_PER_MONTH, money, PILE_CAPACITY, type Currency, type Group, type PayMode } from './logic'
import './tool.css'

const KEY = '4lltools:meeting-cost'
const uid = () => Math.random().toString(36).slice(2, 9)

interface Setup {
  groups: Group[]
  mode: PayMode
  currency: Currency
  hours: number
}

const DEFAULT: Setup = {
  mode: 'monthly',
  currency: 'IDR',
  hours: HOURS_PER_MONTH,
  groups: [
    { id: 'a', role: 'Manager', count: 1, pay: 25_000_000 },
    { id: 'b', role: 'Engineer', count: 4, pay: 15_000_000 },
    { id: 'c', role: 'Designer', count: 1, pay: 12_000_000 },
    { id: 'd', role: 'Intern', count: 1, pay: 4_500_000 },
  ],
}

const clock = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor(s / 60) % 60
  const sec = Math.floor(s % 60)
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function MeetingCost() {
  const [setup, setSetup] = useState<Setup>(DEFAULT)
  const [running, setRunning] = useState(false)
  const [acc, setAcc] = useState(0) // seconds before the current run
  const [since, setSince] = useState(0) // start of the current run (ms)
  const [now, setNow] = useState(0)
  const ready = useRef(false)
  const list = useRef<HTMLDivElement>(null)
  useFlip(list)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setSetup({ ...DEFAULT, ...(JSON.parse(raw) as Partial<Setup>) })
    } catch {
      // Keep the defaults.
    }
    ready.current = true
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(setup))
    } catch {
      // Storage is optional.
    }
  }, [setup])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [running])

  const elapsed = acc + (running ? Math.max(0, now - since) / 1000 : 0)
  const rate = costPerSecond(setup.groups, setup.mode, setup.hours)
  const cost = rate * elapsed
  const cur = CURRENCIES[setup.currency]
  const perMin = rate * 60
  const coin = coinValue(perMin, cost, PILE_CAPACITY)
  const people = setup.groups.reduce((n, g) => n + Math.max(0, g.count), 0)

  function toggle() {
    if (running) {
      setAcc(elapsed)
      setRunning(false)
    } else {
      const t = Date.now()
      setSince(t)
      setNow(t)
      setRunning(true)
    }
  }

  const patch = (p: Partial<Setup>) => setSetup((s) => ({ ...s, ...p }))
  const setGroup = (id: string, p: Partial<Group>) => patch({ groups: setup.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) })

  return (
    <div className="mc">
      <div className={`mc-meter ${running ? 'live' : ''}`}>
        <span className="mc-cap">This meeting has cost</span>
        <div className="mc-big">
          <Roll>{money(cost, setup.currency)}</Roll>
        </div>
        <span className="mc-sub">
          {clock(elapsed)} · {people} people · {money(perMin, setup.currency)}/min
        </span>
        <CoinPile count={Math.floor(cost / coin)} label={`A pile of ${Math.floor(cost / coin)} coins`} />
        <span className="mc-coin">Each coin ≈ {money(coin, setup.currency)}</span>
      </div>

      <div className="row mc-controls">
        <button type="button" className="btn primary btn-icon mc-go" onClick={toggle}>
          <Icon key={running ? 'p' : 's'} name={running ? 'pause-circle' : 'play-circle'} size={20} />
          {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start meeting'}
        </button>
        <button type="button" className="btn btn-icon" onClick={() => { setRunning(false); setAcc(0); setNow(0) }} disabled={!elapsed}>
          <Icon name="reload" size={18} /> Reset
        </button>
      </div>

      <div className="mc-compare" aria-live="off">
        {comparisons(cost, setup.currency).map((c) => (
          <div key={c.name} className="mc-thing">
            <span className="mc-emoji" aria-hidden="true">{c.emoji}</span>
            <b>
              <Roll>{c.n < 10 ? c.n.toFixed(1) : Math.floor(c.n).toLocaleString('en-US')}</Roll>
            </b>
            <span>{c.name}</span>
          </div>
        ))}
      </div>

      <h3 className="mc-h">Who is in the room</h3>
      <div className="mc-settings">
        <Choice label="Salary is" value={setup.mode} options={[['monthly', 'Monthly'], ['hourly', 'Hourly']]} onChange={(mode) => patch({ mode })} />
        <Select label="Currency" value={setup.currency} options={(Object.keys(CURRENCIES) as Currency[]).map((c) => [c, `${c} (${CURRENCIES[c].symbol})`] as const)} onChange={(currency) => patch({ currency })} />
        {setup.mode === 'monthly' && (
          <label className="mc-hours">
            Working hours / month
            <input type="number" min={1} max={400} value={setup.hours} onChange={(e) => patch({ hours: Math.max(1, Number(e.target.value) || HOURS_PER_MONTH) })} />
          </label>
        )}
      </div>
      <div ref={list} className="mc-groups">
        <div className="mc-row mc-head" aria-hidden="true"><span>Role</span><span>People</span><span>{setup.mode === 'monthly' ? 'Monthly' : 'Hourly'} pay ({cur.symbol})</span><span /></div>
        {setup.groups.map((g) => (
          <div key={g.id} data-flip={g.id} className="mc-row">
            <input type="text" aria-label="Role" value={g.role} onChange={(e) => setGroup(g.id, { role: e.target.value })} />
            <span className="mc-count">
              <button type="button" className="btn" aria-label={`Fewer ${g.role}`} onClick={() => setGroup(g.id, { count: Math.max(0, g.count - 1) })}>−</button>
              <b>{g.count}</b>
              <button type="button" className="btn" aria-label={`More ${g.role}`} onClick={() => setGroup(g.id, { count: g.count + 1 })}>+</button>
            </span>
            <input type="number" min={0} aria-label={`${g.role} pay`} value={g.pay} onChange={(e) => setGroup(g.id, { pay: Math.max(0, Number(e.target.value) || 0) })} />
            <button type="button" className="btn mc-x" aria-label={`Remove ${g.role}`} onClick={() => patch({ groups: setup.groups.filter((x) => x.id !== g.id) })}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn btn-icon" onClick={() => patch({ groups: [...setup.groups, { id: uid(), role: 'Guest', count: 1, pay: setup.mode === 'monthly' ? 10_000_000 : 60_000 }] })}>
          <Icon name="plus" size={18} /> Add role
        </button>
        <span className="muted mc-est">A 1-hour meeting like this costs about <b>{money(rate * 3600, setup.currency)}</b>.</span>
      </div>
      <Hint>Enter each role’s headcount and pay, then press Start when the meeting begins. Monthly pay is divided by {setup.hours} working hours; comparison prices are rough Jakarta prices.</Hint>
    </div>
  )
}
