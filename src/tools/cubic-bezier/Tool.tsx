import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import CopyButton from '../../components/CopyButton'
import SettleOutput from '../../motion/SettleOutput'
import { SPRINGS, reducedMotion, type SpringName } from '../../motion/springs'
import { PRESETS, ease, formatBezier, parseBezier, parseLinear, type Bezier } from './bezier'
import './tool.css'

// Editor geometry: x 0–1 → 0–U, y from Y_MAX (top) to Y_MIN (bottom).
const U = 200
const Y_MIN = -0.6
const Y_MAX = 1.6
const PAD = 14
const H = (Y_MAX - Y_MIN) * U
const X = (x: number) => x * U
const Y = (y: number) => (Y_MAX - y) * U
const round2 = (n: number) => Math.round(n * 100) / 100
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function curvePath(b: Bezier) {
  return `M${X(0)},${Y(0)} C${X(b[0])},${Y(b[1])} ${X(b[2])},${Y(b[3])} ${X(1)},${Y(1)}`
}

function Mini({ b, values }: { b?: Bezier; values?: number[] }) {
  // Small 40×40 thumbnail of a curve (bezier or sampled values) with some headroom.
  const y = (v: number) => 32 - v * 24
  const d = b
    ? `M4,${y(0)} C${4 + b[0] * 32},${y(b[1])} ${4 + b[2] * 32},${y(b[3])} 36,${y(1)}`
    : (values ?? []).map((v, i, a) => `${i ? 'L' : 'M'}${(4 + (i / (a.length - 1)) * 32).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="cb-mini">
      <path d="M4 32H36M4 8H36" stroke="var(--border)" strokeWidth="1" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** A track with a ball, plus static "film strip" ghosts at 0, ¼, ½, ¾, 1 of the duration. */
function Track({ label, easingAt, ballRef }: { label: string; easingAt: (x: number) => number; ballRef: (el: HTMLSpanElement | null) => void }) {
  return (
    <div className="cb-track-row">
      <span className="cb-track-label">{label}</span>
      <div className="cb-track">
        {[0.25, 0.5, 0.75].map((x) => (
          <i key={x} className="cb-ghost" style={{ left: `calc((100% - 24px) * ${clamp(easingAt(x), -0.2, 1.2)})` }} />
        ))}
        <span ref={ballRef} className="cb-ball" />
      </div>
    </div>
  )
}

export default function CubicBezier() {
  const [b, setB] = useState<Bezier>([0.34, 1.56, 0.64, 1])
  const [text, setText] = useState(formatBezier([0.34, 1.56, 0.64, 1]))
  const [drag, setDrag] = useState<0 | 1 | null>(null)
  const [duration, setDuration] = useState(900)
  const [prop, setProp] = useState('transform')
  const [note, setNote] = useState('')
  const svg = useRef<SVGSVGElement>(null)
  const balls = useRef<Record<string, HTMLSpanElement | null>>({})

  const css = formatBezier(b)
  const snippet = `transition: ${prop} ${duration}ms ${css};`
  const parsedText = parseBezier(text)

  function update(next: Bezier) {
    setB(next)
    setText(formatBezier(next))
  }

  function onText(v: string) {
    setText(v)
    const p = parseBezier(v)
    if (p) setB(p)
  }

  function fromPointer(e: { clientX: number; clientY: number }): [number, number] | null {
    const el = svg.current
    const m = el?.getScreenCTM()
    if (!el || !m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return [round2(clamp(p.x / U, 0, 1)), round2(clamp(Y_MAX - p.y / U, Y_MIN, Y_MAX))]
  }

  function onDown(h: 0 | 1, e: PointerEvent<SVGGElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    setDrag(h)
  }
  function onMove(h: 0 | 1, e: PointerEvent<SVGGElement>) {
    if (drag !== h) return
    const p = fromPointer(e)
    if (!p) return
    const next = [...b] as Bezier
    next[h * 2] = p[0]
    next[h * 2 + 1] = p[1]
    update(next)
  }
  const onUp = () => setDrag(null)

  function onKey(h: 0 | 1, e: KeyboardEvent<SVGGElement>) {
    const s = e.shiftKey ? 0.1 : 0.01
    const d: Record<string, [number, number]> = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }
    const v = d[e.key]
    if (!v) return
    e.preventDefault()
    const next = [...b] as Bezier
    next[h * 2] = round2(clamp(next[h * 2] + v[0], 0, 1))
    next[h * 2 + 1] = round2(clamp(next[h * 2 + 1] + v[1], Y_MIN, Y_MAX))
    update(next)
  }

  function play(keys: [string, string][], ms = duration) {
    if (reducedMotion()) {
      setNote('Reduced motion is on, so the preview stays still. The dots on each track show where the element is at ¼, ½ and ¾ of the time.')
      return
    }
    setNote('')
    for (const [key, easing] of keys) {
      const el = balls.current[key]
      const track = el?.parentElement
      if (!el || !track) continue
      const dist = track.clientWidth - el.offsetWidth
      el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dist}px)` }], { duration: ms, easing, fill: 'forwards' })
    }
  }

  // Autoplay once on first visit (skipped for reduced motion).
  useEffect(() => {
    const t = setTimeout(() => {
      if (!reducedMotion()) play([['mine', css], ['linear', 'linear']])
    }, 500)
    return () => clearTimeout(t)
  }, [])

  const ref = (k: string) => (el: HTMLSpanElement | null) => {
    balls.current[k] = el
  }

  const handles: { h: 0 | 1; x: number; y: number; ax: number; ay: number }[] = [
    { h: 0, x: b[0], y: b[1], ax: 0, ay: 0 },
    { h: 1, x: b[2], y: b[3], ax: 1, ay: 1 },
  ]

  return (
    <div>
      <div className="cb-layout">
        <div className="cb-editor-wrap">
          <svg ref={svg} className={`cb-editor ${drag !== null ? 'is-dragging' : ''}`} viewBox={`${-PAD} ${-PAD} ${U + PAD * 2} ${H + PAD * 2}`} role="group" aria-label={`Curve editor: ${css}`}>
            <rect x={0} y={Y(1)} width={U} height={U} className="cb-square" />
            {[0.25, 0.5, 0.75].map((g) => (
              <g key={g} className="cb-grid">
                <line x1={X(g)} x2={X(g)} y1={Y(1)} y2={Y(0)} />
                <line x1={0} x2={U} y1={Y(g)} y2={Y(g)} />
              </g>
            ))}
            <text x={4} y={Y(1) - 6} className="cb-axis">1</text>
            <text x={4} y={Y(0) + 16} className="cb-axis">0</text>
            <text x={U - 4} y={Y(0) + 16} className="cb-axis" textAnchor="end">time →</text>
            <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} className="cb-diag" />
            {handles.map((p) => (
              <line key={`l${p.h}`} x1={X(p.ax)} y1={Y(p.ay)} x2={X(p.x)} y2={Y(p.y)} className={`cb-arm cb-arm-${p.h}`} />
            ))}
            <path d={curvePath(b)} className="cb-curve" />
            {handles.map((p) => (
              <g
                key={`h${p.h}`}
                className={`cb-handle cb-handle-${p.h} ${drag === p.h ? 'is-active' : ''}`}
                transform={`translate(${X(p.x)} ${Y(p.y)})`}
                tabIndex={0}
                role="button"
                aria-label={`Control point ${p.h + 1}: x ${p.x}, y ${p.y}. Use arrow keys to move, Shift for bigger steps.`}
                onPointerDown={(e) => onDown(p.h, e)}
                onPointerMove={(e) => onMove(p.h, e)}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onKeyDown={(e) => onKey(p.h, e)}
              >
                <circle r={22} className="cb-hit" />
                <circle r={9} className="cb-dot" />
              </g>
            ))}
          </svg>
        </div>

        <div className="cb-side">
          <label htmlFor="cb-text">Easing</label>
          <input id="cb-text" type="text" value={text} onChange={(e) => onText(e.target.value)} spellCheck={false} className="cb-mono" aria-invalid={!parsedText} />
          {!parsedText && <p className="error cb-small">Enter cubic-bezier(x1, y1, x2, y2) with x values between 0 and 1.</p>}
          <div className="cb-nums">
            {(['x1', 'y1', 'x2', 'y2'] as const).map((n, i) => (
              <div key={n}>
                <label htmlFor={`cb-${n}`} className="cb-num-label">{n}</label>
                <input
                  id={`cb-${n}`}
                  type="number"
                  step={0.01}
                  min={i % 2 === 0 ? 0 : Y_MIN}
                  max={i % 2 === 0 ? 1 : Y_MAX}
                  value={b[i]}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (!Number.isFinite(v)) return
                    const next = [...b] as Bezier
                    next[i] = i % 2 === 0 ? clamp(v, 0, 1) : clamp(v, Y_MIN, Y_MAX)
                    update(next)
                  }}
                />
              </div>
            ))}
          </div>

          <div className="cb-tracks">
            <Track label="Yours" easingAt={(x) => ease(b, x)} ballRef={ref('mine')} />
            <Track label="linear" easingAt={(x) => x} ballRef={ref('linear')} />
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => play([['mine', css], ['linear', 'linear']])}>▶ Play</button>
            <label htmlFor="cb-dur" className="cb-dur">Duration <span className="muted cb-mono">{duration}ms</span></label>
            <input id="cb-dur" type="range" min={150} max={3000} step={50} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="cb-dur-range" />
          </div>
          {note && <p className="muted cb-small settle-in" role="status">{note}</p>}
        </div>
      </div>

      <label>Presets</label>
      <div className="cb-presets">
        {PRESETS.map((p) => {
          const on = p.b.every((v, i) => v === b[i])
          return (
            <button key={p.name} type="button" className={`cb-preset ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => update([...p.b])}>
              <Mini b={p.b} />
              <span>{p.name}</span>
            </button>
          )
        })}
      </div>

      <label htmlFor="cb-out">CSS</label>
      <div className="row" style={{ marginTop: 0 }}>
        <label htmlFor="cb-prop" className="cb-small">Property</label>
        <select id="cb-prop" value={prop} onChange={(e) => setProp(e.target.value)} className="cb-select">
          {['transform', 'opacity', 'all', 'background-color', 'width', 'height', 'top', 'left'].map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <SettleOutput id="cb-out" value={`${css}\n\n${snippet}\nanimation-timing-function: ${css};`} rows={5} />
      <div className="row">
        <CopyButton text={css} label="Copy curve" />
        <CopyButton text={snippet} label="Copy transition" />
      </div>

      <h3 className="cb-h">Spring presets as linear()</h3>
      <p className="muted cb-small">
        This site animates with real spring physics, pre-computed into CSS <code>linear()</code> easings. Unlike a cubic-bezier they can wobble past the end and settle back. <code>linear()</code> works in all current browsers (Chrome 113+, Safari 17.2+, Firefox 112+).
      </p>
      <div className="cb-springs">
        {(Object.keys(SPRINGS) as SpringName[]).map((name) => {
          const s = SPRINGS[name]
          const line = `transition: transform ${s.duration}ms ${s.easing};`
          return (
            <div key={name} className="cb-spring">
              <div className="cb-spring-head">
                <Mini values={parseLinear(s.easing)} />
                <div>
                  <b>{name}</b>
                  <span className="muted cb-small"> {s.duration}ms</span>
                </div>
                <button type="button" className="btn" onClick={() => play([[`spring-${name}`, s.easing]], s.duration)}>▶ Play</button>
                <CopyButton text={line} />
              </div>
              <div className="cb-track cb-track-sm">
                <span ref={ref(`spring-${name}`)} className="cb-ball" />
              </div>
              <div className="output cb-linear">{s.easing}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
