import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { clear, line, rrect, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { KNOWN_SOLUTIONS, attackers, attacks, queensSearch, type QueenEvent } from './queens'

const W = 800
const H = 520
const BX = 20
const BY = 20
const B = 480
const GX = 528

type Mode = 'solve' | 'manual'

const speedOf = (v: number) => 2 * 25000 ** (v / 100)

function crown(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, fill: string, stroke: string) {
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.34, cy + s * 0.22)
  ctx.lineTo(cx - s * 0.42, cy - s * 0.2)
  ctx.lineTo(cx - s * 0.17, cy + s * 0.02)
  ctx.lineTo(cx, cy - s * 0.32)
  ctx.lineTo(cx + s * 0.17, cy + s * 0.02)
  ctx.lineTo(cx + s * 0.42, cy - s * 0.2)
  ctx.lineTo(cx + s * 0.34, cy + s * 0.22)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = Math.max(1, s * 0.05)
  ctx.lineJoin = 'round'
  ctx.stroke()
  ctx.fillRect(cx - s * 0.34, cy + s * 0.26, s * 0.68, s * 0.09)
  for (const dx of [-0.42, 0, 0.42]) {
    ctx.beginPath()
    ctx.arc(cx + dx * s, cy + (dx ? -0.2 : -0.32) * s, s * 0.06, 0, Math.PI * 2)
    ctx.fill()
  }
}

