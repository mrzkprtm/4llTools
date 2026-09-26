import { useEffect, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, SimLayout, Slider, Toggle } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { alpha, useTheme } from '../../sim/theme'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import Icon from '../../components/Icon'
import { clampBpm, MAX_BPM, METERS, MIN_BPM, schedule, SUBDIVISIONS, tapBpm, tempoName, type Cursor, type Subdivision, type Tick } from './logic'
import './tool.css'

const W = 600
const H = 380
const LOOKAHEAD = 0.12
const FREQ = { bar: 1760, group: 1320, beat: 1000, sub: 720 } as const
const GAIN = { bar: 1, group: 0.8, beat: 0.65, sub: 0.35 } as const

interface Beat { time: number; beat: number; count: number }

export default function Metronome() {
  const theme = useTheme()
  const [bpm, setBpm] = useState(96)
  const [meterId, setMeterId] = useState('4/4')
  const [custom, setCustom] = useState(5)
  const [sub, setSub] = useState<Subdivision>(1)
  const [accent, setAccent] = useState(true)
  const [volume, setVolume] = useState(70)
  const [playing, setPlaying] = useState(false)
  const [taps, setTaps] = useState<number[]>([])
  const still = useRef(reducedMotion())

  const meter = meterId === 'custom' ? { id: 'custom', beats: custom, groups: [custom] } : METERS.find((m) => m.id === meterId)!
  const settings = { bpm, beats: meter.beats, groups: meter.groups, subdivision: sub, accentFirst: accent }
  const live = useRef(settings)
  live.current = settings

  const audio = useRef<{ ctx: AudioContext; out: GainNode } | null>(null)
  const cursor = useRef<Cursor>({ next: 0, index: 0 })
  const beats = useRef<Beat[]>([])
  const timer = useRef(0)

  function click(t: Tick) {
    const a = audio.current
    if (!a) return
    const osc = a.ctx.createOscillator()
    const g = a.ctx.createGain()
    osc.type = t.level === 'sub' ? 'triangle' : 'square'
    osc.frequency.value = FREQ[t.level]
    g.gain.setValueAtTime(0.0001, t.time)
    g.gain.exponentialRampToValueAtTime(0.4 * GAIN[t.level], t.time + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t.time + 0.05)
    osc.connect(g).connect(a.out)
    osc.start(t.time)
    osc.stop(t.time + 0.06)
  }

  function restartCursor() {
    const a = audio.current
    if (!a) return
    cursor.current = { next: a.ctx.currentTime + 0.06, index: 0 }
    beats.current = []
  }

  function start() {
    try {
      if (!audio.current) {
        const ctx = new AudioContext()
        const out = ctx.createGain()
        out.connect(ctx.destination)
        audio.current = { ctx, out }
      }
      const a = audio.current
      void a.ctx.resume()
      a.out.gain.value = volume / 100
      restartCursor()
      let count = 0
      const run = () => {
        const s = live.current
        const { ticks, cursor: c } = schedule(cursor.current, a.ctx.currentTime + LOOKAHEAD, s)
        cursor.current = c
        for (const t of ticks) {
          click(t)
          if (t.sub === 0) beats.current.push({ time: t.time, beat: t.beat, count: count++ })
        }
        if (beats.current.length > 16) beats.current.splice(0, beats.current.length - 16)
      }
      run()
      timer.current = window.setInterval(run, 25)
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  function stop() {
    clearInterval(timer.current)
    beats.current = []
    setPlaying(false)
  }

  // Meter or subdivision changes restart counting from beat 1.
  useEffect(() => { if (playing) restartCursor() }, [meter.beats, sub, meterId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (audio.current) audio.current.out.gain.setTargetAtTime(volume / 100, audio.current.ctx.currentTime, 0.02) }, [volume])
  useEffect(() => () => {
    clearInterval(timer.current)
    void audio.current?.ctx.close()
  }, [])

  function tap() {
    const now = performance.now()
    const next = [...taps.filter((t) => now - t < 4000), now].slice(-8)
    setTaps(next)
    const b = tapBpm(next)
    if (b) setBpm(b)
  }

  const nudge = (d: number) => setBpm((b) => clampBpm(b + d))

  function draw(c: CanvasRenderingContext2D) {
    clear(c, W, H, theme.sunken)
    const a = audio.current
    const now = a?.ctx.currentTime ?? 0
    const list = beats.current
    let last: Beat | undefined
    let next: Beat | undefined
    for (const b of list) {
      if (b.time <= now) last = b
      else if (!next) next = b
    }
    const beatLen = 60 / live.current.bpm
    let angle = 0
    let flash = 0
    if (playing && last) {
      const span = next ? next.time - last.time : beatLen
      const phase = Math.min(1, (now - last.time) / span)
      angle = still.current ? 0 : 0.42 * Math.cos(Math.PI * (last.count + phase))
      flash = Math.exp(-(now - last.time) * 9)
    }
    // Metronome body.
    const px = W / 2
    const py = 300
    c.beginPath()
    c.moveTo(px - 110, 340)
    c.lineTo(px - 46, 60)
    c.lineTo(px + 46, 60)
    c.lineTo(px + 110, 340)
    c.closePath()
    c.fillStyle = theme.surface
    c.fill()
    c.strokeStyle = theme.border
    c.lineWidth = 2
    c.stroke()
    for (let i = 0; i <= 10; i++) {
      const y = 90 + i * 18
      line(c, px - 16, y, px + 16, y, alpha(theme.muted, 0.35), 1)
    }
    rrect(c, px - 120, 330, 240, 22, 6, theme.text)
    // Arc of travel.
    c.beginPath()
    c.arc(px, py, 230, -Math.PI / 2 - 0.44, -Math.PI / 2 + 0.44)
    c.strokeStyle = alpha(theme.text, 0.1)
    c.setLineDash([4, 6])
    c.stroke()
    c.setLineDash([])
    // Arm and sliding weight (higher = slower, like the real thing).
    const len = 235
    const tipX = px + Math.sin(angle) * len
    const tipY = py - Math.cos(angle) * len
    line(c, px, py, tipX, tipY, theme.text, 4)
    const wpos = 0.35 + 0.55 * (1 - (live.current.bpm - MIN_BPM) / (MAX_BPM - MIN_BPM))
    const wx = px + Math.sin(angle) * len * wpos
    const wy = py - Math.cos(angle) * len * wpos
    c.save()
    c.translate(wx, wy)
    c.rotate(angle)
    rrect(c, -18, -13, 36, 26, 5, flash > 0.1 ? theme.accent : alpha(theme.accent, 0.8), theme.surface, 2)
    c.restore()
    circle(c, px, py, 8, theme.surface, theme.text, 3)
    // Beat dots.
    const n = live.current.beats
    const gap = Math.min(52, 520 / n)
    const x0 = W / 2 - ((n - 1) * gap) / 2
    for (let i = 0; i < n; i++) {
      const on = playing && last?.beat === i
      const lvl = i === 0 && live.current.accentFirst ? 1.25 : 1
      const r = (on ? 9 + 6 * flash : 9) * lvl
      circle(c, x0 + i * gap, 28, r + 6, on ? alpha(theme.accent, 0.25 * flash) : undefined)
      circle(c, x0 + i * gap, 28, r, on ? theme.accent : alpha(theme.text, 0.12), on ? undefined : theme.border)
    }
    text(c, `${live.current.bpm} BPM`, 22, 370, { color: theme.muted, size: 13 })
    text(c, tempoName(live.current.bpm), W - 22, 370, { color: theme.muted, size: 13, align: 'right' })
  }

  const options = [...METERS.map((m) => [m.id, m.id] as const), ['custom', 'Custom'] as const]

  return (
    <SimLayout
      stage={
        <>
          <Stage world={[W, H]} running onFrame={draw} label={`Metronome at ${bpm} beats per minute in ${meter.beats} beats per bar${playing ? ', playing' : ', stopped'}.`} />
          <div className="row me-transport">
            <button type="button" className="btn primary btn-icon me-play" onClick={playing ? stop : start} aria-pressed={playing}>
              <Icon key={playing ? 's' : 'p'} name={playing ? 'stop-circle' : 'play-circle'} size={20} />
              {playing ? 'Stop' : 'Start'}
            </button>
            <button type="button" className="btn me-tap" onClick={tap}>
              <Icon name="hand-pointer" size={18} /> Tap tempo
            </button>
          </div>
          <Hint>Press Start, then set the tempo with the slider, the ± buttons or by tapping along. Sound is scheduled on the audio clock, so it stays steady even when the page is busy.</Hint>
        </>
      }
    >
      <div className="me-bpm">
        <button type="button" className="btn me-step" onClick={() => nudge(-1)} aria-label="Slower by 1">−</button>
        <div className="me-bpm-num">
          <b><Roll>{String(bpm)}</Roll></b>
          <span key={tempoName(bpm)} className="settle-in">{tempoName(bpm)}</span>
        </div>
        <button type="button" className="btn me-step" onClick={() => nudge(1)} aria-label="Faster by 1">+</button>
      </div>
      <div className="row me-quick">
        {[-10, -5, 5, 10].map((d) => (
          <button key={d} type="button" className="btn" onClick={() => nudge(d)}>{d > 0 ? `+${d}` : d}</button>
        ))}
      </div>
      <Slider label="Tempo" value={bpm} min={MIN_BPM} max={MAX_BPM} unit=" BPM" onChange={setBpm} />
      <Choice label="Time signature" value={meterId} options={options} onChange={setMeterId} />
      {meterId === 'custom' && <Slider label="Beats per bar" value={custom} min={1} max={12} format={(v) => `${v}/4`} onChange={setCustom} />}
      <Choice label="Subdivision" value={sub} options={SUBDIVISIONS} onChange={setSub} />
      <Toggle label="Accent the first beat" checked={accent} onChange={setAccent} />
      <Slider label="Volume" value={volume} min={0} max={100} unit="%" onChange={setVolume} />
    </SimLayout>
  )
}
