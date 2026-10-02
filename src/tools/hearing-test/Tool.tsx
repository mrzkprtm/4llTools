import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { Choice, Hint, Slider } from '../../sim/controls'
import { Audiogram, EAR_COLOR, EAR_NAME, type Ear, type Results } from './Chart'
import { ToneEngine } from './engine'
import { fmtHz, MAX_DB, MIN_DB, newStair, ORDER, stairStep, sweepAgeHint, sweepFreq, type Stair } from './logic'
import './tool.css'

type Phase = 'intro' | 'calibrate' | 'test' | 'done'
const SWEEP_FROM = 8000
const SWEEP_TO = 20000
const SWEEP_S = 30
const TONE_S = 1.2
const WINDOW_MS = 2400
const PAN: Record<Ear, number> = { L: -1, R: 1 }

export default function HearingTest() {
  const [mode, setMode] = useState<'audiogram' | 'sweep'>('audiogram')
  const [phase, setPhase] = useState<Phase>('intro')
  const [volume, setVolume] = useState(0.4)
  const [ears, setEars] = useState<'both' | Ear>('both')
  const [results, setResults] = useState<Results>({ L: {}, R: {} })
  const [cur, setCur] = useState<{ ear: Ear; freq: number; stair: Stair; idx: number; total: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [flash, setFlash] = useState(0)
  const [falseHits, setFalseHits] = useState(0)
  const [sweepHz, setSweepHz] = useState(0)
  const [sweepBest, setSweepBest] = useState<number | null>(null)
  const eng = useRef<ToneEngine | null>(null)
  const timers = useRef<number[]>([])
  const trial = useRef({ open: false, heard: false })
  const plan = useRef<{ ear: Ear; freq: number }[]>([])
  const hold = useRef<{ stop: () => void; startedAt: number } | null>(null)

  const engine = () => (eng.current ??= new ToneEngine())
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  function stopSound() {
    clearTimers()
    hold.current?.stop()
    hold.current = null
    eng.current?.stopAll()
    trial.current.open = false
    setPlaying(false)
  }

  useEffect(() => () => {
    clearTimers()
    eng.current?.close()
    eng.current = null
  }, [])

  useEffect(() => { eng.current?.setVolume(volume) }, [volume])

  function beginCalibration() {
    stopSound()
    const e = engine()
    e.setVolume(volume)
    hold.current = e.hold(1000, 0, 0)
    setPlaying(true)
    setPhase('calibrate')
  }

  function beginTest() {
    stopSound()
    const earList: Ear[] = ears === 'both' ? ['R', 'L'] : [ears]
    plan.current = earList.flatMap((ear) => ORDER.map((freq) => ({ ear, freq })))
    setResults({ L: {}, R: {} })
    setFalseHits(0)
    setPhase('test')
    runTrial(0, newStair())
  }

  function runTrial(idx: number, stair: Stair) {
    const step = plan.current[idx]
    if (!step) {
      setCur(null)
      setPhase('done')
      return
    }
    setCur({ ...step, stair, idx, total: plan.current.length })
    trial.current = { open: true, heard: false }
    engine().tone(step.freq, stair.level, PAN[step.ear], TONE_S)
    setPlaying(true)
    later(() => setPlaying(false), TONE_S * 1000)
    later(() => finish(idx, stair), WINDOW_MS)
  }

  function finish(idx: number, stair: Stair) {
    if (!trial.current.open) return
    clearTimers()
    trial.current.open = false
    setPlaying(false)
    const next = stairStep(stair, trial.current.heard)
    const step = plan.current[idx]
    if (next.done) {
      setResults((r) => ({ ...r, [step.ear]: { ...r[step.ear], [step.freq]: next.threshold } }))
      later(() => runTrial(idx + 1, newStair()), 900)
    } else {
      setCur((c) => (c ? { ...c, stair: next } : c))
      later(() => runTrial(idx, next), 500 + Math.random() * 1300)
    }
  }

  function hear() {
    setFlash((f) => f + 1)
    if (phase === 'test' && cur) {
      if (trial.current.open) {
        trial.current.heard = true
        finish(cur.idx, cur.stair)
      } else setFalseHits((n) => n + 1)
    }
  }

  function startSweep() {
    stopSound()
    const e = engine()
    e.setVolume(volume)
    setSweepBest(null)
    hold.current = e.hold(SWEEP_FROM, -6, ears === 'both' ? 0 : PAN[ears], SWEEP_TO, SWEEP_S)
    setPlaying(true)
    const tick = () => {
      if (!hold.current || !eng.current) return
      const t = eng.current.ctx.currentTime - hold.current.startedAt
      setSweepHz(sweepFreq(SWEEP_FROM, SWEEP_TO, SWEEP_S, t))
      if (t >= SWEEP_S) return stopSweep()
      later(tick, 100)
    }
    tick()
  }

  function stopSweep() {
    if (!hold.current || !eng.current) return
    const t = eng.current.ctx.currentTime - hold.current.startedAt
    setSweepBest(sweepFreq(SWEEP_FROM, SWEEP_TO, SWEEP_S, t))
    stopSound()
  }

  // Space answers "I hear it" during the test.
  useEffect(() => {
    if (phase !== 'test') return
    const on = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement).closest('input, button, select, textarea')) { e.preventDefault(); hear() }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  const progress = cur ? (cur.idx + (cur.stair.done ? 1 : 0)) / cur.total : phase === 'done' ? 1 : 0
  const levelPct = cur ? ((cur.stair.level - MIN_DB) / (MAX_DB - MIN_DB)) * 100 : 0

  return (
    <div className="ht">
      <p className="ht-warn"><b>Not a medical test.</b> Use headphones at a comfortable volume, in a quiet room. Results are relative to your own volume setting and cannot diagnose hearing loss; see an audiologist if you are worried.</p>

      <div className="row ht-top">
        <Choice value={mode} options={[['audiogram', 'Audiogram'], ['sweep', 'High-frequency sweep']] as const} onChange={(m) => { stopSound(); setMode(m); setPhase('intro') }} />
        <Choice value={ears} options={[['both', 'Both ears'], ['L', 'Left'], ['R', 'Right']] as const} onChange={setEars} />
      </div>

      <Slider label="Volume" value={Math.round(volume * 100)} min={1} max={100} unit="%" onChange={(v) => setVolume(v / 100)} />

      {mode === 'audiogram' && (
        <>
          {phase === 'intro' && <button type="button" className="btn primary ht-big" onClick={beginCalibration}>1. Play the 1 kHz reference tone</button>}
          {phase === 'calibrate' && (
            <div className="ht-card pop">
              <p>Adjust the volume slider (and your device volume) until this steady tone is clearly audible but comfortable. Then start the test.</p>
              <div className={`ht-wave ${playing ? 'on' : ''}`} aria-hidden="true"><i /><i /><i /><i /><i /></div>
              <button type="button" className="btn primary ht-big" onClick={beginTest}>2. Start the test</button>
            </div>
          )}
          {phase === 'test' && cur && (
            <div className="ht-card">
              <div className="ht-now-row">
                <span className="chip" style={{ color: EAR_COLOR[cur.ear] }}>{EAR_NAME[cur.ear]} ear</span>
                <b className="ht-freq"><Roll>{fmtHz(cur.freq)}</Roll>Hz</b>
                <span className="muted">{cur.idx + 1}/{cur.total}</span>
              </div>
              <div className="ht-level" aria-label="Tone level"><i style={{ width: `${levelPct}%` }} /></div>
              <button type="button" className={`btn primary ht-hear ${playing ? 'live' : ''}`} onClick={hear}>{flash > 0 && <span key={flash} className="ht-ripple" aria-hidden="true" />}I hear it</button>
              <p className="muted ht-small">Press as soon as you hear a beep (or press Space). Tones get louder in 5 dB steps until you do. {falseHits > 0 && `Presses with no tone: ${falseHits}.`}</p>
              <button type="button" className="btn" onClick={() => { stopSound(); setPhase('done') }}>Stop</button>
            </div>
          )}
          {phase === 'done' && (
            <div className="row">
              <button type="button" className="btn primary" onClick={beginCalibration}>Test again</button>
            </div>
          )}
          <div className="ht-bar"><i style={{ width: `${progress * 100}%` }} /></div>
          <Audiogram results={results} current={cur} />
          <p className="muted ht-small"><span style={{ color: EAR_COLOR.R }}>○ right</span> · <span style={{ color: EAR_COLOR.L }}>✕ left</span>. Each point is the quietest level you heard, relative to the reference tone; points near the bottom were only heard loud (faded = not heard at all). Many headphones roll off above 12–16 kHz.</p>
        </>
      )}

      {mode === 'sweep' && (
        <div className="ht-card">
          <p>A tone rises from 8 kHz to 20 kHz over {SWEEP_S} seconds. Press Stop the moment you can no longer hear it.</p>
          <b className="ht-sweep"><Roll>{(sweepHz / 1000).toFixed(1)}</Roll> kHz</b>
          <div className="ht-bar"><i style={{ width: `${sweepHz ? ((Math.log(sweepHz / SWEEP_FROM) / Math.log(SWEEP_TO / SWEEP_FROM)) * 100) : 0}%` }} /></div>
          {playing ? (
            <button type="button" className="btn primary ht-big" onClick={stopSweep}>Stop: I can't hear it</button>
          ) : (
            <button type="button" className="btn primary ht-big" onClick={startSweep}>{sweepBest ? 'Sweep again' : 'Start the sweep'}</button>
          )}
          {sweepBest !== null && <p className="ht-result pop">Highest frequency heard: <b>{(sweepBest / 1000).toFixed(1)} kHz</b>, {sweepAgeHint(sweepBest)}.</p>}
        </div>
      )}

      <Hint>Put on headphones, set a comfortable level with the reference tone, then answer each beep. Sound only plays after you press a button and stops when you leave the page.</Hint>
    </div>
  )
}
