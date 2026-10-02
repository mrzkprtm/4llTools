import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { useFlip } from '../../motion/useFlip'
import { Hint, Slider } from '../../sim/controls'
import { CITIES, DEFAULT_CITIES, isDaylight, offsetLabel, subsolarPoint, tzOffset, type City } from './logic'
import WorldMap from './WorldMap'
import './tool.css'

const KEY = '4lltools:world-clock-map'

const timeIn = (tz: string, d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
const dayIn = (tz: string, d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

export default function WorldClockMap() {
  const [names, setNames] = useState<string[]>(DEFAULT_CITIES)
  const [now, setNow] = useState(0)
  const [offset, setOffset] = useState(0) // hours
  const [hi, setHi] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const ready = useRef(false)
  const list = useRef<HTMLUListElement>(null)
  useFlip(list)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      const saved = raw ? (JSON.parse(raw) as string[]) : null
      if (Array.isArray(saved)) setNames(saved.filter((n) => CITIES.some((c) => c.name === n)))
    } catch {
      // Keep the defaults.
    }
    ready.current = true
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(names))
    } catch {
      // Storage is optional.
    }
  }, [names])

  const time = (now || Date.UTC(2026, 0, 1)) + offset * 3600000
  const date = new Date(time)
  const cities = names.map((n) => CITIES.find((c) => c.name === n)!).filter(Boolean)
  const localTz = now ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
  const localDay = dayIn(localTz, date)
  const sun = subsolarPoint(date)
  const others = CITIES.filter((c) => !names.includes(c.name))

  const rel = (c: City) => {
    const d = dayIn(c.tz, date)
    return d === localDay ? 'Today' : d > localDay ? 'Tomorrow' : 'Yesterday'
  }

  return (
    <div className="wc">
      <WorldMap time={time} cities={cities} highlight={hi} label={(c) => `${c.name} ${timeIn(c.tz, date)}`} onScrub={(dh) => setOffset((o) => Math.max(-24, Math.min(24, o + dh)))} />
      <div className="wc-bar">
        <div className="wc-slider">
          <Slider label="Scrub time" value={Math.round(offset * 4) / 4} min={-24} max={24} step={0.25} onChange={setOffset} format={(v) => (v === 0 ? 'now' : `${v > 0 ? '+' : '−'}${Math.floor(Math.abs(v))}h${Math.abs(v) % 1 ? ` ${Math.round((Math.abs(v) % 1) * 60)}m` : ''}`)} />
        </div>
        <button type="button" className="btn btn-icon" disabled={offset === 0} onClick={() => setOffset(0)}>
          <Icon name="reload" size={18} /> Now
        </button>
      </div>
      <p className="muted wc-sun">
        {now ? `${date.toLocaleString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} UTC · ` : ''}Sun overhead at {Math.abs(sun.lat).toFixed(1)}°{sun.lat >= 0 ? 'N' : 'S'}, {Math.abs(sun.lon).toFixed(1)}°{sun.lon >= 0 ? 'E' : 'W'}
      </p>

      <ul ref={list} className="wc-list">
        {cities.map((c) => {
          const day = isDaylight(c.lat, c.lon, date)
          return (
            <li key={c.name} data-flip={c.name} className={`wc-city ${day ? 'day' : 'night'} ${hi === c.name ? 'hi' : ''}`} onPointerEnter={() => setHi(c.name)} onPointerLeave={() => setHi(null)}>
              <span className="wc-icon" aria-label={day ? 'Daytime' : 'Night'}>{day ? '☀️' : '🌙'}</span>
              <span className="wc-name">
                <b>{c.name}</b>
                <small>{now ? `${rel(c)} · ${offsetLabel(tzOffset(c.tz, date))}` : ''}</small>
              </span>
              <b className="wc-time">{now ? timeIn(c.tz, date) : '--:--'}</b>
              <button type="button" className="wc-x" aria-label={`Remove ${c.name}`} onClick={() => setNames((n) => n.filter((x) => x !== c.name))}>
                <Icon name="close" size={16} />
              </button>
            </li>
          )
        })}
      </ul>
      <div className="row">
        <select aria-label="Add a city" value={pick} onChange={(e) => setPick(e.target.value)} className="wc-pick">
          <option value="">Add a city…</option>
          {others.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <button type="button" className="btn primary btn-icon" disabled={!pick} onClick={() => { setNames((n) => [...n, pick]); setPick('') }}>
          <Icon name="plus" size={18} /> Add
        </button>
        <button type="button" className="btn" onClick={() => setNames(DEFAULT_CITIES)}>Reset list</button>
      </div>
      <Hint>The shaded half of the map is night, with twilight fading at its edge; the yellow dot is where the sun is overhead. Drag across the map or use the slider to scrub up to 24 hours either way.</Hint>
    </div>
  )
}
