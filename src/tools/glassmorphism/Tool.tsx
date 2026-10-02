import { useEffect, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { DEFAULT_GLASS, glassCss, glassStyle, glassTailwind, type GlassOptions } from './glass'
import './tool.css'

const BACKGROUNDS = [
  { name: 'Aurora', css: 'radial-gradient(circle at 20% 25%, #f472b6 0 18%, transparent 40%), radial-gradient(circle at 80% 30%, #38bdf8 0 16%, transparent 42%), radial-gradient(circle at 55% 85%, #a3e635 0 14%, transparent 40%), linear-gradient(135deg, #312e81, #0f172a)' },
  { name: 'Sunset', css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)' },
  { name: 'Ocean', css: 'radial-gradient(circle at 30% 70%, #22d3ee 0 20%, transparent 45%), linear-gradient(160deg, #1e3a8a, #0891b2)' },
  { name: 'Mint', css: 'radial-gradient(circle at 70% 20%, #fde68a 0 16%, transparent 40%), linear-gradient(120deg, #34d399, #3b82f6)' },
  { name: 'Candy', css: 'conic-gradient(from 45deg at 50% 50%, #f43f5e, #f59e0b, #10b981, #3b82f6, #a855f7, #f43f5e)' },
]

const PRESETS: { name: string; o: Partial<GlassOptions> }[] = [
  { name: 'Frosted', o: { blur: 14, opacity: 0.18, saturation: 180, borderWidth: 1, borderOpacity: 0.35, radius: 20, shadow: 0.2, tint: '#ffffff' } },
  { name: 'Clear', o: { blur: 6, opacity: 0.08, saturation: 120, borderWidth: 1, borderOpacity: 0.5, radius: 16, shadow: 0.1, tint: '#ffffff' } },
  { name: 'Heavy', o: { blur: 30, opacity: 0.35, saturation: 160, borderWidth: 1, borderOpacity: 0.25, radius: 28, shadow: 0.3, tint: '#ffffff' } },
  { name: 'Dark glass', o: { blur: 16, opacity: 0.35, saturation: 140, borderWidth: 1, borderOpacity: 0.15, radius: 18, shadow: 0.35, tint: '#0f172a' } },
]

function Slider({ id, label, value, min, max, step = 1, unit = '', onChange }: { id: string; label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void }) {
  return (
    <div className="gl-slider">
      <label htmlFor={id}>
        <span>{label}</span>
        <span className="muted gl-val">{value}{unit}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

export default function Glassmorphism() {
  const [o, setO] = useState<GlassOptions>(DEFAULT_GLASS)
  const [bg, setBg] = useState(0)
  const [upload, setUpload] = useState<string | null>(null)
  const [out, setOut] = useState<'css' | 'tailwind'>('css')
  const [bump, setBump] = useState(0)
  const [fileError, setFileError] = useState('')
  const urlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  const set = (patch: Partial<GlassOptions>) => setO((x) => ({ ...x, ...patch }))

  function onFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFileError('That file is not an image.')
      return
    }
    setFileError('')
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(file)
    urlRef.current = url
    setUpload(url)
    setBg(-1)
    setBump((n) => n + 1)
  }

  const background = upload && bg === -1 ? `center / cover no-repeat url("${upload}")` : BACKGROUNDS[Math.max(0, bg)].css
  const css = glassCss(o)
  const tw = glassTailwind(o)
  const code = out === 'css' ? css : tw

  return (
    <div>
      <div className="gl-stage wipe-in" style={{ background }} key={`${bg}-${bump}`}>
        {bg !== -1 && (
          <>
            <span className="gl-blob gl-b1" aria-hidden="true" />
            <span className="gl-blob gl-b2" aria-hidden="true" />
          </>
        )}
        <div className="gl-card" style={glassStyle(o)}>
          <div className="gl-card-top">
            <span className="gl-avatar" aria-hidden="true" />
            <div>
              <b>Glass card</b>
              <span>backdrop-filter preview</span>
            </div>
          </div>
          <p>Frosted surfaces blur whatever sits behind them. Tweak the sliders and copy the CSS.</p>
          <span className="gl-pill">Live</span>
        </div>
      </div>

      <div className="row">
        <span className="muted">Background:</span>
        {BACKGROUNDS.map((b, i) => (
          <button key={b.name} type="button" className={`gl-bg-btn ${bg === i ? 'is-on' : ''}`} style={{ background: b.css }} onClick={() => setBg(i)} aria-pressed={bg === i} aria-label={`${b.name} background`} title={b.name} />
        ))}
        {upload && <button type="button" className={`gl-bg-btn ${bg === -1 ? 'is-on' : ''}`} style={{ background: `center / cover url("${upload}")` }} onClick={() => setBg(-1)} aria-pressed={bg === -1} aria-label="Your image" title="Your image" />}
        <label className="btn gl-upload">
          Upload image
          <input type="file" accept="image/*" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </div>

      {fileError && <p className="error">{fileError}</p>}
      <div className="row">
        <span className="muted">Presets:</span>
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className="btn" onClick={() => set(p.o)}>{p.name}</button>
        ))}
      </div>

      <div className="gl-controls">
        <Slider id="gl-blur" label="Blur" value={o.blur} min={0} max={40} unit="px" onChange={(blur) => set({ blur })} />
        <Slider id="gl-op" label="Transparency (tint opacity)" value={Math.round(o.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => set({ opacity: v / 100 })} />
        <Slider id="gl-sat" label="Saturation" value={o.saturation} min={50} max={250} step={5} unit="%" onChange={(saturation) => set({ saturation })} />
        <Slider id="gl-rad" label="Corner radius" value={o.radius} min={0} max={48} unit="px" onChange={(radius) => set({ radius })} />
        <Slider id="gl-bw" label="Border width" value={o.borderWidth} min={0} max={4} unit="px" onChange={(borderWidth) => set({ borderWidth })} />
        <Slider id="gl-bo" label="Border opacity" value={Math.round(o.borderOpacity * 100)} min={0} max={100} unit="%" onChange={(v) => set({ borderOpacity: v / 100 })} />
        <Slider id="gl-sh" label="Shadow" value={Math.round(o.shadow * 100)} min={0} max={60} unit="%" onChange={(v) => set({ shadow: v / 100 })} />
        <div className="gl-slider">
          <label htmlFor="gl-tint"><span>Tint color</span><span className="muted gl-val">{o.tint}</span></label>
          <input id="gl-tint" type="color" value={o.tint} onChange={(e) => set({ tint: e.target.value })} className="gl-tint" />
        </div>
      </div>

      <PillRow label="Output">
        <button type="button" aria-pressed={out === 'css'} className={out === 'css' ? 'btn primary' : 'btn'} onClick={() => setOut('css')}>CSS</button>
        <button type="button" aria-pressed={out === 'tailwind'} className={out === 'tailwind' ? 'btn primary' : 'btn'} onClick={() => setOut('tailwind')}>Tailwind</button>
      </PillRow>
      <SettleOutput value={code} aria-label={out === 'css' ? 'CSS code' : 'Tailwind classes'} rows={out === 'css' ? 9 : 4} />
      <div className="row">
        <CopyButton text={code} />
      </div>
      <p className="muted">
        Glassmorphism relies on <code>backdrop-filter</code>, supported in all current browsers; the <code>-webkit-</code> line covers older Safari. The effect only shows when something colorful sits behind the element, so keep text contrast in mind. Uploaded images stay on your device.
      </p>
    </div>
  )
}
