import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import { shouldAdd, strokePath, strokesBounds, strokesToSvg, textToSvg, type Pt, type Stroke } from './strokes'
import './tool.css'

type Action = { kind: 'add'; stroke: Stroke } | { kind: 'clear'; strokes: Stroke[] }

const COLORS: [string, string][] = [['#111827', 'Black'], ['#1d4ed8', 'Blue'], ['#0f766e', 'Teal'], ['#b91c1c', 'Red']]

const FONTS: { name: string; stack: string; italic?: boolean }[] = [
  { name: 'Elegant', stack: "'Segoe Script', 'Snell Roundhand', 'URW Chancery L', 'Brush Script MT', cursive" },
  { name: 'Classic', stack: "'Lucida Handwriting', 'Apple Chancery', 'Monotype Corsiva', 'URW Chancery L', cursive" },
  { name: 'Casual', stack: "'Bradley Hand', 'Segoe Print', 'Chalkboard SE', 'Comic Sans MS', cursive" },
  { name: 'Brush', stack: "'Brush Script MT', 'Brush Script Std', 'Segoe Script', cursive", italic: true },
  { name: 'Calligraphy', stack: "'Zapfino', 'Edwardian Script ITC', 'Lucida Calligraphy', 'Palace Script MT', cursive" },
]

