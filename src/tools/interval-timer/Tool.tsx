import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const PRESETS = [
  { name: 'Tabata', work: 20, rest: 10, rounds: 8, cycles: 1 },
  { name: 'HIIT 1:2', work: 30, rest: 60, rounds: 10, cycles: 1 },
  { name: 'HIIT 1:1', work: 40, rest: 40, rounds: 8, cycles: 1 },
  { name: 'Custom', work: 30, rest: 30, rounds: 8, cycles: 1 },
] as const

type Phase = 'work' | 'rest' | 'idle' | 'done'

export default function IntervalTimer() {
  const [presetIdx, setPresetIdx] = useState(0)
  const [work, setWork] = useState(30)
  const [rest, setRest] = useState(30)
  const [rounds, setRounds] = useState(8)
  const [cycles, setCycles] = useState(1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [phaseTime, setPhaseTime] = useState(0)
  const [round, setRound] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [running, setRunning] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  const preset = PRESETS[presetIdx]
  const isCustom = preset.name === 'Custom'

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      setPhaseTime(t => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [running])

  useEffect(() => {
    if (!running) return
    const totalWork = work
    const totalRest = rest
    const phaseDuration = phase === 'work' ? totalWork : totalRest

    if (phaseTime >= phaseDuration) {
      if (phase === 'work') {
        setPhase('rest')
        setPhaseTime(0)
        playSound(220)
      } else {
        if (round + 1 >= rounds) {
          if (cycle + 1 >= cycles) {
            setPhase('done')
            setRunning(false)
            playSound(880)
            navigator.vibrate?.([200, 100, 200])
          } else {
            setCycle(c => c + 1)
            setRound(0)
            setPhase('work')
            setPhaseTime(0)
            playSound(440)
          }
        } else {
          setRound(r => r + 1)
          setPhase('work')
          setPhaseTime(0)
          playSound(440)
        }
      }
    }
  }, [running, phaseTime, phase, round, cycle, work, rest, rounds, cycles])

  const playSound = (freq: number) => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain).connect(ctx.destination)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {}
    navigator.vibrate?.(phase === 'work' ? 100 : 50)
  }

  const toggle = () => {
    if (running) setRunning(false)
    else { setPhase('work'); setPhaseTime(0); setRound(0); setCycle(0); setRunning(true) }
  }

  const reset = () => { setRunning(false); setPhase('idle'); setPhaseTime(0); setRound(0); setCycle(0) }

  const totalRounds = rounds * cycles
  const currentRound = cycle * rounds + round + 1
  const progress = phase === 'idle' ? 0 : phaseTime / (phase === 'work' ? work : rest)

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        {PRESETS.map((p, i) => (
          <button key={p.name} className={`btn ${presetIdx === i ? 'primary' : ''}`} onClick={() => { setPresetIdx(i); if (!isCustom) { setWork(p.work); setRest(p.rest); setRounds(p.rounds); setCycles(p.cycles) } }}>
            {p.name}
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
          <input type="number" min={5} max={120} value={work} onChange={e => setWork(Number(e.target.value))} placeholder="Work (s)" style={{ width: 100 }} />
          <input type="number" min={0} max={120} value={rest} onChange={e => setRest(Number(e.target.value))} placeholder="Rest (s)" style={{ width: 100 }} />
          <input type="number" min={1} max={50} value={rounds} onChange={e => setRounds(Number(e.target.value))} placeholder="Rounds" style={{ width: 100 }} />
          <input type="number" min={1} max={10} value={cycles} onChange={e => setCycles(Number(e.target.value))} placeholder="Cycles" style={{ width: 100 }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{
          width: 280, height: 280, borderRadius: '50%',
          border: '8px solid var(--border)', position: 'relative',
          background: phase === 'work' ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : phase === 'rest' ? 'color-mix(in srgb, var(--ok) 10%, transparent)' : 'var(--sunken)',
          transition: reducedMotion() ? 'none' : 'background 0.3s ease',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '4rem', fontWeight: 700, color: phase === 'work' ? 'var(--accent)' : phase === 'rest' ? 'var(--ok)' : 'var(--text)' }}><Roll>{phaseTime}</Roll>s</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: phase === 'work' ? 'var(--accent)' : phase === 'rest' ? 'var(--ok)' : 'var(--text)', textTransform: 'uppercase' }}>{phase === 'idle' ? 'Ready' : phase === 'done' ? 'Done!' : phase}</div>
            <div style={{ fontSize: '1rem', color: 'var(--muted)' }}>Round {round + 1}/{rounds} · Cycle {cycle + 1}/{cycles}</div>
          </div>
          <svg width="280" height="280" viewBox="0 0 280 280" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="140" cy="140" r="120" fill="none" stroke="var(--border)" strokeWidth="16" />
            <circle
              cx="140" cy="140" r="120"
              fill="none" stroke={phase === 'work' ? 'var(--accent)' : 'var(--ok)'} strokeWidth="16" strokeLinecap="round"
              strokeDasharray={`${progress * 753.6} 753.6`}
              strokeDashoffset={0}
              style={{ transition: reducedMotion() ? 'none' : 'stroke-dasharray 0.1s linear' }}
            />
          </svg>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn primary" style={{ minWidth: 140 }} onClick={toggle} disabled={phase === 'done'}>
          {running ? 'Pause' : phase === 'idle' ? 'Start' : phase === 'done' ? 'Done' : 'Resume'}
        </button>
        <button className="btn" onClick={reset} disabled={phase === 'idle'}>Reset</button>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
        {phase !== 'idle' && phase !== 'done' && `${phase === 'work' ? 'Work' : 'Rest'} · Round ${round + 1}/${rounds} · Cycle ${cycle + 1}/${cycles}`}
      </div>

      <Hint>Choose preset or customize. Work/rest intervals with sound cues. Tracks rounds and cycles.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}