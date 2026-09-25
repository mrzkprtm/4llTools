import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import CopyButton from '../../components/CopyButton'
import SettleOutput from '../../motion/SettleOutput'
import { PRESETS, addMidpoint, clamp, insertPoint, removePoint, snap, toCss, type Pt, type Shape } from './shapes'
import './tool.css'

const DEFAULT_BG = 'linear-gradient(135deg, #f97316 0%, #ec4899 45%, #6366f1 100%)'

function Range({ id, label, value, min = 0, max = 100, unit = '%', onChange }: { id: string; label: string; value: number; min?: number; max?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className="clp-range">
      <label htmlFor={id}><span>{label}</span><span className="muted clp-mono">{Math.round(value * 10) / 10}{unit}</span></label>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

export default function ClipPath() {
  const [preset, setPreset] = useState('Hexagon')
  const [shape, setShape] = useState<Shape>(PRESETS.find((p) => p.name === 'Hexagon')!.shape)
  const [grid, setGrid] = useState(5)
  const [useGrid, setUseGrid] = useState(true)
  const [active, setActive] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [showOutside, setShowOutside] = useState(true)
  const stage = useRef<HTMLDivElement>(null)
  const urlRef = useRef<string | null>(null)
  const handleRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  const g = useGrid ? grid : 0
  const css = toCss(shape)

  function pick(name: string) {
    const p = PRESETS.find((x) => x.name === name)
    if (!p) return
    setPreset(name)
    setShape(structuredClone(p.shape))
    setActive(null)
  }

  function toPercent(e: { clientX: number; clientY: number }): Pt {
    const r = stage.current!.getBoundingClientRect()
    return { x: snap(((e.clientX - r.left) / r.width) * 100, g), y: snap(((e.clientY - r.top) / r.height) * 100, g) }
  }

  // Handles: index >= 0 is a polygon point; -1 is the circle/ellipse centre.
  function movePoint(i: number, p: Pt) {
    setShape((s) => {
      if (s.kind === 'polygon') return { ...s, points: s.points.map((q, j) => (j === i ? p : q)) }
      if (s.kind === 'circle' || s.kind === 'ellipse') return { ...s, cx: p.x, cy: p.y }
      return s
    })
    setPreset('Custom')
  }

  function onDown(i: number, e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    setActive(i)
    setDragging(true)
  }
  function onMove(i: number, e: PointerEvent<HTMLButtonElement>) {
    if (!dragging || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    movePoint(i, toPercent(e))
  }
  function onUp(e: PointerEvent<HTMLButtonElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  function onKey(i: number, pt: Pt, e: KeyboardEvent<HTMLButtonElement>) {
    const step = e.shiftKey ? 5 : g || 1
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (d[e.key]) {
      e.preventDefault()
      movePoint(i, { x: clamp(pt.x + d[e.key][0]), y: clamp(pt.y + d[e.key][1]) })
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && i >= 0) {
      e.preventDefault()
      remove(i)
    }
  }

  function remove(i: number) {
    if (shape.kind !== 'polygon' || shape.points.length <= 3) return
    setShape({ ...shape, points: removePoint(shape.points, i) })
    setActive(null)
    setPreset('Custom')
  }

  function addPoint(at?: Pt) {
    if (shape.kind !== 'polygon') return
    const r = at ? insertPoint(shape.points, at) : addMidpoint(shape.points)
    setShape({ ...shape, points: r.points })
    setActive(r.index)
    setPreset('Custom')
    requestAnimationFrame(() => handleRefs.current[r.index]?.focus())
  }

  function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(file)
    setImage(urlRef.current)
  }

  const bg = image ? `center / cover no-repeat url("${image}")` : DEFAULT_BG
  const handles: { i: number; p: Pt; label: string }[] =
    shape.kind === 'polygon'
      ? shape.points.map((p, i) => ({ i, p, label: `Point ${i + 1}` }))
      : shape.kind === 'inset'
        ? []
        : [{ i: -1, p: { x: shape.cx, y: shape.cy }, label: 'Center' }]

  return (
    <div>
      <div className="clp-presets" role="group" aria-label="Shape presets">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className={`clp-preset ${preset === p.name ? 'is-on' : ''}`} aria-pressed={preset === p.name} onClick={() => pick(p.name)} title={p.name}>
            <span className="clp-thumb" style={{ clipPath: toCss(p.shape) }} aria-hidden="true" />
            <span className="clp-name">{p.name}</span>
          </button>
        ))}
      </div>

      <div className="clp-wrap">
        <div
          ref={stage}
          className={`clp-stage ${useGrid ? 'has-grid' : ''}`}
          style={{ ['--grid' as string]: `${grid}%` }}
          onDoubleClick={(e) => {
            if (shape.kind === 'polygon' && !(e.target as HTMLElement).closest('.clp-handle')) addPoint(toPercent(e))
          }}
        >
          {showOutside && <div className="clp-ghost" style={{ background: bg }} aria-hidden="true" />}
          <div key={preset === 'Custom' ? 'custom' : preset} className={`clp-clip ${dragging ? 'is-dragging' : ''}`} style={{ background: bg, clipPath: css }} />
          {shape.kind === 'polygon' && (
            <svg className="clp-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points={shape.points.map((p) => `${p.x},${p.y}`).join(' ')} />
            </svg>
          )}
          {handles.map(({ i, p, label }) => (
            <button
              key={i}
              ref={(el) => {
                if (i >= 0) handleRefs.current[i] = el
              }}
              type="button"
              className={`clp-handle ${active === i ? 'is-active' : ''} ${i === -1 ? 'is-center' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              aria-label={`${label} at ${Math.round(p.x)}%, ${Math.round(p.y)}%. Arrow keys move${i >= 0 ? ', Delete removes' : ''}.`}
              onPointerDown={(e) => onDown(i, e)}
              onPointerMove={(e) => onMove(i, e)}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onFocus={() => setActive(i)}
              onKeyDown={(e) => onKey(i, p, e)}
            >
              {i >= 0 && <span className="clp-idx">{i + 1}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        {shape.kind === 'polygon' && (
          <>
            <button type="button" className="btn" onClick={() => addPoint()}>+ Add point</button>
            <button type="button" className="btn" onClick={() => active !== null && active >= 0 && remove(active)} disabled={active === null || active < 0 || shape.points.length <= 3}>Remove point {active !== null && active >= 0 ? active + 1 : ''}</button>
          </>
        )}
        <label className="clp-check"><input type="checkbox" checked={useGrid} onChange={(e) => setUseGrid(e.target.checked)} /> Snap to grid</label>
        {useGrid && (
          <select aria-label="Grid size" value={grid} onChange={(e) => setGrid(Number(e.target.value))} className="clp-select">
            {[2, 5, 10, 12.5, 25].map((v) => <option key={v} value={v}>{v}%</option>)}
          </select>
        )}
        <label className="clp-check"><input type="checkbox" checked={showOutside} onChange={(e) => setShowOutside(e.target.checked)} /> Show clipped area</label>
      </div>

      {shape.kind === 'circle' && (
        <div className="clp-ranges"><Range id="clp-r" label="Radius" value={shape.r} max={75} onChange={(r) => setShape({ ...shape, r })} /></div>
      )}
      {shape.kind === 'ellipse' && (
        <div className="clp-ranges">
          <Range id="clp-rx" label="Radius X" value={shape.rx} onChange={(rx) => setShape({ ...shape, rx })} />
          <Range id="clp-ry" label="Radius Y" value={shape.ry} onChange={(ry) => setShape({ ...shape, ry })} />
        </div>
      )}
      {shape.kind === 'inset' && (
        <div className="clp-ranges">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <Range key={side} id={`clp-${side}`} label={side[0].toUpperCase() + side.slice(1)} value={shape[side]} max={50} onChange={(v) => setShape({ ...shape, [side]: v })} />
          ))}
          <Range id="clp-round" label="Corner round" value={shape.round} max={120} unit="px" onChange={(round) => setShape({ ...shape, round })} />
        </div>
      )}

      <div className="row">
        <label className="btn clp-upload">
          Use your own image
          <input type="file" accept="image/*" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {image && <button type="button" className="btn" onClick={() => setImage(null)}>Back to gradient</button>}
      </div>

      <label htmlFor="clp-out">CSS</label>
      <SettleOutput id="clp-out" value={`clip-path: ${css};`} rows={3} />
      <div className="row">
        <CopyButton text={`clip-path: ${css};`} />
      </div>
      <p className="muted">
        Drag the handles (mouse, pen or touch). Double-click the shape to add a point on the nearest edge, or focus a handle and use the arrow keys (Shift for bigger steps) and Delete. Percentages scale with the element, so the shape works at any size. Images stay on your device.
      </p>
    </div>
  )
}
