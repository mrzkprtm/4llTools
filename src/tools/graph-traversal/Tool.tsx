import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, text } from '../../sim/draw'
import { clamp } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { bfs, dfs, nodeName, preset, type Graph, type Preset, type TravStep } from './graph'

const W = 800
const H = 480
const R = 18
const TREE = '#1c7ed6'
const FRONT = '#f59f00'

type Sel = { type: 'node'; id: number } | { type: 'edge'; a: number; b: number } | null

interface Trav {
  gen: Generator<TravStep> | null
  order: Map<number, number>
  level: Map<number, number>
  tree: Set<string>
  frontier: number[]
  current: number
  sequence: number[]
  done: boolean
}

const emptyTrav = (): Trav => ({ gen: null, order: new Map(), level: new Map(), tree: new Set(), frontier: [], current: -1, sequence: [], done: false })
const key = (a: number, b: number) => `${a}-${b}`

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1)
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

export default function GraphTraversal() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [algo, setAlgo] = useState<'bfs' | 'dfs'>('bfs')
  const [mode, setMode] = useState<'connect' | 'move'>('connect')
  const [directed, setDirected] = useState(false)
  const [delay, setDelay] = useState(0.6)
  const [sel, setSel] = useState<Sel>(null)
  const [start, setStart] = useState(0)
  const [, setTick] = useState(0)
  const graph = useRef<Graph>(preset('tree', W, H, Math.random))
  const trav = useRef<Trav>(emptyTrav())
  const timer = useRef(0)
  const drag = useRef<{ id: number | null; x0: number; y0: number; x: number; y: number; moved: boolean; move: boolean } | null>(null)

  const rerender = () => setTick((k) => k + 1)

  function resetTrav() {
    trav.current = emptyTrav()
    rerender()
  }

  function edited() {
    resetTrav()
    setRunning(false)
  }

  function begin() {
    const g = graph.current
    const s = g.nodes.some((n) => n.id === start) ? start : (g.nodes[0]?.id ?? -1)
    trav.current = emptyTrav()
    if (s < 0) return
    trav.current.gen = (algo === 'bfs' ? bfs : dfs)({ ...g, directed }, s)
  }

  function step() {
    const t = trav.current
    if (!t.gen && !t.done) begin()
    const tt = trav.current
    if (!tt.gen) return false
    const r = tt.gen.next()
    if (r.done) {
      tt.gen = null
      tt.done = true
      tt.current = -1
      rerender()
      return false
    }
    const s = r.value
    tt.frontier = s.frontier
    tt.current = s.node
    if (s.kind === 'visit') {
      tt.order.set(s.node, s.order)
      tt.level.set(s.node, s.level)
      tt.sequence.push(s.node)
      if (s.from !== null) tt.tree.add(key(s.from, s.node))
    }
    rerender()
    return true
  }

  function play(v: boolean) {
    if (v && trav.current.done) resetTrav()
    setRunning(v)
  }

  function load(p: Preset) {
    graph.current = preset(p, W, H, Math.random)
    setStart(0)
    setSel(null)
    edited()
  }

  function hitNode(x: number, y: number) {
    let best: number | null = null
    let bd = R + 6
    for (const n of graph.current.nodes) {
      const d = Math.hypot(n.x - x, n.y - y)
      if (d < bd) {
        bd = d
        best = n.id
      }
    }
    return best
  }

  function hitEdge(x: number, y: number) {
    const g = graph.current
    const at = (id: number) => g.nodes.find((n) => n.id === id)!
    return g.edges.find((e) => segDist(x, y, at(e.a).x, at(e.a).y, at(e.b).x, at(e.b).y) < 7) ?? null
  }

  function deleteSel(s: Sel) {
    const g = graph.current
    if (!s) return
    if (s.type === 'node') {
      g.nodes = g.nodes.filter((n) => n.id !== s.id)
      g.edges = g.edges.filter((e) => e.a !== s.id && e.b !== s.id)
    } else g.edges = g.edges.filter((e) => !(e.a === s.a && e.b === s.b))
    setSel(null)
    edited()
  }

  function onPointer(p: SimPointer) {
    const g = graph.current
    if (p.type === 'down') {
      if (p.button === 2) {
        const id = hitNode(p.x, p.y)
        const e = id === null ? hitEdge(p.x, p.y) : null
        deleteSel(id !== null ? { type: 'node', id } : e ? { type: 'edge', a: e.a, b: e.b } : null)
        return
      }
      const id = hitNode(p.x, p.y)
      drag.current = { id, x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false, move: mode === 'move' || p.shift }
      return
    }
    const d = drag.current
    if (!d) return
    d.x = p.x
    d.y = p.y
    if (Math.hypot(p.x - d.x0, p.y - d.y0) > 5) d.moved = true
    if (p.type === 'move' && d.moved && d.id !== null && d.move) {
      const n = g.nodes.find((q) => q.id === d.id)
      if (n) {
        n.x = clamp(p.x, R, W - R)
        n.y = clamp(p.y, R, H - R)
      }
    }
    if (p.type !== 'up') return
    drag.current = null
    if (d.id !== null && !d.moved) {
      setSel({ type: 'node', id: d.id })
      setStart(d.id)
      resetTrav()
    } else if (d.id !== null && !d.move) {
      const target = hitNode(p.x, p.y)
      if (target !== null && target !== d.id && !g.edges.some((e) => (e.a === d.id && e.b === target) || (!directed && e.a === target && e.b === d.id))) {
        g.edges.push({ a: d.id, b: target })
        edited()
      }
    } else if (d.id === null && !d.moved) {
      const e = hitEdge(p.x, p.y)
      if (e) setSel({ type: 'edge', a: e.a, b: e.b })
      else if (g.nodes.length < 40) {
        const id = g.nodes.reduce((m, n) => Math.max(m, n.id + 1), 0)
        g.nodes.push({ id, x: clamp(p.x, R, W - R), y: clamp(p.y, R, H - R) })
        setSel({ type: 'node', id })
        edited()
      }
    }
  }

  const t = trav.current
  const g = graph.current
  const frontName = algo === 'bfs' ? 'Queue (front → back)' : 'Stack (bottom → top)'

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-flat"
            onPointer={onPointer}
            label={`Graph with ${g.nodes.length} nodes and ${g.edges.length} edges. ${algo.toUpperCase()} from ${nodeName(start)} has visited ${t.sequence.length} nodes.`}
            onFrame={(ctx, f) => {
              if (f.running) {
                timer.current += f.dt
                if (timer.current >= delay) {
                  timer.current = 0
                  if (!step()) setRunning(false)
                }
              }
              const gr = graph.current
              const tr = trav.current
              const at = new Map(gr.nodes.map((n) => [n.id, n]))
              clear(ctx, W, H, theme.surface)
              for (const e of gr.edges) {
                const a = at.get(e.a)
                const b = at.get(e.b)
                if (!a || !b) continue
                const isTree = tr.tree.has(key(e.a, e.b)) || (!directed && tr.tree.has(key(e.b, e.a)))
                const selected = sel?.type === 'edge' && sel.a === e.a && sel.b === e.b
                const color = selected ? theme.danger : isTree ? TREE : alpha(theme.muted, 0.6)
                const width = isTree ? 4 : selected ? 3 : 2
                if (directed) {
                  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
                  const ux = (b.x - a.x) / len
                  const uy = (b.y - a.y) / len
                  arrow(ctx, a.x + ux * R, a.y + uy * R, b.x - ux * (R + 2), b.y - uy * (R + 2), color, width, 11)
                } else line(ctx, a.x, a.y, b.x, b.y, color, width)
              }
              const d = drag.current
              if (d && d.id !== null && d.moved && !d.move) {
                const a = at.get(d.id)
                if (a) line(ctx, a.x, a.y, d.x, d.y, alpha(theme.accent, 0.8), 2, [6, 5])
              }
              const inFront = new Set(tr.frontier)
              const pulse = 0.5 + 0.5 * Math.sin(f.t * 7)
              for (const n of gr.nodes) {
                const visited = tr.order.has(n.id)
                const current = n.id === tr.current && !tr.done
                const fill = current ? theme.accent : visited ? TREE : theme.sunken
                if (inFront.has(n.id) && !visited) circle(ctx, n.x, n.y, R + 5 + pulse * 2, undefined, FRONT, 3)
                if (n.id === start) circle(ctx, n.x, n.y, R + 4, undefined, theme.ok, 2.5)
                const selected = sel?.type === 'node' && sel.id === n.id
                circle(ctx, n.x, n.y, R, fill, selected ? theme.danger : visited || current ? fill : theme.border, selected ? 3 : 2)
                text(ctx, nodeName(n.id), n.x, n.y + 1, { color: visited || current ? '#fff' : theme.text, size: 14, weight: 700, align: 'center', baseline: 'middle', mono: false })
                const o = tr.order.get(n.id)
                if (o !== undefined) {
                  circle(ctx, n.x + R * 0.85, n.y - R * 0.85, 10, theme.surface, TREE, 1.5)
                  text(ctx, String(o + 1), n.x + R * 0.85, n.y - R * 0.85 + 1, { color: TREE, size: 12, weight: 700, align: 'center', baseline: 'middle' })
                }
              }
              if (!gr.nodes.length) text(ctx, 'Click anywhere to add a node', W / 2, H / 2, { color: theme.muted, size: 15, align: 'center', mono: false })
            }}
          />
          <Legend items={[[theme.ok, 'start node (click a node to choose)'], [FRONT, algo === 'bfs' ? 'in the queue' : 'on the stack'], [theme.accent, 'current'], [TREE, 'visited / tree edge'], [theme.danger, 'selected']]} />
          <div className="sim-field">
            <span className="sim-label">{frontName}</span>
            <div className="sim-cells" aria-live="off">
              {t.frontier.length ? t.frontier.map((id, i) => <span key={i} className={(algo === 'bfs' ? i === 0 : i === t.frontier.length - 1) ? 'on' : ''}>{nodeName(id)}</span>) : <span className="dim">empty</span>}
            </div>
          </div>
          <div className="sim-field">
            <span className="sim-label">Visit order</span>
            <div className="sim-cells">
              {t.sequence.length ? t.sequence.map((id, i) => <span key={i}>{`${i + 1}. ${nodeName(id)}`}</span>) : <span className="dim">not started</span>}
            </div>
          </div>
          <Readout
            items={[
              ['Visited', `${t.sequence.length} / ${g.nodes.length}`],
              ['Frontier size', t.frontier.length],
              [algo === 'bfs' ? 'Current level' : 'Current depth', t.current >= 0 && t.level.has(t.current) ? t.level.get(t.current)! : '—'],
              ['Edges', g.edges.length],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={play} onStep={step} onReset={resetTrav} resetLabel="Reset search" />
      <Choice
        label="Algorithm"
        value={algo}
        options={[['bfs', 'BFS (queue)'], ['dfs', 'DFS (stack)']]}
        onChange={(v) => {
          setAlgo(v)
          resetTrav()
        }}
      />
      <Choice label="Dragging from a node" value={mode} options={[['connect', 'Adds an edge'], ['move', 'Moves it']]} onChange={setMode} />
      <Toggle
        label="Directed edges"
        checked={directed}
        onChange={(v) => {
          setDirected(v)
          edited()
        }}
      />
      <div className="row sim-bar">
        <button type="button" className="btn" disabled={!sel} onClick={() => deleteSel(sel)}>
          Delete selected
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            graph.current = { nodes: [], edges: [], directed }
            setSel(null)
            edited()
          }}
        >
          Clear graph
        </button>
      </div>
      <div className="sim-field">
        <span className="sim-label">Presets</span>
        <div className="row sim-bar">
          {(['tree', 'grid', 'random', 'cycle'] as const).map((p) => (
            <button key={p} type="button" className="btn" onClick={() => load(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <Slider label="Step time" value={delay} min={0.1} max={1.5} step={0.05} unit=" s" onChange={setDelay} />
      <Hint>Click empty space to add a node, drag from one node to another to join them (Shift-drag moves a node), and right-click to delete. BFS spreads out level by level from the green start; DFS dives down one branch before backing up.</Hint>
    </SimLayout>
  )
}
