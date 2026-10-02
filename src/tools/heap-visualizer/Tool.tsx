import { useId, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { lerp } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { heapHeight, heapSort, heapify, pop, push, type HeapKind, type HeapStep } from './heap'

const W = 800
const H = 520
const MAX = 31
const TREE_TOP = 46
const LEVEL = 64
const ARRAY_Y = 430
const SORTED = '#2f9e44'
const FOCUS = '#ae3ec9'

interface Pos {
  tx: number
  ty: number
  ax: number
  ay: number
  s: number
}

interface HeapState {
  a: number[]
  ids: number[]
  size: number
  nextId: number
}

type Op = { label: string; make: () => Generator<HeapStep> }

const treeXY = (i: number): [number, number] => {
  const d = Math.floor(Math.log2(i + 1))
  const k = i - (2 ** d - 1)
  return [20 + ((W - 40) * (k + 0.5)) / 2 ** d, TREE_TOP + d * LEVEL]
}

function starter(): HeapState {
  const a = [3, 9, 5, 14, 11, 8, 7, 20, 17, 12]
  return { a, ids: a.map((_, i) => i + 1), size: a.length, nextId: a.length + 1 }
}

export default function HeapVisualizer() {
  const theme = useTheme()
  const inputId = useId()
  const [running, setRunning] = useRunning()
  const [kind, setKind] = useState<HeapKind>('min')
  const [delay, setDelay] = useState(0.5)
  const [draft, setDraft] = useState('4')
  const [message, setMessage] = useState('A min-heap: every parent is smaller than its children.')
  const [info, setInfo] = useState({ size: 10, top: 3 as number | null, compares: 0, swaps: 0 })
  const heap = useRef<HeapState>(starter())
  const pos = useRef(new Map<number, Pos>())
  const queue = useRef<Op[]>([])
  const cur = useRef<Generator<HeapStep> | null>(null)
  const timer = useRef(0)
  const marks = useRef<{ compare: number[]; swap: number[]; focus: number }>({ compare: [], swap: [], focus: -1 })
  const ghosts = useRef<{ v: number; x: number; y: number; t: number }[]>([])
  const cost = useRef({ compares: 0, swaps: 0 })

  function publish() {
    const h = heap.current
    setInfo({ size: h.size, top: h.size ? h.a[0] : null, compares: cost.current.compares, swaps: cost.current.swaps })
  }

  function enqueue(op: Op) {
    queue.current.push(op)
    setRunning(true)
  }

  /** After a heap sort, the sorted tail is dropped before the next operation. */
  function dropSorted() {
    const h = heap.current
    for (let i = h.size; i < h.a.length; i++) pos.current.delete(h.ids[i])
    h.a.length = h.size
    h.ids.length = h.size
  }

  function step(): boolean {
    const h = heap.current
    const m = marks.current
    if (!cur.current) {
      const op = queue.current.shift()
      if (!op) return false
      cost.current = { compares: 0, swaps: 0 }
      cur.current = op.make()
      setMessage(op.label + '…')
    }
    const r = cur.current.next()
    m.compare = []
    m.swap = []
    if (r.done) {
      cur.current = null
      m.focus = -1
      timer.current = -0.3
      publish()
      return true
    }
    const s = r.value
    const v = (i: number) => h.a[i]
    if (s.kind === 'compare') {
      cost.current.compares++
      m.compare = [h.ids[s.i], h.ids[s.j]]
      const [x, y] = [v(s.i), v(s.j)]
      setMessage(`Compare ${x} (index ${s.i}) with ${y} (index ${s.j})`)
    } else if (s.kind === 'swap') {
      cost.current.swaps++
      ;[h.ids[s.i], h.ids[s.j]] = [h.ids[s.j], h.ids[s.i]]
      m.swap = [h.ids[s.i], h.ids[s.j]]
      setMessage(`Swap ${v(s.j)} and ${v(s.i)}`)
    } else if (s.kind === 'append') {
      const id = h.nextId++
      h.ids.push(id)
      h.size = h.a.length
      const [tx, ty] = treeXY(s.i)
      pos.current.set(id, { tx, ty, ax: W / 2, ay: ARRAY_Y, s: 0 })
      m.swap = [id]
      setMessage(`Add ${s.v} at the end (index ${s.i}), then sift it up`)
    } else if (s.kind === 'remove') {
      const id = h.ids.pop()!
      const p = pos.current.get(id)
      if (p) ghosts.current.push({ v: s.v, x: p.tx, y: p.ty, t: 0 })
      pos.current.delete(id)
      h.size = h.a.length
      setMessage(`Took ${s.v} off the top; the last item moved to the root and sifts down`)
    } else if (s.kind === 'focus') {
      m.focus = h.ids[s.i]
      setMessage(`Sift down from index ${s.i} (${v(s.i)})`)
    } else if (s.kind === 'sorted') {
      h.size = s.i
      setMessage(`${v(s.i)} is in its final sorted place`)
    }
    publish()
    return true
  }

  function clearAll() {
    heap.current = { a: [], ids: [], size: 0, nextId: heap.current.nextId }
    queue.current = []
    cur.current = null
    pos.current.clear()
    marks.current = { compare: [], swap: [], focus: -1 }
    cost.current = { compares: 0, swaps: 0 }
    setMessage('Empty heap. Push some values.')
    publish()
  }

  function pushValue(value: number) {
    enqueue({
      label: `Push ${value}`,
      make: () => {
        dropSorted()
        if (heap.current.a.length >= MAX) {
          setMessage(`The heap is full (${MAX} items).`)
          return (function* () {})()
        }
        return push(heap.current.a, value, kind)
      },
    })
  }

  function randomHeap(k: HeapKind) {
    enqueue({
      label: 'Heapify (bottom-up)',
      make: () => {
        const h = heap.current
        for (const id of h.ids) pos.current.delete(id)
        h.a = Array.from({ length: 15 }, () => 1 + Math.floor(Math.random() * 99))
        h.ids = h.a.map(() => h.nextId++)
        h.size = h.a.length
        return heapify(h.a, k)
      },
    })
  }

  const h = heap.current
  const levels = heapHeight(info.size)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-flat"
            label={`A ${kind}-heap with ${info.size} items shown as a tree and as an array. ${message}`}
            onFrame={(ctx, f) => {
              if (f.running) {
                timer.current += f.dt
                if (timer.current >= delay) {
                  timer.current = 0
                  if (!step() && !cur.current) {
                    marks.current = { compare: [], swap: [], focus: -1 }
                    setRunning(false)
                  }
                }
              }
              const hs = heap.current
              const n = hs.a.length
              const cw = Math.min(46, (W - 40) / Math.max(n, 1))
              const x0 = (W - cw * n) / 2
              hs.ids.forEach((id, i) => {
                const p = pos.current.get(id)
                const [tx, ty] = i < hs.size ? treeXY(i) : [p?.tx ?? W / 2, p?.ty ?? TREE_TOP]
                const ax = x0 + i * cw + cw / 2
                if (!p) pos.current.set(id, { tx, ty, ax, ay: ARRAY_Y, s: 1 })
                else {
                  p.tx = lerp(p.tx, tx, 0.16)
                  p.ty = lerp(p.ty, ty, 0.16)
                  p.ax = lerp(p.ax, ax, 0.16)
                  p.s = lerp(p.s, 1, 0.15)
                }
              })

              clear(ctx, W, H, theme.surface)
              text(ctx, `${kind === 'min' ? 'Min' : 'Max'}-heap as a tree`, 16, 20, { color: theme.muted, size: 12, weight: 600 })
              text(ctx, 'The same heap as an array: children of i live at 2i+1 and 2i+2', 16, ARRAY_Y - 34, { color: theme.muted, size: 12, weight: 600 })
              const m = marks.current
              const P = (i: number) => pos.current.get(hs.ids[i])
              for (let i = 1; i < hs.size; i++) {
                const a = P((i - 1) >> 1)
                const b = P(i)
                if (a && b) line(ctx, a.tx, a.ty, b.tx, b.ty, alpha(theme.muted, 0.55), 2)
              }
              // Faint links between the tree node and its array cell for the items being worked on.
              for (const id of [...m.compare, ...m.swap]) {
                const p = pos.current.get(id)
                if (p && hs.ids.indexOf(id) < hs.size) line(ctx, p.tx, p.ty + 18, p.ax, p.ay - 18, alpha(theme.accent, 0.35), 1.5, [4, 4])
              }
              const color = (id: number, i: number) => (m.swap.includes(id) ? theme.accent : i >= hs.size ? SORTED : null)
              hs.ids.forEach((id, i) => {
                const p = pos.current.get(id)
                if (!p) return
                const fill = color(id, i)
                const ring = m.compare.includes(id) ? theme.accent : id === m.focus ? FOCUS : null
                if (i < hs.size) {
                  const r = 18 * p.s
                  circle(ctx, p.tx, p.ty, r, fill ?? theme.sunken, ring ?? theme.border, ring ? 3.5 : 2)
                  if (p.s > 0.5) text(ctx, String(hs.a[i]), p.tx, p.ty + 1, { color: fill ? '#fff' : theme.text, size: 14, weight: 700, align: 'center', baseline: 'middle' })
                }
                const s = p.s
                rrect(ctx, p.ax - (cw / 2 - 2) * s, p.ay - 16 * s, (cw - 4) * s, 32 * s, 5, fill ?? theme.sunken, ring ?? theme.border, ring ? 3 : 1)
                if (s > 0.5) text(ctx, String(hs.a[i]), p.ax, p.ay + 1, { color: fill ? '#fff' : theme.text, size: cw > 30 ? 14 : 12, weight: 700, align: 'center', baseline: 'middle' })
              })
              for (let i = 0; i < n; i++) text(ctx, String(i), x0 + i * cw + cw / 2, ARRAY_Y + 32, { color: theme.muted, size: 12, align: 'center' })
              ghosts.current = ghosts.current.filter((g) => g.t < 1)
              for (const g of ghosts.current) {
                g.t += 1 / 50
                const y = g.y - g.t * 40
                circle(ctx, g.x, y, 18, alpha(theme.accent, 1 - g.t))
                text(ctx, String(g.v), g.x, y + 1, { color: alpha('#ffffff', 1 - g.t), size: 14, weight: 700, align: 'center', baseline: 'middle' })
              }
              if (!n) text(ctx, 'Empty heap', W / 2, 200, { color: theme.muted, size: 15, align: 'center', mono: false })
            }}
          />
          <p className="sim-mono" aria-live="polite" style={{ margin: 0 }}>
            {message}
          </p>
          <Legend items={[[theme.accent, 'swapping / compared (ring)'], [FOCUS, 'heapify: current parent'], [SORTED, 'sorted (heap sort)']]} />
          <Readout
            items={[
              ['Size', info.size],
              ['Height', info.size ? levels : '—'],
              [kind === 'min' ? 'Minimum (top)' : 'Maximum (top)', info.top ?? '—'],
              ['Last op compares', info.compares],
              ['Last op swaps', info.swaps],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onStep={step} onReset={clearAll} resetLabel="Clear" />
      <Choice
        label="Heap type"
        value={kind}
        options={[['min', 'Min-heap'], ['max', 'Max-heap']]}
        onChange={(k) => {
          setKind(k)
          enqueue({
            label: `Re-heapify as a ${k}-heap`,
            make: () => {
              dropSorted()
              return heapify(heap.current.a, k)
            },
          })
        }}
      />
      <div className="sim-field">
        <label className="sim-label" htmlFor={inputId}>
          Value <span className="sim-val">{h.a.length}/{MAX} items</span>
        </label>
        <input
          id={inputId}
          type="number"
          className="sim-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim() !== '' && Number.isFinite(Number(draft))) pushValue(Math.round(Number(draft)))
          }}
        />
      </div>
      <div className="row sim-bar">
        <button type="button" className="btn primary" disabled={draft.trim() === '' || !Number.isFinite(Number(draft))} onClick={() => pushValue(Math.round(Number(draft)))}>
          Push
        </button>
        <button type="button" className="btn" onClick={() => pushValue(1 + Math.floor(Math.random() * 99))}>
          Push random
        </button>
        <button type="button" className="btn" onClick={() => enqueue({ label: 'Pop the top', make: () => (dropSorted(), pop(heap.current.a, kind)) })}>
          Pop top
        </button>
      </div>
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={() => randomHeap(kind)}>
          Heapify random
        </button>
        <button type="button" className="btn" onClick={() => enqueue({ label: 'Heap sort', make: () => (dropSorted(), heapSort(heap.current.a, kind)) })}>
          Heap sort
        </button>
      </div>
      <Slider label="Step time" value={delay} min={0.1} max={1.5} step={0.05} unit=" s" onChange={setDelay} />
      <Hint>Push adds at the end of the array and sifts the value up; Pop moves the last item to the root and sifts it down. Both touch one path, so they cost O(log n). Watch the tree and the array swap in step.</Hint>
    </SimLayout>
  )
}
