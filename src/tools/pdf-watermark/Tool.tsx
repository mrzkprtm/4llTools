import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { POSITIONS, anchorFor, clampOpacity, diagonalAngle, fileNameFor, formatBytes, hexToRgb, pdfError, rotatedOrigin, tileAnchors, watermarkFontSize, type WatermarkPosition } from './watermark'

interface Result {
  url: string
  name: string
  size: number
  pages: number
}

export default function PdfWatermark() {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('CONFIDENTIAL')
  const [position, setPosition] = useState<WatermarkPosition>('center')
  const [opacity, setOpacity] = useState(18)
  const [angle, setAngle] = useState(45)
  const [diagonal, setDiagonal] = useState(false)
  const [autoSize, setAutoSize] = useState(true)
  const [fontSize, setFontSize] = useState(48)
  const [color, setColor] = useState('#e11d48')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  function clearResult() {
    setResult((old) => {
      if (old) URL.revokeObjectURL(old.url)
      return null
    })
  }

  function pick(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    setError('')
    clearResult()
    setFile(f)
  }

  async function build() {
    if (!file) return
    const label = text.trim()
    if (!label) return setError('Enter the watermark text first.')
    setError('')
    setBusy(true)
    clearResult()
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib')
      const doc = await PDFDocument.load(bytes, { updateMetadata: false })
      const font = await doc.embedFont(StandardFonts.HelveticaBold)
      const ink = hexToRgb(color) ?? { r: 0.1, g: 0.1, b: 0.1 }
      const alpha = clampOpacity(opacity / 100)
      for (const page of doc.getPages()) {
        const { width, height } = page.getSize()
        let size = autoSize ? watermarkFontSize(width) : Math.max(4, fontSize)
        const gap = Math.max(24, size * 0.6)
        if (position !== 'tile') {
          const measured = font.widthOfTextAtSize(label, size)
          const room = width - 2 * gap
          if (measured > room) size = Math.max(4, Math.floor((size * room) / measured))
        }
        const textW = font.widthOfTextAtSize(label, size)
        const rotate = diagonal ? diagonalAngle(width, height) : angle
        const anchors = position === 'tile'
          ? tileAnchors(width, height, Math.max(textW * 1.6, size * 6), Math.max(size * 5, 72))
          : [anchorFor(position, width, height, textW, size, gap)]
        for (const a of anchors) {
          const origin = rotatedOrigin(a.x, a.y, textW, size, rotate)
          page.drawText(label, { x: origin.x, y: origin.y, size, font, color: rgb(ink.r, ink.g, ink.b), opacity: alpha, rotate: degrees(rotate) })
        }
      }
      const out = await doc.save()
      const blob = new Blob([new Uint8Array(out)], { type: 'application/pdf' })
      setResult({ url: URL.createObjectURL(blob), name: fileNameFor(file.name), size: blob.size, pages: doc.getPageCount() })
    } catch (e) {
      setError(pdfError(e, file.name))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label htmlFor="wm-text">Watermark text</label>
      <input id="wm-text" type="text" value={text} maxLength={60} onChange={(e) => { setText(e.target.value); clearResult() }} placeholder="CONFIDENTIAL" />

      <div className="two-col">
        <div>
          <label htmlFor="wm-pos">Position</label>
          <select id="wm-pos" value={position} onChange={(e) => { setPosition(e.target.value as WatermarkPosition); clearResult() }}>
            {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>

          <label htmlFor="wm-opacity">Opacity: {opacity}%</label>
          <input id="wm-opacity" type="range" min={2} max={100} step={1} value={opacity} onChange={(e) => { setOpacity(Number(e.target.value)); clearResult() }} />

          <label htmlFor="wm-angle">Angle: {angle}°</label>
          <input id="wm-angle" type="range" min={-90} max={90} step={1} value={angle} onChange={(e) => { setAngle(Number(e.target.value)); clearResult() }} disabled={diagonal} />
          <label className="row" style={{ fontWeight: 400, gap: 8 }}>
            <input type="checkbox" checked={diagonal} onChange={(e) => { setDiagonal(e.target.checked); clearResult() }} />
            Follow the page diagonal
          </label>
        </div>

        <div>
          <label htmlFor="wm-color">Color</label>
          <input id="wm-color" type="color" value={color} onChange={(e) => { setColor(e.target.value); clearResult() }} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} />

          <label className="row" style={{ fontWeight: 400, gap: 8 }}>
            <input type="checkbox" checked={autoSize} onChange={(e) => { setAutoSize(e.target.checked); clearResult() }} />
            Size automatically to the page
          </label>
          <label htmlFor="wm-size">Font size: {fontSize} pt</label>
          <input id="wm-size" type="range" min={8} max={200} step={1} value={fontSize} onChange={(e) => { setFontSize(Number(e.target.value)); clearResult() }} disabled={autoSize} />

          <label htmlFor="wm-file">PDF file</label>
          <input
            id="wm-file"
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => { pick(e.target.files); e.target.value = '' }}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
            tabIndex={-1}
            aria-hidden="true"
          />
          <div className="row" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={() => input.current?.click()}><Icon name="file-plus" size={18} /> {file ? 'Choose another PDF' : 'Choose PDF'}</button>
            {file && <span className="muted" style={{ fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{file.name}</span>}
          </div>
        </div>
      </div>

      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={build} disabled={!file || busy}>
          <Icon name="save" size={18} /> {busy ? 'Stamping…' : 'Add watermark'}
        </button>
        {file && <button type="button" className="btn" onClick={() => { setFile(null); clearResult(); setError('') }} disabled={busy}>Clear</button>}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <div className="output" aria-live="polite">
          <b>{result.name}</b> — {result.pages} page{result.pages === 1 ? '' : 's'}, {formatBytes(result.size)}<br />
          <span className="row" style={{ margin: '8px 0 0' }}>
            <a className="btn primary" href={result.url} download={result.name}>Download PDF</a>
          </span>
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        The same text is drawn on every page as a real, selectable text layer with pdf-lib — no images are added, so the file stays small.
        Existing pages are copied untouched apart from the watermark. Password-protected PDFs cannot be opened. Nothing is uploaded.
      </p>
    </div>
  )
}
