import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { Choice, Hint, Select } from '../../sim/controls'
import { CITIES, searchCities, type City } from './cities'
import { hhmm, METHODS, PRAYER_KEYS, PRAYER_LABEL, prayerTimes, zoneOffset, type AsrSchool, type MethodId, type PrayerKey } from './prayer'
import Qibla from './Qibla'
import SunArc from './SunArc'
import './tool.css'

const STORE = '4lltools:prayer-times'
const p2 = (n: number) => String(n).padStart(2, '0')
const DAY = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MAIN: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

interface Loc {
  name: string
  lat: number
  lng: number
  zone?: string
  tz: number
}

const fromCity = (c: City): Loc => ({ name: `${c.name}, ${c.region}`, lat: c.lat, lng: c.lng, zone: c.zone, tz: c.tz })
const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

/** Wall clock (y, m, d, fractional hour) at a UTC offset. */
function wall(ms: number, tz: number) {
  const d = new Date(ms + tz * 3600000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 }
}

function dur(h: number) {
  const s = Math.max(0, Math.round(h * 3600))
  return `${Math.floor(s / 3600)}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}`
}

export default function PrayerTimes() {
  const [loc, setLoc] = useState<Loc>(fromCity(CITIES[0]))
  const [method, setMethod] = useState<MethodId>('kemenag')
  const [asr, setAsr] = useState<AsrSchool>('shafii')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [dateStr, setDateStr] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [geoMsg, setGeoMsg] = useState('')
  const [manual, setManual] = useState(false)
  const [view, setView] = useState<'day' | 'month'>('day')

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null')
      if (s?.loc && Number.isFinite(s.loc.lat)) setLoc(s.loc)
      if (s?.method in METHODS) setMethod(s.method)
      if (s?.asr === 'hanafi') setAsr('hanafi')
    } catch {
      // Defaults are fine.
    }
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ loc, method, asr }))
    } catch {
      // Not saved.
    }
  }, [loc, method, asr])

  const tz = loc.zone ? zoneOffset(loc.zone, now, loc.tz) : loc.tz
  const w = wall(now, tz)
  const todayStr = `${w.y}-${p2(w.m)}-${p2(w.d)}`
  const sel = dateStr || todayStr
  const [yy, mm, dd] = sel.split('-').map(Number) as [number, number, number]
  const isToday = sel === todayStr
  const dayTz = loc.zone ? zoneOffset(loc.zone, Date.UTC(yy, mm - 1, dd, 12), loc.tz) : loc.tz
  const place = useMemo(() => ({ lat: loc.lat, lng: loc.lng, tz: dayTz }), [loc.lat, loc.lng, dayTz])
  const times = useMemo(() => prayerTimes(yy, mm, dd, place, { method, asr }), [yy, mm, dd, place, method, asr])

  // Next prayer and the gap it closes (only meaningful for today).
  const nowH = w.h
  let next: PrayerKey = 'fajr'
  let nextAt = times.fajr + 24
  let prevAt = times.isha - 24
  for (let i = 0; i < MAIN.length; i++) {
    if (times[MAIN[i]] > nowH) {
      next = MAIN[i]
      nextAt = times[MAIN[i]]
      prevAt = i ? times[MAIN[i - 1]] : times.isha - 24
      break
    }
    prevAt = times[MAIN[i]]
  }
  const frac = Math.min(1, Math.max(0, (nowH - prevAt) / (nextAt - prevAt)))
  const R = 52
  const C = 2 * Math.PI * R

  const month = useMemo(() => {
    const days = new Date(Date.UTC(yy, mm, 0)).getUTCDate()
    return Array.from({ length: days }, (_, i) => ({ d: i + 1, dow: new Date(Date.UTC(yy, mm - 1, i + 1)).getUTCDay(), t: prayerTimes(yy, mm, i + 1, place, { method, asr }) }))
  }, [yy, mm, place, method, asr])

  const results = open ? searchCities(query) : []
  function pick(c: City) {
    setLoc(fromCity(c))
    setQuery('')
    setOpen(false)
    setDateStr('')
  }
  function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoMsg('Location is not available in this browser. Pick a city instead.')
      return
    }
    setGeoMsg('Finding you…')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const zone = deviceZone()
        setLoc({ name: 'My location', lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4), zone, tz: -new Date().getTimezoneOffset() / 60 })
        setGeoMsg('')
      },
      () => setGeoMsg('Location was declined or unavailable. Pick a city or type coordinates.'),
      { timeout: 12000, maximumAge: 600000 },
    )
  }

  return (
    <div className="pt">
      <div className="pt-top">
        <div className="pt-search">
          <label className="sim-label" htmlFor="pt-q">Location</label>
          <input id="pt-q" type="search" placeholder={loc.name} value={query} autoComplete="off" onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => { setQuery(e.target.value); setOpen(true) }} onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) pick(results[0]) }} />
          {open && results.length > 0 && (
            <ul className="pt-results" role="listbox">
              {results.map((c) => (
                <li key={c.name + c.region}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)}>
                    <b>{c.name}</b> <span className="muted">{c.region}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="row pt-locbtns">
          <button type="button" className="btn btn-icon" onClick={locate}><Icon name="map-marker" size={18} />Use my location</button>
          <button type="button" className={`btn ${manual ? 'primary' : ''}`} onClick={() => setManual(!manual)}>Coordinates</button>
          <input type="date" value={sel} onChange={(e) => setDateStr(e.target.value)} aria-label="Date" className="pt-date" />
          {!isToday && <button type="button" className="btn" onClick={() => setDateStr('')}>Today</button>}
        </div>
        {geoMsg && <p className="muted pt-small">{geoMsg}</p>}
        {manual && (
          <div className="pt-manual">
            {(['lat', 'lng', 'tz'] as const).map((k) => (
              <label key={k}>
                {k === 'lat' ? 'Latitude' : k === 'lng' ? 'Longitude' : 'UTC offset (h)'}
                <input type="number" step={k === 'tz' ? 0.5 : 0.0001} value={k === 'tz' ? tz : loc[k]} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setLoc({ ...loc, name: 'Custom location', zone: k === 'tz' ? undefined : loc.zone, tz: k === 'tz' ? v : tz, [k]: v }) }} />
              </label>
            ))}
          </div>
        )}
      </div>

      <p className="pt-where"><Icon name="map-marker" size={16} /> <b>{loc.name}</b> <span className="muted">{loc.lat.toFixed(3)}, {loc.lng.toFixed(3)} · UTC{dayTz >= 0 ? '+' : ''}{dayTz} · {DAY[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()]}, {dd}/{mm}/{yy}</span></p>

      <div className="pt-hero">
        <SunArc date={[yy, mm, dd]} place={place} times={times} hour={isToday ? nowH : times.dhuhr} next={isToday ? next : null} />
        {isToday && (
          <div className="pt-next">
            <svg viewBox="0 0 128 128" className="pt-ring" aria-hidden="true">
              <circle cx="64" cy="64" r={R} className="pt-ring-track" />
              <circle cx="64" cy="64" r={R} className="pt-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
            </svg>
            <div className="pt-next-text">
              <span className="muted">Next</span>
              <b>{PRAYER_LABEL[next]}</b>
              <span className="pt-count">{dur(nextAt - nowH)}</span>
              <span className="muted">at {hhmm(nextAt)}</span>
            </div>
          </div>
        )}
      </div>

      <ul className="pt-list">
        {PRAYER_KEYS.map((k, i) => (
          <li key={`${k}-${sel}-${method}-${loc.lat}`} className={isToday && k === next ? 'next' : ''} style={{ animationDelay: `${i * 45}ms` }}>
            <span>{PRAYER_LABEL[k]}</span>
            <b>{hhmm(times[k])}</b>
          </li>
        ))}
      </ul>

      <div className="pt-controls">
        <Select label="Calculation method" value={method} options={(Object.keys(METHODS) as MethodId[]).map((k) => [k, METHODS[k].name] as const)} onChange={setMethod} />
        <Choice label="Asr (Ashar)" value={asr} options={[['shafii', "Shafi'i / standard"], ['hanafi', 'Hanafi']]} onChange={setAsr} />
      </div>
      <p className="muted pt-small">{METHODS[method].note} Imsak is 10 minutes before Subuh. Your local mosque or the official Kemenag schedule may differ by a minute or two.</p>

      <h3 className="pt-h">Qibla direction</h3>
      <Qibla lat={loc.lat} lng={loc.lng} />

      <div className="row">
        <Choice value={view} options={[['day', 'Hide month'], ['month', `Month table`]]} onChange={setView} />
      </div>
      {view === 'month' && (
        <div className="pt-table-wrap">
          <table className="simple pt-table">
            <thead>
              <tr><th>Date</th>{PRAYER_KEYS.map((k) => <th key={k}>{PRAYER_LABEL[k]}</th>)}</tr>
            </thead>
            <tbody>
              {month.map((r) => (
                <tr key={r.d} className={r.d === dd ? 'on' : r.dow === 5 ? 'fri' : ''} onClick={() => setDateStr(`${yy}-${p2(mm)}-${p2(r.d)}`)}>
                  <td>{DAY[r.dow].slice(0, 3)} {r.d}</td>
                  {PRAYER_KEYS.map((k) => <td key={k}>{hhmm(r.t[k])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Hint>Search a city, use your location or type coordinates. Times are calculated on your device from the sun's position; tap a row in the month table to jump to that day.</Hint>
    </div>
  )
}
