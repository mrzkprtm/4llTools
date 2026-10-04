import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { DEFAULT_MARGIN, FORMATS, POSITIONS, cornerPosition, fileNameFor, formatBytes, pageLabel, pdfError, type PageNumberPosition } from './pagenumbers'

interface Doc {
  name: string
  bytes: Uint8Array
  pages: number
  size: number
}

interface Result {
  url: string
  name: string
  size: number
  pages: number
}

export default function PdfPageNumbers() {
  const input = useRef<HTMLInputElement>(null)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [format, setFormat] = useState<string>('Page 1 of N')
  const [start, setStart] = useState(1)
  const [position, setPosition] = useState<PageNumberPosition>('bottom-center')
  const [margin, setMargin] = useState(DEFAULT_MARGIN)
  const [fontSize, setFontSize] = useState(10)
  const [skipFirst, setSkipFirst] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  function clearResult() {
    setResult((old) => {
      if (old) URL.revokeObjectURL(old.url)
      return null
    })
  }

  async function open(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setError('')
    clearResult()
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const { PDFDocument } = await import('pdf-lib')
      const parsed = await PDFDocument.load(bytes, { updateMetadata: false })
      setDoc({ name: file.name, bytes, pages: parsed.getPageCount(), size: file.size })
    } catch (e) {
      setDoc(null)
      setError(pdfError(e, file.name))
    } finally {
      setBusy(false)
    }
  }

  async function build() {
    if (!doc) return
    setError('')
    clearResult()
    setBusy(true)
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      const parsed = await PDFDocument.load(new Uint8Array(doc.bytes), { updateMetadata: false })
      const font = await parsed.embedFont(StandardFonts.Helvetica)
      const size = Math.max(4, fontSize)
      const pages = parsed.getPages()
      pages.forEach((page, i) => {
        if (skipFirst && i === 0) return
        const { width, height } = page.getSize()
        const label = pageLabel(i + 1, pages.length, format, start)
        const textW = font.widthOfTextAtSize(label, size)
        const { x, y } = cornerPosition(position, width, height, margin, textW, size * 0.72)
        page.drawText(label, { x, y, size, font, color: rgb(0.16, 0.16, 0.19) })
      })
      const bytes = await parsed.save()
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      setResult({ url: URL.createObjectURL(blob), name: fileNameFor(doc.name), size: blob.size, pages: doc.pages })
    } catch (e) {
      setError(pdfError(e, doc.name))
    } finally {
      setBusy(false)
    }
  }

  const numbered = doc ? (skipFirst ? Math.max(0, doc.pages - 1) : doc.pages) : 0
  const preview = doc ? pageLabel(skipFirst ? 2 : 1, doc.pages, format, start) : pageLabel(1, 12, format, start)

  return (
    <div>
      <label htmlFor="pn-file">PDF file</label>
      <input
        id="pn-file"
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => { open(e.target.files); e.target.value = '' }}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="row" style={{ marginTop: 0 }}>
        <button type="button" className="btn btn-icon" onClick={() => input.current?.click()} disabled={busy}>
          <Icon name="file-plus" size={18} /> {doc ? 'Choose another PDF' : 'Choose PDF'}
        </button>
        {busy && <span className="muted">Working…</span>}
      </div>

      <div className="two-col">
        <div>
          <label htmlFor="pn-format">Format</label>
          <select id="pn-format" value={format} onChange={(e) => { setFormat(e.target.value); clearResult() }}>
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>

          <label htmlFor="pn-start">First page shows</label>
          <input id="pn-start" type="number" min={1} max={100000} value={start} onChange={(e) => { setStart(Math.max(1, Math.min(100000, Number(e.target.value) || 1))); clearResult() }} />

          <label htmlFor="pn-pos">Position</label>
          <select id="pn-pos" value={position} onChange={(e) => { setPosition(e.target.value as PageNumberPosition); clearResult() }}>
            {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="pn-margin">Margin: {margin} pt</label>
          <input id="pn-margin" type="range" min={8} max={72} step={1} value={margin} onChange={(e) => { setMargin(Number(e.target.value)); clearResult() }} />

          <label htmlFor="pn-size">Font size: {fontSize} pt</label>
          <input id="pn-size" type="range" min={6} max={28} step={1} value={fontSize} onChange={(e) => { setFontSize(Number(e.target.value)); clearResult() }} />

          <label className="row" style={{ fontWeight: 400, gap: 8 }}>
            <input type="checkbox" checked={skipFirst} onChange={(e) => { setSkipFirst(e.target.checked); clearResult() }} />
            Leave the first page unnumbered (cover page)
          </label>

          <p className="muted" style={{ fontSize: '0.86rem', margin: '6px 0 0' }} aria-live="polite">Preview: <b>{preview}</b></p>
        </div>
      </div>

      {doc && (
        <div className="stats">
          <div className="stat"><b>{doc.pages}</b>Page{doc.pages === 1 ? '' : 's'}</div>
          <div className="stat"><b>{numbered}</b>Numbered page{numbered === 1 ? '' : 's'}</div>
          <div className="stat"><b>{start}</b>First number</div>
          <div className="stat"><b>{formatBytes(doc.size)}</b>File size</div>
        </div>
      )}

      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={build} disabled={!doc || busy}>
          <Icon name="save" size={18} /> {busy ? 'Numbering…' : 'Add page numbers'}
        </button>
        {doc && <button type="button" className="btn" onClick={() => { setDoc(null); clearResult(); setError('') }} disabled={busy}>Clear</button>}
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
        Numbers are drawn as a real text layer with pdf-lib, so they stay crisp and selectable when printed, and the original pages are not re-encoded.
        The margin is the distance from the page edge to the text. Password-protected PDFs cannot be opened, and nothing is uploaded.
      </p>
    </div>
  )
}
