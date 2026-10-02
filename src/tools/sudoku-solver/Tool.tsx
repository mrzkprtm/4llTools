import { useRef, useState, type KeyboardEvent } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { clear, line, rrect, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { PRESETS, candidateMask, conflicts, maskDigits, parseGrid, solveSudoku, sudokuSearch, type SudokuEvent } from './sudoku'

const W = 800
const H = 508
const BX = 20
const BY = 20
const CS = 52
const PX = 522
const PW = 78
const PH = 56
const GAP = 8

type Preset = keyof typeof PRESETS | 'blank'
const PRESET_OPTIONS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['hardest', "World's hardest (Inkala)"], ['blank', 'Blank grid']] as const

const speedOf = (v: number) => 2 * 2500 ** (v / 100)
const empty = () => (function* (): Generator<SudokuEvent> {})()

export default function SudokuSolver() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [preset, setPreset] = useState<Preset>('medium')
  const [pencil, setPencil] = useState(false)
  const [speedV, setSpeedV] = useState(40)
  const [, setTick] = useState(0)
  const givens = useRef(parseGrid(PRESETS.medium))
  const search = useRef<ReturnType<typeof sudokuSearch> | null>(null)
  const sel = useRef<number | null>(null)
  const fx = useRef({ cur: -1, flash: new Float32Array(81), tried: new Uint16Array(81), acc: 0 })
  const wrap = useRef<HTMLDivElement>(null)
  const sps = speedOf(speedV)
  const bump = () => setTick((t) => t + 1)

  function clearFx() {
    fx.current = { cur: -1, flash: new Float32Array(81), tried: new Uint16Array(81), acc: 0 }
  }

  function load(p: Preset) {
    setPreset(p)
    givens.current = p === 'blank' ? new Array<number>(81).fill(0) : parseGrid(PRESETS[p])
    search.current = null
    clearFx()
    setRunning(false)
    bump()
  }

  function setCell(i: number, d: number) {
    givens.current[i] = d
    search.current = null
    clearFx()
    setRunning(false)
    bump()
  }

  function handle(ev: SudokuEvent) {
    const e = fx.current
    if (ev.kind === 'pick') e.tried[ev.cell] = 0
    if (ev.kind === 'place') e.cur = ev.cell
    if (ev.kind === 'undo') {
      e.tried[ev.cell] |= 1 << ev.digit
      e.flash[ev.cell] = 1
    }
    if (ev.kind === 'dead') e.flash[ev.cell] = 1
  }

  function ensureSearch() {
    if (!search.current || search.current.state.done) {
      search.current = sudokuSearch(givens.current)
      clearFx()
    }
  }

  function play(v: boolean) {
    if (v) ensureSearch()
    setRunning(v)
  }

  function step() {
    ensureSearch()
    // Skip the bookkeeping 'pick' so every press shows a digit change.
    for (let k = 0; k < 2; k++) {
      const r = search.current!.gen.next()
      if (r.done) break
      handle(r.value)
      if (r.value.kind !== 'pick') break
    }
    bump()
  }

  function instant() {
    const r = solveSudoku(givens.current)
    search.current = { state: { grid: r.grid ?? [...givens.current], guesses: r.guesses, backtracks: r.backtracks, placements: r.placements, done: true, solved: !!r.grid }, gen: empty() }
    clearFx()
    setRunning(false)
    bump()
  }

  function reset() {
    search.current = null
    clearFx()
    setRunning(false)
    bump()
  }

  const padAt = (x: number, y: number) => {
    if (x < PX || x > PX + 3 * PW + 2 * GAP) return -1
    const c = Math.floor((x - PX) / (PW + GAP))
    const r = Math.floor((y - 30) / (PH + GAP))
    if (r >= 0 && r < 3 && (x - PX) % (PW + GAP) <= PW && (y - 30) % (PH + GAP) <= PH) return r * 3 + c + 1
    if (y >= 30 + 3 * (PH + GAP) && y <= 30 + 3 * (PH + GAP) + 46) return 0
    return -1
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down') return
    wrap.current?.focus()
    const c = Math.floor((p.x - BX) / CS)
    const r = Math.floor((p.y - BY) / CS)
    if (r >= 0 && r < 9 && c >= 0 && c < 9) {
      sel.current = r * 9 + c
      return bump()
    }
    const d = padAt(p.x, p.y)
    if (d >= 0 && sel.current !== null) setCell(sel.current, d)
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const s = sel.current ?? 0
    const moves: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }
    if (e.key in moves) {
      e.preventDefault()
      const r = Math.floor(s / 9)
      const c = s % 9
      const m = moves[e.key]
      sel.current = Math.abs(m) === 9 ? ((r + m / 9 + 9) % 9) * 9 + c : r * 9 + ((c + m + 9) % 9)
      bump()
    } else if (/^[1-9]$/.test(e.key) && sel.current !== null) setCell(sel.current, Number(e.key))
    else if (['0', '.', 'Backspace', 'Delete', ' '].includes(e.key) && sel.current !== null) {
      e.preventDefault()
      setCell(sel.current, 0)
    }
  }

  const st = search.current?.state
  const grid = st?.grid ?? givens.current
  const bad = conflicts(grid)
  const filled = grid.filter(Boolean).length
  const status = bad.size ? 'conflicts' : st?.done ? (st.solved ? 'solved' : 'no solution') : st ? (running ? 'solving…' : 'paused') : 'editing'

  return (
    <SimLayout
      stage={
        <>
          <div ref={wrap} tabIndex={0} onKeyDown={onKey} aria-label="Sudoku grid: click a cell, type a digit, move with the arrow keys" style={{ outlineOffset: 3, borderRadius: 12 }}>
            <Stage
              world={[W, H]}
              running={running}
              onPointer={onPointer}
              cursor="pointer"
              label={`Sudoku grid with ${filled} of 81 cells filled; status ${status}.`}
              onFrame={(ctx, f) => {
                const e = fx.current
                if (running && !search.current) search.current = sudokuSearch(givens.current)
                const srch = search.current
                if (running && srch && !srch.state.done) {
                  e.acc += f.dt * sps
                  let n = Math.min(20000, Math.floor(e.acc))
                  e.acc -= n
                  while (n-- > 0) {
                    const r = srch.gen.next()
                    if (r.done) break
                    handle(r.value)
                  }
                  if (srch.state.done) {
                    setRunning(false)
                    e.cur = -1
                  }
                  if (f.frame % 6 === 0) bump()
                }
                const fade = f.dt || 1 / 60
                for (let i = 0; i < 81; i++) e.flash[i] = Math.max(0, e.flash[i] - fade * 1.6)

                clear(ctx, W, H, theme.sunken)
                const g = srch?.state.grid ?? givens.current
                const giv = givens.current
                const cf = conflicts(g)
                const s = sel.current
                rrect(ctx, BX, BY, CS * 9, CS * 9, 6, theme.surface)
                for (let i = 0; i < 81; i++) {
                  const r = Math.floor(i / 9)
                  const c = i % 9
                  const x = BX + c * CS
                  const y = BY + r * CS
                  if (s !== null && i !== s && (Math.floor(s / 9) === r || s % 9 === c || (Math.floor(s / 27) === Math.floor(r / 3) && Math.floor((s % 9) / 3) === Math.floor(c / 3)))) {
                    ctx.fillStyle = alpha(theme.text, 0.05)
                    ctx.fillRect(x, y, CS, CS)
                  }
                  if (cf.has(i)) {
                    ctx.fillStyle = alpha(theme.danger, 0.28)
                    ctx.fillRect(x, y, CS, CS)
                  }
                  if (e.flash[i] > 0) {
                    ctx.fillStyle = alpha(theme.danger, 0.55 * e.flash[i])
                    ctx.fillRect(x, y, CS, CS)
                  }
                  if (i === e.cur && srch && !srch.state.done) {
                    ctx.fillStyle = alpha(theme.accent, 0.22)
                    ctx.fillRect(x, y, CS, CS)
                  }
                  if (i === s) rrect(ctx, x + 2, y + 2, CS - 4, CS - 4, 4, alpha(theme.accent, 0.12), theme.accent, 2.5)
                  const d = g[i]
                  if (d) text(ctx, String(d), x + CS / 2, y + CS / 2 - 1, { color: giv[i] ? theme.text : theme.accent, size: 26, align: 'center', baseline: 'middle', weight: giv[i] ? 700 : 500, mono: false })
                  else if (pencil)
                    for (const m of maskDigits(candidateMask(g, i))) text(ctx, String(m), x + 9 + ((m - 1) % 3) * 17, y + 12 + Math.floor((m - 1) / 3) * 15, { color: theme.muted, size: 12, align: 'center', baseline: 'middle' })
                  const tried = maskDigits(e.tried[i])
                  if (tried.length && !giv[i]) {
                    const label = tried.slice(0, 6).join('')
                    text(ctx, label, x + CS - 3, y + CS - 3, { color: theme.danger, size: 12, align: 'right', weight: 700 })
                    const tw = label.length * 7.3
                    line(ctx, x + CS - 3 - tw, y + CS - 7, x + CS - 3, y + CS - 7, alpha(theme.danger, 0.8), 1)
                  }
                }
                for (let k = 0; k <= 9; k++) {
                  const thick = k % 3 === 0
                  const col = thick ? theme.text : alpha(theme.text, 0.2)
                  line(ctx, BX + k * CS, BY, BX + k * CS, BY + 9 * CS, col, thick ? 2.5 : 1)
                  line(ctx, BX, BY + k * CS, BX + 9 * CS, BY + k * CS, col, thick ? 2.5 : 1)
                }

                // Digit pad for mouse and touch.
                text(ctx, s === null ? 'Pick a cell, then a digit' : `Cell r${Math.floor(s / 9) + 1} c${(s % 9) + 1}`, PX, 20, { color: theme.muted, size: 13 })
                for (let d = 1; d <= 9; d++) {
                  const x = PX + ((d - 1) % 3) * (PW + GAP)
                  const y = 30 + Math.floor((d - 1) / 3) * (PH + GAP)
                  const left = 9 - g.filter((v) => v === d).length
                  rrect(ctx, x, y, PW, PH, 8, theme.surface, theme.border)
                  text(ctx, String(d), x + PW / 2, y + 25, { color: left > 0 ? theme.text : theme.muted, size: 24, align: 'center', baseline: 'middle', weight: 700, mono: false })
                  text(ctx, left > 0 ? `${left} left` : 'done', x + PW / 2, y + PH - 8, { color: theme.muted, size: 12, align: 'center' })
                }
                const ey = 30 + 3 * (PH + GAP)
                rrect(ctx, PX, ey, 3 * PW + 2 * GAP, 46, 8, theme.surface, theme.border)
                text(ctx, 'Erase', PX + (3 * PW + 2 * GAP) / 2, ey + 24, { color: theme.text, size: 16, align: 'center', baseline: 'middle', weight: 600, mono: false })

                // Legend.
                const items: [string, string, boolean][] = [
                  [theme.text, 'Given digit', false],
                  [theme.accent, 'Placed by the solver', false],
                  [alpha(theme.accent, 0.35), 'Cell being tried', true],
                  [alpha(theme.danger, 0.6), 'Backtracked (digits tried)', true],
                  [alpha(theme.danger, 0.28), 'Clash in row, column or box', true],
                ]
                items.forEach(([c, name, box], k) => {
                  const y = ey + 80 + k * 26
                  if (box) rrect(ctx, PX, y - 12, 16, 16, 3, c)
                  else text(ctx, '5', PX + 8, y + 1, { color: c, size: 18, align: 'center', baseline: 'middle', weight: 700, mono: false })
                  text(ctx, name, PX + 26, y + 1, { color: theme.text, size: 13, baseline: 'middle', mono: false })
                })
              }}
            />
          </div>
          <Readout
            items={[
              ['Guesses', fmt(st?.guesses ?? 0)],
              ['Backtracks', fmt(st?.backtracks ?? 0)],
              ['Filled cells', `${filled} / 81`],
              ['Status', status],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={play} onStep={step} onReset={reset} resetLabel="Back to puzzle" />
      <Select label="Puzzle" value={preset} options={PRESET_OPTIONS} onChange={load} />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={instant}>Instant solve</button>
        <button type="button" className="btn" onClick={() => load('blank')}>Clear grid</button>
      </div>
      <Slider label="Speed" value={speedV} min={0} max={100} format={(v) => fmt(speedOf(v), 0)} unit=" steps/s" onChange={setSpeedV} />
      <Toggle label="Pencil marks (candidates)" checked={pencil} onChange={setPencil} />
      <Hint>Click a cell and type a digit (arrow keys move, Backspace erases). The solver always fills the cell with the fewest candidates first; when it hits a cell with none left it backtracks, and the red digits show what it already ruled out there.</Hint>
    </SimLayout>
  )
}
