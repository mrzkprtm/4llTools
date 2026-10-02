import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, grid, rrect, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { OPEN, WALL, WEIGHT, divisionMaze, makeGrid, scatter, search, type Algo, type Heuristic, type PathEvent, type PathResult } from './path'

const COLS = 40
const ROWS = 24
const CELL = 20
const W = COLS * CELL
const H = ROWS * CELL
const ALGOS = [['astar', 'A* search'], ['dijkstra', 'Dijkstra'], ['bfs', 'Breadth-first search'], ['dfs', 'Depth-first search'], ['greedy', 'Greedy best-first']] as const
const FRONTIER = '#f59f00'
const PATH = '#f59f00'

/** Steps per frame from the 0–100 speed slider, 0.2 … 63 on a log scale. */
const perFrame = (v: number) => 0.2 * 10 ** ((v / 100) * 2.5)
/** A smooth hue wave so rings of equal distance share a colour. */
const waveHue = (d: number) => 190 + 95 * (0.5 - 0.5 * Math.cos((d / 26) * Math.PI * 2))

interface Search {
  gen: Generator<PathEvent, PathResult, undefined> | null
  visitedAt: Int32Array
  dist: Float32Array
  frontier: Uint8Array
  result: PathResult | null
  shown: number
  visited: number
}

const emptySearch = (): Search => ({ gen: null, visitedAt: new Int32Array(COLS * ROWS).fill(-1), dist: new Float32Array(COLS * ROWS), frontier: new Uint8Array(COLS * ROWS), result: null, shown: 0, visited: 0 })

function starterGrid() {
  const g = makeGrid(COLS, ROWS)
  for (let y = 3; y < 21; y++) g.cost[y * COLS + 20] = WALL
  for (let x = 12; x < 20; x++) g.cost[5 * COLS + x] = WALL
  for (let y = 9; y < 16; y++) for (let x = 25; x < 28; x++) g.cost[y * COLS + x] = WEIGHT
  return g
}

