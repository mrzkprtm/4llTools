import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt, lerp } from '../../sim/math'
import { alpha, hue, useTheme } from '../../sim/theme'
import { PEG_NAMES, applyMove, isLegal, movesNeeded, positions, solveFrom, startPegs, type HanoiMove } from './hanoi'

const W = 800
const H = 480
const PX = [340, 530, 720]
const BASE = 440
const PTOP = 180
const LIFT = 150
const PANEL = 232

interface Anim {
  disk: number
  t: number
  dur: number
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Held {
  disk: number
  from: number
  x: number
  y: number
  pressed: boolean
  dragged: boolean
  sx: number
  sy: number
}

const speedOf = (v: number) => 0.5 * 100 ** (v / 100)

/** A point along a lift → arc → drop path at eased progress t. */
function arcPoint(a: Anim, t: number): [number, number] {
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
  const l1 = Math.max(0, a.y0 - LIFT)
  const l2 = Math.abs(a.x1 - a.x0) * 1.2
  const l3 = Math.max(0, a.y1 - LIFT)
  const s = e * (l1 + l2 + l3)
  if (s < l1) return [a.x0, a.y0 - s]
  if (s < l1 + l2 || l3 === 0) {
    const u = l2 ? clamp((s - l1) / l2, 0, 1) : 1
    return [lerp(a.x0, a.x1, u), lerp(Math.min(a.y0, LIFT), LIFT, u) - Math.sin(Math.PI * u) * Math.min(50, l2 * 0.2)]
  }
  return [a.x1, LIFT + (s - l1 - l2)]
}

export default function TowerOfHanoi() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [n, setN] = useState(5)
  const [speedV, setSpeedV] = useState(35)
  const [, setTick] = useState(0)
  const pegs = useRef(startPegs(5))
  const gen = useRef<Generator<HanoiMove> | null>(null)
  const anim = useRef<Anim | null>(null)
  const held = useRef<Held | null>(null)
  const shake = useRef({ disk: -1, t: 0 })
  const note = useRef({ msg: '', color: '', t: 0 })
  const log = useRef<string[]>([])
  const frames = useRef<string[]>([])
  const clock = useRef({ start: 0, end: 0, acc: 0, moves: 0 })
  const speed = speedOf(speedV)

  const diskH = Math.min(24, 236 / n)
  const diskW = (d: number) => 36 + (d / Math.max(1, n - 1)) * 140
  const slotY = (i: number) => BASE - (i + 0.5) * diskH
  const solved = () => pegs.current[2].length === n

  function reset(count = n) {
    pegs.current = startPegs(count)
    gen.current = null
    anim.current = null
    held.current = null
    log.current = []
    frames.current = []
    clock.current = { start: 0, end: 0, acc: 0, moves: 0 }
    note.current.t = 0
    setRunning(false)
    setTick((t) => t + 1)
  }

  function record(disk: number, from: number, to: number) {
    const c = clock.current
    if (!c.start) c.start = performance.now()
    c.moves++
    log.current.push(`${c.moves}. disk ${disk + 1}  ${PEG_NAMES[from]} → ${PEG_NAMES[to]}`)
    if (solved() && !c.end) {
      c.end = performance.now()
      const min = 2 ** n - 1
      note.current = { msg: c.moves === min ? `Solved in the minimum ${min} moves!` : `Solved in ${c.moves} moves (minimum is ${min})`, color: theme.ok, t: 4 }
    }
  }

  /** One step of the recursive solver; returns false when there is nothing left to do. */
  function solverStep(animate: boolean): boolean {
    if (!gen.current) gen.current = solveFrom(positions(pegs.current))
    const r = gen.current.next()
    if (r.done) {
      gen.current = null
      return false
    }
    const m = r.value
    const y0 = slotY(pegs.current[m.from].length - 1)
    applyMove(pegs.current, m.from, m.to)
    frames.current = m.frames
    record(m.disk, m.from, m.to)
    if (animate) anim.current = { disk: m.disk, t: 0, dur: Math.min(0.9, 0.9 / speed), x0: PX[m.from], y0, x1: PX[m.to], y1: slotY(pegs.current[m.to].length - 1) }
    return true
  }

