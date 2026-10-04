import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { POSITIONS, clampFontSize, rotateFor, watermarkAnchor, type Position } from './watermark'

const ARROWS: Record<Position, string> = {
  'top-left': '↖',
  'top-center': '↑',
  'top-right': '↗',
  'middle-left': '←',
  'middle-center': '•',
  'middle-right': '→',
  'bottom-left': '↙',
  'bottom-center': '↓',
  'bottom-right': '↘',
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

export default function ImageWatermark() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [text, setText] = useState('© 4llTools')
  const [position, setPosition] = useState<Position>('bottom-right')
  const [fontSize, setFontSize] = useState(48)
  const [opacity, setOpacity] = useState(0.7)
  const [color, setColor] = useState('#ffffff')
  const [padding, setPadding] = useState(32)
  const [slant, setSlant] = useState(false)
  const [manualAngle, setManualAngle] = useState(0)
  const [url, setUrl] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const urls = useRef<string[]>([])

  useEffect(
    () => () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u))
    },
    [],
  )

  const angle = slant ? rotateFor(position) : manualAngle

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !bitmap) return
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    ctx.globalAlpha = 1
    ctx.drawImage(bitmap, 0, 0)
    const label = text.trim()
    if (!label) return
    const size = clampFontSize(fontSize, bitmap.width)
    ctx.font = `700 ${size}px ui-sans-serif, system-ui, sans-serif`
    const textW = ctx.measureText(label).width
    const anchor = watermarkAnchor(position, bitmap.width, bitmap.height, textW, size, padding)
    ctx.fillStyle = color
    ctx.globalAlpha = opacity
    ctx.textAlign = anchor.textAlign
    ctx.textBaseline = 'alphabetic'
    ctx.save()
    ctx.translate(anchor.x, anchor.y)
    ctx.rotate((angle * Math.PI) / 180)
    ctx.fillText(label, 0, 0)
    ctx.restore()
    ctx.globalAlpha = 1
  }, [bitmap, text, position, fontSize, opacity, color, padding, angle])

  async function open(file: File) {
    setError('')
    try {
      const bmp = await createImageBitmap(file)
      if (url) URL.revokeObjectURL(url)
      const next = URL.createObjectURL(file)
      urls.current.push(next)
      setUrl(next)
      setBitmap(bmp)
      setName(file.name)
    } catch {
      setError('That file could not be opened as an image.')
    }
  }

  return (
    <div>
      <label htmlFor="wmk-file">Choose an image</label>
      <input
        id="wmk-file"
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

      <div className="two-col" style={{ marginTop: 18 }}>
        <div>
          <label htmlFor="wmk-text">Watermark text</label>
          <input id="wmk-text" type="text" value={text} maxLength={80} onChange={(e) => setText(e.target.value)} placeholder="© Your name" />

          <label style={{ marginTop: 16 }}>Position</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 48px)', gap: 6 }} role="group" aria-label="Watermark position">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                className={p === position ? 'btn primary' : 'btn'}
                aria-label={p.replace('-', ' ')}
                aria-pressed={p === position}
                onClick={() => setPosition(p)}
                style={{ height: 40, padding: 0 }}
              >
                <span aria-hidden="true">{ARROWS[p]}</span>
              </button>
            ))}
          </div>

          <label htmlFor="wmk-size" style={{ marginTop: 16 }}>
            Size — <b><Roll>{clampFontSize(fontSize, bitmap?.width ?? 1000)}</Roll> px</b>
          </label>
          <input id="wmk-size" type="range" min={8} max={400} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />

          <label htmlFor="wmk-opacity">
            Opacity — <b><Roll>{Math.round(opacity * 100)}</Roll>%</b>
          </label>
          <input id="wmk-opacity" type="range" min={0.05} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />

          <label htmlFor="wmk-pad">
            Margin — <b><Roll>{padding}</Roll> px</b>
          </label>
          <input id="wmk-pad" type="range" min={0} max={160} value={padding} onChange={(e) => setPadding(Number(e.target.value))} />

          <label htmlFor="wmk-color">Text color</label>
          <input
            id="wmk-color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ width: 96, height: 44, padding: 0, border: 'none', background: 'none' }}
            aria-label="Watermark text color"
          />

          <label className="row" style={{ fontWeight: 400, gap: 8, marginTop: 16 }}>
            <input type="checkbox" checked={slant} onChange={(e) => setSlant(e.target.checked)} />
            Slant the text along the corner
          </label>

          <label htmlFor="wmk-angle">
            Rotation — <b><Roll>{angle}</Roll>°</b>
          </label>
          <input
            id="wmk-angle"
            type="range"
            min={-45}
            max={45}
            step={1}
            value={angle}
            disabled={slant}
            onChange={(e) => setManualAngle(Number(e.target.value))}
          />
        </div>

        <div>
          <canvas
            ref={canvasRef}
            width={bitmap?.width ?? 360}
            height={bitmap?.height ?? 240}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--sunken)' }}
            aria-label="Watermarked preview"
          />
          <div className="row">
            <button
              type="button"
              className="btn primary btn-icon"
              disabled={!bitmap}
              onClick={() => canvasRef.current && downloadPng(canvasRef.current, `watermarked-${name || 'image'}.png`)}
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
