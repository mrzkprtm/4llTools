import { useEffect, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import type { Prepared } from './build'
import { formatBytes, pageSize, pdfFileName, placeImage, targetPixels, type Fit, type Orientation, type PageSize } from './layout'
import './tool.css'

interface Item {
  id: number
  file: Blob
  name: string
  url: string
  w: number
  h: number
  png: boolean
  sample?: boolean
}

let nextId = 1

async function sampleImages(): Promise<Item[]> {
  const specs: [string, number, number, string, string][] = [
    ['sample-landscape.jpg', 1200, 800, '#0ea5e9', '#1e3a8a'],
    ['sample-portrait.jpg', 800, 1100, '#f97316', '#9d174d'],
    ['sample-square.png', 900, 900, '#22c55e', '#0f766e'],
  ]
  const out: Item[] = []
  for (const [name, w, h, a, b] of specs) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d')
    if (!x) continue
    const g = x.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, a)
    g.addColorStop(1, b)
    x.fillStyle = g
    x.fillRect(0, 0, w, h)
    x.fillStyle = 'rgba(255,255,255,0.18)'
    for (let i = 0; i < 6; i++) {
      x.beginPath()
      x.arc(w * (0.15 + i * 0.15), h * (0.3 + (i % 2) * 0.35), Math.min(w, h) * (0.08 + i * 0.02), 0, Math.PI * 2)
      x.fill()
    }
    x.fillStyle = '#fff'
    x.font = `700 ${Math.round(Math.min(w, h) / 9)}px system-ui, sans-serif`
    x.textAlign = 'center'
    x.fillText(`${w} × ${h}`, w / 2, h / 2 + Math.min(w, h) / 30)
    const png = name.endsWith('.png')
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.9))
    if (blob) out.push({ id: nextId++, file: blob, name, url: URL.createObjectURL(blob), w, h, png, sample: true })
  }
  return out
}

/** Decodes (honouring EXIF rotation), crops and re-encodes one image for the PDF. */
async function prepare(it: Item, crop: { sx: number; sy: number; sw: number; sh: number }, px: { w: number; h: number }, quality: number): Promise<Prepared> {
  const bmp = await createImageBitmap(it.file)
  const c = document.createElement('canvas')
  c.width = px.w
  c.height = px.h
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')
  const lossless = it.png && quality >= 1
  if (!lossless) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.imageSmoothingQuality = 'high'
  // Scale crop from the decoded bitmap size (may differ from stored size after rotation).
  const kx = bmp.width / it.w
  const ky = bmp.height / it.h
  ctx.drawImage(bmp, crop.sx * kx, crop.sy * ky, crop.sw * kx, crop.sh * ky, 0, 0, px.w, px.h)
  bmp.close()
  const type = lossless ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, type, quality))
  if (!blob) throw new Error(`Could not encode “${it.name}”. It may be too large for this device.`)
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: lossless ? 'png' : 'jpg', srcW: it.w, srcH: it.h }
}

