import { useState, type CSSProperties } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { PRESETS, animationCss, keyframesCss, type AnimConfig } from './animation'

const NAME = 'toolAnim'
const EASINGS = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(0.34, 1.56, 0.64, 1)']
const COUNTS: { label: string; value: number | 'infinite' }[] = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: 'Infinite', value: 'infinite' },
]
const DIRECTIONS: AnimConfig['direction'][] = ['normal', 'reverse', 'alternate', 'alternate-reverse']

export default function CssAnimation() {
  const [preset, setPreset] = useState('fade')
  const [playKey, setPlayKey] = useState(0)
  const [config, setConfig] = useState<AnimConfig>({
    duration: 1,
    delay: 0,
    easing: 'ease-in-out',
    iteration: 'infinite',
    direction: 'alternate',
    distance: 24,
  })

  const set = (patch: Partial<AnimConfig>) => setConfig((c) => ({ ...c, ...patch }))
  const animValue = animationCss(NAME, config).replace(/^animation: /, '').replace(/;$/, '')
  const code = `${keyframesCss(NAME, preset, config)}\n\n.demo {\n  ${animationCss(NAME, config)}\n}\n\n<div class="demo">Animate me</div>`

  const demo: CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: 96,
    height: 96,
    borderRadius: 'var(--radius)',
    background: 'linear-gradient(135deg, var(--accent), #ec4899)',
    color: 'var(--accent-text)',
    fontWeight: 700,
    animation: animValue,
  }

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: keyframesCss(NAME, preset, config) }} />

      <div style={{ display: 'grid', placeItems: 'center', padding: 24, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <div key={playKey} style={demo}>Go</div>
      </div>

      <div className="row">
        <button type="button" className="btn" onClick={() => setPlayKey((k) => k + 1)}>Replay</button>
        <span className="muted">{PRESETS.find((p) => p.id === preset)?.name} · {animValue}</span>
      </div>

      <PillRow label="Preset">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id} className={preset === p.id ? 'btn primary' : 'btn'} onClick={() => { setPreset(p.id); setPlayKey((k) => k + 1) }}>{p.name}</button>
        ))}
      </PillRow>

      <div className="two-col">
        <div>
          <label htmlFor="an-dur">Duration — <b>{config.duration}s</b></label>
          <input id="an-dur" type="range" min={0.1} max={5} step={0.1} value={config.duration} onChange={(e) => set({ duration: Number(e.target.value) })} />

          <label htmlFor="an-delay">Delay — <b>{config.delay}s</b></label>
          <input id="an-delay" type="range" min={0} max={2} step={0.1} value={config.delay} onChange={(e) => set({ delay: Number(e.target.value) })} />

          <label htmlFor="an-dist">Distance — <b>{config.distance}px</b></label>
          <input id="an-dist" type="range" min={4} max={120} value={config.distance} onChange={(e) => set({ distance: Number(e.target.value) })} />
        </div>
        <div>
          <label htmlFor="an-ease">Easing</label>
          <select id="an-ease" value={config.easing} onChange={(e) => set({ easing: e.target.value })}>
            {EASINGS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>

          <label htmlFor="an-count">Iterations</label>
          <select id="an-count" value={String(config.iteration)} onChange={(e) => set({ iteration: e.target.value === 'infinite' ? 'infinite' : Number(e.target.value) })}>
            {COUNTS.map((c) => <option key={c.label} value={String(c.value)}>{c.label}</option>)}
          </select>

          <label htmlFor="an-dir">Direction</label>
          <select id="an-dir" value={config.direction} onChange={(e) => set({ direction: e.target.value as AnimConfig['direction'] })}>
            {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <SettleOutput value={code} aria-label="Animation CSS" rows={14} />
      <div className="row">
        <CopyButton text={code} />
      </div>
      <p className="muted">
        The <code>@keyframes</code> rule and the <code>animation</code> shorthand are independent, so you can reuse one keyframe set
        with different timing. Distance only affects presets that move or grow. Replace <code>.demo</code> with your own class before
        pasting.
      </p>
    </div>
  )
}
