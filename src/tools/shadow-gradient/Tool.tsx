import { useRef, useState, type ReactNode } from 'react'
import CopyButton from '../../components/CopyButton'
import { boxShadowCss, gradientCss, tailwindArbitrary, toHex8, type ColorStop, type Gradient, type GradientType, type ShadowLayer } from './css'

type Layer = ShadowLayer & { id: number }
type Stop = ColorStop & { id: number }

const SHADOW_PRESETS: { name: string; box: string; bg: string; layers: ShadowLayer[] }[] = [
  {
    name: 'Soft',
    box: '#ffffff',
    bg: '#f1f5f9',
    layers: [{ x: 0, y: 10, blur: 30, spread: -5, color: '#0f172a', opacity: 0.15, inset: false }],
  },
  {
    name: 'Layered',
    box: '#ffffff',
    bg: '#f1f5f9',
    layers: [
      { x: 0, y: 1, blur: 2, spread: 0, color: '#0f172a', opacity: 0.06, inset: false },
      { x: 0, y: 4, blur: 8, spread: 0, color: '#0f172a', opacity: 0.06, inset: false },
      { x: 0, y: 12, blur: 24, spread: 0, color: '#0f172a', opacity: 0.08, inset: false },
      { x: 0, y: 24, blur: 48, spread: -8, color: '#0f172a', opacity: 0.12, inset: false },
    ],
  },
  {
    name: 'Neumorphic',
    box: '#e0e5ec',
    bg: '#e0e5ec',
    layers: [
      { x: 9, y: 9, blur: 16, spread: 0, color: '#a3b1c6', opacity: 0.6, inset: false },
      { x: -9, y: -9, blur: 16, spread: 0, color: '#ffffff', opacity: 0.5, inset: false },
    ],
  },
  {
    name: 'Sharp',
    box: '#fde047',
    bg: '#ffffff',
    layers: [{ x: 6, y: 6, blur: 0, spread: 0, color: '#000000', opacity: 1, inset: false }],
  },
  {
    name: 'Inset',
    box: '#f8fafc',
    bg: '#ffffff',
    layers: [{ x: 0, y: 2, blur: 6, spread: 0, color: '#0f172a', opacity: 0.2, inset: true }],
  },
]

const GRADIENT_PRESETS: { name: string; g: Gradient }[] = [
  { name: 'Indigo → Pink', g: { type: 'linear', angle: 135, shape: 'circle', stops: [{ color: '#6366f1', position: 0 }, { color: '#ec4899', position: 100 }] } },
  { name: 'Sunset', g: { type: 'linear', angle: 90, shape: 'circle', stops: [{ color: '#f97316', position: 0 }, { color: '#ef4444', position: 50 }, { color: '#8b5cf6', position: 100 }] } },
  { name: 'Ocean', g: { type: 'linear', angle: 180, shape: 'circle', stops: [{ color: '#22d3ee', position: 0 }, { color: '#1e40af', position: 100 }] } },
  { name: 'Spotlight', g: { type: 'radial', angle: 0, shape: 'circle', stops: [{ color: '#fef08a', position: 0 }, { color: '#f59e0b', position: 40 }, { color: '#78350f', position: 100 }] } },
  { name: 'Color wheel', g: { type: 'conic', angle: 0, shape: 'circle', stops: [{ color: '#ff0000', position: 0 }, { color: '#ffff00', position: 17 }, { color: '#00ff00', position: 33 }, { color: '#00ffff', position: 50 }, { color: '#0000ff', position: 67 }, { color: '#ff00ff', position: 83 }, { color: '#ff0000', position: 100 }] } },
]

export default function ShadowGradient() {
  const [mode, setMode] = useState<'shadow' | 'gradient'>('shadow')
  return (
    <div>
      <div className="row" role="tablist" aria-label="Generator">
        <button type="button" role="tab" aria-selected={mode === 'shadow'} className={mode === 'shadow' ? 'btn primary' : 'btn'} onClick={() => setMode('shadow')}>Box-shadow</button>
        <button type="button" role="tab" aria-selected={mode === 'gradient'} className={mode === 'gradient' ? 'btn primary' : 'btn'} onClick={() => setMode('gradient')}>Gradient</button>
      </div>
      {mode === 'shadow' ? <ShadowPanel /> : <GradientPanel />}
    </div>
  )
}

