import { useId, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, rrect, text } from '../../sim/draw'
import { TAU, clamp } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { reducedMotion } from '../../motion/springs'
import { BoundedStack, CircularDeque, bracketSteps, maxDepth, type BracketStep } from './structures'

const W = 800
const H = 480
// Stack column.
const SX = 60
const SW = 150
const SB = 440
const STOP = 120
// Queue lane and ring.
const QX = 290
const QW = 490
const QY = 270
const CX = 535
const CY = 290
const R1 = 70
const R2 = 134

type Mode = 'queue' | 'ring' | 'deque'

interface Item {
  label: string
  color: string
  x: number
  y: number
  vx: number
  vy: number
  tx: number
  ty: number
  w: number
  h: number
  a: number
  ta: number
  flash: number
  src: number
}

const BRACKET_COLOR: Record<string, string> = { '(': PALETTE[1], '[': PALETTE[2], '{': PALETTE[3] }

function makeItem(label: string, x: number, y: number, color: string, src = -1): Item {
  return { label, color, x, y, vx: 0, vy: 0, tx: x, ty: y, w: 40, h: 40, a: 0, ta: 1, flash: 0, src }
}

interface Demo {
  expr: string
  gen: Generator<BracketStep>
  step: BracketStep | null
  marks: Map<number, 'ok' | 'bad'>
  done: boolean
}

