import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { chart, circle, clear, line, text } from '../../sim/draw'
import { TAU, clamp, fmt, gaussian, pushCap } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { BRUTE_MAX, anneal, bruteForce, nearestNeighbour, tourLength, twoOpt, type City, type TspStep } from './tsp'

const W = 800
const AH = 480
const H = 560
type Method = 'nn' | 'twoopt' | 'anneal' | 'brute'
type Layout = 'random' | 'circle' | 'clusters'

const speedOf = (v: number) => 2 * 100000 ** (v / 100)
/** How many speed units one step of each method costs: building a tour city by city is shown slowly. */
const WEIGHT: Record<Method, number> = { nn: 25, twoopt: 1, anneal: 1, brute: 0.1 }

function makeCities(n: number, layout: Layout): City[] {
  if (layout === 'circle') {
    const c = Array.from({ length: n }, (_, i) => ({ x: W / 2 + Math.cos((i / n) * TAU) * 300, y: AH / 2 + Math.sin((i / n) * TAU) * 200 }))
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[c[i], c[j]] = [c[j], c[i]]
    }
    return c
  }
  if (layout === 'clusters') {
    const centres = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => ({ x: 120 + Math.random() * (W - 240), y: 90 + Math.random() * (AH - 180) }))
    return Array.from({ length: n }, (_, i) => {
      const k = centres[i % centres.length]
      return { x: clamp(k.x + gaussian() * 45, 15, W - 15), y: clamp(k.y + gaussian() * 35, 15, AH - 15) }
    })
  }
  return Array.from({ length: n }, () => ({ x: 25 + Math.random() * (W - 50), y: 25 + Math.random() * (AH - 50) }))
}

