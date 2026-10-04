import { useState, type CSSProperties } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { FLEX_DEFAULTS, OPTIONS, addItem, flexCss, removeItem, type FlexState } from './flex'

function Select({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default function FlexboxPlayground() {
  const [state, setState] = useState<FlexState>(FLEX_DEFAULTS)

  const set = (patch: Partial<FlexState>) => setState((s) => ({ ...s, ...patch }))
  const code = `.container {\n${flexCss(state).split('\n').map((l) => `  ${l}`).join('\n')}\n}`

  const preview: CSSProperties = {
    display: 'flex',
    flexDirection: state.direction,
    flexWrap: state.wrap,
    justifyContent: state.justify,
    alignItems: state.alignItems,
    alignContent: state.alignContent,
    gap: state.gap,
    minHeight: 200,
  }

  return (
    <div>
      <div style={{ ...preview, padding: 12, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        {Array.from({ length: state.items }, (_, i) => (
          <div
            key={i}
            style={{
              background: i % 2 ? 'var(--accent-soft)' : 'var(--accent)',
              color: i % 2 ? 'var(--text)' : 'var(--accent-text)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 14px',
              fontWeight: 600,
              minHeight: 44 + (i % 3) * 20,
              display: 'grid',
              placeItems: 'center',
              flex: state.wrap === 'nowrap' ? '1 1 0' : '0 0 auto',
              minWidth: 64,
            }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div className="row">
        <button type="button" className="btn btn-icon" onClick={() => setState(removeItem)} disabled={state.items <= 1}>
          <Icon name="minus" size={16} /> Remove box
        </button>
        <button type="button" className="btn btn-icon" onClick={() => setState(addItem)} disabled={state.items >= 12}>
          <Icon name="plus" size={16} /> Add box
        </button>
        <span className="muted">{state.items} boxes</span>
      </div>

      <PillRow label="Flex direction">
        {OPTIONS.direction.map((d) => (
          <button key={d} type="button" aria-pressed={state.direction === d} className={state.direction === d ? 'btn primary' : 'btn'} onClick={() => set({ direction: d })}>{d}</button>
        ))}
      </PillRow>

      <PillRow label="Flex wrap">
        {OPTIONS.wrap.map((w) => (
          <button key={w} type="button" aria-pressed={state.wrap === w} className={state.wrap === w ? 'btn primary' : 'btn'} onClick={() => set({ wrap: w })}>{w}</button>
        ))}
      </PillRow>

      <div className="two-col">
        <Select id="fx-justify" label="justify-content" value={state.justify} options={OPTIONS.justify} onChange={(v) => set({ justify: v as FlexState['justify'] })} />
        <Select id="fx-align" label="align-items" value={state.alignItems} options={OPTIONS.alignItems} onChange={(v) => set({ alignItems: v as FlexState['alignItems'] })} />
      </div>

      <label htmlFor="fx-gap">Gap — <b>{state.gap}px</b></label>
      <input id="fx-gap" type="range" min={0} max={60} value={state.gap} onChange={(e) => set({ gap: Number(e.target.value) })} />

      <div style={{ opacity: state.wrap === 'nowrap' ? 0.5 : 1 }}>
        <Select id="fx-content" label="align-content (wraps only)" value={state.alignContent} options={OPTIONS.alignContent} onChange={(v) => set({ alignContent: v as FlexState['alignContent'] })} />
      </div>

      <SettleOutput value={code} aria-label="Flexbox CSS" rows={9} />
      <div className="row">
        <CopyButton text={code} />
      </div>
      <p className="muted">
        Justify-content spreads items along the main axis; align-items positions them on the cross axis. Align-content only has an
        effect once items wrap onto more than one line. Change the direction to see how the two axes swap.
      </p>
    </div>
  )
}
