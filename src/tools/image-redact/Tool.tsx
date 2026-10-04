import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { REDACT_MODES, clampRect, normalizeRect, pixelate, redactLabel, type Point, type Rect, type RedactMode } from './redact'

interface Redaction {
  id: number
  rect: Rect
  mode: RedactMode
}

function downloadPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }, 'image/png')
}

/** Pointer position in image pixels, whatever the on-screen size is. */
function toImage(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
  const box = canvas.getBoundingClientRect()
  return {
    x: (clientX - box.left) * (canvas.width / box.width),
    y: (clientY - box.top) * (canvas.height / box.height),
  }
}

export default function ImageRedactor() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [items, setItems] = useState<Redaction[]>([])
  const [mode, setMode] = useState<RedactMode>('pixelate')
  const [block, setBlock] = useState(14)
  const [draft, setDraft] = useState<Rect | null>(null)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragFrom = useRef<Point | null>(null)
  const nextId = useRef(1)
  const urlRef = useRef('')

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    if (!canvas || !ctx || !bitmap) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    ctx.filter = 'none'
    ctx.drawImage(bitmap, 0, 0)
    for (const item of items) {
      const r = clampRect(item.rect, bitmap.width, bitmap.height)
      if (r.w < 1 || r.h < 1) continue
      if (item.mode === 'blackout') {
        ctx.fillStyle = '#000000'
        ctx.fillRect(r.x, r.y, r.w, r.h)
      } else if (item.mode === 'blur') {
        ctx.save()
        ctx.filter = `blur(${Math.max(2, Math.round(Math.min(r.w, r.h) / 5))}px)`
        ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h)
        ctx.restore()
      } else {
        const image = ctx.getImageData(r.x, r.y, r.w, r.h)
        pixelate(image.data, r.w, r.h, { x: 0, y: 0, w: r.w, h: r.h }, block)
        ctx.putImageData(image, r.x, r.y)
      }
    }
  }, [bitmap, items, block])

  async function open(file: File) {
    setError('')
    try {
      const bmp = await createImageBitmap(file)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(file)
      setBitmap(bmp)
      setName(file.name)
      setItems([])
    } catch {
      setError('That file could not be opened as an image.')
    }
  }

  function addRect(rect: Rect) {
    if (rect.w < 8 || rect.h < 8) return
    setItems((old) => [...old, { id: nextId.current++, rect, mode }])
  }

  function addCenteredBox() {
    if (!bitmap) return
    const w = Math.round(bitmap.width * 0.3)
    const h = Math.round(bitmap.height * 0.3)
    addRect({ x: Math.round((bitmap.width - w) / 2), y: Math.round((bitmap.height - h) / 2), w, h })
  }

  const width = bitmap?.width ?? 360
  const height = bitmap?.height ?? 240

  return (
    <div>
      <label htmlFor="rdc-file">Choose an image</label>
      <input
        id="rdc-file"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) open(f)
          e.target.value = ''
        }}
      />
      {error && <p className="error" role="alert">{error}</p>}
      {bitmap && <p className="muted">{name} · {bitmap.width} × {bitmap.height} px · drag on the preview to mark an area</p>}

      <div className="row">
        <label style={{ margin: 0 }} htmlFor="rdc-mode">New box mode</label>
        <select id="rdc-mode" value={mode} onChange={(e) => setMode(e.target.value as RedactMode)} style={{ width: 'auto' }}>
          {REDACT_MODES.map((m) => (
            <option key={m} value={m}>{redactLabel(m)}</option>
          ))}
        </select>
        <button type="button" className="btn" disabled={!bitmap} onClick={addCenteredBox}>Add box in the center</button>
        <button type="button" className="btn" disabled={items.length === 0} onClick={() => setItems([])}>Clear all boxes</button>
      </div>

      <div className="two-col">
        <div>
          <div style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--sunken)', touchAction: 'none', cursor: 'crosshair' }}
              aria-label="Image with redactions; drag to mark an area"
              onPointerDown={(e) => {
                if (!bitmap) return
                e.currentTarget.setPointerCapture(e.pointerId)
                const start = toImage(e.currentTarget, e.clientX, e.clientY)
                dragFrom.current = start
                setDraft({ x: start.x, y: start.y, w: 0, h: 0 })
              }}
              onPointerMove={(e) => {
                if (!dragFrom.current || !bitmap) return
                setDraft(clampRect(normalizeRect(dragFrom.current, toImage(e.currentTarget, e.clientX, e.clientY)), bitmap.width, bitmap.height))
              }}
              onPointerUp={(e) => {
                const start = dragFrom.current
                dragFrom.current = null
                setDraft(null)
                if (!start || !bitmap) return
                addRect(clampRect(normalizeRect(start, toImage(e.currentTarget, e.clientX, e.clientY)), bitmap.width, bitmap.height))
              }}
            />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
              {items.map((item) => (
                <span
                  key={item.id}
                  style={{
                    position: 'absolute',
                    left: `${(item.rect.x / width) * 100}%`,
                    top: `${(item.rect.y / height) * 100}%`,
                    width: `${(item.rect.w / width) * 100}%`,
                    height: `${(item.rect.h / height) * 100}%`,
                    border: '2px dashed var(--accent)',
                    borderRadius: 3,
                  }}
                />
              ))}
              {draft && (
                <span
                  style={{
                    position: 'absolute',
                    left: `${(draft.x / width) * 100}%`,
                    top: `${(draft.y / height) * 100}%`,
                    width: `${(draft.w / width) * 100}%`,
                    height: `${(draft.h / height) * 100}%`,
                    border: '2px dashed var(--accent)',
                    borderRadius: 3,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="rdc-block">
            Pixelate block — <b><Roll>{block}</Roll> px</b>
          </label>
          <input id="rdc-block" type="range" min={2} max={48} value={block} onChange={(e) => setBlock(Number(e.target.value))} />

          <div className="stats">
            <div className="stat"><b><Roll>{items.length}</Roll></b>Redaction areas</div>
            <div className="stat"><b>{items.length > 0 ? redactLabel(items[items.length - 1].mode) : '—'}</b>Last mode</div>
          </div>

          {items.length > 0 && (
            <div>
              {items.map((item) => (
                <div key={item.id} className="row" style={{ margin: '8px 0' }}>
                  <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>
                    {item.rect.x},{item.rect.y} · {item.rect.w}×{item.rect.h}
                  </span>
                  <select
                    value={item.mode}
                    aria-label={`Mode for area at ${item.rect.x}, ${item.rect.y}`}
                    onChange={(e) => setItems((old) => old.map((it) => (it.id === item.id ? { ...it, mode: e.target.value as RedactMode } : it)))}
                    style={{ width: 'auto' }}
                  >
                    {REDACT_MODES.map((m) => (
                      <option key={m} value={m}>{redactLabel(m)}</option>
                    ))}
                  </select>
                  <button type="button" className="btn" onClick={() => setItems((old) => old.filter((it) => it.id !== item.id))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="row">
            <button
              type="button"
              className="btn primary btn-icon"
              disabled={!bitmap}
              onClick={() => canvasRef.current && downloadPng(canvasRef.current, `redacted-${name || 'image'}.png`)}
            >
              <Icon name="arrow-down-circle" size={18} />
              Download PNG
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            Everything runs on your device. To be safe, check the exported file before sharing it — pixelation and blur
            cannot be undone by the recipient, but a tiny or lightly blurred area may still be guessed.
          </p>
        </div>
      </div>
    </div>
  )
}
