import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import { PAGE_KEYS, PAGE_SIZES, charsPerLine, estimateLinesPerPage, formatBytes, lineBaselines, paginate, pdfFileName, wrapText, type PageSizeKey } from './textpdf'

interface Result {
  url: string
  name: string
  pages: number
  size: number
}

const MM_TO_PT = 72 / 25.4

const SAMPLE = [
  'Meeting notes — product review',
  '',
  'Everything below is wrapped and paginated in your browser, then written with pdf-lib. The text stays selectable, so you can copy it out of the PDF afterwards.',
  '',
  '1. Ship the pagination fix this week.',
  '2. Keep margins wide enough for hole punches.',
  '3. Nothing is uploaded, ever.',
].join('\n')

export default function TextToPdf() {
  const [text, setText] = useState('')
  const [size, setSize] = useState<PageSizeKey>('a4')
  const [marginMm, setMarginMm] = useState(25)
  const [fontSize, setFontSize] = useState(11)
  const [name, setName] = useState('document')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  const page = PAGE_SIZES[size]
  const margin = marginMm * MM_TO_PT
  const lines = wrapText(text, charsPerLine(page.w, margin, fontSize))
  const perPage = estimateLinesPerPage(page.h, margin, fontSize)
  const pageCount = paginate(lines, perPage).length

  async function build() {
    setError('')
    setBusy(true)
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const title = name.trim() || 'Document'
      doc.setTitle(title)
      doc.setProducer('4llTools')
      const m = marginMm * MM_TO_PT
      const chars = charsPerLine(page.w, m, fontSize)
      const wrapped = wrapText(text, chars)
      const chunks = paginate(wrapped.length ? wrapped : [''], estimateLinesPerPage(page.h, m, fontSize))
      for (const chunk of chunks) {
        const pdfPage = doc.addPage([page.w, page.h])
        const ys = lineBaselines(chunk.length, page.h, m, fontSize)
        chunk.forEach((line, i) => {
          if (!line) return
          pdfPage.drawText(line, { x: m, y: ys[i], size: fontSize, font, color: rgb(0.11, 0.11, 0.13) })
        })
      }
      const bytes = await doc.save()
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      const next = { url: URL.createObjectURL(blob), name: pdfFileName(name), pages: chunks.length, size: blob.size }
      setResult((old) => {
        if (old) URL.revokeObjectURL(old.url)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <label htmlFor="t2p-text">Your text</label>
      <textarea
        id="t2p-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type the text you want as a PDF…"
        style={{ minHeight: 200 }}
        spellCheck={false}
      />

      <div className="two-col">
        <div>
          <label htmlFor="t2p-size">Page size</label>
          <select id="t2p-size" value={size} onChange={(e) => setSize(e.target.value as PageSizeKey)}>
            {PAGE_KEYS.map((k) => <option key={k} value={k}>{PAGE_SIZES[k].label}</option>)}
          </select>

          <label htmlFor="t2p-margin">Margin: {marginMm} mm</label>
          <input id="t2p-margin" type="range" min={5} max={50} step={1} value={marginMm} onChange={(e) => setMarginMm(Number(e.target.value))} />

          <label htmlFor="t2p-font">Font size: {fontSize} pt</label>
          <input id="t2p-font" type="range" min={7} max={24} step={1} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
        </div>

        <div>
          <label htmlFor="t2p-name">File name</label>
          <input id="t2p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />

          <div className="stats">
            <div className="stat"><b>{pageCount}</b>Page{pageCount === 1 ? '' : 's'}</div>
            <div className="stat"><b>{lines.length}</b>Lines</div>
            <div className="stat"><b>{charsPerLine(page.w, margin, fontSize)}</b>Characters per line</div>
            <div className="stat"><b>{perPage}</b>Lines per page</div>
          </div>
        </div>
      </div>

      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={build} disabled={busy || !text.trim()}>
          <Icon name="file-plus" size={18} /> {busy ? 'Building…' : 'Create PDF'}
        </button>
        {!text && <button type="button" className="btn" onClick={() => setText(SAMPLE)}>Use sample text</button>}
        {text && <button type="button" className="btn" onClick={() => setText('')}>Clear</button>}
        <CopyButton text={text} label="Copy text" />
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <div className="output" aria-live="polite">
          <b>{result.name}</b> — {result.pages} page{result.pages === 1 ? '' : 's'}, {formatBytes(result.size)}<br />
          <span className="row" style={{ margin: '8px 0 0' }}>
            <a className="btn primary" href={result.url} download={result.name}>Download PDF</a>
            <button
              type="button"
              className="btn"
              onClick={() => {
                URL.revokeObjectURL(result.url)
                setResult(null)
              }}
            >
              Discard
            </button>
          </span>
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        Lines are wrapped to the page width and split into pages with pdf-lib, using the built-in Helvetica font, so the result stays selectable and searchable.
        The page count above updates as you type. Text is only in your browser — nothing is uploaded.
      </p>
    </div>
  )
}
