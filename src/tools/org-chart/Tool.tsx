import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { Hint } from '../../sim/controls'
import { downloadCanvas } from '../../sim/draw'
import { PALETTE } from '../../sim/theme'
import Chart, { edgePath, NH, NW, positions, type View } from './Chart'
import { parseIndented, toIndented, wouldCycle, type Person } from './logic'
import './tool.css'

const KEY = '4lltools:org-chart'
const SAMPLE = `Sari Wijaya - CEO
  Budi Santoso - CTO
    Rina Putri - Engineering Lead
      Adi Nugroho - Frontend Dev
      Dewi Lestari - Backend Dev
    Yoga Pratama - DevOps
  Maya Kusuma - COO
    Fajar Hidayat - Operations
    Lina Marlina - HR Manager
  Hendra Gunawan - CFO
    Tari Anggraini - Accountant`

export default function OrgChart() {
  const [people, setPeople] = useState<Person[]>(() => parseIndented(SAMPLE, PALETTE))
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number | null>(null)
  const [view, setView] = useState<View>({ x: 10, y: 20, k: 0.8 })
  const [text, setText] = useState(SAMPLE)
  const [msg, setMsg] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const ready = useRef(false)

  const fit = useCallback((list: Person[] = people, col: Set<number> = collapsed) => {
    const el = box.current
    if (!el) return
    const { width, height } = positions(list, col)
    const w = el.clientWidth
    const h = el.clientHeight
    const k = Math.min(1.2, Math.max(0.25, Math.min((w - 20) / width, (h - 30) / height)))
    setView({ k, x: (w - width * k) / 2, y: 16 })
  }, [people, collapsed])

  useEffect(() => {
    let list = people
    try {
      const raw = localStorage.getItem(KEY)
      const saved = raw ? (JSON.parse(raw) as Person[]) : null
      if (Array.isArray(saved) && saved.length) {
        list = saved
        setPeople(saved)
        setText(toIndented(saved))
      }
    } catch {
      // Keep the sample.
    }
    fit(list, new Set())
    ready.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!ready.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(people))
    } catch {
      // Storage is optional.
    }
  }, [people])

  const flash = (m: string) => {
    setMsg(m)
    setTimeout(() => setMsg((x) => (x === m ? '' : x)), 3500)
  }
  const patch = (id: number, p: Partial<Person>) => setPeople((ps) => ps.map((x) => (x.id === id ? { ...x, ...p } : x)))
  function setManager(id: number, manager: number | null) {
    if (manager !== null && wouldCycle(people, id, manager)) return flash("Can't do that: someone can't report to their own report.")
    patch(id, { manager })
    if (manager !== null) setCollapsed((c) => { const n = new Set(c); n.delete(manager); return n })
    const who = people.find((p) => p.id === id)?.name
    const boss = people.find((p) => p.id === manager)?.name
    flash(boss ? `${who} now reports to ${boss}.` : `${who} is now at the top.`)
  }
  function add(manager: number | null) {
    const id = Math.max(0, ...people.map((p) => p.id)) + 1
    setPeople([...people, { id, name: 'New person', title: 'Role', color: PALETTE[id % PALETTE.length], manager }])
    if (manager !== null) setCollapsed((c) => { const n = new Set(c); n.delete(manager); return n })
    setSelected(id)
  }
  function remove(id: number) {
    const gone = people.find((p) => p.id === id)
    if (!gone) return
    setPeople(people.filter((p) => p.id !== id).map((p) => (p.manager === id ? { ...p, manager: gone.manager } : p)))
    setSelected(null)
  }
  function importText() {
    const list = parseIndented(text, PALETTE)
    if (!list.length) return flash('Type at least one name first.')
    setPeople(list)
    setCollapsed(new Set())
    setSelected(null)
    fit(list, new Set())
  }
  function exportPng() {
    const { pos, width, height } = positions(people, collapsed)
    const s = 2
    const c = document.createElement('canvas')
    c.width = (width + 40) * s
    c.height = (height + 40) * s
    const ctx = c.getContext('2d')!
    ctx.scale(s, s)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width + 40, height + 40)
    ctx.translate(20, 20)
    ctx.strokeStyle = '#b9b2a1'
    ctx.lineWidth = 1.5
    for (const p of people) {
      const a = pos.get(p.id)
      const b = p.manager !== null ? pos.get(p.manager) : undefined
      if (a && b) ctx.stroke(new Path2D(edgePath(b.cx, b.cy, a.cx, a.cy)))
    }
    for (const p of people) {
      const a = pos.get(p.id)
      if (!a) continue
      const x = a.cx - NW / 2
      const y = a.cy - NH / 2
      ctx.fillStyle = '#fcfbf7'
      ctx.strokeStyle = '#d8d2c3'
      ctx.beginPath()
      ctx.roundRect(x, y, NW, NH, 10)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = p.color
      ctx.fillRect(x, y + 6, 5, NH - 12)
      ctx.fillStyle = '#1b1a17'
      ctx.font = '700 13px system-ui, sans-serif'
      ctx.fillText(p.name.slice(0, 20), x + 16, y + 24)
      ctx.fillStyle = '#676357'
      ctx.font = '500 11px system-ui, sans-serif'
      ctx.fillText(p.title.slice(0, 26), x + 16, y + 42)
    }
    downloadCanvas(c, 'org-chart.png')
  }

  const sel = people.find((p) => p.id === selected)
  const zoom = (f: number) => {
    const el = box.current
    const w = (el?.clientWidth ?? 600) / 2
    const h = (el?.clientHeight ?? 400) / 2
    const k = Math.min(2.5, Math.max(0.25, view.k * f))
    setView({ k, x: w - ((w - view.x) / view.k) * k, y: h - ((h - view.y) / view.k) * k })
  }

  return (
    <div>
      <div className="row oc-tools">
        <button type="button" className="btn primary" onClick={() => add(selected)}>+ Add {sel ? `report to ${sel.name.split(' ')[0]}` : 'person'}</button>
        <button type="button" className="btn btn-icon" aria-label="Zoom out" onClick={() => zoom(1 / 1.25)}><Icon name="search-minus" size={18} /></button>
        <button type="button" className="btn btn-icon" aria-label="Zoom in" onClick={() => zoom(1.25)}><Icon name="search-plus" size={18} /></button>
        <button type="button" className="btn" onClick={() => fit()}>Fit</button>
        <button type="button" className="btn btn-icon" onClick={exportPng}><Icon name="image" size={18} /> PNG</button>
      </div>
      <div className="oc-box" ref={box}>
        <Chart people={people} collapsed={collapsed} selected={selected} view={view} setView={setView} onSelect={setSelected} onDrop={(id, m) => setManager(id, m)}
          onToggle={(id) => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n })} />
        {msg && <div className="oc-toast" key={msg}>{msg}</div>}
      </div>

      {sel && (
        <div className="oc-edit" key={sel.id}>
          <label>Name<input type="text" value={sel.name} onChange={(e) => patch(sel.id, { name: e.target.value })} /></label>
          <label>Title<input type="text" value={sel.title} onChange={(e) => patch(sel.id, { title: e.target.value })} /></label>
          <label>Reports to
            <select value={sel.manager ?? ''} onChange={(e) => setManager(sel.id, e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">Nobody (top level)</option>
              {people.filter((p) => p.id !== sel.id).map((p) => <option key={p.id} value={p.id} disabled={wouldCycle(people, sel.id, p.id)}>{p.name}</option>)}
            </select>
          </label>
          <label>Color<input type="color" value={sel.color} onChange={(e) => patch(sel.id, { color: e.target.value })} /></label>
          <button type="button" className="btn" onClick={() => remove(sel.id)}>Remove</button>
        </div>
      )}

      <details className="oc-import">
        <summary>Import or edit as an indented list</summary>
        <p className="muted">One person per line as <code>Name - Title</code>. Indent reports under their manager with spaces or tabs.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} spellCheck={false} />
        <div className="row">
          <button type="button" className="btn primary" onClick={importText}>Build chart</button>
          <button type="button" className="btn" onClick={() => setText(toIndented(people))}>Copy chart into text</button>
        </div>
      </details>
      <Hint>Tap a card to edit it, and drag a card onto another person to change who they report to. Drag the background to pan, and pinch or scroll to zoom.</Hint>
    </div>
  )
}
