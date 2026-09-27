import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Session {
  id: number
  date: string
  task: string
  workDuration: number
  completed: number
  type: 'pomodoro' | 'short-break' | 'long-break'
}

const DEFAULT_SETTINGS = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartWork: false,
}

export default function PomodoroTimer() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('pomodoro-settings')
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
  })
  const [sessions, setSessions] = useState<Session[]>(() => {
    const saved = localStorage.getItem('pomodoro-sessions')
    return saved ? JSON.parse(saved) : []
  })
  const [currentTask, setCurrentTask] = useState('')
  const [phase, setPhase] = useState<'work' | 'short-break' | 'long-break'>('work')
  const [timeLeft, setTimeLeft] = useState(settings.workMinutes * 60)
  const [running, setRunning] = useState(false)
  const [completedPomodoros, setCompletedPomodoros] = useState(0)
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    try { localStorage.setItem('pomodoro-settings', JSON.stringify(settings)) } catch {}
  }, [settings])

  useEffect(() => {
    try { localStorage.setItem('pomodoro-sessions', JSON.stringify(sessions)) } catch {}
  }, [sessions])

  const getPhaseDuration = (p: typeof phase) => {
    switch (p) {
      case 'work': return settings.workMinutes * 60
      case 'short-break': return settings.shortBreakMinutes * 60
      case 'long-break': return settings.longBreakMinutes * 60
    }
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            handlePhaseComplete()
            return getPhaseDuration(getNextPhase())
          }
          return t - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const getNextPhase = () => {
    if (phase === 'work') {
      const nextCount = completedPomodoros + 1
      return nextCount % settings.longBreakInterval === 0 ? 'long-break' : 'short-break'
    }
    return 'work'
  }

  const handlePhaseComplete = () => {
    if (phase === 'work') {
      const newCount = completedPomodoros + 1
      setCompletedPomodoros(newCount)
      setSessions([...sessions, {
        id: Date.now(),
        date: new Date().toISOString(),
        task: currentTask || 'No task',
        workDuration: settings.workMinutes,
        completed: newCount,
        type: 'pomodoro',
      }])
      const nextPhase = getNextPhase()
      setPhase(nextPhase)
      if (settings.autoStartBreaks) setRunning(true)
      else setRunning(false)
    } else {
      setPhase('work')
      if (settings.autoStartWork) setRunning(true)
      else setRunning(false)
    }
  }

  const toggle = () => setRunning(!running)
  const reset = () => {
    setRunning(false)
    setTimeLeft(getPhaseDuration(phase))
  }
  const skip = () => {
    handlePhaseComplete()
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const phaseColors = { work: 'var(--danger)', 'short-break': 'var(--ok)', 'long-break': '#3b82f6' }
  const phaseLabels = { work: 'Focus Time', 'short-break': 'Short Break', 'long-break': 'Long Break' }
  const phaseIcons = { work: '🍅', 'short-break': '☕', 'long-break': '🌳' }

  const todaySessions = sessions.filter(s => s.date.startsWith(new Date().toISOString().split('T')[0]))
  const totalFocusToday = todaySessions.filter(s => s.type === 'pomodoro').reduce((sum, s) => sum + s.workDuration, 0)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Pomodoro Timer</h3>
        <div className="row" style={{ gap: 8 }}>
          <div className="stat"><b><Roll value={completedPomodoros} /></b><span className="muted">Pomodoros</span></div>
          <div className="stat"><b><Roll value={totalFocusToday} /></b><span className="muted">Min Today</span></div>
        </div>
      </div>

      <div className="pop-row" style={{ padding: 24, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: '3rem' }}>{phaseIcons[phase]}</span>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: phaseColors[phase] }}>{phaseLabels[phase]}</div>
            <div className="muted">Session #{completedPomodoros + 1}</div>
          </div>
        </div>

        <input type="text" placeholder="Current task..." value={currentTask} onChange={e => setCurrentTask(e.target.value)} style={{ textAlign: 'center', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px 16px', fontSize: '1rem', marginBottom: 24, maxWidth: 300 }} />

        <div style={{ fontSize: '5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: phaseColors[phase], lineHeight: 1, marginBottom: 24 }}>
          <Roll value={formatTime(timeLeft)} />
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="btn" onClick={toggle} style={{ padding: '12px 24px', fontSize: '1.1rem', minWidth: 120, background: running ? 'var(--danger)' : 'var(--ok)' }}>
            {running ? 'Pause' : 'Start'}
          </button>
          <button className="btn" onClick={reset} style={{ padding: '12px 24px', fontSize: '1.1rem', minWidth: 100 }}>Reset</button>
          <button className="btn" onClick={skip} style={{ padding: '12px 24px', fontSize: '1.1rem', minWidth: 100 }}>Skip</button>
        </div>

        <div style={{ marginTop: 16, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            width: `${((getPhaseDuration(phase) - timeLeft) / getPhaseDuration(phase)) * 100}%`,
            height: '100%', background: phaseColors[phase], borderRadius: 4, transition: 'width 1s linear'
          }} />
        </div>
      </div>

      <details style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Settings</summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Work (min)</span>
            <input type="number" min={1} max={120} value={settings.workMinutes} onChange={e => { setSettings({ ...settings, workMinutes: Number(e.target.value) }); if (phase === 'work' && !running) setTimeLeft(Number(e.target.value) * 60) }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Short Break (min)</span>
            <input type="number" min={1} max={60} value={settings.shortBreakMinutes} onChange={e => { setSettings({ ...settings, shortBreakMinutes: Number(e.target.value) }); if (phase === 'short-break' && !running) setTimeLeft(Number(e.target.value) * 60) }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Long Break (min)</span>
            <input type="number" min={1} max={120} value={settings.longBreakMinutes} onChange={e => { setSettings({ ...settings, longBreakMinutes: Number(e.target.value) }); if (phase === 'long-break' && !running) setTimeLeft(Number(e.target.value) * 60) }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Long Break Every</span>
            <input type="number" min={1} max={10} value={settings.longBreakInterval} onChange={e => setSettings({ ...settings, longBreakInterval: Number(e.target.value) })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.autoStartBreaks} onChange={e => setSettings({ ...settings, autoStartBreaks: e.target.checked })} />
            <span>Auto-start breaks</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={settings.autoStartWork} onChange={e => setSettings({ ...settings, autoStartWork: e.target.checked })} />
            <span>Auto-start work</span>
          </label>
        </div>
      </details>

      <details style={{ background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Session History ({sessions.length} total)</summary>
        <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 12 }}>
          {sessions.slice().reverse().map((session, i) => (
            <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{session.task}</div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>{new Date(session.date).toLocaleString('id-ID')}</div>
              </div>
              <div className="row" style={{ gap: 16, alignItems: 'center' }}>
                <span className="muted">{session.workDuration} min</span>
                <span style={{ color: 'var(--accent)' }}>#{session.completed}</span>
              </div>
            </div>
          ))}
          {sessions.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 24 }}>No sessions yet. Complete a Pomodoro to see history.</p>}
        </div>
      </details>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Classic Pomodoro: 25 min work, 5 min short break, 15 min long break every 4 cycles. Sessions saved locally.
      </p>
    </div>
  )
}