import { useEffect, useId, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import PillRow from '../../motion/PillRow'
import { FORMATS, bulkLines, fileSafe, validate, type Format } from './barcode'
import './tool.css'

type Lib = typeof import('jsbarcode')
type Opts = { width: number; height: number; displayValue: boolean; lineColor: string; background: string; margin: number; fontSize: number }

const DEFAULT_OPTS: Opts = { width: 2, height: 90, displayValue: true, lineColor: '#111111', background: '#ffffff', margin: 10, fontSize: 18 }

function useJsBarcode() {
  const [lib, setLib] = useState<Lib | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    import('jsbarcode')
      .then((m) => live && setLib(() => m.default))
      .catch(() => live && setError('Could not load the barcode engine. Check your connection and reload.'))
    return () => {
      live = false
    }
  }, [])
  return { lib, error }
}

function save(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function svgText(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.removeAttribute('class')
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
}

function downloadPng(lib: Lib, value: string, format: Format, o: Opts, name: string) {
  const canvas = document.createElement('canvas')
  // Render at 2× bar width for a crisper print, keeping proportions.
  lib(canvas, value, { format, ...o, width: o.width * 2, height: o.height * 2, margin: o.margin * 2, fontSize: o.fontSize * 2 })
  canvas.toBlob((b) => b && save(`${name}.png`, b), 'image/png')
}

/** Renders one barcode into an <svg>. Reports validity to the parent. */
function BarcodeSvg({ lib, value, format, o, svgRef }: { lib: Lib; value: string; format: Format; o: Opts; svgRef?: (el: SVGSVGElement | null) => void }) {
  const ref = useRef<SVGSVGElement>(null)
  const [bad, setBad] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    let ok = true
    try {
      lib(ref.current, value, { format, ...o, valid: (v: boolean) => (ok = v) })
    } catch {
      ok = false
    }
    setBad(!ok)
  }, [lib, value, format, o.width, o.height, o.displayValue, o.lineColor, o.background, o.margin, o.fontSize])
  return (
    <>
      <svg
        ref={(el) => {
          ref.current = el
          svgRef?.(el)
        }}
        className="bg-svg"
        role="img"
        aria-label={`${format} barcode for ${value}`}
        style={{ display: bad ? 'none' : undefined }}
      />
      {bad && <p className="error">The barcode engine rejected this value.</p>}
    </>
  )
}

