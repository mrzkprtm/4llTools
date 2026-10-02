import { useEffect, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { audioContext } from '../../sim/audio'
import { circle, clear, rrect, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { antinodes, harmonicFrequency, noteName, nodes, waveSpeed } from './strings'

const W = 800
const H = 440
const X0 = 60
const X1 = 740
const Y0 = 190

export default function StandingWaves() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [n, setN] = useState(3)
  const [L, setL] = useState(0.65)
  const [tension, setTension] = useState(70)
  const [mu, setMu] = useState(1.2)
  const [amp, setAmp] = useState(60)
  const [slow, setSlow] = useState(1)
  const [parts, setParts] = useState(false)
  const [mix, setMix] = useState(false)
  const [sound, setSound] = useState(false)
  const osc = useRef<{ o: OscillatorNode; g: GainNode } | null>(null)

  const f1 = harmonicFrequency(1, L, tension, mu / 1000)
  const fn = n * f1

  useEffect(() => {
    if (!sound) return
    const ctx = audioContext()
    if (!ctx) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'triangle'
    g.gain.value = 0.0001
    g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.05)
    o.connect(g).connect(ctx.destination)
    o.start()
    osc.current = { o, g }
    return () => {
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08)
      o.stop(ctx.currentTime + 0.1)
      osc.current = null
    }
  }, [sound])

  useEffect(() => {
    osc.current?.o.frequency.setTargetAtTime(Math.min(fn, 4000), osc.current.o.context.currentTime, 0.02)
  }, [fn])

  // The animation plays at a visible rate; the tone plays the true frequency.
  const visual = 0.6 * slow

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            label={`String vibrating in harmonic ${n} at ${fmt(fn, 1)} hertz, with ${n + 1} nodes.`}
            onFrame={(ctx, f) => {
              clear(ctx, W, H, theme.sunken)
              const span = X1 - X0
              const base = 2 * Math.PI * visual * f.t
              const phase = base * n
              // Envelope.
              ctx.beginPath()
              for (let i = 0; i <= 200; i++) {
                const u = i / 200
                ctx.lineTo(X0 + u * span, Y0 - amp * Math.sin(n * Math.PI * u))
              }
              for (let i = 200; i >= 0; i--) {
                const u = i / 200
                ctx.lineTo(X0 + u * span, Y0 + amp * Math.sin(n * Math.PI * u))
              }
              ctx.fillStyle = alpha(theme.accent, 0.08)
              ctx.fill()
              const y = (u: number) => {
                if (mix) {
                  let s = 0
                  for (let k = 1; k <= 6; k++) s += (Math.sin(k * Math.PI * u) * Math.sin(k * Math.PI * 0.3) * Math.cos(base * k)) / (k * k)
                  return Y0 - amp * 1.3 * s
                }
                return Y0 - amp * Math.sin(n * Math.PI * u) * Math.cos(phase)
              }
              if (parts && !mix) {
                // A standing wave is two travelling waves moving in opposite directions.
                for (const dir of [1, -1]) {
                  ctx.beginPath()
                  for (let i = 0; i <= 300; i++) {
                    const u = i / 300
                    ctx.lineTo(X0 + u * span, Y0 - (amp / 2) * Math.sin(n * Math.PI * u - dir * phase))
                  }
                  ctx.strokeStyle = dir > 0 ? alpha('#1c7ed6', 0.7) : alpha('#2f9e44', 0.7)
                  ctx.lineWidth = 1.5
                  ctx.stroke()
                }
              }
              ctx.beginPath()
              for (let i = 0; i <= 300; i++) {
                const u = i / 300
                ctx.lineTo(X0 + u * span, y(u))
              }
              ctx.strokeStyle = theme.text
              ctx.lineWidth = 3
              ctx.stroke()
              for (let i = 0; i <= 24; i++) circle(ctx, X0 + (i / 24) * span, y(i / 24), 3.5, theme.accent)
              rrect(ctx, X0 - 18, Y0 - 50, 18, 100, 3, theme.text)
              rrect(ctx, X1, Y0 - 50, 18, 100, 3, theme.text)
              if (!mix) {
                for (const u of nodes(n)) {
                  circle(ctx, X0 + u * span, Y0, 6, undefined, '#1c7ed6', 2)
                  text(ctx, 'N', X0 + u * span, Y0 + amp + 30, { color: '#1c7ed6', size: 12, align: 'center', weight: 700 })
                }
                for (const u of antinodes(n)) text(ctx, 'A', X0 + u * span, Y0 - amp - 16, { color: theme.accent, size: 12, align: 'center', weight: 700 })
              }
              // Harmonic ladder.
              const ly = 330
              text(ctx, 'harmonics', X0, ly - 8, { color: theme.muted, size: 12 })
              for (let k = 1; k <= 8; k++) {
                const x = X0 + (k - 1) * 86
                rrect(ctx, x, ly, 78, 64, 6, k === n ? alpha(theme.accent, 0.15) : theme.surface, k === n ? theme.accent : theme.border, k === n ? 2 : 1)
                ctx.beginPath()
                for (let i = 0; i <= 40; i++) ctx.lineTo(x + 6 + (i / 40) * 66, ly + 24 - 12 * Math.sin((k * Math.PI * i) / 40) * Math.cos(base * k))
                ctx.strokeStyle = k === n ? theme.accent : theme.muted
                ctx.lineWidth = 1.5
                ctx.stroke()
                text(ctx, `${fmt(k * f1, 0)} Hz`, x + 39, ly + 56, { color: theme.text, size: 11, align: 'center' })
              }
            }}
          />
          <Readout
            items={[
              ['Harmonic', n === 1 ? '1st (fundamental)' : `${n}${['', 'st', 'nd', 'rd'][n] ?? 'th'}`],
              ['Frequency', `${fmt(fn, 1)} Hz`],
              ['Note', noteName(fn)],
              ['Wavelength', `${fmt((2 * L) / n, 3)} m`],
              ['Wave speed', `${fmt(waveSpeed(tension, mu / 1000), 1)} m/s`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning}>
        <button type="button" className={`btn ${sound ? 'is-done' : ''}`} onClick={() => setSound(!sound)} aria-pressed={sound}>
          {sound ? '🔊 Sound on' : '🔈 Hear it'}
        </button>
      </PlayBar>
      <Slider label="Harmonic n" value={n} min={1} max={8} onChange={setN} />
      <Slider label="String length" value={L} min={0.2} max={1.5} step={0.01} unit=" m" onChange={setL} />
      <Slider label="Tension" value={tension} min={5} max={300} unit=" N" onChange={setTension} />
      <Slider label="Linear density" value={mu} min={0.2} max={10} step={0.1} unit=" g/m" onChange={setMu} />
      <Slider label="Amplitude" value={amp} min={5} max={100} onChange={setAmp} />
      <Slider label="Animation speed" value={slow} min={0.1} max={3} step={0.1} unit="×" onChange={setSlow} />
      <Toggle label="Show the two travelling waves" checked={parts} onChange={setParts} />
      <Toggle label="Pluck (mix of harmonics)" checked={mix} onChange={setMix} />
      <Hint>Nodes (N) never move; antinodes (A) swing the most. Doubling the tension raises the pitch by √2, and halving the length raises it an octave.</Hint>
    </SimLayout>
  )
}
