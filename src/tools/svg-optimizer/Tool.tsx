import { useMemo, useState, type DragEvent } from 'react'
import CopyButton from '../../components/CopyButton'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import { DEFAULT_OPTIONS, formatBytes, optimizeSvg, svgDataUrl, type SvgOptions } from './optimize'

const EXAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with a vector editor -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="120" height="120" viewBox="0 0 120 120" version="1.1">
  <title>Badge</title>
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description about="badge"/></rdf:RDF>
  </metadata>
  <defs>
    <linearGradient id="gradientBackground" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366F1;stop-opacity:1.000000" />
      <stop offset="100%" style="stop-color:#EC4899;stop-opacity:1.000000" />
    </linearGradient>
  </defs>
  <g id="layer1" fill="none">
    <g>
      <circle cx="60.000000" cy="60.000000" r="54.000000" fill="url(#gradientBackground)" />
    </g>
    <path d="M 38.000000 62.000000 L 52.000000 76.000000 L 84.000000 44.000000" stroke="#FFFFFF" stroke-width="10.000000" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  </g>
</svg>`

const CHECKER =
  'repeating-conic-gradient(var(--sunken) 0% 25%, var(--surface) 0% 50%) 50% / 16px 16px'

function Preview({ title, svg, size }: { title: string; svg: string; size: string }) {
  return (
    <div>
      <label>
        {title} <span className="muted" style={{ fontWeight: 400 }}>· {size}</span>
      </label>
      <div
        style={{
          background: CHECKER,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <img src={svgDataUrl(svg)} alt={`${title} preview`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    </div>
  )
}

export default function SvgOptimizer() {
  const [input, setInput] = useState(EXAMPLE)
  const [fileName, setFileName] = useState('image.svg')
  const [opts, setOpts] = useState<SvgOptions>(DEFAULT_OPTIONS)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState('')

  const result = useMemo(() => optimizeSvg(input, opts), [input, opts])
  const set = <K extends keyof SvgOptions>(k: K, v: SvgOptions[K]) => setOpts((o) => ({ ...o, [k]: v }))

  async function loadFile(file: File | undefined) {
    if (!file) return
    if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
      setFileError(`${file.name} is not an .svg file.`)
      return
    }
    setFileError('')
    setFileName(file.name)
    setInput(await file.text())
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    loadFile(e.dataTransfer.files[0])
  }

  function download() {
    if (!result.ok) return
    const url = URL.createObjectURL(new Blob([result.data], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.replace(/\.svg$/i, '') + '.min.svg'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const saved = result.ok && result.before > 0 ? ((result.before - result.after) / result.before) * 100 : 0

  return (
    <div>
      <label htmlFor="svg-in">SVG markup</label>
      <textarea
        id="svg-in"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        spellCheck={false}
        placeholder="Paste <svg>…</svg> here, or drop a .svg file"
        style={{ minHeight: 160, fontFamily: 'var(--mono)', fontSize: '0.82rem', outline: dragging ? '2px dashed var(--accent)' : undefined, animation: dragging ? 'breathe 1.2s ease-in-out infinite' : undefined }}
      />
      <div className="row">
        <label htmlFor="svg-file" className="btn" style={{ cursor: 'pointer' }}>Open .svg file</label>
        <input
          id="svg-file"
          type="file"
          accept=".svg,image/svg+xml"
          style={{ display: 'none' }}
          onChange={(e) => {
            loadFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <button type="button" className="btn" onClick={() => setInput('')}>Clear</button>
        <span className="muted">or drag a file onto the box</span>
      </div>
      {fileError && <p className="error shake-once" key={fileError}>{fileError}</p>}

      <div className="row" style={{ gap: 16 }}>
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={opts.multipass} onChange={(e) => set('multipass', e.target.checked)} /> Multipass
        </label>
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={opts.removeViewBox} onChange={(e) => set('removeViewBox', e.target.checked)} /> Remove viewBox
        </label>
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={opts.keepIds} onChange={(e) => set('keepIds', e.target.checked)} /> Keep IDs
        </label>
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={opts.pretty} onChange={(e) => set('pretty', e.target.checked)} /> Pretty print
        </label>
      </div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <label htmlFor="svg-precision" style={{ whiteSpace: 'nowrap' }}>Decimals: {opts.precision}</label>
        <input
          id="svg-precision"
          type="range"
          min={0}
          max={8}
          value={opts.precision}
          onChange={(e) => set('precision', Number(e.target.value))}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>

      {!result.ok && input.trim() && <p className="error">{result.error}</p>}
      {result.ok && (
        <>
          <div className="stats">
            <div className="stat"><b><Roll>{formatBytes(result.before)}</Roll></b>Original</div>
            <div className="stat"><b><Roll>{formatBytes(result.after)}</Roll></b>Optimized</div>
            <div className="stat">
              <b style={{ color: saved > 0 ? 'var(--ok)' : undefined }}><Roll>{saved.toFixed(1)}</Roll>%</b>Saved
            </div>
          </div>
          <div className="bar" style={{ marginTop: 12 }} role="img" aria-label={`Optimized file is ${(100 - saved).toFixed(1)}% of the original`}>
            <i style={{ transform: `scaleX(${result.before > 0 ? Math.min(1, result.after / result.before) : 1})`, background: 'var(--ok)' }} />
          </div>
          <div className="two-col" style={{ marginTop: 16 }}>
            <Preview title="Original" svg={input} size={formatBytes(result.before)} />
            <Preview title="Optimized" svg={result.data} size={formatBytes(result.after)} />
          </div>
          <label htmlFor="svg-out">Optimized SVG</label>
          <SettleOutput id="svg-out" value={result.data} motion="order" style={{ minHeight: 140, fontFamily: 'var(--mono)', fontSize: '0.82rem' }} />
          <div className="row">
            <CopyButton text={result.data} />
            <button type="button" className="btn primary" onClick={download}>Download .svg</button>
          </div>
          <p className="muted">
            Previews are drawn as images, so scripts inside an SVG never run. Check the optimized preview matches before you use it: rarely, a
            lower decimal setting can shift fine details.
          </p>
        </>
      )}
    </div>
  )
}
