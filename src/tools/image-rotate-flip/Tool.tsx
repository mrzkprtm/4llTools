import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { describe, flipScale, normalizeTurns, rotatedSize } from './transform'

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

export default function ImageRotateFlip() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [turns, setTurns] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const urlRef = useRef('')

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const out = bitmap ? rotatedSize(bitmap.width, bitmap.height, turns) : { w: 360, h: 240 }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !bitmap) return
    canvas.width = Math.max(1, out.w)
    canvas.height = Math.max(1, out.h)
    const { sx, sy } = flipScale(flipH, flipV)
    ctx.imageSmoothingQuality = 'high'
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((normalizeTurns(turns) * Math.PI) / 2)
    ctx.scale(sx, sy)
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    ctx.restore()
  }, [bitmap, out.w, out.h, turns, flipH, flipV])

  async function open(file: File) {
    setError('')
    try {
      const bmp = await createImageBitmap(file)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(file)
      setBitmap(bmp)
      setName(file.name)
      setTurns(0)
      setFlipH(false)
      setFlipV(false)
    } catch {
      setError('That file could not be opened as an image.')
    }
  }

  return (
    <div>
      <label htmlFor="rtf-file">Choose an image</label>
      <input
        id="rtf-file"
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

      <div className="row">
        <button type="button" className="btn btn-icon" disabled={!bitmap} onClick={() => setTurns((t) => normalizeTurns(t - 1))}>
          <Icon name="reload" size={18} />
          Rotate left
        </button>
        <button type="button" className="btn btn-icon" disabled={!bitmap} onClick={() => setTurns((t) => normalizeTurns(t + 1))}>
          <Icon name="reload-circle" size={18} />
          Rotate right
        </button>
        <button type="button" className="btn" aria-pressed={flipH} disabled={!bitmap} onClick={() => setFlipH((v) => !v)}>
          Flip horizontal
        </button>
        <button type="button" className="btn" aria-pressed={flipV} disabled={!bitmap} onClick={() => setFlipV((v) => !v)}>
          Flip vertical
        </button>
        <button
          type="button"
          className="btn"
          disabled={!bitmap}
          onClick={() => {
            setTurns(0)
            setFlipH(false)
            setFlipV(false)
          }}
        >
          Reset
        </button>
      </div>

      <div className="two-col">
        <div>
          <canvas
            ref={canvasRef}
            width={Math.max(1, out.w)}
            height={Math.max(1, out.h)}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--sunken)' }}
            aria-label="Rotated and flipped preview"
          />
        </div>
        <div>
          <div className="stats">
            <div className="stat"><b><Roll>{out.w}</Roll>×<Roll>{out.h}</Roll></b>Output pixels</div>
            <div className="stat"><b><Roll>{normalizeTurns(turns) * 90}</Roll>°</b>Rotation</div>
          </div>
          <p className="muted" aria-live="polite">{describe(turns, flipH, flipV)}</p>
          <div className="row">
            <button
              type="button"
              className="btn primary btn-icon"
              disabled={!bitmap}
              onClick={() => canvasRef.current && downloadPng(canvasRef.current, `transformed-${name || 'image'}.png`)}
            >
              <Icon name="arrow-down-circle" size={18} />
              Download PNG
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            Each press is a lossless 90° turn, so a JPEG saved again as PNG keeps every pixel exactly as it was.
          </p>
        </div>
      </div>
    </div>
  )
}
