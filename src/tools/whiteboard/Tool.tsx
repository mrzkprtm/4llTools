import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { Hint } from '../../sim/controls'
import { downloadCanvas } from '../../sim/draw'
import Board, { type Cam, type ToolName } from './Board'
import { boundsAll, type El } from './logic'
import { drawEl, INK, NOTE_COLORS } from './render'
import './tool.css'

const KEY = '4lltools:whiteboard'
const MAX_BYTES = 2_000_000

const TOOLS: [ToolName, string, string][] = [
  ['select', 'Select and move (V)', 'V'],
  ['hand', 'Pan (H or hold Space)', 'H'],
  ['pen', 'Pen (P)', 'P'],
  ['hl', 'Highlighter (M)', 'M'],
  ['eraser', 'Eraser (E)', 'E'],
  ['rect', 'Rectangle (R)', 'R'],
  ['ellipse', 'Ellipse (O)', 'O'],
  ['arrow', 'Arrow (A)', 'A'],
  ['text', 'Text (T)', 'T'],
  ['note', 'Sticky note (N)', 'N'],
]

function ToolGlyph({ t }: { t: ToolName }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (t) {
    case 'select': return <svg {...common}><path d="M5 3l14 8-6 2-3 6z" /></svg>
    case 'hand': return <Icon name="hand" size={20} />
    case 'pen': return <svg {...common}><path d="M4 20c4-1 5-6 9-9s6-5 7-7" /></svg>
    case 'hl': return <svg {...common} strokeWidth={5} opacity={0.6}><path d="M4 16c5-3 10-5 16-8" /></svg>
    case 'eraser': return <Icon name="eraser" size={20} />
    case 'rect': return <svg {...common}><rect x="4" y="6" width="16" height="12" rx="1.5" /></svg>
    case 'ellipse': return <svg {...common}><ellipse cx="12" cy="12" rx="8.5" ry="6.5" /></svg>
    case 'arrow': return <svg {...common}><path d="M5 19L19 5M10 5h9v9" /></svg>
    case 'text': return <svg {...common}><path d="M5 6V4h14v2M12 4v16M9 20h6" /></svg>
    case 'note': return <svg {...common}><path d="M4 4h16v11l-5 5H4z M15 20v-5h5" /></svg>
  }
}

function sample(): El[] {
  return [
    { id: 1, type: 'note', x: 40, y: 40, w: 180, h: 140, text: 'Sprint goals:\nShip onboarding v2', color: NOTE_COLORS[0] },
    { id: 2, type: 'note', x: 250, y: 60, w: 180, h: 140, text: 'Risks: API rate limits', color: NOTE_COLORS[1] },
    { id: 3, type: 'arrow', x1: 225, y1: 110, x2: 262, y2: 125, color: INK[0], width: 3 },
    { id: 4, type: 'text', x: 60, y: 220, text: 'Brainstorm 🧠 drag me with Select', color: INK[2], size: 22 },
    { id: 5, type: 'ellipse', x1: 460, y1: 60, x2: 600, y2: 160, color: INK[3], width: 3 },
    { id: 6, type: 'text', x: 492, y: 98, text: 'Launch!', color: INK[3], size: 22 },
  ]
}

