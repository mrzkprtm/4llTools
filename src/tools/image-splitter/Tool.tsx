import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { MAX_GRID, clampGrid, parseGrid, splitRects, tileName } from './split'

const PRESETS = ['2x2', '3x3', '4x4', '1x3', '3x1', '6x4']

function savePng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }, 'image/png')
}

export default function ImageSplitter() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(2)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const urlRef = useRef('')

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const tiles = bitmap ? splitRects(bitmap.width, bitmap.height, cols, rows) : []

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !bitmap) return
    const scale = Math.min(1, 720 / bitmap.width)
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    canvas.width = w
    canvas.height = h
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, w, h)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 6])
    for (const tile of splitRects(w, h, cols, rows)) {
      ctx.strokeRect(tile.x + 1, tile.y + 1, Math.max(0, tile.w - 2), Math.max(0, tile.h - 2))
    }
    ctx.setLineDash([])
  }, [bitmap, cols, rows])

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

  function downloadTile(index: number) {
    if (!bitmap) return
    const rect = splitRects(bitmap.width, bitmap.height, cols, rows)[index]
    if (!rect || rect.w < 1 || rect.h < 1) return
    const canvas = document.createElement('canvas')
    canvas.width = rect.w
    canvas.height = rect.h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
    savePng(canvas, tileName(name, index, cols, rows))
  }

  function downloadAll() {
    tiles.forEach((_, i) => window.setTimeout(() => downloadTile(i), i * 220))
  }

  return (
    <div>
      <label htmlFor="spt-file">Choose an image</label>
      <input
        id="spt-file"
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
        <label style={{ margin: 0 }} htmlFor="spt-cols">Columns</label>
        <input
          id="spt-cols"
          type="number"
          min={1}
          max={MAX_GRID}
          value={cols}
          style={{ width: 90 }}
          onChange={(e) => setCols(clampGrid(Number(e.target.value)))}
        />
        <label style={{ margin: 0 }} htmlFor="spt-rows">Rows</label>
        <input
          id="spt-rows"
          type="number"
          min={1}
          max={MAX_GRID}
          value={rows}
          style={{ width: 90 }}
          onChange={(e) => setRows(clampGrid(Number(e.target.value)))}
        />
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="btn"
            onClick={() => {
              const grid = parseGrid(preset)
              setCols(grid.cols)
              setRows(grid.rows)
            }}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="two-col">
        <div>
          <canvas
            ref={canvasRef}
            width={bitmap?.width ?? 360}
            height={bitmap?.height ?? 240}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--sunken)' }}
            aria-label="Preview with the split lines drawn"
          />
        </div>

        <div>
          <div className="stats">
            <div className="stat"><b><Roll>{tiles.length}</Roll></b>Tiles</div>
            <div className="stat"><b><Roll>{cols}</Roll>×<Roll>{rows}</Roll></b>Grid</div>
            <div className="stat">
              <b><Roll>{tiles.length > 0 ? tiles[0].w : 0}</Roll>×<Roll>{tiles.length > 0 ? tiles[0].h : 0}</Roll></b>Tile size
            </div>
          </div>
          <div className="row">
            <button type="button" className="btn primary btn-icon" disabled={tiles.length === 0} onClick={downloadAll}>
              <Icon name="arrow-down-circle" size={18} />
              Download all {tiles.length} tiles
            </button>
          </div>
          {tiles.length > 0 && (
            <div className="row" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {tiles.map((tile, i) => (
                <button key={i} type="button" className="btn" onClick={() => downloadTile(i)}>
                  {tileName(name, i, cols, rows)}
                  <span className="muted" style={{ marginLeft: 6 }}>{tile.w}×{tile.h}</span>
                </button>
              ))}
            </div>
          )}
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            Cut lines are rounded to whole pixels, so tiles always add up to the full image. Your browser may ask once
            before saving several files in a row.
          </p>
        </div>
      </div>
    </div>
  )
}
