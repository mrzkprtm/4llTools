import { useEffect, useReducer, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { tone } from '../../sim/audio'
import { Hint, Select, Toggle } from '../../sim/controls'
import { counterReducer, dayKey, initCounter, PRESETS, roundLength, type Dhikr } from './counter'
import './tool.css'

const STORE = '4lltools:digital-tasbih'
const BEADS = 33
const R = 118

function buzz(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    // Not supported.
  }
}

export default function DigitalTasbih() {
  const [preset, setPreset] = useState('after-salat')
  const [custom, setCustom] = useState<Dhikr>({ label: 'Shalawat', target: 100 })
  const [state, dispatch] = useReducer(counterReducer, PRESETS[0].seq, initCounter)
  const [vibrate, setVibrate] = useState(true)
  const [sound, setSound] = useState(false)
  const [daily, setDaily] = useState<Record<string, number>>({})
  const [confirmReset, setConfirmReset] = useState(false)
  const [pulse, setPulse] = useState(0)
  const ready = useRef(false)
  const shownTotal = useRef(0)

  // Restore after mount so prerendered HTML matches the first client render.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? 'null')
      if (s) {
        if (typeof s.preset === 'string') setPreset(s.preset)
        if (s.custom?.label) setCustom(s.custom)
        if (typeof s.vibrate === 'boolean') setVibrate(s.vibrate)
        if (typeof s.sound === 'boolean') setSound(s.sound)
        if (s.daily && typeof s.daily === 'object') setDaily(s.daily)
        if (s.state) dispatch({ type: 'restore', state: s.state })
      }
    } catch {
      // Start fresh.
    }
    ready.current = true
  }, [])

  useEffect(() => {
    if (!ready.current) return
    const { past: _p, event: _e, ...keep } = state
    void _p
    void _e
    try {
      localStorage.setItem(STORE, JSON.stringify({ preset, custom, vibrate, sound, daily, state: keep }))
    } catch {
      // Not saved.
    }
  }, [preset, custom, vibrate, sound, daily, state])

  const stRef = useRef(state)
  stRef.current = state
  const prefs = useRef({ vibrate, sound })
  prefs.current = { vibrate, sound }
  const bump = (delta: number) => {
    const k = dayKey()
    setDaily((d) => ({ ...d, [k]: Math.max(0, (d[k] ?? 0) + delta) }))
  }

  function tap() {
    const next = counterReducer(stRef.current, { type: 'tap' })
    stRef.current = next
    dispatch({ type: 'tap' })
    bump(1)
    setPulse((p) => p + 1)
    const { vibrate: vib, sound: snd } = prefs.current
    if (next.event === 'tap') {
      if (vib) buzz(12)
      if (snd) tone(880, 40, 'sine', 0.05)
    } else {
      if (vib) buzz(next.event === 'round' ? [120, 80, 120, 80, 200] : [90, 60, 90])
      if (snd) tone(next.event === 'round' ? 660 : 523, 350, 'sine', 0.1)
    }
  }

  function undo() {
    if (!stRef.current.past.length) return
    stRef.current = counterReducer(stRef.current, { type: 'undo' })
    dispatch({ type: 'undo' })
    bump(-1)
  }

  function choose(id: string, c = custom) {
    setPreset(id)
    const p = PRESETS.find((x) => x.id === id)
    dispatch({ type: 'load', seq: p ? p.seq : [c] })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName)) return
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp' || e.key === '+' || e.key === 'AudioVolumeUp') {
        e.preventDefault()
        if (!e.repeat) tap()
      } else if (e.key === 'Backspace' || e.key === 'z' || e.key === 'ArrowDown' || e.key === 'AudioVolumeDown') {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cur = state.seq[state.index]
  const target = cur?.target ?? 0
  const ringN = target > 0 && target <= BEADS ? target : BEADS
  const shown = state.count % ringN
  const step = 360 / ringN
  // Big jumps (reset, switching dhikr lists) snap instead of spinning.
  const jump = Math.abs(state.total - shownTotal.current) > 1
  useEffect(() => {
    shownTotal.current = state.total
  })
  const round = roundLength(state.seq)
  const doneInRound = state.seq.slice(0, state.index).reduce((n, d) => n + d.target, 0) + state.count
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return { k: dayKey(d), label: d.toLocaleDateString('en-US', { weekday: 'short' }), n: daily[dayKey(d)] ?? 0 }
  })
  const maxDay = Math.max(1, ...week.map((w) => w.n))

  return (
    <div className="ts">
      <div className="ts-top">
        <Select label="Dhikr" value={preset} options={[...PRESETS.map((p) => [p.id, p.name] as const), ['custom', 'Custom…'] as const]} onChange={(v) => choose(v)} />
        {preset === 'custom' && (
          <div className="ts-custom">
            <input aria-label="Custom dhikr name" value={custom.label} onChange={(e) => { const c = { ...custom, label: e.target.value }; setCustom(c); choose('custom', c) }} />
            <input aria-label="Target" type="number" min={0} max={100000} value={custom.target} onChange={(e) => { const c = { ...custom, target: Math.max(0, Math.floor(Number(e.target.value) || 0)) }; setCustom(c); choose('custom', c) }} />
          </div>
        )}
      </div>

      {state.seq.length > 1 && (
        <ol className="ts-steps">
          {state.seq.map((d, i) => (
            <li key={i} className={i === state.index ? 'on' : i < state.index ? 'done' : ''}>{d.label} <small>{d.target}</small></li>
          ))}
        </ol>
      )}

      <button type="button" className={`ts-tap ${state.event === 'target' || state.event === 'round' ? 'hit' : ''}`} onClick={tap} aria-label={`Count. ${cur?.label ?? ''} ${state.count}${target ? ` of ${target}` : ''}`}>
        <svg viewBox="-150 -150 300 300" className="ts-svg" aria-hidden="true">
          <circle r={R} className="ts-string" />
          <g className="ts-beads" style={{ transform: `rotate(${-state.total * step}deg)`, transition: jump ? 'none' : undefined }}>
            {Array.from({ length: ringN }, (_, i) => {
              const a = (i / ringN) * Math.PI * 2 - Math.PI / 2
              const d = (((state.total - i) % ringN) + ringN) % ringN
              const on = d >= 1 && d <= shown
              return <circle key={`${ringN}-${i}`} cx={Math.cos(a) * R} cy={Math.sin(a) * R} r={ringN > 20 ? 9 : 12} className={`ts-bead ${on ? 'on' : ''} ${i === 0 ? 'imam' : ''}`} />
            })}
          </g>
          <circle key={pulse} cx="0" cy={-R} r="15" className="ts-marker" />
        </svg>
        <span className="ts-center">
          {cur?.arabic && <span className="ts-ar" lang="ar" dir="rtl">{cur.arabic}</span>}
          <span className="ts-label">{cur?.label}</span>
          <b className="ts-num"><Roll>{String(state.count)}</Roll></b>
          <span className="ts-of">{target ? `of ${target}` : 'tap anywhere'}</span>
        </span>
      </button>

      <div className="ts-bar" aria-hidden={!round}>
        {round > 0 && <i style={{ width: `${(doneInRound / round) * 100}%` }} />}
      </div>

      <div className="row ts-actions">
        <button type="button" className="btn btn-icon" onClick={undo} disabled={!state.past.length}><Icon name="undo" size={18} />Undo</button>
        {confirmReset ? (
          <>
            <button type="button" className="btn primary" onClick={() => { dispatch({ type: 'reset' }); setConfirmReset(false) }}>Yes, reset</button>
            <button type="button" className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
          </>
        ) : (
          <button type="button" className="btn btn-icon" onClick={() => setConfirmReset(true)} disabled={!state.total}><Icon name="reload" size={18} />Reset</button>
        )}
        <Toggle label="Vibrate" checked={vibrate} onChange={setVibrate} />
        <Toggle label="Click sound" checked={sound} onChange={setSound} />
      </div>

      <div className="stats">
        <div className="stat"><b><Roll>{String(state.total)}</Roll></b>This session</div>
        <div className="stat"><b><Roll>{String(state.rounds)}</Roll></b>Full rounds</div>
        <div className="stat"><b><Roll>{String(daily[dayKey()] ?? 0)}</Roll></b>Today</div>
      </div>

      <h3 className="ts-h">Last 7 days</h3>
      <div className="ts-week">
        {week.map((w) => (
          <div key={w.k} className="ts-day" title={`${w.k}: ${w.n}`}>
            <span className="ts-col"><i style={{ height: `${(w.n / maxDay) * 100}%` }} /></span>
            <b>{w.n}</b>
            <small>{w.label}</small>
          </div>
        ))}
      </div>
      <Hint>Tap the ring (or press Space, Enter or ↑) to count; Backspace or ↓ undoes. When a target is reached it buzzes and moves on to the next dhikr. Counts and daily totals stay on this device.</Hint>
    </div>
  )
}
