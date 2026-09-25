import { useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, downloadCanvas } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { E, GENERATORS, N, S, Wb, deadEnds, makeMaze, solver, type GenAlgo, type GenStep, type Maze, type SolveAlgo, type SolveStep } from './maze'

const W = 800
const H = 480
const GENS = [['backtracker', 'Recursive backtracker (DFS)'], ['prim', "Randomized Prim's"], ['kruskal', "Randomized Kruskal's"], ['wilson', "Wilson's (loop-erased walks)"], ['binary', 'Binary tree'], ['sidewinder', 'Sidewinder']] as const
const SOLVERS = [['bfs', 'Breadth-first search'], ['dfs', 'Depth-first search'], ['astar', 'A* (Manhattan)'], ['wall', 'Wall follower (right hand)']] as const
const PATH = '#f59f00'
const FRONTIER = '#f59f00'

const perFrame = (v: number) => 0.3 * 10 ** ((v / 100) * 3.3)
const rowsFor = (cols: number) => Math.max(5, Math.round(cols * 0.58))

interface State {
  maze: Maze
  gen: Generator<GenStep> | null
  last: GenStep | null
  solve: Generator<SolveStep, number[], undefined> | null
  dist: Int32Array
  visited: number
  path: number[] | null
  shown: number
  cur: number
}

function fresh(cols: number, algo: GenAlgo): State {
  const maze = makeMaze(cols, rowsFor(cols))
  return { maze, gen: GENERATORS[algo](maze, Math.random), last: null, solve: null, dist: new Int32Array(maze.open.length).fill(-1), visited: 0, path: null, shown: 0, cur: -1 }
}

