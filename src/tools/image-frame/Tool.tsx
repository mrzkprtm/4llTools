import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { FRAME_STYLES, cornerRadius, frameLayout, type FrameStyle } from './frame'

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

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}

export default function ImageFrame() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [style, setStyle] = useState<FrameStyle>('polaroid')
  const [border, setBorder] = useState(40)
  const [frameColor, setFrameColor] = useState('#ffffff')
  const [roundness, setRoundness] = useState(100)
  const [shadow, setShadow] = useState(false)
  const [caption, setCaption] = useState('')
  const [captionColor, setCaptionColor] = useState('#1b1a17')
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const urlRef = useRef('')

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const captionSpace = caption.trim() ? 96 : 0
  const layout = frameLayout(bitmap?.width ?? 600, bitmap?.height ?? 400, style, border, captionSpace)
  const radius = Math.round((cornerRadius(style, layout.imageW) * roundness) / 100)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = layout.canvasW
    canvas.height = layout.canvasH
    ctx.fillStyle = frameColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (style === 'film') {
      const gutter = layout.imageX
      const holeW = Math.max(3, Math.round(gutter * 0.5))
      const holeH = Math.max(6, Math.round(holeW * 1.4))
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
      for (let y = layout.imageY - 4; y < layout.canvasH - holeH; y += holeH * 2) {
        ctx.fillRect(4, y, holeW, holeH)
        ctx.fillRect(layout.canvasW - 4 - holeW, y, holeW, holeH)
      }
    }

    if (shadow) {
      // A shape in the frame colour casts the shadow, so no dark corners peek out.
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
      ctx.shadowBlur = 24
      ctx.shadowOffsetY = 10
      ctx.fillStyle = frameColor
      roundRectPath(ctx, layout.imageX, layout.imageY, layout.imageW, layout.imageH, radius)
      ctx.fill()
      ctx.restore()
    }

    if (bitmap) {
      ctx.save()
      roundRectPath(ctx, layout.imageX, layout.imageY, layout.imageW, layout.imageH, radius)
      ctx.clip()
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bitmap, layout.imageX, layout.imageY, layout.imageW, layout.imageH)
      ctx.restore()
    }

    const text = caption.trim()
    if (text) {
      ctx.fillStyle = captionColor
      ctx.font = `600 ${Math.max(14, Math.round(layout.imageW * 0.04))}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, layout.canvasW / 2, layout.captionY, layout.canvasW - 24)
    }
  }, [bitmap, style, border, frameColor, roundness, caption, captionColor, shadow, layout, radius])

  async function open(file: File) {
    setError('')
    try {
      const bmp = await createImageBitmap(file)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(file)
      setBitmap(bmp)
      setName(file.name.replace(/\.[^.]+$/, ''))
    } catch {
      setError('That file could not be opened as an image.')
    }
  }

  function pickStyle(next: FrameStyle) {
    setStyle(next)
    if (next === 'film' && frameColor === '#ffffff') setFrameColor('#111111')
    if (next !== 'film' && frameColor === '#111111') setFrameColor('#ffffff')
    setShadow(next === 'shadow')
    if (next === 'film') setCaptionColor('#ffffff')
    else if (captionColor === '#ffffff') setCaptionColor('#1b1a17')
  }

  return (
    <div>
      <label htmlFor="imf-file">Choose a photo</label>
      <input
        id="imf-file"
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

      <label style={{ marginTop: 16 }}>Frame style</label>
      <div className="row" style={{ marginTop: 0 }} role="group" aria-label="Frame style">
        {FRAME_STYLES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === style ? 'btn primary' : 'btn'}
            aria-pressed={item.id === style}
            onClick={() => pickStyle(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="two-col">
        <div>
          <label htmlFor="imf-border">
            Border width — <b><Roll>{border}</Roll> px</b>
          </label>
          <input id="imf-border" type="range" min={0} max={160} value={border} onChange={(e) => setBorder(Number(e.target.value))} />

          <label htmlFor="imf-round">
            Corner roundness — <b><Roll>{radius}</Roll> px</b>
          </label>
          <input id="imf-round" type="range" min={0} max={200} value={roundness} onChange={(e) => setRoundness(Number(e.target.value))} />

          <label htmlFor="imf-caption">Caption (optional)</label>
          <input id="imf-caption" type="text" value={caption} maxLength={60} placeholder="Summer 2026" onChange={(e) => setCaption(e.target.value)} />

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <span style={{ flex: 1 }}>
              <label htmlFor="imf-frame-color" style={{ marginTop: 0 }}>Frame color</label>
              <input
                id="imf-frame-color"
                type="color"
                value={frameColor}
                onChange={(e) => setFrameColor(e.target.value)}
                style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }}
                aria-label="Frame color"
              />
            </span>
            <span style={{ flex: 1 }}>
              <label htmlFor="imf-caption-color" style={{ marginTop: 0 }}>Caption color</label>
              <input
                id="imf-caption-color"
                type="color"
                value={captionColor}
                onChange={(e) => setCaptionColor(e.target.value)}
                style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }}
                aria-label="Caption color"
              />
            </span>
          </div>

          <label className="row" style={{ fontWeight: 400, gap: 8 }}>
            <input type="checkbox" checked={shadow} onChange={(e) => setShadow(e.target.checked)} />
            Drop shadow behind the photo
          </label>
        </div>

        <div>
          <canvas
            ref={canvasRef}
            width={layout.canvasW}
            height={layout.canvasH}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
            aria-label="Framed photo preview"
          />
          <div className="stats">
            <div className="stat"><b><Roll>{layout.canvasW}</Roll>×<Roll>{layout.canvasH}</Roll></b>Exported size</div>
            <div className="stat"><b><Roll>{layout.imageX}</Roll> px</b>Margin</div>
            <div className="stat"><b><Roll>{radius}</Roll> px</b>Corner radius</div>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn primary btn-icon"
              disabled={!bitmap}
              onClick={() => canvasRef.current && downloadPng(canvasRef.current, `framed-${name || 'image'}.png`)}
            >
              <Icon name="arrow-down-circle" size={18} />
              Download PNG
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            The photo itself is never resampled: the frame is added around it, so the pixels you started with stay
            exactly as they were.
          </p>
        </div>
      </div>
    </div>
  )
}