export default function ImagesToPdf() {
  const [items, setItems] = useState<Item[]>([])
  const [size, setSize] = useState<PageSize>('a4')
  const [orientation, setOrientation] = useState<Orientation>('auto')
  const [margin, setMargin] = useState(24)
  const [fit, setFit] = useState<Fit>('contain')
  const [quality, setQuality] = useState(0.85)
  const [dpi, setDpi] = useState(200)
  const [name, setName] = useState('images')
  const [over, setOver] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number; stage: string } | null>(null)
  const [result, setResult] = useState<{ url: string; name: string; size: number; pages: number } | null>(null)
  const [error, setError] = useState('')
  const itemsRef = useRef(items)
  itemsRef.current = items
  const grid = useRef<HTMLDivElement>(null)
  useFlip(grid)

  useEffect(() => {
    let alive = true
    sampleImages().then((s) => {
      if (alive) setItems((cur) => (cur.length ? (s.forEach((i) => URL.revokeObjectURL(i.url)), cur) : s))
      else s.forEach((i) => URL.revokeObjectURL(i.url))
    })
    return () => {
      alive = false
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url))
    }
  }, [])

  useEffect(() => {
    if (result) return () => URL.revokeObjectURL(result.url)
  }, [result])

  const touch = () => setResult(null)

  async function add(files: File[]) {
    setError('')
    const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name))
    if (!imgs.length) return setError('Please choose image files (JPG, PNG, WebP…).')
    const fresh: Item[] = []
    const bad: string[] = []
    for (const f of imgs) {
      try {
        const bmp = await createImageBitmap(f)
        fresh.push({ id: nextId++, file: f, name: f.name, url: URL.createObjectURL(f), w: bmp.width, h: bmp.height, png: f.type === 'image/png' || /\.png$/i.test(f.name) })
        bmp.close()
      } catch {
        bad.push(f.name)
      }
    }
    if (bad.length) setError(`Could not open ${bad.join(', ')}. HEIC photos need converting to JPG first.`)
    setItems((cur) => {
      const real = cur.filter((i) => !i.sample)
      cur.filter((i) => i.sample).forEach((i) => URL.revokeObjectURL(i.url))
      return [...real, ...fresh]
    })
    touch()
  }

  function remove(id: number) {
    const it = items.find((i) => i.id === id)
    if (it) URL.revokeObjectURL(it.url)
    setItems((l) => l.filter((i) => i.id !== id))
    touch()
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return
    setItems((l) => {
      const n = l.slice()
      const [x] = n.splice(from, 1)
      n.splice(to, 0, x)
      return n
    })
    touch()
  }

  async function build() {
    setError('')
    setResult(null)
    const list = items
    setProgress({ done: 0, total: list.length, stage: 'Preparing images' })
    try {
      const prepared: Prepared[] = []
      for (let i = 0; i < list.length; i++) {
        const it = list[i]
        const [pw, ph] = pageSize(it.w, it.h, size, orientation, margin)
        const p = placeImage(it.w, it.h, pw, ph, margin, fit)
        const px = targetPixels(p.crop.sw, p.crop.sh, p.w, p.h, dpi)
        prepared.push(await prepare(it, p.crop, px, quality))
        setProgress({ done: i + 1, total: list.length, stage: 'Preparing images' })
      }
      setProgress({ done: 0, total: list.length, stage: 'Writing PDF' })
      const { buildPdf } = await import('./build')
      const bytes = await buildPdf(prepared, { size, orientation, margin, fit, title: name.trim() || undefined }, (d) => setProgress({ done: d, total: list.length, stage: 'Writing PDF' }))
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      setResult({ url: URL.createObjectURL(blob), name: pdfFileName(name), size: blob.size, pages: list.length })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the PDF.')
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null
  const opt = (fn: () => void) => () => { fn(); touch() }

  return (
    <div>
      <div
        className={`ip-drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); add([...e.dataTransfer.files]) }}
      >
        <p style={{ fontWeight: 600 }}>Drop images here</p>
        <label htmlFor="ip-files" className="btn primary" style={{ display: 'inline-block', margin: 0 }}>Choose images</label>
        <input id="ip-files" className="ip-hidden-input" type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) add([...e.target.files]); e.target.value = '' }} />
        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>JPG, PNG, WebP, GIF, AVIF. Nothing is uploaded.</p>
      </div>
      {items.some((i) => i.sample) && <p className="muted" style={{ fontSize: '0.85rem', margin: '6px 0 0' }}>Showing sample images. Adding your own replaces them.</p>}

      <div className="ip-controls">
        <div>
          <label htmlFor="ip-size">Page size</label>
          <select id="ip-size" value={size} onChange={(e) => { setSize(e.target.value as PageSize); touch() }}>
            <option value="a4">A4 (210 × 297 mm)</option>
            <option value="letter">US Letter (8.5 × 11 in)</option>
            <option value="legal">US Legal (8.5 × 14 in)</option>
            <option value="fit">Fit to each image</option>
          </select>
        </div>
        <div>
          <label htmlFor="ip-orient">Orientation</label>
          <select id="ip-orient" value={orientation} onChange={(e) => { setOrientation(e.target.value as Orientation); touch() }} disabled={size === 'fit'}>
            <option value="auto">Auto (match each image)</option>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
        <div>
          <label htmlFor="ip-margin">Margin: {Math.round(margin / 72 * 25.4)} mm</label>
          <input id="ip-margin" type="range" min={0} max={72} step={2} value={margin} onChange={(e) => { setMargin(Number(e.target.value)); touch() }} style={{ width: '100%' }} />
        </div>
        <div>
          <label htmlFor="ip-q">Quality: {quality >= 1 ? '100% (PNG stays lossless)' : `${Math.round(quality * 100)}%`}</label>
          <input id="ip-q" type="range" min={0.4} max={1} step={0.05} value={quality} onChange={(e) => { setQuality(Number(e.target.value)); touch() }} style={{ width: '100%' }} />
        </div>
        <div>
          <label htmlFor="ip-dpi">Image resolution</label>
          <select id="ip-dpi" value={dpi} onChange={(e) => { setDpi(Number(e.target.value)); touch() }}>
            <option value={0}>Original pixels (largest file)</option>
            <option value={300}>300 DPI (print)</option>
            <option value={200}>200 DPI (balanced)</option>
            <option value={120}>120 DPI (small, screen)</option>
          </select>
        </div>
        <div>
          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.92rem', margin: '16px 0 6px' }}>Image fit</span>
          <PillRow label="Image fit">
            <button type="button" aria-pressed={fit === 'contain'} className={fit === 'contain' ? 'btn primary' : 'btn'} onClick={opt(() => setFit('contain'))}>Contain</button>
            <button type="button" aria-pressed={fit === 'cover'} className={fit === 'cover' ? 'btn primary' : 'btn'} onClick={opt(() => setFit('cover'))}>Fill page</button>
          </PillRow>
        </div>
      </div>

      {items.length > 0 && (
        <div className="ip-grid" ref={grid} aria-label="Pages in order">
          {items.map((it, i) => {
            const [pw, ph] = pageSize(it.w, it.h, size, orientation, margin)
            const k = Math.min(100 / pw, 116 / ph)
            const p = placeImage(it.w, it.h, pw, ph, margin, fit)
            const ratio = p.w / p.crop.sw
            return (
              <div
                key={it.id}
                data-flip={String(it.id)}
                className={`ip-card ${drag === i ? 'is-dragging' : ''} ${target === i && drag !== null && drag !== i ? 'is-target' : ''}`}
                draggable
                onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) }}
                onDragOver={(e) => { if (drag !== null) { e.preventDefault(); setTarget(i) } }}
                onDrop={(e) => { if (drag === null) return; e.preventDefault(); move(drag, i); setDrag(null); setTarget(null) }}
                onDragEnd={() => { setDrag(null); setTarget(null) }}
              >
                <div className="ip-pagebox">
                  <div className="ip-page" style={{ width: pw * k, height: ph * k }}>
                    <span className="ip-num">{i + 1}</span>
                    <div className="ip-clip" style={{ left: p.x * k, top: (ph - p.y - p.h) * k, width: p.w * k, height: p.h * k }}>
                      <img src={it.url} alt="" style={{ left: -p.crop.sx * ratio * k, top: -p.crop.sy * ratio * k, width: it.w * ratio * k, height: it.h * ratio * k }} />
                    </div>
                  </div>
                </div>
                <span className="ip-name" title={it.name}>{it.name}</span>
                <span className="ip-sub">{it.w} × {it.h}</span>
                <span className="ip-ctrl">
                  <button type="button" className="btn" onClick={() => move(i, i - 1)} disabled={i === 0 || busy} aria-label={`Move ${it.name} earlier`}>←</button>
                  <button type="button" className="btn" onClick={() => move(i, i + 1)} disabled={i === items.length - 1 || busy} aria-label={`Move ${it.name} later`}>→</button>
                  <button type="button" className="btn" onClick={() => remove(it.id)} disabled={busy} aria-label={`Remove ${it.name}`}>×</button>
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <label htmlFor="ip-name" style={{ fontWeight: 500 }}>File name</label>
        <input id="ip-name" type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: '1 1 160px', width: 'auto' }} />
      </div>
      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={build} disabled={!items.length || busy}><Icon name="file-plus" size={18} /> Create PDF ({items.length} page{items.length === 1 ? '' : 's'})</button>
        {items.length > 0 && <button type="button" className="btn" disabled={busy} onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.url)); setItems([]); touch() }}>Clear all</button>}
      </div>

      {progress && (
        <div aria-live="polite">
          <Busy label={`${progress.stage} ${progress.done}/${progress.total}…`} />
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <i style={{ transform: `scaleX(${progress.total ? (progress.done / progress.total) * (progress.stage === 'Writing PDF' ? 0.3 : 0.7) + (progress.stage === 'Writing PDF' ? 0.7 : 0) : 0})` }} />
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {result && (
        <div className="ip-result">
          <span style={{ minWidth: 0 }}>
            <span className="chip good"><Check size={14} /> PDF ready</span>{' '}
            <b style={{ overflowWrap: 'anywhere' }}>{result.name}</b>
            <br />
            <span className="muted" style={{ fontSize: '0.85rem' }}><Roll>{result.pages}</Roll> page{result.pages === 1 ? '' : 's'} · <Roll>{formatBytes(result.size)}</Roll></span>
          </span>
          <a className="btn primary shine" href={result.url} download={result.name}>Download PDF</a>
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        Drag the pages (or use the arrows) to set the order. Each image becomes one page. Photos are straightened using their EXIF rotation, then re-encoded as JPEG at the quality and resolution you choose; at 100% quality, PNG images stay lossless.
        Transparent areas become white. Everything happens in your browser with pdf-lib, so your images stay on your device. Very large batches of big photos can use a lot of memory on phones.
      </p>
    </div>
  )
}
