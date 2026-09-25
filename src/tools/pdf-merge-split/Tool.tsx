import { useEffect, useRef, useState, type ReactNode } from 'react'
import Busy from '../../components/Busy'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import { useFlip } from '../../motion/useFlip'
import { baseName, describePages, formatBytes, moveItem, normAngle, parseRanges, pdfError } from './ranges'
import './tool.css'

type Ops = typeof import('./ops')
let opsPromise: Promise<Ops> | null = null
const loadOps = () => (opsPromise ??= import('./ops'))

interface Doc {
  id: number
  name: string
  size: number
  bytes: Uint8Array
  pages: number
}

interface Result {
  name: string
  url: string
  size: number
  pages: number
}

const toBlob = (bytes: Uint8Array) => new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
let nextId = 1

async function readDoc(file: File): Promise<Doc> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const ops = await loadOps()
  try {
    return { id: nextId++, name: file.name, size: file.size, bytes, pages: await ops.pageCount(bytes) }
  } catch (err) {
    throw new Error(pdfError(err, file.name))
  }
}

function useResults() {
  const [results, setResults] = useState<Result[]>([])
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])
  const replace = (items: { name: string; bytes: Uint8Array; pages: number }[]) => {
    urls.current.forEach((u) => URL.revokeObjectURL(u))
    const next = items.map((it) => {
      const blob = toBlob(it.bytes)
      return { name: it.name, url: URL.createObjectURL(blob), size: blob.size, pages: it.pages }
    })
    urls.current = next.map((r) => r.url)
    setResults(next)
  }
  return [results, replace] as const
}

function Results({ results }: { results: Result[] }) {
  if (!results.length) return null
  const all = () => results.forEach((r, i) => setTimeout(() => {
    const a = document.createElement('a')
    a.href = r.url
    a.download = r.name
    a.click()
  }, i * 300))
  return (
    <>
      <div className="row" style={{ marginBottom: 0 }}>
        <span className="chip good"><Check size={14} /> {results.length === 1 ? 'Ready' : `${results.length} files ready`}</span>
        {results.length > 1 && <button type="button" className="btn btn-icon" onClick={all}><Icon name="arrow-down-circle" size={18} /> Download all</button>}
      </div>
      <div className="pm-results">
        {results.map((r, i) => (
          <div className="pm-result" key={r.url} style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
            <span style={{ minWidth: 0 }}><b>{r.name}</b><br /><span className="muted" style={{ fontSize: '0.84rem' }}>{r.pages} page{r.pages === 1 ? '' : 's'} · {formatBytes(r.size)}</span></span>
            <a className="btn primary shine" href={r.url} download={r.name}>Download</a>
          </div>
        ))}
      </div>
    </>
  )
}

