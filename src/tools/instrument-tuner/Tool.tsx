import { useRef, useState } from 'react'
import { Choice, Hint, Slider } from '../../sim/controls'
import Icon from '../../components/Icon'
import { centsBetween, freqToNote, INSTRUMENTS, midiToFreq, nearestString, noteName } from './pitch'
import { MIC_MESSAGES, pluck, useMicPitch, type PitchFrame } from './useMicPitch'
import './tool.css'

const IN_TUNE = 5

interface Reading {
  freq: number
  cents: number
  note: string
  octave: number
  string: number
  toString: number
  time: number
}

export default function InstrumentTuner() {
  const [instId, setInstId] = useState('guitar')
  const [a4, setA4] = useState(440)
  const [reading, setReading] = useState<Reading | null>(null)
  const [fresh, setFresh] = useState(false)
  const smooth = useRef<{ midi: number; cents: number; freq: number } | null>(null)
  const inst = INSTRUMENTS.find((i) => i.id === instId)!
  const live = useRef({ inst, a4 })
  live.current = { inst, a4 }

  function onFrame(f: PitchFrame) {
    const { inst: ins, a4: ref } = live.current
    if (f.freq === null || f.clarity < 0.6) {
      if (reading && f.time - reading.time > 1200) setFresh(false)
      return
    }
    const n = freqToNote(f.freq, ref)
    const s = smooth.current
    // Smooth within a note; jump straight to a new note.
    if (s && s.midi === n.midi) {
      s.cents += 0.35 * (n.cents - s.cents)
      s.freq += 0.35 * (f.freq - s.freq)
    } else smooth.current = { midi: n.midi, cents: n.cents, freq: f.freq }
    const cur = smooth.current!
    const idx = nearestString(cur.freq, ins.strings, ref)
    setReading({ freq: cur.freq, cents: cur.cents, note: n.name, octave: n.octave, string: idx, toString: centsBetween(cur.freq, midiToFreq(ins.strings[idx], ref)), time: f.time })
    setFresh(true)
  }

  const mic = useMicPitch(onFrame)
  const on = mic.status === 'on'
  const cents = fresh && reading ? Math.max(-50, Math.min(50, reading.cents)) : 0
  const inTune = fresh && reading !== null && Math.abs(reading.cents) <= IN_TUNE
  const angle = (cents / 50) * 60

  let advice = on ? 'Play a single string and let it ring.' : 'Press Start and allow the microphone.'
  if (fresh && reading) {
    const target = noteName(inst.strings[reading.string])
    const d = reading.toString
    advice = Math.abs(d) <= IN_TUNE ? `${target} string is in tune` : Math.abs(d) > 250 ? `Closest string is ${target}` : d < 0 ? `Tune up toward ${target}` : `Tune down toward ${target}`
  }

  return (
    <div className="tu">
      <div className={`tu-panel ${inTune ? 'tu-good' : ''}`}>
        <svg viewBox="0 0 320 190" className="tu-gauge" role="img" aria-label={fresh && reading ? `${reading.note}${reading.octave}, ${Math.round(reading.cents)} cents` : 'Tuner needle at rest'}>
          <path d={arc(-50, 50)} className="tu-arc" />
          <path d={arc(-6, 6)} className="tu-zone" />
          {Array.from({ length: 21 }, (_, i) => {
            const c = -50 + i * 5
            const a = ((c / 50) * 60 - 90) * (Math.PI / 180)
            const r1 = c % 25 === 0 ? 100 : c % 10 === 0 ? 106 : 110
            return <line key={c} x1={160 + Math.cos(a) * r1} y1={170 + Math.sin(a) * r1} x2={160 + Math.cos(a) * 118} y2={170 + Math.sin(a) * 118} className={c % 25 === 0 ? 'tu-tick big' : 'tu-tick'} />
          })}
          <text x="40" y="104" className="tu-lbl" textAnchor="middle">−50</text>
          <text x="280" y="104" className="tu-lbl" textAnchor="middle">+50</text>
          <text x="160" y="38" className="tu-lbl" textAnchor="middle">0</text>
          <text x="96" y="160" className="tu-lbl flat" textAnchor="middle">♭</text>
          <text x="224" y="160" className="tu-lbl sharp" textAnchor="middle">♯</text>
          <g className="tu-needle" style={{ transform: `rotate(${angle}deg)` }}>
            <line x1="160" y1="172" x2="160" y2="62" />
            <circle cx="160" cy="170" r="9" />
          </g>
        </svg>
        <div className="tu-note" aria-live="polite">
          <b key={fresh && reading ? reading.note + reading.octave : '-'} className="pop">
            {fresh && reading ? reading.note : '–'}
            <sub>{fresh && reading ? reading.octave : ''}</sub>
          </b>
          <span className="tu-hz">{fresh && reading ? `${reading.freq.toFixed(1)} Hz · ${reading.cents > 0 ? '+' : ''}${Math.round(reading.cents)}¢` : `A4 = ${a4} Hz`}</span>
          <span className={`tu-advice ${inTune ? 'ok' : ''}`}>{advice}</span>
        </div>
      </div>

      <div className="tu-strings" role="group" aria-label={`${inst.name} strings, tap to hear a reference`}>
        {inst.strings.map((m, i) => {
          const near = fresh && reading?.string === i
          return (
            <button key={`${instId}-${i}`} type="button" className={`tu-string pop ${near ? 'near' : ''} ${near && Math.abs(reading!.toString) <= IN_TUNE ? 'tuned' : ''}`} style={{ animationDelay: `${i * 40}ms` }} onClick={() => pluck(mic.audio(), midiToFreq(m, a4))}>
              <b>{noteName(m).replace(/\d+$/, '')}</b>
              <small>{noteName(m).match(/\d+$/)?.[0]}</small>
            </button>
          )
        })}
      </div>

      <div className="row tu-bar">
        <button type="button" className="btn primary btn-icon tu-go" onClick={on ? mic.stop : () => void mic.start()} disabled={mic.status === 'starting'}>
          <Icon key={on ? 'x' : 'm'} name={on ? 'stop-circle' : 'microphone'} size={20} />
          {on ? 'Stop' : mic.status === 'starting' ? 'Starting…' : 'Start tuner'}
        </button>
        {on && <span className="chip good tu-live">Listening</span>}
      </div>
      {MIC_MESSAGES[mic.status] && <p className="error">{MIC_MESSAGES[mic.status]}</p>}

      <div className="two-col">
        <Choice label="Instrument" value={instId} options={INSTRUMENTS.map((i) => [i.id, i.name] as const)} onChange={setInstId} />
        <Slider label="Reference A4" value={a4} min={432} max={446} unit=" Hz" onChange={setA4} />
      </div>
      <Hint>Start the tuner, play one string, and turn the peg until the needle sits in the green zone. Tap a string above to hear its reference note. Audio stays on your device.</Hint>
    </div>
  )
}

function arc(c1: number, c2: number) {
  const p = (c: number) => {
    const a = ((c / 50) * 60 - 90) * (Math.PI / 180)
    return `${(160 + Math.cos(a) * 120).toFixed(1)} ${(170 + Math.sin(a) * 120).toFixed(1)}`
  }
  return `M ${p(c1)} A 120 120 0 0 1 ${p(c2)}`
}
