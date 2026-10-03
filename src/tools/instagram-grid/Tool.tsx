import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import {
  GRID,
  downloadCanvas,
  emptyGrid,
  filledCount,
  loadImageFile,
  moveSlot,
  postOrder,
  renderCell,
  renderStitch,
  squareRect,
  type Slot,
} from './grid'

const TILE_EXPORT = 1080
const STITCH_EXPORT = 1620
const ORDER = postOrder()

export default function Tool() {
  const [mode, setMode] = useState<'slice' | 'stitch'>('slice')
  return (
    <div>
      <div className="row" style={{ marginTop: 0 }}>
        <button type="button" className={`btn ${mode === 'slice' ? 'primary' : ''}`} onClick={() => setMode('slice')}>
          <Icon name="image-multiple" size={16} /> Slice one photo
        </button>
        <button type="button" className={`btn ${mode === 'stitch' ? 'primary' : ''}`} onClick={() => setMode('stitch')}>
          <Icon name="view-columns" size={16} /> Stitch nine photos
        </button>
      </div>
      <p className="muted" style={{ marginTop: 14 }}>
        {mode === 'slice'
          ? 'Upload one photo and get nine square tiles. Post them in the numbered order so your feed reads as one seamless picture.'
          : 'Pick up to nine photos, arrange them, and export a single square image split ready for your feed.'}
      </p>
      {mode === 'slice' ? <Slicer /> : <Stitcher />}
    </div>
  )
}

/* ---------------- Slice mode ---------------- */

function Slicer() {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  const loadFile = useCallback(async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    setError('')
    try {
      setImg(await loadImageFile(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image file.')
    }
  }, [])

  const tileSide = img ? Math.floor(squareRect(img.naturalWidth, img.naturalHeight).side / GRID) : 0

  function downloadAll() {
    if (!img || busy) return
    setBusy(true)
    setSaved(false)
    ORDER.forEach((cellIdx, n) => {
      timer.current = window.setTimeout(() => {
        downloadCanvas(renderCell(img, cellIdx, TILE_EXPORT), `grid-tile-${n + 1}.png`)
        if (n === ORDER.length - 1) {
          setBusy(false)
          setSaved(true)
        }
      }, n * 450)
    })
  }

  return (
    <div>
      {!img ? (
        <div
          className="panel"
          style={{
            borderStyle: 'dashed',
            textAlign: 'center',
            padding: '44px 24px',
            borderColor: dragOver ? 'var(--accent)' : 'var(--border-strong)',
            background: dragOver ? 'var(--accent-soft)' : undefined,
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void loadFile(e.dataTransfer.files?.[0])
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              void loadFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Icon name="image-plus" size={40} />
          <p style={{ margin: '12px 0 4px', fontWeight: 650 }}>Drop a photo here</p>
          <p className="muted" style={{ margin: '0 0 16px' }}>
            Any size works — the middle square is cropped automatically.
          </p>
          <button type="button" className="btn primary" onClick={() => inputRef.current?.click()}>
            Browse images
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      ) : (
        <div>
          <div className="stats">
            <div className="stat">
              Source size
              <b>
                <Roll>{img ? `${img.naturalWidth}×${img.naturalHeight}` : '—'}</Roll>
              </b>
            </div>
            <div className="stat">
              Tiles at
              <b>
                <Roll>{img ? `${TILE_EXPORT}×${TILE_EXPORT}` : '—'}</Roll>
              </b>
            </div>
            <div className="stat">
              Crop used
              <b>
                <Roll>{img ? `${tileSide}px` : '—'}</Roll>
              </b>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 3,
              maxWidth: 480,
              margin: '20px 0 4px',
            }}
          >
            {ORDER.map((cellIdx, n) => (
              <TileCell key={cellIdx} img={img} cellIdx={cellIdx} postN={n + 1} />
            ))}
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Preview shows post order — tile 1 is the last one in the grid, so it appears first in your feed.
          </p>

          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={downloadAll} disabled={busy}>
              {busy ? (
                <span className="busy busy-dots" aria-label="Downloading">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <Icon name="save" size={16} />
              )}
              {busy ? 'Saving tiles…' : saved ? 'Saved! Check your downloads' : 'Download all 9 tiles'}
            </button>
            <button type="button" className="btn" onClick={() => { setImg(null); setSaved(false) }}>
              Choose another photo
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Your browser may ask for permission to download multiple files — allow it to save all nine at once.
          </p>
        </div>
      )}
    </div>
  )
}

function TileCell({ img, cellIdx, postN }: { img: HTMLImageElement; cellIdx: number; postN: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const src = renderCell(img, cellIdx, 324)
    ctx.drawImage(src, 0, 0)
  }, [img, cellIdx])
  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={ref} width={324} height={324} style={{ display: 'block', width: '100%', borderRadius: 2 }} />
      <span
        style={{
          position: 'absolute',
          top: 5,
          left: 5,
          fontFamily: 'var(--mono)',
          fontSize: '0.66rem',
          fontWeight: 600,
          background: 'rgba(20,19,17,0.72)',
          color: '#fff',
          borderRadius: 4,
          padding: '2px 6px',
        }}
      >
        {postN}
      </span>
    </div>
  )
}

