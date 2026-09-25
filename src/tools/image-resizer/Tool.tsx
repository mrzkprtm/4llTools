import { useEffect, useState } from 'react'

type Format = 'image/jpeg' | 'image/png' | 'image/webp'
const EXT: Record<Format, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`)

export default function ImageResizer() {
  const [file, setFile] = useState<File | null>(null)
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  const [keepRatio, setKeepRatio] = useState(true)
  const [format, setFormat] = useState<Format>('image/jpeg')
  const [quality, setQuality] = useState(0.8)
  const [result, setResult] = useState<{ url: string; size: number } | null>(null)
  const [error, setError] = useState('')

  async function open(f: File) {
    setError('')
    try {
      const bmp = await createImageBitmap(f)
      setFile(f)
      setBitmap(bmp)
      setWidth(bmp.width)
      setHeight(bmp.height)
    } catch {
      setError('That file could not be opened as an image.')
    }
  }

  useEffect(() => {
    if (!bitmap || width < 1 || height < 1) return
    let cancelled = false
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)
    const timer = setTimeout(() => {
      canvas.toBlob(
        (blob) => {
          if (cancelled || !blob) return
          setResult((old) => {
            if (old) URL.revokeObjectURL(old.url)
            return { url: URL.createObjectURL(blob), size: blob.size }
          })
        },
        format,
        quality,
      )
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [bitmap, width, height, format, quality])

  const ratio = bitmap ? bitmap.width / bitmap.height : 1
  const MAX = 10000
  const clamp = (n: number) => Math.max(1, Math.min(MAX, Math.round(n) || 1))
  const baseName = file?.name.replace(/\.[^.]+$/, '') ?? 'image'

  return (
    <div>
      <label htmlFor="img-file">Choose an image</label>
      <input id="img-file" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = '' }} />
      {error && <p className="error">{error}</p>}
      {bitmap && file && (
        <>
          <p className="muted">
            Original: {bitmap.width} × {bitmap.height} px, {formatBytes(file.size)}
          </p>
          <div className="row">
            <label style={{ margin: 0 }} htmlFor="img-w">Width</label>
            <input id="img-w" type="number" min={1} max={MAX} value={width} style={{ width: 110 }} onChange={(e) => { const w = clamp(Number(e.target.value)); setWidth(w); if (keepRatio) setHeight(clamp(w / ratio)) }} />
            <label style={{ margin: 0 }} htmlFor="img-h">Height</label>
            <input id="img-h" type="number" min={1} max={MAX} value={height} style={{ width: 110 }} onChange={(e) => { const h = clamp(Number(e.target.value)); setHeight(h); if (keepRatio) setWidth(clamp(h * ratio)) }} />
            <label style={{ fontWeight: 400, margin: 0 }}><input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} /> Keep proportions</label>
          </div>
          <div className="row">
            {[100, 75, 50, 25].map((p) => (
              <button key={p} type="button" className="btn" onClick={() => { setWidth(clamp((bitmap.width * p) / 100)); setHeight(clamp((bitmap.height * p) / 100)) }}>{p}%</button>
            ))}
          </div>
          <div className="row">
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)} style={{ width: 'auto' }} aria-label="Format">
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WebP</option>
              <option value="image/png">PNG</option>
            </select>
            {format !== 'image/png' && (
              <>
                <label style={{ margin: 0 }} htmlFor="img-q">Quality {Math.round(quality * 100)}%</label>
                <input id="img-q" type="range" min={0.1} max={1} step={0.05} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
              </>
            )}
          </div>
          {result && (
            <>
              <p>
                New size: <b>{formatBytes(result.size)}</b>{' '}
                <span className={result.size < file.size ? 'ok' : 'muted'}>
                  ({result.size < file.size ? `${Math.round((1 - result.size / file.size) * 100)}% smaller` : 'not smaller'})
                </span>
              </p>
              <img src={result.url} alt="Resized preview" style={{ maxWidth: '100%', maxHeight: 360, borderRadius: 8, border: '1px solid var(--border)' }} />
              <div className="row">
                <a className="btn primary" href={result.url} download={`${baseName}-${width}x${height}.${EXT[format]}`}>Download</a>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
