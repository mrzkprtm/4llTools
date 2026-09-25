import { useEffect, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import Check from '../../motion/Check'
import {
  buildHtml, buildManifest, clampText, encodeIco, fitSquare, letterFont, letterFontSize, letterSvg, MASKABLE_SAFE, shapeRadius,
  type Fit, type LetterIcon, type Shape, type SiteInfo,
} from './favicon'
import './tool.css'

type Variant = 'plain' | 'apple' | 'maskable'

interface Source {
  img: HTMLImageElement
  w: number
  h: number
  name: string
  url: string
  svgText?: string
}

interface OutFile {
  name: string
  label: string
  size?: number
  blob: Blob
  url: string
}

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`)

function roundRect(ctx: CanvasRenderingContext2D, size: number, r: number) {
  ctx.beginPath()
  if (r <= 0) ctx.rect(0, 0, size, size)
  else if (r >= size / 2) ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  else ctx.roundRect(0, 0, size, size, r)
}

/** Downscales in halving steps so tiny icons stay crisp instead of aliased. */
function drawScaled(ctx: CanvasRenderingContext2D, src: Source, dx: number, dy: number, dw: number, dh: number) {
  let img: CanvasImageSource = src.img
  let w = src.w
  let h = src.h
  if (!src.svgText) {
    while (w / 2 > dw * 1.5 && h / 2 > 1) {
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w / 2))
      c.height = Math.max(1, Math.round(h / 2))
      const cx = c.getContext('2d')!
      cx.imageSmoothingQuality = 'high'
      cx.drawImage(img, 0, 0, c.width, c.height)
      img = c
      w = c.width
      h = c.height
    }
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, dx, dy, dw, dh)
}

interface Opts {
  mode: 'image' | 'text'
  letter: LetterIcon
  src: Source | null
  fit: Fit
  padding: number
  imgBg: string | null
  shape: Shape
  siteBg: string
}

function render(size: number, variant: Variant, o: Opts): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  if (o.mode === 'text') {
    const full = variant !== 'plain'
    ctx.fillStyle = o.letter.bg
    roundRect(ctx, size, full ? 0 : shapeRadius(o.letter.shape, size))
    ctx.fill()
    const scale = variant === 'maskable' ? MASKABLE_SAFE * 0.9 : 1
    ctx.fillStyle = o.letter.fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = letterFont(o.letter, letterFontSize(o.letter, size) * scale)
    const text = clampText(o.letter.text) || '?'
    const m = ctx.measureText(text)
    // Center on the actual glyph box, not the font's line box.
    const up = m.actualBoundingBoxAscent || size * 0.35
    const down = m.actualBoundingBoxDescent || 0
    ctx.fillText(text, size / 2, size / 2 + (up - down) / 2, size)
    return c
  }
  if (!o.src) return c
  let padding = o.padding
  if (variant === 'plain') {
    if (o.imgBg) {
      ctx.fillStyle = o.imgBg
      roundRect(ctx, size, shapeRadius(o.shape, size))
      ctx.fill()
      ctx.save()
      roundRect(ctx, size, shapeRadius(o.shape, size))
      ctx.clip()
    }
  } else {
    ctx.fillStyle = o.imgBg ?? o.siteBg
    ctx.fillRect(0, 0, size, size)
    padding = variant === 'maskable' ? (1 - MASKABLE_SAFE) / 2 + padding * MASKABLE_SAFE : Math.max(padding, 0.06)
  }
  const r = fitSquare(o.src.w, o.src.h, size, padding, o.fit)
  drawScaled(ctx, o.src, r.dx, r.dy, r.dw, r.dh)
  if (variant === 'plain' && o.imgBg) ctx.restore()
  return c
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('The browser could not encode a PNG.'))), 'image/png'))

const SAMPLE: LetterIcon = { text: 'Ab', fg: '#ffffff', bg: '#4f46e5', shape: 'rounded', scale: 0.62, bold: true }

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <div className="fv-color">
        <input type="color" aria-label={`${label} picker`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      </div>
    </div>
  )
}

export default function FaviconGenerator() {
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [letter, setLetter] = useState<LetterIcon>(SAMPLE)
  const [src, setSrc] = useState<Source | null>(null)
  const [fit, setFit] = useState<Fit>('contain')
  const [padding, setPadding] = useState(0)
  const [useImgBg, setUseImgBg] = useState(false)
  const [imgBg, setImgBg] = useState('#ffffff')
  const [shape, setShape] = useState<Shape>('rounded')
  const [site, setSite] = useState({ name: 'My Website', shortName: 'Website', themeColor: '#4f46e5', backgroundColor: '#ffffff', path: '/' })
  const [files, setFiles] = useState<OutFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dark, setDark] = useState(false)
  const [maskShape, setMaskShape] = useState<'circle' | 'squircle' | 'none'>('circle')
  const [safe, setSafe] = useState(true)
  const [over, setOver] = useState(false)
  const [gen, setGen] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const urls = useRef<string[]>([])
  const srcUrl = useRef<string | null>(null)
  const token = useRef(0)

  useEffect(() => () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u))
    if (srcUrl.current) URL.revokeObjectURL(srcUrl.current)
  }, [])

  const hasSvg = mode === 'text' || !!src?.svgText
  const info: SiteInfo = { ...site, hasSvg }
  const manifest = buildManifest(info)
  const html = buildHtml(info)

  // Regenerate every file shortly after the settings stop changing.
  useEffect(() => {
    if (mode === 'image' && !src) {
      setFiles([])
      return
    }
    const my = ++token.current
    setBusy(true)
    const t = setTimeout(async () => {
      try {
        const o: Opts = { mode, letter, src, fit, padding, imgBg: useImgBg ? imgBg : null, shape, siteBg: site.backgroundColor }
        const png = async (size: number, v: Variant = 'plain') => {
          const b = await toBlob(render(size, v, o))
          return { blob: b, bytes: new Uint8Array(await b.arrayBuffer()) }
        }
        const [p16, p32, p48, apple, a192, a512, mask] = await Promise.all([png(16), png(32), png(48), png(180, 'apple'), png(192), png(512), png(512, 'maskable')])
        const ico = new Blob([encodeIco([{ size: 16, png: p16.bytes }, { size: 32, png: p32.bytes }, { size: 48, png: p48.bytes }])], { type: 'image/x-icon' })
        const list: Omit<OutFile, 'url'>[] = [
          { name: 'favicon.ico', label: '16, 32, 48 px', blob: ico, size: 48 },
          { name: 'favicon-16x16.png', label: '16 × 16', blob: p16.blob, size: 16 },
          { name: 'favicon-32x32.png', label: '32 × 32', blob: p32.blob, size: 32 },
          { name: 'apple-touch-icon.png', label: '180 × 180, opaque', blob: apple.blob, size: 180 },
          { name: 'android-chrome-192x192.png', label: '192 × 192', blob: a192.blob, size: 192 },
          { name: 'android-chrome-512x512.png', label: '512 × 512', blob: a512.blob, size: 512 },
          { name: 'maskable-icon-512x512.png', label: '512, safe zone', blob: mask.blob, size: 512 },
        ]
        const svg = mode === 'text' ? letterSvg(letter) : src?.svgText
        if (svg) list.push({ name: 'favicon.svg', label: 'Scalable', blob: new Blob([svg], { type: 'image/svg+xml' }) })
        list.push({ name: 'site.webmanifest', label: 'Web app manifest', blob: new Blob([buildManifest({ ...site, hasSvg: !!svg })], { type: 'application/manifest+json' }) })
        if (my !== token.current) return
        const next = list.map((f) => ({ ...f, url: URL.createObjectURL(f.blob) }))
        const old = urls.current
        urls.current = next.map((f) => f.url)
        setFiles(next)
        setGen((g) => g + 1)
        setError('')
        // Keep old URLs alive a moment so images swapping out don't flash broken.
        setTimeout(() => old.forEach((u) => URL.revokeObjectURL(u)), 1000)
      } catch (e) {
        if (my === token.current) setError(e instanceof Error ? e.message : 'Could not generate the icons.')
      } finally {
        if (my === token.current) setBusy(false)
      }
    }, 220)
    return () => clearTimeout(t)
  }, [mode, letter, src, fit, padding, useImgBg, imgBg, shape, site])

  async function openFile(file: File) {
    setError('')
    if (!file.type.startsWith('image/') && !/\.(svg|png|jpe?g|webp|gif|avif|bmp|ico)$/i.test(file.name)) {
      setError('Please choose an image file (PNG, JPG, SVG, WebP…).')
      return
    }
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
    const svgText = isSvg ? await file.text() : undefined
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      let w = img.naturalWidth
      let h = img.naturalHeight
      if (!w || !h) {
        // SVGs without width/height: fall back to the viewBox ratio.
        const vb = svgText && /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svgText)
        w = vb ? Number(vb[1]) : 512
        h = vb ? Number(vb[2]) : 512
      }
      if (srcUrl.current) URL.revokeObjectURL(srcUrl.current)
      srcUrl.current = url
      setSrc({ img, w, h, name: file.name, url, svgText })
      setMode('image')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError('This image could not be opened by your browser.')
    }
    img.src = url
  }

  // Paste an image anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'))
      if (f) openFile(f)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  function downloadAll() {
    setDownloading(true)
    files.forEach((f, i) => setTimeout(() => {
      const a = document.createElement('a')
      a.href = f.url
      a.download = f.name
      a.click()
      if (i === files.length - 1) setDownloading(false)
    }, i * 350))
  }

  const byName = (n: string) => files.find((f) => f.name === n)
  const tabIcon = byName('favicon-32x32.png')
  const apple = byName('apple-touch-icon.png')
  const mask = byName('maskable-icon-512x512.png')
  const setL = (p: Partial<LetterIcon>) => setLetter((l) => ({ ...l, ...p }))

  return (
    <div>
      <PillRow role="tablist" label="Icon source">
        <button type="button" role="tab" aria-selected={mode === 'text'} className={mode === 'text' ? 'btn primary' : 'btn'} onClick={() => setMode('text')}>Text or emoji</button>
        <button type="button" role="tab" aria-selected={mode === 'image'} className={mode === 'image' ? 'btn primary' : 'btn'} onClick={() => setMode('image')}>Upload image</button>
      </PillRow>

      {mode === 'text' ? (
        <div className="fv-controls">
          <div>
            <label htmlFor="fv-text">Letters or emoji (up to 3)</label>
            <input id="fv-text" type="text" value={letter.text} maxLength={16} onChange={(e) => setL({ text: e.target.value })} placeholder="Ab or 🚀" />
          </div>
          <ColorField id="fv-fg" label="Text color" value={letter.fg} onChange={(fg) => setL({ fg })} />
          <ColorField id="fv-bg" label="Background" value={letter.bg} onChange={(bg) => { setL({ bg }); setSite((s) => ({ ...s, themeColor: bg })) }} />
          <div>
            <label htmlFor="fv-scale">Text size: {Math.round(letter.scale * 100)}%</label>
            <input id="fv-scale" type="range" min={0.3} max={0.9} step={0.01} value={letter.scale} onChange={(e) => setL({ scale: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
          <div>
            <span style={{ display: 'block', fontWeight: 600, fontSize: '0.92rem', margin: '16px 0 6px' }}>Shape</span>
            <PillRow label="Shape">
              {(['square', 'rounded', 'circle'] as Shape[]).map((s) => (
                <button key={s} type="button" aria-pressed={letter.shape === s} className={letter.shape === s ? 'btn primary' : 'btn'} onClick={() => setL({ shape: s })} style={{ textTransform: 'capitalize' }}>{s}</button>
              ))}
            </PillRow>
          </div>
          <div>
            <label style={{ fontWeight: 500, marginTop: 44 }}><input type="checkbox" checked={letter.bold} onChange={(e) => setL({ bold: e.target.checked })} /> Bold</label>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`fv-drop ${over ? 'is-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) openFile(f) }}
          >
            <p style={{ fontWeight: 600 }}>Drop a logo here, paste it (Ctrl+V), or</p>
            <label htmlFor="fv-file" className="btn primary" style={{ display: 'inline-block', margin: 0 }}>Choose image</label>
            <input id="fv-file" className="fv-hidden-input" type="file" accept="image/*,.svg,.ico" onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = '' }} />
            <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>A square PNG or SVG of at least 512 × 512 px works best. SVG input also gives you favicon.svg.</p>
          </div>
          {src && (
            <div className="fv-src">
              <img key={src.url} src={src.url} alt="" />
              <span><b>{src.name}</b><br /><span className="muted">{Math.round(src.w)} × {Math.round(src.h)} px{src.svgText ? ' · SVG' : ''}{Math.min(src.w, src.h) < 256 && !src.svgText ? ' · small, large icons may look soft' : ''}</span></span>
            </div>
          )}
          <div className="fv-controls">
            <div>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.92rem', margin: '16px 0 6px' }}>Fit</span>
              <PillRow label="Fit">
                <button type="button" aria-pressed={fit === 'contain'} className={fit === 'contain' ? 'btn primary' : 'btn'} onClick={() => setFit('contain')}>Contain</button>
                <button type="button" aria-pressed={fit === 'cover'} className={fit === 'cover' ? 'btn primary' : 'btn'} onClick={() => setFit('cover')}>Cover</button>
              </PillRow>
            </div>
            <div>
              <label htmlFor="fv-pad">Padding: {Math.round(padding * 100)}%</label>
              <input id="fv-pad" type="range" min={0} max={0.3} step={0.01} value={padding} onChange={(e) => setPadding(Number(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontWeight: 500 }}><input type="checkbox" checked={useImgBg} onChange={(e) => setUseImgBg(e.target.checked)} /> Fill background</label>
              {useImgBg && (
                <div className="fv-color" style={{ marginTop: 6 }}>
                  <input type="color" aria-label="Icon background color" value={imgBg} onChange={(e) => setImgBg(e.target.value)} />
                  <select aria-label="Background shape" value={shape} onChange={(e) => setShape(e.target.value as Shape)}>
                    <option value="square">Square</option>
                    <option value="rounded">Rounded</option>
                    <option value="circle">Circle</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <details style={{ marginTop: 14 }}>
        <summary>Site name, colors and path for the manifest</summary>
        <div className="fv-controls">
          <div>
            <label htmlFor="fv-name">App name</label>
            <input id="fv-name" type="text" value={site.name} onChange={(e) => setSite((s) => ({ ...s, name: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="fv-short">Short name</label>
            <input id="fv-short" type="text" value={site.shortName} onChange={(e) => setSite((s) => ({ ...s, shortName: e.target.value }))} />
          </div>
          <ColorField id="fv-theme" label="Theme color" value={site.themeColor} onChange={(themeColor) => setSite((s) => ({ ...s, themeColor }))} />
          <ColorField id="fv-bgc" label="Background color" value={site.backgroundColor} onChange={(backgroundColor) => setSite((s) => ({ ...s, backgroundColor }))} />
          <div>
            <label htmlFor="fv-path">Icons folder on your site</label>
            <input id="fv-path" type="text" value={site.path} onChange={(e) => setSite((s) => ({ ...s, path: e.target.value }))} />
          </div>
        </div>
      </details>

      {error && <p className="error" role="alert">{error}</p>}
      {mode === 'image' && !src && <p className="muted">Choose an image to generate the icons, or switch to “Text or emoji” for a letter icon.</p>}

      {files.length > 0 && (
        <>
          <h3 style={{ margin: '22px 0 0', fontSize: '1rem' }}>Previews</h3>
          <div className="fv-previews">
            <div>
              <div className={`fv-browser ${dark ? 'dark' : ''}`} aria-label="Browser tab preview">
                <div className="fv-tabs">
                  <div className="fv-tab active">
                    {tabIcon && <img key={`t${gen}`} className="fv-icon-swap" src={tabIcon.url} alt="" />}
                    <span>{site.name || 'My Website'}</span>
                    <span className="fv-x" aria-hidden="true">×</span>
                  </div>
                  <div className="fv-tab"><i className="fv-dot" /><span>Another tab</span></div>
                </div>
                <div className="fv-bar"><div className="fv-url">example.com</div></div>
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <PillRow label="Browser theme">
                  <button type="button" aria-pressed={!dark} className={!dark ? 'btn primary' : 'btn'} onClick={() => setDark(false)}>Light</button>
                  <button type="button" aria-pressed={dark} className={dark ? 'btn primary' : 'btn'} onClick={() => setDark(true)}>Dark</button>
                </PillRow>
              </div>
            </div>
            <div className="fv-home" aria-label="Home screen preview">
              {apple && <div className="fv-app"><img key={`a${gen}`} className="fv-icon-swap" src={apple.url} alt="" /><span>{site.shortName || site.name}</span></div>}
              {mask && <div className="fv-app"><img key={`m${gen}`} className="fv-icon-swap" src={mask.url} alt="" style={{ borderRadius: '50%' }} /><span>Android</span></div>}
            </div>
            {mask && (
              <div>
                <div className="fv-mask" style={{ background: 'repeating-conic-gradient(var(--sunken) 0 25%, var(--surface) 0 50%) 50% / 12px 12px', borderRadius: 8 }}>
                  <img src={mask.url} alt="Maskable icon preview" style={{ clipPath: maskShape === 'circle' ? 'circle(50% at 50% 50%)' : maskShape === 'squircle' ? 'inset(0 round 30%)' : 'none' }} />
                  {safe && <span className="fv-safe" aria-hidden="true" />}
                </div>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <select aria-label="Mask shape" value={maskShape} onChange={(e) => setMaskShape(e.target.value as typeof maskShape)} style={{ width: 'auto' }}>
                    <option value="circle">Circle mask</option>
                    <option value="squircle">Squircle mask</option>
                    <option value="none">No mask</option>
                  </select>
                  <label style={{ fontWeight: 400 }}><input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} /> Safe zone</label>
                </div>
              </div>
            )}
          </div>

          <div className="row" style={{ marginTop: 22, justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Files {busy ? '' : <span className="chip good" key={gen}><Check size={14} /> {files.length} ready</span>}</h3>
            <button type="button" className="btn primary btn-icon" onClick={downloadAll} disabled={busy || downloading}>
              <Icon name="arrow-down-circle" size={18} /> {downloading ? 'Downloading…' : 'Download all'}
            </button>
          </div>
          {busy && <Busy label="Rendering icons…" />}
          <div className={`fv-grid ${busy ? 'busy-bar' : ''}`} key={gen}>
            {files.map((f, i) => (
              <div className="fv-file" key={f.name} style={{ animationDelay: `${i * 40}ms` }}>
                <div className="fv-thumb">
                  {f.name.endsWith('.webmanifest') ? <Icon name="curly-braces" size={36} /> : <img src={f.url} alt={f.name} width={f.size && f.size < 72 ? f.size * (f.size <= 16 ? 2 : 1) : undefined} style={f.size && f.size <= 32 ? { imageRendering: 'pixelated' } : undefined} />}
                </div>
                <div className="fv-name">{f.name}</div>
                <div className="fv-sub">{f.label} · {formatBytes(f.blob.size)}</div>
                <a className="btn" href={f.url} download={f.name}>Download</a>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>“Download all” saves the files one after another (no zip). Your browser may ask once to allow multiple downloads. favicon.ico bundles 16, 32 and 48 px PNG images.</p>
        </>
      )}

      <label htmlFor="fv-html">HTML for your &lt;head&gt;</label>
      <div className="row" style={{ margin: 0, alignItems: 'stretch', flexWrap: 'nowrap' }}>
        <SettleOutput id="fv-html" value={html} style={{ minHeight: 120, flex: 1, minWidth: 0 }} />
      </div>
      <div className="row"><CopyButton text={html} label="Copy HTML" /></div>

      <label htmlFor="fv-manifest">site.webmanifest</label>
      <SettleOutput id="fv-manifest" value={manifest} style={{ minHeight: 220 }} />
      <div className="row"><CopyButton text={manifest} label="Copy manifest" /></div>

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        Everything is drawn on a canvas in your browser; nothing is uploaded. Put the files in the folder you set above (the site root by default) and paste the HTML into your page’s &lt;head&gt;.
        The Apple touch icon gets a solid background because iOS shows transparency as black. The maskable icon keeps your artwork inside the central 80% safe zone so Android’s circle or squircle crop never cuts it off.
      </p>
    </div>
  )
}
