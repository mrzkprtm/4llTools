import { useEffect, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { exportPalette, extractPalette, inkFor, sampleSize, toHex, toHsl, type ExportFormat, type Swatch } from './palette'
import './tool.css'

interface Loaded {
  url: string
  name: string
  w: number
  h: number
  sample: boolean
}

/** Paints a small sunset scene so the tool shows a palette on first load. */
function paintSample(): Promise<Blob | null> {
  const c = document.createElement('canvas')
  c.width = 720
  c.height = 460
  const ctx = c.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  const sky = ctx.createLinearGradient(0, 0, 0, 300)
  sky.addColorStop(0, '#1e1b4b')
  sky.addColorStop(0.45, '#7c3aed')
  sky.addColorStop(0.75, '#f472b6')
  sky.addColorStop(1, '#fb923c')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 720, 300)
  ctx.fillStyle = '#fde68a'
  ctx.beginPath()
  ctx.arc(470, 270, 70, 0, Math.PI * 2)
  ctx.fill()
  const hill = (color: string, y: number, amp: number, phase: number) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, 460)
    for (let x = 0; x <= 720; x += 10) ctx.lineTo(x, y + Math.sin(x / 90 + phase) * amp + Math.sin(x / 37 + phase * 2) * amp * 0.25)
    ctx.lineTo(720, 460)
    ctx.fill()
  }
  hill('#4c1d95', 290, 26, 1)
  hill('#312e81', 330, 22, 3)
  const sea = ctx.createLinearGradient(0, 360, 0, 460)
  sea.addColorStop(0, '#0e7490')
  sea.addColorStop(1, '#083344')
  ctx.fillStyle = sea
  ctx.fillRect(0, 370, 720, 90)
  ctx.fillStyle = 'rgba(253, 230, 138, 0.55)'
  for (let i = 0; i < 9; i++) ctx.fillRect(420 + Math.sin(i) * 30, 380 + i * 9, 100 - i * 8, 3)
  return new Promise((res) => c.toBlob(res, 'image/png'))
}

