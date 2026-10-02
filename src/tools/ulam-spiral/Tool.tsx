import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, rrect, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { factorize, isEuler, sacksCoord, sieve, spiralCoord, spiralIndex } from './ulam'

const W = 800
const H = 560
const MAXN = 40000
const RES = 2
const PRIME = sieve(MAXN + 100)
const PRIME_C = '#ffe8a3'
const TWIN_C = '#4dd4ff'
const EULER_C = '#ff922b'
const DIM_C = 'rgba(255,255,255,0.28)'
const COMP_C = 'rgba(255,255,255,0.06)'

type Mode = 'ulam' | 'sacks'
type Mark = 'primes' | 'twins' | 'euler'

const isTwin = (n: number) => PRIME[n] === 1 && (PRIME[n + 2] === 1 || (n > 2 && PRIME[n - 2] === 1))

export default function UlamSpiral() {
  const [running, setRunning] = useRunning()
  const [mode, setMode] = useState<Mode>('ulam')
  const [mark, setMark] = useState<Mark>('primes')
  const [count, setCount] = useState(MAXN)
  const [cell, setCell] = useState(2.6)
  const [rate, setRate] = useState(3.4)
  const [start41, setStart41] = useState(false)
  const [composites, setComposites] = useState(true)
  const [info, setInfo] = useState({ placed: 0, primes: 0 })
  const [hover, setHover] = useState<{ n: number; x: number; y: number } | null>(null)
  const sim = useRef({ placed: 0, primes: 0, drawn: 0, key: '', acc: 0 })
  const buf = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null>(null)
  const pan = useRef({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null)

  const first = start41 ? 41 : 1
  const numberAt = (k: number) => first + k - 1
  /** Screen position of the k-th cell. */
  const pos = (k: number): [number, number] => {
    const [x, y] = mode === 'ulam' ? spiralCoord(k) : sacksCoord(numberAt(k))
    return [W / 2 + pan.current.x + x * cell, H / 2 + pan.current.y - y * cell]
  }
  const colorOf = (n: number): string | null => {
    const prime = PRIME[n] === 1
    if (mark === 'euler' && isEuler(n)) return prime ? EULER_C : 'rgba(255,146,43,0.45)'
    if (mark === 'twins' && prime) return isTwin(n) ? TWIN_C : DIM_C
    if (mark === 'euler' && prime) return DIM_C
    if (prime) return PRIME_C
    return composites ? COMP_C : null
  }

  function reset() {
    Object.assign(sim.current, { placed: 0, primes: 0, drawn: 0, acc: 0 })
    setInfo({ placed: 0, primes: 0 })
  }

  function pickMode(m: Mode) {
    setMode(m)
    setCell(m === 'ulam' ? 2.6 : 1.35)
    pan.current = { x: 0, y: 0 }
  }

  function findAt(x: number, y: number): number | null {
    const s = sim.current
    const gx = (x - W / 2 - pan.current.x) / cell
    const gy = -(y - H / 2 - pan.current.y) / cell
    if (mode === 'ulam') {
      const k = spiralIndex(Math.round(gx), Math.round(gy))
      return k <= s.placed ? numberAt(k) : null
    }
    const r = Math.hypot(gx, gy)
    let best: number | null = null
    let bd = Math.max(0.7, 3 / cell)
    for (let n = Math.max(first, Math.floor((r - 0.8) ** 2)); n <= Math.min(numberAt(s.placed), Math.ceil((r + 0.8) ** 2)); n++) {
      const [px, py] = sacksCoord(n)
      const d = Math.hypot(px - gx, py - gy)
      if (d < bd) {
        bd = d
        best = n
      }
    }
    return best
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') drag.current = { x: p.x, y: p.y, px: pan.current.x, py: pan.current.y, moved: false }
    const d = drag.current
    if (d && p.down) {
      if (Math.hypot(p.x - d.x, p.y - d.y) > 4) d.moved = true
      if (d.moved) pan.current = { x: d.px + p.x - d.x, y: d.py + p.y - d.y }
    }
    if (p.type === 'up') drag.current = null
    const n = findAt(p.x, p.y)
    setHover(n === null ? null : { n, x: p.x, y: p.y })
  }

  const N = numberAt(Math.max(1, info.placed))
  const factors = hover ? factorize(hover.n) : []

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            onPointer={onPointer}
            cursor="move"
            label={`${mode === 'ulam' ? 'Ulam' : 'Sacks'} spiral of the first ${info.placed} integers with primes highlighted.`}
            onFrame={(ctx, f) => {
              const s = sim.current
              if (!buf.current) {
                const canvas = document.createElement('canvas')
                canvas.width = W * RES
                canvas.height = H * RES
                buf.current = { canvas, ctx: canvas.getContext('2d')! }
              }
              const b = buf.current
              if (f.dt > 0 && s.placed < count) {
                s.acc += f.dt * 10 ** rate
                const k = Math.floor(s.acc)
                s.acc -= k
                s.placed = Math.min(count, s.placed + k)
              }
              if (s.placed > count) s.placed = count
              const key = [mode, mark, cell, start41, composites, pan.current.x, pan.current.y, count].join()
              if (key !== s.key || s.drawn > s.placed) {
                s.key = key
                s.drawn = 0
                s.primes = 0
                b.ctx.setTransform(1, 0, 0, 1, 0, 0)
                b.ctx.clearRect(0, 0, W * RES, H * RES)
              }
              // Paint only the newly placed numbers into the offscreen layer.
              b.ctx.setTransform(RES, 0, 0, RES, 0, 0)
              const size = mode === 'ulam' ? Math.max(1, cell - (cell >= 5 ? 1 : 0)) : Math.max(1.2, cell * 0.7)
              for (let k = s.drawn + 1; k <= s.placed; k++) {
                const n = numberAt(k)
                if (PRIME[n]) s.primes++
                const c = colorOf(n)
                if (!c) continue
                const [x, y] = pos(k)
                if (x < -size || y < -size || x > W + size || y > H + size) continue
                b.ctx.fillStyle = c
                if (mode === 'ulam') b.ctx.fillRect(x - size / 2, y - size / 2, size, size)
                else {
                  b.ctx.beginPath()
                  b.ctx.arc(x, y, size / 2 + (PRIME[n] ? 0.3 : 0), 0, Math.PI * 2)
                  b.ctx.fill()
                }
              }
              s.drawn = s.placed

              clear(ctx, W, H, '#0d0c0b')
              ctx.imageSmoothingEnabled = true
              ctx.drawImage(b.canvas, 0, 0, W, H)
              // Numbers written in the cells once they are big enough to read.
              if (mode === 'ulam' && cell >= 22) {
                const R = Math.ceil(Math.max(W, H) / cell / 2) + 2
                const cx = Math.round(-pan.current.x / cell)
                const cy = Math.round(pan.current.y / cell)
                for (let gx = cx - R; gx <= cx + R; gx++)
                  for (let gy = cy - R; gy <= cy + R; gy++) {
                    const k = spiralIndex(gx, gy)
                    if (k > s.placed) continue
                    const n = numberAt(k)
                    const [x, y] = pos(k)
                    if (x < -cell || x > W + cell || y < -cell || y > H + cell) continue
                    const c = colorOf(n)
                    const bright = c === PRIME_C || c === TWIN_C || c === EULER_C
                    text(ctx, String(n), x, y + 1, { color: bright ? '#1b1a17' : 'rgba(255,255,255,0.6)', size: Math.min(15, Math.max(12, cell * 0.36)), align: 'center', baseline: 'middle', weight: bright ? 700 : 500 })
                  }
              }
              // The newest number glows.
              if (s.placed > 0 && s.placed < count) {
                const [x, y] = pos(s.placed)
                circle(ctx, x, y, Math.max(5, cell * 0.8), undefined, '#fff', 2)
              }
              if (hover) {
                const k = hover.n - first + 1
                const [x, y] = pos(k)
                circle(ctx, x, y, Math.max(6, cell * 0.8), undefined, EULER_C, 2)
                const fs = factorize(hover.n)
                const label = `${hover.n} ${PRIME[hover.n] ? 'is prime' : hover.n < 2 ? '' : '= ' + fs.join(' × ')}`
                const bw = Math.max(90, label.length * 7.6 + 16)
                const bx = Math.min(W - bw - 8, hover.x + 14)
                const by = Math.max(8, hover.y - 38)
                rrect(ctx, bx, by, bw, 26, 6, 'rgba(0,0,0,0.8)', 'rgba(255,255,255,0.3)')
                text(ctx, label, bx + 8, by + 17, { color: '#fff', size: 12 })
              }
              if (f.frame % 8 === 0 && (s.placed !== info.placed || s.primes !== info.primes)) setInfo({ placed: s.placed, primes: s.primes })
            }}
          />
          <Legend items={mark === 'primes' ? [[PRIME_C, 'prime'], ['#555', 'composite']] : mark === 'twins' ? [[TWIN_C, 'twin prime (p ± 2 also prime)'], ['#999', 'other prime']] : [[EULER_C, 'n² + n + 41 (prime)'], ['#a86a3a', 'n² + n + 41 (composite)'], ['#999', 'other prime']]} />
          <Readout
            items={[
              ['Numbers placed', fmt(info.placed, 0)],
              ['Primes found', fmt(info.primes, 0)],
              ['Prime density', info.placed ? `${fmt((100 * info.primes) / info.placed, 2)}%` : '—'],
              ['1 / ln N', N > 1 ? `${fmt(100 / Math.log(N), 2)}%` : '—'],
              ['Hovered', hover ? (PRIME[hover.n] ? `${hover.n} prime` : hover.n < 2 ? String(hover.n) : factors.join('·')) : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset} />
      <Choice label="Spiral" value={mode} options={[['ulam', 'Ulam (square)'], ['sacks', 'Sacks (polar)']]} onChange={pickMode} />
      <Choice label="Highlight" value={mark} options={[['primes', 'Primes'], ['twins', 'Twins'], ['euler', 'n²+n+41']]} onChange={setMark} />
      <Slider label="Numbers" value={count} min={100} max={MAXN} step={100} onChange={setCount} />
      <Slider label="Cell size (zoom)" value={cell} min={1} max={40} step={0.1} unit=" px" onChange={setCell} />
      <Slider label="Placing speed" value={rate} min={0} max={4.3} step={0.1} format={(v) => `${fmt(10 ** v, 0)}/s`} onChange={setRate} />
      <Toggle label="Start the spiral at 41" checked={start41} onChange={(v) => { setStart41(v); reset() }} />
      <Toggle label="Show composites faintly" checked={composites} onChange={setComposites} />
      <Hint>Primes are irregular, yet on the spiral they crowd onto diagonal lines. Hover a cell to see its factors, drag to pan, and zoom in to read the numbers. Start at 41 and highlight n² + n + 41 to see Euler's famous prime-rich diagonal.</Hint>
    </SimLayout>
  )
}
