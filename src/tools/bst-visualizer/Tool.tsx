import { useId, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, text } from '../../sim/draw'
import { clamp, lerp } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { emptyTree, inorder, insert, isBalanced, levelorder, postorder, preorder, rebuildAvl, remove, search, treeHeight, apply, type Node, type Step, type Tree } from './bst'

const W = 800
const H = 500
const MAX_NODES = 40
const FOUND = '#2f9e44'

interface Pos {
  x: number
  y: number
  s: number
}

type Op = { label: string; make: (t: Tree) => Generator<Step> }

function seedTree(): Tree {
  const t = emptyTree()
  for (const k of [50, 30, 70, 20, 40, 60, 80, 35, 65]) apply(insert(t, k, false))
  return t
}

function* travSteps(nodes: Node[]): Generator<Step> {
  for (const node of nodes) yield { kind: 'trav', node }
}

export default function BstVisualizer() {
  const theme = useTheme()
  const inputId = useId()
  const [running, setRunning] = useRunning()
  const [avl, setAvl] = useState(false)
  const [delay, setDelay] = useState(0.55)
  const [draft, setDraft] = useState('45')
  const [message, setMessage] = useState('Type a key and press Insert, Delete or Find.')
  const [order, setOrder] = useState<{ name: string; keys: number[]; at: number } | null>(null)
  const [info, setInfo] = useState({ size: 9, height: 3, balanced: true, compares: 0 })
  const tree = useRef<Tree>(seedTree())
  const queue = useRef<Op[]>([])
  const cur = useRef<Generator<Step> | null>(null)
  const timer = useRef(0)
  const pos = useRef(new Map<number, Pos>())
  const marks = useRef(new Map<number, string>())
  const compares = useRef(0)

  function publish() {
    const t = tree.current
    setInfo({ size: t.size, height: treeHeight(t), balanced: isBalanced(t), compares: compares.current })
  }

  function enqueue(...ops: Op[]) {
    queue.current.push(...ops)
    setRunning(true)
  }

  function keyFromDraft(): number | null {
    const v = Math.round(Number(draft))
    if (draft.trim() === '' || !Number.isFinite(v) || v < 0 || v > 999) {
      setMessage('Enter a whole number from 0 to 999.')
      return null
    }
    return v
  }

  const opInsert = (k: number): Op => ({ label: `Insert ${k}`, make: (t) => insert(t, k, avl) })

  function step() {
    if (!cur.current) {
      const op = queue.current.shift()
      if (!op) return false
      if (op.label.startsWith('Insert') && tree.current.size >= MAX_NODES) {
        setMessage(`The tree is full (${MAX_NODES} nodes). Delete some keys or clear it.`)
        return true
      }
      marks.current.clear()
      compares.current = 0
      cur.current = op.make(tree.current)
      setMessage(op.label + '…')
    }
    const r = cur.current.next()
    if (r.done) {
      cur.current = null
      timer.current = -0.4 // linger on the result for a moment
      publish()
      return true
    }
    const s = r.value
    const m = marks.current
    if (s.kind === 'visit') {
      compares.current++
      for (const [id, c] of m) if (c === theme.accent) m.set(id, alpha(theme.accent, 0.35))
      m.set(s.node.id, theme.accent)
      setMessage(s.key === s.node.key ? `${s.key} = ${s.node.key}` : `${s.key} ${s.key < s.node.key ? '<' : '>'} ${s.node.key}: go ${s.key < s.node.key ? 'left' : 'right'}`)
    } else if (s.kind === 'found') {
      m.set(s.node.id, FOUND)
      setMessage(`Found ${s.node.key} after ${compares.current} comparisons.`)
    } else if (s.kind === 'missing') setMessage(`${s.key} is not in the tree (${compares.current} comparisons).`)
    else if (s.kind === 'duplicate') {
      m.set(s.node.id, theme.danger)
      setMessage(`${s.node.key} is already in the tree.`)
    } else if (s.kind === 'insert') {
      const p = s.node.parent ? pos.current.get(s.node.parent.id) : null
      pos.current.set(s.node.id, { x: p?.x ?? W / 2, y: p?.y ?? 40, s: 0 })
      m.set(s.node.id, FOUND)
      setMessage(`Inserted ${s.node.key} as a new leaf.`)
    } else if (s.kind === 'copy') {
      m.set(s.to.id, FOUND)
      m.set(s.from.id, theme.danger)
      setMessage(`${s.old} has two children: copy its successor ${s.to.key} up, then remove the successor.`)
    } else if (s.kind === 'remove') {
      pos.current.delete(s.node.id)
      setMessage('Removed.')
    } else if (s.kind === 'rotate') {
      m.set(s.node.id, '#ae3ec9')
      setMessage(`${s.case} case: rotate ${s.dir} at ${s.node.key}.`)
    } else if (s.kind === 'trav') {
      for (const [id, c] of m) if (c === theme.accent) m.set(id, alpha(theme.accent, 0.35))
      m.set(s.node.id, theme.accent)
      setOrder((o) => (o ? { ...o, at: o.at + 1 } : o))
    }
    publish()
    return true
  }

  function traverse(name: string, nodes: Node[]) {
    setOrder({ name, keys: nodes.map((n) => n.key), at: 0 })
    enqueue({ label: `${name} traversal`, make: () => travSteps(nodes) })
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down') return
    for (const n of inorder(tree.current)) {
      const q = pos.current.get(n.id)
      if (q && Math.hypot(q.x - p.x, q.y - p.y) < 22) {
        setDraft(String(n.key))
        setMessage(`Selected ${n.key}. Press Delete or Find.`)
        return
      }
    }
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-flat"
            cursor="pointer"
            onPointer={onPointer}
            label={`${avl ? 'AVL' : 'Binary search'} tree with ${info.size} keys and height ${info.height}. ${message}`}
            onFrame={(ctx, f) => {
              if (f.running) {
                timer.current += f.dt
                if (timer.current >= delay) {
                  timer.current = 0
                  if (!step() && !cur.current) {
                    marks.current.clear()
                    setRunning(false)
                  }
                }
              }
              // Layout: x from in-order rank, y from depth. Nodes glide towards their targets.
              const t = tree.current
              const nodes = inorder(t)
              const depth = new Map<number, number>()
              for (const n of levelorder(t)) depth.set(n.id, n.parent ? depth.get(n.parent.id)! + 1 : 0)
              const levels = Math.max(1, treeHeight(t) + 1)
              const dx = (W - 40) / Math.max(1, nodes.length)
              const dy = Math.min(78, (H - 70) / Math.max(1, levels - 1))
              const r = clamp(dx * 0.44, 11, 19)
              nodes.forEach((n, i) => {
                const tx = 20 + dx * (i + 0.5)
                const ty = 36 + depth.get(n.id)! * dy
                const p = pos.current.get(n.id)
                if (!p) pos.current.set(n.id, { x: tx, y: ty, s: 1 })
                else {
                  p.x = lerp(p.x, tx, 0.14)
                  p.y = lerp(p.y, ty, 0.14)
                  p.s = lerp(p.s, 1, 0.16)
                }
              })
              clear(ctx, W, H, theme.surface)
              for (const n of nodes) {
                const p = pos.current.get(n.id)!
                for (const c of [n.left, n.right]) {
                  const q = c && pos.current.get(c.id)
                  if (q) line(ctx, p.x, p.y, q.x, q.y, alpha(theme.muted, 0.6), 2)
                }
              }
              for (const n of nodes) {
                const p = pos.current.get(n.id)!
                const mark = marks.current.get(n.id)
                const rr = r * p.s * (mark === theme.accent ? 1.12 : 1)
                circle(ctx, p.x, p.y, rr, mark ?? theme.sunken, mark ?? theme.border, 2)
                if (p.s > 0.4) text(ctx, String(n.key), p.x, p.y + 1, { color: mark ? '#fff' : theme.text, size: r > 15 ? 14 : 12, weight: 700, align: 'center', baseline: 'middle' })
                if (avl && p.s > 0.9 && r > 14) {
                  const b = (n.left?.height ?? 0) - (n.right?.height ?? 0)
                  text(ctx, b > 0 ? `+${b}` : String(b), p.x + r + 3, p.y - r + 4, { color: Math.abs(b) > 1 ? theme.danger : theme.muted, size: 12 })
                }
              }
              if (!nodes.length) text(ctx, 'Empty tree: insert a key to start.', W / 2, H / 2, { color: theme.muted, size: 15, align: 'center', mono: false })
            }}
          />
          <p className="sim-mono" aria-live="polite" style={{ margin: 0 }}>
            {message}
          </p>
          {order && (
            <div className="sim-field">
              <span className="sim-label">{order.name} order</span>
              <div className="sim-cells">
                {order.keys.map((k, i) => (
                  <span key={i} className={i === order.at - 1 ? 'on' : i >= order.at ? 'dim' : ''}>
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Readout
            items={[
              ['Size', info.size],
              ['Height', info.size ? info.height : '—'],
              ['Best possible height', info.size ? Math.floor(Math.log2(info.size)) : '—'],
              ['Balanced?', info.balanced ? 'yes' : 'no'],
              ['Comparisons', info.compares],
            ]}
          />
        </>
      }
    >
      <PlayBar
        running={running}
        setRunning={setRunning}
        onStep={step}
        onReset={() => {
          tree.current = emptyTree()
          queue.current = []
          cur.current = null
          marks.current.clear()
          pos.current.clear()
          setOrder(null)
          setMessage('Cleared. Insert some keys.')
          publish()
        }}
        resetLabel="Clear"
      />
      <div className="sim-field">
        <label className="sim-label" htmlFor={inputId}>
          Key <span className="sim-val">0–999, or click a node</span>
        </label>
        <input
          id={inputId}
          type="number"
          className="sim-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            const k = e.key === 'Enter' ? keyFromDraft() : null
            if (k !== null) enqueue(opInsert(k))
          }}
        />
      </div>
      <div className="row sim-bar">
        <button type="button" className="btn primary" onClick={() => { const k = keyFromDraft(); if (k !== null) enqueue(opInsert(k)) }}>
          Insert
        </button>
        <button type="button" className="btn" onClick={() => { const k = keyFromDraft(); if (k !== null) enqueue({ label: `Delete ${k}`, make: (t) => remove(t, k, avl) }) }}>
          Delete
        </button>
        <button type="button" className="btn" onClick={() => { const k = keyFromDraft(); if (k !== null) enqueue({ label: `Find ${k}`, make: (t) => search(t, k) }) }}>
          Find
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const have = new Set(inorder(tree.current).map((n) => n.key))
            const keys: number[] = []
            while (keys.length < 10 && have.size + keys.length < 99) {
              const k = 1 + Math.floor(Math.random() * 99)
              if (!have.has(k) && !keys.includes(k)) keys.push(k)
            }
            enqueue(...keys.map(opInsert))
          }}
        >
          Random ×10
        </button>
      </div>
      <Toggle
        label="AVL balancing"
        checked={avl}
        onChange={(v) => {
          setAvl(v)
          if (v && !isBalanced(tree.current)) {
            tree.current = rebuildAvl(tree.current)
            setMessage('Rebuilt as an AVL tree. New inserts and deletes rotate to stay balanced.')
            publish()
          }
        }}
      />
      <div className="sim-field">
        <span className="sim-label">Traversals</span>
        <div className="row sim-bar">
          <button type="button" className="btn" onClick={() => traverse('In-order', inorder(tree.current))}>
            In-order
          </button>
          <button type="button" className="btn" onClick={() => traverse('Pre-order', preorder(tree.current))}>
            Pre-order
          </button>
          <button type="button" className="btn" onClick={() => traverse('Post-order', postorder(tree.current))}>
            Post-order
          </button>
          <button type="button" className="btn" onClick={() => traverse('Level-order', levelorder(tree.current))}>
            Level-order
          </button>
        </div>
      </div>
      <Slider label="Step time" value={delay} min={0.1} max={1.5} step={0.05} unit=" s" onChange={setDelay} />
      <Hint>Every key in a left subtree is smaller and every key on the right is larger, so a search follows one path down. Insert 10, 20, 30, 40 in a row to see a plain BST degrade into a list, then switch on AVL and watch the rotations.</Hint>
    </SimLayout>
  )
}
