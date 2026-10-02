import { useEffect, useMemo, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { allZones, cityName, dayHours, DEFAULT_ZONES, formatOffset, fromInputValue, hourKind, isValidZone, offsetMinutes, overlap, toInputValue, wallTime, zonedToUtc, zoneAbbr } from './tz'
import './tool.css'

const STORE = 'tz-zones'
const p2 = (n: number) => String(n).padStart(2, '0')

function loadZones(): string[] {
  try {
    const raw = localStorage.getItem(STORE)
    const list = raw ? (JSON.parse(raw) as unknown) : null
    if (Array.isArray(list) && list.length && list.every((z) => typeof z === 'string' && isValidZone(z))) return list as string[]
  } catch {
    // Storage blocked or bad data.
  }
  return DEFAULT_ZONES
}

function dateLabel(zone: string, ms: number) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ms))
}

function dayDiff(a: string, b: string, ms: number) {
  const x = wallTime(a, ms)
  const y = wallTime(b, ms)
  return Math.round((Date.UTC(x.year, x.month - 1, x.day) - Date.UTC(y.year, y.month - 1, y.day)) / 86400000)
}

function diffLabel(min: number) {
  if (min === 0) return 'same time'
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  return `${min > 0 ? '+' : '−'}${h}h${m ? ` ${m}m` : ''}`
}

