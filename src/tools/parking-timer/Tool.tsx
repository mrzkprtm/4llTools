import { useEffect, useRef, useState } from 'react'
import { Hint } from '../../sim/controls'
import { tone } from '../../sim/audio'
import Icon from '../../components/Icon'
import { clock, DEFAULT_RATES, minutesUntil, parkingCost, reminderDue, type Rates } from './logic'
import SpotPhoto from './SpotPhoto'
import './tool.css'

const KEY = '4lltools:parking-timer'
const R = 110
const C = 2 * Math.PI * R
const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID')

interface Saved {
  start: number | null
  end: number | null
  minutes: number
  remind: number
  note: string
  rates: Rates
  photo?: string
}

const DEFAULTS: Saved = { start: null, end: null, minutes: 60, remind: 10, note: 'Level B2, pillar C7, near the lifts', rates: DEFAULT_RATES }

function alarm() {
  ;[0, 250, 500, 1000, 1250, 1500].forEach((d, i) => setTimeout(() => tone(i % 3 === 2 ? 1320 : 880, 180, 'square', 0.06), d))
  try {
    navigator.vibrate?.([300, 150, 300, 150, 600])
  } catch {
    // Vibration is optional.
  }
}

export default function ParkingTimer() {
  const [s, setS] = useState<Saved>(DEFAULTS)
  const [now, setNow] = useState(() => Date.now())
  const [until, setUntil] = useState('')
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default')
  const [banner, setBanner] = useState('')
  const [photoMsg, setPhotoMsg] = useState('')
  const ready = useRef(false)
  const fired = useRef({ remind: false, end: false })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        const v = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Saved>) }
        setS(v)
        if (v.end) fired.current = { remind: Date.now() >= v.end - v.remind * 60000, end: Date.now() >= v.end }
      }
    } catch {
      // Storage is optional.
    }
    setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
    ready.current = true
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
      setPhotoMsg('')
    } catch {
      // Most likely the photo pushed us over the quota: keep it in memory only.
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...s, photo: undefined }))
        if (s.photo) setPhotoMsg('Photo too big to save on this device. It stays here until you close the page.')
      } catch {
        // Storage is unavailable.
      }
    }
  }, [s])

  const active = s.end !== null && s.start !== null
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [active])

  function notify(title: string, body: string) {
    setBanner(`${title} ${body}`)
    alarm()
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, tag: 'parking-timer' })
    } catch {
      // Some mobile browsers only allow notifications from a service worker; the in-page alarm covers it.
    }
  }

  useEffect(() => {
    if (!active || !s.end) return
    if (!fired.current.remind && reminderDue(s.end, s.remind, now)) {
      fired.current.remind = true
      notify(`Parking ends in ${s.remind} min.`, s.note ? `Your car: ${s.note}` : 'Head back to your car.')
    }
    if (!fired.current.end && now >= s.end) {
      fired.current.end = true
      fired.current.remind = true
      notify('Parking time is up.', s.note ? `Your car: ${s.note}` : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, active])

  function start(minutes: number) {
    if (!(minutes > 0)) return
    const t = Date.now()
    fired.current = { remind: false, end: false }
    setBanner('')
    setNow(t)
    setS({ ...s, minutes, start: t, end: t + minutes * 60000 })
  }

  async function askPermission() {
    if (typeof Notification === 'undefined') return setPerm('unsupported')
    try {
      setPerm(await Notification.requestPermission())
    } catch {
      setPerm('denied')
    }
  }

  const total = active ? s.end! - s.start! : s.minutes * 60000
  const left = active ? s.end! - now : total
  const over = left < 0
  const frac = active ? Math.max(0, Math.min(1, left / total)) : 1
  const elapsedMin = active ? (now - s.start!) / 60000 : 0
  const setRate = (k: keyof Rates, v: string) => setS({ ...s, rates: { ...s.rates, [k]: Math.max(0, Number(v) || 0) } })

  return (
    <div className="pt">
      {banner && (
        <div className="pt-banner" role="alert">
          <Icon name="bell" size={20} /> <span>{banner}</span>
          <button type="button" className="btn" onClick={() => setBanner('')}>OK</button>
        </div>
      )}
      <div className={`pt-stage ${active ? 'on' : ''} ${over ? 'over' : ''} ${active && left < s.remind * 60000 ? 'soon' : ''}`}>
        <svg className="pt-ring" viewBox="0 0 260 260" role="timer" aria-label={over ? `Overdue by ${clock(-left)}` : `${clock(left)} left`}>
          <circle className="pt-track" cx="130" cy="130" r={R} />
          <circle className="pt-prog" cx="130" cy="130" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
          <text className="pt-time" x="130" y="136" textAnchor="middle">{clock(over ? left : Math.max(0, left))}</text>
          <text className="pt-sub" x="130" y="168" textAnchor="middle">
            {!active ? 'ready' : over ? 'overdue' : `until ${new Date(s.end!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
          </text>
        </svg>
      </div>

      <div className="row pt-quick">
        {[30, 60, 120].map((m) => (
          <button key={m} type="button" className={`btn ${!active && s.minutes === m ? 'primary' : ''}`} onClick={() => (active ? start(m) : setS({ ...s, minutes: m }))}>{m < 60 ? `${m}m` : `${m / 60}h`}</button>
        ))}
        <label className="pt-inline">Minutes <input type="number" min={1} max={1440} value={s.minutes} onChange={(e) => setS({ ...s, minutes: Math.max(1, Math.min(1440, Number(e.target.value) || 1)) })} /></label>
        <label className="pt-inline">or until <input type="time" value={until} onChange={(e) => { setUntil(e.target.value); const m = minutesUntil(e.target.value, new Date()); if (m > 0) setS({ ...s, minutes: m }) }} /></label>
      </div>
      <div className="row pt-controls">
        {!active ? (
          <button type="button" className="btn primary btn-icon pt-go" onClick={() => start(s.minutes)}><Icon name="play-circle" size={20} />Start parking timer</button>
        ) : (
          <>
            <button type="button" className="btn btn-icon" onClick={() => { const end = s.end! + 15 * 60000; fired.current = { remind: Date.now() >= end - s.remind * 60000, end: Date.now() >= end }; setBanner(''); setS({ ...s, end }) }}><Icon name="clock-plus" size={18} />+15 min</button>
            <button type="button" className="btn btn-icon" onClick={() => { setS({ ...s, start: null, end: null }); setBanner('') }}><Icon name="stop-circle" size={18} />I&apos;m back</button>
          </>
        )}
      </div>

      <div className="stats">
        <div className="stat"><b>{rp(parkingCost(s.minutes, s.rates))}</b>Estimated for {s.minutes >= 60 ? `${Math.floor(s.minutes / 60)} h ${s.minutes % 60 ? `${s.minutes % 60} min` : ''}` : `${s.minutes} min`}</div>
        {active && <div className="stat"><b>{rp(parkingCost(elapsedMin, s.rates))}</b>So far ({Math.floor(elapsedMin)} min)</div>}
      </div>

      <div className="pt-cols">
        <section className="pt-card">
          <h3>Where I parked</h3>
          <textarea className="pt-note" aria-label="Parking spot note" value={s.note} placeholder="Level B2, pillar C7" onChange={(e) => setS({ ...s, note: e.target.value })} />
          <SpotPhoto photo={s.photo} onPhoto={(p) => { setPhotoMsg(''); setS({ ...s, photo: p }) }} />
          {photoMsg && <p className="muted pt-msg">{photoMsg}</p>}
        </section>
        <section className="pt-card">
          <h3>Reminder</h3>
          <label className="pt-inline">Remind me <input type="number" min={0} max={120} value={s.remind} onChange={(e) => setS({ ...s, remind: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })} /> min before</label>
          {perm === 'granted' ? (
            <p className="ok pt-msg">Notifications are on.</p>
          ) : perm === 'unsupported' ? (
            <p className="muted pt-msg">This browser can&apos;t show notifications, so the page will beep and vibrate instead. Keep it open.</p>
          ) : perm === 'denied' ? (
            <p className="muted pt-msg">Notifications are blocked, so the page will beep and vibrate instead. Keep it open.</p>
          ) : (
            <button type="button" className="btn btn-icon" onClick={askPermission}><Icon name="bell" size={18} />Allow notifications</button>
          )}
          <h3>Rates (Rp)</h3>
          <div className="pt-rates">
            <label>First hour<input type="number" min={0} step={500} value={s.rates.first} onChange={(e) => setRate('first', e.target.value)} /></label>
            <label>Each next hour<input type="number" min={0} step={500} value={s.rates.next} onChange={(e) => setRate('next', e.target.value)} /></label>
            <label>Daily max (0 = none)<input type="number" min={0} step={1000} value={s.rates.dailyMax} onChange={(e) => setRate('dailyMax', e.target.value)} /></label>
          </div>
        </section>
      </div>
      <Hint>Pick a duration and start the timer when you park; note the spot and snap a photo so you can find the car again. The reminder beeps on this page and also sends a notification if you allow it. Everything stays on this device.</Hint>
    </div>
  )
}
