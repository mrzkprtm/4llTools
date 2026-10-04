import { useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { FIELD_LIMITS, cleanMeta, describeMeta, emptyMeta, fileNameFor, formatBytes, hasMeta, pdfError, splitKeywords, type MetaFields } from './metadata'

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
}

export default function PdfMetadata() {
  const input = useRef<HTMLInputElement>(null)
  const [doc, setDoc] = useState<Doc | null>(null)
  const [original, setOriginal] = useState<MetaFields>(emptyMeta)
  const [fields, setFields] = useState<MetaFields>(emptyMeta)
  const [producer, setProducer] = useState('')
  const [originalProducer, setOriginalProducer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  function clearResult() {
    setResult((old) => {
      if (old) URL.revokeObjectURL(old.url)
      return null
    })
  }

  const set = (key: keyof MetaFields, value: string) => {
    setFields((f) => ({ ...f, [key]: value }))
    clearResult()
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
      const read = cleanMeta({
        title: parsed.getTitle(),
        author: parsed.getAuthor(),
        subject: parsed.getSubject(),
        keywords: parsed.getKeywords(),
      })
      setDoc({ name: file.name, bytes, pages: parsed.getPageCount(), size: file.size })
      setOriginal(read)
      setFields(read)
      setProducer(parsed.getProducer() ?? '')
      setOriginalProducer(parsed.getProducer() ?? '')
    } catch (e) {
      setDoc(null)
      setError(pdfError(e, file.name))
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!doc) return
    setError('')
    clearResult()
    setBusy(true)
    try {
      const { PDFDocument } = await import('pdf-lib')
      const parsed = await PDFDocument.load(new Uint8Array(doc.bytes), { updateMetadata: false })
      const clean = cleanMeta(fields)
      parsed.setTitle(clean.title)
      parsed.setAuthor(clean.author)
      parsed.setSubject(clean.subject)
      parsed.setKeywords(splitKeywords(clean.keywords))
      parsed.setProducer(producer.trim().slice(0, 120))
      const bytes = await parsed.save()
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      setResult({ url: URL.createObjectURL(blob), name: fileNameFor(doc.name), size: blob.size })
    } catch (e) {
      setError(pdfError(e, doc.name))
    } finally {
      setBusy(false)
    }
  }

  const clean = cleanMeta(fields)
  const edited = JSON.stringify(clean) !== JSON.stringify(original) || producer.trim() !== originalProducer.trim()

  return (
    <div>
      <label htmlFor="pm-file">PDF file</label>
      <input
        id="pm-file"
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
        {busy && <span className="muted">Reading PDF…</span>}
      </div>

      {doc && (
        <div className="stats">
          <div className="stat"><b>{doc.pages}</b>Page{doc.pages === 1 ? '' : 's'}</div>
          <div className="stat"><b>{formatBytes(doc.size)}</b>File size</div>
          <div className="stat"><b>{splitKeywords(fields.keywords).length}</b>Keywords</div>
          <div className="stat"><b>{clean.title.length}</b>Title characters</div>
        </div>
      )}

      {doc && (
        <>
          <p className="muted" style={{ fontSize: '0.86rem' }}>
            {doc.name} — {hasMeta(original) ? `currently: ${describeMeta(original)}` : 'no title, author, subject or keywords set yet.'}
          </p>

          <label htmlFor="pm-title">Title</label>
          <input id="pm-title" type="text" value={fields.title} maxLength={FIELD_LIMITS.title} onChange={(e) => set('title', e.target.value)} placeholder="Document title" />

          <label htmlFor="pm-author">Author</label>
          <input id="pm-author" type="text" value={fields.author} maxLength={FIELD_LIMITS.author} onChange={(e) => set('author', e.target.value)} placeholder="Who wrote it" />

          <label htmlFor="pm-subject">Subject</label>
          <input id="pm-subject" type="text" value={fields.subject} maxLength={FIELD_LIMITS.subject} onChange={(e) => set('subject', e.target.value)} placeholder="One line about the document" />

          <label htmlFor="pm-keywords">Keywords</label>
          <input id="pm-keywords" type="text" value={fields.keywords} maxLength={FIELD_LIMITS.keywords} onChange={(e) => set('keywords', e.target.value)} placeholder="report, finance, 2026" aria-describedby="pm-keywords-help" />
          <p id="pm-keywords-help" className="muted" style={{ fontSize: '0.84rem', margin: '6px 0 0' }}>
            Separate keywords with commas or semicolons; duplicates are removed when saved.
          </p>

          <label htmlFor="pm-producer">Producer</label>
          <input id="pm-producer" type="text" value={producer} maxLength={120} onChange={(e) => { setProducer(e.target.value); clearResult() }} placeholder="The app that made the PDF" />

          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={save} disabled={busy}>
              <Icon name="save" size={18} /> {busy ? 'Saving…' : 'Save PDF'}
            </button>
            <button type="button" className="btn" onClick={() => { setFields(original); setProducer(originalProducer); clearResult() }} disabled={busy || !edited}>Reset</button>
            <button type="button" className="btn" onClick={() => { setFields(emptyMeta); setProducer(''); clearResult() }} disabled={busy || !hasMeta(fields)}>Clear fields</button>
          </div>
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <div className="output" aria-live="polite">
          <b>{result.name}</b> — {formatBytes(result.size)}<br />
          <span className="row" style={{ margin: '8px 0 0' }}>
            <a className="btn primary" href={result.url} download={result.name}>Download PDF</a>
          </span>
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.86rem' }}>
        The document properties are rewritten with pdf-lib in your browser; the pages themselves are untouched. Clearing a field removes it from the file.
        Search engines, file managers and PDF readers show these values in their details pane. Nothing is uploaded.
      </p>
    </div>
  )
}
