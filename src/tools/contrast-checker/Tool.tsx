import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { useSettled } from '../../motion/useSettled'
import { parseColor, rgbToHex, type RGB } from '../color-palette/oklch'
import { apcaContrast, apcaGuidance, contrastRatio, formatRatio, suggestPassing, wcagChecks } from './contrast'
import './tool.css'

const TARGETS = [
  { id: 4.5, label: 'AA (4.5:1)' },
  { id: 7, label: 'AAA (7:1)' },
  { id: 3, label: 'Large / UI (3:1)' },
]

function ColorField({ id, label, value, onChange, fallback }: { id: string; label: string; value: string; onChange: (v: string) => void; fallback: RGB }) {
  const rgb = parseColor(value)
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
        <input type="color" aria-label={`Pick ${label.toLowerCase()}`} value={rgbToHex(rgb ?? fallback)} onChange={(e) => onChange(e.target.value)} className="cc-picker" />
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} className="cc-text" aria-invalid={!rgb} />
      </div>
      {!rgb && <p className="error cc-small">Use #hex, rgb(), hsl() or oklch().</p>}
    </div>
  )
}

export default function ContrastChecker() {
  const [fgText, setFg] = useState('#6b7280')
  const [bgText, setBg] = useState('#ffffff')
  const [target, setTarget] = useState(4.5)
  const [swaps, setSwaps] = useState(0)
  const [last, setLast] = useState<{ fg: RGB; bg: RGB }>({ fg: parseColor('#6b7280')!, bg: parseColor('#ffffff')! })

  const fgP = parseColor(fgText)
  const bgP = parseColor(bgText)
  const fg = fgP ?? last.fg
  const bg = bgP ?? last.bg
  if (fgP && bgP && (rgbToHex(fgP) !== rgbToHex(last.fg) || rgbToHex(bgP) !== rgbToHex(last.bg))) setLast({ fg: fgP, bg: bgP })

  const ratio = contrastRatio(fg, bg)
  const checks = wcagChecks(ratio)
  const lc = apcaContrast(fg, bg)
  const guide = apcaGuidance(lc)
  const fgHex = rgbToHex(fg)
  const bgHex = rgbToHex(bg)
  const settled = useSettled(`${fgHex}${bgHex}`, 150)
  const textFix = suggestPassing(fg, bg, target)
  const bgFix = suggestPassing(bg, fg, target)

  function swap() {
    setFg(bgText)
    setBg(fgText)
    setSwaps((n) => n + 1)
  }

  const ratioText = formatRatio(ratio)
  const lcText = `${lc < 0 ? '−' : ''}${Math.abs(lc).toFixed(1)}`

  return (
    <div>
      <div className="cc-inputs">
        <ColorField id="cc-fg" label="Text color" value={fgText} onChange={setFg} fallback={last.fg} />
        <button type="button" className="btn cc-swap" onClick={swap} aria-label="Swap text and background colors" title="Swap">
          <span key={swaps} className={swaps ? 'cc-swap-icon spun' : 'cc-swap-icon'} aria-hidden="true">⇄</span>
        </button>
        <ColorField id="cc-bg" label="Background color" value={bgText} onChange={setBg} fallback={last.bg} />
      </div>

      <div className="cc-preview" style={{ background: bgHex, color: fgHex }}>
        <p className="cc-large">Large text · 24px regular</p>
        <p className="cc-normal">Normal body text at 16px. The quick brown fox jumps over the lazy dog, and readers with low vision should still follow along comfortably.</p>
        <p className="cc-row">
          <span className="cc-ui" style={{ borderColor: fgHex }}>UI button</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></svg>
          <small>Small 13px caption</small>
        </p>
      </div>

      <div className="stats">
        <div className="stat">
          WCAG 2.2 ratio
          <b className="cc-num"><Roll>{ratioText}</Roll></b>
        </div>
        <div className="stat">
          APCA Lc
          <b className="cc-num"><Roll>{lcText}</Roll></b>
        </div>
      </div>

      <div className="cc-chips" aria-live="polite" key={`chips-${settled}`}>
        {checks.map((c) => (
          <span key={c.id} className={`chip ${c.pass ? 'good' : 'bad calm'}`} title={`WCAG ${c.sc}, needs ${c.min}:1`}>
            {c.pass ? '✓' : '✕'} {c.label} <span className="cc-min">{c.min}:1</span>
          </span>
        ))}
      </div>

      <div className={`cc-apca ${guide.tone}`}>
        <b>{guide.level}</b> <span>{guide.use}</span>
        <div className="bar" aria-hidden="true"><i style={{ transform: `scaleX(${Math.min(1, Math.abs(lc) / 106)})` }} /></div>
        <p className="muted cc-small">
          APCA (0.0.98G-4g, the candidate method for WCAG 3) is polarity-aware: positive Lc means dark text on a light background, negative means light on dark. It is guidance, not yet a legal standard; WCAG 2.2 ratios are what audits check today.
        </p>
      </div>

      <h3 className="cc-h">Suggest a passing color</h3>
      <PillRow label="Target contrast">
        {TARGETS.map((t) => (
          <button key={t.id} type="button" aria-pressed={target === t.id} className={target === t.id ? 'btn primary' : 'btn'} onClick={() => setTarget(t.id)}>
            {t.label}
          </button>
        ))}
      </PillRow>
      {!textFix && !bgFix ? (
        <p className="ok settle-in">This pair already meets {target}:1. Nothing to fix.</p>
      ) : (
        <div className="cc-fixes">
          {[
            { fix: textFix, what: 'text', apply: (h: string) => setFg(h), other: bgHex, isText: true },
            { fix: bgFix, what: 'background', apply: (h: string) => setBg(h), other: fgHex, isText: false },
          ].map(({ fix, what, apply, other, isText }) =>
            fix ? (
              <div key={what + fix.hex} className="cc-fix settle-in">
                <span className="cc-fix-sample" style={isText ? { color: fix.hex, background: other } : { color: other, background: fix.hex }}>Aa</span>
                <div className="cc-fix-body">
                  <b>{fix.direction === 'darker' ? 'Darker' : 'Lighter'} {what}</b>
                  <code>{fix.hex}</code> <span className="muted">{formatRatio(fix.ratio)}</span>
                </div>
                <button type="button" className="btn primary" onClick={() => apply(fix.hex)}>Apply</button>
                <CopyButton text={fix.hex} />
              </div>
            ) : (
              <p key={what} className="muted cc-small">No {what} color with the same hue can reach {target}:1 here.</p>
            ),
          )}
        </div>
      )}
      <p className="muted">
        Suggestions keep the hue and chroma and only change lightness in OKLCH, so the color still feels like yours. WCAG ratios are truncated, not rounded, so 4.499:1 correctly fails AA.
      </p>
    </div>
  )
}
