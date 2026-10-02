import { useEffect, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import { computeLayout, coverRect, RATIOS, safeScale, type Frame, type Layout } from './layout'
import './tool.css'

type BgKind = 'gradient' | 'solid' | 'image' | 'none'

const GRADIENTS: [string, string, number][] = [
  ['#6366f1', '#ec4899', 135],
  ['#f97316', '#facc15', 135],
  ['#06b6d4', '#3b82f6', 160],
  ['#22c55e', '#14b8a6', 135],
  ['#a855f7', '#6366f1', 200],
  ['#f43f5e', '#fb923c', 120],
  ['#0f172a', '#334155', 160],
  ['#fde68a', '#fca5a5', 135],
  ['#e0e7ff', '#fae8ff', 135],
  ['#111827', '#6d28d9', 45],
]

interface Opts {
  bg: BgKind
  grad: [string, string, number]
  solid: string
  radius: number
  shadow: number
  shadowOpacity: number
  frame: Frame
  dark: boolean
  title: string
}

interface Src {
  img: CanvasImageSource
  w: number
  h: number
}

function paintSampleScreenshot(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1280
  c.height = 800
  const x = c.getContext('2d')!
  x.fillStyle = '#f8fafc'
  x.fillRect(0, 0, 1280, 800)
  x.fillStyle = '#0f172a'
  x.fillRect(0, 0, 240, 800)
  x.fillStyle = '#6366f1'
  x.beginPath()
  x.roundRect(28, 30, 36, 36, 9)
  x.fill()
  x.fillStyle = '#e2e8f0'
  x.font = '600 20px system-ui, sans-serif'
  x.fillText('Acme', 76, 55)
  ;['Dashboard', 'Projects', 'Reports', 'Team', 'Settings'].forEach((t, i) => {
    if (i === 0) {
      x.fillStyle = 'rgba(99,102,241,0.25)'
      x.beginPath()
      x.roundRect(16, 104 + i * 48, 208, 38, 8)
      x.fill()
    }
    x.fillStyle = i === 0 ? '#fff' : '#94a3b8'
    x.font = '500 16px system-ui, sans-serif'
    x.fillText(t, 36, 129 + i * 48)
  })
  x.fillStyle = '#0f172a'
  x.font = '700 30px system-ui, sans-serif'
  x.fillText('Good morning, Sam', 280, 70)
  x.fillStyle = '#64748b'
  x.font = '400 16px system-ui, sans-serif'
  x.fillText('Here is what happened this week.', 280, 100)
  const cards: [string, string, string][] = [['Revenue', '$48,210', '#22c55e'], ['Users', '12,840', '#6366f1'], ['Churn', '1.8%', '#f43f5e']]
  cards.forEach(([k, v, col], i) => {
    const cx = 280 + i * 322
    x.fillStyle = '#fff'
    x.strokeStyle = '#e2e8f0'
    x.beginPath()
    x.roundRect(cx, 130, 300, 130, 14)
    x.fill()
    x.stroke()
    x.fillStyle = '#64748b'
    x.font = '500 15px system-ui, sans-serif'
    x.fillText(k, cx + 22, 166)
    x.fillStyle = '#0f172a'
    x.font = '700 34px system-ui, sans-serif'
    x.fillText(v, cx + 22, 212)
    x.fillStyle = col
    x.beginPath()
    x.roundRect(cx + 22, 230, 90 + i * 40, 8, 4)
    x.fill()
  })
  x.fillStyle = '#fff'
  x.beginPath()
  x.roundRect(280, 284, 944, 470, 14)
  x.fill()
  x.stroke()
  x.fillStyle = '#0f172a'
  x.font = '600 18px system-ui, sans-serif'
  x.fillText('Weekly active users', 306, 322)
  const vals = [42, 55, 48, 70, 66, 82, 78, 95, 88, 104, 99, 120]
  vals.forEach((v, i) => {
    const bx = 316 + i * 74
    const h = v * 3
    const g = x.createLinearGradient(0, 720 - h, 0, 720)
    g.addColorStop(0, '#818cf8')
    g.addColorStop(1, '#6366f1')
    x.fillStyle = g
    x.beginPath()
    x.roundRect(bx, 720 - h, 44, h, 6)
    x.fill()
  })
  return c
}

function drawScene(ctx: CanvasRenderingContext2D, L: Layout, o: Opts, src: Src, bgImg: Src | null, s: number) {
  const W = L.width * s
  const H = L.height * s
  const u = L.unit * s
  ctx.clearRect(0, 0, W, H)
  if (o.bg === 'gradient') {
    const a = (o.grad[2] * Math.PI) / 180
    const r = Math.abs(W * Math.sin(a)) / 2 + Math.abs(H * Math.cos(a)) / 2
    const g = ctx.createLinearGradient(W / 2 - Math.sin(a) * r, H / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r, H / 2 - Math.cos(a) * r)
    g.addColorStop(0, o.grad[0])
    g.addColorStop(1, o.grad[1])
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  } else if (o.bg === 'solid') {
    ctx.fillStyle = o.solid
    ctx.fillRect(0, 0, W, H)
  } else if (o.bg === 'image' && bgImg) {
    const c = coverRect(bgImg.w, bgImg.h, W, H)
    ctx.drawImage(bgImg.img, c.sx, c.sy, c.sw, c.sh, 0, 0, W, H)
  }

  const x = L.winX * s
  const y = L.winY * s
  const w = L.winW * s
  const h = L.winH * s
  const rad = Math.min(o.radius * u, w / 2, h / 2)
  const winPath = () => {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, rad)
  }
  // Shadow: drawn with a filled window shape underneath.
  if (o.shadow > 0 && o.shadowOpacity > 0) {
    ctx.save()
    ctx.shadowColor = `rgba(0,0,0,${o.shadowOpacity})`
    ctx.shadowBlur = o.shadow * u
    ctx.shadowOffsetY = o.shadow * u * 0.35
    ctx.fillStyle = o.dark ? '#1f2937' : '#ffffff'
    winPath()
    ctx.fill()
    ctx.restore()
  }
  ctx.save()
  winPath()
  ctx.clip()
  const bar = L.bar * s
  if (bar > 0) {
    ctx.fillStyle = o.dark ? '#1f2937' : '#eef0f3'
    ctx.fillRect(x, y, w, bar + 1)
    const dot = bar * 0.19
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.arc(x + bar * 0.62 + i * dot * 3.1, y + bar / 2, dot, 0, Math.PI * 2)
      ctx.fill()
    })
    if (o.frame === 'browser') {
      const pw = Math.min(w * 0.5, w - bar * 5)
      const ph = bar * 0.56
      ctx.fillStyle = o.dark ? '#111827' : '#ffffff'
      ctx.beginPath()
      ctx.roundRect(x + (w - pw) / 2, y + (bar - ph) / 2, pw, ph, ph / 2)
      ctx.fill()
      if (o.title) {
        ctx.fillStyle = o.dark ? '#9ca3af' : '#6b7280'
        ctx.font = `500 ${Math.round(ph * 0.5)}px system-ui, -apple-system, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(o.title, x + w / 2, y + bar / 2, pw - ph)
      }
    } else if (o.title) {
      ctx.fillStyle = o.dark ? '#d1d5db' : '#4b5563'
      ctx.font = `600 ${Math.round(bar * 0.36)}px system-ui, -apple-system, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(o.title, x + w / 2, y + bar / 2, w - bar * 5)
    }
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src.img, L.imgX * s, L.imgY * s, L.imgW * s, L.imgH * s)
  ctx.restore()
}