  function step() {
    if (held.current) return
    if (anim.current) anim.current = null
    if (solved()) reset()
    solverStep(true)
    setTick((t) => t + 1)
  }

  function play(v: boolean) {
    if (v && solved()) reset()
    setRunning(v)
  }

  const pegAt = (x: number) => (x < PANEL ? -1 : PX.reduce((b, px, i) => (Math.abs(px - x) < Math.abs(PX[b] - x) ? i : b), 0))

  function drop(peg: number) {
    const h = held.current!
    held.current = null
    const from = h.from
    const legal = peg >= 0 && isLegal(pegs.current, from, peg)
    if (legal) {
      applyMove(pegs.current, from, peg)
      frames.current = []
      record(h.disk, from, peg)
    } else if (peg >= 0 && peg !== from) {
      shake.current = { disk: h.disk, t: 0.5 }
      note.current = { msg: 'Not allowed: a bigger disk can never sit on a smaller one', color: theme.danger, t: 2.5 }
    }
    const to = legal ? peg : from
    anim.current = { disk: h.disk, t: 0, dur: 0.35, x0: h.x, y0: h.y, x1: PX[to], y1: slotY(pegs.current[to].length - 1) }
    setTick((t) => t + 1)
  }

  function onPointer(p: SimPointer) {
    const h = held.current
    if (p.type === 'down') {
      const peg = pegAt(p.x)
      if (h && !h.pressed) return drop(peg)
      if (peg < 0 || !pegs.current[peg].length) return
      setRunning(false)
      gen.current = null
      anim.current = null
      const src = pegs.current[peg]
      held.current = { disk: src[src.length - 1], from: peg, x: PX[peg], y: LIFT, pressed: true, dragged: false, sx: p.x, sy: p.y }
    } else if (h?.pressed && p.type === 'move') {
      if (Math.hypot(p.x - h.sx, p.y - h.sy) > 6) h.dragged = true
      if (h.dragged) {
        h.x = clamp(p.x, PANEL + 20, W - 20)
        h.y = clamp(p.y, 30, BASE - diskH / 2)
      }
    } else if (h?.pressed && p.type === 'up') {
      h.pressed = false
      if (h.dragged) drop(pegAt(Math.max(PANEL, p.x)))
    }
  }