function Drop({ id, multiple, onFiles, children }: { id: string; multiple?: boolean; onFiles: (f: File[]) => void; children?: ReactNode }) {
  const [over, setOver] = useState(false)
  return (
    <div
      className={`pm-drop ${over ? 'is-over' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]) }}
    >
      <p style={{ fontWeight: 600 }}>{multiple ? 'Drop PDF files here' : 'Drop a PDF here'}</p>
      <label htmlFor={id} className="btn primary" style={{ display: 'inline-block', margin: 0 }}>{multiple ? 'Choose PDFs' : 'Choose PDF'}</label>
      <input id={id} className="pm-hidden-input" type="file" accept="application/pdf,.pdf" multiple={multiple} onChange={(e) => { if (e.target.files) onFiles([...e.target.files]); e.target.value = '' }} />
      {children}
    </div>
  )
}

async function samples(): Promise<Doc[]> {
  const ops = await loadOps()
  const a = await ops.samplePdf('Report', 3, [0.31, 0.27, 0.9])
  const b = await ops.samplePdf('Appendix', 2, [0.92, 0.45, 0.09])
  return [
    { id: nextId++, name: 'sample-report.pdf', size: a.length, bytes: a, pages: 3 },
    { id: nextId++, name: 'sample-appendix.pdf', size: b.length, bytes: b, pages: 2 },
  ]
}

function MergePanel() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [drag, setDrag] = useState<number | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [results, setResults] = useResults()
  const list = useRef<HTMLUListElement>(null)
  useFlip(list)

  async function add(files: File[]) {
    setError('')
    const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
    if (!pdfs.length) return setError('Please choose PDF files.')
    setBusy('Reading files…')
    const errors: string[] = []
    const fresh: Doc[] = []
    for (const f of pdfs) {
      try {
        fresh.push(await readDoc(f))
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }
    setDocs((d) => [...d, ...fresh])
    setError(errors.join(' '))
    setBusy('')
    setResults([])
  }

  async function merge() {
    setError('')
    setBusy('Merging…')
    try {
      const ops = await loadOps()
      const bytes = await ops.mergePdfs(docs.map((d) => d.bytes))
      setResults([{ name: 'merged.pdf', bytes, pages: total }])
    } catch (e) {
      setError(pdfError(e, 'one of the files'))
    } finally {
      setBusy('')
    }
  }

  const move = (from: number, to: number) => { setDocs((d) => moveItem(d, from, to)); setResults([]) }
  const total = docs.reduce((n, d) => n + d.pages, 0)
  const size = docs.reduce((n, d) => n + d.size, 0)

  return (
    <>
      <Drop id="pm-merge-files" multiple onFiles={add}>
        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>
          Add two or more PDFs, then drag to reorder.{' '}
          {!docs.length && <button type="button" className="btn" style={{ marginTop: 8 }} onClick={async () => { setBusy('Making samples…'); setDocs(await samples()); setBusy('') }}>Try with sample PDFs</button>}
        </p>
      </Drop>

      {docs.length > 0 && (
        <ul className="pm-list" ref={list} aria-label="Files to merge, in order">
          {docs.map((d, i) => (
            <li
              key={d.id}
              data-flip={String(d.id)}
              className={`pm-file ${drag === i ? 'is-dragging' : ''} ${target === i && drag !== null && drag !== i ? 'is-target' : ''}`}
              draggable
              onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) }}
              onDragOver={(e) => { if (drag !== null) { e.preventDefault(); setTarget(i) } }}
              onDrop={(e) => { if (drag === null) return; e.preventDefault(); move(drag, i); setDrag(null); setTarget(null) }}
              onDragEnd={() => { setDrag(null); setTarget(null) }}
            >
              <span className="row" style={{ margin: 0, gap: 8 }}><span className="pm-grip" aria-hidden="true">⋮⋮</span><span className="pm-num">{i + 1}</span></span>
              <span style={{ minWidth: 0 }}>
                <span className="pm-name">{d.name}</span>
                <span className="pm-sub"> · {d.pages} page{d.pages === 1 ? '' : 's'} · {formatBytes(d.size)}</span>
              </span>
              <span className="pm-ctrl">
                <button type="button" className="btn" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${d.name} up`}>↑</button>
                <button type="button" className="btn" onClick={() => move(i, i + 1)} disabled={i === docs.length - 1} aria-label={`Move ${d.name} down`}>↓</button>
                <button type="button" className="btn" onClick={() => { setDocs((l) => l.filter((x) => x.id !== d.id)); setResults([]) }} aria-label={`Remove ${d.name}`}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {docs.length > 0 && (
        <div className="stats">
          <div className="stat"><b><Roll>{docs.length}</Roll></b>Files</div>
          <div className="stat"><b><Roll>{total}</Roll></b>Pages in total</div>
          <div className="stat"><b><Roll>{formatBytes(size)}</Roll></b>Combined size</div>
        </div>
      )}
      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={merge} disabled={docs.length < 2 || !!busy}><Icon name="git-merge" size={18} /> Merge {docs.length > 1 ? `${docs.length} PDFs` : 'PDFs'}</button>
        {docs.length > 0 && <button type="button" className="btn" onClick={() => { setDocs([]); setResults([]) }} disabled={!!busy}>Clear</button>}
        {busy && <Busy label={busy} />}
      </div>
      {docs.length === 1 && <p className="muted" style={{ marginTop: 0 }}>Add at least one more PDF to merge.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <Results results={results} />
    </>
  )
}

function useSingle() {
  const [doc, setDoc] = useState<Doc | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  async function open(files: File[]) {
    setError('')
    const f = files.find((x) => x.type === 'application/pdf' || /\.pdf$/i.test(x.name))
    if (!f) return setError('Please choose a PDF file.')
    setBusy('Reading PDF…')
    try {
      setDoc(await readDoc(f))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy('')
    }
  }
  async function sample() {
    setBusy('Making a sample…')
    const ops = await loadOps()
    const bytes = await ops.samplePdf('Handbook', 9, [0.05, 0.55, 0.5])
    setDoc({ id: nextId++, name: 'sample-handbook.pdf', size: bytes.length, bytes, pages: 9 })
    setBusy('')
  }
  return { doc, setDoc, busy, setBusy, error, setError, open, sample }
}

function SplitPanel({ single }: { single: ReturnType<typeof useSingle> }) {
  const { doc, busy, setBusy, error, setError, open, sample } = single
  const [ranges, setRanges] = useState('1-3, 5, 7-9')
  const [asOne, setAsOne] = useState(false)
  const [results, setResults] = useResults()
  const parsed = doc ? parseRanges(ranges, doc.pages) : null

  useEffect(() => setResults([]), [doc])

  async function run() {
    if (!doc || !parsed?.ok) return
    setError('')
    setBusy(asOne ? 'Extracting pages…' : 'Splitting…')
    try {
      const ops = await loadOps()
      const b = baseName(doc.name)
      if (asOne) {
        const pages = parsed.groups.flat()
        setResults([{ name: `${b}-pages-${describePages(pages).replace(/, /g, '_')}.pdf`.slice(0, 120), bytes: await ops.extractPages(doc.bytes, pages), pages: pages.length }])
      } else {
        const parts = await ops.splitPdf(doc.bytes, parsed.groups)
        setResults(parts.map((bytes, i) => ({ name: `${b}-${describePages(parsed.groups[i])}.pdf`, bytes, pages: parsed.groups[i].length })))
      }
    } catch (e) {
      setError(pdfError(e, doc.name))
    } finally {
      setBusy('')
    }
  }

  const all = (filter: (n: number) => boolean) => Array.from({ length: doc?.pages ?? 0 }, (_, i) => i + 1).filter(filter)

  return (
    <>
      <SingleHeader single={single} onSample={sample} onOpen={open} />
      {doc && (
        <>
          <label htmlFor="pm-ranges">Pages or ranges</label>
          <input id="pm-ranges" type="text" value={ranges} onChange={(e) => { setRanges(e.target.value); setResults([]) }} placeholder="1-3, 5, 7-9" aria-invalid={parsed ? !parsed.ok : undefined} aria-describedby="pm-ranges-help" spellCheck={false} />
          <p id="pm-ranges-help" className="muted" style={{ fontSize: '0.84rem', margin: '6px 0 0' }}>Commas separate parts. “8-” means 8 to the end, “last” is the last page, “5-3” reverses.</p>
          <div className="row">
            <button type="button" className="btn" onClick={() => { setRanges(all(() => true).join(', ')); setAsOne(false) }}>Every page separately</button>
            <button type="button" className="btn" onClick={() => { setRanges(all((n) => n % 2 === 1).join(', ')); setAsOne(true) }}>Odd pages</button>
            <button type="button" className="btn" onClick={() => { setRanges(all((n) => n % 2 === 0).join(', ') || '1'); setAsOne(true) }}>Even pages</button>
          </div>
          {parsed && !parsed.ok && <p className="error">{parsed.error}</p>}
          {parsed?.ok && (
            <div className="pm-groups" aria-live="polite">
              {asOne
                ? <span className="chip" key={`one${ranges}`}>1 file · {parsed.groups.flat().length} pages</span>
                : parsed.groups.slice(0, 40).map((g, i) => <span className="chip" key={`${i}:${g.join()}`} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>Part {i + 1}: {g.length === 1 ? `page ${g[0]}` : `pages ${describePages(g)}`}</span>)}
              {!asOne && parsed.groups.length > 40 && <span className="chip">+{parsed.groups.length - 40} more</span>}
            </div>
          )}
          <PillRow label="Output" style={{ marginTop: 14 }}>
            <button type="button" aria-pressed={!asOne} className={!asOne ? 'btn primary' : 'btn'} onClick={() => setAsOne(false)}>One file per part</button>
            <button type="button" aria-pressed={asOne} className={asOne ? 'btn primary' : 'btn'} onClick={() => setAsOne(true)}>All in one file</button>
          </PillRow>
          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={run} disabled={!parsed?.ok || !!busy}><Icon name="git-fork" size={18} /> {asOne ? 'Extract pages' : 'Split PDF'}</button>
            {busy && <Busy label={busy} />}
          </div>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <Results results={results} />
    </>
  )
}

function SingleHeader({ single, onSample, onOpen }: { single: ReturnType<typeof useSingle>; onSample: () => void; onOpen: (f: File[]) => void }) {
  const { doc, busy } = single
  return (
    <>
      <Drop id="pm-single-file" onFiles={onOpen}>
        {!doc && <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.85rem' }}><button type="button" className="btn" onClick={onSample} disabled={!!busy}>Try with a sample PDF</button></p>}
      </Drop>
      {busy && !doc && <Busy label={busy} />}
      {doc && (
        <div className="pm-result" style={{ marginTop: 12 }} key={doc.id}>
          <span style={{ minWidth: 0 }}><b>{doc.name}</b><br /><span className="muted" style={{ fontSize: '0.84rem' }}><Roll>{doc.pages}</Roll> page{doc.pages === 1 ? '' : 's'} · {formatBytes(doc.size)}</span></span>
          <button type="button" className="btn" onClick={() => single.setDoc(null)}>Close</button>
        </div>
      )}
    </>
  )
}

function PagesPanel({ single }: { single: ReturnType<typeof useSingle> }) {
  const { doc, busy, setBusy, error, setError, open, sample } = single
  const [info, setInfo] = useState<{ w: number; h: number; rotation: number }[]>([])
  const [edits, setEdits] = useState<{ rotate: number; deleted: boolean }[]>([])
  const [results, setResults] = useResults()

  useEffect(() => {
    setResults([])
    if (!doc) {
      setInfo([])
      setEdits([])
      return
    }
    let alive = true
    loadOps().then((ops) => ops.pageInfo(doc.bytes)).then((i) => {
      if (!alive) return
      setInfo(i)
      setEdits(i.map(() => ({ rotate: 0, deleted: false })))
    }, () => alive && setError('Could not read the pages of this PDF.'))
    return () => { alive = false }
  }, [doc])

  const edit = (i: number, p: Partial<{ rotate: number; deleted: boolean }>) => { setEdits((e) => e.map((x, j) => (j === i ? { ...x, ...p } : x))); setResults([]) }
  const rotateAll = (d: number) => { setEdits((e) => e.map((x) => ({ ...x, rotate: x.rotate + d }))); setResults([]) }
  const kept = edits.filter((e) => !e.deleted).length
  const changed = edits.some((e) => e.deleted || normAngle(e.rotate) !== 0)

  async function save() {
    if (!doc) return
    setError('')
    setBusy('Saving…')
    try {
      const ops = await loadOps()
      const bytes = await ops.editPages(doc.bytes, edits)
      setResults([{ name: `${baseName(doc.name)}-edited.pdf`, bytes, pages: kept }])
    } catch (e) {
      setError(e instanceof Error && /at least one/.test(e.message) ? 'Keep at least one page.' : pdfError(e, doc.name))
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <SingleHeader single={single} onSample={sample} onOpen={open} />
      {doc && info.length > 0 && (
        <>
          <div className="row">
            <button type="button" className="btn btn-icon" onClick={() => rotateAll(-90)}><Icon name="undo" size={18} /> Rotate all left</button>
            <button type="button" className="btn btn-icon" onClick={() => rotateAll(90)}><Icon name="redo" size={18} /> Rotate all right</button>
            <button type="button" className="btn" onClick={() => { setEdits(info.map(() => ({ rotate: 0, deleted: false }))); setResults([]) }} disabled={!changed}>Reset</button>
          </div>
          <div className="pm-pages" key={doc.id}>
            {info.slice(0, 500).map((p, i) => {
              const e = edits[i] ?? { rotate: 0, deleted: false }
              const turn = p.rotation + e.rotate
              const sideways = normAngle(p.rotation) % 180 !== 0
              const w = sideways ? p.h : p.w
              const h = sideways ? p.w : p.h
              const scale = Math.min(58 / w, 76 / h)
              return (
                <div key={i} className={`pm-page ${e.deleted ? 'is-deleted' : ''}`} style={{ animationDelay: `${Math.min(i, 24) * 20}ms` }}>
                  <div className="pm-sheet-box">
                    <div className="pm-sheet" style={{ width: p.w * scale, height: p.h * scale, transform: `rotate(${turn}deg)` }} aria-hidden="true">{i + 1}</div>
                  </div>
                  <span className="pm-sub">Page {i + 1}{normAngle(e.rotate) ? ` · ${normAngle(e.rotate)}°` : ''}</span>
                  <span className="pm-ctrl">
                    <button type="button" className="btn" onClick={() => edit(i, { rotate: e.rotate - 90 })} aria-label={`Rotate page ${i + 1} left`}>↺</button>
                    <button type="button" className="btn" onClick={() => edit(i, { rotate: e.rotate + 90 })} aria-label={`Rotate page ${i + 1} right`}>↻</button>
                    <button type="button" className={`btn ${e.deleted ? 'is-on' : ''}`} aria-pressed={e.deleted} onClick={() => edit(i, { deleted: !e.deleted })} aria-label={`${e.deleted ? 'Keep' : 'Delete'} page ${i + 1}`}>{e.deleted ? '↩' : '🗑'}</button>
                  </span>
                </div>
              )
            })}
          </div>
          {info.length > 500 && <p className="muted">Showing the first 500 pages.</p>}
          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={save} disabled={!changed || kept === 0 || !!busy}><Icon name="save" size={18} /> Save PDF ({kept} page{kept === 1 ? '' : 's'})</button>
            {kept === 0 && <span className="error">Keep at least one page.</span>}
            {busy && <Busy label={busy} />}
          </div>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <Results results={results} />
    </>
  )
}

export default function PdfMergeSplit() {
  const [mode, setMode] = useState<'merge' | 'split' | 'pages'>('merge')
  const single = useSingle()
  return (
    <div>
      <PillRow role="tablist" label="PDF action">
        <button type="button" role="tab" aria-selected={mode === 'merge'} className={mode === 'merge' ? 'btn primary' : 'btn'} onClick={() => setMode('merge')}>Merge</button>
        <button type="button" role="tab" aria-selected={mode === 'split'} className={mode === 'split' ? 'btn primary' : 'btn'} onClick={() => setMode('split')}>Split &amp; extract</button>
        <button type="button" role="tab" aria-selected={mode === 'pages'} className={mode === 'pages' ? 'btn primary' : 'btn'} onClick={() => setMode('pages')}>Rotate &amp; delete</button>
      </PillRow>
      <div key={mode} className="settle-in">
        {mode === 'merge' ? <MergePanel /> : mode === 'split' ? <SplitPanel single={single} /> : <PagesPanel single={single} />}
      </div>
      <p className="muted" style={{ fontSize: '0.86rem', marginTop: 18 }}>
        Your PDFs are processed with pdf-lib right in your browser and never uploaded. Pages are copied as-is, so text stays selectable and quality is unchanged.
        Page previews are not rendered (that would need a full PDF renderer), so pages are shown by number and orientation.
        Password-protected PDFs cannot be opened; remove the password first. Form fields and bookmarks may not carry over when merging.
      </p>
    </div>
  )
}