export default function StackQueue() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [mode, setMode] = useState<Mode>('queue')
  const [cap, setCap] = useState(8)
  const [value, setValue] = useState('')
  const [expr, setExpr] = useState('{[(a+b)*c]-(d/e)}')
  const [demoSpeed, setDemoSpeed] = useState(2)
  const [, setVersion] = useState(0)
  const valueId = useId()
  const exprId = useId()
  const stack = useRef(new BoundedStack<Item>(8))
  const queue = useRef(new CircularDeque<Item>(8))
  const leaving = useRef<Item[]>([])
  const shake = useRef({ stack: 0, queue: 0 })
  const toast = useRef({ msg: '', color: '', t: 0 })
  const demo = useRef<Demo | null>(null)
  const clock = useRef({ last: 0, acc: 0 })
  const bump = () => setVersion((v) => v + 1)

  function say(msg: string, color = theme.text) {
    toast.current = { msg, color, t: 2.2 }
  }

  function nextLabel() {
    const v = value.trim()
    return v ? v.slice(0, 3) : String(1 + Math.floor(Math.random() * 99))
  }

  function colorOf(label: string) {
    let h = 0
    for (const c of label) h = (h * 31 + c.charCodeAt(0)) >>> 0
    return PALETTE[h % PALETTE.length]
  }

  function charPos(i: number, e: string) {
    const cw = Math.min(22, (W - 80) / Math.max(1, e.length))
    return { x: W / 2 - (e.length * cw) / 2 + (i + 0.5) * cw, y: 42, cw }
  }

  function leave(it: Item, x: number, y: number) {
    it.tx = x
    it.ty = y
    it.ta = 0
    leaving.current.push(it)
  }

  function resize(n: number) {
    setCap(n)
    const s = new BoundedStack<Item>(n)
    stack.current.items.forEach((it) => s.push(it) || leave(it, SX + SW / 2, -40))
    stack.current = s
    const q = new CircularDeque<Item>(n)
    queue.current.toArray().forEach((it) => q.pushBack(it) || leave(it, W + 40, QY))
    queue.current = q
    bump()
  }

  // Stack operations.
  function push() {
    const label = nextLabel()
    const it = makeItem(label, SX + SW / 2, 70, colorOf(label))
    if (!stack.current.push(it)) {
      shake.current.stack = 0.45
      return say('Stack overflow: it is full', theme.danger)
    }
    say(`push ${label}`)
    bump()
  }
  function pop() {
    const it = stack.current.pop()
    if (!it) {
      shake.current.stack = 0.45
      return say('Stack underflow: nothing to pop', theme.danger)
    }
    leave(it, SX + SW / 2, 40)
    say(`pop → ${it.label}`)
    bump()
  }
  function peek() {
    const it = stack.current.peek()
    if (!it) {
      shake.current.stack = 0.45
      return say('Stack is empty: nothing on top', theme.danger)
    }
    it.flash = 1
    say(`peek → ${it.label} (stays on the stack)`)
  }

  // Queue / deque operations.
  function add(front: boolean) {
    const label = nextLabel()
    const start = mode === 'ring' ? { x: CX, y: CY } : front ? { x: QX - 30, y: QY } : { x: W + 30, y: QY }
    const it = makeItem(label, start.x, start.y, colorOf(label))
    const ok = front ? queue.current.pushFront(it) : queue.current.pushBack(it)
    if (!ok) {
      shake.current.queue = 0.45
      return say(mode === 'deque' ? 'Deque is full' : 'Queue overflow: it is full', theme.danger)
    }
    say(`${mode === 'deque' ? (front ? 'push front' : 'push back') : 'enqueue'} ${label}`)
    bump()
  }
  function remove(front: boolean) {
    const q = queue.current
    const s = front ? q.head : q.slot(q.size - 1)
    const it = front ? q.popFront() : q.popBack()
    if (!it) {
      shake.current.queue = 0.45
      return say(mode === 'deque' ? 'Deque is empty' : 'Queue underflow: nothing to dequeue', theme.danger)
    }
    if (mode === 'ring') {
      const ang = -Math.PI / 2 + ((s + 0.5) * TAU) / q.capacity
      leave(it, CX + Math.cos(ang) * (R2 + 60), CY + Math.sin(ang) * (R2 + 60))
    } else leave(it, front ? QX - 40 : W + 40, QY)
    say(`${mode === 'deque' ? (front ? 'pop front' : 'pop back') : 'dequeue'} → ${it.label}`)
    bump()
  }
  function peekQueue() {
    const it = queue.current.peekFront()
    if (!it) {
      shake.current.queue = 0.45
      return say('Queue is empty', theme.danger)
    }
    it.flash = 1
    say(`front → ${it.label}`)
  }

  function reset() {
    for (const it of stack.current.items) leave(it, SX + SW / 2, -40)
    for (const it of queue.current.toArray()) leave(it, W + 40, QY)
    stack.current = new BoundedStack<Item>(cap)
    queue.current = new CircularDeque<Item>(cap)
    demo.current = null
    bump()
  }

  function startDemo(run = true) {
    const e = expr.slice(0, 40)
    for (const it of stack.current.items) leave(it, SX + SW / 2, -40)
    stack.current = new BoundedStack<Item>(clamp(Math.max(cap, maxDepth(e)), 3, 16))
    demo.current = { expr: e, gen: bracketSteps(e), step: null, marks: new Map(), done: false }
    clock.current.acc = 0.6
    if (run) setRunning(true)
    bump()
  }

  function step() {
    if (!demo.current || demo.current.done) startDemo(false)
    advance()
  }

  function advance() {
    const d = demo.current
    if (!d || d.done) return
    const r = d.gen.next()
    if (r.done) {
      d.done = true
      return
    }
    const s = r.value
    d.step = s
    const p = charPos(s.i, d.expr)
    if (s.action === 'push') {
      const ch = d.expr[s.i]
      const it = makeItem(ch, p.x, p.y + 20, BRACKET_COLOR[ch], s.i)
      it.a = 1
      if (!stack.current.push(it)) {
        shake.current.stack = 0.45
        d.done = true
        say('Stack overflow', theme.danger)
      }
    } else if (s.action === 'pop' || s.action === 'mismatch') {
      const it = stack.current.pop()
      if (it) leave(it, p.x, p.y + 10)
      const mark = s.action === 'pop' ? 'ok' : 'bad'
      d.marks.set(s.i, mark)
      if (s.partner !== undefined) d.marks.set(s.partner, mark)
      if (s.action === 'mismatch') shake.current.stack = 0.45
    } else if (s.action === 'extra-close') {
      d.marks.set(s.i, 'bad')
      shake.current.stack = 0.45
    } else if (s.action === 'unclosed') {
      for (const it of stack.current.items) {
        d.marks.set(it.src, 'bad')
        it.flash = 1
      }
    }
    if (s.action !== 'skip' && s.action !== 'push' && s.action !== 'pop') d.done = true
    bump()
  }

  function layout(dt: number) {
    const st = stack.current
    const sh = Math.min(46, (SB - STOP) / st.capacity)
    st.items.forEach((it, i) => {
      it.tx = SX + SW / 2
      it.ty = SB - (i + 0.5) * sh
      it.w = SW - 18
      it.h = sh - 6
    })
    const q = queue.current
    const qw = Math.min(62, QW / q.capacity)
    const q0 = QX + (QW - qw * q.capacity) / 2
    for (let i = 0; i < q.size; i++) {
      const it = q.at(i)!
      if (mode === 'ring') {
        const ang = -Math.PI / 2 + ((q.slot(i) + 0.5) * TAU) / q.capacity
        const rm = (R1 + R2) / 2
        it.tx = CX + Math.cos(ang) * rm
        it.ty = CY + Math.sin(ang) * rm
        const s = Math.min(46, rm * Math.sin(Math.PI / q.capacity) * 1.3)
        it.w = s
        it.h = s
      } else {
        it.tx = q0 + (i + 0.5) * qw
        it.ty = QY
        it.w = qw - 8
        it.h = 50
      }
    }
    const snap = reducedMotion()
    const all = [...st.items, ...q.toArray(), ...leaving.current]
    const sub = Math.ceil(dt / (1 / 120))
    for (const it of all) {
      if (snap) {
        it.x = it.tx
        it.y = it.ty
        it.a = it.ta
        continue
      }
      for (let k = 0; k < sub; k++) {
        const h = dt / sub
        it.vx += (230 * (it.tx - it.x) - 19 * it.vx) * h
        it.vy += (230 * (it.ty - it.y) - 19 * it.vy) * h
        it.x += it.vx * h
        it.y += it.vy * h
      }
      it.a += (it.ta - it.a) * Math.min(1, dt * (it.ta ? 8 : 4))
      it.flash = Math.max(0, it.flash - dt * 0.9)
    }
    leaving.current = leaving.current.filter((it) => it.a > 0.02)
  }

  function drawItem(ctx: CanvasRenderingContext2D, it: Item, dx: number) {
    ctx.globalAlpha = clamp(it.a, 0, 1)
    const pulse = it.flash > 0 ? 1 + Math.sin(it.flash * 18) * 0.08 * it.flash : 1
    const w = it.w * pulse
    const h = it.h * pulse
    rrect(ctx, it.x + dx - w / 2, it.y - h / 2, w, h, 7, alpha(it.color, 0.9), it.flash > 0 ? theme.text : alpha(theme.text, 0.25), it.flash > 0 ? 3 : 1)
    text(ctx, it.label, it.x + dx, it.y + 1, { color: '#fff', size: Math.min(18, Math.max(12, h * 0.45)), align: 'center', baseline: 'middle', weight: 700 })
    ctx.globalAlpha = 1
  }

  const st = stack.current
  const q = queue.current
  const d = demo.current

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            label={`A stack holding ${st.size} items and a ${mode === 'ring' ? 'circular queue' : mode} holding ${q.size} of ${q.capacity} items.`}
            onFrame={(ctx, f) => {
              const now = performance.now()
              const dt = clock.current.last ? Math.min(0.05, (now - clock.current.last) / 1000) : 0
              clock.current.last = now
              const dm = demo.current
              if (dm && !dm.done && f.running) {
                clock.current.acc += dt * demoSpeed
                while (clock.current.acc >= 1 && !dm.done) {
                  clock.current.acc -= 1
                  advance()
                  if (dm.step?.action === 'skip') clock.current.acc += 0.6
                }
              }
              layout(dt)
              const sh = shake.current
              sh.stack = Math.max(0, sh.stack - dt)
              sh.queue = Math.max(0, sh.queue - dt)
              const sdx = Math.sin(f.frame * 1.9) * 9 * (sh.stack / 0.45)
              const qdx = Math.sin(f.frame * 1.9) * 9 * (sh.queue / 0.45)

              clear(ctx, W, H, theme.sunken)
              // Stack: an open-topped column.
              const s = stack.current
              const cellH = Math.min(46, (SB - STOP) / s.capacity)
              const top = SB - cellH * s.capacity
              for (let i = 0; i < s.capacity; i++) rrect(ctx, SX + sdx + 6, SB - (i + 1) * cellH + 2, SW - 12, cellH - 4, 6, alpha(theme.text, 0.035))
              ctx.beginPath()
              ctx.moveTo(SX + sdx, top - 8)
              ctx.lineTo(SX + sdx, SB + 4)
              ctx.lineTo(SX + sdx + SW, SB + 4)
              ctx.lineTo(SX + sdx + SW, top - 8)
              ctx.strokeStyle = sh.stack > 0 ? theme.danger : theme.text
              ctx.lineWidth = 3
              ctx.lineJoin = 'round'
              ctx.stroke()
              text(ctx, 'STACK · LIFO', SX + SW / 2, SB + 28, { color: theme.muted, size: 13, align: 'center', weight: 700 })
              if (!dm) text(ctx, 'push ↓   ↑ pop', SX + SW / 2, top - 22, { color: theme.muted, size: 13, align: 'center' })
              for (const it of s.items) drawItem(ctx, it, sdx)
              if (s.size) {
                const ty = SB - (s.size - 0.5) * cellH
                arrow(ctx, SX + SW + 58 + sdx, ty, SX + SW + 8 + sdx, ty, theme.accent, 2)
                text(ctx, 'top', SX + SW + 62 + sdx, ty + 4, { color: theme.accent, size: 13, weight: 700 })
              }

              // Queue: a lane, a ring buffer, or a lane open at both ends.
              const qq = queue.current
              const label = mode === 'deque' ? 'DEQUE · both ends' : mode === 'ring' ? 'CIRCULAR QUEUE · ring buffer' : 'QUEUE · FIFO'
              text(ctx, label, QX + QW / 2, SB + 28, { color: theme.muted, size: 13, align: 'center', weight: 700 })
              if (mode === 'ring') {
                for (let j = 0; j < qq.capacity; j++) {
                  const a0 = -Math.PI / 2 + (j * TAU) / qq.capacity
                  const a1 = a0 + TAU / qq.capacity
                  ctx.beginPath()
                  ctx.arc(CX + qdx, CY, R2, a0 + 0.02, a1 - 0.02)
                  ctx.arc(CX + qdx, CY, R1, a1 - 0.02, a0 + 0.02, true)
                  ctx.closePath()
                  ctx.fillStyle = qq.buf[j] ? alpha(theme.text, 0.07) : alpha(theme.text, 0.03)
                  ctx.fill()
                  ctx.strokeStyle = sh.queue > 0 ? theme.danger : alpha(theme.text, 0.3)
                  ctx.lineWidth = 1.5
                  ctx.stroke()
                  const am = (a0 + a1) / 2
                  text(ctx, String(j), CX + qdx + Math.cos(am) * (R2 + 16), CY + Math.sin(am) * (R2 + 16), { color: theme.muted, size: 12, align: 'center', baseline: 'middle' })
                }
                const pointer = (slot: number, name: string, color: string, r: number) => {
                  const am = -Math.PI / 2 + ((slot + 0.5) * TAU) / qq.capacity
                  arrow(ctx, CX + qdx, CY, CX + qdx + Math.cos(am) * r, CY + Math.sin(am) * r, color, 2.5)
                  text(ctx, name, CX + qdx + Math.cos(am) * (r * 0.5) + 6, CY + Math.sin(am) * (r * 0.5) - 6, { color, size: 13, weight: 700 })
                }
                circle(ctx, CX + qdx, CY, 5, theme.text)
                pointer(qq.head, 'head', theme.accent, R1 - 6)
                pointer(qq.tail, 'tail', PALETTE[1], R1 - 20)
              } else {
                const qw = Math.min(62, QW / qq.capacity)
                const q0 = QX + (QW - qw * qq.capacity) / 2 + qdx
                for (let i = 0; i < qq.capacity; i++) rrect(ctx, q0 + i * qw + 3, QY - 29, qw - 6, 58, 6, alpha(theme.text, 0.035))
                line(ctx, q0 - 4, QY - 34, q0 + qw * qq.capacity + 4, QY - 34, sh.queue > 0 ? theme.danger : theme.text, 3)
                line(ctx, q0 - 4, QY + 34, q0 + qw * qq.capacity + 4, QY + 34, sh.queue > 0 ? theme.danger : theme.text, 3)
                const inR = mode === 'deque' ? 'push/pop back ⇄' : '← enqueue'
                const outL = mode === 'deque' ? '⇄ push/pop front' : '← dequeue'
                text(ctx, outL, q0, QY - 48, { color: theme.muted, size: 13 })
                text(ctx, inR, q0 + qw * qq.capacity, QY - 48, { color: theme.muted, size: 13, align: 'right' })
                if (qq.size) {
                  const fx = q0 + qw / 2
                  const bx = q0 + (qq.size - 0.5) * qw
                  arrow(ctx, fx, QY + 76, fx, QY + 40, theme.accent, 2)
                  text(ctx, 'front', fx, QY + 94, { color: theme.accent, size: 13, align: 'center', weight: 700 })
                  arrow(ctx, bx, QY + (qq.size === 1 ? 118 : 76), bx, QY + 40, PALETTE[1], 2)
                  text(ctx, mode === 'deque' ? 'back' : 'rear', bx, QY + (qq.size === 1 ? 136 : 94), { color: PALETTE[1], size: 13, align: 'center', weight: 700 })
                }
              }
              for (const it of qq.toArray()) drawItem(ctx, it, qdx)
              for (const it of leaving.current) drawItem(ctx, it, 0)

              // Bracket-matching demo: the expression with the read head.
              if (dm) {
                const e = dm.expr
                for (let i = 0; i < e.length; i++) {
                  const p = charPos(i, e)
                  const cur = dm.step?.i === i
                  if (cur) rrect(ctx, p.x - p.cw / 2, p.y - 16, p.cw, 30, 5, alpha(theme.accent, 0.2), theme.accent, 1.5)
                  const m = dm.marks.get(i)
                  const past = dm.step ? i < dm.step.i : false
                  const color = m === 'ok' ? theme.ok : m === 'bad' ? theme.danger : past ? theme.muted : theme.text
                  text(ctx, e[i], p.x, p.y, { color, size: 18, align: 'center', baseline: 'middle', weight: m ? 800 : 500 })
                }
                const act = dm.step?.action
                const verdict = act === 'balanced' ? theme.ok : act === 'mismatch' || act === 'extra-close' || act === 'unclosed' ? theme.danger : theme.muted
                if (dm.step) text(ctx, dm.step.message, W / 2, 80, { color: verdict, size: 14, align: 'center', weight: verdict === theme.muted ? 500 : 700 })
              }
              const t = toast.current
              if (t.t > 0) {
                t.t -= dt
                ctx.globalAlpha = clamp(t.t, 0, 1)
                text(ctx, t.msg, dm ? QX + QW / 2 : W / 2, dm ? 108 : 34, { color: t.color, size: 15, align: 'center', weight: 700 })
                ctx.globalAlpha = 1
              }
            }}
          />
          <Readout
            items={[
              ['Stack size', `${st.size} / ${st.capacity}`],
              ['Top', st.peek()?.label ?? '—'],
              [mode === 'deque' ? 'Deque size' : 'Queue size', `${q.size} / ${q.capacity}`],
              ['Front', q.peekFront()?.label ?? '—'],
              [mode === 'deque' ? 'Back' : 'Rear', q.peekBack()?.label ?? '—'],
              ...(mode === 'ring' ? ([['Head · tail', `${q.head} · ${q.tail}`]] as const) : []),
              ...(d ? ([['Brackets', d.done ? (d.step?.action === 'balanced' ? 'balanced' : 'unbalanced') : 'checking…']] as const) : []),
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onStep={step} onReset={reset} resetLabel="Clear" />
      <div className="sim-field">
        <label className="sim-label" htmlFor={valueId}>
          Value <span className="sim-val">empty = random</span>
        </label>
        <input id={valueId} type="text" className="sim-text" maxLength={3} value={value} placeholder="random" onChange={(e) => setValue(e.target.value)} />
      </div>
      <div className="sim-field">
        <span className="sim-label">Stack</span>
        <div className="row sim-bar">
          <button type="button" className="btn" onClick={push}>Push</button>
          <button type="button" className="btn" onClick={pop}>Pop</button>
          <button type="button" className="btn" onClick={peek}>Peek</button>
        </div>
      </div>
      <Choice label="Right side" value={mode} options={[['queue', 'Queue'], ['ring', 'Ring buffer'], ['deque', 'Deque']]} onChange={setMode} />
      <div className="row sim-bar">
        {mode === 'deque' ? (
          <>
            <button type="button" className="btn" onClick={() => add(true)}>Push front</button>
            <button type="button" className="btn" onClick={() => add(false)}>Push back</button>
            <button type="button" className="btn" onClick={() => remove(true)}>Pop front</button>
            <button type="button" className="btn" onClick={() => remove(false)}>Pop back</button>
          </>
        ) : (
          <>
            <button type="button" className="btn" onClick={() => add(false)}>Enqueue</button>
            <button type="button" className="btn" onClick={() => remove(true)}>Dequeue</button>
            <button type="button" className="btn" onClick={peekQueue}>Front</button>
          </>
        )}
      </div>
      <Slider label="Capacity" value={cap} min={3} max={12} onChange={resize} />
      <div className="sim-field">
        <label className="sim-label" htmlFor={exprId}>Bracket demo</label>
        <input id={exprId} type="text" className="sim-text sim-mono" maxLength={40} value={expr} onChange={(e) => setExpr(e.target.value)} />
      </div>
      <div className="row sim-bar">
        <button type="button" className="btn primary" onClick={() => startDemo()}>Run demo</button>
        <button type="button" className="btn" onClick={() => setExpr('([)]')}>Try ([)]</button>
      </div>
      <Slider label="Demo speed" value={demoSpeed} min={0.5} max={8} step={0.5} unit=" steps/s" onChange={setDemoSpeed} />
      <Hint>Leave the value empty for random numbers. Push onto a full container or pop an empty one and it shakes. The demo reads your expression left to right: opening brackets are pushed, each closing one must match the top of the stack.</Hint>
    </SimLayout>
  )
}
