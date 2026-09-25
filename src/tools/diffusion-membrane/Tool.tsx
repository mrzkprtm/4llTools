import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { chart, clear, line, rrect, text } from '../../sim/draw'
import { TAU, clamp, fmt, gaussian, pushCap } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { concentration, liquidLevel, passesMembrane, poreCentres, waterActivity } from './membrane'

const W = 800
const H = 500
const X0 = 20
const X1 = 780
const TOP = 36
const BOT = 326
const TH = BOT - TOP
const MT = 8
const MAX = 1400
const AREA = 270
const WATER = '#1c7ed6'
const SOLUTE = '#e8590c'
const RAD = [2.5, 6]
const BASE = [120, 70]

type Mode = 'diffusion' | 'osmosis'
type Kind = 0 | 1

export default function DiffusionMembrane() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [mode, setMode] = useState<Mode>('diffusion')
  const [pore, setPore] = useState(16)
  const [pores, setPores] = useState(7)
  const [temp, setTemp] = useState(300)
  const [addKind, setAddKind] = useState<Kind>(1)
  const [info, setInfo] = useState({ s: [0, 0], w: [0, 0], c: [0, 0], fs: 0, fw: 0 })
  const sim = useRef({
    n: 0,
    x: new Float32Array(MAX),
    y: new Float32Array(MAX),
    a: new Float32Array(MAX),
    sp: new Float32Array(MAX),
    kind: new Uint8Array(MAX),
    side: new Uint8Array(MAX),
    transit: new Uint8Array(MAX),
    mx: W / 2,
    t: 0,
    level: [TH, TH],
    events: [] as [number, number, number][],
    hist: [[], []] as number[][],
    lastHist: 0,
    ready: false,
  })
  const drag = useRef<'membrane' | 'paint' | null>(null)
  const s = sim.current

  const widths = () => [s.mx - MT / 2 - X0, X1 - s.mx - MT / 2]

  function add(kind: Kind, side: number, count: number, at?: { x: number; y: number }) {
    const r = RAD[kind]
    for (let k = 0; k < count && s.n < MAX; k++) {
      const i = s.n++
      const lo = side ? s.mx + MT / 2 + r : X0 + r
      const hi = side ? X1 - r : s.mx - MT / 2 - r
      const top = BOT - s.level[side] + r
      s.x[i] = at ? clamp(at.x + gaussian() * 12, lo, hi) : lo + Math.random() * (hi - lo)
      s.y[i] = at ? clamp(at.y + gaussian() * 12, top, BOT - r) : top + Math.random() * (BOT - r - top)
      s.a[i] = Math.random() * TAU
      s.sp[i] = 0.6 + Math.random() * 0.8
      s.kind[i] = kind
      s.side[i] = side
      s.transit[i] = 0
    }
  }

  function reset(m: Mode = mode) {
    s.n = 0
    s.mx = W / 2
    s.t = 0
    s.events = []
    s.hist = [[], []]
    s.lastHist = -1
    const lv = m === 'osmosis' ? liquidLevel(250, widths()[0], AREA) : TH
    s.level = [lv, lv]
    add(0, 0, 250)
    add(0, 1, 250)
    add(1, 0, m === 'osmosis' ? 45 : 60)
    s.ready = true
  }
  if (!s.ready) reset()

  function switchMode(m: Mode) {
    setMode(m)
    setPore(m === 'osmosis' ? 10 : 16)
    setPores(m === 'osmosis' ? 10 : 7)
    reset(m)
  }

  function counts() {
    const w = [0, 0]
    const so = [0, 0]
    for (let i = 0; i < s.n; i++) (s.kind[i] ? so : w)[s.side[i]]++
    return { w, so }
  }

  function step(dt: number, centres: number[]) {
    const { w, so } = counts()
    const act = [waterActivity(w[0], so[0], 4), waterActivity(w[1], so[1], 4)]
    const vT = Math.sqrt(temp / 300)
    const face = [s.mx - MT / 2, s.mx + MT / 2]
    for (let i = 0; i < s.n; i++) {
      const k = s.kind[i]
      const r = RAD[k]
      s.a[i] += gaussian() * (k ? 1.2 : 1.5) * Math.sqrt(dt)
      const v = BASE[k] * s.sp[i] * vT
      let nx = s.x[i] + Math.cos(s.a[i]) * v * dt
      let ny = s.y[i] + Math.sin(s.a[i]) * v * dt
      const sd = s.side[i]
      if (s.transit[i]) {
        const now = nx < s.mx ? 0 : 1
        if (now !== sd) {
          s.side[i] = now
          s.events.push([s.t, k, now ? 1 : -1])
        }
        if (nx + r < face[0] || nx - r > face[1]) s.transit[i] = 0
      } else {
        const touching = sd === 0 ? nx + r > face[0] : nx - r < face[1]
        if (touching) {
          let pass = passesMembrane(2 * r, ny, pore, centres)
          // Osmosis: water on a salty side is partly bound to solute, so it crosses less often.
          if (pass && mode === 'osmosis' && k === 0) pass = Math.random() < act[sd]
          if (pass) s.transit[i] = 1
          else {
            nx = sd === 0 ? face[0] - r : face[1] + r
            s.a[i] = Math.PI - s.a[i]
          }
        }
      }
      const side = s.side[i]
      if (nx < X0 + r) {
        nx = X0 + r
        s.a[i] = Math.PI - s.a[i]
      } else if (nx > X1 - r) {
        nx = X1 - r
        s.a[i] = Math.PI - s.a[i]
      }
      const top = BOT - (s.transit[i] ? Math.min(s.level[0], s.level[1]) : s.level[side]) + r
      if (ny < top) {
        ny = Math.min(top, BOT - r)
        if (Math.sin(s.a[i]) < 0) s.a[i] = -s.a[i]
      } else if (ny > BOT - r) {
        ny = BOT - r
        if (Math.sin(s.a[i]) > 0) s.a[i] = -s.a[i]
      }
      s.x[i] = nx
      s.y[i] = ny
    }
    s.t += dt
    while (s.events.length && s.events[0][0] < s.t - 3) s.events.shift()
  }

  function updateLevels() {
    if (mode !== 'osmosis') {
      s.level = [TH, TH]
      return
    }
    const { w } = counts()
    const ws = widths()
    for (const sd of [0, 1]) {
      const target = clamp(liquidLevel(w[sd], ws[sd], AREA), 30, TH)
      s.level[sd] += (target - s.level[sd]) * 0.2
    }
  }

  function snapToSides() {
    for (let i = 0; i < s.n; i++) {
      const r = RAD[s.kind[i]]
      s.transit[i] = 0
      if (s.side[i] === 0 && s.x[i] > s.mx - MT / 2 - r) s.x[i] = s.mx - MT / 2 - r - Math.random() * 6
      if (s.side[i] === 1 && s.x[i] < s.mx + MT / 2 + r) s.x[i] = s.mx + MT / 2 + r + Math.random() * 6
      s.x[i] = clamp(s.x[i], X0 + r, X1 - r)
    }
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') {
      if (Math.abs(p.x - s.mx) < 16 && p.y > TOP - 30 && p.y < BOT) drag.current = 'membrane'
      else if (p.y > TOP && p.y < BOT && p.x > X0 && p.x < X1) {
        drag.current = 'paint'
        add(addKind, p.x < s.mx ? 0 : 1, addKind ? 5 : 12, p)
      }
    } else if (p.type === 'move' && drag.current === 'membrane') {
      s.mx = clamp(p.x, 180, 620)
      snapToSides()
      updateLevels()
    } else if (p.type === 'move' && drag.current === 'paint' && p.y > TOP && p.y < BOT) {
      if (Math.random() < 0.4) add(addKind, p.x < s.mx ? 0 : 1, addKind ? 1 : 3, p)
    }
    if (p.type === 'up') drag.current = null
  }

  const ws = widths()
  const vol = (sd: number) => (ws[sd] * s.level[sd]) / 1e4

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="crosshair"
            label={`Two chambers separated by a membrane with ${pores} pores. Solute: ${info.s[0]} left, ${info.s[1]} right. Water: ${info.w[0]} left, ${info.w[1]} right.`}
            onFrame={(ctx, f) => {
              const centres = poreCentres(pores, TOP, BOT)
              if (f.dt > 0) {
                for (let k = 0; k < 2; k++) step(f.dt / 2, centres)
                updateLevels()
              }
              const { w, so } = counts()
              const conc = [concentration(so[0], vol(0)), concentration(so[1], vol(1))]
              if (f.dt > 0 && s.t - s.lastHist > 0.2) {
                s.lastHist = s.t
                pushCap(s.hist[0], conc[0], 300)
                pushCap(s.hist[1], conc[1], 300)
              }

              clear(ctx, W, H, theme.sunken)
              // Tank and liquid.
              rrect(ctx, X0 - 4, TOP - 4, X1 - X0 + 8, TH + 8, 6, theme.surface, theme.border, 2)
              for (const sd of [0, 1]) {
                const x = sd ? s.mx + MT / 2 : X0
                ctx.fillStyle = alpha(WATER, theme.dark ? 0.16 : 0.1)
                ctx.fillRect(x, BOT - s.level[sd], ws[sd], s.level[sd])
                if (mode === 'osmosis') {
                  line(ctx, x, BOT - s.level[sd], x + ws[sd], BOT - s.level[sd], alpha(WATER, 0.8), 2)
                  const start = liquidLevel(250, W / 2 - MT / 2 - X0, AREA)
                  line(ctx, x, BOT - start, x + ws[sd], BOT - start, alpha(theme.muted, 0.6), 1, [4, 4])
                }
              }
              // Particles, batched by kind.
              for (const k of [0, 1]) {
                ctx.beginPath()
                for (let i = 0; i < s.n; i++) {
                  if (s.kind[i] !== k) continue
                  ctx.moveTo(s.x[i] + RAD[k], s.y[i])
                  ctx.arc(s.x[i], s.y[i], RAD[k], 0, TAU)
                }
                ctx.fillStyle = k ? SOLUTE : alpha(WATER, 0.75)
                ctx.fill()
              }
              // Membrane with pore gaps.
              const mc = theme.dark ? '#c9a27a' : '#8a5a2b'
              let y0 = TOP
              for (const c of centres) {
                rrect(ctx, s.mx - MT / 2, y0, MT, Math.max(0, c - pore / 2 - y0), 2, mc)
                y0 = c + pore / 2
              }
              rrect(ctx, s.mx - MT / 2, y0, MT, Math.max(0, BOT - y0), 2, mc)
              rrect(ctx, s.mx - 22, TOP - 30, 44, 20, 10, drag.current === 'membrane' ? theme.accent : alpha(mc, 0.85))
              text(ctx, '⇆', s.mx, TOP - 15, { color: '#fff', size: 14, align: 'center', weight: 700 })
              text(ctx, 'left', X0 + 6, TOP - 12, { color: theme.muted, size: 13 })
              text(ctx, 'right', X1 - 6, TOP - 12, { color: theme.muted, size: 13, align: 'right' })
              if (mode === 'osmosis')
                for (const sd of [0, 1]) {
                  const d = s.level[sd] - liquidLevel(250, W / 2 - MT / 2 - X0, AREA)
                  const x = sd ? s.mx + MT / 2 + ws[sd] / 2 : X0 + ws[sd] / 2
                  text(ctx, `level ${d >= 0 ? '+' : ''}${Math.round(d)}`, x, BOT - s.level[sd] - 8, { color: WATER, size: 12, align: 'center', weight: 700 })
                }

              // Bars: solute concentration and water amount per side.
              const py = 356
              const ph = 106
              text(ctx, 'solute conc.', X0, py - 4, { color: theme.muted, size: 12 })
              const cmax = Math.max(0.5, conc[0], conc[1]) * 1.15
              const wmax = Math.max(1, w[0], w[1]) * 1.15
              const bar = (x: number, v: number, max: number, color: string, label: string, val: string) => {
                const bh = (v / max) * ph
                rrect(ctx, x, py + 10 + ph - bh, 44, bh, 3, color)
                text(ctx, val, x + 22, py + 6 + ph - bh, { color: theme.text, size: 12, align: 'center' })
                text(ctx, label, x + 22, py + ph + 26, { color: theme.muted, size: 12, align: 'center' })
              }
              bar(X0 + 6, conc[0], cmax, SOLUTE, 'left', fmt(conc[0], 1))
              bar(X0 + 60, conc[1], cmax, alpha(SOLUTE, 0.55), 'right', fmt(conc[1], 1))
              text(ctx, 'water', X0 + 150, py - 4, { color: theme.muted, size: 12 })
              bar(X0 + 150, w[0], wmax, WATER, 'left', String(w[0]))
              bar(X0 + 204, w[1], wmax, alpha(WATER, 0.55), 'right', String(w[1]))
              line(ctx, X0, py + 10 + ph, X0 + 260, py + 10 + ph, theme.border)
              const cx = 330
              chart(ctx, cx, py + 10, X1 - cx, ph, [
                { data: s.hist[0], color: SOLUTE, width: 2.5 },
                { data: s.hist[1], color: alpha(SOLUTE, 0.5), width: 2.5 },
              ], { min: 0, axis: theme.border, span: 300 })
              text(ctx, 'solute concentration over time (dark: left, light: right)', cx, py - 4, { color: theme.muted, size: 12 })

              if (f.frame % 10 === 0) {
                let fs = 0
                let fw = 0
                for (const [, k, d] of s.events) {
                  if (k) fs += d
                  else fw += d
                }
                const span = Math.max(0.5, Math.min(3, s.t))
                setInfo({ s: so, w, c: conc, fs: fs / span, fw: fw / span })
              }
            }}
          />
          <Readout
            items={[
              ['Solute L | R', `${info.s[0]} | ${info.s[1]}`],
              ['Water L | R', `${info.w[0]} | ${info.w[1]}`],
              ['Conc. L | R', `${fmt(info.c[0], 1)} | ${fmt(info.c[1], 1)}`],
              ['Net solute →', `${info.fs >= 0 ? '+' : ''}${fmt(info.fs, 1)}/s`],
              ['Net water →', `${info.fw >= 0 ? '+' : ''}${fmt(info.fw, 1)}/s`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} />
      <Choice label="Mode" value={mode} options={[['diffusion', 'Diffusion'], ['osmosis', 'Osmosis']]} onChange={switchMode} />
      <Slider label="Pore size" value={pore} min={4} max={24} unit=" px" onChange={setPore} />
      <Slider label="Pores" value={pores} min={1} max={14} onChange={setPores} />
      <Slider label="Temperature" value={temp} min={100} max={600} step={10} unit=" K" onChange={setTemp} />
      <Choice label="Add particles" value={addKind} options={[[1, 'Solute'], [0, 'Water']]} onChange={setAddKind} />
      <div className="row" style={{ margin: 0, gap: 6 }}>
        <button type="button" className="btn" onClick={() => add(addKind, 0, addKind ? 10 : 30)}>
          + Left
        </button>
        <button type="button" className="btn" onClick={() => add(addKind, 1, addKind ? 10 : 30)}>
          + Right
        </button>
      </div>
      <Legend items={[[SOLUTE, 'solute (12 px)'], [WATER, 'water (5 px)']]} />
      <Hint>
        Drag the ⇆ handle to move the membrane; click or drag in a chamber to add particles. Pores smaller than 12 px block the solute. In osmosis mode water still crosses, but more of it ends up on the salty side, so that level rises.
      </Hint>
    </SimLayout>
  )
}
