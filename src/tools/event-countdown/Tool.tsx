import { useEffect, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import { Hint } from '../../sim/controls'
import { confetti } from './confetti'
import FlipCard from './FlipCard'
import { breakdown, decodeHash, encodeHash, nextAnnual, nextIdulFitri, parseLocal, progress, toLocal, type EventInfo } from './logic'
import './tool.css'

const KEY = '4lltools:event-countdown'
const R = 54
const C = 2 * Math.PI * R
const pad = (n: number) => String(n).padStart(2, '0')

function defaultEvent(now: Date): EventInfo {
  return { name: `New Year ${now.getFullYear() + 1}`, at: `${now.getFullYear() + 1}-01-01T00:00`, created: now.getTime() }
}

export default function EventCountdown() {
  const [ev, setEv] = useState<EventInfo | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [bday, setBday] = useState('')
  const [link, setLink] = useState('')
  const wasCounting = useRef(false)

  // The hash wins over what was saved, so shared links open straight away.
  useEffect(() => {
    const read = () => {
      const fromHash = decodeHash(location.hash)
      let saved: EventInfo | null = null
      try {
        saved = decodeHash(localStorage.getItem(KEY) ?? '')
      } catch {
        saved = null
      }
      setEv({ ...(fromHash ?? saved ?? defaultEvent(new Date())) })
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  useEffect(() => {
    if (!ev) return
    const hash = encodeHash(ev)
    try {
      localStorage.setItem(KEY, hash)
    } catch {
      // Storage is optional.
    }
    if (location.hash !== hash) history.replaceState(null, '', hash)
    setLink(location.href)
  }, [ev])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const target = ev ? parseLocal(ev.at).getTime() : 0
  const left = target - now
  const parts = breakdown(left)
  const created = ev?.created ?? now
  const prog = progress(created, target, now)

  // Celebrate when the countdown reaches zero while the page is open.
  useEffect(() => {
    if (!ev) return
    if (!parts.done) wasCounting.current = true
    else if (wasCounting.current) {
      wasCounting.current = false
      confetti()
    }
  }, [parts.done, ev])

  function set(name: string, at: string) {
    setEv({ name, at, created: Date.now() })
  }

  const d = new Date(now)
  const fitri = nextIdulFitri(d)
  const when = ev ? parseLocal(ev.at) : null

  return (
    <div className="ec">
      <div className="ec-stage">
        <div className="ec-ringwrap">
          <svg viewBox="0 0 120 120" className="ec-ring" aria-hidden="true">
            <circle cx="60" cy="60" r={R} className="ec-ring-bg" />
            <circle cx="60" cy="60" r={R} className="ec-ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - prog)} />
          </svg>
          <div className="ec-ring-text">
            <b>{Math.floor(prog * 100)}%</b>
            <span>of the wait</span>
          </div>
        </div>
        <div className="ec-main">
          <h2 className="ec-name">{ev?.name ?? '…'}</h2>
          <p className="muted ec-when">{when ? when.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
          <div className="ec-flip" role="timer" aria-live="off" aria-label={`${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds left`}>
            <FlipCard value={parts.days > 99 ? String(parts.days) : pad(parts.days)} label="days" />
            <FlipCard value={pad(parts.hours)} label="hours" />
            <FlipCard value={pad(parts.minutes)} label="min" />
            <FlipCard value={pad(parts.seconds)} label="sec" />
          </div>
          {parts.done && ev && <p className="ec-done pop">🎉 It’s here! {ev.name} has started.</p>}
        </div>
      </div>

      <div className="two-col ec-form">
        <label>
          Event name
          <input type="text" value={ev?.name ?? ''} maxLength={80} onChange={(e) => ev && setEv({ ...ev, name: e.target.value })} />
        </label>
        <label>
          Date and time
          <input type="datetime-local" value={ev?.at ?? ''} onChange={(e) => e.target.value && ev && set(ev.name, e.target.value)} />
        </label>
      </div>

      <div className="row ec-presets">
        <button type="button" className="btn" onClick={() => set(`New Year ${d.getFullYear() + 1}`, `${d.getFullYear() + 1}-01-01T00:00`)}>🎆 New Year</button>
        {fitri && <button type="button" className="btn" onClick={() => set(`Idul Fitri ${fitri.slice(0, 4)}`, `${fitri}T00:00`)}>🌙 Idul Fitri</button>}
        <button type="button" className="btn" onClick={() => set(`Independence Day`, toLocal(nextAnnual(8, 17, d)).slice(0, 10) + 'T00:00')}>🇮🇩 17 Agustus</button>
        <span className="ec-bday">
          <input type="date" aria-label="Birthday" value={bday} onChange={(e) => setBday(e.target.value)} />
          <button type="button" className="btn" disabled={!bday} onClick={() => {
            const [, m, day] = bday.split('-').map(Number)
            set('My birthday', toLocal(nextAnnual(m, day, d)).slice(0, 10) + 'T00:00')
          }}>🎂 Birthday</button>
        </span>
      </div>

      <div className="row">
        <CopyButton text={link} label="Copy share link" />
        <button type="button" className="btn btn-icon" onClick={() => confetti()}>
          <Icon name="shooting-star" size={18} /> Test confetti
        </button>
      </div>
      <Hint>Pick a preset or type your own event. The link keeps the name and date in its # part, so anyone who opens it sees the same countdown; the ring fills from when you set it up.</Hint>
      {fitri && <p className="muted ec-note">Idul Fitri follows the Indonesian government’s expected date and may shift by a day after the sidang isbat.</p>}
    </div>
  )
}
