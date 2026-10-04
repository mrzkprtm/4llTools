import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { DEFAULT_PALETTES, quantize, targetSize } from './pixelate'

const PALETTE_NAMES = Object.keys(DEFAULT_PALETTES)

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

export default function PixelArtMaker() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [pixelSize, setPixelSize] = useState(12)
  const [paletteName, setPaletteName] = useState('gameboy')
  const [scale, setScale] = useState(8)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const urlRef = useRef('')

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const grid = bitmap ? targetSize(bitmap.width, bitmap.height, pixelSize) : { w: 30, h: 20 }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = Math.max(1, grid.w * scale)
    canvas.height = Math.max(1, grid.h * scale)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!bitmap) return

    const small = document.createElement('canvas')
    small.width = grid.w
    small.height = grid.h
    const sctx = small.getContext('2d', { willReadFrequently: true })
    if (!sctx) return
    sctx.imageSmoothingEnabled = true
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(bitmap, 0, 0, grid.w, grid.h)
    const image = sctx.getImageData(0, 0, grid.w, grid.h)
    quantize(image.data, DEFAULT_PALETTES[paletteName])
    sctx.putImageData(image, 0, 0)
    ctx.drawImage(small, 0, 0, canvas.width, canvas.height)
  }, [bitmap, grid.w, grid.h, scale, paletteName])

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

  return (
    <div>
      <label htmlFor="pxa-file">Choose a photo</label>
      <input
        id="pxa-file"
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
          <label htmlFor="pxa-size">
            Pixel size — <b><Roll>{pixelSize}</Roll> px</b>
          </label>
          <input id="pxa-size" type="range" min={2} max={48} value={pixelSize} onChange={(e) => setPixelSize(Number(e.target.value))} />

          <label htmlFor="pxa-palette">Palette</label>
          <select id="pxa-palette" value={paletteName} onChange={(e) => setPaletteName(e.target.value)}>
            {PALETTE_NAMES.map((key) => (
              <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
            ))}
          </select>

          <label htmlFor="pxa-scale">
            Export scale — <b><Roll>{scale}</Roll>×</b>
          </label>
          <input id="pxa-scale" type="range" min={1} max={16} value={scale} onChange={(e) => setScale(Number(e.target.value))} />

          <div className="stats">
            <div className="stat"><b><Roll>{grid.w}</Roll>×<Roll>{grid.h}</Roll></b>Pixel grid</div>
            <div className="stat"><b><Roll>{grid.w * scale}</Roll>×<Roll>{grid.h * scale}</Roll></b>Exported size</div>
            <div className="stat"><b><Roll>{DEFAULT_PALETTES[paletteName].length}</Roll></b>Colors</div>
          </div>

          <div className="row">
            <button
              type="button"
              className="btn primary btn-icon"
              disabled={!bitmap}
              onClick={() => canvasRef.current && downloadPng(canvasRef.current, `pixel-art-${name || 'image'}.png`)}
            >
              <Icon name="arrow-down-circle" size={18} />
              Download PNG
            </button>
          </div>
        </div>

        <div>
          <canvas
            ref={canvasRef}
            width={Math.max(1, grid.w * scale)}
            height={Math.max(1, grid.h * scale)}
            style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'pixelated', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--sunken)' }}
            aria-label="Pixel art preview"
          />
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            The photo is averaged down to one pixel per block, snapped to the palette, then drawn back up with
            nearest-neighbor scaling so the blocks stay sharp.
          </p>
        </div>
      </div>
    </div>
  )
}
