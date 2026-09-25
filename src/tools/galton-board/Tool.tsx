import { useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { fmt, lerp } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { binStats, binomialPmf, normalPdf, theory } from './galton'

const W = 800
const H = 600
const CX = W / 2
const TOP = 60
const HOP = 0.11
const FALL = 0.32
const BALL = PALETTE[4]
const CURVE = PALETTE[1]

interface Ball {
  r: number
  j: number
  u: number
  fall: boolean
  fx: number
  fy: number
  tx: number
  ty: number
}

function layout(n: number) {
  const sp = Math.min(46, 560 / (n + 1))
  const rs = Math.min(sp * 0.9, 300 / Math.max(1, n - 1))
  const pr = Math.max(2.5, sp * 0.1)
  const br = Math.min(sp * 0.22, 7)
  const binTop = TOP + (n - 1) * rs + 34
  const binBottom = H - 34
  return { sp, rs, pr, br, binTop, binBottom }
}

export default function GaltonBoard() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [rows, setRows] = useState(12)
  const [p, setP] = useState(0.5)
  const [rate, setRate] = useState(8)
  const [bins, setBins] = useState<number[]>(() => new Array(13).fill(0))
  const sim = useRef({ balls: [] as Ball[], counts: new Array<number>(13).fill(0), acc: 0, pending: 0, pendAcc: 0, flash: new Map<string, number>(), time: 0 })

  const L = layout(rows)
  const pegX = (r: number, j: number) => CX + (j - r / 2) * L.sp
  const pegY = (r: number) => TOP + r * L.rs
  const binX = (k: number) => CX + (k - rows / 2) * L.sp
  const contact = (r: number, j: number): [number, number] => [pegX(r, j), pegY(r) - L.pr - L.br]

  function reset(n = rows) {
    sim.current.balls = []
    sim.current.counts = new Array(n + 1).fill(0)
    sim.current.pending = 0
    setBins(sim.current.counts.slice())
  }

  function spawn() {
    const [tx, ty] = contact(0, 0)
    sim.current.balls.push({ r: 0, j: 0, u: 0, fall: false, fx: CX, fy: TOP - 50, tx, ty })
  }

  // Height of one ball in a bin: a full ball while the piles are short, squeezed once they would overflow.
  const unitFor = (counts: number[]) => {
    const total = counts.reduce((a, b) => a + b, 0)
    const maxC = Math.max(1, ...counts, ...counts.map((_, k) => total * binomialPmf(rows, k, p)))
    return Math.min(2 * L.br, (L.binBottom - L.binTop - 12) / maxC)
  }

  const th = theory(rows, p)
  const st = binStats(bins)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            cursor="pointer"
            onPointer={(e) => e.type === 'down' && spawn()}
            label={`Galton board with ${rows} rows and bounce probability ${p}; ${st.total} balls collected.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              s.time += f.dt
              const counts = s.counts
              const unit = unitFor(counts)
              if (f.dt > 0) {
                s.acc += f.dt * rate
                while (s.acc >= 1) {
                  s.acc -= 1
                  spawn()
                }
                if (s.pending > 0) {
                  s.pendAcc += f.dt * 45
                  while (s.pendAcc >= 1 && s.pending > 0) {
                    s.pendAcc -= 1
                    s.pending--
                    spawn()
                  }
                }
                // Move the balls peg to peg with little hops, then let them drop into a bin.
                const done: Ball[] = []
                for (const b of s.balls) {
                  b.u += f.dt / (b.fall ? FALL : HOP)
                  if (b.fall) b.ty = L.binBottom - counts[b.j] * unit - L.br
                  if (b.u < 1) continue
                  if (b.fall) {
                    counts[b.j]++
                    done.push(b)
                    continue
                  }
                  s.flash.set(`${b.r},${b.j}`, s.time)
                  const right = Math.random() < p
                  const nj = b.j + (right ? 1 : 0)
                  b.fx = b.tx
                  b.fy = b.ty
                  b.u = 0
                  if (b.r + 1 < rows) {
                    ;[b.tx, b.ty] = contact(b.r + 1, nj)
                    b.r++
                    b.j = nj
                  } else {
                    b.fall = true
                    b.j = nj
                    b.tx = binX(nj)
                    b.ty = L.binBottom - counts[nj] * unit - L.br
                  }
                }
                if (done.length) s.balls = s.balls.filter((b) => !done.includes(b))
              }

              clear(ctx, W, H, theme.sunken)
              // Funnel and pegs (pegs glow briefly when hit).
              line(ctx, CX - 34, TOP - 70, CX - 8, TOP - 34, alpha(theme.text, 0.5), 2)
              line(ctx, CX + 34, TOP - 70, CX + 8, TOP - 34, alpha(theme.text, 0.5), 2)
              for (let r = 0; r < rows; r++)
                for (let j = 0; j <= r; j++) {
                  const hit = s.flash.get(`${r},${j}`)
                  const glow = hit === undefined ? 0 : Math.max(0, 1 - (s.time - hit) / 0.25)
                  if (glow > 0) circle(ctx, pegX(r, j), pegY(r), L.pr + 5 * glow, alpha(BALL, 0.35 * glow))
                  circle(ctx, pegX(r, j), pegY(r), L.pr, glow > 0 ? BALL : alpha(theme.text, 0.65))
                }

              // Bins with stacked balls (or bars once they get tall), and the theory on top.
              const half = L.sp / 2
              for (let k = 0; k <= rows + 1; k++) line(ctx, binX(k) - half, L.binTop, binX(k) - half, L.binBottom, alpha(theme.text, 0.35), 1.5)
              line(ctx, binX(0) - half, L.binBottom, binX(rows) + half, L.binBottom, alpha(theme.text, 0.6), 2)
              const stacked = unit >= 2 * L.br - 1e-9
              counts.forEach((c, k) => {
                if (!c) return
                if (stacked) for (let i = 0; i < c; i++) circle(ctx, binX(k), L.binBottom - (i + 0.5) * unit, L.br * 0.92, BALL)
                else rrect(ctx, binX(k) - half + 3, L.binBottom - c * unit, L.sp - 6, c * unit, 3, alpha(BALL, 0.85))
              })
              const total = counts.reduce((a, b) => a + b, 0)
              if (total > 0) {
                ctx.beginPath()
                for (let x = -0.5; x <= rows + 0.5 + 1e-9; x += 0.05) {
                  const y = L.binBottom - total * normalPdf(x, th.mean, th.sd) * unit
                  if (x === -0.5) ctx.moveTo(binX(x), y)
                  else ctx.lineTo(binX(x), y)
                }
                ctx.strokeStyle = CURVE
                ctx.lineWidth = 2.5
                ctx.stroke()
                for (let k = 0; k <= rows; k++) {
                  const y = L.binBottom - total * binomialPmf(rows, k, p) * unit
                  line(ctx, binX(k) - half * 0.6, y, binX(k) + half * 0.6, y, theme.text, 2)
                }
              }
              if (L.sp >= 26 || rows <= 12)
                for (let k = 0; k <= rows; k++) text(ctx, String(k), binX(k), L.binBottom + 18, { color: theme.muted, size: 12, align: 'center' })

              // Balls in flight.
              for (const b of s.balls) {
                const u = Math.min(1, b.u)
                const x = lerp(b.fx, b.tx, u)
                const y = b.fall ? lerp(b.fy, b.ty, u * u) : lerp(b.fy, b.ty, u) - (b.fx !== b.tx ? L.rs * 0.45 * 4 * u * (1 - u) : 0)
                circle(ctx, x, y, L.br, BALL, alpha(theme.text, 0.5), 1)
              }
              text(ctx, 'Click the board to drop a ball', 16, 26, { color: theme.muted, size: 13 })
              if (f.frame % 10 === 0) setBins(counts.slice())
            }}
          />
          <Legend items={[[BALL, 'Balls'], [theme.text, 'Binomial expectation'], [CURVE, 'Normal approximation']]} />
          <Readout
            items={[
              ['Balls', st.total],
              ['Mean bin', st.total ? fmt(st.mean, 2) : '—'],
              ['Theory np', fmt(th.mean, 2)],
              ['Std deviation', st.total > 1 ? fmt(st.sd, 2) : '—'],
              ['Theory √(np(1−p))', fmt(th.sd, 2)],
              ['In flight', sim.current.balls.length + sim.current.pending],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} resetLabel="Empty bins">
        <button type="button" className="btn" onClick={() => (sim.current.pending += 100)}>
          Drop 100
        </button>
      </PlayBar>
      <Slider label="Rows of pegs" value={rows} min={4} max={16} onChange={(v) => { setRows(v); reset(v) }} />
      <Slider label="Chance of bouncing right p" value={p} min={0.05} max={0.95} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => { setP(v); reset() }} />
      <Slider label="Drop rate" value={rate} min={0} max={40} unit=" balls/s" onChange={setRate} />
      <Hint>Each peg sends a ball left or right at random, and its bin counts the right bounces. With many balls the pile follows the binomial distribution, and the bell curve with mean np and spread √(np(1−p)) fits it better and better.</Hint>
    </SimLayout>
  )
}