export default function Whiteboard() {
  const [els, setEls] = useState<El[]>(sample)
  const [past, setPast] = useState<El[][]>([])
  const [future, setFuture] = useState<El[][]>([])
  const [tool, setTool] = useState<ToolName>('pen')
  const [color, setColor] = useState(INK[0])
  const [width, setWidth] = useState(3)
  const [noteColor, setNoteColor] = useState(NOTE_COLORS[0])
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, k: 1 })
  const [selected, setSelected] = useState<number | null>(null)
  const [warn, setWarn] = useState('')
  const ready = useRef(false)
  const idRef = useRef(100)
  const nextId = useCallback(() => ++idRef.current, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      const saved = raw ? (JSON.parse(raw) as El[]) : null
      if (Array.isArray(saved)) setEls(saved)
      idRef.current = Math.max(100, ...(saved ?? []).map((e) => e.id))
    } catch {
      // Keep the sample.
    }
    ready.current = true
  }, [])
  useEffect(() => {
    if (!ready.current) return
    const id = setTimeout(() => {
      try {
        const json = JSON.stringify(els)
        if (json.length > MAX_BYTES) return setWarn('This board is too big to autosave in the browser. Export a PNG to keep it.')
        localStorage.setItem(KEY, json)
        setWarn('')
      } catch {
        setWarn('Autosave is unavailable in this browser.')
      }
    }, 700)
    return () => clearTimeout(id)
  }, [els])

  const elsRef = useRef(els)
  elsRef.current = els
  const commit = useCallback((next: El[]) => {
    const cur = elsRef.current
    setPast((p) => [...p.slice(-80), cur])
    elsRef.current = next
    setEls(next)
    setFuture([])
  }, [])
  const undo = () => {
    if (!past.length) return
    setFuture((f) => [els, ...f])
    setEls(past[past.length - 1])
    setPast(past.slice(0, -1))
    setSelected(null)
  }
  const redo = () => {
    if (!future.length) return
    setPast((p) => [...p, els])
    setEls(future[0])
    setFuture(future.slice(1))
  }
  const del = () => {
    if (selected === null) return
    commit(els.filter((e) => e.id !== selected))
    setSelected(null)
  }

  const keys = useRef({ undo, redo, del })
  keys.current = { undo, redo, del }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) keys.current.redo()
        else keys.current.undo()
      } else if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault()
        keys.current.redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') keys.current.del()
      else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = TOOLS.find(([, , key]) => key.toLowerCase() === k)
        if (t) setTool(t[0])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function exportPng() {
    const b = boundsAll(els)
    if (!b) return setWarn('The board is empty; draw something first.')
    const pad = 32
    const s = Math.min(2, 8000 / (b.w + 2 * pad), 8000 / (b.h + 2 * pad))
    const c = document.createElement('canvas')
    c.width = Math.ceil((b.w + 2 * pad) * s)
    c.height = Math.ceil((b.h + 2 * pad) * s)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fdfcf8'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.setTransform(s, 0, 0, s, (pad - b.x) * s, (pad - b.y) * s)
    for (const el of els) drawEl(ctx, el)
    downloadCanvas(c, 'whiteboard.png')
  }
  function zoom(f: number) {
    const k = Math.min(6, Math.max(0.15, cam.k * f))
    const cx = 300
    const cy = 220
    setCam({ k, x: cx - ((cx - cam.x) / cam.k) * k, y: cy - ((cy - cam.y) / cam.k) * k })
  }

  const showColor = tool !== 'eraser' && tool !== 'hand' && tool !== 'select'
  return (
    <div>
      <div className="wb-toolbar" role="toolbar" aria-label="Drawing tools">
        {TOOLS.map(([t, label]) => (
          <button key={t} type="button" className={`wb-tool ${tool === t ? 'on' : ''}`} aria-pressed={tool === t} title={label} aria-label={label} onClick={() => setTool(t)}>
            <ToolGlyph t={t} />
          </button>
        ))}
      </div>
      <div className="wb-options">
        {showColor && tool !== 'note' && INK.map((c) => (
          <button key={c} type="button" className={`wb-swatch ${color === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} />
        ))}
        {tool === 'note' && NOTE_COLORS.map((c) => (
          <button key={c} type="button" className={`wb-swatch ${noteColor === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Note color ${c}`} aria-pressed={noteColor === c} onClick={() => setNoteColor(c)} />
        ))}
        {showColor && tool !== 'note' && [2, 4, 8].map((w) => (
          <button key={w} type="button" className={`wb-width ${width === w ? 'on' : ''}`} aria-label={`Width ${w}`} aria-pressed={width === w} onClick={() => setWidth(w)}>
            <i style={{ width: w + 4, height: w + 4 }} />
          </button>
        ))}
        {tool === 'select' && <button type="button" className="btn wb-small" onClick={del} disabled={selected === null}>Delete</button>}
        <span className="wb-spacer" />
        <button type="button" className="btn wb-small btn-icon" onClick={undo} disabled={!past.length} aria-label="Undo"><Icon name="undo" size={18} /></button>
        <button type="button" className="btn wb-small btn-icon" onClick={redo} disabled={!future.length} aria-label="Redo"><Icon name="redo" size={18} /></button>
        <button type="button" className="btn wb-small btn-icon" onClick={() => zoom(1 / 1.25)} aria-label="Zoom out"><Icon name="search-minus" size={18} /></button>
        <button type="button" className="btn wb-small wb-pct" onClick={() => setCam({ x: 0, y: 0, k: 1 })} title="Reset view">{Math.round(cam.k * 100)}%</button>
        <button type="button" className="btn wb-small btn-icon" onClick={() => zoom(1.25)} aria-label="Zoom in"><Icon name="search-plus" size={18} /></button>
        <button type="button" className="btn wb-small btn-icon" onClick={exportPng}><Icon name="image" size={18} /> PNG</button>
        <button type="button" className="btn wb-small" onClick={() => { if (els.length) commit([]) }} disabled={!els.length}>Clear</button>
      </div>
      <Board els={els} tool={tool} color={color} width={width} noteColor={noteColor} cam={cam} setCam={setCam} selected={selected} setSelected={setSelected} onCommit={commit} nextId={nextId} />
      {warn && <p className="error">{warn}</p>}
      <Hint>Pick a tool and draw. Pan with the hand tool, by holding Space, or with two fingers, and zoom with the wheel or a pinch. Double-tap a note or text with Select to edit it; the board autosaves in this browser.</Hint>
    </div>
  )
}