function Slider({ label, value, min, max, step = 1, unit = 'px', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void }) {
  return (
    <label style={{ fontWeight: 400, display: 'block', margin: '6px 0' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <span>{label}</span>
        <span className="muted" style={{ fontFamily: 'var(--mono)' }}>{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </label>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, background: 'var(--surface)', marginTop: 10 }}>{children}</div>
}

function OutputRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <label>{label}</label>
      <div className="row" style={{ margin: 0, flexWrap: 'nowrap', alignItems: 'stretch' }}>
        <div className="output" style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap' }}>{text}</div>
        <CopyButton text={text} />
      </div>
    </div>
  )
}

function ShadowPanel() {
  const nextId = useRef(100)
  const withIds = (ls: ShadowLayer[]): Layer[] => ls.map((l) => ({ ...l, id: nextId.current++ }))
  const [layers, setLayers] = useState<Layer[]>(() => SHADOW_PRESETS[1].layers.map((l, i) => ({ ...l, id: i })))
  const [boxColor, setBoxColor] = useState('#ffffff')
  const [bgColor, setBgColor] = useState('#f1f5f9')
  const [radius, setRadius] = useState(16)

  const update = (id: number, patch: Partial<ShadowLayer>) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const css = boxShadowCss(layers)

  return (
    <>
      <div className="row">
        <span className="muted">Presets:</span>
        {SHADOW_PRESETS.map((p) => (
          <button key={p.name} type="button" className="btn" onClick={() => { setLayers(withIds(p.layers)); setBoxColor(p.box); setBgColor(p.bg) }}>{p.name}</button>
        ))}
      </div>
      <div style={{ background: bgColor, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: '48px 16px', display: 'flex', justifyContent: 'center', transition: 'background-color 0.2s' }}>
        <div style={{ width: 'min(100%, 220px)', height: 140, background: boxColor, borderRadius: radius, boxShadow: css, transition: 'box-shadow 0.2s, background-color 0.2s, border-radius 0.2s' }} />
      </div>
      <div className="row" style={{ gap: 16 }}>
        <label style={{ fontWeight: 400 }}>Box <input type="color" value={boxColor} onChange={(e) => setBoxColor(e.target.value)} style={{ verticalAlign: 'middle', width: 40, height: 32, padding: 0, border: 'none', background: 'none' }} /></label>
        <label style={{ fontWeight: 400 }}>Background <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ verticalAlign: 'middle', width: 40, height: 32, padding: 0, border: 'none', background: 'none' }} /></label>
        <div style={{ flex: '1 1 160px' }}><Slider label="Corner radius" value={radius} min={0} max={70} onChange={setRadius} /></div>
      </div>

      {layers.map((l, i) => (
        <Card key={l.id}>
          <div className="row" style={{ margin: '0 0 4px', justifyContent: 'space-between' }}>
            <b>Layer {i + 1}</b>
            <span className="row" style={{ margin: 0 }}>
              <label style={{ fontWeight: 400 }}><input type="checkbox" checked={l.inset} onChange={(e) => update(l.id, { inset: e.target.checked })} /> Inset</label>
              <button type="button" className="btn" onClick={() => setLayers((ls) => ls.filter((x) => x.id !== l.id))} aria-label={`Remove layer ${i + 1}`}>Remove</button>
            </span>
          </div>
          <div className="two-col" style={{ gap: '0 16px' }}>
            <Slider label="Offset X" value={l.x} min={-60} max={60} onChange={(x) => update(l.id, { x })} />
            <Slider label="Offset Y" value={l.y} min={-60} max={60} onChange={(y) => update(l.id, { y })} />
            <Slider label="Blur" value={l.blur} min={0} max={100} onChange={(blur) => update(l.id, { blur })} />
            <Slider label="Spread" value={l.spread} min={-40} max={40} onChange={(spread) => update(l.id, { spread })} />
            <label style={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
              Color <input type="color" value={l.color} onChange={(e) => update(l.id, { color: e.target.value })} style={{ width: 40, height: 32, padding: 0, border: 'none', background: 'none' }} />
              <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>{toHex8(l.color, l.opacity)}</span>
            </label>
            <Slider label="Opacity" value={Math.round(l.opacity * 100)} min={0} max={100} unit="%" onChange={(o) => update(l.id, { opacity: o / 100 })} />
          </div>
        </Card>
      ))}
      <div className="row">
        <button type="button" className="btn" onClick={() => setLayers((ls) => [...ls, ...withIds([{ x: 0, y: 8, blur: 20, spread: 0, color: '#000000', opacity: 0.15, inset: false }])])}>+ Add layer</button>
      </div>

      <OutputRow label="CSS" text={`box-shadow: ${css};`} />
      <OutputRow label="Tailwind" text={layers.length ? tailwindArbitrary('shadow', css) : 'shadow-none'} />
    </>
  )
}