export default function PathfindingVisualizer() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [algo, setAlgo] = useState<Algo>('astar')
  const [heur, setHeur] = useState<Heuristic>('manhattan')
  const [paint, setPaint] = useState<'wall' | 'weight'>('wall')
  const [speed, setSpeed] = useState(55)
  const [stats, setStats] = useState({ visited: 0, length: 0, cost: 0, found: true })
  const g = useRef(starterGrid())
  const ends = useRef({ start: 12 * COLS + 7, end: 12 * COLS + 32 })
  const s = useRef<Search>({ ...emptySearch(), gen: search(g.current, ends.current.start, ends.current.end, 'astar') })
  const acc = useRef(0)
  const frame = useRef(0)
  const drag = useRef<{ kind: 'start' | 'end' | 'paint'; value: number; last: number } | null>(null)

  function publish() {
    const r = s.current.result
    setStats({ visited: s.current.visited, length: r && r.path.length ? r.path.length - 1 : 0, cost: r && r.path.length ? r.cost : 0, found: !r || r.path.length > 0 })
  }

  function clearPath() {
    s.current = emptySearch()
    publish()
  }

  function begin() {
    s.current = emptySearch()
    s.current.gen = search(g.current, ends.current.start, ends.current.end, algo, heur)
  }

  function advanceSearch(k: number) {
    const st = s.current
    while (k-- > 0 && st.gen) {
      const r = st.gen.next()
      if (r.done) {
        st.result = r.value
        st.gen = null
        break
      }
      const e = r.value
      if ('visit' in e) {
        st.visitedAt[e.visit] = frame.current
        st.dist[e.visit] = e.dist
        st.frontier[e.visit] = 0
        st.visited++
      } else st.frontier[e.frontier] = 1
    }
  }

  /** After an edit on a finished search, redo it instantly so the path follows your changes. */
  function afterEdit() {
    const st = s.current
    if (st.gen) {
      clearPath()
      setRunning(false)
    } else if (st.result) {
      begin()
      const cur = s.current
      advanceSearch(1e9)
      for (let i = 0; i < cur.visitedAt.length; i++) if (cur.visitedAt[i] !== -1) cur.visitedAt[i] = -1000
      cur.shown = cur.result?.path.length ?? 0
      publish()
    }
  }

  function play(v: boolean) {
    if (v && !s.current.gen) begin()
    setRunning(v)
  }

  function step() {
    if (!s.current.gen && !s.current.result) begin()
    advanceSearch(1)
    if (s.current.result) s.current.shown = s.current.result.path.length
    publish()
  }

  function load(cost: Uint8Array) {
    g.current.cost = cost
    const { start, end } = ends.current
    g.current.cost[start] = OPEN
    g.current.cost[end] = OPEN
    clearPath()
  }

  function onPointer(p: SimPointer) {
    const i = clamp(Math.floor(p.y / CELL), 0, ROWS - 1) * COLS + clamp(Math.floor(p.x / CELL), 0, COLS - 1)
    const e = ends.current
    const cost = g.current.cost
    if (p.type === 'up') {
      drag.current = null
      return
    }
    if (p.type === 'down') {
      if (i === e.start || i === e.end) drag.current = { kind: i === e.start ? 'start' : 'end', value: 0, last: i }
      else {
        const type = p.shift || paint === 'weight' ? WEIGHT : WALL
        drag.current = { kind: 'paint', value: cost[i] === type ? OPEN : type, last: i }
        cost[i] = drag.current.value
        afterEdit()
      }
      return
    }
    const d = drag.current
    if (!d || !p.down || i === d.last) return
    if (d.kind === 'paint') {
      // Fill every cell between the last and current pointer cells so fast drags leave no gaps.
      const ax = d.last % COLS
      const ay = (d.last / COLS) | 0
      const bx = i % COLS
      const by = (i / COLS) | 0
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay))
      for (let k = 1; k <= n; k++) {
        const c = Math.round(ay + ((by - ay) * k) / n) * COLS + Math.round(ax + ((bx - ax) * k) / n)
        if (c !== e.start && c !== e.end) cost[c] = d.value
      }
    } else if (cost[i] !== WALL && i !== (d.kind === 'start' ? e.end : e.start)) e[d.kind] = i
    d.last = i
    afterEdit()
  }

  const optimal = algo === 'astar' || algo === 'dijkstra' ? 'yes' : algo === 'bfs' ? 'if no weights' : 'no'

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-flat"
            label={`A ${COLS} by ${ROWS} grid searched with ${ALGOS.find((a) => a[0] === algo)?.[1]}. ${stats.visited} cells visited${stats.length ? `, path of ${stats.length} steps costing ${stats.cost}` : ''}.`}
            onPointer={onPointer}
            onFrame={(ctx, f) => {
              frame.current = f.frame
              const st = s.current
              if (f.running) {
                if (st.gen) {
                  acc.current += perFrame(speed)
                  const k = Math.floor(acc.current)
                  acc.current -= k
                  advanceSearch(k)
                } else if (st.result && st.shown < st.result.path.length) st.shown = Math.min(st.result.path.length, st.shown + Math.max(0.5, st.result.path.length / 70))
                else if (st.result) setRunning(false)
              }
              if (f.frame % 8 === 0) publish()

              clear(ctx, W, H, theme.surface)
              const cost = g.current.cost
              const dark = theme.dark
              for (let i = 0; i < cost.length; i++) {
                const x = (i % COLS) * CELL
                const y = ((i / COLS) | 0) * CELL
                if (cost[i] === WALL) {
                  ctx.fillStyle = alpha(theme.text, 0.82)
                  ctx.fillRect(x, y, CELL, CELL)
                  continue
                }
                const at = st.visitedAt[i]
                if (at !== -1) {
                  const t = clamp((f.frame - at) / 14, 0, 1)
                  const sz = CELL * (0.35 + 0.65 * (1 - (1 - t) ** 3))
                  const c = `hsl(${waveHue(st.dist[i])} 70% ${dark ? 42 : 68}% / ${0.55 + 0.35 * (1 - t)})`
                  rrect(ctx, x + (CELL - sz) / 2, y + (CELL - sz) / 2, sz, sz, t < 1 ? sz / 2 : 2, c)
                } else if (st.frontier[i]) {
                  ctx.fillStyle = alpha(FRONTIER, 0.35)
                  ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2)
                }
                if (cost[i] === WEIGHT) {
                  rrect(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 4, alpha('#8d5a2b', dark ? 0.75 : 0.55))
                  text(ctx, '5', x + CELL / 2, y + CELL / 2 + 1, { color: '#fff', size: 12, weight: 700, align: 'center', baseline: 'middle' })
                }
              }
              grid(ctx, W, H, CELL, alpha(theme.border, 0.55))

              const r = st.result
              if (r && r.path.length && st.shown > 0) {
                const n = Math.floor(st.shown)
                ctx.beginPath()
                for (let k = 0; k < n; k++) {
                  const c = r.path[k]
                  const px = (c % COLS) * CELL + CELL / 2
                  const py = ((c / COLS) | 0) * CELL + CELL / 2
                  if (k) ctx.lineTo(px, py)
                  else ctx.moveTo(px, py)
                }
                ctx.strokeStyle = PATH
                ctx.lineWidth = 7
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                ctx.stroke()
              }

              const { start, end } = ends.current
              const sx = (start % COLS) * CELL + CELL / 2
              const sy = ((start / COLS) | 0) * CELL + CELL / 2
              circle(ctx, sx, sy, 9, theme.ok, theme.surface, 2)
              ctx.beginPath()
              ctx.moveTo(sx - 3, sy - 5)
              ctx.lineTo(sx + 5, sy)
              ctx.lineTo(sx - 3, sy + 5)
              ctx.closePath()
              ctx.fillStyle = '#fff'
              ctx.fill()
              const ex = (end % COLS) * CELL + CELL / 2
              const ey = ((end / COLS) | 0) * CELL + CELL / 2
              circle(ctx, ex, ey, 9, theme.danger, theme.surface, 2)
              circle(ctx, ex, ey, 5, '#fff')
              circle(ctx, ex, ey, 2.5, theme.danger)
              if (r && !r.path.length) {
                rrect(ctx, W / 2 - 110, H / 2 - 20, 220, 40, 8, alpha(theme.surface, 0.92), theme.danger)
                text(ctx, 'No path to the target', W / 2, H / 2 + 5, { color: theme.danger, size: 15, weight: 700, align: 'center' })
              }
            }}
          />
          <Legend
            items={[
              [theme.ok, 'start'],
              [theme.danger, 'target'],
              [alpha(theme.text, 0.82), 'wall'],
              ['#8d5a2b', 'weight (cost 5)'],
              [alpha(FRONTIER, 0.5), 'frontier'],
              [`hsl(${waveHue(8)} 70% 62%)`, 'visited (hue = distance)'],
              [PATH, 'path'],
            ]}
          />
          <Readout
            items={[
              ['Visited', stats.visited],
              ['Path length', stats.found ? (stats.length ? `${stats.length} steps` : '—') : 'none'],
              ['Path cost', stats.found && stats.length ? stats.cost : '—'],
              ['Shortest?', optimal],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={play} onStep={step} onReset={clearPath} resetLabel="Clear path" />
      <Select
        label="Algorithm"
        value={algo}
        options={ALGOS}
        onChange={(v) => {
          setAlgo(v)
          clearPath()
        }}
      />
      {(algo === 'astar' || algo === 'greedy') && (
        <Choice
          label="Heuristic"
          value={heur}
          options={[['manhattan', 'Manhattan'], ['euclidean', 'Euclidean']]}
          onChange={(v) => {
            setHeur(v)
            clearPath()
          }}
        />
      )}
      <Choice label="Drag to paint" value={paint} options={[['wall', 'Walls'], ['weight', 'Weights']]} onChange={setPaint} />
      <Slider label="Speed" value={speed} min={0} max={100} format={(v) => `${fmt(perFrame(v), 1)} cells/frame`} onChange={setSpeed} />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={() => load(divisionMaze(COLS, ROWS, Math.random))}>
          Maze
        </button>
        <button type="button" className="btn" onClick={() => load(scatter(COLS, ROWS, Math.random, 0.25, 0.1))}>
          Random walls
        </button>
        <button type="button" className="btn" onClick={() => load(new Uint8Array(COLS * ROWS).fill(OPEN))}>
          Clear walls
        </button>
      </div>
      <Hint>Drag on the grid to draw walls (Shift-drag for weights that cost 5 to cross) and drag the green start or red target. After a search finishes, move them and the path updates instantly.</Hint>
    </SimLayout>
  )
}
