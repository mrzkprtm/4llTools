import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, downloadCanvas, line, text } from '../../sim/draw'
import { fmt, rad } from '../../sim/math'
import { PLEASANT, envelope, penAt, settleTime, swing, type Machine } from './harmonograph'

const W = 800
const H = 520
const K = 2
const CX = W / 2 + 60
const CY = H / 2
/** Ratio 1 swings at half a hertz. */
const BASE = Math.PI

const PALETTES = {
  aurora: (u: number, light: boolean) => `hsl(${Math.round(150 + 150 * u)} 80% ${light ? 38 : 62}%)`,
  sunset: (u: number, light: boolean) => `hsl(${Math.round((330 + 80 * u) % 360)} 85% ${light ? 45 : 64}%)`,
  rainbow: (u: number, light: boolean) => `hsl(${Math.round((720 * u) % 360)} 85% ${light ? 42 : 62}%)`,
  ink: (u: number, light: boolean) => (light ? `hsl(225 30% ${Math.round(12 + 30 * u)}%)` : `hsl(40 60% ${Math.round(88 - 30 * u)}%)`),
}
type PaletteKey = keyof typeof PALETTES
const PALETTE_OPTIONS = [['aurora', 'Aurora'], ['sunset', 'Sunset'], ['rainbow', 'Rainbow'], ['ink', 'Ink']] as const
type Paper = 'dark' | 'cream'

