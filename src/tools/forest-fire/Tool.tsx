import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { chart, circle, clear, line, makeBuffer, rrect, text } from '../../sim/draw'
import { fmt, pushCap } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { ASH, EMPTY, FIRE, TREE, crossingProbability, makeGrid, randomForest, stepForest, type Grid } from './forest'

const GW = 200
const GH = 120
const CELL = 4
const W = GW * CELL
const GRID_H = GH * CELL
const H = GRID_H + 120
const PC = 0.5927
const SWEEP = Array.from({ length: 21 }, (_, i) => 0.4 + i * 0.02)
const COMPASS = ['E →', 'SE ↘', 'S ↓', 'SW ↙', 'W ←', 'NW ↖', 'N ↑', 'NE ↗']

type Mode = 'forest' | 'percolation'
type Tool = 'fire' | 'tree' | 'clear'

export default function ForestFire() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [mode, setMode] = useState<Mode>('forest')
  const [grow, setGrow] = useState(0.01)
  const [lightning, setLightning] = useState(0.00005)
  const [spread, setSpread] = useState(0.95)
  const [wind, setWind] = useState(0)
  const [windDir, setWindDir] = useState(0)
  const [density, setDensity] = useState(0.59)
  const [tool, setTool] = useState<Tool>('fire')
  const [byAge, setByAge] = useState(true)
  const [steps, setSteps] = useState(1)
  const [info, setInfo] = useState({ trees: 0, burning: 0, fires: 0, largest: 0, burned: 0, crossed: false, done: false })
  const sim = useRef({
    a: makeGrid(GW, GH),
    b: makeGrid(GW, GH),
    sizes: new Map<number, number>(),
    nextId: 1,
    fires: 0,
    largest: 0,
    dens: [] as number[],
    burn: [] as number[],
    sweep: [] as number[],
    ready: false,
  })
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const s = sim.current

  function seed(m: Mode = mode, d = density) {
    const g = s.a
    g.fire.fill(0)
    s.sizes.clear()
    s.nextId = 1
    s.fires = 0
    s.largest = 0
    s.dens = []
    s.burn = []
    if (m === 'forest') {
      for (let i = 0; i < g.cell.length; i++) {
        g.cell[i] = Math.random() < 0.8 ? TREE : EMPTY
        g.age[i] = Math.floor(Math.random() * 400)
      }
    } else {
      g.cell.set(randomForest(GW, GH, d))
      g.age.fill(200)
      const id = s.nextId++
      s.fires = 1
      for (let y = 0; y < GH; y++)
        if (g.cell[y * GW] === TREE) {
          g.cell[y * GW] = FIRE
          g.fire[y * GW] = id
          s.sizes.set(id, (s.sizes.get(id) ?? 0) + 1)
        }
    }
    s.ready = true
  }
  if (!s.ready) seed()

  function switchMode(m: Mode) {
    setMode(m)
    seed(m)
  }

  function paint(p: SimPointer) {
    const cx = Math.floor(p.x / CELL)
    const cy = Math.floor(p.y / CELL)
    const g = s.a
    const r = tool === 'fire' ? 1 : 2
    let id = 0
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= GW || y >= GH || (x - cx) ** 2 + (y - cy) ** 2 > r * r + 1) continue
        const i = y * GW + x
        if (tool === 'fire' && g.cell[i] === TREE) {
          if (!id) {
            id = s.nextId++
            s.fires++
          }
          g.cell[i] = FIRE
          g.fire[i] = id
          s.sizes.set(id, (s.sizes.get(id) ?? 0) + 1)
        } else if (tool === 'tree' && g.cell[i] !== FIRE) {
          g.cell[i] = TREE
          g.age[i] = 0
        } else if (tool === 'clear') g.cell[i] = EMPTY
      }
  }

  function onPointer(p: SimPointer) {
    if (p.y < GRID_H && p.down && (p.type === 'down' || p.type === 'move')) paint(p)
  }

  function advance() {
    const perc = mode === 'percolation'
    const a = (windDir * Math.PI) / 180
    const params = {
      grow: perc ? 0 : grow,
      lightning: perc ? 0 : lightning,
      spread: perc ? 1 : spread,
      wind: perc ? 0 : wind,
      wx: Math.cos(a),
      wy: Math.sin(a),
      ashDecay: perc ? 0 : 0.08,
    }
    const res = stepForest(s.a, s.b, params, () => s.nextId++)
    s.fires += res.strikes
    for (const [id, n] of res.burned) {
      const v = (s.sizes.get(id) ?? 0) + n
      s.sizes.set(id, v)
      if (v > s.largest) s.largest = v
    }
    const t: Grid = s.a
    s.a = s.b
    s.b = t
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            maxDpr={1.5}
            cursor="crosshair"
            label={`Forest fire cellular automaton, ${fmt(info.trees * 100, 0)}% trees and ${info.burning} cells burning.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) for (let k = 0; k < steps; k++) advance()
              // Fill in one point of the percolation sweep per frame.
              if (mode === 'percolation' && s.sweep.length < SWEEP.length) s.sweep.push(crossingProbability(SWEEP[s.sweep.length], 14, 100, 60))

              const g = s.a
              if (!buf.current) buf.current = makeBuffer(GW, GH)
              const d = buf.current.data
              let trees = 0
              let burning = 0
              let burnt = 0
              let crossed = false
              const flick = f.frame
              for (let i = 0; i < g.cell.length; i++) {
                const c = g.cell[i]
                const o = i * 4
                if (c === TREE) {
                  trees++
                  const k = byAge ? Math.min(1, g.age[i] / 300) : 0.5
                  d[o] = 140 - k * 105
                  d[o + 1] = 225 - k * 95
                  d[o + 2] = 120 - k * 70
                } else if (c === FIRE) {
                  burning++
                  burnt++
                  const hot = ((i * 7 + flick) & 3) / 3
                  d[o] = 255
                  d[o + 1] = 110 + hot * 110
                  d[o + 2] = 20
                  if (i % GW === GW - 1) crossed = true
                } else if (c === ASH) {
                  burnt++
                  d[o] = 88
                  d[o + 1] = 84
                  d[o + 2] = 80
                  if (i % GW === GW - 1) crossed = true
                } else {
                  d[o] = 58
                  d[o + 1] = 45
                  d[o + 2] = 34
                }
                d[o + 3] = 255
              }
              buf.current.flush()
              clear(ctx, W, H, theme.sunken)
              ctx.imageSmoothingEnabled = false
              ctx.drawImage(buf.current.canvas, 0, 0, W, GRID_H)
              ctx.imageSmoothingEnabled = true
              if (f.dt > 0 && f.frame % 3 === 0) {
                pushCap(s.dens, trees / g.cell.length, 400)
                pushCap(s.burn, burning, 400)
              }
              if (mode === 'forest' && wind > 0) {
                const a = (windDir * Math.PI) / 180
                rrect(ctx, W - 92, 10, 82, 40, 8, 'rgba(0,0,0,0.55)')
                line(ctx, W - 51 - Math.cos(a) * 16, 30 - Math.sin(a) * 16, W - 51 + Math.cos(a) * 16, 30 + Math.sin(a) * 16, '#fff', 3)
                circle(ctx, W - 51 + Math.cos(a) * 16, 30 + Math.sin(a) * 16, 4, '#fff')
                text(ctx, 'wind', W - 86, 46, { color: '#ddd', size: 12 })
              }

              // Lower panel.
              const py = GRID_H + 26
              const ph = H - py - 10
              if (mode === 'forest') {
                text(ctx, 'tree density', 10, py - 8, { color: '#2f9e44', size: 12, weight: 700 })
                text(ctx, 'burning cells', 130, py - 8, { color: '#e8590c', size: 12, weight: 700 })
                chart(ctx, 10, py, W - 20, ph, [{ data: s.dens, color: '#2f9e44', width: 2 }], { min: 0, max: 1, axis: theme.border, span: 400 })
                chart(ctx, 10, py, W - 20, ph, [{ data: s.burn, color: '#e8590c', width: 1.5 }], { min: 0, span: 400 })
                text(ctx, `${fmt((trees / g.cell.length) * 100, 1)}% trees`, W - 12, py - 8, { color: theme.muted, size: 12, align: 'right' })
              } else {
                const x0 = 60
                const cw = W - 100
                const X = (dd: number) => x0 + ((dd - 0.4) / 0.4) * cw
                const Y = (pp: number) => py + ph - pp * ph
                line(ctx, x0, py + ph, x0 + cw, py + ph, theme.border)
                line(ctx, x0, py, x0, py + ph, theme.border)
                for (const dd of [0.4, 0.5, 0.6, 0.7, 0.8]) text(ctx, `${dd * 100}%`, X(dd), py + ph + 0, { color: theme.muted, size: 12, align: 'center', baseline: 'top' })
                line(ctx, X(PC), py, X(PC), py + ph, alpha(theme.accent, 0.8), 1.5, [4, 4])
                text(ctx, 'pc ≈ 59.3%', X(PC) + 6, py + 12, { color: theme.accent, size: 12 })
                ctx.beginPath()
                s.sweep.forEach((pp, i) => (i ? ctx.lineTo(X(SWEEP[i]), Y(pp)) : ctx.moveTo(X(SWEEP[i]), Y(pp))))
                ctx.strokeStyle = '#1c7ed6'
                ctx.lineWidth = 2.5
                ctx.stroke()
                line(ctx, X(density), py, X(density), py + ph, theme.text, 2)
                text(ctx, 'chance fire crosses', 6, py - 8, { color: '#1c7ed6', size: 12, weight: 700 })
                text(ctx, 'tree density →', x0 + cw, py - 8, { color: theme.muted, size: 12, align: 'right' })
                const msg = crossed ? 'The fire reached the far side!' : burning ? 'Burning…' : 'The fire died out before crossing.'
                rrect(ctx, 10, 10, 300, 30, 8, 'rgba(0,0,0,0.6)')
                text(ctx, msg, 22, 30, { color: crossed ? '#ffa94d' : '#fff', size: 14, weight: 700, mono: false })
              }

              if (f.frame % 10 === 0)
                setInfo({ trees: trees / g.cell.length, burning, fires: s.fires, largest: s.largest, burned: burnt / g.cell.length, crossed, done: burning === 0 })
            }}
          />
          <Readout
            items={
              mode === 'forest'
                ? [
                    ['Trees', `${fmt(info.trees * 100, 1)}%`],
                    ['Burning', info.burning],
                    ['Fires', info.fires],
                    ['Largest fire', `${info.largest} cells`],
                  ]
                : [
                    ['Tree density', `${Math.round(density * 100)}%`],
                    ['Burned', `${fmt(info.burned * 100, 1)}%`],
                    ['Crossed?', info.crossed ? 'yes' : info.done ? 'no' : '…'],
                    ['Critical density', '≈ 59.3%'],
                  ]
            }
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => seed()} onStep={advance} resetLabel={mode === 'forest' ? 'New forest' : 'New trial'} />
      <Choice label="Mode" value={mode} options={[['forest', 'Forest'], ['percolation', 'Percolation']]} onChange={switchMode} />
      {mode === 'forest' ? (
        <>
          <Slider label="Tree growth p" value={grow} min={0} max={0.05} step={0.001} onChange={setGrow} />
          <Slider label="Lightning f" value={lightning} min={0} max={0.0005} step={0.00001} format={(v) => (v ? v.toExponential(0) : '0')} onChange={setLightning} />
          <Slider label="Spread chance (dryness)" value={spread} min={0.2} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={setSpread} />
          <Slider label="Wind strength" value={wind} min={0} max={1} step={0.05} onChange={setWind} />
          <Slider label="Wind blows towards" value={windDir} min={0} max={315} step={45} format={(v) => COMPASS[Math.round(v / 45) % 8]} onChange={setWindDir} />
        </>
      ) : (
        <Slider
          label="Tree density"
          value={density}
          min={0.3}
          max={0.9}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => {
            setDensity(v)
            seed('percolation', v)
          }}
        />
      )}
      <Choice label="Click to" value={tool} options={[['fire', 'Ignite'], ['tree', 'Plant'], ['clear', 'Firebreak']]} onChange={setTool} />
      <Slider label="Steps per frame" value={steps} min={1} max={4} onChange={setSteps} />
      <Toggle label="Shade trees by age" checked={byAge} onChange={setByAge} />
      <Legend items={[['#8ce178', 'young tree'], ['#237b32', 'old tree'], ['#ff9f14', 'fire'], ['#585450', 'ash'], ['#3a2d22', 'bare ground']]} />
      <Hint>
        {mode === 'forest'
          ? 'Trees regrow and lightning strikes at random, so the forest settles into a cycle of small and rare huge fires. Click to start a fire, plant trees or cut a firebreak; wind pushes the flames downwind.'
          : 'A fire is lit along the left edge of a random forest. Below about 59% tree cover it almost always dies out; above it, it almost always crosses. Try densities near the threshold and press New trial a few times.'}
      </Hint>
    </SimLayout>
  )
}