export default function ScreenshotBeautifier() {
  const [src, setSrc] = useState<(Src & { name: string; sample: boolean }) | null>(null)
  const [bgImg, setBgImg] = useState<Src | null>(null)
  const [opts, setOpts] = useState<Opts>({ bg: 'gradient', grad: GRADIENTS[0], solid: '#f1f5f9', radius: 12, shadow: 60, shadowOpacity: 0.35, frame: 'mac', dark: false, title: 'acme.app/dashboard' })
  const [padding, setPadding] = useState(0.08)
  const [ratio, setRatio] = useState(0)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [scale, setScale] = useState(1)
  const [over, setOver] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [doneN, setDoneN] = useState(0)
  const [fresh, setFresh] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const doneTimer = useRef(0)

  const set = (p: Partial<Opts>) => setOpts((o) => ({ ...o, ...p }))
  const layout = src ? computeLayout({ imgW: src.w, imgH: src.h, padding, frame: opts.frame, ratio: RATIOS[ratio].value }) : null

  useEffect(() => {
    const c = paintSampleScreenshot()
    setSrc({ img: c, w: c.width, h: c.height, name: 'sample-dashboard.png', sample: true })
    return () => clearTimeout(doneTimer.current)
  }, [])

  // Live preview, drawn at a reduced size for speed.
  useEffect(() => {
    const c = canvas.current
    if (!c || !src || !layout) return
    const raf = requestAnimationFrame(() => {
      const s = Math.min(1, 1400 / Math.max(layout.width, layout.height))
      c.width = Math.round(layout.width * s)
      c.height = Math.round(layout.height * s)
      const ctx = c.getContext('2d')
      if (ctx) drawScene(ctx, layout, opts, src, bgImg, s)
    })
    return () => cancelAnimationFrame(raf)
  })

  function loadImage(file: Blob, then: (s: Src) => void) {
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Please use an image file (PNG, JPG, WebP…).')
      return
    }
    createImageBitmap(file).then(
      (bmp) => then({ img: bmp, w: bmp.width, h: bmp.height }),
      () => setError('That image could not be opened by your browser.'),
    )
  }

  const openShot = (f: File) => loadImage(f, (s) => {
    setSrc({ ...s, name: f.name || 'pasted-screenshot.png', sample: false })
    setFresh((n) => n + 1)
  })

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'))
      if (f) {
        e.preventDefault()
        openShot(f)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  async function render(type: 'image/png' | 'image/jpeg'): Promise<Blob> {
    if (!src || !layout) throw new Error('Add a screenshot first.')
    const s = safeScale(layout.width, layout.height, scale)
    const c = document.createElement('canvas')
    c.width = Math.round(layout.width * s)
    c.height = Math.round(layout.height * s)
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available.')
    drawScene(ctx, layout, opts, src, bgImg, s)
    if (type === 'image/jpeg') {
      // JPEG has no transparency: put a white layer under any clear areas.
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, c.width, c.height)
    }
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, type, 0.92))
    if (!blob) throw new Error('The browser could not export the image (it may be too large).')
    return blob
  }

  function flash(msg: string) {
    setDone(msg)
    setDoneN((n) => n + 1)
    clearTimeout(doneTimer.current)
    doneTimer.current = window.setTimeout(() => setDone(''), 2200)
  }

  async function download() {
    setBusy(true)
    setError('')
    try {
      const blob = await render(format === 'png' ? 'image/png' : 'image/jpeg')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(src?.name ?? 'screenshot').replace(/\.[^.]+$/, '')}-beautified${scale > 1 ? '@2x' : ''}.${format === 'png' ? 'png' : 'jpg'}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      flash('Downloaded')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    setBusy(true)
    setError('')
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('Copying images is not supported in this browser. Use Download instead.')
      // Safari wants the promise passed straight into ClipboardItem.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': render('image/png') })])
      flash('Copied to clipboard')
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Copying failed. Use Download instead.')
    } finally {
      setBusy(false)
    }
  }

  const outScale = layout ? safeScale(layout.width, layout.height, scale) : 1

  return (
    <div>
      <div
        className={`sb-drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) openShot(f) }}
      >
        <label htmlFor="sb-file" className="btn primary" style={{ margin: 0 }}>Choose screenshot</label>
        <input id="sb-file" className="sb-hidden-input" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) openShot(f); e.target.value = '' }} />
        <span className="muted">or drop it here, or paste with Ctrl+V / ⌘V</span>
      </div>
      {src?.sample && <p className="muted" style={{ fontSize: '0.85rem', margin: '6px 0 0' }}>Showing a sample screenshot. Add your own to replace it.</p>}
      {error && <p className="error" role="alert">{error}</p>}

      {layout && (
        <div className="sb-stage">
          <canvas key={fresh} ref={canvas} className={fresh ? 'sb-new' : undefined} role="img" aria-label="Beautified screenshot preview" />
        </div>
      )}

      <div className="sb-controls">
        <div>
          <p className="sb-h">Background</p>
          <PillRow label="Background type">
            {(['gradient', 'solid', 'image', 'none'] as BgKind[]).map((b) => (
              <button key={b} type="button" aria-pressed={opts.bg === b} className={opts.bg === b ? 'btn primary' : 'btn'} onClick={() => set({ bg: b })} style={{ padding: '7px 10px', fontSize: '0.86rem', textTransform: 'capitalize' }}>{b === 'none' ? 'Clear' : b}</button>
            ))}
          </PillRow>
          {opts.bg === 'gradient' && (
            <div className="sb-grads" role="group" aria-label="Gradient presets">
              {GRADIENTS.map((g, i) => (
                <button key={i} type="button" className="sb-grad" aria-label={`Gradient ${g[0]} to ${g[1]}`} aria-pressed={opts.grad === g} style={{ background: `linear-gradient(${g[2]}deg, ${g[0]}, ${g[1]})` }} onClick={() => set({ grad: g })} />
              ))}
            </div>
          )}
          {opts.bg === 'solid' && (
            <div className="sb-select" style={{ marginTop: 8 }}>
              <input type="color" aria-label="Background color" value={opts.solid} onChange={(e) => set({ solid: e.target.value })} />
              <span className="muted" style={{ fontFamily: 'var(--mono)' }}>{opts.solid}</span>
            </div>
          )}
          {opts.bg === 'image' && (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="sb-bg" style={{ margin: '0 0 4px' }}>Background image</label>
              <input id="sb-bg" type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImage(f, setBgImg) }} />
              {!bgImg && <p className="muted" style={{ fontSize: '0.82rem', margin: '4px 0 0' }}>Pick a wallpaper; it is scaled to cover.</p>}
            </div>
          )}
          {opts.bg === 'none' && <p className="muted" style={{ fontSize: '0.82rem', margin: '6px 0 0' }}>Transparent in PNG, white in JPG.</p>}
        </div>

        <div>
          <p className="sb-h">Window frame</p>
          <PillRow label="Window frame">
            {([['none', 'None'], ['mac', 'macOS'], ['browser', 'Browser']] as [Frame, string][]).map(([f, t]) => (
              <button key={f} type="button" aria-pressed={opts.frame === f} className={opts.frame === f ? 'btn primary' : 'btn'} onClick={() => set({ frame: f })} style={{ padding: '7px 10px', fontSize: '0.86rem' }}>{t}</button>
            ))}
          </PillRow>
          {opts.frame !== 'none' && (
            <>
              <label htmlFor="sb-title" style={{ margin: '10px 0 4px' }}>{opts.frame === 'browser' ? 'Address bar text' : 'Window title'}</label>
              <input id="sb-title" type="text" value={opts.title} onChange={(e) => set({ title: e.target.value })} placeholder="Optional" />
              <label style={{ fontWeight: 400, margin: '8px 0 0' }}><input type="checkbox" checked={opts.dark} onChange={(e) => set({ dark: e.target.checked })} /> Dark frame</label>
            </>
          )}
        </div>

        <div>
          <label htmlFor="sb-pad">Padding (inset): {Math.round(padding * 100)}%</label>
          <input id="sb-pad" type="range" min={0} max={0.3} step={0.005} value={padding} onChange={(e) => setPadding(Number(e.target.value))} style={{ width: '100%' }} />
          <label htmlFor="sb-rad">Corner radius: {opts.radius}</label>
          <input id="sb-rad" type="range" min={0} max={48} value={opts.radius} onChange={(e) => set({ radius: Number(e.target.value) })} style={{ width: '100%' }} />
        </div>

        <div>
          <label htmlFor="sb-sh">Shadow size: {opts.shadow}</label>
          <input id="sb-sh" type="range" min={0} max={160} value={opts.shadow} onChange={(e) => set({ shadow: Number(e.target.value) })} style={{ width: '100%' }} />
          <label htmlFor="sb-so">Shadow strength: {Math.round(opts.shadowOpacity * 100)}%</label>
          <input id="sb-so" type="range" min={0} max={0.8} step={0.01} value={opts.shadowOpacity} onChange={(e) => set({ shadowOpacity: Number(e.target.value) })} style={{ width: '100%' }} />
        </div>
      </div>

      <p className="sb-h">Canvas size</p>
      <div className="sb-ratio" role="group" aria-label="Aspect ratio">
        {RATIOS.map((r, i) => (
          <button key={r.label} type="button" aria-pressed={ratio === i} className={ratio === i ? 'btn primary' : 'btn'} onClick={() => setRatio(i)}>{r.label}</button>
        ))}
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        <PillRow label="Export format">
          <button type="button" aria-pressed={format === 'png'} className={format === 'png' ? 'btn primary' : 'btn'} onClick={() => setFormat('png')}>PNG</button>
          <button type="button" aria-pressed={format === 'jpeg'} className={format === 'jpeg' ? 'btn primary' : 'btn'} onClick={() => setFormat('jpeg')}>JPG</button>
        </PillRow>
        <PillRow label="Export scale">
          <button type="button" aria-pressed={scale === 1} className={scale === 1 ? 'btn primary' : 'btn'} onClick={() => setScale(1)}>1x</button>
          <button type="button" aria-pressed={scale === 2} className={scale === 2 ? 'btn primary' : 'btn'} onClick={() => setScale(2)}>2x</button>
        </PillRow>
        {layout && <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>{Math.round(layout.width * outScale)} × {Math.round(layout.height * outScale)} px</span>}
      </div>
      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={download} disabled={!src || busy}><Icon name="arrow-down-circle" size={18} /> Download {format === 'png' ? 'PNG' : 'JPG'}</button>
        <button type="button" className="btn btn-icon" onClick={copy} disabled={!src || busy}><Icon name="clipboard" size={18} /> Copy image</button>
        {busy && <Busy label="Rendering…" />}
        {done && !busy && <span className="chip good" key={doneN}><Check size={14} /> {done}</span>}
      </div>

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        Everything is drawn on a canvas in your browser, so screenshots never leave your device. 1x keeps the screenshot at its original pixel size; 2x doubles everything for crisp retina posts (very large results are capped at 8192 px per side).
        Copy image needs a browser that supports writing images to the clipboard (Chrome, Edge, Safari; Firefox 127+).
      </p>
    </div>
  )
}
