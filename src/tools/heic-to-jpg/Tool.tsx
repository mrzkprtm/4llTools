import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Busy from '../../components/Busy'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { detectHeif, formatBytes, friendlyError, looksLikeHeicName, outputName, type OutType } from './heic'
import './tool.css'

interface Item {
  id: number
  file: File
  status: 'queued' | 'working' | 'done' | 'error'
  url?: string
  outName?: string
  outSize?: number
  ms?: number
  note?: string
  error?: string
}

type Heic2any = (o: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob | Blob[]>

/** Re-encodes anything the browser can decode itself (JPG, PNG, AVIF, and HEIC on Safari 17+). */
async function viaCanvas(file: Blob, type: OutType, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const out = await new Promise<Blob | null>((res) => c.toBlob(res, type, quality))
  if (!out) throw new Error('The browser could not encode the image.')
  return out
}

export default function HeicToJpg() {
  const [items, setItems] = useState<Item[]>([])
  const [type, setType] = useState<OutType>('image/jpeg')
  const [quality, setQuality] = useState(0.9)
  const [over, setOver] = useState(false)
  const [loadingLib, setLoadingLib] = useState(false)
  const [error, setError] = useState('')
  const nextId = useRef(1)
  const running = useRef(false)
  const lib = useRef<Heic2any | null>(null)
  const taken = useRef(new Set<string>())
  const settings = useRef({ type, quality })
  settings.current = { type, quality }
  const itemsRef = useRef(items)
  itemsRef.current = items
  const list = useRef<HTMLDivElement>(null)
  useFlip(list, { max: 40 })

  useEffect(() => () => itemsRef.current.forEach((i) => i.url && URL.revokeObjectURL(i.url)), [])

  const patch = (id: number, p: Partial<Item>) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)))

  async function convert(file: File): Promise<{ blob: Blob; note?: string }> {
    const { type: t, quality: q } = settings.current
    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer())
    const kind = detectHeif(head)
    if (kind !== 'heic' && !looksLikeHeicName(file.name)) {
      return { blob: await viaCanvas(file, t, q), note: 'Not a HEIC file, so it was simply re-encoded.' }
    }
    try {
      if (!lib.current) {
        setLoadingLib(true)
        try {
          lib.current = (await import('heic2any')).default as Heic2any
        } finally {
          setLoadingLib(false)
        }
      }
      // Let the "Converting…" state paint before the decoder blocks the main thread.
      await new Promise((r) => setTimeout(r, 30))
      const out = await lib.current({ blob: file, toType: t, quality: q })
      if (Array.isArray(out)) return { blob: out[0], note: out.length > 1 ? `This file holds ${out.length} images; the first (primary) one was converted.` : undefined }
      return { blob: out }
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? '')
      if (/already browser readable/i.test(msg)) return { blob: await viaCanvas(file, t, q), note: 'Your browser can read this file directly, so it was re-encoded.' }
      // Safari 17+ decodes HEIC natively; try that before giving up.
      try {
        return { blob: await viaCanvas(file, t, q), note: 'Converted with your browser’s built-in HEIC decoder.' }
      } catch {
        throw err
      }
    }
  }

  async function pump() {
    if (running.current) return
    running.current = true
    try {
      for (;;) {
        const next = itemsRef.current.find((i) => i.status === 'queued')
        if (!next) break
        patch(next.id, { status: 'working' })
        itemsRef.current = itemsRef.current.map((i) => (i.id === next.id ? { ...i, status: 'working' } : i))
        const t0 = performance.now()
        try {
          const { blob, note } = await convert(next.file)
          const url = URL.createObjectURL(blob)
          const outName = outputName(next.file.name, settings.current.type, taken.current)
          patch(next.id, { status: 'done', url, outName, outSize: blob.size, ms: performance.now() - t0, note })
          itemsRef.current = itemsRef.current.map((i) => (i.id === next.id ? { ...i, status: 'done' } : i))
        } catch (err) {
          patch(next.id, { status: 'error', error: friendlyError(err) })
          itemsRef.current = itemsRef.current.map((i) => (i.id === next.id ? { ...i, status: 'error' } : i))
        }
      }
    } finally {
      running.current = false
    }
  }

  function add(files: FileList | File[]) {
    setError('')
    const ok = [...files].filter((f) => looksLikeHeicName(f.name) || /^image\//.test(f.type) || f.type === '')
    if (!ok.length) {
      setError('Please choose .heic or .heif photos.')
      return
    }
    const fresh: Item[] = ok.map((file) => ({ id: nextId.current++, file, status: 'queued' }))
    itemsRef.current = [...itemsRef.current, ...fresh]
    setItems(itemsRef.current)
    setTimeout(pump, 0)
  }

  function reconvert() {
    items.forEach((i) => i.url && URL.revokeObjectURL(i.url))
    taken.current.clear()
    itemsRef.current = items.map((i) => ({ id: i.id, file: i.file, status: 'queued' }))
    setItems(itemsRef.current)
    setTimeout(pump, 0)
  }

  function remove(id: number) {
    const it = items.find((i) => i.id === id)
    if (it?.url) URL.revokeObjectURL(it.url)
    if (it?.outName) taken.current.delete(it.outName.toLowerCase())
    itemsRef.current = itemsRef.current.filter((i) => i.id !== id)
    setItems(itemsRef.current)
  }

  function clear() {
    items.forEach((i) => i.url && URL.revokeObjectURL(i.url))
    taken.current.clear()
    itemsRef.current = []
    setItems([])
  }

  function downloadAll() {
    items.filter((i) => i.url).forEach((i, n) => setTimeout(() => {
      const a = document.createElement('a')
      a.href = i.url!
      a.download = i.outName!
      a.click()
    }, n * 300))
  }

  const done = items.filter((i) => i.status === 'done')
  const finished = items.filter((i) => i.status === 'done' || i.status === 'error').length
  const working = items.some((i) => i.status === 'working' || i.status === 'queued')
  const saved = done.reduce((n, i) => n + i.file.size, 0)
  const outTotal = done.reduce((n, i) => n + (i.outSize ?? 0), 0)

  return (
    <div>
      <div
        className={`hc-drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
      >
        <span className="hc-phone" aria-hidden="true"><Icon name="smartphone-apps" size={28} /></span>
        <p style={{ fontWeight: 600 }}>Drop iPhone photos (.heic, .heif) here</p>
        <label htmlFor="hc-files" className="btn primary" style={{ display: 'inline-block', margin: 0 }}>Choose HEIC photos</label>
        <input id="hc-files" className="hc-hidden-input" type="file" multiple accept=".heic,.heif,.hif,image/heic,image/heif" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = '' }} />
        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>Converted on your device. Nothing is uploaded.</p>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <PillRow label="Output format">
          <button type="button" aria-pressed={type === 'image/jpeg'} className={type === 'image/jpeg' ? 'btn primary' : 'btn'} onClick={() => setType('image/jpeg')}>JPG</button>
          <button type="button" aria-pressed={type === 'image/png'} className={type === 'image/png' ? 'btn primary' : 'btn'} onClick={() => setType('image/png')}>PNG</button>
        </PillRow>
        {type === 'image/jpeg' && (
          <div style={{ flex: '1 1 200px' }}>
            <label htmlFor="hc-q" style={{ margin: '0 0 2px', fontWeight: 500 }}>Quality: {Math.round(quality * 100)}%</label>
            <input id="hc-q" type="range" min={0.4} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: '100%' }} />
          </div>
        )}
      </div>
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: 0 }}>{type === 'image/png' ? 'PNG is lossless but files are several times larger than the HEIC original.' : '90% keeps photos visually identical at a reasonable size.'}</p>

      {error && <p className="error" role="alert">{error}</p>}
      {loadingLib && <Busy label="Loading the HEIC decoder (about 1 MB, once)…" />}

      {items.length > 0 && (
        <>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={finished} aria-label="Overall progress" style={{ marginTop: 14 }}>
            <i style={{ transform: `scaleX(${items.length ? finished / items.length : 0})` }} />
          </div>
          <div className="stats">
            <div className="stat"><b><Roll>{`${done.length}/${items.length}`}</Roll></b>Converted</div>
            <div className="stat"><b><Roll>{formatBytes(saved)}</Roll></b>HEIC in</div>
            <div className="stat"><b><Roll>{formatBytes(outTotal)}</Roll></b>{type === 'image/png' ? 'PNG' : 'JPG'} out</div>
          </div>
          <div className="row">
            {done.length > 1 && <button type="button" className="btn primary btn-icon" onClick={downloadAll} disabled={working}><Icon name="arrow-down-circle" size={18} /> Download all ({done.length})</button>}
            <button type="button" className="btn" onClick={reconvert} disabled={working}>Convert again with these settings</button>
            <button type="button" className="btn" onClick={clear} disabled={working}>Clear</button>
            {working && <Busy label="Converting…" />}
          </div>
        </>
      )}

      <div className="hc-list" ref={list}>
        {items.map((it) => (
          <div key={it.id} data-flip={String(it.id)} className={`hc-item hc-status-${it.status} ${it.status === 'working' ? 'busy-bar' : ''}`}>
            <div className="hc-thumb">{it.url ? <img src={it.url} alt="" /> : it.status === 'error' ? '!' : 'HEIC'}</div>
            <div style={{ minWidth: 0 }}>
              <div className="hc-name">{it.status === 'done' ? it.outName : it.file.name}</div>
              <div className="hc-sub" aria-live="polite">
                {it.status === 'queued' && `Waiting · ${formatBytes(it.file.size)}`}
                {it.status === 'working' && `Converting ${formatBytes(it.file.size)}…`}
                {it.status === 'done' && <>{formatBytes(it.file.size)} → {formatBytes(it.outSize ?? 0)} · {((it.ms ?? 0) / 1000).toFixed(1)} s</>}
              </div>
              {it.status === 'working' && <div className="bar hc-bar indeterminate" aria-hidden="true"><i /></div>}
              {it.status === 'error' && <p className="error" style={{ margin: '4px 0 0' }}>{it.error}</p>}
              {it.note && <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>{it.note}</p>}
              <div className="hc-actions">
                {it.status === 'done' && it.url && (
                  <>
                    <span className="chip good"><Check size={14} /> Done</span>
                    <a className="btn primary shine" href={it.url} download={it.outName}>Download</a>
                  </>
                )}
                {it.status !== 'working' && <button type="button" className="btn" onClick={() => remove(it.id)} aria-label={`Remove ${it.file.name}`}>Remove</button>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        HEIC is the space-saving format iPhones use by default. This converter decodes it with libheif (compiled to JavaScript) right in your browser, one photo at a time.
        Decoding is CPU heavy: expect a second or two per photo on a laptop and longer on phones, and the page may feel sluggish while it works.
        Camera metadata (EXIF, including GPS location) is not copied into the JPG or PNG. To strip metadata from other photos, use the <Link to="/exif-remover">EXIF / Metadata Remover</Link>.
      </p>
    </div>
  )
}
