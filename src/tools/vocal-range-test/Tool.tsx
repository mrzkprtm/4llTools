import { useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Hint } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { alpha, useTheme } from '../../sim/theme'
import Icon from '../../components/Icon'
import { freqToMidi, noteName } from '../instrument-tuner/pitch'
import { MIC_MESSAGES, useMicPitch, type PitchFrame } from '../instrument-tuner/useMicPitch'
import { classifyVoice, describeRange, feedStable, VOICE_TYPES, type StableState } from './logic'
import './tool.css'

const W = 800
const H = 380
const LO = 36
const HI = 88
const SPAN_MS = 9000
const GUTTER = 58
const yOf = (m: number) => H - 14 - ((m - LO) / (HI - LO)) * (H - 28)

export default function VocalRangeTest() {
  const theme = useTheme()
  const [low, setLow] = useState<number | null>(null)
  const [high, setHigh] = useState<number | null>(null)
  const [current, setCurrent] = useState<number | null>(null)
  const trail = useRef<{ t: number; midi: number | null }[]>([])
  const stable = useRef<StableState | null>(null)
  const held = useRef<number | null>(null)
  const range = useRef({ low, high })
  range.current = { low, high }

  function onFrame(f: PitchFrame) {
    const midi = f.freq !== null && f.clarity > 0.7 && f.freq > 60 && f.freq < 1300 ? freqToMidi(f.freq) : null
    trail.current.push({ t: f.time, midi })
    while (trail.current.length && f.time - trail.current[0].t > SPAN_MS) trail.current.shift()
    const r = feedStable(stable.current, f.time, midi)
    stable.current = r.state
    held.current = r.stable
    setCurrent(midi === null ? null : Math.round(midi))
    if (r.stable !== null) {
      const { low: l, high: h } = range.current
      if (l === null || r.stable < l) setLow(r.stable)
      if (h === null || r.stable > h) setHigh(r.stable)
    }
  }

  const mic = useMicPitch(onFrame, { minFreq: 60, maxFreq: 1300, everyMs: 40 })
  const on = mic.status === 'on'

  function reset() {
    setLow(null)
    setHigh(null)
    trail.current = []
    stable.current = null
  }

  function draw(c: CanvasRenderingContext2D) {
    clear(c, W, H, theme.sunken)
    // Piano-roll background: black-key rows shaded, C rows labeled.
    for (let m = LO; m <= HI; m++) {
      const y = yOf(m)
      if (m % 12 === 0) {
        line(c, GUTTER, y, W, y, alpha(theme.text, 0.18), 1)
        text(c, noteName(m), 8, y + 4, { color: theme.muted, size: 12 })
      }
    }
    c.fillStyle = alpha(theme.text, 0.045)
    for (let m = LO; m <= HI; m++) {
      if (![1, 3, 6, 8, 10].includes(m % 12)) continue
      const h = (H - 28) / (HI - LO)
      c.fillRect(GUTTER, yOf(m) - h / 2, W - GUTTER, h)
    }
    const { low: l, high: hi } = range.current
    if (l !== null && hi !== null) {
      rrect(c, GUTTER, yOf(hi) - 4, W - GUTTER, yOf(l) - yOf(hi) + 8, 4, alpha(theme.ok, 0.1))
    }
    for (const [m, label] of [[l, 'lowest'], [hi, 'highest']] as const) {
      if (m === null) continue
      line(c, GUTTER, yOf(m), W, yOf(m), theme.ok, 2, [6, 5])
      text(c, `${label} ${noteName(m)}`, W - 8, yOf(m) + (label === 'lowest' ? 16 : -7), { color: theme.ok, size: 12, align: 'right' })
    }
    // Pitch trail, newest on the right.
    const now = performance.now()
    const pts = trail.current
    const x = (t: number) => W - ((now - t) / SPAN_MS) * (W - GUTTER)
    c.lineWidth = 3
    c.lineCap = 'round'
    c.strokeStyle = theme.accent
    c.beginPath()
    let pen = false
    for (const p of pts) {
      if (p.midi === null || p.midi < LO - 2 || p.midi > HI + 2) {
        pen = false
        continue
      }
      const px = x(p.t)
      if (px < GUTTER) continue
      if (pen) c.lineTo(px, yOf(p.midi))
      else c.moveTo(px, yOf(p.midi))
      pen = true
    }
    c.stroke()
    const last = pts[pts.length - 1]
    if (on && last && last.midi !== null && now - last.t < 300) {
      const y = yOf(last.midi)
      circle(c, W - 6, y, held.current !== null ? 10 : 7, held.current !== null ? theme.ok : theme.accent, theme.surface, 2)
    }
    if (!on && !pts.length) text(c, 'Press Start and sing', (W + GUTTER) / 2, H / 2, { color: theme.muted, size: 18, align: 'center', mono: false })
  }

  const ranked = low !== null && high !== null && high - low >= 5 ? classifyVoice(low, high) : null
  const best = ranked?.[0].type
  const info = low !== null && high !== null ? describeRange(low, high) : null
  let step = 'Press Start, then sing along.'
  if (on) step = low === null ? 'Sing your lowest comfortable note and hold it for a moment.' : high === null || (high - low < 7) ? 'Now glide up and hold your highest comfortable note.' : 'Nice! Keep exploring, or stop when you are done.'

  return (
    <div className="vr">
      <Stage world={[W, H]} running={on} onFrame={draw} label={`Pitch trail piano roll. ${low !== null ? `Lowest ${noteName(low)}.` : ''} ${high !== null ? `Highest ${noteName(high)}.` : ''}`} />
      <div className="row vr-bar">
        <button type="button" className="btn primary btn-icon vr-go" onClick={on ? mic.stop : () => void mic.start()} disabled={mic.status === 'starting'}>
          <Icon key={on ? 's' : 'm'} name={on ? 'stop-circle' : 'microphone'} size={20} />
          {on ? 'Stop' : mic.status === 'starting' ? 'Starting…' : 'Start'}
        </button>
        <button type="button" className="btn" onClick={reset} disabled={low === null}>Reset</button>
        <span className={`vr-now ${current !== null ? 'live' : ''}`}>{on ? (current !== null ? noteName(current) : '…') : ''}</span>
      </div>
      {MIC_MESSAGES[mic.status] && <p className="error">{MIC_MESSAGES[mic.status]}</p>}
      <p className="vr-step" key={step}><b>{step}</b></p>

      <div className="stats">
        <div className="stat"><b>{low !== null ? noteName(low) : '–'}</b>Lowest held note</div>
        <div className="stat"><b>{high !== null ? noteName(high) : '–'}</b>Highest held note</div>
        <div className="stat"><b>{info ? info.semitones : '–'}</b>{info ? info.octaves : 'Semitones'}</div>
        <div className="stat"><b key={best?.id} className={best ? 'pop' : ''}>{best ? best.name : '–'}</b>Likely voice type</div>
      </div>

      <div className="vr-chart" role="img" aria-label="Your range compared with typical voice ranges">
        {VOICE_TYPES.map((t) => (
          <div key={t.id} className={`vr-row ${best?.id === t.id ? 'best' : ''}`}>
            <span className="vr-name">{t.name}</span>
            <div className="vr-track">
              <i className="vr-typ" style={{ left: `${pct(t.low)}%`, width: `${pct(t.high) - pct(t.low)}%` }} />
              {low !== null && high !== null && <i className="vr-you" style={{ left: `${pct(low)}%`, width: `${Math.max(1, pct(high) - pct(low))}%` }} />}
            </div>
            <span className="vr-span">{noteName(t.low)}–{noteName(t.high)}</span>
          </div>
        ))}
      </div>
      <Hint>Sing on “ah” and hold each note for about half a second; only steady notes count, so slides and cracks are ignored. Voice types are a rough guide based on typical choir ranges. Audio never leaves your device.</Hint>
    </div>
  )
}

const pct = (m: number) => ((m - LO) / (HI - LO)) * 100