export default function BarcodeGenerator() {
  const { lib, error: libError } = useJsBarcode()
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [format, setFormat] = useState<Format>('EAN13')
  const [value, setValue] = useState<string>(FORMATS.find((f) => f.id === 'EAN13')!.example)
  const [bulk, setBulk] = useState('590123412345\n400638133393\n9780201379624\n501234567890')
  const [o, setO] = useState<Opts>(DEFAULT_OPTS)
  const single = useRef<SVGSVGElement | null>(null)
  const bulkSvgs = useRef<Record<number, SVGSVGElement | null>>({})
  const ids = useId()

  const info = FORMATS.find((f) => f.id === format)!
  const v = validate(format, value)
  const set = (patch: Partial<Opts>) => setO((x) => ({ ...x, ...patch }))

  function changeFormat(f: Format) {
    setFormat(f)
    // Swap in the new format's example when the current value would not fit it.
    if (!validate(f, value).ok) setValue(FORMATS.find((x) => x.id === f)!.example)
  }

  const lines = bulkLines(bulk)
  const checked = lines.map((l) => ({ raw: l, v: validate(format, l) }))
  const valid = checked.filter((c) => c.v.ok).length

  function downloadSheet() {
    const parts: string[] = []
    let y = 0
    let w = 0
    checked.forEach((c, i) => {
      const el = bulkSvgs.current[i]
      if (!c.v.ok || !el) return
      const ew = parseFloat(el.getAttribute('width') ?? '0')
      const eh = parseFloat(el.getAttribute('height') ?? '0')
      parts.push(`<g transform="translate(0 ${y})">${el.innerHTML}</g>`)
      y += eh + 16
      w = Math.max(w, ew)
    })
    if (!parts.length) return
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${y - 16}" viewBox="0 0 ${w} ${y - 16}">${parts.join('')}</svg>`
    save(`barcodes-${format.toLowerCase()}.svg`, new Blob([svg], { type: 'image/svg+xml' }))
  }

  return (
    <div>
      <PillRow role="tablist" label="Mode">
        <button type="button" role="tab" aria-selected={mode === 'single'} className={mode === 'single' ? 'btn primary' : 'btn'} onClick={() => setMode('single')}>Single</button>
        <button type="button" role="tab" aria-selected={mode === 'bulk'} className={mode === 'bulk' ? 'btn primary' : 'btn'} onClick={() => setMode('bulk')}>Bulk</button>
      </PillRow>

      <label htmlFor={`${ids}-fmt`}>Format</label>
      <select id={`${ids}-fmt`} value={format} onChange={(e) => changeFormat(e.target.value as Format)}>
        {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
      <p className="muted bg-small" key={format}><span className="settle-in" style={{ display: 'inline-block' }}>{info.hint}</span></p>

      {mode === 'single' ? (
        <>
          <label htmlFor={`${ids}-val`}>Value</label>
          <input id={`${ids}-val`} type="text" value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} autoComplete="off" className="bg-mono" aria-invalid={!v.ok} aria-describedby={`${ids}-msg`} />
          <div id={`${ids}-msg`} aria-live="polite">
            {!v.ok ? <p className="error">{v.error}</p> : v.note ? <p className="bg-small"><span className="chip good">{v.note}</span></p> : null}
          </div>
        </>
      ) : (
        <>
          <label htmlFor={`${ids}-bulk`}>Values, one per line (up to 50)</label>
          <textarea id={`${ids}-bulk`} value={bulk} onChange={(e) => setBulk(e.target.value)} spellCheck={false} rows={6} />
          <p className="bg-small">
            <span className={`chip ${valid === lines.length && lines.length ? 'good' : 'bad calm'}`}>{valid} of {lines.length} valid</span>
          </p>
        </>
      )}

      <details className="bg-options" open>
        <summary>Size and colors</summary>
        <div className="bg-grid">
          <Range id={`${ids}-w`} label="Bar width" value={o.width} min={1} max={4} unit="px" onChange={(width) => set({ width })} />
          <Range id={`${ids}-h`} label="Height" value={o.height} min={20} max={200} unit="px" onChange={(height) => set({ height })} />
          <Range id={`${ids}-m`} label="Margin (quiet zone)" value={o.margin} min={0} max={40} unit="px" onChange={(margin) => set({ margin })} />
          <Range id={`${ids}-f`} label="Font size" value={o.fontSize} min={10} max={32} unit="px" onChange={(fontSize) => set({ fontSize })} />
          <div className="bg-colors">
            <label className="bg-inline"><input type="checkbox" checked={o.displayValue} onChange={(e) => set({ displayValue: e.target.checked })} /> Show text</label>
            <label className="bg-inline">Bars <input type="color" value={o.lineColor} onChange={(e) => set({ lineColor: e.target.value })} className="bg-color" /></label>
            <label className="bg-inline">Background <input type="color" value={o.background} onChange={(e) => set({ background: e.target.value })} className="bg-color" /></label>
            <button type="button" className="btn" onClick={() => setO(DEFAULT_OPTS)}>Reset</button>
          </div>
        </div>
      </details>

      {libError && <p className="error">{libError}</p>}
      {!lib && !libError && <Busy label="Loading barcode engine…" />}

      {lib && mode === 'single' && v.ok && (
        <>
          <div className="bg-preview">
            <BarcodeSvg lib={lib} value={v.value} format={format} o={o} svgRef={(el) => (single.current = el)} />
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => single.current && save(`${fileSafe(v.value)}.svg`, new Blob([svgText(single.current)], { type: 'image/svg+xml' }))}>Download SVG</button>
            <button type="button" className="btn" onClick={() => downloadPng(lib, v.value, format, o, fileSafe(v.value))}>Download PNG</button>
          </div>
        </>
      )}

      {lib && mode === 'bulk' && (
        <>
          <div className="bg-bulk">
            {checked.map((c, i) => (
              <div key={`${i}:${c.raw}`} className="bg-item" style={{ ['--i' as string]: Math.min(i, 12) }}>
                {c.v.ok ? (
                  <>
                    <div className="bg-preview bg-preview-sm">
                      <BarcodeSvg lib={lib} value={c.v.value} format={format} o={o} svgRef={(el) => (bulkSvgs.current[i] = el)} />
                    </div>
                    <div className="bg-item-foot">
                      <code>{c.v.value}</code>
                      <span>
                        <button type="button" className="btn bg-mini-btn" onClick={() => { const el = bulkSvgs.current[i]; if (el && c.v.ok) save(`${fileSafe(c.v.value)}.svg`, new Blob([svgText(el)], { type: 'image/svg+xml' })) }}>SVG</button>
                        <button type="button" className="btn bg-mini-btn" onClick={() => c.v.ok && downloadPng(lib, c.v.value, format, o, fileSafe(c.v.value))}>PNG</button>
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="error bg-small"><code>{c.raw}</code>: {c.v.error}</p>
                )}
              </div>
            ))}
          </div>
          <div className="row">
            <button type="button" className="btn primary" onClick={downloadSheet} disabled={!valid}>Download all as one SVG sheet</button>
          </div>
        </>
      )}

      <p className="muted">
        Barcodes are drawn in your browser with JsBarcode; nothing is uploaded. For EAN-13, EAN-8, UPC-A and ITF-14 the GS1 check digit is calculated for you, and a wrong one is flagged. Keep the quiet zone (margin) and good contrast so scanners can read printed codes; test a print before a large run.
      </p>
    </div>
  )
}

function Range({ id, label, value, min, max, unit, onChange }: { id: string; label: string; value: number; min: number; max: number; unit: string; onChange: (n: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="bg-range-label"><span>{label}</span><span className="muted bg-mono">{value}{unit}</span></label>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  )
}