export default function ColorExtractor() {
  const [img, setImg] = useState<Loaded | null>(null)
  const [palette, setPalette] = useState<Swatch[]>([])
  const [count, setCount] = useState(6)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  const [hover, setHover] = useState<{ x: number; y: number; hex: string } | null>(null)
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [copied, setCopied] = useState('')
  const [format, setFormat] = useState<ExportFormat>('css')
  const [hasDropper, setHasDropper] = useState(false)
  const [run, setRun] = useState(0)
  const sampleData = useRef<ImageData | null>(null)
  const full = useRef<CanvasRenderingContext2D | null>(null)
  const imgEl = useRef<HTMLImageElement>(null)
  const current = useRef<string | null>(null)
  const copyTimer = useRef(0)

  useEffect(() => {
    setHasDropper('EyeDropper' in window)
    let alive = true
    paintSample().then((b) => {
      if (alive && b) load(b, 'sample-sunset.png', true)
      else if (alive) setBusy(false)
    })
    return () => {
      alive = false
      if (current.current) URL.revokeObjectURL(current.current)
      clearTimeout(copyTimer.current)
    }
  }, [])

  function load(blob: Blob, name: string, sample = false) {
    setBusy(true)
    setError('')
    const url = URL.createObjectURL(blob)
    const el = new Image()
    el.onload = () => {
      const w = el.naturalWidth
      const h = el.naturalHeight
      // A capped full-size copy for the eyedropper and a tiny one for the palette.
      const fs = sampleSize(w, h, 1600)
      const fc = document.createElement('canvas')
      fc.width = fs.w
      fc.height = fs.h
      const fctx = fc.getContext('2d', { willReadFrequently: true })
      const ss = sampleSize(w, h, 160)
      const sc = document.createElement('canvas')
      sc.width = ss.w
      sc.height = ss.h
      const sctx = sc.getContext('2d', { willReadFrequently: true })
      if (!fctx || !sctx) {
        setError('Canvas is not available in this browser.')
        setBusy(false)
        return
      }
      fctx.drawImage(el, 0, 0, fs.w, fs.h)
      sctx.imageSmoothingQuality = 'high'
      sctx.drawImage(el, 0, 0, ss.w, ss.h)
      full.current = fctx
      try {
        sampleData.current = sctx.getImageData(0, 0, ss.w, ss.h)
      } catch {
        setError('The browser would not let this image be read.')
        setBusy(false)
        return
      }
      if (current.current) URL.revokeObjectURL(current.current)
      current.current = url
      setImg({ url, name, w, h, sample })
      if (!sample) setPicked([])
      setRun((r) => r + 1)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      setError('That file could not be opened as an image. HEIC photos need converting first.')
      setBusy(false)
    }
    el.src = url
  }

  // Recompute the palette when the image or color count changes (in a macrotask so Busy can paint).
  useEffect(() => {
    if (!sampleData.current) return
    setBusy(true)
    const t = setTimeout(() => {
      if (sampleData.current) setPalette(extractPalette(sampleData.current.data, count))
      setBusy(false)
    }, 30)
    return () => clearTimeout(t)
  }, [run, count])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'))
      if (f) load(f, f.name || 'pasted-image.png')
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  function pixelAt(e: { clientX: number; clientY: number }): { x: number; y: number; hex: string } | null {
    const el = imgEl.current
    const ctx = full.current
    if (!el || !ctx) return null
    const r = el.getBoundingClientRect()
    const fx = (e.clientX - r.left) / r.width
    const fy = (e.clientY - r.top) / r.height
    if (fx < 0 || fy < 0 || fx > 1 || fy > 1) return null
    const px = Math.min(ctx.canvas.width - 1, Math.floor(fx * ctx.canvas.width))
    const py = Math.min(ctx.canvas.height - 1, Math.floor(fy * ctx.canvas.height))
    const d = ctx.getImageData(px, py, 1, 1).data
    const stage = el.parentElement!.getBoundingClientRect()
    return { x: e.clientX - stage.left, y: e.clientY - stage.top, hex: toHex(d[0], d[1], d[2]) }
  }

  async function copy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex)
    } catch {
      /* clipboard blocked: the color is still shown */
    }
    setCopied(hex)
    clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(''), 1300)
  }

  function pick(hex: string) {
    setPicked((p) => [hex, ...p.filter((x) => x !== hex)].slice(0, 12))
    copy(hex)
  }

  async function nativeDropper() {
    try {
      const Dropper = (window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper
      const r = await new Dropper().open()
      const hex = r.sRGBHex.startsWith('#') ? r.sRGBHex.toLowerCase() : (() => {
        const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(r.sRGBHex)
        return m ? toHex(+m[1], +m[2], +m[3]) : r.sRGBHex
      })()
      pick(hex)
    } catch {
      /* cancelled with Esc */
    }
  }

  const exported = exportPalette(palette, format)
  const ext = format === 'json' ? 'json' : format === 'scss' ? 'scss' : format === 'tailwind' ? 'js' : 'css'

  function download() {
    const url = URL.createObjectURL(new Blob([exported], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `palette.${ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div>
      <div
        className={`ce-drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) load(f, f.name) }}
      >
        <label htmlFor="ce-file" className="btn primary" style={{ margin: 0 }}>Choose image</label>
        <input id="ce-file" className="ce-hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f, f.name); e.target.value = '' }} />
        <span className="muted">or drop / paste (Ctrl+V) a photo</span>
        {hasDropper && (
          <button type="button" className="btn btn-icon" onClick={nativeDropper} title="Pick any color on your screen">
            <Icon name="eye" size={18} /> Pick from screen
          </button>
        )}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {img && (
        <>
          <div className="ce-stage">
            <img
              key={img.url}
              ref={imgEl}
              src={img.url}
              alt={img.sample ? 'Sample sunset illustration' : `Uploaded image ${img.name}`}
              draggable={false}
              onPointerMove={(e) => setHover(pixelAt(e))}
              onPointerLeave={() => setHover(null)}
              onClick={(e) => {
                const p = pixelAt(e)
                if (!p) return
                pick(p.hex)
                setRipple({ x: p.x, y: p.y, id: Date.now() })
              }}
            />
            {hover && <span className="ce-loupe" style={{ left: hover.x, top: hover.y, background: hover.hex }} aria-hidden="true" />}
            {ripple && <span key={ripple.id} className="ce-ripple" style={{ left: ripple.x, top: ripple.y }} aria-hidden="true" />}
          </div>
          <p className="muted" style={{ fontSize: '0.85rem', margin: '6px 0 0' }} aria-live="polite">
            {img.sample ? 'Sample image. ' : `${img.name} · ${img.w} × ${img.h} px. `}
            {hover ? <>Pointer: <b style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{hover.hex}</b>. Click to pick and copy.</> : 'Tap or click the image to pick an exact pixel color.'}
          </p>
        </>
      )}

      {picked.length > 0 && (
        <>
          <p className="ce-h" style={{ marginBottom: 0 }}>Picked colors</p>
          <div className="ce-picked">
            {picked.map((h) => (
              <button type="button" key={h} className="ce-pick" onClick={() => copy(h)} aria-label={`Copy ${h}`}>
                <i style={{ background: h }} />
                {copied === h ? <span className="ce-copied">Copied!</span> : h}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <label htmlFor="ce-count" style={{ fontWeight: 600 }}>Palette size: {count}</label>
        <input id="ce-count" type="range" min={2} max={12} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ flex: '1 1 160px' }} />
      </div>
      {busy && <Busy label="Reading pixels…" />}

      {palette.length > 0 && (
        <div className={busy ? 'busy-bar' : undefined}>
          <div className="ce-bar" role="img" aria-label="Color proportions">
            {palette.map((s, i) => <i key={i} style={{ flexGrow: s.share, background: s.hex }} />)}
          </div>
          <div className="ce-swatches" key={`${run}-${count}`}>
            {palette.map((s, i) => {
              const ink = inkFor(s.r, s.g, s.b)
              const [h, sat, l] = toHsl(s.r, s.g, s.b)
              return (
                <button type="button" key={s.hex + i} className="ce-swatch" style={{ animationDelay: `${i * 45}ms` }} onClick={() => copy(s.hex)} aria-label={`Copy ${s.hex}, ${(s.share * 100).toFixed(1)} percent`}>
                  <span className="ce-chip" style={{ background: s.hex, color: ink }}>
                    <span>{copied === s.hex ? <span className="ce-copied">Copied!</span> : s.hex}</span>
                    <span style={{ fontWeight: 500, fontSize: '0.8rem', opacity: 0.85 }}>{(s.share * 100).toFixed(1)}%</span>
                  </span>
                  <span className="ce-meta">rgb({s.r}, {s.g}, {s.b})<br />hsl({h} {sat}% {l}%)</span>
                </button>
              )
            })}
          </div>

          <p className="ce-h">Export</p>
          <PillRow label="Export format">
            {(['css', 'scss', 'json', 'tailwind'] as ExportFormat[]).map((f) => (
              <button key={f} type="button" aria-pressed={format === f} className={format === f ? 'btn primary' : 'btn'} onClick={() => setFormat(f)}>
                {f === 'css' ? 'CSS vars' : f === 'scss' ? 'SCSS' : f === 'json' ? 'JSON' : 'Tailwind'}
              </button>
            ))}
          </PillRow>
          <SettleOutput value={exported} aria-label="Exported palette" style={{ minHeight: 150 }} />
          <div className="row">
            <CopyButton text={exported} />
            <button type="button" className="btn btn-icon" onClick={download}><Icon name="arrow-down-circle" size={18} /> Download .{ext}</button>
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        The palette comes from a median-cut style quantizer run on a downsized copy of the image, so percentages are close estimates of how much area each color covers. Transparent pixels are ignored.
        The image never leaves your device. {hasDropper ? '“Pick from screen” uses your browser’s native eyedropper.' : 'Chrome and Edge also offer a native eyedropper for picking anywhere on screen.'}
      </p>
    </div>
  )
}