/* ---------------- Stitch mode ---------------- */

function Stitcher() {
  const [slots, setSlots] = useState<Slot[]>(emptyGrid)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const filled = filledCount(slots)

  useEffect(() => {
    const ctx = previewRef.current?.getContext('2d')
    if (!ctx) return
    const out = renderStitch(slots, 810)
    ctx.clearRect(0, 0, 810, 810)
    ctx.drawImage(out, 0, 0)
  }, [slots])

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    const imgs: HTMLImageElement[] = []
    for (const file of Array.from(files).slice(0, 9)) {
      if (!file.type.startsWith('image/')) continue
      try {
        imgs.push(await loadImageFile(file))
      } catch {
        setError(`Skipped ${file.name} — not a readable image.`)
      }
    }
    setSlots((prev) => {
      const next = prev.slice()
      let slot = 0
      for (const img of imgs) {
        while (slot < next.length && next[slot].img) slot++
        if (slot >= next.length) break
        next[slot] = { img }
      }
      return next
    })
  }

  return (
    <div className="two-col">
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <button type="button" className="btn primary btn-icon" onClick={() => inputRef.current?.click()}>
          <Icon name="image-plus" size={16} /> Add photos ({filled}/9)
        </button>
        {error && <p className="error">{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
          {slots.map((slot, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                background: 'var(--sunken)',
              }}
            >
              {slot.img ? (
                <img
                  src={slot.img.src}
                  alt={`Tile ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span className="muted" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>
                  {i + 1}
                </span>
              )}
              {slot.img && (
                <div style={{ position: 'absolute', inset: 'auto 0 0 0', display: 'flex', justifyContent: 'space-between', background: 'rgba(20,19,17,0.66)' }}>
                  <button type="button" className="btn btn-icon" style={{ border: 0, background: 'transparent', color: '#fff', padding: '4px 7px' }} aria-label={`Move tile ${i + 1} left`} onClick={() => setSlots((s) => moveSlot(s, i, i - 1))}>
                    <Icon name="chevron-left" size={14} />
                  </button>
                  <button type="button" className="btn btn-icon" style={{ border: 0, background: 'transparent', color: '#fff', padding: '4px 7px' }} aria-label={`Remove tile ${i + 1}`} onClick={() => setSlots((s) => { const n = s.slice(); n[i] = { img: null }; return n })}>
                    <Icon name="close" size={14} />
                  </button>
                  <button type="button" className="btn btn-icon" style={{ border: 0, background: 'transparent', color: '#fff', padding: '4px 7px' }} aria-label={`Move tile ${i + 1} right`} onClick={() => setSlots((s) => moveSlot(s, i, i + 1))}>
                    <Icon name="chevron-right" size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <canvas
          ref={previewRef}
          width={810}
          height={810}
          style={{ display: 'block', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
        />
        <div className="stats">
          <div className="stat">
            Tiles filled
            <b>
              <Roll>{filled}</Roll>
            </b>
          </div>
          <div className="stat">
            Export size
            <b>
              <Roll>{STITCH_EXPORT}</Roll>
            </b>
          </div>
        </div>
        <button
          type="button"
          className="btn primary btn-icon"
          style={{ marginTop: 14 }}
          disabled={filled === 0}
          onClick={() => downloadCanvas(renderStitch(slots, STITCH_EXPORT), 'instagram-grid.png')}
        >
          <Icon name="save" size={16} /> Download grid PNG
        </button>
      </div>
    </div>
  )
}
