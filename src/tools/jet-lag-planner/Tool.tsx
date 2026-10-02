import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Hint, Legend, Slider } from '../../sim/controls'
import { hhmm, makePlan, pieces, tzOffset, type PlanDay, type Span } from './logic'
import './tool.css'

const FALLBACK_ZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Bangkok', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'Europe/London', 'Europe/Paris', 'Europe/Amsterdam', 'Europe/Istanbul', 'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Sao_Paulo', 'Africa/Cairo', 'UTC']

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function zoneLabel(tz: string, at: number) {
  const off = tzOffset(tz, at)
  const sign = off < 0 ? '−' : '+'
  const a = Math.abs(off)
  const city = tz.split('/').pop()!.replace(/_/g, ' ')
  return `${city} (UTC${sign}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''})`
}

function Block({ span, cls, label }: { span: Span; cls: string; label?: string }) {
  return (
    <>
      {pieces(span).map(([a, b], i) => (
        <span key={i} className={`jl-blk ${cls}`} style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }}>
          {i === 0 && label && b - a > 150 ? label : null}
        </span>
      ))}
    </>
  )
}

function Row({ day, i, open, onOpen, city }: { day: PlanDay; i: number; open: boolean; onOpen: () => void; city: string }) {
  const nice = new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  return (
    <li className={`jl-row ${open ? 'open' : ''} ${day.offset === 0 ? 'fly' : ''}`} style={{ '--i': i } as CSSProperties}>
      <button type="button" className="jl-head" onClick={onOpen} aria-expanded={open}>
        <b>{day.label}</b>
        <span className="muted">{nice} · {city} time</span>
      </button>
      <div className="jl-track" aria-label={`${day.label}: sleep ${hhmm(day.sleep)} to ${hhmm(day.wake)}`} role="img">
        {[6, 12, 18].map((h) => <i key={h} className="jl-tick" style={{ left: `${(h / 24) * 100}%` }} />)}
        {day.avoid && <Block span={day.avoid} cls="avoid" />}
        {day.seek && <Block span={day.seek} cls="seek" label="light" />}
        <Block span={[day.sleep, day.wake]} cls="sleep" label={`${hhmm(day.sleep)}–${hhmm(day.wake)}`} />
        {day.flight && <Block span={day.flight} cls="flight" label="✈ flight" />}
      </div>
      {open && (
        <ul className="jl-tips settle-in">
          <li>Sleep <b>{hhmm(day.sleep)}</b>, wake <b>{hhmm(day.wake)}</b> ({city} time).</li>
          {day.seek && <li>Seek bright light or go outside <b>{hhmm(day.seek[0])}–{hhmm(day.seek[1])}</b>.</li>}
          {day.avoid && <li>Avoid bright light (dim screens, sunglasses) <b>{hhmm(day.avoid[0])}–{hhmm(day.avoid[1])}</b>.</li>}
          {!day.seek && <li>Your body clock should be on local time now. Keep regular meals and daylight.</li>}
          {day.flight && <li>On the plane, sleep when it is night at your destination and drink water; go easy on caffeine and alcohol.</li>}
        </ul>
      )}
    </li>
  )
}

export default function JetLagPlanner() {
  const zones = useMemo(() => {
    try {
      const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone')
      return all && all.length ? all : FALLBACK_ZONES
    } catch {
      return FALLBACK_ZONES
    }
  }, [])
  const [origin, setOrigin] = useState('Asia/Jakarta')
  const [dest, setDest] = useState('Europe/London')
  const [depart, setDepart] = useState('2026-10-03T21:30')
  const [hours, setHours] = useState(16)
  const [sleep, setSleep] = useState('23:00')
  const [wake, setWake] = useState('07:00')
  const [open, setOpen] = useState(3)

  // Default to a flight one week from today (set after mount so prerendered HTML matches).
  useEffect(() => {
    const d = new Date(Date.now() + 7 * 86_400_000)
    setDepart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T21:30`)
  }, [])

  const plan = useMemo(() => makePlan({ origin, dest, depart, flightHours: hours, sleep: toMin(sleep), wake: toMin(wake) }), [origin, dest, depart, hours, sleep, wake])
  const valid = Number.isFinite(plan.departUtc)
  const at = valid ? plan.departUtc : Date.now()
  const day = Math.floor(at / 86_400_000)
  const options = useMemo(() => zones.map((z) => <option key={z} value={z}>{zoneLabel(z, day * 86_400_000)}</option>), [zones, day])
  const cityOf = (tz: string) => tz.split('/').pop()!.replace(/_/g, ' ')
  const arrive = valid ? new Date(plan.arriveUtc).toLocaleString('en-US', { timeZone: dest, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '—'
  const diffH = Math.abs(plan.diff)

  return (
    <div>
      <div className="jl-grid">
        <div>
          <label htmlFor="jl-o">From</label>
          <select id="jl-o" value={origin} onChange={(e) => setOrigin(e.target.value)}>
            {options}
          </select>
        </div>
        <div>
          <label htmlFor="jl-d">To</label>
          <select id="jl-d" value={dest} onChange={(e) => setDest(e.target.value)}>
            {options}
          </select>
        </div>
        <div>
          <label htmlFor="jl-t">Departure ({cityOf(origin)} time)</label>
          <input id="jl-t" type="datetime-local" value={depart} onChange={(e) => setDepart(e.target.value)} />
        </div>
        <div className="jl-times">
          <div><label htmlFor="jl-s">Usual bedtime</label><input id="jl-s" type="time" value={sleep} onChange={(e) => setSleep(e.target.value)} /></div>
          <div><label htmlFor="jl-w">Usual wake</label><input id="jl-w" type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></div>
        </div>
      </div>
      <div className="jl-slider">
        <Slider label="Flight duration (incl. stops)" value={hours} min={1} max={30} step={0.5} unit=" h" onChange={setHours} />
      </div>

      {!valid ? (
        <p className="error">Enter a departure date and time.</p>
      ) : (
        <>
          <p key={`${plan.direction}${diffH}`} className="jl-summary pop">
            {plan.direction === 'none' ? (
              <>Same clock time at both ends, so there is no jet lag to plan for. Just rest on the flight.</>
            ) : (
              <>
                Flying <b>{plan.direction}</b> across <b>{diffH} h</b>. {plan.direction === 'east' ? 'Go to bed earlier' : 'Stay up later'} by about an hour a day before you leave, then follow local time. You land {arrive} {cityOf(dest)} time.
              </>
            )}
          </p>
          <div className="jl-axis" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
          <ol className="jl-rows">
            {plan.days.map((d, i) => <Row key={d.offset} day={d} i={i} open={open === i} onOpen={() => setOpen(open === i ? -1 : i)} city={cityOf(d.tz)} />)}
          </ol>
          <Legend items={[['#5c7cfa', 'Sleep'], ['#fab005', 'Seek light'], ['#495057', 'Avoid light'], ['var(--accent)', 'Flight']]} />
        </>
      )}
      <Hint>Set your route, departure and usual sleep, then tap a day for its plan. Each bar is a 24-hour day in the local time where you are; the sleep block slides toward destination time before you fly. This is general guidance, not medical advice.</Hint>
    </div>
  )
}