export default function NQueens() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [n, setN] = useState(8)
  const [findAll, setFindAll] = useState(false)
  const [speedV, setSpeedV] = useState(28)
  const [mode, setMode] = useState<Mode>('solve')
  const [, setTick] = useState(0)
  const search = useRef(queensSearch(8))
  const fx = useRef({ ev: null as QueenEvent | null, flash: 0, back: null as { row: number; col: number } | null, backT: 0, sol: 0, hold: 0, acc: 0 })
  const manual = useRef<[number, number][]>([])
  const hover = useRef<[number, number] | null>(null)
  const sps = speedOf(speedV)
  const cs = B / n

  function reset(size = n) {
    search.current = queensSearch(size)
    fx.current = { ev: null, flash: 0, back: null, backT: 0, sol: 0, hold: 0, acc: 0 }
    manual.current = []
    setTick((t) => t + 1)
  }

  /** Runs one search event; returns true when it should stop (a solution to pause on, or the end). */
  function advance(): boolean {
    const r = search.current.gen.next()
    const e = fx.current
    if (r.done) return true
    const ev = r.value
    e.ev = ev
    if (ev.kind === 'try') e.flash = 1
    if (ev.kind === 'backtrack') {
      e.back = { row: ev.row, col: ev.col }
      e.backT = 1
    }
    if (ev.kind === 'solution') {
      e.sol = 1
      return true
    }
    return false
  }

  function step() {
    if (mode !== 'solve') setMode('solve')
    if (search.current.state.done) reset()
    advance()
    setTick((t) => t + 1)
  }

  function play(v: boolean) {
    if (v) {
      if (mode !== 'solve') setMode('solve')
      if (search.current.state.done) reset()
    }
    setRunning(v)
  }

  function cellAt(p: SimPointer): [number, number] | null {
    const c = Math.floor((p.x - BX) / cs)
    const r = Math.floor((p.y - BY) / cs)
    return r >= 0 && r < n && c >= 0 && c < n ? [r, c] : null
  }

  function onPointer(p: SimPointer) {
    const cell = cellAt(p)
    hover.current = cell
    if (p.type !== 'down' || !cell) return
    if (mode === 'solve') {
      setRunning(false)
      setMode('manual')
      manual.current = search.current.state.cols.map((c, r) => [r, c])
    }
    const [r, c] = cell
    const i = manual.current.findIndex(([qr, qc]) => qr === r && qc === c)
    if (i >= 0) manual.current.splice(i, 1)
    else manual.current.push([r, c])
    setTick((t) => t + 1)
  }

  const st = search.current.state
  const known = KNOWN_SOLUTIONS[n]
  const mq = manual.current
  const threatened = mq.filter(([r, c]) => mq.some(([r2, c2]) => attacks(r, c, r2, c2))).length

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="pointer"
            label={`${n} by ${n} chessboard. Backtracking has found ${st.found} of ${known} solutions.`}
            onFrame={(ctx, f) => {
              const e = fx.current
              const s = search.current.state
              if (mode === 'solve' && running && !s.done) {
                if (e.hold > 0) e.hold -= f.dt
                else {
                  e.acc += f.dt * sps
                  let steps = Math.min(40000, Math.floor(e.acc))
                  e.acc -= steps
                  while (steps-- > 0) {
                    if (advance()) {
                      if (s.done) setRunning(false)
                      else if (!findAll) {
                        setRunning(false)
                        e.acc = 0
                      } else if (sps < 80) e.hold = 0.7
                      break
                    }
                  }
                }
              }
              const fade = f.dt || 1 / 60
              e.flash = Math.max(0, e.flash - fade * 2.5)
              e.backT = Math.max(0, e.backT - fade * 2)
              e.sol = Math.max(0, e.sol - fade * 0.8)

              clear(ctx, W, H, theme.sunken)
              const queens: [number, number][] = mode === 'solve' ? s.cols.map((c, r) => [r, c]) : manual.current
              // Board with attacked squares shaded.
              for (let r = 0; r < n; r++)
                for (let c = 0; c < n; c++) {
                  const x = BX + c * cs
                  const y = BY + r * cs
                  ctx.fillStyle = (r + c) % 2 ? alpha(theme.text, 0.16) : theme.surface
                  ctx.fillRect(x, y, cs, cs)
                  const hit = mode === 'solve' ? r >= s.cols.length && attackers(s.cols, r, c).length > 0 : queens.some(([qr, qc]) => attacks(qr, qc, r, c)) && !queens.some(([qr, qc]) => qr === r && qc === c)
                  if (hit) {
                    ctx.fillStyle = alpha(theme.danger, 0.2)
                    ctx.fillRect(x, y, cs, cs)
                  }
                }
              ctx.strokeStyle = e.sol > 0 ? theme.ok : theme.border
              ctx.lineWidth = e.sol > 0 ? 3 + e.sol * 4 : 2
              ctx.strokeRect(BX, BY, B, B)

              // The square being tried, and who attacks it.
              const ev = e.ev
              if (mode === 'solve' && ev?.kind === 'try') {
                const x = BX + ev.col * cs
                const y = BY + ev.row * cs
                if (ev.ok) rrect(ctx, x + 2, y + 2, cs - 4, cs - 4, 4, undefined, theme.ok, 3)
                else {
                  ctx.fillStyle = alpha(theme.danger, 0.25 + 0.45 * e.flash)
                  ctx.fillRect(x, y, cs, cs)
                  for (const r of ev.attackers) line(ctx, BX + (s.cols[r] + 0.5) * cs, BY + (r + 0.5) * cs, x + cs / 2, y + cs / 2, alpha(theme.danger, 0.8), 2.5)
                }
              }
              if (mode === 'solve' && e.back && e.backT > 0) {
                ctx.globalAlpha = e.backT
                crown(ctx, BX + (e.back.col + 0.5) * cs, BY + (e.back.row + 0.52) * cs, cs * 0.8, alpha(theme.danger, 0.8), theme.danger)
                ctx.globalAlpha = 1
              }
              // Hover preview when placing by hand.
              const hv = hover.current
              if (mode === 'manual' && hv && !queens.some(([r, c]) => r === hv[0] && c === hv[1])) {
                const bad = queens.filter(([r, c]) => attacks(r, c, hv[0], hv[1]))
                rrect(ctx, BX + hv[1] * cs + 2, BY + hv[0] * cs + 2, cs - 4, cs - 4, 4, undefined, bad.length ? theme.danger : theme.ok, 2.5)
                for (const [r, c] of bad) line(ctx, BX + (c + 0.5) * cs, BY + (r + 0.5) * cs, BX + (hv[1] + 0.5) * cs, BY + (hv[0] + 0.5) * cs, alpha(theme.danger, 0.7), 2, [5, 4])
              }
              for (const [r, c] of queens) {
                const hit = mode === 'manual' && queens.some(([r2, c2]) => attacks(r, c, r2, c2))
                const color = e.sol > 0 && mode === 'solve' ? theme.ok : hit ? theme.danger : theme.accent
                crown(ctx, BX + (c + 0.5) * cs, BY + (r + 0.52) * cs, cs * 0.8, color, alpha(theme.text, 0.6))
              }

              // Gallery of solutions found.
              text(ctx, 'SOLUTIONS FOUND', GX, 40, { color: theme.muted, size: 12, weight: 700 })
              text(ctx, `${fmt(s.found)} of ${fmt(known)}`, GX, 70, { color: theme.text, size: 22, weight: 700 })
              const mini = 56
              s.solutions
                .slice()
                .reverse()
                .forEach((sol, i) => {
                  const gx = GX + (i % 4) * (mini + 8)
                  const gy = 92 + Math.floor(i / 4) * (mini + 8)
                  if (gy + mini > H - 8) return
                  rrect(ctx, gx, gy, mini, mini, 4, theme.surface, i === 0 && e.sol > 0 ? theme.ok : theme.border, i === 0 && e.sol > 0 ? 2 : 1)
                  const m = mini / n
                  ctx.fillStyle = theme.accent
                  sol.forEach((c, r) => ctx.fillRect(gx + c * m + m * 0.15, gy + r * m + m * 0.15, m * 0.7, m * 0.7))
                })
              if (!s.found) text(ctx, mode === 'manual' ? 'Placing by hand' : s.tried ? 'None yet…' : 'Press Play to search', GX, 110, { color: theme.muted, size: 13 })
              if (mode === 'manual') {
                const solvedByHand = queens.length === n && !queens.some(([r, c]) => queens.some(([r2, c2]) => attacks(r, c, r2, c2)))
                if (solvedByHand) text(ctx, 'You solved it!', GX, H - 24, { color: theme.ok, size: 16, weight: 700 })
              }
              if (f.frame % 8 === 0 && (running || e.flash > 0)) setTick((t) => t + 1)
            }}
          />
          <Readout
            items={
              mode === 'solve'
                ? [
                    ['Placements tried', fmt(st.tried)],
                    ['Backtracks', fmt(st.backtracks)],
                    ['Solutions found', `${fmt(st.found)} / ${fmt(known)}`],
                    ['Queens on board', `${st.cols.length} / ${n}`],
                  ]
                : [
                    ['Queens placed', `${mq.length} / ${n}`],
                    ['Under attack', threatened],
                    ['Solutions exist', fmt(known)],
                  ]
            }
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={play} onStep={step} onReset={() => reset()} />
      <Choice label="Mode" value={mode} options={[['solve', 'Backtracking'], ['manual', 'Place by hand']]} onChange={(m) => { setMode(m); setRunning(false) }} />
      <Slider label="Board size N" value={n} min={4} max={14} onChange={(v) => { setN(v); reset(v) }} />
      <Slider label="Speed" value={speedV} min={0} max={100} format={(v) => fmt(speedOf(v), 0)} unit=" steps/s" onChange={setSpeedV} />
      <Toggle label="Find all (don't stop at each solution)" checked={findAll} onChange={setFindAll} />
      <Hint>Red squares are attacked by the queens already placed; when a row has no safe square left, the search backtracks and moves the queen above. Click the board to place queens yourself. For N = 8 there are 92 solutions.</Hint>
    </SimLayout>
  )
}
