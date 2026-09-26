import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

interface Timer {
  id: number
  name: string
  duration: number
  remaining: number
  running: boolean
}

export default function KitchenTimers() {
  const [timers, setTimers] = useState<Timer[]>(() => {
    const saved = localStorage.getItem('kitchen-timers')
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Pasta', duration: 600, remaining: 600, running: false },
      { id: 2, name: 'Rice', duration: 1200, remaining: 1200, running: false },
    ]
  })
  const [newName, setNewName] = useState('')

  useEffect(() => {
    try { localStorage.setItem('kitchen-timers', JSON.stringify(timers)) } catch {}
  }, [timers])

  useEffect(() => {
    if (!timers.some(t => t.running)) return
    const interval = setInterval(() => {
      setTimers(ts => ts.map(t => {
        if (!t.running) return t
        if (t.remaining <= 1) {
          if (t.remaining > 0) playSound()
          return { ...t, remaining: 0, running: false }
        }
        return { ...t, remaining: t.remaining - 1 }
      }))
    }, 1000)
    return () => clearInterval(interval)
  }, [timers])

  const playSound = () => {
    try {
      const ctx = new AudioContext()
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        osc.connect(gain).connect(ctx.destination)
        const t = ctx.currentTime + i * 0.4
        gain.gain.setValueAtTime(0.3, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        osc.start(t)
        osc.stop(t + 0.3)
      }
    } catch {}
    navigator.vibrate?.([200, 100, 200])
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const addTimer = () => {
    if (!newName.trim()) return
    setTimers([...timers, { id: Date.now(), name: newName, duration: 300, remaining: 300, running: false }])
    setNewName('')
  }

  const removeTimer = (id: number) => {
    setTimers(timers.filter(t => t.id !== id))
  }

  const toggleTimer = (id: number) => {
    setTimers(timers.map(t => t.id === id ? { ...t, running: !t.running } : t))
  }

  const resetTimer = (id: number) => {
    setTimers(timers.map(t => t.id === id ? { ...t, remaining: t.duration, running: false } : t))
  }

  const addTime = (id: number, seconds: number) => {
    setTimers(timers.map(t => t.id === id ? { ...t, remaining: t.remaining + seconds, duration: t.duration + seconds } : t))
  }

  return (
    <div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        <input type="text" placeholder="Timer name" value={newName} onChange={e => setNewName(e.target.value)} style={{ minWidth: 150 }} />
        <button className="btn primary" onClick={addTimer} disabled={!newName.trim()}>Add Timer</button>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {timers.map(timer => (
          <div key={timer.id} className="pop-row" style={{
            display: 'flex', flexDirection: 'column', gap: 8, padding: 12,
            background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both'
          }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <input type="text" value={timer.name} onChange={e => setTimers(timers.map(t => t.id === timer.id ? { ...t, name: e.target.value } : t))} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '1.1rem', minWidth: 100 }} />
              <button className="btn" onClick={() => removeTimer(timer.id)} style={{ color: 'var(--danger)' }}>✕</button>
            </div>

            <div style={{ position: 'relative', height: 60, background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: `${(timer.remaining / timer.duration) * 100}%`,
                background: timer.running ? 'linear-gradient(90deg, var(--accent), var(--ok))' : 'var(--border)',
                borderRadius: '0 0 var(--radius) var(--radius)',
                transition: reducedMotion() ? 'none' : 'height 0.5s ease',
              }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: '1.5rem', fontWeight: 700, color: timer.running ? 'var(--accent)' : 'var(--text)' }}><Roll>{fmt(timer.remaining)}</Roll></span>
              </div>
            </div>

            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn" onClick={() => toggleTimer(timer.id)} disabled={timer.remaining === 0 && timer.duration === 0}>
                {timer.running ? 'Pause' : timer.remaining > 0 ? 'Resume' : 'Start'}
              </button>
              <button className="btn" onClick={() => resetTimer(timer.id)} disabled={timer.remaining === timer.duration}>Reset</button>
              <div className="row" style={{ gap: 4 }}>
                {[30, 60, 300].map(s => (
                  <button key={s} className="btn" onClick={() => addTime(timer.id, s)}>+{s}s</button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Hint>Each timer is a stove burner. Flame shrinks as time runs out. Add multiple timers for different dishes.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}