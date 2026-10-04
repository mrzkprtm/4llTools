import { useState } from 'react'
import Icon from '../../components/Icon'
import { MAX_ELEMENTS, MODES, PAGE_KEYS, PAGE_SIZES, dotPoints, fileNameFor, formatBytes, gridSpec, hexToRgb, isHeavy, isoLines, mmToPt, normalizeHex, opsFor, type PageSizeKey, type PaperMode } from './paper'

interface DrawLine {
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
  alpha: number
}

interface Result {
  url: string
  name: string
  size: number
}

export default function GraphPaper() {
  const [mode, setMode] = useState<PaperMode>('graph')
  const [size, setSize] = useState<PageSizeKey>('a4')
  const [spacingMm, setSpacingMm] = useState(5)
  const [marginMm, setMarginMm] = useState(15)
  const [color, setColor] = useState('#7c9cc4')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  const page = PAGE_SIZES[size]
  const spacing = mmToPt(spacingMm)
  const margin = mmToPt(marginMm)
  const spec = gridSpec(page.w, page.h, spacing, margin)
  const iso = mode === 'isometric' ? isoLines(page.w, page.h, spacing, margin) : []
  const ops = opsFor(mode, spec, iso.length)
  const tooMany = ops > MAX_ELEMENTS
  const ink = normalizeHex(color)
  const thin = Math.max(0.6, mmToPt(0.18))
  const heavy = Math.max(1.4, mmToPt(0.5))
  const dotRadius = Math.max(0.9, spacing * 0.07)

  const segments: DrawLine[] = []
  if (mode !== 'dots') {
    const withIso = mode === 'isometric'
    for (const [i, x] of spec.xs.entries()) {
      const strong = mode !== 'graph' || isHeavy(i)
      segments.push({ x1: x, y1: spec.y0, x2: x, y2: spec.y1, width: strong ? heavy : thin, alpha: strong ? 1 : 0.55 })
    }
    for (const [i, y] of spec.ys.entries()) {
      const strong = mode !== 'graph' || isHeavy(i)
      segments.push({ x1: spec.x0, y1: y, x2: spec.x1, y2: y, width: strong ? heavy : thin, alpha: strong ? 1 : 0.55 })
    }
    if (withIso) for (const s of iso) segments.push({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, width: thin, alpha: 0.8 })
  }
  const dots = mode === 'dots' ? dotPoints(page.w, page.h, spacing, margin) : []

  function pickMode(next: PaperMode) {
    setMode(next)
    setSpacingMm((mm) => Math.max(mm, MODES.find((m) => m.id === next)?.minSpacingMm ?? 2))
    clearResult()
  }

  function clearResult() {
    setResult((old) => {
      if (old) URL.revokeObjectURL(old.url)
      return null
    })
  }

  async function build() {
    setError('')
    clearResult()
    setBusy(true)
    try {
      const { PDFDocument, rgb } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      const pdfPage = doc.addPage([page.w, page.h])
      const c = hexToRgb(color)
      const inkColor = rgb(c.r, c.g, c.b)
      if (mode === 'dots') {
        for (const p of dots) pdfPage.drawCircle({ x: p.x, y: p.y, size: dotRadius, color: inkColor })
      } else {
        for (const s of segments) {
          pdfPage.drawLine({ start: { x: s.x1, y: s.y1 }, end: { x: s.x2, y: s.y2 }, thickness: s.width, color: inkColor, opacity: s.alpha })
        }
      }
      doc.setTitle(`${MODES.find((m) => m.id === mode)?.label ?? 'Graph'} paper ${size.toUpperCase()}`)
      doc.setProducer('4llTools')
      const bytes = await doc.save()
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      setResult({ url: URL.createObjectURL(blob), name: fileNameFor(mode), size: blob.size })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the PDF.')
    } finally {
      setBusy(false)
    }
  }

  const hint = MODES.find((m) => m.id === mode)
  const minSpacing = hint?.minSpacingMm ?? 2

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="gp-mode">Pattern</label>
          <select id="gp-mode" value={mode} onChange={(e) => pickMode(e.target.value as PaperMode)}>
            {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          {hint && <p className="muted" style={{ fontSize: '0.84rem', margin: '6px 0 0' }}>{hint.hint}</p>}

          <label htmlFor="gp-size">Page size</label>
          <select id="gp-size" value={size} onChange={(e) => { setSize(e.target.value as PageSizeKey); clearResult() }}>
            {PAGE_KEYS.map((k) => <option key={k} value={k}>{PAGE_SIZES[k].label}</option>)}
          </select>

          <label htmlFor="gp-spacing">Square size: {spacingMm} mm</label>
          <input id="gp-spacing" type="range" min={minSpacing} max={20} step={1} value={Math.max(spacingMm, minSpacing)} onChange={(e) => { setSpacingMm(Number(e.target.value)); clearResult() }} />

          <label htmlFor="gp-margin">Margin: {marginMm} mm</label>
          <input id="gp-margin" type="range" min={0} max={30} step={1} value={marginMm} onChange={(e) => { setMarginMm(Number(e.target.value)); clearResult() }} />

          <label htmlFor="gp-color">Line color</label>
          <input id="gp-color" type="color" value={ink} onChange={(e) => { setColor(e.target.value); clearResult() }} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} />

          <div className="stats">
            <div className="stat"><b>{spec.cols}</b>Squares across</div>
            <div className="stat"><b>{spec.rows}</b>Squares down</div>
            <div className="stat"><b>{ops}</b>{mode === 'dots' ? 'Dots' : 'Lines'}</div>
          </div>
        </div>

        <div>
          <h3 className="eyebrow">Preview</h3>
          {tooMany ? (
            <p className="error" role="alert">
              That would need {ops.toLocaleString()} elements. Increase the square size to keep the file quick to draw.
            </p>
          ) : (
            <svg
              viewBox={`0 0 ${page.w} ${page.h}`}
              style={{ display: 'block', width: '100%', height: 'auto', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
              role="img"
              aria-label={`${hint?.label ?? 'Graph'} paper preview, ${spacingMm} mm squares`}
              preserveAspectRatio="xMidYMid meet"
            >
              <g transform={`translate(0 ${page.h}) scale(1 -1)`}>
                {segments.map((s, i) => (
                  <line key={`l${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={ink} strokeWidth={s.width} opacity={s.alpha} />
                ))}
                {dots.map((p, i) => (
                  <circle key={`d${i}`} cx={p.x} cy={p.y} r={dotRadius} fill={ink} />
                ))}
              </g>
            </svg>
          )}

          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={build} disabled={busy || tooMany}>
              <Icon name="file-plus" size={18} /> {busy ? 'Drawing…' : 'Download PDF'}
            </button>
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          {result && (
            <div className="output" aria-live="polite">
              <b>{result.name}</b> — {formatBytes(result.size)}<br />
              <span className="row" style={{ margin: '8px 0 0' }}>
                <a className="btn primary" href={result.url} download={result.name}>Download PDF</a>
              </span>
            </div>
          )}
        </div>
      </div>

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        The PDF is vector, not a picture, so the lines stay sharp at any print resolution and the file stays small. Print at 100% (no “fit to page”) to keep the squares exactly the size you picked.
        Everything is generated in your browser with pdf-lib; nothing is uploaded.
      </p>
    </div>
  )
}
