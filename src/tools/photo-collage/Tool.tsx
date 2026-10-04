import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { MAX_COLS, clampCols, computeGrid, fitCell } from './collage'

const MAX_PHOTOS = 12

interface Shot {
  url: string
  bitmap: ImageBitmap
  name: string
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

export default function PhotoCollage() {
  const [shots, setShots] = useState<Shot[]>([])
  const [cols, setCols] = useState(3)
  const [cellSize, setCellSize] = useState(320)
  const [gap, setGap] = useState(12)
  const [background, setBackground] = useState('#ffffff')
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const urls = useRef<string[]>([])

  useEffect(
    () => () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u))
    },
    [],
  )

  const grid = useMemo(() => computeGrid(shots.length, cols, cellSize, gap), [shots.length, cols, cellSize, gap])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = Math.max(1, grid.width)
    canvas.height = Math.max(1, grid.height)
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (grid.cells.length === 0) {
      ctx.fillStyle = '#9aa0a6'
      ctx.font = '600 26px ui-sans-serif, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Add photos to build a collage', canvas.width / 2, canvas.height / 2)
      return
    }
    shots.forEach((shot, i) => {
      const cell = grid.cells[i]
      if (!cell) return
      const fit = fitCell(shot.bitmap.width, shot.bitmap.height, cell.w, cell.h)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(shot.bitmap, cell.x + (cell.w - fit.w) / 2, cell.y + (cell.h - fit.h) / 2, fit.w, fit.h)
    })
  }, [shots, grid, background])

  async function addFiles(files: FileList | File[]) {
    setError('')
    const picked = [...files].slice(0, MAX_PHOTOS - shots.length)
    const loaded: Shot[] = []
    for (const file of picked) {
      try {
        const bitmap = await createImageBitmap(file)
        const url = URL.createObjectURL(file)
        urls.current.push(url)
        loaded.push({ url, bitmap, name: file.name })
      } catch {
        /* a file the browser cannot decode is skipped */
      }
    }
    if (loaded.length === 0) {
      setError('Those files could not be opened as images.')
      return
    }
    setShots((old) => [...old, ...loaded].slice(0, MAX_PHOTOS))
  }

  function remove(i: number) {
    const dropped = shots[i]
    if (dropped) {
      URL.revokeObjectURL(dropped.url)
      urls.current = urls.current.filter((u) => u !== dropped.url)
    }
    setShots((old) => old.filter((_, j) => j !== i))
  }

  function clear() {
    urls.current.forEach((u) => URL.revokeObjectURL(u))
    urls.current = []
    setShots([])
  }

  return (
    <div>
      <label htmlFor="clg-files">Choose photos</label>
      <input
        id="clg-files"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: 6 }}>
        Up to {MAX_PHOTOS} photos. They are read locally and never uploaded.
      </p>
      {error && <p className="error" role="alert">{error}</p>}

      {shots.length > 0 && (
        <div className="row">
          {shots.map((shot, i) => (
            <span key={shot.url} style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={shot.url}
                alt={shot.name}
                style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }}
              />
              <button
                type="button"
                className="btn"
                aria-label={`Remove ${shot.name}`}
                onClick={() => remove(i)}
                style={{ position: 'absolute', top: -8, right: -8, padding: '1px 7px', lineHeight: 1.2 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="two-col" style={{ marginTop: 18 }}>
        <div>
          <label htmlFor="clg-cols">
            Columns — <b><Roll>{grid.cols}</Roll></b>
          </label>
          <input id="clg-cols" type="range" min={1} max={MAX_COLS} value={cols} onChange={(e) => setCols(clampCols(Number(e.target.value)))} />

          <label htmlFor="clg-cell">
            Cell size — <b><Roll>{cellSize}</Roll> px</b>
          </label>
          <input id="clg-cell" type="range" min={80} max={600} step={10} value={cellSize} onChange={(e) => setCellSize(Number(e.target.value))} />

          <label htmlFor="clg-gap">
            Gap — <b><Roll>{gap}</Roll> px</b>
          </label>
          <input id="clg-gap" type="range" min={0} max={60} value={gap} onChange={(e) => setGap(Number(e.target.value))} />

          <label htmlFor="clg-bg" style={{ marginTop: 16 }}>Background color</label>
          <input
            id="clg-bg"
            type="color"
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            style={{ width: 96, height: 44, padding: 0, border: 'none', background: 'none' }}
            aria-label="Collage background color"
          />

          <div className="row">
            <button type="button" className="btn" onClick={clear} disabled={shots.length === 0}>Clear photos</button>
          </div>
        </div>

        <div>
          <canvas
            ref={canvasRef}
            width={Math.max(1, grid.width)}
            height={Math.max(1, grid.height)}
            style={{ display: 'block', width: '100%', height: 'auto', maxWidth: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff' }}
            aria-label="Collage preview"
          />
          <div className="stats">
            <div className="stat"><b><Roll>{shots.length}</Roll></b>Photos</div>
            <div className="stat"><b><Roll>{grid.cols}</Roll>×<Roll>{grid.rows}</Roll></b>Grid</div>
            <div className="stat"><b><Roll>{grid.width}</Roll>×<Roll>{grid.height}</Roll></b>Pixels</div>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn primary btn-icon"
              disabled={shots.length === 0}
              onClick={() => canvasRef.current && downloadPng(canvasRef.current, 'collage.png')}
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
