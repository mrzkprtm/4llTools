import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import Icon from '../../components/Icon'
import { reducedMotion } from '../../motion/springs'
import { Choice, Hint, Slider, Toggle } from '../../sim/controls'
import { fixerColor, MODES, PATTERNS, pixelOn, step, type Mode, type Pos } from './logic'
import './tool.css'

const TIPS: Record<Mode, string> = {
  solid: 'Look for dots that stay black on white, or stay lit on black. A stuck pixel shows one color everywhere.',
  gradient: 'Smooth ramps should have no visible stripes (banding) or color tints.',
  black: 'Dim the room and look at the edges and corners for glowing patches of backlight bleed.',
  checker: 'A fine checkerboard should look like an even grey. Shimmer or moiré can point to scaling or panel issues.',
  fixer: 'Drag the flashing square over a stuck pixel and leave it for 10–20 minutes. It can revive stuck (not dead) pixels.',
}

export default function DeadPixelTest() {
  const [pos, setPos] = useState<Pos>({ mode: 'solid', index: 0 })
  const [active, setActive] = useState(false)
  const [auto, setAuto] = useState(false)
  const [secs, setSecs] = useState(3)
  const [fixerOk, setFixerOk] = useState(false)
  const [fixSize, setFixSize] = useState(120)
  const [fixAt, setFixAt] = useState({ x: 0.5, y: 0.5 })
  const [toast, setToast] = useState(0)
  const [note, setNote] = useState('')
  const overlay = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const fixBox = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const reduced = reducedMotion()
  const pattern = PATTERNS[pos.mode][pos.index]

  const move = useCallback((dir: 1 | -1) => {
    setPos((p) => step(p, dir))
    setToast((t) => t + 1)
  }, [])

  const close = useCallback(() => {
    setActive(false)
    if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [])

  function start() {
    if (pos.mode === 'fixer' && (!fixerOk || reduced)) return
    flushSync(() => setActive(true))
    setToast((t) => t + 1)
    const el = overlay.current
    setNote('')
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => setNote('Full screen was blocked, so the test fills the browser window instead. Press F11 for true full screen.'))
    } else setNote('This browser has no Fullscreen API, so the test fills the window instead.')
  }

  // Leaving full screen (Esc) ends the test.
  useEffect(() => {
    const on = () => { if (!document.fullscreenElement) setActive(false) }
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  // Keyboard controls while the test is showing.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
      else if (e.key === 'Escape') close()
      else if (e.key.toLowerCase() === 'a') setAuto((a) => !a)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, move, close])

  // Auto-cycle.
  useEffect(() => {
    if (!active || !auto || pos.mode === 'fixer' || PATTERNS[pos.mode].length < 2) return
    const id = setInterval(() => move(1), secs * 1000)
    return () => clearInterval(id)
  }, [active, auto, secs, pos.mode, move])

  // Per-pixel patterns are drawn at device resolution so each canvas pixel is one screen pixel.
  useEffect(() => {
    if (!active || !pattern.pixel) return
    const c = canvas.current
    const kind = pattern.pixel
    if (!c) return
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = Math.round(window.innerWidth * dpr)
      const h = Math.round(window.innerHeight * dpr)
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) return
      const img = ctx.createImageData(w, h)
      const d = img.data
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const v = pixelOn(kind, x, y) ? 255 : 0
          const i = (y * w + x) * 4
          d[i] = d[i + 1] = d[i + 2] = v
          d[i + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [active, pattern.pixel])

  // Pixel fixer: a new color every frame, written straight to the DOM.
  useEffect(() => {
    if (!active || pos.mode !== 'fixer' || !fixerOk || reduced) return
    let raf = 0
    let f = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (fixBox.current) fixBox.current.style.background = fixerColor(f++)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active, pos.mode, fixerOk, reduced])

  function onTap(e: RPointerEvent<HTMLDivElement>) {
    if (pos.mode === 'fixer') return
    if ((e.target as HTMLElement).closest('button')) return
    move(e.clientX < window.innerWidth / 3 ? -1 : 1)
  }

  function fixerDrag(e: RPointerEvent<HTMLDivElement>, type: 'down' | 'move' | 'up') {
    if (type === 'down') { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId) }
    if (type === 'up') dragging.current = false
    if (dragging.current) setFixAt({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
  }

  const fixerBlocked = pos.mode === 'fixer' && (reduced || !fixerOk)

  return (
    <div className="dp">
      <Choice label="Test" value={pos.mode} options={MODES} onChange={(m) => setPos({ mode: m, index: 0 })} />

      <div className="dp-previews" role="list">
        {PATTERNS[pos.mode].map((p, i) => (
          <button
            key={p.name}
            type="button"
            role="listitem"
            className={`dp-swatch ${i === pos.index ? 'on' : ''} ${p.pixel ? 'dp-px-' + p.pixel : ''}`}
            style={{ background: p.pixel ? undefined : pos.mode === 'fixer' ? 'conic-gradient(#f00, #0f0, #00f, #fff, #f00)' : p.css, animationDelay: `${i * 35}ms` }}
            onClick={() => setPos({ mode: pos.mode, index: i })}
            aria-label={p.name}
            title={p.name}
          >
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      <p className="dp-tip">{TIPS[pos.mode]}</p>

      {pos.mode === 'fixer' && (
        <div className="dp-warn" role="alert">
          <b>Photosensitivity warning.</b> The pixel fixer flashes bright colors very quickly. Do not use it if you or anyone watching may be sensitive to flashing lights, and look away while it runs.
          {reduced ? (
            <p className="muted">Your device asks for reduced motion, so the flashing fixer is turned off.</p>
          ) : (
            <>
              <Toggle label="I understand, enable the flashing fixer" checked={fixerOk} onChange={setFixerOk} />
              <Slider label="Square size" value={fixSize} min={40} max={400} step={10} unit=" px" onChange={setFixSize} />
            </>
          )}
        </div>
      )}

      {pos.mode !== 'fixer' && PATTERNS[pos.mode].length > 1 && (
        <div className="row dp-auto">
          <Toggle label="Auto-cycle" checked={auto} onChange={setAuto} />
          {auto && <Slider label="Every" value={secs} min={1} max={10} unit=" s" onChange={setSecs} />}
        </div>
      )}

      <button type="button" className="btn primary btn-icon dp-start" onClick={start} disabled={fixerBlocked}>
        <Icon name="maximize" size={18} /> Start full-screen test
      </button>
      {note && <p className="muted">{note}</p>}

      <div
        ref={overlay}
        className={`dp-overlay ${active ? 'on' : ''}`}
        style={{ background: pattern.pixel ? '#000' : pattern.css }}
        onPointerUp={onTap}
        aria-hidden={!active}
      >
        {active && pattern.pixel && <canvas ref={canvas} className="dp-canvas" />}
        {active && pos.mode === 'fixer' && fixerOk && !reduced && (
          <div
            ref={fixBox}
            className="dp-fix"
            style={{ width: fixSize, height: fixSize, left: `calc(${fixAt.x * 100}% - ${fixSize / 2}px)`, top: `calc(${fixAt.y * 100}% - ${fixSize / 2}px)` }}
            onPointerDown={(e) => fixerDrag(e, 'down')}
            onPointerMove={(e) => fixerDrag(e, 'move')}
            onPointerUp={(e) => fixerDrag(e, 'up')}
          />
        )}
        {active && (
          <div key={toast} className={`dp-hud ${reduced ? 'still' : ''}`}>
            <b>{pattern.name}</b>
            <span>{PATTERNS[pos.mode].length > 1 ? `${pos.index + 1}/${PATTERNS[pos.mode].length} · tap or → next, ← back` : pos.mode === 'fixer' ? 'Drag the square onto the stuck pixel' : 'Look at the edges'} · Esc to exit{auto ? ' · auto on (A)' : ''}</span>
            <button type="button" className="btn" onClick={close}>Exit</button>
          </div>
        )}
      </div>

      <Hint>Pick a test and press Start; tap the right side or press → for the next pattern, the left side or ← to go back, and Esc to exit. Clean the screen first so dust is not mistaken for a dead pixel.</Hint>
    </div>
  )
}
