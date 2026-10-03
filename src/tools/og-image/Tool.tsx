import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { OG_H, OG_W, PRESETS, type OgOpts, drawOg } from './og'

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

export default function OgImage() {
  const [opts, setOpts] = useState<OgOpts>({
    brand: '4llTools',
    title: 'Ten free browser tools, zero sign-ups',
    description: 'Converters, calculators and generators that run entirely on your device.',
    from: '#0f172a',
    to: '#312e81',
    angle: 120,
    textColor: '#ffffff',
    stripe: true,
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawOg(ctx, opts)
  }, [opts])

  const set = <K extends keyof OgOpts>(key: K, value: OgOpts[K]) => setOpts((o) => ({ ...o, [key]: value }))
  const gradient = opts.to !== null

  return (
    <div>
      <h3 className="eyebrow">Start from a palette</h3>
      <div className="row" style={{ marginTop: 0 }}>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            className="btn"
            style={{
              background: p.to ? `linear-gradient(120deg, ${p.from}, ${p.to})` : p.from,
              color: p.textColor,
              borderColor: 'var(--border-strong)',
            }}
            onClick={() => setOpts((o) => ({ ...o, from: p.from, to: p.to, textColor: p.textColor }))}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="two-col" style={{ marginTop: 18 }}>
        <div>
          <label htmlFor="o-brand">Brand / site name</label>
          <input id="o-brand" type="text" value={opts.brand} maxLength={40} onChange={(e) => set('brand', e.target.value)} />

          <label htmlFor="o-title">Headline</label>
          <input id="o-title" type="text" value={opts.title} maxLength={120} onChange={(e) => set('title', e.target.value)} />

          <label htmlFor="o-desc">Description</label>
          <input id="o-desc" type="text" value={opts.description} maxLength={160} onChange={(e) => set('description', e.target.value)} placeholder="Optional one-liner" />

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <span style={{ flex: 1 }}>
              <label htmlFor="o-from" style={{ marginTop: 0 }}>Background</label>
              <input id="o-from" type="color" value={opts.from} onChange={(e) => set('from', e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} aria-label="Background colour" />
            </span>
            <span style={{ flex: 1 }}>
              <label htmlFor="o-to" style={{ marginTop: 0 }}>Blend to {gradient ? '' : '(off)'}</label>
              <input id="o-to" type="color" value={opts.to ?? opts.from} disabled={!gradient} onChange={(e) => set('to', e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none', opacity: gradient ? 1 : 0.4 }} aria-label="Gradient end colour" />
            </span>
            <span style={{ flex: 1 }}>
              <label htmlFor="o-text" style={{ marginTop: 0 }}>Text</label>
              <input id="o-text" type="color" value={opts.textColor} onChange={(e) => set('textColor', e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} aria-label="Text colour" />
            </span>
          </div>

          <label className="row" style={{ fontWeight: 400, gap: 8 }}>
            <input type="checkbox" checked={gradient} onChange={(e) => set('to', e.target.checked ? '#312e81' : null)} />
            Gradient background
          </label>
          {gradient && (
            <>
              <label htmlFor="o-angle">Angle — <b><Roll>{opts.angle}</Roll>°</b></label>
              <input id="o-angle" type="range" min={0} max={360} step={5} value={opts.angle} onChange={(e) => set('angle', Number(e.target.value))} />
            </>
          )}
          <label className="row" style={{ fontWeight: 400, gap: 8 }}>
            <input type="checkbox" checked={opts.stripe} onChange={(e) => set('stripe', e.target.checked)} />
            Accent stripe at the bottom
          </label>
        </div>

        <div>
          <canvas
            ref={canvasRef}
            width={OG_W}
            height={OG_H}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
            aria-label="Open Graph card preview"
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
            Exact {OG_W}×{OG_H} — the size Facebook, X, LinkedIn and Discord read from your <code>og:image</code> tag.
          </p>
        </div>
      </div>

      <div className="row">
        <button
          type="button"
          className={`btn btn-icon primary ${saved ? 'is-done' : ''}`}
          onClick={() => {
            if (canvasRef.current) {
              savePng(canvasRef.current, 'og-image.png')
              setSaved(true)
              window.setTimeout(() => setSaved(false), 2000)
            }
          }}
        >
          <Icon name={saved ? 'clipboard-check' : 'arrow-right'} size={16} />
          {saved ? 'Saved!' : 'Download PNG (1200×630)'}
        </button>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Then reference it with <code>&lt;meta property="og:image" content="…"&gt;</code>.</span>
      </div>
    </div>
  )
}
