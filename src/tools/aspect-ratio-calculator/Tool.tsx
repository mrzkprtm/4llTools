import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import {
  CSS_UNITS,
  convertUnit,
  fmt,
  heightFor,
  nearestNamed,
  parseRatio,
  ppi,
  round,
  simplify,
  widthFor,
  type CssUnit,
  type UnitContext,
} from './ratio'

type Mode = 'ratio' | 'screen' | 'units'
const MODES: [Mode, string][] = [
  ['ratio', 'Aspect ratio'],
  ['screen', 'Screen & PPI'],
  ['units', 'CSS units'],
]

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

export default function AspectRatioCalculator() {
  const [mode, setMode] = useState<Mode>('ratio')
  return (
    <div>
      <div className="row" role="tablist" aria-label="Calculator">
        {MODES.map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? 'btn primary' : 'btn'}
            onClick={() => setMode(m)}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'ratio' && <RatioPanel />}
      {mode === 'screen' && <ScreenPanel />}
      {mode === 'units' && <UnitsPanel />}
    </div>
  )
}

function Field({ id, label, value, onChange, step }: { id: string; label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" min={0} step={step ?? 'any'} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%' }} />
    </div>
  )
}

const PRESETS = ['16:9', '4:3', '21:9', '1:1', '9:16', '3:2']

function RatioPanel() {
  const [w, setW] = useState('1920')
  const [h, setH] = useState('1080')
  const [preset, setPreset] = useState('16:9')
  const [custom, setCustom] = useState('5:4')
  const [lockW, setLockW] = useState('1280')
  const [lockH, setLockH] = useState('')

  const width = num(w)
  const height = num(h)
  const simple = simplify(width, height)
  const near = simple ? nearestNamed(width, height) : null

  const lockText = preset === 'custom' ? custom : preset
  const lock = parseRatio(lockText)
  const lw = num(lockW)
  const lh = num(lockH)
  // Whichever side the user filled last drives the other one.
  const outH = lock && lw > 0 ? heightFor(lw, lock) : null
  const outW = lock && !(lw > 0) && lh > 0 ? widthFor(lh, lock) : null
  const boxW = lw > 0 ? lw : (outW ?? 0)
  const boxH = lw > 0 ? (outH ?? 0) : lh

  return (
    <>
      <h3 style={{ margin: '18px 0 0' }}>Find the ratio of a size</h3>
      <div className="row">
        <Field id="ar-w" label="Width" value={w} onChange={setW} />
        <Field id="ar-h" label="Height" value={h} onChange={setH} />
      </div>
      {!simple && (w || h) && <p className="error">Enter a width and height greater than 0.</p>}
      {simple && near && (
        <div className="stats">
          <div className="stat"><b>{simple.w}:{simple.h}</b>Simplified ratio</div>
          <div className="stat"><b>{fmt(width / height, 4)}</b>Decimal (w ÷ h)</div>
          <div className="stat">
            <b>{near.label}</b>
            {near.diff < 0.0005 ? 'Exact match' : `Closest common (${(near.diff * 100).toFixed(1)}% off)`} · {near.use}
          </div>
        </div>
      )}

      <h3 style={{ margin: '26px 0 0' }}>Resize while keeping a ratio</h3>
      <div className="row">
        {PRESETS.map((p) => (
          <button key={p} type="button" className={preset === p ? 'btn primary' : 'btn'} onClick={() => setPreset(p)}>{p}</button>
        ))}
        <button type="button" className={preset === 'custom' ? 'btn primary' : 'btn'} onClick={() => setPreset('custom')}>Custom</button>
        {preset === 'custom' && (
          <input type="text" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Custom ratio like 5:4" placeholder="5:4" style={{ width: 90 }} />
        )}
      </div>
      {!lock && <p className="error">Enter a ratio like 5:4 or 2.39:1.</p>}
      <div className="row">
        <Field id="ar-lw" label="Width" value={outW !== null ? String(outW) : lockW} onChange={(v) => { setLockW(v); if (v) setLockH('') }} />
        <Field id="ar-lh" label="Height" value={outH !== null ? String(outH) : lockH} onChange={(v) => { setLockH(v); setLockW('') }} />
      </div>
      {lock && boxW > 0 && boxH > 0 && (
        <>
          <p className="muted" style={{ margin: '4px 0 10px' }}>
            {lockText} → <b style={{ color: 'var(--text)' }}>{fmt(boxW, 2)} × {fmt(boxH, 2)}</b>
          </p>
          <RatioBox w={boxW} h={boxH} label={`${fmt(boxW, 0)} × ${fmt(boxH, 0)}`} />
        </>
      )}
    </>
  )
}