export default function TravelingSalesman() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [method, setMethod] = useState<Method>('nn')
  const [count, setCount] = useState(40)
  const [speedV, setSpeedV] = useState(45)
  const [T0, setT0] = useState(100)
  const [coolK, setCoolK] = useState(3.3)
  const [, setTick] = useState(0)
  const cities = useRef<City[]>(makeCities(40, 'random'))
  const tour = useRef<number[]>(cities.current.map((_, i) => i))
  const opts = useRef({ T0: 100, cooling: 1 - 10 ** -3.3 })
  const run = useRef({ gen: null as Generator<TspStep> | null, step: null as TspStep | null, acc: 0, hist: [] as number[], best: [] as number[], flash: null as [number, number, number, number] | null, flashT: 0 })
  const drag = useRef<number | null>(null)
  const sps = speedOf(speedV)
  const bump = () => setTick((t) => t + 1)
  opts.current.cooling = 1 - 10 ** -coolK

  function start(m = method) {
    const c = cities.current
    if (tour.current.length !== c.length) tour.current = c.map((_, i) => i)
    // Annealing keeps reading the options object, so the cooling slider works mid-run.
    const o = opts.current
    o.T0 = T0
    const gen = m === 'nn' ? nearestNeighbour(c) : m === 'twoopt' ? twoOpt(c, tour.current) : m === 'anneal' ? anneal(c, tour.current, o) : bruteForce(c)
    run.current = { ...run.current, gen, step: null, acc: 0, hist: [], best: [], flash: null, flashT: 0 }
  }

  function citiesChanged() {
    tour.current = cities.current.map((_, i) => i)
    start()
    bump()
  }

  function advance(): boolean {
    if (!run.current.gen) start()
    const r = run.current
    const res = r.gen!.next()
    if (res.done) return false
    const s = res.value
    r.step = s
    if (s.tour.length === cities.current.length) tour.current = [...s.tour]
    if (s.swap && s.accepted) {
      r.flash = s.swap
      r.flashT = 1
    }
    return !s.done
  }

  function newCities(n = count, layout: Layout = 'random') {
    cities.current = makeCities(n, layout)
    citiesChanged()
  }

  function onPointer(p: SimPointer) {
    const c = cities.current
    if (p.type === 'down') {
      if (p.y > AH) return
      const i = c.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 12)
      if (i >= 0 && (p.shift || p.button === 2)) {
        c.splice(i, 1)
        return citiesChanged()
      }
      if (i >= 0) drag.current = i
      else if (c.length < 250) {
        c.push({ x: p.x, y: p.y })
        citiesChanged()
      }
    } else if (drag.current !== null && p.down) {
      c[drag.current] = { x: clamp(p.x, 5, W - 5), y: clamp(p.y, 5, AH - 5) }
      run.current.step = null
    }
    if (p.type === 'up' && drag.current !== null) {
      drag.current = null
      start()
      bump()
    }
  }

  const st = run.current.step
  const n = cities.current.length
  const tooMany = method === 'brute' && n > BRUTE_MAX

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`${n} cities; ${method} tour length ${st ? fmt(st.len, 0) : 'not started'}.`}
            onFrame={(ctx, f) => {
              if (!run.current.gen) start()
              const r = run.current
              if (f.dt > 0 && drag.current === null && !r.step?.done && !tooMany) {
                r.acc += (f.dt * sps) / WEIGHT[method]
                let k = Math.min(100000, Math.floor(r.acc))
                r.acc -= k
                while (k-- > 0 && advance()) void 0
                if (run.current.step) {
                  pushCap(r.hist, run.current.step.len, 600)
                  if (Number.isFinite(run.current.step.bestLen)) pushCap(r.best, run.current.step.bestLen, 600)
                }
                if (run.current.step?.done) setRunning(false)
              }
              r.flashT = Math.max(0, r.flashT - (f.dt || 1 / 60) * 3)
              const s = run.current.step
              const c = cities.current

              clear(ctx, W, H, theme.sunken)
              const path = (t: readonly number[], closed: boolean, color: string, width: number, dash?: number[]) => {
                if (t.length < 2) return
                ctx.beginPath()
                t.forEach((i, k) => (k ? ctx.lineTo(c[i].x, c[i].y) : ctx.moveTo(c[i].x, c[i].y)))
                if (closed) ctx.closePath()
                ctx.strokeStyle = color
                ctx.lineWidth = width
                ctx.lineJoin = 'round'
                ctx.setLineDash(dash ?? [])
                ctx.stroke()
                ctx.setLineDash([])
              }
              if (!s || drag.current !== null) path(tour.current, true, alpha(theme.text, 0.25), 1.5, [5, 5])
              else if (method === 'nn') {
                path(s.tour, !!s.done, theme.accent, 2.5)
                if (!s.done && s.from !== undefined) {
                  const last = s.tour[s.tour.length - 1]
                  line(ctx, c[s.from].x, c[s.from].y, c[last].x, c[last].y, PALETTE[1], 3.5)
                  circle(ctx, c[last].x, c[last].y, 11, undefined, PALETTE[1], 2.5)
                }
              } else if (method === 'brute') {
                if (!s.done) path(s.tour, true, alpha(theme.text, 0.25), 1.5)
                path(s.best, true, theme.accent, 3)
              } else {
                if (method === 'anneal' && !s.done) path(s.best, true, alpha(theme.ok, 0.7), 5, [2, 7])
                path(s.tour, true, theme.accent, 2.5)
                const sw = s.swap
                if (sw && !s.done && !s.accepted && sps < 400) {
                  // The pair of edges being checked.
                  line(ctx, c[sw[0]].x, c[sw[0]].y, c[sw[1]].x, c[sw[1]].y, PALETTE[1], 4)
                  line(ctx, c[sw[2]].x, c[sw[2]].y, c[sw[3]].x, c[sw[3]].y, PALETTE[1], 4)
                  line(ctx, c[sw[0]].x, c[sw[0]].y, c[sw[2]].x, c[sw[2]].y, alpha(PALETTE[1], 0.5), 1.5, [4, 4])
                  line(ctx, c[sw[1]].x, c[sw[1]].y, c[sw[3]].x, c[sw[3]].y, alpha(PALETTE[1], 0.5), 1.5, [4, 4])
                }
                const fl = run.current.flash
                if (fl && run.current.flashT > 0) {
                  ctx.globalAlpha = run.current.flashT
                  line(ctx, c[fl[0]].x, c[fl[0]].y, c[fl[2]].x, c[fl[2]].y, theme.ok, 6)
                  line(ctx, c[fl[1]].x, c[fl[1]].y, c[fl[3]].x, c[fl[3]].y, theme.ok, 6)
                  ctx.globalAlpha = 1
                }
              }
              c.forEach((p, i) => circle(ctx, p.x, p.y, i === 0 ? 7 : 5, i === 0 ? theme.accent : theme.text, theme.surface, 2))
              if (tooMany) text(ctx, `Brute force would check ${fmt(factorialHalf(n))} tours. Use ${BRUTE_MAX} cities or fewer.`, W / 2, 30, { color: theme.danger, size: 14, align: 'center', weight: 700 })
              else if (s?.done) text(ctx, 'Done', 14, 28, { color: theme.ok, size: 14, weight: 700 })

              // Tour length over time.
              ctx.fillStyle = theme.surface
              ctx.fillRect(0, AH, W, H - AH)
              line(ctx, 0, AH, W, AH, theme.border)
              const hist = run.current.hist
              const best = run.current.best
              const all = [...hist, ...best]
              const lo = all.length ? Math.min(...all) : 0
              const hi = all.length ? Math.max(...all) : 1
              chart(ctx, 150, AH + 10, W - 170, H - AH - 20, [{ data: best, color: theme.ok, width: 2 }, { data: hist, color: theme.accent, width: 1.5 }], { min: lo * 0.98, max: hi * 1.02 + 1e-6, span: 600 })
              text(ctx, 'tour length', 14, AH + 28, { color: theme.muted, size: 12 })
              text(ctx, s ? fmt(s.len, 0) : fmt(tourLength(c, tour.current), 0), 14, AH + 50, { color: theme.text, size: 16, weight: 700 })
              if (f.frame % 8 === 0 && running) bump()
            }}
          />
          <Readout
            items={[
              ['Current length', st ? fmt(st.len, 0) : fmt(tourLength(cities.current, tour.current), 0)],
              ['Best length', st && Number.isFinite(st.bestLen) && st.bestLen > 0 ? fmt(st.bestLen, 0) : '—'],
              ['Iterations', fmt(st?.iter ?? 0)],
              method === 'anneal' ? ['Temperature', st?.T !== undefined ? fmt(st.T, 2) : fmt(T0)] : ['Cities', n],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={(v) => { if (v && run.current.step?.done) start(); setRunning(v) }} onStep={() => { if (run.current.step?.done) start(); advance(); bump() }} onReset={() => { tour.current = cities.current.map((_, i) => i); start(); bump() }} />
      <Choice label="Method" value={method} options={[['nn', 'Nearest'], ['twoopt', '2-opt'], ['anneal', 'Annealing'], ['brute', 'Brute force']]} onChange={(m) => { setMethod(m); start(m); bump() }} />
      <Slider label="Speed" value={speedV} min={0} max={100} format={(v) => fmt(speedOf(v), 0)} unit=" steps/s" onChange={setSpeedV} />
      <Slider label="Random cities" value={count} min={4} max={200} onChange={(v) => { setCount(v); newCities(v) }} />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={() => newCities()}>Random</button>
        <button type="button" className="btn" onClick={() => newCities(count, 'circle')}>Circle</button>
        <button type="button" className="btn" onClick={() => newCities(count, 'clusters')}>Clusters</button>
        <button type="button" className="btn" onClick={() => newCities(7)}>7 cities</button>
      </div>
      {method === 'anneal' && (
        <>
          <Slider label="Start temperature" value={T0} min={1} max={500} onChange={setT0} />
          <Slider label="Cooling rate" value={coolK} min={2} max={5} step={0.1} format={(k) => (1 - 10 ** -k).toFixed(k > 4 ? 5 : 4)} unit=" per step" onChange={setCoolK} />
        </>
      )}
      <Hint>Click to add cities, drag to move them, shift-click to remove. 2-opt and annealing start from the current tour, so try Nearest first, then 2-opt to untangle crossings. Annealing sometimes accepts a longer tour on purpose (dashed green is the best so far).</Hint>
    </SimLayout>
  )
}

function factorialHalf(n: number) {
  let f = 1
  for (let i = 2; i < n; i++) f *= i
  return f / 2
}
