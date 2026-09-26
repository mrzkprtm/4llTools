import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

export default function EyeBreakTimer() {
  const [interval, setIntervalMin] = useState(20)
  const [duration, setDuration] = useState(20)
  const [running, setRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20 * 60)
  const [phase, setPhase] = useState<'work' | 'break'>('work')
  const [breaksDone, setBreaksDone] = useState(0)
  const audioRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!running) return
    const intervalId = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (phase === 'work') {
            setPhase('break')
            setTimeLeft(duration)
            playSound(880)
            navigator.vibrate?.(200)
          } else {
            setPhase('work')
            setTimeLeft(intervalMin * 60)
            setBreaksDone(b => b + 1)
            playSound(440)
            navigator.vibrate?.(100)
          }
          return phase === 'work' ? intervalMin * 60 : duration
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(intervalId)
  }, [running, phase, timeLeft, intervalMin, duration])

  const playSound = (freq: number) => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain).connect(ctx.destination)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } catch {}
  }

  const toggle = () => setRunning(r => !r)
  const reset = () => { setRunning(false); setPhase('work'); setTimeLeft(intervalMin * 60); setBreaksDone(0) }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Work Interval (min)</label>
          <input type="number" min={5} max={60} value={intervalMin} onChange={e => setIntervalMin(Number(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label>Break Duration (sec)</label>
          <input type="number" min={10} max={300} value={duration} onChange={e => setDuration(Number(e.target.value))} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{
          width: 240, height: 240, borderRadius: '50%',
          border: '8px solid var(--border)', position: 'relative',
          background: phase === 'work' ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'color-mix(in srgb, var(--ok) 10%, transparent)',
          transition: 'background 0.3s ease',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '4rem', fontWeight: 700, color: phase === 'work' ? 'var(--accent)' : 'var(--ok)' }}><Roll>{fmt(timeLeft)}</Roll></div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: phase === 'work' ? 'var(--accent)' : 'var(--ok)', textTransform: 'uppercase' }}>{phase === 'work' ? 'Work' : 'Break'}</div>
            <div style={{ fontSize: '1rem', color: 'var(--muted)' }}>{breaksDone} breaks done</div>
          </div>
          <svg width="280" height="280" viewBox="0 0 280 280" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="140" cy="140" r="120" fill="none" stroke="var(--border)" strokeWidth="16" />
            <circle
              cx="140" cy="140" r="120"
              fill="none" stroke={phase === 'work' ? 'var(--accent)' : 'var(--ok)'} strokeWidth="16" strokeLinecap="round"
              strokeDasharray={`${(phase === 'work' ? timeLeft / (intervalMin * 60) : timeLeft / duration) * 753.6} 753.6`}
              strokeDashoffset={0}
              style={{ transition: 'stroke-dasharray 0.1s linear' }}
            />
          </svg>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setRunning(r => !r)} style={{ minWidth: 140 }}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button className="btn" onClick={() => { setRunning(false); setTimeLeft(intervalMin * 60); setPhase('work'); setBreaksDone(0) }}>Reset</button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button className="btn" onClick={() => {
          const w = window.open('', '_blank', 'width=400,height=500')
          if (w) {
            w.document.write(`
              <html><head><title>20-20-20 Exercise</title>
              <style>body{font-family:sans-serif;padding:20px;text-align:center} h1{color:#e11d48} .step{margin:20px 0;padding:20px;border:1px solid #ddd;border-radius:8px} </style></head>
              <body>
                <h1>20-20-20 Eye Exercise</h1>
                <div class="step"><h3>1. Look Far</h3><p>Look at something 20 feet (6m) away for 20 seconds.</p></div>
                <div class="step"><h3>2. Blink</h3><p>Blink slowly 10 times to lubricate eyes.</p></div>
                <div class="step"><h3>3. Palming</h3><p>Rub hands together, place warm palms over closed eyes for 20 seconds.</p></div>
                <div class="step"><h3>4. Eye Rolls</h3><p>Roll eyes slowly: up, down, left, right. Repeat 5 times.</p></div>
                <div class="step"><h3>5. Focus Shift</h3><p>Hold thumb 10cm away, focus on it, then focus on distant object. Repeat 10x.</p></div>
              </body></html>
            `)
          }
        }} style={{ marginRight: 8 }}>View Exercise Guide</button>
      </div>

      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat"><b><Roll>{breaksDone}</Roll></b><span className="muted">Breaks Done</span></div>
        <div className="stat"><b><Roll>{Math.floor(breaksDone * duration / 60)}</Roll></b><span className="muted">Break Time (min)</span></div>
      </div>

      <Hint>20-20-20 rule: Every 20 min, look 20 ft away for 20 sec. Tap guide for exercises.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}