function RatioBox({ w, h, label }: { w: number; h: number; label: string }) {
  const MAX_H = 220
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
      <div
        style={{
          width: `min(100%, ${round((MAX_H * w) / h, 0)}px)`,
          aspectRatio: `${w} / ${h}`,
          maxHeight: MAX_H,
          background: 'var(--accent-soft)',
          border: '2px solid var(--accent)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--mono)',
          fontSize: '0.85rem',
          color: 'var(--accent)',
          transition: 'width 0.25s ease, aspect-ratio 0.25s ease',
          overflow: 'hidden',
        }}
      >
        {label}
      </div>
    </div>
  )
}

const RESOLUTIONS: [string, number, number, string][] = [
  ['HD / 720p', 1280, 720, '16:9'],
  ['Full HD / 1080p', 1920, 1080, '16:9'],
  ['WUXGA', 1920, 1200, '16:10'],
  ['QHD / 1440p', 2560, 1440, '16:9'],
  ['UW-QHD', 3440, 1440, '21:9'],
  ['4K UHD', 3840, 2160, '16:9'],
  ['5K', 5120, 2880, '16:9'],
  ['8K UHD', 7680, 4320, '16:9'],
  ['iPhone 15 (portrait)', 1179, 2556, '~9:19.5'],
  ['iPad (10th gen)', 2360, 1640, '~3:2'],
]

const DPR_EXAMPLES: [string, number][] = [
  ['Standard desktop monitor', 1],
  ['Windows laptop at 150% scaling', 1.5],
  ['MacBook Retina, most Android phones', 2],
  ['iPhone Pro / Max, flagship Android', 3],
]

