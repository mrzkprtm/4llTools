import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { UnionFind, buildEdges, kruskal, prim, scatterPoints, sortedOrder, type MstStep, type Pt, type WEdge } from './mst'

const W = 800
const H = 500
const GW = 560
const ROW = 20
const FRONT = '#f59f00'
const ACCEPT = '#2f9e44'

type Algo = 'kruskal' | 'prim'

interface Run {
  gen: Generator<MstStep> | null
  state: Uint8Array
  flash: Float32Array
  current: number
  uf: UnionFind
  inTree: Uint8Array
  total: number
  accepted: number
  rejected: number
  considered: number
  done: boolean
}

function makeRun(algo: Algo, n: number, edges: WEdge[], start: number): Run {
  const r: Run = {
    gen: algo === 'kruskal' ? kruskal(n, edges) : prim(n, edges, start),
    state: new Uint8Array(edges.length),
    flash: new Float32Array(edges.length),
    current: -1,
    uf: new UnionFind(n),
    inTree: new Uint8Array(n),
    total: 0,
    accepted: 0,
    rejected: 0,
    considered: 0,
    done: false,
  }
  if (algo === 'prim' && n) r.inTree[start] = 1
  return r
}

function initialGraph() {
  const p = scatterPoints(16, GW, H, Math.random, 70, 34)
  const e = buildEdges(p, 3, (a, b) => Math.max(1, Math.round(Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y) / 10)))
  return { p, e }
}

