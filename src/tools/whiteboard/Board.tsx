import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import { reducedMotion } from '../../motion/springs'
import { bounds, hitTest, moved, pick, smoothStroke, type El, type Pt } from './logic'
import { drawEl, drawSelection } from './render'

export type ToolName = 'select' | 'hand' | 'pen' | 'hl' | 'eraser' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'note'
export interface Cam {
  x: number
  y: number
  k: number
}

interface Props {
  els: El[]
  tool: ToolName
  color: string
  width: number
  noteColor: string
  cam: Cam
  setCam: (c: Cam) => void
  selected: number | null
  setSelected: (id: number | null) => void
  onCommit: (els: El[]) => void
  nextId: () => number
}

type Mode =
  | { kind: 'none' }
  | { kind: 'pan'; sx: number; sy: number; cam: Cam }
  | { kind: 'pinch'; d0: number; mx: number; my: number; cam: Cam }
  | { kind: 'draw' }
  | { kind: 'erase' }
  | { kind: 'move'; id: number; wx: number; wy: number; orig: El; moved: boolean }

const easeBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2

export default function Board(p: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const props = useRef(p)
  props.current = p
  const draft = useRef<El | null>(null)
  const moving = useRef<El | null>(null)
  const erasing = useRef(new Set<number>())
  const born = useRef(new Map<number, number>())
  const knownIds = useRef<Set<number> | null>(null)
  const mode = useRef<Mode>({ kind: 'none' })
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const space = useRef(false)
  const raf = useRef(0)
  const lastTap = useRef({ id: -1, t: 0 })
  const [editing, setEditing] = useState<{ el: Extract<El, { type: 'text' | 'note' }>; isNew: boolean } | null>(null)
  const [editText, setEditText] = useState('')
  const editRef = useRef(editing)
  editRef.current = editing

  const draw = () => {
    raf.current = 0
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const { els, cam, selected } = props.current
    const dpr = c.width / Math.max(1, c.clientWidth)
    const W = c.clientWidth
    const H = c.clientHeight
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#fdfcf8'
    ctx.fillRect(0, 0, W, H)
    const step = 24 * cam.k
    if (step >= 9) {
      ctx.fillStyle = '#d9d4c7'
      for (let x = ((cam.x % step) + step) % step; x < W; x += step) for (let y = ((cam.y % step) + step) % step; y < H; y += step) ctx.fillRect(x - 1, y - 1, 2, 2)
    }
    ctx.setTransform(dpr * cam.k, 0, 0, dpr * cam.k, dpr * cam.x, dpr * cam.y)
    const now = performance.now()
    let animating = false
    for (const base of els) {
      if (editRef.current?.el.id === base.id) continue
      const el = moving.current?.id === base.id ? moving.current : base
      const b = born.current.get(el.id)
      let s = 1
      if (b !== undefined) {
        const t = (now - b) / 320
        if (t >= 1) born.current.delete(el.id)
        else {
          s = 0.6 + 0.4 * easeBack(Math.max(0, t))
          animating = true
        }
      }
      drawEl(ctx, el, s, erasing.current.has(el.id) ? 0.2 : 1)
    }
    if (draft.current) drawEl(ctx, draft.current)
    const sel = moving.current ?? els.find((e) => e.id === selected)
    if (sel && !editRef.current) drawSelection(ctx, sel, cam.k)
    if (animating) request()
  }
  const request = () => {
    if (!raf.current) raf.current = requestAnimationFrame(draw)
  }

  // Remember when new elements appear so they can pop in.
  useLayoutEffect(() => {
    const ids = new Set(p.els.map((e) => e.id))
    if (knownIds.current && !reducedMotion()) for (const id of ids) if (!knownIds.current.has(id)) born.current.set(id, performance.now())
    knownIds.current = ids
    request()
  })

  useEffect(() => {
    const c = canvas.current!
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      c.width = Math.round(c.clientWidth * dpr)
      c.height = Math.round(c.clientHeight * dpr)
      draw()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(c)
    fit()
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = c.getBoundingClientRect()
      const { cam, setCam } = props.current
      const k = Math.min(6, Math.max(0.15, cam.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))))
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      setCam({ k, x: mx - ((mx - cam.x) / cam.k) * k, y: my - ((my - cam.y) / cam.k) * k })
    }
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return
      if (e.key === ' ') {
        space.current = e.type === 'keydown'
        if (e.type === 'keydown') e.preventDefault()
        c.style.cursor = space.current ? 'grab' : ''
      }
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', key)
    return () => {
      ro.disconnect()
      c.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', key)
      cancelAnimationFrame(raf.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toWorld = (cx: number, cy: number): Pt => {
    const r = canvas.current!.getBoundingClientRect()
    const { cam } = props.current
    return [(cx - r.left - cam.x) / cam.k, (cy - r.top - cam.y) / cam.k]
  }

  function startEdit(el: Extract<El, { type: 'text' | 'note' }>, isNew: boolean) {
    setEditing({ el, isNew })
    setEditText(el.text)
    props.current.setSelected(el.id)
  }
  function finishEdit() {
    const ed = editRef.current
    if (!ed) return
    const { els, onCommit } = props.current
    const text = editText.replace(/\s+$/, '')
    editRef.current = null
    setEditing(null)
    if (!text) {
      if (!ed.isNew) onCommit(els.filter((e) => e.id !== ed.el.id))
    } else if (ed.isNew) onCommit([...els, { ...ed.el, text }])
    else if (text !== ed.el.text) onCommit(els.map((e) => (e.id === ed.el.id ? { ...ed.el, text } : e)))
    request()
  }

  function down(e: RPE<HTMLCanvasElement>) {
    if (editRef.current) finishEdit()
    e.currentTarget.setPointerCapture(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const { tool, color, width, noteColor, els, cam, nextId, setSelected } = props.current
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()]
      const r = canvas.current!.getBoundingClientRect()
      draft.current = null
      erasing.current.clear()
      mode.current = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, cam }
      request()
      return
    }
    if (pts.current.size > 2) return
    const [x, y] = toWorld(e.clientX, e.clientY)
    const tol = 8 / cam.k
    if (tool === 'hand' || space.current || e.button === 1) {
      mode.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, cam }
      return
    }
    if (tool === 'select') {
      const hit = pick(els, x, y, tol)
      if (hit) {
        const now = performance.now()
        const dbl = lastTap.current.id === hit.id && now - lastTap.current.t < 450
        lastTap.current = { id: hit.id, t: now }
        if (dbl && (hit.type === 'text' || hit.type === 'note')) return startEdit(hit, false)
        setSelected(hit.id)
        mode.current = { kind: 'move', id: hit.id, wx: x, wy: y, orig: hit, moved: false }
      } else {
        setSelected(null)
        mode.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, cam }
      }
      return
    }
    if (tool === 'text' || tool === 'note') {
      const hit = pick(els, x, y, tol)
      if (hit && hit.type === tool) return startEdit(hit, false)
      mode.current = { kind: 'none' }
      const el = tool === 'text' ? { id: nextId(), type: 'text' as const, x, y: y - 12, text: '', color, size: 16 + width * 2 } : { id: nextId(), type: 'note' as const, x: x - 90, y: y - 70, w: 180, h: 140, text: '', color: noteColor }
      if (!reducedMotion()) born.current.set(el.id, performance.now())
      return startEdit(el, true)
    }
    if (tool === 'eraser') {
      mode.current = { kind: 'erase' }
      erasing.current = new Set(els.filter((el) => hitTest(el, x, y, tol * 1.5)).map((el) => el.id))
      request()
      return
    }
    mode.current = { kind: 'draw' }
    const id = nextId()
    draft.current = tool === 'pen' || tool === 'hl' ? { id, type: tool, pts: [[x, y]], color, width: tool === 'hl' ? width * 4 + 8 : width } : { id, type: tool, x1: x, y1: y, x2: x, y2: y, color, width }
    request()
  }

  function move(e: RPE<HTMLCanvasElement>) {
    if (!pts.current.has(e.pointerId)) return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const m = mode.current
    const { els, setCam, cam } = props.current
    if (m.kind === 'pan') setCam({ ...m.cam, x: m.cam.x + e.clientX - m.sx, y: m.cam.y + e.clientY - m.sy })
    else if (m.kind === 'pinch' && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()]
      const r = canvas.current!.getBoundingClientRect()
      const mx = (a.x + b.x) / 2 - r.left
      const my = (a.y + b.y) / 2 - r.top
      const k = Math.min(6, Math.max(0.15, (m.cam.k * Math.hypot(a.x - b.x, a.y - b.y)) / m.d0))
      setCam({ k, x: mx - ((m.mx - m.cam.x) / m.cam.k) * k, y: my - ((m.my - m.cam.y) / m.cam.k) * k })
    } else if (m.kind === 'draw' && draft.current) {
      const [x, y] = toWorld(e.clientX, e.clientY)
      const d = draft.current
      if (d.type === 'pen' || d.type === 'hl') d.pts.push([x, y])
      else if (d.type === 'rect' || d.type === 'ellipse' || d.type === 'arrow') {
        d.x2 = x
        d.y2 = y
        if (e.shiftKey && d.type !== 'arrow') {
          const s = Math.max(Math.abs(x - d.x1), Math.abs(y - d.y1))
          d.x2 = d.x1 + Math.sign(x - d.x1 || 1) * s
          d.y2 = d.y1 + Math.sign(y - d.y1 || 1) * s
        }
      }
      request()
    } else if (m.kind === 'erase') {
      const [x, y] = toWorld(e.clientX, e.clientY)
      for (const el of els) if (hitTest(el, x, y, (12 / cam.k))) erasing.current.add(el.id)
      request()
    } else if (m.kind === 'move') {
      const [x, y] = toWorld(e.clientX, e.clientY)
      m.moved = true
      // Live preview without a history entry; committed on release.
      moving.current = moved(m.orig, x - m.wx, y - m.wy)
      request()
    }
  }

  function up(e: RPE<HTMLCanvasElement>) {
    pts.current.delete(e.pointerId)
    const m = mode.current
    const { els, onCommit } = props.current
    if (m.kind === 'draw' && draft.current) {
      const d = draft.current
      draft.current = null
      if (d.type === 'pen' || d.type === 'hl') onCommit([...els, { ...d, pts: smoothStroke(d.pts, 1.2 / props.current.cam.k) }])
      else if ((d.type === 'rect' || d.type === 'ellipse' || d.type === 'arrow') && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 4) onCommit([...els, d])
      request()
    } else if (m.kind === 'erase') {
      if (erasing.current.size) onCommit(els.filter((el) => !erasing.current.has(el.id)))
      erasing.current.clear()
      request()
    } else if (m.kind === 'move') {
      const mv = moving.current
      moving.current = null
      if (m.moved && mv) onCommit(els.map((el) => (el.id === mv.id ? mv : el)))
      request()
    }
    if (!pts.current.size || m.kind !== 'pinch') mode.current = { kind: 'none' }
  }

  const ed = editing
  const style = ed
    ? (() => {
        const b = bounds({ ...ed.el, text: editText || ' ' })
        const { cam } = p
        return ed.el.type === 'note'
          ? { left: cam.x + ed.el.x * cam.k, top: cam.y + ed.el.y * cam.k, width: ed.el.w * cam.k, height: ed.el.h * cam.k, background: ed.el.color, fontSize: 16 * cam.k, padding: 12 * cam.k }
          : { left: cam.x + ed.el.x * cam.k, top: cam.y + ed.el.y * cam.k, width: Math.max(160, (b.w + 40) * cam.k), height: (b.h + 10) * cam.k, color: ed.el.color, fontSize: ed.el.size * cam.k }
      })()
    : undefined

  const cursor = { select: 'default', hand: 'grab', pen: 'crosshair', hl: 'crosshair', eraser: 'cell', rect: 'crosshair', ellipse: 'crosshair', arrow: 'crosshair', text: 'text', note: 'copy' }[p.tool]
  return (
    <div className="wb-board">
      <canvas ref={canvas} className="wb-canvas" style={{ cursor }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onMouseDown={(e) => e.preventDefault()} role="img" aria-label="Whiteboard drawing area" />
      {ed && (
        <textarea
          key={ed.el.id}
          className={`wb-edit ${ed.el.type}`}
          style={style}
          ref={(ta) => { if (ta && document.activeElement !== ta) setTimeout(() => ta.focus(), 0) }}
          value={editText}
          placeholder={ed.el.type === 'note' ? 'Write a note…' : 'Type…'}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={finishEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) (e.target as HTMLTextAreaElement).blur()
          }}
        />
      )}
    </div>
  )
}