function GradientPanel() {
  const nextId = useRef(100)
  const withIds = (ss: ColorStop[]): Stop[] => ss.map((s) => ({ ...s, id: nextId.current++ }))
  const first = GRADIENT_PRESETS[0].g
  const [type, setType] = useState<GradientType>(first.type)
  const [angle, setAngle] = useState(first.angle)
  const [shape, setShape] = useState<'circle' | 'ellipse'>(first.shape)
  const [stops, setStops] = useState<Stop[]>(() => first.stops.map((s, i) => ({ ...s, id: i })))

  const g: Gradient = { type, angle, shape, stops }
  const css = gradientCss(g)
  const update = (id: number, patch: Partial<ColorStop>) => setStops((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  function addStop() {
    const sorted = [...stops].sort((a, b) => a.position - b.position)
    // Put the new stop in the widest gap.
    let pos = 50
    let gap = -1
    for (let i = 0; i < sorted.length - 1; i++) {
      const d = sorted[i + 1].position - sorted[i].position
      if (d > gap) { gap = d; pos = Math.round(sorted[i].position + d / 2) }
    }
    setStops((ss) => [...ss, ...withIds([{ color: '#ffffff', position: pos }])])
  }

  return (
    <>
      <div className="row">
        <span className="muted">Presets:</span>
        {GRADIENT_PRESETS.map((p) => (
          <button key={p.name} type="button" className="btn" onClick={() => { setType(p.g.type); setAngle(p.g.angle); setShape(p.g.shape); setStops(withIds(p.g.stops)) }}>{p.name}</button>
        ))}
      </div>
      <div style={{ height: 200, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: css }} />
      <div className="row">
        {(['linear', 'radial', 'conic'] as GradientType[]).map((t) => (
          <button key={t} type="button" className={type === t ? 'btn primary' : 'btn'} onClick={() => setType(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
        {type === 'radial' && (
          <select value={shape} onChange={(e) => setShape(e.target.value as 'circle' | 'ellipse')} aria-label="Radial shape">
            <option value="circle">circle</option>
            <option value="ellipse">ellipse</option>
          </select>
        )}
      </div>
      {type !== 'radial' && <Slider label={type === 'conic' ? 'Start angle' : 'Angle'} value={angle} min={0} max={360} unit="°" onChange={setAngle} />}

      {stops.map((s, i) => (
        <div key={s.id} className="row" style={{ margin: '6px 0', flexWrap: 'nowrap' }}>
          <input type="color" value={s.color} onChange={(e) => update(s.id, { color: e.target.value })} aria-label={`Stop ${i + 1} color`} style={{ width: 40, height: 32, padding: 0, border: 'none', background: 'none', flex: 'none' }} />
          <input type="range" min={0} max={100} value={s.position} onChange={(e) => update(s.id, { position: Number(e.target.value) })} aria-label={`Stop ${i + 1} position`} style={{ flex: 1, minWidth: 0 }} />
          <span className="muted" style={{ fontFamily: 'var(--mono)', width: 40, textAlign: 'right', flex: 'none' }}>{s.position}%</span>
          <button type="button" className="btn" disabled={stops.length <= 2} onClick={() => setStops((ss) => ss.filter((x) => x.id !== s.id))} aria-label={`Remove stop ${i + 1}`}>×</button>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn" onClick={addStop}>+ Add color stop</button>
      </div>

      <OutputRow label="CSS" text={`background: ${css};`} />
      <OutputRow label="Tailwind" text={tailwindArbitrary('bg', css)} />
    </>
  )
}
