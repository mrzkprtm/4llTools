import { useEffect, useReducer, useRef, useState, type ChangeEvent } from 'react'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { DEFAULT_SETTINGS, initState, lengthOf, mmss, PHASE_LABEL, reducer, remaining, todayKey, type Phase, type Settings } from './pomodoro'
import './tool.css'

interface Task {
  id: number
  name: string
  count: number
  done: boolean
}

interface Stats {
  day: string
  sessions: number
  minutes: number
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage is optional.
  }
}

function chime(kind: Phase) {
  try {
    const ctx = new AudioContext()
    const notes = kind === 'focus' ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25]
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      osc.connect(gain).connect(ctx.destination)
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      osc.start(t)
      osc.stop(t + 0.95)
    })
    setTimeout(() => void ctx.close(), 1800)
  } catch {
    // Sound is optional.
  }
}

const R = 110
const C = 2 * Math.PI * R

export default function Pomodoro() {
  const [state, dispatch] = useReducer(reducer, DEFAULT_SETTINGS, initState)
  const [now, setNow] = useState(() => Date.now())
  const [tasks, setTasks] = useState<Task[]>([
    { id: 1, name: 'Write project outline', count: 0, done: false },
    { id: 2, name: 'Review pull requests', count: 0, done: false },
  ])
  const [active, setActive] = useState<number | null>(1)
  const [draft, setDraft] = useState('')
  const [stats, setStats] = useState<Stats>({ day: '', sessions: 0, minutes: 0 })
  const [sound, setSound] = useState(true)
  const [notify, setNotify] = useState<NotificationPermission | 'unsupported'>('default')
  const [flash, setFlash] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  const ready = useRef(false)
  const lastFinished = useRef(0)
  const soundRef = useRef(sound)
  soundRef.current = sound
  useFlip(list)

  // Restore saved tasks, settings and today's stats after mount.
  useEffect(() => {
    const s = load<Partial<Settings>>('pomodoro-settings', {})
    dispatch({ type: 'settings', settings: s })
    setTasks(load('pomodoro-tasks', tasks))
    const st = load<Stats>('pomodoro-stats', { day: todayKey(), sessions: 0, minutes: 0 })
    setStats(st.day === todayKey() ? st : { day: todayKey(), sessions: 0, minutes: 0 })
    setNotify(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
    ready.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (ready.current) save('pomodoro-tasks', tasks) }, [tasks])
  useEffect(() => { if (ready.current) save('pomodoro-settings', state.settings) }, [state.settings])
  useEffect(() => { if (ready.current && stats.day) save('pomodoro-stats', stats) }, [stats])

  // Timing comes from Date.now() deltas, so a throttled background tab stays accurate.
  useEffect(() => {
    if (!state.running) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      dispatch({ type: 'tick', now: t })
    }, 250)
    return () => clearInterval(id)
  }, [state.running])

  // A phase just ended on its own.
  useEffect(() => {
    if (state.finished === lastFinished.current) return
    lastFinished.current = state.finished
    const ended = state.lastFinished!
    setFlash((f) => f + 1)
    if (soundRef.current) chime(ended)
    if (ended === 'focus') {
      const day = todayKey()
      setStats((s) => (s.day === day ? { ...s, sessions: s.sessions + 1, minutes: s.minutes + state.settings.focus } : { day, sessions: 1, minutes: state.settings.focus }))
      if (active !== null) setTasks((ts) => ts.map((t) => (t.id === active ? { ...t, count: t.count + 1 } : t)))
    }
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(ended === 'focus' ? 'Focus session done. Time for a break.' : 'Break over. Back to focus.', { body: `Next: ${PHASE_LABEL[state.phase]} (${state.settings[state.phase]} min)`, tag: 'pomodoro' })
      }
    } catch {
      // Some mobile browsers only allow notifications from a service worker.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.finished])

  const left = remaining(state, now)
  const total = lengthOf(state.phase, state.settings)
  const touched = state.running || left !== total

  // Countdown in the tab title.
  useEffect(() => {
    const original = document.title
    return () => { document.title = original }
  }, [])
  useEffect(() => {
    if (!ready.current) return
    const base = document.title.replace(/^\d\d:\d\d [·•] (Focus|Short break|Long break) [·•] /, '')
    document.title = touched ? `${mmss(left)} · ${PHASE_LABEL[state.phase]} · ${base}` : base
  }, [left, touched, state.phase])

  // Space starts/pauses, R resets, S skips (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest('input, textarea, select, button, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === ' ') {
        e.preventDefault()
        dispatch({ type: state.running ? 'pause' : 'start', now: Date.now() })
        setNow(Date.now())
      } else if (k === 'r') dispatch({ type: 'reset' })
      else if (k === 's') dispatch({ type: 'skip', now: Date.now() })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.running])

  function toggle() {
    const t = Date.now()
    setNow(t)
    dispatch({ type: state.running ? 'pause' : 'start', now: t })
  }

  async function askNotify() {
    if (typeof Notification === 'undefined') return setNotify('unsupported')
    try {
      setNotify(await Notification.requestPermission())
    } catch {
      setNotify('denied')
    }
  }

  function addTask() {
    const name = draft.trim()
    if (!name) return
    const id = Date.now()
    setTasks([...tasks, { id, name, count: 0, done: false }])
    if (active === null) setActive(id)
    setDraft('')
  }

  const setting = (k: 'focus' | 'short' | 'long' | 'longEvery', max: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = Math.round(Number(e.target.value))
    if (v >= 1 && v <= max) dispatch({ type: 'settings', settings: { [k]: v } })
  }
  const inCycle = state.done % state.settings.longEvery
  const activeTask = tasks.find((t) => t.id === active)

  return (
    <div>
      <PillRow label="Phase" style={{ justifyContent: 'center' }}>
        {(['focus', 'short', 'long'] as Phase[]).map((p) => (
          <button key={p} type="button" className={`btn ${state.phase === p ? 'primary' : ''}`} aria-pressed={state.phase === p} onClick={() => dispatch({ type: 'phase', phase: p })}>{PHASE_LABEL[p]}</button>
        ))}
      </PillRow>

      <div className={`po-stage ${state.phase} ${state.running ? 'running' : ''}`}>
        <svg key={flash} className={`po-ring ${flash ? 'po-flash' : ''}`} viewBox="0 0 260 260" role="timer" aria-label={`${PHASE_LABEL[state.phase]}: ${mmss(left)} left`} style={{ borderRadius: '50%' }}>
          <circle className="po-track" cx={130} cy={130} r={R} />
          <circle className="po-prog" cx={130} cy={130} r={R} strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} />
          <text className="po-time" x={130} y={140} textAnchor="middle">{mmss(left)}</text>
          <text className="po-phase" x={130} y={172} textAnchor="middle">{state.running ? PHASE_LABEL[state.phase] : touched ? 'Paused' : PHASE_LABEL[state.phase]}</text>
        </svg>
        <div className="po-dots" aria-label={`${inCycle} of ${state.settings.longEvery} focus sessions before a long break`}>
          {Array.from({ length: state.settings.longEvery }, (_, i) => <i key={i} className={i < inCycle ? 'on' : ''} />)}
        </div>
        {activeTask && <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.88rem', textAlign: 'center' }}>Working on: <b style={{ color: 'var(--text)' }}>{activeTask.name}</b></p>}
      </div>

      <div className="row po-controls">
        <button type="button" className="btn primary" onClick={toggle}>{state.running ? 'Pause' : touched ? 'Resume' : 'Start'}</button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'reset' })} disabled={!touched}>Reset</button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'skip', now: Date.now() })}>Skip →</button>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: '0.8rem', margin: 0 }}>
        <span className="po-kbd">Space</span> start/pause · <span className="po-kbd">R</span> reset · <span className="po-kbd">S</span> skip
      </p>

      <div className="po-cols">
        <div>
          <h2 style={{ fontSize: '1.05rem', margin: '14px 0 0' }}>Tasks</h2>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.84rem' }}>Pick a task; each finished focus session adds a 🍅 to it.</p>
          <ul className="po-tasks" ref={list}>
            {tasks.map((t) => (
              <li key={t.id} data-flip={String(t.id)} className={`po-task ${t.id === active ? 'active' : ''} ${t.done ? 'done' : ''}`}>
                <input type="checkbox" checked={t.done} aria-label={`Mark "${t.name}" done`} onChange={(e) => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: e.target.checked } : x)))} />
                <button type="button" className="po-name" aria-pressed={t.id === active} onClick={() => setActive(t.id)}>{t.name}</button>
                <span className="po-count" aria-label={`${t.count} pomodoros`}>🍅 <b key={t.count} className={t.count ? 'pop' : ''}>{t.count}</b></span>
                <button type="button" className="po-x" aria-label={`Delete "${t.name}"`} onClick={() => { setTasks(tasks.filter((x) => x.id !== t.id)); if (active === t.id) setActive(null) }}>×</button>
              </li>
            ))}
          </ul>
          <div className="po-add" style={{ marginTop: 8 }}>
            <label htmlFor="po-new" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>New task</label>
            <input id="po-new" type="text" placeholder="Add a task…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTask() }} maxLength={120} />
            <button type="button" className="btn" onClick={addTask} disabled={!draft.trim()}>Add</button>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '1.05rem', margin: '14px 0 0' }}>Today</h2>
          <div className="stats" style={{ marginTop: 8 }}>
            <div className="stat"><b><Roll>{stats.sessions}</Roll></b>focus sessions</div>
            <div className="stat"><b><Roll>{`${Math.floor(stats.minutes / 60)}h ${stats.minutes % 60}m`}</Roll></b>focused</div>
          </div>
          <details style={{ marginTop: 14 }}>
            <summary>Settings</summary>
            <div className="po-settings">
              <div><label htmlFor="po-f">Focus (min)</label><input id="po-f" type="number" min={1} max={180} value={state.settings.focus} onChange={setting('focus', 180)} /></div>
              <div><label htmlFor="po-s">Short break</label><input id="po-s" type="number" min={1} max={60} value={state.settings.short} onChange={setting('short', 60)} /></div>
              <div><label htmlFor="po-l">Long break</label><input id="po-l" type="number" min={1} max={120} value={state.settings.long} onChange={setting('long', 120)} /></div>
              <div><label htmlFor="po-e">Long break every</label><input id="po-e" type="number" min={1} max={12} value={state.settings.longEvery} onChange={setting('longEvery', 12)} /></div>
            </div>
            <label className="row" style={{ fontWeight: 500, margin: '12px 0 0', gap: 8, display: 'flex' }}>
              <input type="checkbox" checked={state.settings.autoStart} onChange={(e) => dispatch({ type: 'settings', settings: { autoStart: e.target.checked } })} /> Start the next phase automatically
            </label>
            <label className="row" style={{ fontWeight: 500, margin: '8px 0 0', gap: 8, display: 'flex' }}>
              <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} /> Play a chime when a phase ends
            </label>
            <div className="row">
              {notify === 'granted' ? <span className="chip good">Notifications on</span>
                : notify === 'denied' ? <span className="chip bad calm">Notifications blocked in browser settings</span>
                : notify === 'unsupported' ? <span className="muted" style={{ fontSize: '0.85rem' }}>This browser does not support notifications.</span>
                : <button type="button" className="btn" onClick={askNotify}>Enable desktop notifications</button>}
              <button type="button" className="btn" onClick={() => chime('focus')}>Test sound</button>
            </div>
          </details>
        </div>
      </div>

      <p className="muted">
        The Pomodoro Technique: work for 25 minutes, take a 5-minute break, and after four rounds take a longer 15–30 minute break. The timer keeps correct time even when this tab is in the background, but browsers may delay the chime until you return; turn on notifications to be alerted. Tasks and stats are saved only in this browser.
      </p>
    </div>
  )
}
