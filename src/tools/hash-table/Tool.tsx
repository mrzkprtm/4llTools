import { useId, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { WORDS, build, insert, keysOf, loadFactor, remove, search, type HashFn, type HashStep, type Strategy, type Table } from './hash'

const W = 800
const H = 520
const TOP = 118
const FNS = [['sum', 'Sum of char codes'], ['djb2', 'djb2 (h × 33 + c)'], ['fnv', 'FNV-1a']] as const
const STRATS = [['chaining', 'Separate chaining'], ['linear', 'Linear probing'], ['quadratic', 'Quadratic probing'], ['double', 'Double hashing']] as const
const EMPTY = '#2f9e44'
const FOUND = '#2f9e44'

type Op = { label: string; make: (t: Table) => Generator<HashStep, unknown> }

interface View {
  hash: Extract<HashStep, { kind: 'hash' }> | null
  hashAt: number
  probe: { index: number; i: number } | null
  marks: Map<number, string>
  chainMark: { index: number; pos: number; color: string } | null
}

const emptyView = (): View => ({ hash: null, hashAt: 0, probe: null, marks: new Map(), chainMark: null })

const PROBE_TEXT: Record<Exclude<Strategy, 'chaining'>, string> = {
  linear: '(start + i) mod m',
  quadratic: '(start + i²) mod m',
  double: '(start + i × step) mod m',
}

export default function HashTable() {
  const theme = useTheme()
  const inputId = useId()
  const [running, setRunning] = useRunning()
  const [fn, setFn] = useState<HashFn>('sum')
  const [strategy, setStrategy] = useState<Strategy>('linear')
  const [buckets, setBuckets] = useState(11)
  const [maxLoad, setMaxLoad] = useState(0.7)
  const [auto, setAuto] = useState(true)
  const [delay, setDelay] = useState(0.45)
  const [draft, setDraft] = useState('mango')
  const [message, setMessage] = useState('Type a key and press Insert, Search or Delete.')
  const [, setTick] = useState(0)
  const table = useRef<Table>(build(['apple', 'grape', 'lemon', 'peach', 'kiwi'], 11, 'sum', 'linear'))
  const view = useRef<View>(emptyView())
  const queue = useRef<Op[]>([])
  const cur = useRef<Generator<HashStep, unknown> | null>(null)
  const timer = useRef(0)
  const clock = useRef(0)

  const rerender = () => setTick((k) => k + 1)

  function rebuild(m: number, f: HashFn, s: Strategy) {
    queue.current = []
    cur.current = null
    table.current = build(keysOf(table.current), m, f, s)
    view.current = emptyView()
    setMessage(`Rebuilt with ${table.current.m} buckets.`)
    rerender()
  }

  function enqueue(...ops: Op[]) {
    queue.current.push(...ops)
    setRunning(true)
  }

  function step(): boolean {
    const t = table.current
    if (!cur.current) {
      const op = queue.current.shift()
      if (!op) return false
      view.current = emptyView()
      cur.current = op.make(t)
      setMessage(op.label + '…')
    }
    const r = cur.current.next()
    if (r.done) {
      cur.current = null
      timer.current = -0.3
      rerender()
      return true
    }
    const s = r.value
    const vv = view.current
    if (s.kind === 'hash') {
      vv.hash = s
      vv.hashAt = clock.current
      vv.probe = null
      vv.marks = new Map()
      vv.chainMark = null
      setMessage(`hash("${s.key}") = ${s.h}, and ${s.h} mod ${t.m} = ${s.index}`)
    } else if (s.kind === 'probe') {
      vv.probe = { index: s.index, i: s.i }
      const color = s.state === 'empty' ? EMPTY : s.state === 'match' ? FOUND : s.state === 'tomb' ? theme.muted : theme.danger
      vv.marks.set(s.index, color)
      setMessage(`Probe ${s.i}: slot ${s.index} is ${s.state === 'empty' ? 'empty' : s.state === 'tomb' ? 'a tombstone, keep looking' : s.state === 'match' ? 'the key' : `taken by "${t.slots[s.index]}", a collision`}`)
    } else if (s.kind === 'chain') {
      vv.marks.set(s.index, theme.accent)
      vv.chainMark = { index: s.index, pos: s.pos, color: s.match ? FOUND : theme.danger }
      setMessage(`Bucket ${s.index}, item ${s.pos + 1}: "${t.chains[s.index][s.pos]}" ${s.match ? 'matches' : 'is a different key'}`)
    } else if (s.kind === 'place') {
      vv.marks.set(s.index, theme.accent)
      vv.chainMark = t.strategy === 'chaining' ? { index: s.index, pos: s.pos, color: theme.accent } : null
      setMessage(`Stored "${s.key}" in ${t.strategy === 'chaining' ? `bucket ${s.index}` : `slot ${s.index}`}`)
    } else if (s.kind === 'found') {
      vv.marks.set(s.index, FOUND)
      if (t.strategy === 'chaining') vv.chainMark = { index: s.index, pos: s.pos, color: FOUND }
      setMessage(`Found it in ${t.strategy === 'chaining' ? `bucket ${s.index}` : `slot ${s.index}`}`)
    } else if (s.kind === 'missing') setMessage(`"${s.key}" is not in the table`)
    else if (s.kind === 'exists') setMessage('That key is already stored; nothing to add')
    else if (s.kind === 'delete') {
      vv.marks.set(s.index, theme.muted)
      vv.chainMark = null
      setMessage(t.strategy === 'chaining' ? `Removed "${s.key}" from bucket ${s.index}` : `Deleted "${s.key}": slot ${s.index} becomes a tombstone (†) so later probes keep going`)
    } else if (s.kind === 'resize') {
      vv.marks = new Map()
      vv.hash = null
      setMessage(`Load factor would pass ${fmt(maxLoad)}: grow from ${s.from} to ${s.to} buckets (next prime ≥ 2m) and re-insert every key`)
    }
    rerender()
    return true
  }

  function keyFromDraft(): string | null {
    const k = draft.trim().toLowerCase().slice(0, 16)
    if (!k) {
      setMessage('Type a key first.')
      return null
    }
    return k
  }

  const lim = auto ? maxLoad : Infinity
  const opInsert = (k: string): Op => ({ label: `Insert "${k}"`, make: (t) => insert(t, k, lim) })

  const t = table.current
  const longest = t.strategy === 'chaining' ? Math.max(0, ...t.chains.map((c) => c.length)) : 0
  const avg = t.inserts ? t.probes / t.inserts : 0

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-flat"
            label={`Hash table with ${t.m} buckets holding ${t.size} keys using ${t.strategy}. ${message}`}
            onFrame={(ctx, f) => {
              clock.current = f.t
              if (f.running) {
                timer.current += f.dt
                if (timer.current >= delay) {
                  timer.current = 0
                  if (!step() && !cur.current) setRunning(false)
                }
              }
              const tb = table.current
              const vw = view.current
              clear(ctx, W, H, theme.surface)

              // Table layout: up to 16 rows per column.
              const cols = Math.ceil(tb.m / 16)
              const perCol = Math.ceil(tb.m / cols)
              const rowH = Math.min(30, (H - TOP - 8) / perCol)
              const colW = (W - 20) / cols
              const rowX = (i: number) => 10 + Math.floor(i / perCol) * colW
              const rowY = (i: number) => TOP + (i % perCol) * rowH
              const bh = rowH - 5
              const chaining = tb.strategy === 'chaining'
              const nodeW = clamp(colW / 4, 40, 70)
              const fitChars = (w: number) => Math.max(2, Math.floor((w - 8) / 7.3))
              const cut = (s: string, w: number) => (s.length > fitChars(w) ? s.slice(0, fitChars(w) - 1) + '…' : s)
              for (let i = 0; i < tb.m; i++) {
                const x = rowX(i)
                const y = rowY(i)
                const mark = vw.marks.get(i)
                const isProbe = vw.probe?.index === i
                text(ctx, String(i), x + 28, y + bh / 2 + 1, { color: isProbe ? theme.accent : theme.muted, size: 12, align: 'right', baseline: 'middle', weight: isProbe ? 700 : 500 })
                if (!chaining) {
                  const w = colW - 44
                  const key = tb.slots[i]
                  rrect(ctx, x + 34, y, w, bh, 5, mark ? alpha(mark, 0.22) : key ? theme.sunken : alpha(theme.sunken, 0.4), isProbe ? theme.accent : mark ?? theme.border, isProbe ? 2.5 : 1)
                  if (key) text(ctx, cut(key, w), x + 40, y + bh / 2 + 1, { color: theme.text, size: 12, baseline: 'middle', weight: 600 })
                  else if (tb.tomb[i]) text(ctx, '† tombstone', x + 40, y + bh / 2 + 1, { color: theme.muted, size: 12, baseline: 'middle' })
                } else {
                  const chain = tb.chains[i]
                  rrect(ctx, x + 34, y, 16, bh, 4, mark ? alpha(mark, 0.35) : chain.length ? theme.sunken : alpha(theme.sunken, 0.4), mark ?? theme.border, mark ? 2 : 1)
                  const room = Math.max(1, Math.floor((colW - 60) / (nodeW + 12)))
                  chain.slice(0, room).forEach((k, p) => {
                    const nx = x + 62 + p * (nodeW + 12)
                    arrow(ctx, nx - 12, y + bh / 2, nx - 1, y + bh / 2, theme.muted, 1.5, 6)
                    const cm = vw.chainMark && vw.chainMark.index === i && vw.chainMark.pos === p ? vw.chainMark.color : null
                    rrect(ctx, nx, y, nodeW, bh, 5, cm ? alpha(cm, 0.25) : theme.sunken, cm ?? theme.border, cm ? 2.5 : 1)
                    text(ctx, cut(k, nodeW), nx + 5, y + bh / 2 + 1, { color: theme.text, size: 12, baseline: 'middle', weight: 600 })
                  })
                  if (chain.length > room) text(ctx, `+${chain.length - room}`, x + colW - 6, y + bh / 2 + 1, { color: theme.muted, size: 12, align: 'right', baseline: 'middle' })
                }
              }

              // Hash computation panel: key → number → index, then the probe formula.
              rrect(ctx, 10, 8, W - 20, TOP - 18, 10, theme.sunken, theme.border)
              const hs = vw.hash
              if (!hs) {
                text(ctx, `hash(key) mod m picks a bucket: m = ${tb.m}, load factor ${fmt(loadFactor(tb), 2)}`, 26, 38, { color: theme.muted, size: 13 })
                text(ctx, `Collisions are handled by ${STRATS.find((s) => s[0] === tb.strategy)![1].toLowerCase()}.`, 26, 64, { color: theme.muted, size: 13 })
              } else {
                const age = clamp((f.t - vw.hashAt) / Math.max(0.2, delay * 0.8), 0, 1)
                const pills: [string, string][] = [
                  [`"${hs.key}"`, 'key'],
                  [String(hs.h), FNS.find((q) => q[0] === tb.fn)![1]],
                  [`${hs.h} mod ${tb.m} = ${hs.index}`, 'start index'],
                ]
                let x = 26
                pills.forEach(([s, sub], k) => {
                  const show = clamp(age * 3 - k, 0, 1)
                  if (show <= 0) return
                  const w = Math.max(70, s.length * 8.4 + 20)
                  ctx.globalAlpha = show
                  rrect(ctx, x, 18, w, 32, 8, k === 2 ? theme.accent : theme.surface, k === 2 ? theme.accent : theme.border)
                  text(ctx, s, x + w / 2, 35, { color: k === 2 ? '#fff' : theme.text, size: 13, align: 'center', baseline: 'middle', weight: 700 })
                  text(ctx, sub, x + w / 2, 64, { color: theme.muted, size: 12, align: 'center' })
                  if (k < 2 && show >= 1) arrow(ctx, x + w + 4, 34, x + w + 26, 34, theme.muted, 2, 8)
                  ctx.globalAlpha = 1
                  x += w + 30
                })
                if (!chaining && age >= 1) {
                  const p = vw.probe
                  const formula = PROBE_TEXT[tb.strategy as Exclude<Strategy, 'chaining'>]
                  const extra = tb.strategy === 'double' ? `, step = 1 + (⌊h / m⌋ mod (m−1)) = ${hs.step}` : ''
                  text(ctx, `slot for probe i = ${formula}${extra}`, 26, 92, { color: theme.muted, size: 12 })
                  if (p) text(ctx, `i = ${p.i} → slot ${p.index}`, W - 26, 92, { color: theme.accent, size: 13, align: 'right', weight: 700 })
                }
                // Tie the computed index to its bucket.
                if (age >= 1) {
                  const target = vw.probe?.index ?? hs.index
                  line(ctx, 60, TOP - 10, rowX(target) + 20, rowY(target) + bh / 2, alpha(theme.accent, 0.35), 1.5, [4, 4])
                }
              }
            }}
          />
          <p className="sim-mono" aria-live="polite" style={{ margin: 0 }}>
            {message}
          </p>
          <Legend items={[[theme.accent, 'current bucket'], [EMPTY, 'empty slot / match'], [theme.danger, 'collision'], [theme.muted, 'tombstone / deleted']]} />
          <Readout
            items={[
              ['Keys', t.size],
              ['Buckets m', t.m],
              ['Load factor', fmt(loadFactor(t), 2)],
              ['Collisions', t.collisions],
              ['Avg probes / insert', fmt(avg, 2)],
              t.strategy === 'chaining' ? ['Longest chain', longest] : ['Tombstones', t.tombs],
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
          queue.current = []
          cur.current = null
          table.current = build([], buckets, fn, strategy)
          view.current = emptyView()
          setMessage('Empty table.')
          rerender()
        }}
        resetLabel="Clear"
      />
      <div className="sim-field">
        <label className="sim-label" htmlFor={inputId}>
          Key
        </label>
        <input
          id={inputId}
          type="text"
          className="sim-text sim-mono"
          maxLength={16}
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            const k = e.key === 'Enter' ? keyFromDraft() : null
            if (k) enqueue(opInsert(k))
          }}
        />
      </div>
      <div className="row sim-bar">
        <button type="button" className="btn primary" onClick={() => { const k = keyFromDraft(); if (k) enqueue(opInsert(k)) }}>
          Insert
        </button>
        <button type="button" className="btn" onClick={() => { const k = keyFromDraft(); if (k) enqueue({ label: `Search "${k}"`, make: (tb) => search(tb, k) }) }}>
          Search
        </button>
        <button type="button" className="btn" onClick={() => { const k = keyFromDraft(); if (k) enqueue({ label: `Delete "${k}"`, make: (tb) => remove(tb, k) }) }}>
          Delete
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const have = new Set(keysOf(table.current))
            const pool = WORDS.filter((w) => !have.has(w)).sort(() => Math.random() - 0.5)
            enqueue(...pool.slice(0, 5).map(opInsert))
          }}
        >
          Insert 5 random
        </button>
      </div>
      <Select
        label="Hash function"
        value={fn}
        options={FNS}
        onChange={(v) => {
          setFn(v)
          rebuild(table.current.m, v, strategy)
        }}
      />
      <Select
        label="Collision strategy"
        value={strategy}
        options={STRATS}
        onChange={(v) => {
          setStrategy(v)
          if (v !== 'chaining') setMaxLoad((x) => Math.min(x, 0.95))
          rebuild(table.current.m, fn, v)
        }}
      />
      <Slider
        label="Buckets m"
        value={buckets}
        min={5}
        max={31}
        onChange={(v) => {
          setBuckets(v)
          rebuild(v, fn, strategy)
        }}
      />
      <Toggle label="Grow and rehash automatically" checked={auto} onChange={setAuto} />
      {auto && <Slider label="Grow when load factor passes" value={maxLoad} min={0.3} max={strategy === 'chaining' ? 2 : 0.95} step={0.05} format={(v) => fmt(v, 2)} onChange={setMaxLoad} />}
      <Slider label="Step time" value={delay} min={0.1} max={1.5} step={0.05} unit=" s" onChange={setDelay} />
      <Hint>The key is turned into a number, and that number mod m picks a bucket. Try the plain sum hash: anagrams like "lemon" and "melon" always collide. Delete a key under linear probing to see why a tombstone is left behind.</Hint>
    </SimLayout>
  )
}