export default function Harmonograph() {
  const [running, setRunning] = useRunning()
  const [count, setCount] = useState<2 | 3>(3)
  const [rx, setRx] = useState(2)
  const [ry, setRy] = useState(3)
  const [rt, setRt] = useState(1)
  const [detune, setDetune] = useState(0.006)
  const [px, setPx] = useState(90)
  const [py, setPy] = useState(0)
  const [pt, setPt] = useState(45)
  const [damp, setDamp] = useState(0.012)
  const [tableAmp, setTableAmp] = useState(0.35)
  const [rotary, setRotary] = useState(true)
  const [pen, setPen] = useState(14)
  const [width, setWidth] = useState(0.8)
  const [palette, setPalette] = useState<PaletteKey>('aurora')
  const [paper, setPaper] = useState<Paper>('dark')
  const [info, setInfo] = useState({ t: 0, env: 1 })
  const art = useRef<HTMLCanvasElement | null>(null)
  const time = useRef(0)
  const last = useRef<[number, number] | null>(null)

  const machine: Machine = useMemo(
    () => ({
      x: { A: 1, f: rx * BASE, p: rad(px), d: damp },
      y: { A: 1, f: ry * BASE * (1 + detune), p: rad(py), d: damp * 1.15 },
      table: count === 3 ? { A: tableAmp, f: rt * BASE * (1 - detune * 0.7), p: rad(pt), d: damp * 0.8 } : null,
      rotary,
    }),
    [count, rx, ry, rt, detune, px, py, pt, damp, tableAmp, rotary],
  )
  const settle = settleTime(machine)
  const scale = 225 / (1 + (machine.table ? tableAmp : 0))
  const light = paper === 'cream'
  const bg = light ? '#f6f0e1' : '#0b0b12'

  function restart() {
    if (!art.current) {
      art.current = document.createElement('canvas')
      art.current.width = W * K
      art.current.height = H * K
    }
    const c = art.current.getContext('2d')!
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.fillStyle = bg
    c.fillRect(0, 0, W * K, H * K)
    time.current = 0
    last.current = null
    setInfo({ t: 0, env: 1 })
  }

  useEffect(restart, [machine, paper, palette])

  function randomise() {
    const [a, b] = PLEASANT[Math.floor(Math.random() * PLEASANT.length)]
    setRx(a)
    setRy(b)
    setRt(1 + Math.floor(Math.random() * 3))
    setDetune(Math.round((0.002 + Math.random() * 0.01) * (Math.random() < 0.5 ? -1 : 1) * 2000) / 2000)
    setPx(Math.floor(Math.random() * 24) * 15)
    setPy(Math.floor(Math.random() * 24) * 15)
    setPt(Math.floor(Math.random() * 24) * 15)
    setDamp(Math.round((0.006 + Math.random() * 0.014) * 1000) / 1000)
    setTableAmp(Math.round((0.15 + Math.random() * 0.4) * 20) / 20)
    setCount(Math.random() < 0.65 ? 3 : 2)
    setRotary(Math.random() < 0.7)
    setPalette(PALETTE_OPTIONS[Math.floor(Math.random() * PALETTE_OPTIONS.length)][0])
    if (!running) setRunning(true)
  }

  const ratio = `${rx} : ${fmt(ry * (1 + detune), 3)}${count === 3 ? ` : ${fmt(rt * (1 - detune * 0.7), 3)}` : ''}`

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className={light ? 'sim-flat' : 'sim-dark'}
            label={`Harmonograph drawing with frequency ratio ${ratio}, ${count} pendulums.`}
            onFrame={(ctx, f) => {
              if (!art.current) restart()
              const c = art.current!.getContext('2d')!
              if (f.dt > 0 && time.current < settle) {
                const span = pen * f.dt
                const steps = Math.max(2, Math.ceil(span / 0.008))
                c.setTransform(K, 0, 0, K, 0, 0)
                c.beginPath()
                let p = last.current ?? penAt(machine, time.current)
                c.moveTo(CX + p[0] * scale, CY + p[1] * scale)
                for (let s = 1; s <= steps; s++) {
                  p = penAt(machine, time.current + (span * s) / steps)
                  c.lineTo(CX + p[0] * scale, CY + p[1] * scale)
                }
                time.current += span
                last.current = p
                c.strokeStyle = PALETTES[palette](Math.min(1, time.current / settle), light)
                c.globalAlpha = 0.85
                c.lineWidth = width
                c.lineJoin = 'round'
                c.stroke()
                c.globalAlpha = 1
              }
              clear(ctx, W, H, bg)
              ctx.drawImage(art.current!, 0, 0, W, H)

              // Pen and pendulum swing gauges.
              const t = time.current
              const [x, y] = penAt(machine, t)
              const ink = light ? 'rgba(30,28,24,0.75)' : 'rgba(255,255,255,0.75)'
              const faint = light ? 'rgba(30,28,24,0.25)' : 'rgba(255,255,255,0.22)'
              if (t < settle) circle(ctx, CX + x * scale, CY + y * scale, 4, undefined, ink, 1.5)
              const gx = 34
              const gy = H - 70
              line(ctx, gx, gy, gx + 90, gy, faint, 2)
              circle(ctx, gx + 45 + swing(machine.x, t) * 42, gy, 6, PALETTES[palette](0.1, light))
              text(ctx, 'x pendulum', gx, gy + 24, { color: ink, size: 12 })
              line(ctx, gx + 124, gy - 45, gx + 124, gy + 45, faint, 2)
              circle(ctx, gx + 124, gy + swing(machine.y, t) * 42, 6, PALETTES[palette](0.5, light))
              text(ctx, 'y', gx + 134, gy + 4, { color: ink, size: 12 })
              if (machine.table) {
                const tx = gx + 200
                circle(ctx, tx, gy, 40, undefined, faint, 1.5)
                const ax = swing(machine.table, t) / tableAmp
                const ay = machine.rotary ? swing(machine.table, t, Math.PI / 2) / tableAmp : 0
                circle(ctx, tx + ax * 38, gy + ay * 38, 6, PALETTES[palette](0.9, light))
                text(ctx, machine.rotary ? 'rotary table' : 'table', tx - 36, gy + 60, { color: ink, size: 12 })
              }
              text(ctx, t < settle ? `t = ${t.toFixed(1)} s` : 'finished', 24, 36, { color: ink, size: 14 })
              if (f.frame % 10 === 0) setInfo({ t, env: envelope(machine, t) })
            }}
          />
          <Readout
            items={[
              ['Frequency ratio', ratio],
              ['Time', `${fmt(info.t, 1)} s`],
              ['Swing left', `${Math.round(info.env * 100)}%`],
              ['Pendulums', count],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={restart} resetLabel="Redraw">
        <button type="button" className="btn btn-icon" onClick={randomise}>
          <Icon name="lightning-bolt" size={18} />
          Randomise
        </button>
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(art.current, 'harmonograph.png')}>
          <Icon name="save" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Choice label="Pendulums" value={count} options={[[2, 'Two'], [3, 'Three (table)']]} onChange={setCount} />
      <Slider label="x frequency" value={rx} min={1} max={6} onChange={setRx} />
      <Slider label="y frequency" value={ry} min={1} max={6} onChange={setRy} />
      {count === 3 && <Slider label="Table frequency" value={rt} min={1} max={6} onChange={setRt} />}
      <Slider label="Detune" value={detune} min={-0.02} max={0.02} step={0.0005} format={(v) => (v >= 0 ? '+' : '') + (v * 100).toFixed(2)} unit="%" onChange={setDetune} />
      <Slider label="x phase" value={px} min={0} max={360} step={5} unit="°" onChange={setPx} />
      <Slider label="y phase" value={py} min={0} max={360} step={5} unit="°" onChange={setPy} />
      {count === 3 && <Slider label="Table phase" value={pt} min={0} max={360} step={5} unit="°" onChange={setPt} />}
      {count === 3 && <Slider label="Table swing" value={tableAmp} min={0.05} max={0.8} step={0.05} onChange={setTableAmp} />}
      {count === 3 && <Toggle label="Rotary table (circular swing)" checked={rotary} onChange={setRotary} />}
      <Slider label="Damping" value={damp} min={0.002} max={0.05} step={0.001} unit="/s" onChange={setDamp} />
      <Slider label="Pen speed" value={pen} min={1} max={60} unit="×" onChange={setPen} />
      <Slider label="Line width" value={width} min={0.3} max={2.5} step={0.1} onChange={setWidth} />
      <Select label="Colours" value={palette} options={PALETTE_OPTIONS} onChange={setPalette} />
      <Choice label="Paper" value={paper} options={[['dark', 'Dark'], ['cream', 'Cream']]} onChange={setPaper} />
      <Hint>Two pendulums move the pen and a third can swing the paper table. Whole-number frequency ratios give closed figures; a small detune makes them slowly rotate into woven spirals as the swings die away.</Hint>
    </SimLayout>
  )
}

