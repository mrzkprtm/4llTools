import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, makeBuffer } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { PRESETS, seedField, stepGrayScott } from './grayscott'

const GW = 256
const GH = 160
const W = 800
const H = 500
const PALETTES = {
  ocean: ['#04121f', '#0b4f6c', '#20a4d8', '#e0fbfc'],
  magma: ['#000004', '#51127c', '#e75a3d', '#fcfdbf'],
  ink: ['#f8f4ea', '#b8b2a4', '#4a463f', '#1b1a17'],
  coral: ['#fff4e6', '#ffa8a8', '#e8590c', '#5f3dc4'],
} as const
type Palette = keyof typeof PALETTES

/** 256-entry RGB lookup table through evenly spaced colour stops. */
function lut(stops: readonly string[]): Uint8Array {
  const rgb = stops.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))
  const out = new Uint8Array(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (rgb.length - 1)
    const j = Math.min(rgb.length - 2, Math.floor(t))
    const f = t - j
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(rgb[j][c] + (rgb[j + 1][c] - rgb[j][c]) * f)
  }
  return out
}

export default function ReactionDiffusion() {
  const [running, setRunning] = useRunning()
  const [preset, setPreset] = useState('coral')
  const [F, setF] = useState(0.0545)
  const [k, setK] = useState(0.062)
  const [Da, setDa] = useState(1)
  const [Db, setDb] = useState(0.5)
  const [iters, setIters] = useState(12)
  const [palette, setPalette] = useState<Palette>('ocean')
  const [brush, setBrush] = useState(5)
  const [info, setInfo] = useState({ n: 0, cover: 0 })
  const sim = useRef({
    a: new Float32Array(GW * GH),
    b: new Float32Array(GW * GH),
    a2: new Float32Array(GW * GH),
    b2: new Float32Array(GW * GH),
    n: 0,
    ready: false,
  })
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const colours = useRef<{ key: string; table: Uint8Array } | null>(null)
  const hover = useRef<{ x: number; y: number } | null>(null)
  const s = sim.current

  function reseed() {
    seedField(s.a, s.b, GW, GH, 14)
    s.n = 0
  }
  function blank() {
    s.a.fill(1)
    s.b.fill(0)
    s.n = 0
  }
  if (!s.ready) {
    reseed()
    s.ready = true
  }

  function choose(id: string) {
    const p = PRESETS.find((q) => q.id === id)
    setPreset(id)
    if (p) {
      setF(p.F)
      setK(p.k)
    }
    reseed()
  }

  function paint(p: SimPointer, erase: boolean) {
    const cx = (p.x / W) * GW
    const cy = (p.y / H) * GH
    for (let y = Math.floor(cy - brush); y <= cy + brush; y++)
      for (let x = Math.floor(cx - brush); x <= cx + brush; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > brush * brush) continue
        const i = ((y + GH) % GH) * GW + ((x + GW) % GW)
        if (erase) {
          s.a[i] = 1
          s.b[i] = 0
        } else {
          s.b[i] = 1
          s.a[i] = 0.5
        }
      }
  }

  function onPointer(p: SimPointer) {
    hover.current = { x: p.x, y: p.y }
    if (p.down && p.type !== 'up') paint(p, p.shift || p.button === 2)
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            maxDpr={1}
            className="sim-dark"
            cursor="crosshair"
            label={`Gray–Scott reaction–diffusion with feed ${F} and kill ${k}, after ${info.n} iterations.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) {
                const p = { Da, Db, F, k, dt: 1 }
                for (let it = 0; it < iters; it++) {
                  stepGrayScott(s.a, s.b, s.a2, s.b2, GW, GH, p)
                  ;[s.a, s.a2] = [s.a2, s.a]
                  ;[s.b, s.b2] = [s.b2, s.b]
                }
                s.n += iters
              }
              if (!buf.current) buf.current = makeBuffer(GW, GH)
              if (colours.current?.key !== palette) colours.current = { key: palette, table: lut(PALETTES[palette]) }
              const table = colours.current.table
              const d = buf.current.data
              let cover = 0
              for (let i = 0; i < GW * GH; i++) {
                const v = 1 - (s.a[i] - s.b[i])
                const t = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0
                const o = i * 4
                d[o] = table[t * 3]
                d[o + 1] = table[t * 3 + 1]
                d[o + 2] = table[t * 3 + 2]
                d[o + 3] = 255
                if (s.b[i] > 0.2) cover++
              }
              buf.current.flush()
              ctx.imageSmoothingEnabled = true
              ctx.imageSmoothingQuality = 'high'
              ctx.drawImage(buf.current.canvas, 0, 0, W, H)
              const hv = hover.current
              if (hv) circle(ctx, hv.x, hv.y, (brush / GW) * W, undefined, 'rgba(255,255,255,0.7)', 1.5)
              if (f.frame % 12 === 0) setInfo({ n: s.n, cover: cover / (GW * GH) })
            }}
          />
          <Readout
            items={[
              ['Feed F', fmt(F, 4)],
              ['Kill k', fmt(k, 4)],
              ['Iterations', info.n.toLocaleString('en-US')],
              ['Per frame', iters],
              ['B coverage', `${fmt(info.cover * 100, 1)}%`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reseed} resetLabel="Reseed">
        <button type="button" className="btn" onClick={blank}>
          Clear
        </button>
      </PlayBar>
      <Select label="Pattern preset" value={preset} options={[...PRESETS.map((p) => [p.id, `${p.name} (F ${p.F}, k ${p.k})`] as const), ['custom', 'Custom'] as const]} onChange={(v) => (v === 'custom' ? setPreset(v) : choose(v))} />
      <Slider label="Feed rate F" value={F} min={0.01} max={0.1} step={0.0005} format={(v) => v.toFixed(4)} onChange={(v) => {
          setF(v)
          setPreset('custom')
        }} />
      <Slider label="Kill rate k" value={k} min={0.045} max={0.07} step={0.0005} format={(v) => v.toFixed(4)} onChange={(v) => {
          setK(v)
          setPreset('custom')
        }} />
      <Slider label="Diffusion of A" value={Da} min={0.5} max={1.2} step={0.05} onChange={setDa} />
      <Slider label="Diffusion of B" value={Db} min={0.1} max={0.7} step={0.05} onChange={setDb} />
      <Slider label="Speed" value={iters} min={1} max={40} unit=" steps/frame" onChange={setIters} />
      <Slider label="Brush" value={brush} min={2} max={14} unit=" cells" onChange={setBrush} />
      <Choice label="Colours" value={palette} options={[['ocean', 'Ocean'], ['magma', 'Magma'], ['ink', 'Ink'], ['coral', 'Coral']]} onChange={setPalette} />
      <Hint>Paint on the canvas to add chemical B (Shift-drag erases). Tiny changes to feed and kill turn spots into stripes, mazes or dividing “cells”. B must diffuse slower than A for patterns to form.</Hint>
    </SimLayout>
  )
}
