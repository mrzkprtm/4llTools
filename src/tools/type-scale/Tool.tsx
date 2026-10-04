import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { RATIOS, modularScale, pxToRem, toCssVars, toTailwind } from './scale'

type Out = 'css' | 'tailwind'
const SAMPLE = 'Sphinx of black quartz, judge my vow'

export default function TypeScale() {
  const [base, setBase] = useState(16)
  const [ratio, setRatio] = useState(1.25)
  const [up, setUp] = useState(5)
  const [down, setDown] = useState(2)
  const [root, setRoot] = useState(16)
  const [out, setOut] = useState<Out>('css')

  const scale = modularScale(base, ratio, up, down)
  const code = out === 'css' ? toCssVars(scale, root) : toTailwind(scale, root)
  const name = RATIOS.find((r) => r.value === ratio)?.name ?? 'Custom ratio'

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="ts-base">Base size — <b>{base}px</b></label>
          <input id="ts-base" type="range" min={10} max={28} value={base} onChange={(e) => setBase(Number(e.target.value))} />

          <label htmlFor="ts-ratio">Ratio</label>
          <select id="ts-ratio" value={ratio} onChange={(e) => setRatio(Number(e.target.value))}>
            {RATIOS.map((r) => <option key={r.name} value={r.value}>{r.name} — {r.value}</option>)}
          </select>

          <label htmlFor="ts-root">Root font size — <b>{root}px</b></label>
          <input id="ts-root" type="range" min={12} max={24} value={root} onChange={(e) => setRoot(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="ts-up">Steps up — <b>{up}</b></label>
          <input id="ts-up" type="range" min={0} max={10} value={up} onChange={(e) => setUp(Number(e.target.value))} />

          <label htmlFor="ts-down">Steps down — <b>{down}</b></label>
          <input id="ts-down" type="range" min={0} max={6} value={down} onChange={(e) => setDown(Number(e.target.value))} />
        </div>
      </div>

      <div className="stats">
        <div className="stat">Ratio<b>{name}</b></div>
        <div className="stat">Smallest<b>{scale[0].px}px</b></div>
        <div className="stat">Base<b>{base}px</b></div>
        <div className="stat">Largest<b>{scale[scale.length - 1].px}px</b></div>
      </div>

      <h3 className="eyebrow" style={{ marginTop: 22 }}>Specimen</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {scale.map((s) => (
          <li key={s.step} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: '0.74rem', flex: '0 0 96px' }}>
              step {s.step > 0 ? `+${s.step}` : s.step}
            </span>
            <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: '0.74rem', flex: '0 0 92px' }}>{s.px}px · {pxToRem(s.px, root)}rem</span>
            <span style={{ fontSize: `${s.px}px`, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{SAMPLE}</span>
          </li>
        ))}
      </ul>

      <PillRow label="Output format">
        <button type="button" aria-pressed={out === 'css'} className={out === 'css' ? 'btn primary' : 'btn'} onClick={() => setOut('css')}>CSS variables</button>
        <button type="button" aria-pressed={out === 'tailwind'} className={out === 'tailwind' ? 'btn primary' : 'btn'} onClick={() => setOut('tailwind')}>Tailwind</button>
      </PillRow>
      <SettleOutput value={code} aria-label="Type scale code" rows={scale.length + 3} />
      <div className="row">
        <CopyButton text={code} />
      </div>
      <p className="muted">
        A modular scale multiplies the base size by the ratio for each step, so headings, body text and captions stay in proportion.
        Paste the variables into <code>:root</code>, or drop the object into <code>theme.extend.fontSize</code> in a Tailwind config.
        Sizes are shown in px and in rem against the root font size you set.
      </p>
    </div>
  )
}
