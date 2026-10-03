import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { BANNER_H, BANNER_W, DEVICES, type BannerOpts, type Crop, type Pattern, drawBanner } from './banner'

const PATTERNS: { value: Pattern; label: string }[] = [
  { value: 'none', label: 'Clean' },
  { value: 'rings', label: 'Rings' },
  { value: 'dots', label: 'Dots' },
]

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

function DevicePreview({ source, crop, width }: { source: HTMLCanvasElement | null; crop: Crop; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !source) return
    const scale = width / crop.w
    c.width = Math.round(crop.w * scale)
    c.height = Math.round(crop.h * scale)
    c.getContext('2d')?.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height)
  }, [source, crop, width])
  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      <canvas ref={ref} style={{ display: 'block', width: '100%', borderRadius: 6, border: '1px solid var(--border)' }} aria-label={`${crop.name} preview`} />
      <figcaption className="muted" style={{ fontSize: '0.76rem', marginTop: 4, fontFamily: 'var(--mono)' }}>
        {crop.name} · {crop.hint}
      </figcaption>
    </figure>
  )
}

export default function YouTubeBanner() {
  const [opts, setOpts] = useState<BannerOpts>({
    title: 'Your Channel',
    subtitle: 'New videos every week',
    from: '#111827',
    to: '#4f46e5',
    angle: 135,
    textColor: '#ffffff',
    pattern: 'rings',
    showSafe: true,
  })
  const mainRef = useRef<HTMLCanvasElement>(null)
  const [master, setMaster] = useState<HTMLCanvasElement | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const canvas = mainRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    drawBanner(ctx, opts)
    setMaster(canvas)
  }, [opts])

  const set = <K extends keyof BannerOpts>(key: K, value: BannerOpts[K]) => setOpts((o) => ({ ...o, [key]: value }))

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="b-title">Channel name / headline</label>
          <input id="b-title" type="text" value={opts.title} maxLength={60} onChange={(e) => set('title', e.target.value)} />

          <label htmlFor="b-sub">Tagline</label>
          <input id="b-sub" type="text" value={opts.subtitle} maxLength={80} onChange={(e) => set('subtitle', e.target.value)} placeholder="Optional subtitle" />

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <span style={{ flex: 1 }}>
              <label htmlFor="b-from" style={{ marginTop: 0 }}>Gradient start</label>
              <input id="b-from" type="color" value={opts.from} onChange={(e) => set('from', e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} aria-label="Gradient start colour" />
            </span>
            <span style={{ flex: 1 }}>
              <label htmlFor="b-to" style={{ marginTop: 0 }}>Gradient end</label>
              <input id="b-to" type="color" value={opts.to} onChange={(e) => set('to', e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} aria-label="Gradient end colour" />
            </span>
            <span style={{ flex: 1 }}>
              <label htmlFor="b-text" style={{ marginTop: 0 }}>Text</label>
              <input id="b-text" type="color" value={opts.textColor} onChange={(e) => set('textColor', e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} aria-label="Text colour" />
            </span>
          </div>

          <label htmlFor="b-angle">Angle — <b><Roll>{opts.angle}</Roll>°</b></label>
          <input id="b-angle" type="range" min={0} max={360} step={5} value={opts.angle} onChange={(e) => set('angle', Number(e.target.value))} />

          <label htmlFor="b-pattern">Backdrop pattern</label>
          <select id="b-pattern" value={opts.pattern} onChange={(e) => set('pattern', e.target.value as Pattern)}>
            {PATTERNS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          <label className="row" style={{ fontWeight: 400, gap: 8 }}>
            <input type="checkbox" checked={opts.showSafe} onChange={(e) => set('showSafe', e.target.checked)} />
            Show safe-area overlay
          </label>
        </div>

        <div>
          <canvas
            ref={mainRef}
            width={BANNER_W}
            height={BANNER_H}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#000' }}
            aria-label="Banner preview"
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
            Live preview at full {BANNER_W}×{BANNER_H} — the dashed box is the 1546×423 area that survives on every screen.
          </p>
        </div>
      </div>

      <h3 className="eyebrow" style={{ marginTop: 22 }}>How it crops on each device</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <DevicePreview source={master} crop={DEVICES[0]} width={150} />
        <DevicePreview source={master} crop={DEVICES[1]} width={260} />
        <DevicePreview source={master} crop={DEVICES[2]} width={200} />
        <DevicePreview source={master} crop={DEVICES[3]} width={200} />
      </div>

      <div className="row">
        <button
          type="button"
          className={`btn btn-icon primary ${saved ? 'is-done' : ''}`}
          onClick={() => {
            if (mainRef.current) {
              savePng(mainRef.current, 'youtube-banner.png')
              setSaved(true)
              window.setTimeout(() => setSaved(false), 2000)
            }
          }}
        >
          <Icon name={saved ? 'clipboard-check' : 'arrow-right'} size={16} />
          {saved ? 'Saved!' : 'Download PNG (2560×1440)'}
        </button>
      </div>
    </div>
  )
}
