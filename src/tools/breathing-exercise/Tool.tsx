import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const PATTERNS = [
  { name: 'Box Breathing', inhale: 4, hold: 4, exhale: 4, hold2: 4, color: '#e11d48' },
  { name: '4-7-8 Breathing', inhale: 4, hold: 7, exhale: 8, hold2: 0, color: '#8b5cf6' },
  { name: 'Coherent Breathing', inhale: 5.5, hold: 0, exhale: 5.5, hold2: 0, color: '#06b6d4' },
  { name: 'Custom', inhale: 4, hold: 4, exhale: 4, hold2: 4, color: '#84cc16' },
] as const

type Phase = 'inhale' | 'hold' | 'exhale' | 'hold2' | 'idle'

export default function BreathingExercise() {
  const [patternIdx, setPatternIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [phaseTime, setPhaseTime] = useState(0)
  const [sessionTime, setSessionTime] = useState(0)
  const [running, setRunning] = useState(false)
  const [customPattern, setCustomPattern] = useState({ inhale: 4, hold: 4, exhale: 4, hold2: 4 })
  const circleRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<AudioContext | null>(null)

  const pattern = PATTERNS[patternIdx]
  const isCustom = pattern.name === 'Custom'

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      setPhaseTime(t => t + 1)
      setSessionTime(t => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [running])

  useEffect(() => {
    if (!running) return
    const phases: Phase[] = ['inhale', 'hold', 'exhale', 'hold2']
    let currentPhaseIdx = 0
    let phaseStart = 0

    const getPhaseDuration = (p: Phase) => {
      if (p === 'inhale') return pattern.inhale
      if (p === 'hold') return pattern.hold
      if (p === 'exhale') return pattern.exhale
      return pattern.hold2
    }

    const checkPhase = () => {
      const duration = getPhaseDuration(phases[currentPhaseIdx])
      if (phaseTime - phaseStart >= duration) {
        currentPhaseIdx = (currentPhaseIdx + 1) % phases.length
        phaseStart = phaseTime
        setPhase(phases[currentPhaseIdx])
        if (phases[currentPhaseIdx] === 'inhale') playSound(440)
        else if (phases[currentPhaseIdx] === 'exhale') playSound(220)
      }
    }

    checkPhase()
    const interval = setInterval(checkPhase, 1000)
    return () => clearInterval(interval)
  }, [running, phaseTime, pattern])

  const playSound = (freq: number) => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext()
      const ctx = audioRef.current!
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

  const toggle = () => {
    if (running) {
      setRunning(false)
    } else {
      setPhase('inhale')
      setPhaseTime(0)
      setSessionTime(0)
      setRunning(true)
    }
  }

  const totalCycle = pattern.inhale + pattern.hold + pattern.exhale + pattern.hold2
  const progress = totalCycle > 0 ? (phaseTime % totalCycle) / totalCycle : 0

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        {PATTERNS.map((p, i) => (
          <button
            key={p.name}
            className={`btn ${i === patternIdx ? 'primary' : ''}`}
            onClick={() => { setPatternIdx(i); if (i === PATTERNS.length - 1) setCustomPattern({ inhale: 4, hold: 4, exhale: 4, hold2: 4 }) }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {isCustom && (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
          <input type="number" min={1} max={30} step={0.5} value={customPattern.inhale} onChange={e => setCustomPattern({ ...customPattern, inhale: Number(e.target.value) })} placeholder="Inhale" style={{ width: 80 }} />
          <input type="number" min={0} max={30} step={0.5} value={customPattern.hold} onChange={e => setCustomPattern({ ...customPattern, hold: Number(e.target.value) })} placeholder="Hold" style={{ width: 80 }} />
          <input type="number" min={1} max={30} step={0.5} value={customPattern.exhale} onChange={e => setCustomPattern({ ...customPattern, exhale: Number(e.target.value) })} placeholder="Exhale" style={{ width: 80 }} />
          <input type="number" min={0} max={30} step={0.5} value={customPattern.hold2} onChange={e => setCustomPattern({ ...customPattern, hold2: Number(e.target.value) })} placeholder="Hold" style={{ width: 80 }} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div
          ref={circleRef}
          style={{
            width: 280,
            height: 280,
            borderRadius: '50%',
            border: '4px solid var(--border)',
            background: `radial-gradient(circle at center, ${pattern.color}22, transparent)`,
            position: 'relative',
            transition: reducedMotion() ? 'none' : 'transform 0.3s ease, box-shadow 0.3s ease',
            boxShadow: running ? `0 0 40px ${pattern.color}44, inset 0 0 60px ${pattern.color}22` : 'none',
            transform: running ? `scale(${0.8 + progress * 0.4})` : 'scale(1)',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '3rem', fontWeight: 700, color: pattern.color }}><Roll>{sessionTime}s</Roll></div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{phase}</div>
            <div style={{ fontSize: '1rem', color: 'var(--muted)' }}>{pattern.name}</div>
          </div>
          {!reducedMotion() && running && (
            <div style={{
              position: 'absolute',
              inset: -20,
              borderRadius: '50%',
              border: `4px solid ${pattern.color}`,
              opacity: 1 - progress,
              animation: 'breathe 4s ease-in-out infinite',
            }} />
          )}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn primary" onClick={toggle} style={{ minWidth: 140 }}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button className="btn" onClick={() => { setRunning(false); setPhase('idle'); setPhaseTime(0); setSessionTime(0) }}>Reset</button>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
        {phase !== 'idle' && `Cycle: ${pattern.inhale}s in${pattern.hold ? `, ${pattern.hold}s hold` : ''}, ${pattern.exhale}s out${pattern.hold2 ? `, ${pattern.hold2}s hold` : ''}`}
      </div>

      <Hint>Choose a pattern or create custom. Circle expands on inhale, contracts on exhale. Sound cues for phase changes.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}