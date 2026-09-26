import { useEffect, useRef, useState } from 'react'
import { Hint, Slider } from '../../sim/controls'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { NoiseEngine } from './engine'
import { emptyMix, LAYERS, PRESETS, sleepGain, type LayerId, type Mix } from './noise'
import Tile from './Tile'
import './tool.css'

const KEY = '4lltools:ambient-noise'
const TIMERS = [0, 15, 30, 45, 60, 90] as const

function load(): { mix: Mix; master: number } {
  const fallback = { mix: { ...emptyMix(), rain: 60, brown: 25 }, master: 70 }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return fallback
    const d = JSON.parse(raw)
    return { mix: { ...emptyMix(), ...d.mix }, master: typeof d.master === 'number' ? d.master : 70 }
  } catch {
    return fallback
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function AmbientNoise() {
  const [mix, setMix] = useState<Mix>(() => ({ ...emptyMix(), rain: 60, brown: 25 }))
  const [master, setMaster] = useState(70)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const [sleepMin, setSleepMin] = useState<number>(0)
  const [sleepStart, setSleepStart] = useState(0)
  const [now, setNow] = useState(0)
  const engine = useRef<NoiseEngine | null>(null)
  const ready = useRef(false)
  const motion = useRef(!reducedMotion())

  useEffect(() => {
    const d = load()
    setMix(d.mix)
    setMaster(d.master)
    ready.current = true
    return () => engine.current?.close()
  }, [])

  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify({ mix, master }))
    } catch {
      // Storage is optional.
    }
    const e = engine.current
    if (e) for (const { id } of LAYERS) e.setVolume(id, mix[id])
  }, [mix, master])

  // Sleep timer: fade the master out over the last 30 seconds, then stop.
  const total = sleepMin * 60
  const elapsed = sleepMin && sleepStart ? (now - sleepStart) / 1000 : 0
  const fade = sleepGain(elapsed, total, 30)
  useEffect(() => {
    engine.current?.setMaster((master / 100) * (playing ? fade : 0))
    if (playing && total && elapsed >= total) {
      setPlaying(false)
      setSleepMin(0)
      void engine.current?.ctx.suspend()
    }
  }, [master, fade, playing, total, elapsed])

  useEffect(() => {
    if (!playing || !sleepMin) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [playing, sleepMin])

  function toggle() {
    try {
      if (!engine.current) {
        engine.current = new NoiseEngine()
        for (const { id } of LAYERS) engine.current.setVolume(id, mix[id])
      }
      const e = engine.current
      if (playing) {
        e.setMaster(0)
        setTimeout(() => void e.ctx.suspend(), 250)
        setPlaying(false)
      } else {
        void e.ctx.resume()
        if (sleepMin) {
          setSleepStart(Date.now())
          setNow(Date.now())
        }
        setPlaying(true)
      }
    } catch {
      setError(true)
    }
  }

  function chooseTimer(m: number) {
    setSleepMin(m)
    setSleepStart(Date.now())
    setNow(Date.now())
  }

  const set = (id: LayerId, v: number) => setMix((m) => ({ ...m, [id]: v }))
  const left = total ? Math.max(0, total - elapsed) : 0
  const R = 22
  const C = 2 * Math.PI * R

  return (
    <div className="an">
      <div className="an-top">
        <button type="button" className={`btn primary btn-icon an-play ${playing ? 'on' : ''}`} onClick={toggle} aria-pressed={playing}>
          <Icon key={playing ? 'pa' : 'pl'} name={playing ? 'pause-circle' : 'play-circle'} size={22} />
          {playing ? 'Pause' : 'Play'}
        </button>
        <div className="an-master">
          <Slider label="Master volume" value={master} min={0} max={100} unit="%" onChange={setMaster} />
        </div>
      </div>
      {error && <p className="error">Your browser could not start Web Audio.</p>}

      <div className="row an-presets" role="group" aria-label="Presets">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className="btn" onClick={() => setMix({ ...emptyMix(), ...p.mix })}>{p.name}</button>
        ))}
        <button type="button" className="btn" onClick={() => setMix(emptyMix())}>Mute all</button>
      </div>

      <div className="an-grid">
        {LAYERS.map((l, i) => (
          <div key={l.id} className={`an-card pop ${mix[l.id] > 0 ? 'active' : ''}`} style={{ animationDelay: `${i * 40}ms`, '--c': l.color } as React.CSSProperties}>
            <Tile id={l.id} color={l.color} volume={mix[l.id]} playing={playing && motion.current} swellNow={() => (engine.current && playing ? engine.current.swellNow() : null)} />
            <Slider label={l.name} value={mix[l.id]} min={0} max={100} unit="%" onChange={(v) => set(l.id, v)} />
          </div>
        ))}
      </div>

      <div className="an-sleep">
        <div>
          <b className="an-sleep-title"><Icon name="moon" size={18} /> Sleep timer</b>
          <div className="row" role="group" aria-label="Sleep timer">
            {TIMERS.map((m) => (
              <button key={m} type="button" className={`btn ${sleepMin === m ? 'primary' : ''}`} aria-pressed={sleepMin === m} onClick={() => chooseTimer(m)}>{m ? `${m} min` : 'Off'}</button>
            ))}
          </div>
        </div>
        {sleepMin > 0 && (
          <div className="an-ring settle-in" aria-label={`${mmss(left)} left`}>
            <svg viewBox="0 0 56 56" width="64" height="64">
              <circle cx="28" cy="28" r={R} className="an-ring-bg" />
              <circle cx="28" cy="28" r={R} className="an-ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} />
            </svg>
            <span><Roll>{mmss(left)}</Roll></span>
          </div>
        )}
      </div>
      <Hint>Press Play, then mix layers with their sliders or pick a preset. The sleep timer fades everything out gently over its last 30 seconds. All sound is generated live on your device.</Hint>
    </div>
  )
}
