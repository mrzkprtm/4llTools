import { useId, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { chart, clear, makeBuffer, text } from '../../sim/draw'
import { fmt, pushCap } from '../../sim/math'
import { PATTERNS, lifeStep, parseRule, patternCells, ruleToString, stamp, type PatternName, type Rule } from './life'

const W = 800
const GH = 500
const H = 560
const BG = [13, 12, 11]

type Brush = 'draw' | PatternName
const BRUSHES = [
  ['draw', 'Draw / erase cells'],
  ['glider', 'Glider'],
  ['lwss', 'Lightweight spaceship'],
  ['pulsar', 'Pulsar'],
  ['gun', 'Gosper glider gun'],
  ['rpentomino', 'R-pentomino'],
  ['acorn', 'Acorn'],
  ['diehard', 'Diehard'],
] as const
const RULES = [
  ['B3/S23', 'Conway B3/S23'],
  ['B36/S23', 'HighLife B36/S23'],
  ['B2/S', 'Seeds B2/S'],
  ['B3678/S34678', 'Day & Night'],
  ['custom', 'Custom…'],
] as const

// Colour by age: newborn cells are near white-yellow, older ones cool to teal then deep blue.
const AGE_LUT = (() => {
  const stops: [number, number, number, number][] = [
    [1, 255, 244, 190],
    [3, 255, 190, 70],
    [8, 60, 210, 170],
    [30, 50, 110, 230],
    [120, 60, 50, 150],
  ]
  const lut = new Uint8Array(256 * 3)
  for (let a = 0; a < 256; a++) {
    let k = 0
    while (k < stops.length - 2 && a > stops[k + 1][0]) k++
    const [a0, r0, g0, b0] = stops[k]
    const [a1, r1, g1, b1] = stops[k + 1]
    const t = Math.max(0, Math.min(1, (a - a0) / (a1 - a0)))
    lut[a * 3] = r0 + (r1 - r0) * t
    lut[a * 3 + 1] = g0 + (g1 - g0) * t
    lut[a * 3 + 2] = b0 + (b1 - b0) * t
  }
  return lut
})()

const speedOf = (v: number) => Math.round(240 ** (v / 100))

function makeWorld(cols: number) {
  const rows = Math.round((cols * GH) / W)
  return { cols, rows, cells: new Uint16Array(cols * rows), next: new Uint16Array(cols * rows) }
}

export default function GameOfLife() {
  const [running, setRunning] = useRunning()
  const [cols, setCols] = useState(100)
  const [speedV, setSpeedV] = useState(55)
  const [density, setDensity] = useState(0.25)
  const [brush, setBrush] = useState<Brush>('draw')
  const [turns, setTurns] = useState(0)
  const [ageColour, setAgeColour] = useState(true)
  const [preset, setPreset] = useState<(typeof RULES)[number][0]>('B3/S23')
  const [ruleText, setRuleText] = useState('B3/S23')
  const [stats, setStats] = useState({ gen: 0, pop: 0 })
  const ruleId = useId()
  const [initial] = useState(() => {
    const w = makeWorld(100)
    stamp(w.cells, w.cols, w.rows, patternCells(PATTERNS.gun), 4, 4)
    stamp(w.cells, w.cols, w.rows, patternCells(PATTERNS.acorn), 70, 38)
    return w
  })
  const world = useRef(initial)
  const rule = useRef<Rule>(parseRule('B3/S23')!)
  const gen = useRef({ n: 0, acc: 0, history: [] as number[] })
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const paint = useRef<{ value: number; last: [number, number] | null } | null>(null)
  const hover = useRef<[number, number] | null>(null)
  const ruleOk = parseRule(ruleText) !== null
  const gps = speedOf(speedV)

  const population = () => world.current.cells.reduce((s, v) => s + (v ? 1 : 0), 0)

  function sync() {
    setStats({ gen: gen.current.n, pop: population() })
  }

  function resize(c: number) {
    setCols(c)
    const old = world.current
    const w = makeWorld(c)
    const ox = Math.floor((w.cols - old.cols) / 2)
    const oy = Math.floor((w.rows - old.rows) / 2)
    for (let y = 0; y < old.rows; y++)
      for (let x = 0; x < old.cols; x++) {
        const nx = x + ox
        const ny = y + oy
        if (nx >= 0 && ny >= 0 && nx < w.cols && ny < w.rows) w.cells[ny * w.cols + nx] = old.cells[y * old.cols + x]
      }
    world.current = w
    buf.current = null
    sync()
  }

  function stepOnce() {
    const w = world.current
    const pop = lifeStep(w.cells, w.next, w.cols, w.rows, rule.current)
    ;[w.cells, w.next] = [w.next, w.cells]
    gen.current.n++
    pushCap(gen.current.history, pop, 400)
  }

  function clearAll() {
    world.current.cells.fill(0)
    gen.current = { n: 0, acc: 0, history: [] }
    sync()
  }

  function randomFill() {
    const w = world.current
    for (let i = 0; i < w.cells.length; i++) w.cells[i] = Math.random() < density ? 1 : 0
    gen.current = { n: 0, acc: 0, history: [] }
    sync()
  }

  function applyRule(s: string) {
    setRuleText(s)
    const r = parseRule(s)
    if (r) rule.current = r
  }

  const cellOf = (p: SimPointer): [number, number] | null => {
    const w = world.current
    const cs = W / w.cols
    const x = Math.floor(p.x / cs)
    const y = Math.floor(p.y / cs)
    return x >= 0 && y >= 0 && x < w.cols && y < w.rows ? [x, y] : null
  }

  function onPointer(p: SimPointer) {
    const cell = cellOf(p)
    hover.current = cell
    const w = world.current
    if (brush !== 'draw') {
      if (p.type === 'down' && cell) {
        const pat = patternCells(PATTERNS[brush], turns)
        const pw = Math.max(...pat.map(([x]) => x)) + 1
        const ph = Math.max(...pat.map(([, y]) => y)) + 1
        stamp(w.cells, w.cols, w.rows, pat, cell[0] - Math.floor(pw / 2), cell[1] - Math.floor(ph / 2))
        sync()
      }
      return
    }
    if (p.type === 'down' && cell) {
      const erase = p.button === 2 || p.shift || w.cells[cell[1] * w.cols + cell[0]] > 0
      paint.current = { value: erase ? 0 : 1, last: null }
    }
    const pt = paint.current
    if (pt && cell) {
      // Fill in the cells between pointer samples so fast strokes have no gaps.
      const [x1, y1] = cell
      const [x0, y0] = pt.last ?? cell
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / n)
        const y = Math.round(y0 + ((y1 - y0) * k) / n)
        w.cells[y * w.cols + x] = pt.value
      }
      pt.last = cell
    }
    if (p.type === 'up') {
      paint.current = null
      sync()
    }
  }

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
            label={`Game of Life on a ${cols} by ${world.current.rows} wrap-around grid, rule ${ruleToString(rule.current)}, generation ${stats.gen}, population ${stats.pop}.`}
            onFrame={(ctx, f) => {
              const g = gen.current
              if (f.dt > 0 && !paint.current) {
                g.acc += f.dt * gps
                let n = Math.min(8, Math.floor(g.acc))
                g.acc -= Math.floor(g.acc)
                while (n-- > 0) stepOnce()
              }
              const w = world.current
              if (!buf.current || buf.current.canvas.width !== w.cols) buf.current = makeBuffer(w.cols, w.rows)
              const b = buf.current
              const d = b.data
              const cells = w.cells
              for (let i = 0; i < cells.length; i++) {
                const a = cells[i]
                const o = i * 4
                if (!a) {
                  d[o] = BG[0]
                  d[o + 1] = BG[1]
                  d[o + 2] = BG[2]
                } else if (ageColour) {
                  const k = Math.min(255, a) * 3
                  d[o] = AGE_LUT[k]
                  d[o + 1] = AGE_LUT[k + 1]
                  d[o + 2] = AGE_LUT[k + 2]
                } else {
                  d[o] = 120
                  d[o + 1] = 230
                  d[o + 2] = 140
                }
                d[o + 3] = 255
              }
              b.flush()
              clear(ctx, W, H, '#0d0c0b')
              ctx.imageSmoothingEnabled = false
              const cs = W / w.cols
              ctx.drawImage(b.canvas, 0, 0, W, w.rows * cs)
              if (cs >= 6) {
                ctx.beginPath()
                for (let x = 0; x <= w.cols; x++) {
                  ctx.moveTo(x * cs, 0)
                  ctx.lineTo(x * cs, w.rows * cs)
                }
                for (let y = 0; y <= w.rows; y++) {
                  ctx.moveTo(0, y * cs)
                  ctx.lineTo(W, y * cs)
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.06)'
                ctx.lineWidth = 1
                ctx.stroke()
              }
              // Ghost preview of the pattern (or the brush cell) under the pointer.
              const hv = hover.current
              if (hv) {
                ctx.fillStyle = brush === 'draw' ? 'rgba(255,255,255,0.25)' : 'rgba(255,200,80,0.55)'
                if (brush === 'draw') ctx.fillRect(hv[0] * cs, hv[1] * cs, cs, cs)
                else {
                  const pat = patternCells(PATTERNS[brush], turns)
                  const pw = Math.max(...pat.map(([x]) => x)) + 1
                  const ph = Math.max(...pat.map(([, y]) => y)) + 1
                  for (const [dx, dy] of pat) {
                    const x = (((hv[0] - Math.floor(pw / 2) + dx) % w.cols) + w.cols) % w.cols
                    const y = (((hv[1] - Math.floor(ph / 2) + dy) % w.rows) + w.rows) % w.rows
                    ctx.fillRect(x * cs, y * cs, cs, cs)
                  }
                }
              }
              // Population sparkline strip.
              const top = w.rows * cs
              ctx.fillStyle = '#171614'
              ctx.fillRect(0, top, W, H - top)
              ctx.fillStyle = 'rgba(255,255,255,0.12)'
              ctx.fillRect(0, top, W, 1)
              const hist = g.history
              chart(ctx, 150, top + 10, W - 170, H - top - 20, [{ data: hist, color: 'rgba(120,230,160,0.25)', fill: true }, { data: hist, color: '#78e6a0', width: 1.5 }], { min: 0, span: 400 })
              text(ctx, 'population', 14, top + 26, { color: '#9a958a', size: 12 })
              text(ctx, fmt(hist.length ? hist[hist.length - 1] : population()), 14, top + 46, { color: '#f3efe6', size: 16, weight: 700 })
              if (f.frame % 10 === 0 && running) setStats({ gen: g.n, pop: hist.length ? hist[hist.length - 1] : population() })
            }}
          />
          <Readout
            items={[
              ['Generation', fmt(stats.gen)],
              ['Population', fmt(stats.pop)],
              ['Rule', ruleToString(rule.current)],
              ['Grid', `${cols} × ${world.current.rows}`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onStep={() => { stepOnce(); sync() }} onReset={clearAll} resetLabel="Clear">
        <button type="button" className="btn" onClick={randomFill}>Random</button>
      </PlayBar>
      <Slider label="Speed" value={speedV} min={0} max={100} format={(v) => String(speedOf(v))} unit=" gen/s" onChange={setSpeedV} />
      <Slider label="Grid width" value={cols} min={40} max={200} step={10} unit=" cells" onChange={resize} />
      <Slider label="Random density" value={density} min={0.05} max={0.8} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={setDensity} />
      <Select label="Click to place" value={brush} options={BRUSHES} onChange={setBrush} />
      {brush !== 'draw' && (
        <button type="button" className="btn" onClick={() => setTurns((t) => (t + 1) % 4)}>
          Rotate pattern ({turns * 90}°)
        </button>
      )}
      <Select label="Rule" value={preset} options={RULES} onChange={(v) => { setPreset(v); if (v !== 'custom') applyRule(v) }} />
      <div className="sim-field">
        <label className="sim-label" htmlFor={ruleId}>
          Rule string {!ruleOk && <span className="sim-val" style={{ color: 'var(--danger)' }}>not valid</span>}
        </label>
        <input id={ruleId} type="text" className="sim-text sim-mono" value={ruleText} aria-invalid={!ruleOk} onChange={(e) => { setPreset('custom'); applyRule(e.target.value) }} />
      </div>
      <Toggle label="Colour cells by age" checked={ageColour} onChange={setAgeColour} />
      <Hint>Click or drag to draw; start on a live cell to erase. Pick a pattern and click to stamp it (the ghost shows where). B3/S23 means a cell is born with 3 neighbours and survives with 2 or 3; the edges wrap round.</Hint>
    </SimLayout>
  )
}