function ScreenPanel() {
  const [w, setW] = useState('2560')
  const [h, setH] = useState('1440')
  const [diag, setDiag] = useState('27')
  const r = ppi(num(w), num(h), num(diag))
  const width = num(w)
  const height = num(h)

  return (
    <>
      <div className="row">
        <Field id="sc-w" label="Width (px)" value={w} onChange={setW} step="1" />
        <Field id="sc-h" label="Height (px)" value={h} onChange={setH} step="1" />
        <Field id="sc-d" label="Diagonal (inches)" value={diag} onChange={setDiag} step="0.1" />
      </div>
      {!r && <p className="error">Enter a resolution and a diagonal size greater than 0.</p>}
      {r && (
        <div className="stats">
          <div className="stat"><b>{fmt(r.ppi, 1)}</b>Pixels per inch (PPI)</div>
          <div className="stat"><b>{fmt(r.widthIn, 1)}″ × {fmt(r.heightIn, 1)}″</b>Physical size</div>
          <div className="stat"><b>{fmt(r.widthCm, 1)} × {fmt(r.heightCm, 1)}</b>Size in cm</div>
          <div className="stat"><b>{fmt(r.dotPitchMm, 3)} mm</b>Dot pitch</div>
          <div className="stat"><b>{fmt(width * height / 1e6, 2)} MP</b>Total pixels</div>
        </div>
      )}

      <h3 style={{ margin: '24px 0 4px' }}>Device pixel ratio</h3>
      <p className="muted" style={{ marginTop: 0 }}>CSS pixels are what your layout sees: physical pixels ÷ device pixel ratio.</p>
      {width > 0 && height > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="simple">
            <thead><tr><th>DPR</th><th>Typical device</th><th>CSS viewport</th></tr></thead>
            <tbody>
              {DPR_EXAMPLES.map(([name, dpr]) => (
                <tr key={dpr}><td>{dpr}×</td><td>{name}</td><td style={{ whiteSpace: 'nowrap' }}>{fmt(width / dpr, 0)} × {fmt(height / dpr, 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ margin: '24px 0 4px' }}>Common resolutions</h3>
      <p className="muted" style={{ marginTop: 0 }}>Tap a row to load it.</p>
      <div style={{ overflowX: 'auto' }}>
        <table className="simple">
          <thead><tr><th>Name</th><th>Pixels</th><th>Ratio</th></tr></thead>
          <tbody>
            {RESOLUTIONS.map(([name, rw, rh, ratio]) => (
              <tr key={name} onClick={() => { setW(String(rw)); setH(String(rh)) }} style={{ cursor: 'pointer' }}>
                <td>{name}</td><td style={{ whiteSpace: 'nowrap' }}>{rw} × {rh}</td><td>{ratio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

const UNIT_LABEL: Record<CssUnit, string> = {
  px: 'Pixels',
  rem: 'Relative to root font-size',
  em: 'Relative to parent font-size',
  pt: 'Points (1pt = 1/72in, 96px per inch)',
  vw: '% of viewport width',
  vh: '% of viewport height',
  '%': '% of parent font-size',
}

function UnitsPanel() {
  const [value, setValue] = useState('24')
  const [from, setFrom] = useState<CssUnit>('px')
  const [root, setRoot] = useState('16')
  const [parent, setParent] = useState('16')
  const [vw, setVw] = useState('1440')
  const [vh, setVh] = useState('900')

  const ctx: UnitContext = { rootPx: num(root), parentPx: num(parent), viewportW: num(vw), viewportH: num(vh) }
  const ctxOk = Object.values(ctx).every((n) => n > 0)
  const v = num(value)

  return (
    <>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="number" inputMode="decimal" step="any" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Value" style={{ flex: 1, minWidth: 0 }} />
        <select value={from} onChange={(e) => setFrom(e.target.value as CssUnit)} aria-label="Unit">
          {CSS_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="row">
        <Field id="u-root" label="Root font-size (px)" value={root} onChange={setRoot} />
        <Field id="u-parent" label="Parent font-size (px)" value={parent} onChange={setParent} />
        <Field id="u-vw" label="Viewport width (px)" value={vw} onChange={setVw} />
        <Field id="u-vh" label="Viewport height (px)" value={vh} onChange={setVh} />
      </div>
      {!ctxOk && <p className="error">Font sizes and viewport sizes must be greater than 0.</p>}
      {ctxOk && !Number.isFinite(v) && <p className="error">Enter a number to convert.</p>}
      {ctxOk && Number.isFinite(v) && (
        <div style={{ overflowX: 'auto' }}>
          <table className="simple">
            <thead><tr><th>Value</th><th>Meaning</th><th /></tr></thead>
            <tbody>
              {CSS_UNITS.map((u) => {
                const out = `${fmt(convertUnit(v, from, u, ctx))}${u}`
                return (
                  <tr key={u} style={u === from ? { background: 'var(--accent-soft)' } : undefined}>
                    <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}><b>{out}</b></td>
                    <td className="muted">{UNIT_LABEL[u]}</td>
                    <td style={{ textAlign: 'right' }}><CopyButton text={out} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {ctxOk && (
        <>
          <h3 style={{ margin: '24px 0 4px' }}>px → rem at {fmt(ctx.rootPx)}px root</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="simple">
              <thead><tr><th>px</th><th>rem</th><th>px</th><th>rem</th></tr></thead>
              <tbody>
                {[[8, 20], [10, 24], [12, 28], [14, 32], [16, 40], [18, 48]].map(([a, b]) => (
                  <tr key={a}>
                    <td>{a}px</td><td style={{ fontFamily: 'var(--mono)' }}>{fmt(a / ctx.rootPx)}rem</td>
                    <td>{b}px</td><td style={{ fontFamily: 'var(--mono)' }}>{fmt(b / ctx.rootPx)}rem</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
