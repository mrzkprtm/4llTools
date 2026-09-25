import { useEffect, useRef, useState } from 'react'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { formatDuration } from './format'

function useTicker(active: boolean) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    let id = 0
    const loop = () => {
      setTick((t) => t + 1)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [active])
}

function beep() {
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
  } catch {
    // Sound is optional.
  }
  navigator.vibrate?.([200, 100, 200, 100, 200])
}

function Stopwatch() {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [laps, setLaps] = useState<number[]>([])
  const lapRows = useRef<HTMLTableSectionElement>(null)
  useFlip(lapRows, { max: 30 })
  useTicker(startedAt !== null)
  const current = elapsed + (startedAt !== null ? performance.now() - startedAt : 0)

  return (
    <div>
      <div className={`big-number ${startedAt !== null ? 'running' : ''}`}>{formatDuration(current)}</div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {startedAt === null ? (
          <button type="button" className="btn primary" onClick={() => setStartedAt(performance.now())}>{elapsed ? 'Resume' : 'Start'}</button>
        ) : (
          <button type="button" className="btn primary" onClick={() => { setElapsed(current); setStartedAt(null) }}>Pause</button>
        )}
        <button type="button" className="btn" onClick={() => setLaps([current, ...laps])} disabled={startedAt === null}>Lap</button>
        <button type="button" className="btn" onClick={() => { setStartedAt(null); setElapsed(0); setLaps([]) }} disabled={!current}>Reset</button>
      </div>
      {laps.length > 0 && (
        <table className="simple">
          <tbody ref={lapRows}>
            {laps.map((t, i) => (
              <tr key={laps.length - i} data-flip={String(laps.length - i)}><td>Lap {laps.length - i}</td><td>{formatDuration(t - (laps[i + 1] ?? 0))}</td><td className="muted">{formatDuration(t)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Timer() {
  const [minutes, setMinutes] = useState('5')
  const [seconds, setSeconds] = useState('0')
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [pausedLeft, setPausedLeft] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const fired = useRef(false)
  useTicker(endsAt !== null)

  const setMs = (Number(minutes) * 60 + Number(seconds)) * 1000
  const left = endsAt !== null ? endsAt - Date.now() : (pausedLeft ?? setMs)
  const [total, setTotal] = useState(setMs)

  useEffect(() => {
    if (endsAt !== null && left <= 0 && !fired.current) {
      fired.current = true
      setEndsAt(null)
      setPausedLeft(null)
      setDone(true)
      beep()
    }
  }, [endsAt, left])

  return (
    <div>
      {endsAt === null && pausedLeft === null && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <input type="number" min={0} max={999} value={minutes} onChange={(e) => setMinutes(e.target.value)} style={{ width: 90 }} aria-label="Minutes" /> min
          <input type="number" min={0} max={59} value={seconds} onChange={(e) => setSeconds(e.target.value)} style={{ width: 90 }} aria-label="Seconds" /> sec
        </div>
      )}
      <div className={`big-number ${done ? 'alarm' : ''}`} role={done ? 'alert' : undefined} style={done ? { color: 'var(--danger)' } : undefined}>{done ? "Time's up!" : <Roll>{formatDuration(left, false)}</Roll>}</div>
      {(endsAt !== null || pausedLeft !== null) && total > 0 && (
        <div className="bar" style={{ maxWidth: 360, margin: '0 auto 8px' }} aria-hidden="true">
          <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, left / total))})`, transition: 'none' }} />
        </div>
      )}
      <div className="row" style={{ justifyContent: 'center' }}>
        {endsAt === null ? (
          <button type="button" className="btn primary" disabled={left <= 0} onClick={() => { fired.current = false; setDone(false); if (pausedLeft === null) setTotal(left); setEndsAt(Date.now() + left); setPausedLeft(null) }}>
            {pausedLeft !== null ? 'Resume' : 'Start'}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => { setPausedLeft(left); setEndsAt(null) }}>Pause</button>
        )}
        <button type="button" className="btn" onClick={() => { setEndsAt(null); setPausedLeft(null); setDone(false) }}>Reset</button>
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        {[1, 3, 5, 10, 25].map((m) => (
          <button key={m} type="button" className="btn" disabled={endsAt !== null} onClick={() => { setMinutes(String(m)); setSeconds('0'); setPausedLeft(null); setDone(false) }}>{m} min</button>
        ))}
      </div>
    </div>
  )
}

export default function StopwatchTimer() {
  const [tab, setTab] = useState<'stopwatch' | 'timer'>('stopwatch')
  return (
    <div>
      <PillRow>
        <button type="button" className={`btn ${tab === 'stopwatch' ? 'primary' : ''}`} onClick={() => setTab('stopwatch')}>Stopwatch</button>
        <button type="button" className={`btn ${tab === 'timer' ? 'primary' : ''}`} onClick={() => setTab('timer')}>Timer</button>
      </PillRow>
      {tab === 'stopwatch' ? <Stopwatch /> : <Timer />}
    </div>
  )
}