export default function MinimumSpanningTree() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [algo, setAlgo] = useState<Algo>('kruskal')
  const [count, setCount] = useState(16)
  const [weights, setWeights] = useState<'distance' | 'random'>('distance')
  const [density, setDensity] = useState<'2' | '3' | '5'>('3')
  const [labels, setLabels] = useState(true)
  const [speed, setSpeed] = useState(4)
  const [start, setStart] = useState(0)
  const [stats, setStats] = useState({ total: 0, accepted: 0, rejected: 0, considered: 0, done: false })
  const [initial] = useState(initialGraph)
  const pts = useRef<Pt[]>(initial.p)
  const edges = useRef<WEdge[]>(initial.e)
  const cache = useRef(new Map<string, number>())
  const run = useRef<Run>(makeRun('kruskal', initial.p.length, initial.e, 0))
  const acc = useRef(0)

  function weightFn(mode = weights) {
    return (a: number, b: number) => {
      if (mode === 'distance') return Math.max(1, Math.round(Math.hypot(pts.current[a].x - pts.current[b].x, pts.current[a].y - pts.current[b].y) / 10))
      const k = `${a}-${b}`
      if (!cache.current.has(k)) cache.current.set(k, 1 + Math.floor(Math.random() * 20))
      return cache.current.get(k)!
    }
  }

  function newRun(a = algo, s = start) {
    const n = pts.current.length
    run.current = makeRun(a, n, edges.current, Math.min(s, Math.max(0, n - 1)))
    acc.current = 0
    publish()
  }

  function rebuild(opts: { n?: number; mode?: 'distance' | 'random'; k?: string; fresh?: boolean } = {}) {
    if (opts.fresh ?? true) {
      pts.current = scatterPoints(opts.n ?? count, GW, H, Math.random, 70, 34)
      cache.current.clear()
    }
    edges.current = buildEdges(pts.current, Number(opts.k ?? density), weightFn(opts.mode))
    newRun()
  }

  function publish() {
    const r = run.current
    setStats({ total: r.total, accepted: r.accepted, rejected: r.rejected, considered: r.considered, done: r.done })
  }

  function step(): boolean {
    const r = run.current
    if (!r.gen) return false
    const x = r.gen.next()
    if (x.done) {
      r.gen = null
      r.done = true
      r.current = -1
      publish()
      return false
    }
    const s = x.value
    const e = edges.current[s.e]
    if (s.kind === 'consider') {
      r.current = s.e
      r.considered++
    } else if (s.kind === 'accept') {
      r.state[s.e] = 1
      r.total += e.w
      r.accepted++
      r.uf.union(e.a, e.b)
      r.inTree[e.a] = 1
      r.inTree[e.b] = 1
    } else {
      r.state[s.e] = 2
      r.flash[s.e] = 1
      r.rejected++
    }
    publish()
    return true
  }

  function play(v: boolean) {
    if (v && run.current.done) newRun()
    setRunning(v)
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down' || p.x > GW) return
    const hit = pts.current.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < 16)
    if (hit >= 0) {
      setStart(hit)
      if (algo === 'prim') newRun('prim', hit)
      return
    }
    if (pts.current.length >= 50 || pts.current.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 28)) return
    pts.current.push({ x: p.x, y: p.y })
    setCount(pts.current.length)
    rebuild({ fresh: false })
  }

  const n = pts.current.length

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-flat"
            onPointer={onPointer}
            label={`${algo === 'kruskal' ? "Kruskal's" : "Prim's"} algorithm on ${n} points and ${edges.current.length} weighted edges. ${stats.accepted} edges accepted, total weight ${stats.total}.`}
            onFrame={(ctx, f) => {
              const r = run.current
              if (f.running) {
                acc.current += f.dt * speed
                while (acc.current >= 1) {
                  acc.current -= 1
                  if (!step()) {
                    setRunning(false)
                    acc.current = 0
                    break
                  }
                }
              }
              const P = pts.current
              const E = edges.current
              clear(ctx, W, H, theme.surface)
              const pulse = 0.5 + 0.5 * Math.sin(f.t * 8)
              const frontier: number[] = []
              E.forEach((e, i) => {
                const a = P[e.a]
                const b = P[e.b]
                const st = r.state[i]
                const edgeFrontier = algo === 'prim' && !r.done && st === 0 && r.inTree[e.a] !== r.inTree[e.b]
                if (edgeFrontier) frontier.push(i)
                if (i === r.current) line(ctx, a.x, a.y, b.x, b.y, theme.accent, 5 + pulse * 2)
                else if (st === 1) line(ctx, a.x, a.y, b.x, b.y, ACCEPT, 5)
                else if (st === 2) {
                  line(ctx, a.x, a.y, b.x, b.y, alpha(theme.danger, 0.2 + 0.8 * r.flash[i]), 1.5 + 3 * r.flash[i], [5, 5])
                  r.flash[i] *= f.running ? 0.94 : 1
                } else if (edgeFrontier) line(ctx, a.x, a.y, b.x, b.y, FRONT, 3)
                else line(ctx, a.x, a.y, b.x, b.y, alpha(theme.muted, 0.45), 1.5)
              })
              if (labels)
                E.forEach((e, i) => {
                  const mx = (P[e.a].x + P[e.b].x) / 2
                  const my = (P[e.a].y + P[e.b].y) / 2
                  const s = String(e.w)
                  const wdt = 8 + s.length * 7.5
                  const hot = i === r.current || r.state[i] === 1
                  rrect(ctx, mx - wdt / 2, my - 9, wdt, 18, 5, hot ? (i === r.current ? theme.accent : ACCEPT) : alpha(theme.surface, 0.9))
                  text(ctx, s, mx, my + 1, { color: hot ? '#fff' : theme.muted, size: 12, align: 'center', baseline: 'middle', weight: 600 })
                })
              P.forEach((q, i) => {
                let fill = theme.sunken
                if (algo === 'kruskal') {
                  const root = r.uf.find(i)
                  if (r.uf.size[root] > 1) fill = PALETTE[root % PALETTE.length]
                } else if (r.inTree[i]) fill = ACCEPT
                if (algo === 'prim' && i === Math.min(start, n - 1)) circle(ctx, q.x, q.y, 15, undefined, theme.ok, 2.5)
                circle(ctx, q.x, q.y, 10, fill, fill === theme.sunken ? theme.border : theme.surface, 2)
                text(ctx, String(i), q.x + 12, q.y - 10, { color: theme.text, size: 12, weight: 600 })
              })

              // Side panel: Kruskal's sorted edge list, or Prim's frontier.
              rrect(ctx, GW + 8, 8, W - GW - 16, H - 16, 8, theme.sunken, theme.border)
              const x0 = GW + 20
              text(ctx, algo === 'kruskal' ? 'Edges by weight' : 'Frontier, cheapest first', x0, 30, { color: theme.text, size: 13, weight: 700, mono: false })
              const rows = Math.floor((H - 60) / ROW)
              let list = algo === 'kruskal' ? sortedOrder(E) : frontier.sort((i, j) => E[i].w - E[j].w || i - j)
              let first = 0
              if (algo === 'kruskal' && r.current >= 0) first = Math.max(0, Math.min(list.indexOf(r.current) - 4, list.length - rows))
              else if (algo === 'kruskal' && r.done) first = 0
              list = list.slice(first, first + rows)
              list.forEach((i, k) => {
                const y = 52 + k * ROW
                const st = r.state[i]
                if (i === r.current) rrect(ctx, x0 - 6, y - 14, W - GW - 36, ROW - 2, 4, alpha(theme.accent, 0.2))
                const color = i === r.current ? theme.accent : st === 1 ? ACCEPT : st === 2 ? theme.danger : theme.text
                text(ctx, `${E[i].a}–${E[i].b}`, x0, y, { color, size: 12, weight: 600 })
                text(ctx, `w ${E[i].w}`, x0 + 110, y, { color, size: 12, align: 'right' })
                text(ctx, st === 1 ? 'added' : st === 2 ? 'cycle' : i === r.current ? 'check' : '', W - 24, y, { color, size: 12, align: 'right' })
              })
              if (algo === 'prim' && !frontier.length) text(ctx, r.done ? 'Tree complete' : 'Press Play', x0, 52, { color: theme.muted, size: 12 })
            }}
          />
          <Legend
            items={[
              [theme.accent, 'edge being checked'],
              [ACCEPT, 'in the tree'],
              [theme.danger, 'rejected (would make a cycle)'],
              ...(algo === 'prim' ? ([[FRONT, 'frontier edges']] as const) : ([[PALETTE[1], 'union-find components']] as const)),
            ]}
          />
          <Readout
            items={[
              ['Total weight', fmt(stats.total)],
              ['Edges accepted', `${stats.accepted} / ${Math.max(0, n - 1)}`],
              ['Edges rejected', stats.rejected],
              ['Edges checked', `${stats.considered} / ${edges.current.length}`],
              ['Status', stats.done ? 'done' : stats.considered ? 'running' : 'ready'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={play} onStep={step} onReset={() => newRun()} resetLabel="Restart" />
      <Choice
        label="Algorithm"
        value={algo}
        options={[['kruskal', 'Kruskal'], ['prim', 'Prim']]}
        onChange={(v) => {
          setAlgo(v)
          newRun(v)
        }}
      />
      <Slider
        label="Points"
        value={count}
        min={5}
        max={40}
        onChange={(v) => {
          setCount(v)
          rebuild({ n: v })
        }}
      />
      <Choice
        label="Edge weights"
        value={weights}
        options={[['distance', 'Distance'], ['random', 'Random 1–20']]}
        onChange={(v) => {
          setWeights(v)
          rebuild({ mode: v, fresh: false })
        }}
      />
      <Choice
        label="Neighbours per point"
        value={density}
        options={[['2', '2'], ['3', '3'], ['5', '5']]}
        onChange={(v) => {
          setDensity(v)
          rebuild({ k: v, fresh: false })
        }}
      />
      <Toggle label="Show weights" checked={labels} onChange={setLabels} />
      <Slider label="Speed" value={speed} min={0.5} max={30} step={0.5} unit=" steps/s" onChange={setSpeed} />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={() => rebuild()}>
          New graph
        </button>
      </div>
      <Hint>Click empty space to add a point, or click a point to start Prim's there. Kruskal scans every edge from cheapest up and skips any that would close a loop; Prim grows a single tree. Both end with the same total weight.</Hint>
    </SimLayout>
  )
}
