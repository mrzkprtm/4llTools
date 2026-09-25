import { useId, useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { clear, makeBuffer, rrect, text } from '../../sim/draw'
import { clamp, fmt, rng } from '../../sim/math'
import { useTheme } from '../../sim/theme'
import { ecaStep, guessClass, randomRow, ruleTable, singleCell } from './eca'

const W = 800
const H = 520
const TOP = 92
const SLOT = W / 8
const IC = 16

type Start = 'single' | 'random'
type Palette = 'paper' | 'night' | 'ember' | 'mint'
const PALETTES: Record<Palette, [number[], number[]]> = {
  paper: [[252, 251, 247], [27, 26, 23]],
  night: [[13, 12, 11], [126, 224, 255]],
  ember: [[26, 14, 9], [255, 138, 61]],
  mint: [[236, 248, 240], [20, 110, 70]],
}
const PRESETS = [30, 90, 110, 184, 150]
const CLASS_NAMES = ['', 'class 1 · uniform', 'class 2 · periodic', 'class 3 · chaotic', 'class 4 · complex']
const rgb = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`

export default function CellularAutomaton() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [rule, setRule] = useState(30)
  const [start, setStart] = useState<Start>('single')
  const [cell, setCell] = useState(4)
  const [wrap, setWrap] = useState(true)
  const [palette, setPalette] = useState<Palette>('paper')
  const [lps, setLps] = useState(40)
  const [gen, setGen] = useState(0)
  const numId = useId()
  const cols = Math.floor(W / cell)
  const visible = Math.floor((H - TOP) / cell)
  const sim = useRef({ rows: [] as Uint8Array[], cur: new Uint8Array(0) as Uint8Array, next: new Uint8Array(0) as Uint8Array, gen: 0, acc: 0, key: '' })
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const cls = useMemo(() => guessClass(rule, rng(rule + 1)), [rule])
  const table = ruleTable(rule)

  function restart() {
    const s = sim.current
    s.cur = start === 'single' ? singleCell(cols) : randomRow(cols, Math.random)
    s.next = new Uint8Array(cols)
    s.rows = [s.cur.slice()]
    s.gen = 0
    s.acc = 0
    s.key = `${rule}|${start}|${cols}|${wrap}`
    setGen(0)
  }

  function addLine() {
    const s = sim.current
    ecaStep(s.cur, s.next, rule, wrap)
    ;[s.cur, s.next] = [s.next, s.cur]
    s.rows.push(s.cur.slice())
    if (s.rows.length > visible) s.rows.splice(0, s.rows.length - visible)
    s.gen++
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down' || p.y > TOP - 6) return
    const k = 7 - Math.floor(p.x / SLOT)
    setRule(rule ^ (1 << k))
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="pointer"
            maxDpr={1.5}
            label={`Elementary cellular automaton rule ${rule}, generation ${gen}.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              if (s.key !== `${rule}|${start}|${cols}|${wrap}`) restart()
              if (f.dt > 0) {
                s.acc += f.dt * lps
                let n = Math.min(visible, Math.floor(s.acc))
                s.acc -= Math.floor(s.acc)
                while (n-- > 0) addLine()
              }
              const [bg, fg] = PALETTES[palette]
              if (!buf.current || buf.current.canvas.width !== cols || buf.current.canvas.height !== visible) buf.current = makeBuffer(cols, visible)
              const b = buf.current
              const d = b.data
              for (let y = 0; y < visible; y++) {
                const row = s.rows[y]
                for (let x = 0; x < cols; x++) {
                  const o = (y * cols + x) * 4
                  const c = row ? (row[x] ? fg : bg) : bg
                  d[o] = c[0]
                  d[o + 1] = c[1]
                  d[o + 2] = c[2]
                  d[o + 3] = 255
                }
              }
              b.flush()
              clear(ctx, W, H, theme.sunken)
              ctx.imageSmoothingEnabled = false
              ctx.drawImage(b.canvas, 0, TOP, cols * cell, visible * cell)
              ctx.fillStyle = rgb(bg)
              ctx.fillRect(cols * cell, TOP, W - cols * cell, H - TOP)

              // The rule table: each neighbourhood and the cell it produces. Click to flip.
              for (let k = 0; k < 8; k++) {
                const p = 7 - k
                const cx = k * SLOT + SLOT / 2
                rrect(ctx, k * SLOT + 5, 6, SLOT - 10, TOP - 14, 8, theme.surface, theme.border)
                for (let j = 0; j < 3; j++) {
                  const on = (p >> (2 - j)) & 1
                  ctx.fillStyle = on ? rgb(fg) : rgb(bg)
                  ctx.fillRect(cx - 1.5 * IC + j * IC, 14, IC - 1, IC - 1)
                  ctx.strokeStyle = theme.border
                  ctx.strokeRect(cx - 1.5 * IC + j * IC, 14, IC - 1, IC - 1)
                }
                ctx.fillStyle = table[p] ? rgb(fg) : rgb(bg)
                ctx.fillRect(cx - IC / 2, 14 + IC + 4, IC - 1, IC - 1)
                ctx.strokeStyle = table[p] ? theme.accent : theme.border
                ctx.lineWidth = 2
                ctx.strokeRect(cx - IC / 2, 14 + IC + 4, IC - 1, IC - 1)
                ctx.lineWidth = 1
                text(ctx, `${p.toString(2).padStart(3, '0')}→${table[p]}`, cx, TOP - 16, { color: theme.muted, size: 12, align: 'center' })
              }
              if (f.frame % 8 === 0 && running) setGen(s.gen)
            }}
          />
          <Readout
            items={[
              ['Rule in binary', rule.toString(2).padStart(8, '0')],
              ['Generation', fmt(gen)],
              ['Width', `${cols} cells`],
              ['Class (guess)', CLASS_NAMES[cls]],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onStep={() => { addLine(); setGen(sim.current.gen) }} onReset={restart} resetLabel="Restart" />
      <Slider label="Rule" value={rule} min={0} max={255} onChange={setRule} />
      <div className="sim-field">
        <label className="sim-label" htmlFor={numId}>Rule number</label>
        <div className="row sim-bar">
          <input id={numId} type="number" min={0} max={255} value={rule} style={{ width: 80 }} onChange={(e) => setRule(clamp(Math.round(Number(e.target.value) || 0), 0, 255))} />
          {PRESETS.map((r) => (
            <button key={r} type="button" className={`btn ${r === rule ? 'primary' : ''}`} onClick={() => setRule(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <Choice label="Start from" value={start} options={[['single', 'One cell'], ['random', 'Random']]} onChange={setStart} />
      <Slider label="Speed" value={lps} min={1} max={240} unit=" lines/s" onChange={setLps} />
      <Slider label="Cell size" value={cell} min={2} max={12} unit=" px" onChange={setCell} />
      <Select label="Colours" value={palette} options={[['paper', 'Paper'], ['night', 'Night'], ['ember', 'Ember'], ['mint', 'Mint']]} onChange={setPalette} />
      <Toggle label="Wrap round the edges" checked={wrap} onChange={setWrap} />
      <Hint>Each new row is built from the one above: every cell looks at itself and its two neighbours and the rule table says what comes next. Click a table entry to flip that bit. Rule 30 looks random, 90 draws Sierpiński triangles, 110 can compute anything.</Hint>
    </SimLayout>
  )
}