export default function TimeZoneConverter() {
  const [zones, setZones] = useState<string[]>(DEFAULT_ZONES)
  const [ref, setRef] = useState(DEFAULT_ZONES[0])
  const [instant, setInstant] = useState(() => Date.now())
  const [live, setLive] = useState(true)
  const [adding, setAdding] = useState('')
  const [addError, setAddError] = useState('')
  const [workStart, setWorkStart] = useState(9)
  const [workEnd, setWorkEnd] = useState(17)
  const [zoneList, setZoneList] = useState<string[]>([])
  const cards = useRef<HTMLUListElement>(null)
  useFlip(cards)

  useEffect(() => {
    const saved = loadZones()
    setZones(saved)
    setRef(saved[0])
    setZoneList(allZones())
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(zones))
    } catch {
      // Not saved; fine.
    }
  }, [zones])

  useEffect(() => {
    if (!live) return
    setInstant(Date.now())
    const id = setInterval(() => setInstant(Date.now()), 1000)
    return () => clearInterval(id)
  }, [live])

  const refZone = zones.includes(ref) ? ref : zones[0] ?? 'UTC'
  const refWall = wallTime(refZone, instant)
  const hours = useMemo(() => dayHours(refZone, instant), [refZone, refWall.year, refWall.month, refWall.day])
  const shared = useMemo(() => new Set(overlap(zones, hours, workStart, workEnd)), [zones, hours, workStart, workEnd])
  const refOffset = offsetMinutes(refZone, instant)

  function setWall(value: string) {
    const w = fromInputValue(value)
    if (!w) return
    setLive(false)
    setInstant(zonedToUtc(refZone, w))
  }

  function add() {
    const q = adding.trim()
    const match = zoneList.find((z) => z.toLowerCase() === q.toLowerCase()) ?? zoneList.find((z) => cityName(z).toLowerCase() === q.toLowerCase() || z.toLowerCase().endsWith(`/${q.toLowerCase().replace(/ /g, '_')}`))
    const zone = match ?? (isValidZone(q) ? q : '')
    if (!zone) return setAddError(`"${q}" is not a time zone. Type a city like Tokyo or an ID like Asia/Tokyo.`)
    if (zones.includes(zone)) return setAddError(`${cityName(zone)} is already on the list.`)
    setZones([...zones, zone])
    setAdding('')
    setAddError('')
  }

  function move(zone: string, dir: -1 | 1) {
    const i = zones.indexOf(zone)
    const j = i + dir
    if (j < 0 || j >= zones.length) return
    const next = [...zones]
    ;[next[i], next[j]] = [next[j], next[i]]
    setZones(next)
  }

  const summary = zones
    .map((z) => {
      const w = wallTime(z, instant)
      return `${cityName(z)} (${z}): ${dateLabel(z, instant)} ${p2(w.hour)}:${p2(w.minute)} ${formatOffset(offsetMinutes(z, instant))}`
    })
    .join('\n')

  return (
    <div>
      <div className="tz-top">
        <div>
          <label htmlFor="tz-ref">Reference zone</label>
          <select id="tz-ref" value={refZone} onChange={(e) => setRef(e.target.value)}>
            {zones.map((z) => <option key={z} value={z}>{cityName(z)} ({z})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="tz-when">Date and time in {cityName(refZone).split(' · ')[0]}</label>
          <input id="tz-when" type="datetime-local" value={toInputValue(refWall)} onChange={(e) => setWall(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className={`tz-live ${live ? '' : 'off'}`} role="status"><i aria-hidden="true" />{live ? 'Live: showing the current time' : 'Showing a chosen time'}</span>
        <div className="row" style={{ margin: 0 }}>
          <button type="button" className={`btn ${live ? '' : 'primary'}`} onClick={() => setLive(true)} disabled={live}>Now</button>
          <CopyButton text={summary} label="Copy times" />
        </div>
      </div>

      <ul className="tz-cards" ref={cards} aria-label="Times in each zone">
        {zones.map((z, i) => {
          const w = wallTime(z, instant)
          const off = offsetMinutes(z, instant)
          const dd = dayDiff(z, refZone, instant)
          const abbr = zoneAbbr(z, instant)
          return (
            <li key={z} data-flip={z} className={`tz-card ${z === refZone ? 'ref' : ''}`}>
              <h3>{cityName(z)}</h3>
              <div className="tz-id">{z}</div>
              <div className="tz-time"><Roll>{`${p2(w.hour)}:${p2(w.minute)}`}</Roll>{live && <span className="muted" style={{ fontSize: '0.9rem' }}>:{p2(w.second)}</span>}</div>
              <div className="tz-meta">
                <span>{dateLabel(z, instant)}</span>
                {dd !== 0 && <span key={dd} className="tz-day">{dd > 0 ? `+${dd} day` : `${dd} day`}</span>}
              </div>
              <div className="tz-meta">
                <span>{abbr && !abbr.startsWith('GMT') ? `${abbr} · ` : ''}{formatOffset(off)}</span>
                {z !== refZone && <span>· {diffLabel(off - refOffset)}</span>}
              </div>
              <div className="tz-acts">
                <button type="button" aria-pressed={z === refZone} title="Use as reference" aria-label={`Use ${cityName(z)} as reference`} onClick={() => setRef(z)}>★</button>
                <button type="button" title="Move earlier" aria-label={`Move ${cityName(z)} up`} onClick={() => move(z, -1)} disabled={i === 0}>↑</button>
                <button type="button" title="Remove" aria-label={`Remove ${cityName(z)}`} onClick={() => setZones(zones.filter((x) => x !== z))} disabled={zones.length <= 1}>×</button>
              </div>
            </li>
          )
        })}
      </ul>

      <label htmlFor="tz-add">Add a time zone</label>
      <div className="tz-add">
        <input id="tz-add" type="text" list="tz-all" placeholder="City or zone, e.g. Tokyo or Asia/Tokyo" value={adding} onChange={(e) => { setAdding(e.target.value); setAddError('') }} onKeyDown={(e) => { if (e.key === 'Enter') add() }} autoComplete="off" />
        <datalist id="tz-all">{zoneList.map((z) => <option key={z} value={z} />)}</datalist>
        <button type="button" className="btn primary" onClick={add} disabled={!adding.trim()}>Add</button>
      </div>
      {addError && <p className="error" role="alert">{addError}</p>}

      <h2 style={{ fontSize: '1.05rem', margin: '24px 0 4px' }}>Meeting planner</h2>
      <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>Each column is one hour of {dateLabel(refZone, instant)} in {cityName(refZone).split(' · ')[0]}. Tap an hour to see it everywhere; the green bar marks hours inside everyone&apos;s work day.</p>
      <div className="tz-hours row">
        <label htmlFor="tz-ws">Work hours</label>
        <input id="tz-ws" type="number" min={0} max={23} value={workStart} onChange={(e) => setWorkStart(Math.min(23, Math.max(0, Number(e.target.value) || 0)))} aria-label="Work day starts at hour" />
        <span>to</span>
        <input id="tz-we" type="number" min={1} max={24} value={workEnd} onChange={(e) => setWorkEnd(Math.min(24, Math.max(1, Number(e.target.value) || 0)))} aria-label="Work day ends at hour" />
        <span className="chip" key={shared.size}>{shared.size ? `${shared.size} shared work hour${shared.size > 1 ? 's' : ''}` : 'No shared work hours'}</span>
      </div>
      <div className="tz-planner">
        <div className="tz-grid" role="grid" aria-label="Hours in each zone">
          <div className="tz-name" aria-hidden="true"><small>overlap</small></div>
          {hours.map((_, h) => <div key={h} className={`tz-ov ${shared.has(h) ? 'on' : ''}`} style={{ animationDelay: `${h * 12}ms` }} aria-hidden="true" />)}
          {zones.map((z) => (
            <div key={z} role="row" style={{ display: 'contents' }}>
              <div className="tz-name" role="rowheader">{cityName(z).split(' · ')[0]}<small>{formatOffset(offsetMinutes(z, instant)).replace('UTC', '')}</small></div>
              {hours.map((ms, h) => {
                const lw = wallTime(z, ms)
                const kind = hourKind(lw.hour, workStart, workEnd)
                return (
                  <button
                    key={h}
                    type="button"
                    role="gridcell"
                    className={`tz-cell ${kind} ${h === refWall.hour ? 'sel' : ''}`}
                    style={{ animationDelay: `${h * 10}ms` }}
                    onClick={() => { setLive(false); setInstant(ms + refWall.minute * 60000) }}
                    aria-label={`${p2(h)}:00 in ${cityName(refZone)} is ${p2(lw.hour)}:${p2(lw.minute)} in ${cityName(z)}`}
                  >
                    {lw.minute ? `${lw.hour}½` : lw.hour}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="tz-legend">
        <span><i style={{ background: 'color-mix(in srgb, var(--ok) 32%, var(--surface))' }} />Work hours</span>
        <span><i style={{ background: 'color-mix(in srgb, #f59e0b 26%, var(--surface))' }} />Early or evening</span>
        <span><i style={{ background: 'color-mix(in srgb, var(--text) 9%, var(--surface))' }} />Night</span>
      </div>
      <p className="muted">
        Indonesia has three zones: WIB (UTC+7, Jawa and Sumatra), WITA (UTC+8, Bali, Kalimantan, Sulawesi, NTB, NTT) and WIT (UTC+9, Maluku and Papua), none with daylight saving. Daylight saving elsewhere (US, UK, EU, Australia) is handled by your browser&apos;s time zone database, so a date after a clock change shows the new offset. Your list of zones is saved in this browser.
      </p>
    </div>
  )
}
