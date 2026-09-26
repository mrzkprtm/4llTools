import { useEffect, useRef, useState } from 'react'
import { Hint } from '../../sim/controls'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { tempoName } from '../metronome/logic'
import { addTap, estimateBpm, intervals, RESET_GAP, steadiness } from './logic'
import './tool.css'

export default function BpmTapper() {
  const [taps, setTaps] = useState<number[]>([])
  const [mult, setMult] = useState(1)
  const [hit, setHit] = useState(0)
  const [idle, setIdle] = useState(true)
  const still = useRef(reducedMotion())
  const tapRef = useRef<() => void>(() => {})

  function tap() {
    const now = performance.now()
    const next = addTap(taps, now)
    if (next.length === 1) setMult(1)
    setTaps(next)
    setHit((h) => h + 1)
    setIdle(false)
  }
  tapRef.current = tap

  // Space or Enter taps too (unless typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, button, a')) return
      e.preventDefault()
      tapRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // After a 2 s pause the next tap starts over; show that we are waiting.
  useEffect(() => {
    if (!taps.length) return
    const id = setTimeout(() => setIdle(true), RESET_GAP)
    return () => clearTimeout(id)
  }, [taps])

  const est = estimateBpm(taps)
  const bpm = est ? est.bpm * mult : 0
  const period = bpm ? 60 / bpm : 1
  const ivs = intervals(taps).slice(-16)
  const maxIv = Math.max(1, ...ivs)
  const shown = bpm ? bpm.toFixed(1) : '0.0'
  const [whole, frac] = shown.split('.')

  return (
    <div className="bt">
      <div className="bt-stage">
        <button
          type="button"
          className="bt-pad"
          onPointerDown={(e) => { e.preventDefault(); tap() }}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) tap() } }}
          aria-label="Tap along with the beat"
        >
          {bpm > 0 && !still.current && <span key={`r${hit}`} className="bt-ring" style={{ animationDuration: `${period}s` }} />}
          {hit > 0 && <span key={`f${hit}`} className="bt-flash" />}
          <span className="bt-readout" aria-live="polite">
            <b><Roll>{whole}</Roll><small>.{frac}</small></b>
            <span>BPM</span>
          </span>
          <span className="bt-sub">{taps.length < 2 ? (taps.length ? 'Keep tapping…' : 'Tap here') : `${tempoName(bpm)} · ${taps.length} taps`}</span>
        </button>
      </div>

      <div className="row bt-actions">
        <button type="button" className="btn" disabled={!bpm} onClick={() => setMult((m) => m / 2)}>½ Half</button>
        <button type="button" className="btn" disabled={!bpm} onClick={() => setMult((m) => m * 2)}>2× Double</button>
        <button type="button" className="btn" disabled={!taps.length} onClick={() => { setTaps([]); setMult(1); setIdle(true) }}>Reset</button>
        {taps.length > 0 && idle && <span className="chip settle-in">Paused. Next tap starts fresh</span>}
      </div>

      <div className="two-col">
        <div className="bt-card">
          <div className="sim-label"><span>Stability</span><span className="sim-val">{est && ivs.length > 2 ? `±${est.sd.toFixed(0)} ms` : '–'}</span></div>
          <div className="bar bt-meter"><i style={{ transform: `scaleX(${est && ivs.length > 2 ? est.stability : 0})`, background: est && est.stability > 0.65 ? 'var(--ok)' : 'var(--accent)' }} /></div>
          <p className="muted bt-note">{est && ivs.length > 2 ? steadiness(est.stability) : 'Tap at least four times to judge steadiness.'}</p>
        </div>
        <div className="bt-card">
          <div className="sim-label"><span>Tap intervals</span><span className="sim-val">{est ? `${(60000 / est.bpm).toFixed(0)} ms avg` : ''}</span></div>
          <svg viewBox="0 0 160 60" className="bt-spark" role="img" aria-label="Recent tap intervals">
            {ivs.map((d, i) => {
              const h = (d / maxIv) * 54
              const bad = est?.rejected.includes(i)
              return <rect key={taps.length - ivs.length + i} x={i * 10 + 1} y={58 - h} width={8} height={h} rx={2} className={bad ? 'bad' : ''} />
            })}
          </svg>
        </div>
      </div>
      <Hint>Tap the pad (or press Space) along with the beat of a song. Stray taps are ignored, and after a two-second pause the next tap starts a new count. Use Half or Double if the number feels twice too fast or slow.</Hint>
    </div>
  )
}
