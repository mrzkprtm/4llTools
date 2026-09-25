import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, line, makeBuffer, text } from '../../sim/draw'
import { clamp, fmt, round } from '../../sim/math'
import { PALETTE } from '../../sim/theme'
import { chaosStep, fernStep, optimalR, regularPolygon, RULES, type Pt, type Rule } from './chaos'

const W = 800
const H = 560
const CX = W / 2
const CY = H / 2 + 22
const RADIUS = 255
const BG = [13, 12, 11]
const FERN = ['#b2f2bb', '#51cf66', '#94d82d', '#38d9a9']
const FS = (H - 30) / 10.2 // fern units → pixels

type Mode = 'polygon' | 'fern'
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export default function ChaosGame() {
  const [running, setRunning] = useRunning()
  const [mode, setMode] = useState<Mode>('polygon')
  const [n, setN] = useState(3)
  const [r, setR] = useState(0.5)
  const [rule, setRule] = useState<Rule>('any')
  const [speed, setSpeed] = useState(2.8)
  const [plotted, setPlotted] = useState(0)
  const verts = useRef<Pt[]>(regularPolygon(3, CX, CY, RADIUS))
  const state = useRef({ x: CX, y: CY, last: -1, count: 0, clear: true, prev: [CX, CY] as Pt, target: -1 })
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const held = useRef<number | null>(null)

  function restart() {
    const s = state.current
    const v = verts.current
    Object.assign(s, { x: v.reduce((a, p) => a + p[0], 0) / v.length, y: v.reduce((a, p) => a + p[1], 0) / v.length, last: -1, count: 0, clear: true, target: -1 })
    if (mode === 'fern') Object.assign(s, { x: 0, y: 0 })
    setPlotted(0)
  }
  function setCorners(k: number) {
    setN(k)
    verts.current = regularPolygon(k, CX, CY, RADIUS)
    restart()
  }

  function onPointer(p: SimPointer) {
    if (mode !== 'polygon') return
    if (p.type === 'down') {
      const i = verts.current.findIndex(([x, y]) => Math.hypot(x - p.x, y - p.y) < 22)
      held.current = i >= 0 ? i : null
    }
    if (held.current === null) return
    verts.current[held.current] = [clamp(p.x, 12, W - 12), clamp(p.y, 12, H - 12)]
    restart()
    if (p.type === 'up') held.current = null
  }

  const best = optimalR(n)
  const perFrame = Math.round(10 ** speed)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            maxDpr={1.5}
            onPointer={onPointer}
            cursor={mode === 'polygon' ? 'grab' : undefined}
            label={mode === 'fern' ? `Barnsley fern drawn from ${plotted} points.` : `Chaos game with ${n} corners, jump fraction ${r}, rule: ${rule}; ${plotted} points plotted.`}
            onFrame={(ctx, f) => {
              if (!buf.current) buf.current = makeBuffer(W, H)
              const b = buf.current
              const d = b.data
              const s = state.current
              if (s.clear) {
                for (let o = 0; o < d.length; o += 4) {
                  d[o] = BG[0]
                  d[o + 1] = BG[1]
                  d[o + 2] = BG[2]
                  d[o + 3] = 255
                }
                s.clear = false
              }
              const v = verts.current
              if (f.dt > 0) {
                const cols = (mode === 'fern' ? FERN : PALETTE).map((c) => rgb(c).map((x) => x * 0.35))
                const steps = perFrame
                for (let k = 0; k < steps; k++) {
                  if (k === steps - 1) s.prev = [s.x, s.y]
                  let px: number
                  let py: number
                  let c: number
                  if (mode === 'fern') {
                    c = fernStep(s, Math.random)
                    px = Math.round(W / 2 + s.x * FS)
                    py = Math.round(H - 14 - s.y * FS)
                  } else {
                    c = chaosStep(s, v, r, rule, Math.random)
                    s.target = c
                    px = Math.round(s.x)
                    py = Math.round(s.y)
                  }
                  s.count++
                  // Skip the first few moves while the point settles onto the attractor.
                  if (s.count < 16 || px < 0 || py < 0 || px >= W || py >= H) continue
                  const o = (py * W + px) * 4
                  const cc = cols[c % cols.length]
                  d[o] = Math.min(255, d[o] + cc[0])
                  d[o + 1] = Math.min(255, d[o + 1] + cc[1])
                  d[o + 2] = Math.min(255, d[o + 2] + cc[2])
                }
                if (f.frame % 8 === 0) setPlotted(s.count)
              }
              b.flush()
              ctx.imageSmoothingEnabled = false
              ctx.drawImage(b.canvas, 0, 0, W, H)
              if (mode === 'polygon') {
                // Outline, corners and the most recent jump.
                ctx.beginPath()
                v.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
                ctx.closePath()
                ctx.strokeStyle = 'rgba(255,255,255,0.15)'
                ctx.lineWidth = 1
                ctx.stroke()
                if (s.target >= 0 && perFrame <= 30) {
                  line(ctx, s.prev[0], s.prev[1], v[s.target][0], v[s.target][1], 'rgba(255,255,255,0.45)', 1, [4, 4])
                  circle(ctx, s.x, s.y, 4, '#fff')
                }
                v.forEach(([x, y], i) => {
                  circle(ctx, x, y, 10, PALETTE[i % PALETTE.length], '#fff', 2)
                  text(ctx, String(i + 1), x, y + 4.5, { color: '#fff', size: 12, align: 'center', weight: 700 })
                })
              } else text(ctx, 'Barnsley fern: 4 affine maps', 14, 24, { color: 'rgba(255,255,255,0.6)', size: 13 })
            }}
          />
          <Readout
            items={[
              ['Points plotted', fmt(plotted, 0)],
              ['Corners', mode === 'fern' ? '4 maps' : n],
              ['Jump fraction r', mode === 'fern' ? '—' : fmt(r, 3)],
              ['Rule', mode === 'fern' ? 'weighted maps' : RULES.find((q) => q[0] === rule)![1]],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={restart} resetLabel="Clear" />
      <Choice label="Game" value={mode} options={[['polygon', 'Polygon'], ['fern', 'Barnsley fern']]} onChange={(m) => { setMode(m); state.current.clear = true; state.current.count = 0; Object.assign(state.current, m === 'fern' ? { x: 0, y: 0 } : { x: CX, y: CY, last: -1 }); setPlotted(0) }} />
      {mode === 'polygon' && (
        <>
          <Slider label="Corners" value={n} min={3} max={8} onChange={setCorners} />
          <Slider label="Jump fraction r" value={r} min={0.1} max={0.95} step={0.001} onChange={(x) => { setR(x); restart() }} />
          <button type="button" className="btn" onClick={() => { setR(round(best, 3)); restart() }} disabled={Math.abs(r - round(best, 3)) < 1e-9}>
            Use best r for {n} corners ({fmt(best, 3)})
          </button>
          <Select label="Rule" value={rule} options={RULES} onChange={(x) => { setRule(x); restart() }} />
        </>
      )}
      <Slider label="Points per frame" value={speed} min={0} max={4.3} step={0.1} format={(x) => fmt(Math.round(10 ** x), 0)} onChange={setSpeed} />
      <Hint>Start anywhere, pick a random corner, jump a fraction r of the way there, repeat. The dots are coloured by the corner they jumped to. Drag the corners, try a square with “never the same corner twice”, or slow it down to one point per frame to watch single jumps.</Hint>
    </SimLayout>
  )
}