export default function MazeGenerator() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [algo, setAlgo] = useState<GenAlgo>('backtracker')
  const [how, setHow] = useState<SolveAlgo>('bfs')
  const [cols, setCols] = useState(24)
  const [speed, setSpeed] = useState(38)
  const [info, setInfo] = useState({ phase: 'carving', dead: 0, length: 0, visited: 0, extra: 0 })
  const st = useRef<State>(fresh(24, 'backtracker'))
  const acc = useRef(0)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  function publish() {
    const s = st.current
    const phase = s.gen ? 'carving' : s.solve ? 'solving' : s.path ? 'solved' : 'ready'
    const extra = s.last?.stack?.length ?? s.last?.frontier?.size ?? s.last?.walk?.length ?? 0
    setInfo({ phase, dead: s.gen ? 0 : deadEnds(s.maze), length: s.path?.length ? s.path.length - 1 : 0, visited: s.visited, extra: s.gen ? extra : 0 })
  }

  function restart(c = cols, a = algo) {
    st.current = fresh(c, a)
    acc.current = 0
    publish()
  }

  function startSolve() {
    const s = st.current
    if (s.gen) return
    s.solve = solver(s.maze, 0, s.maze.open.length - 1, how)
    s.dist.fill(-1)
    s.visited = 0
    s.path = null
    s.shown = 0
  }

  /** Runs `k` steps of whichever phase is active. Returns false when there is nothing left to do. */
  function advance(k: number): boolean {
    const s = st.current
    while (k-- > 0) {
      if (s.gen) {
        const r = s.gen.next()
        if (r.done) {
          s.gen = null
          s.last = null
          return false
        }
        s.last = r.value
        s.cur = r.value.cell
      } else if (s.solve) {
        const r = s.solve.next()
        if (r.done) {
          s.path = r.value
          s.solve = null
          s.cur = -1
          return false
        }
        if (s.dist[r.value.cell] < 0) s.visited++
        s.dist[r.value.cell] = r.value.dist
        s.cur = r.value.cell
      } else return false
    }
    return true
  }

  function play(v: boolean) {
    const s = st.current
    if (v && !s.gen && !s.solve) {
      if (s.path) restart()
      else startSolve()
    }
    setRunning(v)
  }

  function step() {
    const s = st.current
    if (!s.gen && !s.solve && !s.path) startSolve()
    advance(1)
    if (s.path) s.shown = s.path.length
    publish()
  }

  function finish() {
    const s = st.current
    if (!s.gen && !s.solve && !s.path) startSolve()
    while (advance(1e5));
    if (s.path) s.shown = s.path.length
    publish()
  }

  const rows = rowsFor(cols)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            canvasRef={canvas}
            className="sim-flat"
            label={`A ${cols} by ${rows} maze, ${info.phase}.${info.length ? ` The solution is ${info.length} steps long.` : ''}`}
            onFrame={(ctx, f) => {
              const s = st.current
              const m = s.maze
              if (f.running) {
                if (s.gen || s.solve) {
                  acc.current += perFrame(speed)
                  const k = Math.floor(acc.current)
                  acc.current -= k
                  if (k > 0 && !advance(k) && !s.solve && !s.path) setRunning(false)
                } else if (s.path && s.shown < s.path.length) s.shown = Math.min(s.path.length, s.shown + Math.max(0.6, s.path.length / 80))
                else setRunning(false)
              }
              if (f.frame % 8 === 0) publish()

              const cs = Math.min((W - 24) / m.cols, (H - 24) / m.rows)
              const ox = (W - cs * m.cols) / 2
              const oy = (H - cs * m.rows) / 2
              clear(ctx, W, H, theme.surface)
              const X = (c: number) => ox + (c % m.cols) * cs
              const Y = (c: number) => oy + ((c / m.cols) | 0) * cs
              const carving = !!s.gen
              const inStack = new Set(s.last?.stack ?? [])
              for (let c = 0; c < m.open.length; c++) {
                let fill: string | null = null
                if (carving && !m.open[c]) fill = alpha(theme.text, theme.dark ? 0.22 : 0.13)
                if (carving && s.last?.frontier?.has(c)) fill = alpha(FRONTIER, 0.45)
                if (carving && inStack.has(c)) fill = alpha(theme.accent, 0.22)
                if (!carving && s.dist[c] >= 0) fill = `hsl(${200 + 90 * (0.5 - 0.5 * Math.cos((s.dist[c] / 30) * Math.PI * 2))} 70% ${theme.dark ? 40 : 72}% / 0.75)`
                if (fill) {
                  ctx.fillStyle = fill
                  ctx.fillRect(X(c), Y(c), cs + 0.5, cs + 0.5)
                }
              }
              // Wilson's current random walk.
              const walk = carving ? s.last?.walk : undefined
              if (walk && walk.length > 1) {
                ctx.beginPath()
                walk.forEach((c, i) => (i ? ctx.lineTo(X(c) + cs / 2, Y(c) + cs / 2) : ctx.moveTo(X(c) + cs / 2, Y(c) + cs / 2)))
                ctx.strokeStyle = alpha(theme.accent, 0.7)
                ctx.lineWidth = Math.max(2, cs * 0.25)
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                ctx.stroke()
              }
              if (s.cur >= 0 && (carving || s.solve)) {
                ctx.fillStyle = theme.accent
                ctx.fillRect(X(s.cur) + cs * 0.15, Y(s.cur) + cs * 0.15, cs * 0.7, cs * 0.7)
              }
              // Walls: each cell draws its closed north and west sides, plus the outer south and east edges.
              ctx.beginPath()
              const last = m.open.length - 1
              for (let c = 0; c < m.open.length; c++) {
                const x = X(c)
                const y = Y(c)
                const o = m.open[c]
                if (!(o & N)) {
                  ctx.moveTo(x, y)
                  ctx.lineTo(x + cs, y)
                }
                if (!(o & Wb) && c !== 0) {
                  ctx.moveTo(x, y)
                  ctx.lineTo(x, y + cs)
                }
                if (!(o & S) && c + m.cols >= m.open.length) {
                  ctx.moveTo(x, y + cs)
                  ctx.lineTo(x + cs, y + cs)
                }
                if (!(o & E) && c % m.cols === m.cols - 1 && c !== last) {
                  ctx.moveTo(x + cs, y)
                  ctx.lineTo(x + cs, y + cs)
                }
              }
              ctx.strokeStyle = theme.text
              ctx.lineWidth = Math.max(1.5, cs * 0.12)
              ctx.lineCap = 'square'
              ctx.stroke()
              if (s.path && s.shown > 0) {
                ctx.beginPath()
                for (let k = 0; k < Math.floor(s.shown); k++) {
                  const c = s.path[k]
                  if (k) ctx.lineTo(X(c) + cs / 2, Y(c) + cs / 2)
                  else ctx.moveTo(X(c) - cs / 2, Y(c) + cs / 2)
                }
                if (s.shown >= s.path.length) ctx.lineTo(X(last) + cs * 1.5, Y(last) + cs / 2)
                ctx.strokeStyle = PATH
                ctx.lineWidth = Math.max(2.5, cs * 0.3)
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                ctx.stroke()
              }
              circle(ctx, X(0) + cs / 2, Y(0) + cs / 2, Math.max(3, cs * 0.28), theme.ok)
              circle(ctx, X(last) + cs / 2, Y(last) + cs / 2, Math.max(3, cs * 0.28), theme.danger)
            }}
          />
          <Legend
            items={[
              [theme.accent, 'current cell'],
              [alpha(theme.accent, 0.35), 'DFS stack / walk'],
              [alpha(FRONTIER, 0.6), "Prim's frontier"],
              ['hsl(250 70% 70%)', 'searched (hue = distance)'],
              [PATH, 'solution'],
            ]}
          />
          <Readout
            items={[
              ['Cells', fmt(cols * rows)],
              ['Status', info.phase],
              [algo === 'backtracker' ? 'Stack depth' : algo === 'prim' ? 'Frontier' : algo === 'wilson' ? 'Walk length' : 'Carving', info.extra || '—'],
              ['Dead ends', info.dead || '—'],
              ['Searched cells', info.visited || '—'],
              ['Solution length', info.length ? `${info.length} steps` : '—'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={play} onStep={step} onReset={() => restart()} resetLabel="New maze" />
      <Select
        label="Generator"
        value={algo}
        options={GENS}
        onChange={(v) => {
          setAlgo(v)
          restart(cols, v)
          setRunning(true)
        }}
      />
      <Slider
        label="Maze size"
        value={cols}
        min={6}
        max={60}
        format={(v) => `${v} × ${rowsFor(v)}`}
        onChange={(v) => {
          setCols(v)
          restart(v)
        }}
      />
      <Slider label="Speed" value={speed} min={0} max={100} format={(v) => `${fmt(perFrame(v), 1)} steps/frame`} onChange={setSpeed} />
      <Select label="Solver" value={how} options={SOLVERS} onChange={setHow} />
      <div className="row sim-bar">
        <button
          type="button"
          className="btn"
          disabled={!!st.current.gen}
          onClick={() => {
            startSolve()
            setRunning(true)
          }}
        >
          Solve
        </button>
        <button type="button" className="btn" onClick={finish}>
          Finish now
        </button>
        <button type="button" className="btn" onClick={() => downloadCanvas(canvas.current, 'maze.png')}>
          Download PNG
        </button>
      </div>
      <Hint>Watch the generator carve passages, then press Solve (or Play) to walk from the green start to the red exit. Every maze here is perfect: exactly one route joins any two cells, so all four solvers find the same path.</Hint>
    </SimLayout>
  )
}
