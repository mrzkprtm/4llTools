import { useEffect, useRef, useState } from 'react'
import exifr from 'exifr'
import Check from '../../motion/Check'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { detectKind, stripImage, type ImageKind } from './strip'

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)

interface Found {
  gps?: { lat: number; lon: number; alt?: number }
  facts: [string, string][]
  tagCount: number
}

interface Item {
  id: number
  name: string
  originalSize: number
  status: 'working' | 'done' | 'error'
  kind?: ImageKind
  found?: Found
  removed?: string[]
  method?: 'lossless' | 'reencode'
  note?: string
  url?: string
  outName?: string
  outSize?: number
  remaining?: number
  error?: string
}

const FACTS: [string, string][] = [
  ['Make', 'Camera make'],
  ['Model', 'Camera model'],
  ['LensModel', 'Lens'],
  ['DateTimeOriginal', 'Date taken'],
  ['CreateDate', 'Created'],
  ['ModifyDate', 'Modified'],
  ['Software', 'Software'],
  ['Artist', 'Artist'],
  ['Creator', 'Creator'],
  ['Copyright', 'Copyright'],
  ['ImageDescription', 'Description'],
  ['BodySerialNumber', 'Body serial number'],
  ['SerialNumber', 'Serial number'],
  ['LensSerialNumber', 'Lens serial number'],
  ['OwnerName', 'Owner'],
  ['HostComputer', 'Device'],
  ['Byline', 'Byline'],
  ['City', 'City'],
  ['Country', 'Country'],
]

function show(v: unknown): string {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toLocaleString()
  if (Array.isArray(v)) return v.map(show).join(', ')
  if (v instanceof Uint8Array) return `${v.length} bytes`
  if (typeof v === 'object' && v !== null) return JSON.stringify(v).slice(0, 80)
  return String(v ?? '').trim()
}

async function readMetadata(data: Uint8Array): Promise<Found> {
  let tags: Record<string, unknown> | undefined
  try {
    tags = await exifr.parse(data, { tiff: true, exif: true, gps: true, xmp: true, iptc: true, icc: false, jfif: false, ihdr: false, mergeOutput: true, makerNote: false })
  } catch {
    tags = undefined
  }
  const facts: [string, string][] = []
  if (!tags) return { facts, tagCount: 0 }
  for (const [key, label] of FACTS) {
    const v = show(tags[key])
    if (v && !facts.some(([, x]) => x === v)) facts.push([label, v])
  }
  const lat = tags.latitude
  const lon = tags.longitude
  const gps = typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat, lon, alt: typeof tags.GPSAltitude === 'number' ? tags.GPSAltitude : undefined }
    : undefined
  return { gps, facts, tagCount: Object.keys(tags).length }
}

async function reencode(file: File, kind: ImageKind): Promise<{ blob: Blob; ext: string }> {
  const bmp = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available.')
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  const lossless = kind === 'png' || /\.(gif|bmp|png|ico)$/i.test(file.name)
  const type = lossless ? 'image/png' : kind === 'webp' ? 'image/webp' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.92))
  if (!blob) throw new Error('The browser could not re-encode this image.')
  return { blob, ext: type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg' }
}

function splitName(name: string): [string, string] {
  const m = /^(.*?)(\.[^.]+)?$/.exec(name)!
  return [m[1] || 'image', m[2] || '']
}

