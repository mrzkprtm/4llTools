import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { FILTERS, clampIntensity, filterCss } from './filters'

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

export default function PhotoFilters() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('grayscale')
  const [intensity, setIntensity] = useState(1)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const urlRef = useRef('')

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const css = filterCss(preset, intensity)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const w = bitmap?.width ?? 360
    const h = bitmap?.height ?? 240
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)
    if (!bitmap) return
    ctx.filter = css
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0)
    ctx.filter = 'none'
  }, [bitmap, css])

  async function open(file: File) {
    setError('')
    try {
      const bmp = await createImageBitmap(file)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(file)
      setBitmap(bmp)
      setName(file.name)
    } catch {
      setError('That file could not be opened as an image.')
    }
  }

  const active = FILTERS.find((f) => f.id === preset)

  return (
    <div>
      <label htmlFor="flt-file">Choose a photo</label>
      <input
        id="flt-file"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) open(f)
          e.target.value = ''
        }}
      />
      {error && <p className="error" role="alert">{error}</p>}
      {bitmap && <p className="muted">{name} · {bitmap.width} × {bitmap.height} px</p>}

      <label style={{ marginTop: 16 }}>Filter</label>
      <div className="row" style={{ marginTop: 0 }} role="group" aria-label="Filter preset">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={f.id === preset ? 'btn primary' : 'btn'}
            aria-pressed={f.id === preset}
            onClick={() => setPreset(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label htmlFor="flt-int">
        Strength — <b><Roll>{Math.round(intensity * 100)}</Roll>%</b>
      </label>
      <input
        id="flt-int"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={intensity}
        onChange={(e) => setIntensity(clampIntensity(Number(e.target.value)))}
      />

      <div className="two-col">
        <div>
          <canvas
            ref={canvasRef}
            width={bitmap?.width ?? 360}
            height={bitmap?.height ?? 240}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--sunken)' }}
            aria-label="Filtered preview"
          />
        </div>
        <div>
          <p className="output" aria-live="polite">filter: {css}</p>
          <p className="muted">
            {active ? `${active.label} at ${Math.round(intensity * 100)}% strength.` : 'No filter selected.'} The preview and the
            exported PNG use the same CSS filter chain, so what you see is what you save.
          </p>
          <div className="row">
            <button
              type="button"
              className="btn primary btn-icon"
              disabled={!bitmap}
              onClick={() => canvasRef.current && downloadPng(canvasRef.current, `${preset}-${name || 'image'}.png`)}
            >
              <Icon name="arrow-down-circle" size={18} />
              Download PNG
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