const pathCache = new WeakMap<Stroke, Path2D>()
function pathOf(s: Stroke): Path2D {
  let p = pathCache.get(s)
  if (!p) {
    p = new Path2D(strokePath(s))
    pathCache.set(s, p)
  }
  return p
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode PNG.'))), 'image/png'))

export default function SignaturePad() {
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [history, setHistory] = useState<Action[]>([])
  const [future, setFuture] = useState<Action[]>([])
  const [color, setColor] = useState(COLORS[0][0])
  const [size, setSize] = useState(3)
  const [white, setWhite] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [text, setText] = useState('Jane Doe')
  const [font, setFont] = useState(0)
  const [typedSize, setTypedSize] = useState(64)
  const [flash, setFlash] = useState<{ msg: string; n: number } | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const current = useRef<Stroke | null>(null)
  const strokesRef = useRef(strokes)
  strokesRef.current = strokes
  const raf = useRef(0)
  const flashTimer = useRef(0)

  function redraw() {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const dpr = c.width / Math.max(1, c.clientWidth)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const s of strokesRef.current) {
      ctx.fillStyle = s.color
      ctx.fill(pathOf(s))
    }
    const cur = current.current
    if (cur) {
      ctx.fillStyle = cur.color
      ctx.fill(new Path2D(strokePath(cur)))
    }
  }

  const schedule = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(redraw)
  }

  // Keep the canvas bitmap matched to its on-screen size and pixel ratio.
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const fit = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      c.width = Math.round(c.clientWidth * dpr)
      c.height = Math.round(c.clientHeight * dpr)
      redraw()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(c)
    // iOS Safari: block page scroll/zoom gestures that start on the pad.
    const stop = (e: TouchEvent) => e.preventDefault()
    c.addEventListener('touchstart', stop, { passive: false })
    c.addEventListener('touchmove', stop, { passive: false })
    return () => {
      ro.disconnect()
      c.removeEventListener('touchstart', stop)
      c.removeEventListener('touchmove', stop)
    }
  }, [mode])

  useEffect(schedule, [strokes])
  useEffect(() => () => {
    cancelAnimationFrame(raf.current)
    clearTimeout(flashTimer.current)
  }, [])

  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview)
  }, [preview])

  const point = (e: { clientX: number; clientY: number; pressure: number; pointerType: string }, t: number): Pt => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5, t }
  }

  function down(e: RPointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    current.current = { points: [point(e, e.timeStamp)], color, size, pressure: e.pointerType === 'pen' }
    setDrawing(true)
    schedule()
  }

  function move(e: RPointerEvent<HTMLCanvasElement>) {
    const s = current.current
    if (!s) return
    e.preventDefault()
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : []
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = point(ev, ev.timeStamp)
      if (shouldAdd(s.points[s.points.length - 1], p)) s.points.push(p)
    }
    schedule()
  }

  function up() {
    const s = current.current
    current.current = null
    setDrawing(false)
    if (!s) return
    setStrokes((l) => [...l, s])
    setHistory((h) => [...h, { kind: 'add', stroke: s }])
    setFuture([])
    setPreview(null)
  }

  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    setFuture((f) => [...f, last])
    setStrokes((l) => (last.kind === 'add' ? l.filter((s) => s !== last.stroke) : last.strokes))
    setPreview(null)
  }

  function redo() {
    const next = future[future.length - 1]
    if (!next) return
    setFuture((f) => f.slice(0, -1))
    setHistory((h) => [...h, next])
    setStrokes((l) => (next.kind === 'add' ? [...l, next.stroke] : []))
    setPreview(null)
  }

  function clear() {
    if (!strokes.length) return
    setHistory((h) => [...h, { kind: 'clear', strokes }])
    setFuture([])
    setStrokes([])
    setPreview(null)
  }

  // Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y), unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== 'draw' || !(e.ctrlKey || e.metaKey)) return
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function done(msg: string) {
    setFlash({ msg, n: Date.now() })
    clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), 2200)
  }

  const fontCss = (i: number, px: number) => `${FONTS[i].italic ? 'italic ' : ''}${px}px ${FONTS[i].stack}`

  /** Renders the signature (drawn or typed) to a tightly cropped canvas at 3x. */
  function renderPng(): HTMLCanvasElement | null {
    const scale = 3
    const margin = 10
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    if (!ctx) return null
    if (mode === 'draw') {
      const b = strokesBounds(strokes)
      if (!b) return null
      c.width = Math.ceil((b.w + margin * 2) * scale)
      c.height = Math.ceil((b.h + margin * 2) * scale)
      if (white) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, c.width, c.height)
      }
      ctx.setTransform(scale, 0, 0, scale, (-b.x + margin) * scale, (-b.y + margin) * scale)
      for (const s of strokes) {
        ctx.fillStyle = s.color
        ctx.fill(pathOf(s))
      }
      return c
    }
    const t = text.trim()
    if (!t) return null
    ctx.font = fontCss(font, typedSize * scale)
    const m = ctx.measureText(t)
    const up = m.actualBoundingBoxAscent || typedSize * scale * 0.8
    const dn = m.actualBoundingBoxDescent || typedSize * scale * 0.3
    const left = m.actualBoundingBoxLeft || 0
    const w = (m.actualBoundingBoxRight || m.width) + left
    c.width = Math.ceil(w + margin * 2 * scale)
    c.height = Math.ceil(up + dn + margin * 2 * scale)
    if (white) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, c.width, c.height)
    }
    ctx.font = fontCss(font, typedSize * scale)
    ctx.fillStyle = color
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(t, margin * scale + left, margin * scale + up)
    return c
  }

  async function downloadPng() {
    setError('')
    const c = renderPng()
    if (!c) {
      setError(mode === 'draw' ? 'Draw your signature first.' : 'Type your name first.')
      return
    }
    const blob = await toBlob(c)
    save(blob, 'signature.png')
    setPreview(URL.createObjectURL(blob))
    done('PNG saved')
  }

  async function copyPng() {
    setError('')
    const c = renderPng()
    if (!c) {
      setError(mode === 'draw' ? 'Draw your signature first.' : 'Type your name first.')
      return
    }
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('unsupported')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(c) })])
      done('Copied')
    } catch {
      setError('This browser cannot copy images. Use Download PNG instead.')
    }
  }

  function downloadSvg() {
    setError('')
    if (mode === 'draw') {
      const svg = strokesToSvg(strokes, 10, white ? '#ffffff' : undefined)
      if (!svg) {
        setError('Draw your signature first.')
        return
      }
      save(new Blob([svg], { type: 'image/svg+xml' }), 'signature.svg')
    } else {
      const c = renderPng()
      if (!c) {
        setError('Type your name first.')
        return
      }
      save(new Blob([textToSvg(text.trim(), FONTS[font].stack, typedSize, color, c.width / 3, c.height / 3, white ? '#ffffff' : undefined)], { type: 'image/svg+xml' }), 'signature.svg')
    }
    done('SVG saved')
  }

  const empty = mode === 'draw' ? strokes.length === 0 : !text.trim()

  return (
    <div>
      <PillRow role="tablist" label="Signature mode">
        <button type="button" role="tab" aria-selected={mode === 'draw'} className={mode === 'draw' ? 'btn primary' : 'btn'} onClick={() => { setMode('draw'); setPreview(null) }}>Draw</button>
        <button type="button" role="tab" aria-selected={mode === 'type'} className={mode === 'type' ? 'btn primary' : 'btn'} onClick={() => { setMode('type'); setPreview(null) }}>Type</button>
      </PillRow>

      {mode === 'type' && (
        <>
          <label htmlFor="sg-text">Your name</label>
          <input id="sg-text" type="text" value={text} maxLength={60} onChange={(e) => { setText(e.target.value); setPreview(null) }} autoComplete="name" />
        </>
      )}

      <div className={`sg-pad ${white ? 'is-white' : ''} ${drawing ? 'is-drawing' : ''}`}>
        {mode === 'draw' ? (
          <>
            <span className="sg-guide" aria-hidden="true" />
            <div className={`sg-hint ${strokes.length || drawing ? 'gone' : ''}`} aria-hidden="true"><span>Sign here with your mouse, finger or pen</span></div>
            <canvas
              ref={canvas}
              role="img"
              aria-label={`Signature drawing area, ${strokes.length} stroke${strokes.length === 1 ? '' : 's'}`}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            />
          </>
        ) : (
          <div className="sg-typed" style={{ font: fontCss(font, Math.min(typedSize, 72)), color }}>
            <span key={`${font}-${text}`}>{text || ' '}</span>
          </div>
        )}
      </div>

      <div className="sg-tools">
        <div className="sg-colors" role="group" aria-label="Ink color">
          {COLORS.map(([c, n]) => (
            <button key={c} type="button" className="sg-color" style={{ background: c }} aria-label={n} aria-pressed={color === c} onClick={() => setColor(c)} />
          ))}
          <input type="color" aria-label="Custom ink color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 34, height: 32, padding: 0, border: 'none', background: 'none' }} />
        </div>
        {mode === 'draw' ? (
          <div className="sg-size">
            <label htmlFor="sg-size" style={{ margin: 0, fontWeight: 500, whiteSpace: 'nowrap' }}>Pen</label>
            <input id="sg-size" type="range" min={1} max={10} step={0.5} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            <i style={{ width: size * 2.4, height: size * 2.4, background: color }} aria-hidden="true" />
          </div>
        ) : (
          <div className="sg-size">
            <label htmlFor="sg-tsize" style={{ margin: 0, fontWeight: 500, whiteSpace: 'nowrap' }}>Size</label>
            <input id="sg-tsize" type="range" min={32} max={120} value={typedSize} onChange={(e) => setTypedSize(Number(e.target.value))} />
          </div>
        )}
        {mode === 'draw' && (
          <div className="sg-history">
            <button type="button" className="btn btn-icon" onClick={undo} disabled={!history.length} aria-label="Undo (Ctrl+Z)"><Icon name="undo" size={18} /></button>
            <button type="button" className="btn btn-icon" onClick={redo} disabled={!future.length} aria-label="Redo (Ctrl+Shift+Z)"><Icon name="redo" size={18} /></button>
            <button type="button" className="btn btn-icon" onClick={clear} disabled={!strokes.length}><Icon name="eraser" size={18} /> Clear</button>
          </div>
        )}
      </div>

      {mode === 'type' && (
        <div className="sg-fonts" role="group" aria-label="Signature style">
          {FONTS.map((f, i) => (
            <button key={f.name} type="button" className="sg-font" aria-pressed={font === i} aria-label={`${f.name} style`} style={{ fontFamily: f.stack, fontStyle: f.italic ? 'italic' : undefined, color }} onClick={() => { setFont(i); setPreview(null) }}>
              {text.trim() || f.name}
            </button>
          ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={white} onChange={(e) => setWhite(e.target.checked)} /> White background (off = transparent)</label>
      </div>
      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={downloadPng} disabled={empty}><Icon name="arrow-down-circle" size={18} /> Download PNG</button>
        <button type="button" className="btn btn-icon" onClick={downloadSvg} disabled={empty}><Icon name="code" size={18} /> Download SVG</button>
        <button type="button" className="btn btn-icon" onClick={copyPng} disabled={empty}><Icon name="clipboard" size={18} /> Copy PNG</button>
        {flash && <span className="chip good" key={flash.n}><Check size={14} /> {flash.msg}</span>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {preview && (
        <div className="sg-preview">
          <img src={preview} alt="Exported signature" />
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        Strokes are smoothed with curves, and get thicker with pen pressure (Apple Pencil, Wacom, Surface Pen) or thinner when you move fast with a mouse or finger. Exports are cropped to your signature at 3x resolution, with a transparent background by default, ready to place on a PDF or document.
        The SVG keeps each stroke as a vector path. Typed signatures use handwriting fonts already on your device, so the style varies between systems, and a typed SVG shows in the viewer’s fonts.
        Nothing is uploaded. An image of a signature is not a certified digital signature.
      </p>
    </div>
  )
}