export default function ExifRemover() {
  const [items, setItems] = useState<Item[]>([])
  const [keepOrientation, setKeepOrientation] = useState(true)
  const [dragging, setDragging] = useState(false)
  const nextId = useRef(1)
  const urls = useRef<string[]>([])
  const list = useRef<HTMLDivElement>(null)
  useFlip(list, { max: 40 })

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const patch = (id: number, p: Partial<Item>) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)))

  async function processFile(file: File, id: number) {
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const kind = detectKind(data)
      const found = await readMetadata(data)
      let orientation: number | undefined
      if (keepOrientation && kind === 'jpeg') {
        try {
          orientation = await exifr.orientation(data)
        } catch {
          orientation = undefined
        }
      }
      const [base, ext] = splitName(file.name)
      let blob: Blob
      let outExt = ext
      let method: Item['method'] = 'lossless'
      let removed: string[] = []
      let note: string | undefined
      try {
        const r = stripImage(data, { orientation })
        blob = new Blob([r.bytes.slice().buffer], { type: file.type || `image/${kind}` })
        removed = r.removed
        if (orientation && orientation > 1) note = `Kept only the orientation tag (${orientation}) so the photo stays upright.`
      } catch (err) {
        const re = await reencode(file, kind)
        blob = re.blob
        outExt = `.${re.ext}`
        method = 'reencode'
        note =
          kind === 'other'
            ? 'This format cannot be cleaned byte-by-byte here, so it was redrawn on a canvas and re-encoded. Pixels are kept, but it is not bit-identical and animation or transparency may be lost.'
            : `Lossless cleaning failed (${err instanceof Error ? err.message : 'unknown error'}), so the image was re-encoded instead.`
      }
      const url = URL.createObjectURL(blob)
      urls.current.push(url)
      const after = await readMetadata(new Uint8Array(await blob.arrayBuffer()))
      patch(id, {
        status: 'done',
        kind,
        found,
        removed,
        method,
        note,
        url,
        outName: `${base}-clean${outExt || '.jpg'}`,
        outSize: blob.size,
        remaining: after.tagCount - (orientation && orientation > 1 ? 1 : 0),
      })
    } catch (err) {
      patch(id, {
        status: 'error',
        error: err instanceof Error && /decode|source image|InvalidStateError/i.test(err.message + err.name)
          ? 'Your browser cannot open this image format (HEIC and TIFF often need Safari or a conversion first).'
          : err instanceof Error ? err.message : 'Could not process this file.',
      })
    }
  }

  function addFiles(files: FileList | File[]) {
    const list = [...files].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif|avif|tiff?|bmp)$/i.test(f.name))
    const fresh: Item[] = list.map((f) => ({ id: nextId.current++, name: f.name, originalSize: f.size, status: 'working' }))
    setItems((old) => [...fresh, ...old])
    list.forEach((f, i) => processFile(f, fresh[i].id))
  }

  function downloadAll() {
    items.forEach((it, i) => {
      if (!it.url || !it.outName) return
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = it.url!
        a.download = it.outName!
        a.click()
      }, i * 250)
    })
  }

  const done = items.filter((i) => i.status === 'done')
  const gpsCount = done.filter((i) => i.found?.gps).length

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          background: dragging ? 'var(--accent-soft)' : 'var(--sunken)',
          borderRadius: 'var(--radius-sm)',
          padding: '28px 16px',
          position: 'relative',
          textAlign: 'center',
          transition: 'border-color .15s, background-color .15s, transform var(--spring-snap-ms) var(--spring-snap)',
          transform: dragging ? 'scale(1.02)' : 'none',
          animation: dragging ? 'breathe 1.2s ease-in-out infinite' : undefined,
        }}
      >
        <p style={{ margin: '0 0 10px', fontWeight: 600 }}>Drop photos here</p>
        <label htmlFor="exif-files" className="btn primary" style={{ display: 'inline-block', margin: 0 }}>Choose images</label>
        <input
          id="exif-files"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        />
        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>JPEG, PNG and WebP are cleaned losslessly. Nothing is uploaded.</p>
      </div>
      <div className="row">
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={keepOrientation} onChange={(e) => setKeepOrientation(e.target.checked)} /> Keep JPEG orientation (only that one tag)
        </label>
        {done.length > 1 && <button type="button" className="btn" onClick={downloadAll}>Download all ({done.length})</button>}
        {items.length > 0 && <button type="button" className="btn" onClick={() => setItems([])}>Clear</button>}
      </div>
      {gpsCount > 0 && (
        <p className="error" role="alert" style={{ fontWeight: 600, padding: '10px 12px', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)' }}>
          ⚠ {gpsCount === 1 ? 'A photo contains' : `${gpsCount} photos contain`} GPS location data that reveals where it was taken. The cleaned copies below have it removed.
        </p>
      )}

      <div ref={list}>
      {items.map((it) => (
        <div key={it.id} data-flip={String(it.id)} className={it.status === 'working' ? 'busy-bar' : undefined} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, marginTop: 12, background: 'var(--surface)' }}>
          <div className="row" style={{ margin: 0, justifyContent: 'space-between' }}>
            <b style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{it.name}</b>
            {it.status === 'working' && <span className="muted" aria-live="polite">Processing…</span>}
            {it.status === 'done' && it.url && (
              <span className="row" style={{ margin: 0 }}>
                <span className="chip good"><Check size={14} /> Clean</span>
                <a className="btn primary shine" href={it.url} download={it.outName}>Download</a>
              </span>
            )}
          </div>
          {it.status === 'error' && <p className="error">{it.error}</p>}
          {it.status === 'done' && it.found && (
            <>
              <div className="stats">
                <div className="stat"><b><Roll>{formatBytes(it.originalSize)}</Roll></b>Before</div>
                <div className="stat"><b><Roll>{formatBytes(it.outSize ?? 0)}</Roll></b>After</div>
                <div className="stat"><b><Roll>{it.found.tagCount}</Roll></b>Tags found</div>
                <div className="stat"><b className={it.remaining && it.remaining > 0 ? 'error' : 'ok'}><Roll>{Math.max(0, it.remaining ?? 0)}</Roll></b>Tags left</div>
              </div>
              {it.found.gps && (
                <p className="error" style={{ fontWeight: 600 }}>
                  GPS: {it.found.gps.lat.toFixed(5)}, {it.found.gps.lon.toFixed(5)}
                  {it.found.gps.alt !== undefined ? ` (altitude ${Math.round(it.found.gps.alt)} m)` : ''}{' '}
                  <a href={`https://www.openstreetmap.org/?mlat=${it.found.gps.lat}&mlon=${it.found.gps.lon}#map=16/${it.found.gps.lat}/${it.found.gps.lon}`} target="_blank" rel="noreferrer noopener">
                    View on map
                  </a>
                </p>
              )}
              {it.found.facts.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="simple">
                    <tbody>
                      {it.found.facts.map(([k, v]) => (
                        <tr key={k}><td className="muted" style={{ width: '40%' }}>{k}</td><td style={{ overflowWrap: 'anywhere' }}>{v}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                !it.found.gps && <p className="muted">No camera or location details were found.</p>
              )}
              <p className="muted" style={{ fontSize: '0.86rem', marginBottom: 0 }}>
                {it.method === 'lossless'
                  ? it.removed && it.removed.length
                    ? <>Removed losslessly: {it.removed.map((r, i) => <span key={r} className="peel-chip" style={{ animationDelay: `${i * 70}ms` }}>{r}</span>)}.</>
                    : 'No metadata blocks to remove; the file is unchanged.'
                  : 'Re-encoded via canvas.'}{' '}
                {it.note}
              </p>
            </>
          )}
        </div>
      ))}
      </div>
    </div>
  )
}