  const c = clock.current
  const pos = positions(pegs.current)
  const elapsed = c.start ? ((c.end || performance.now()) - c.start) / 1000 : 0

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="grab"
            label={`Tower of Hanoi with ${n} disks; ${c.moves} moves made so far.`}
            onFrame={(ctx, f) => {
              const realDt = f.dt || 1 / 60
              // Advance the solver.
              if (running && !held.current) {
                if (speed >= 25) {
                  anim.current = null
                  clock.current.acc += f.dt * speed
                  while (clock.current.acc >= 1) {
                    clock.current.acc -= 1
                    if (!solverStep(false)) {
                      setRunning(false)
                      break
                    }
                  }
                } else if (!anim.current && !solverStep(true)) setRunning(false)
              }
              if (anim.current) {
                anim.current.t += realDt / anim.current.dur
                if (anim.current.t >= 1) anim.current = null
              }
              shake.current.t = Math.max(0, shake.current.t - realDt)

              clear(ctx, W, H, theme.sunken)
              // Side panel: call stack and move list.
              rrect(ctx, 14, 14, PANEL - 22, H - 28, 10, theme.surface, theme.border)
              text(ctx, 'CALL STACK', 28, 40, { color: theme.muted, size: 12, weight: 700 })
              const fr = frames.current
              if (!fr.length) text(ctx, gen.current ? '…' : c.moves ? '(your own moves)' : '(press Play or Step)', 28, 62, { color: theme.muted, size: 12 })
              fr.forEach((s, i) => {
                const y = 62 + i * 16
                if (i === fr.length - 1) rrect(ctx, 22 + i * 5, y - 12, PANEL - 44 - i * 5, 16, 4, alpha(theme.accent, 0.15))
                text(ctx, s, 28 + i * 5, y, { color: i === fr.length - 1 ? theme.accent : theme.text, size: 12 })
              })
              text(ctx, 'MOVES', 28, 250, { color: theme.muted, size: 12, weight: 700 })
              const shown = log.current.slice(-12)
              shown.forEach((s, i) => {
                const last = i === shown.length - 1
                text(ctx, s, 28, 272 + i * 15, { color: last ? theme.text : theme.muted, size: 12, weight: last ? 700 : 500 })
              })

              // Pegs and base.
              rrect(ctx, PANEL + 14, BASE, W - PANEL - 28, 14, 5, alpha(theme.text, 0.75))
              PX.forEach((x, i) => {
                rrect(ctx, x - 5, PTOP, 10, BASE - PTOP, 4, alpha(theme.text, 0.55))
                text(ctx, PEG_NAMES[i] + (i === 2 ? ' (target)' : ''), x, BASE + 34, { color: theme.muted, size: 13, align: 'center', weight: 700 })
              })

              const drawDisk = (d: number, x: number, y: number) => {
                const w = diskW(d)
                const sx = shake.current.disk === d ? Math.sin(shake.current.t * 60) * 10 * shake.current.t * 2 : 0
                rrect(ctx, x - w / 2 + sx, y - diskH / 2 + 1, w, diskH - 2, Math.min(8, diskH / 2), hue(d, n + 1, 55, 65), alpha(theme.text, 0.35))
                if (diskH >= 16) text(ctx, String(d + 1), x + sx, y + 1, { color: '#fff', size: 12, align: 'center', baseline: 'middle', weight: 700 })
              }
              const a = anim.current
              const hd = held.current
              pegs.current.forEach((stack, p) =>
                stack.forEach((d, i) => {
                  if ((a && a.disk === d) || (hd && hd.disk === d)) return
                  drawDisk(d, PX[p], slotY(i))
                }),
              )
              if (a) {
                const [x, y] = arcPoint(a, Math.min(1, a.t))
                drawDisk(a.disk, x, y)
              }
              if (hd) {
                const target = pegAt(hd.x)
                if (hd.dragged && target >= 0) line(ctx, PX[target], PTOP - 20, PX[target], BASE, alpha(isLegal(pegs.current, hd.from, target) || target === hd.from ? theme.ok : theme.danger, 0.5), 3, [6, 6])
                drawDisk(hd.disk, hd.x, hd.y)
              }

              const nt = note.current
              if (nt.t > 0) {
                nt.t -= realDt
                ctx.globalAlpha = clamp(nt.t, 0, 1)
                text(ctx, nt.msg, (PANEL + W) / 2, 60, { color: nt.color, size: 15, align: 'center', weight: 700 })
                ctx.globalAlpha = 1
              } else if (!c.moves && !running) text(ctx, 'Drag the top disk to another peg, or click one peg then another', (PANEL + W) / 2, 60, { color: theme.muted, size: 13, align: 'center' })
              if (f.frame % 6 === 0 && (running || (clock.current.start && !clock.current.end))) setTick((t) => t + 1)
            }}
          />
          <Readout
            items={[
              ['Moves made', c.moves],
              ['Minimum 2ⁿ−1', fmt(2 ** n - 1)],
              ['Optimal from here', fmt(movesNeeded(pos))],
              ['Time', `${fmt(elapsed, 1)} s`],
              ['Recursion depth', frames.current.length || '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={play} onStep={step} onReset={() => reset()} />
      <Slider label="Disks" value={n} min={3} max={10} onChange={(v) => { setN(v); reset(v) }} />
      <Slider label="Solver speed" value={speedV} min={0} max={100} format={(v) => fmt(speedOf(v), 1)} unit=" moves/s" onChange={setSpeedV} />
      <Hint>Play moves one disk at a time and never puts a bigger disk on a smaller one. Press Play to watch the recursive solution from wherever you are: to move n disks, move n − 1 out of the way, move the biggest, then move the n − 1 back on top.</Hint>
    </SimLayout>
  )
}
