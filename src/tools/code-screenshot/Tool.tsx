import { useEffect, useMemo, useRef, useState } from 'react'
import type { HLJSApi } from 'highlight.js'
import Busy from '../../components/Busy'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import { useReplay } from '../../motion/useReplay'
import { useSettled } from '../../motion/useSettled'
import { BACKGROUNDS, escapeHtml, highlight, imageFileName, LANGUAGES, loadHighlighter, splitLines, THEMES } from './highlight'
import './tool.css'

const SAMPLE = `// Debounce: run fn once the calls stop for \`wait\` ms
export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
}

const save = debounce((text: string) => console.log('Saved:', text), 500)
save('Hello, world!')`

type Job = 'png' | 'copy' | null

export default function CodeScreenshot() {
  const [code, setCode] = useState(SAMPLE)
  const [language, setLanguage] = useState('auto')
  const [theme, setTheme] = useState('dracula')
  const [bg, setBg] = useState('grape')
  const [padding, setPadding] = useState(48)
  const [fontSize, setFontSize] = useState(15)
  const [chrome, setChrome] = useState(true)
  const [lineNumbers, setLineNumbers] = useState(true)
  const [title, setTitle] = useState('debounce.ts')
  const [hljs, setHljs] = useState<HLJSApi | null>(null)
  const [loadError, setLoadError] = useState('')
  const [job, setJob] = useState<Job>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string; n: number } | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const win = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadHighlighter()
      .then((h) => alive && setHljs(h))
      .catch(() => alive && setLoadError('Syntax highlighting could not load; showing plain text.'))
    return () => {
      alive = false
    }
  }, [])

  const { lines, detected } = useMemo(() => {
    const src = code.replace(/\t/g, '  ').replace(/\s+$/, '')
    if (!hljs) return { lines: splitLines(escapeHtml(src)), detected: '' }
    const r = highlight(hljs, src, language)
    return { lines: splitLines(r.html), detected: r.language }
  }, [code, language, hljs])

  const settled = useSettled(`${code}|${language}|${theme}`, 350)
  useReplay(win, settled, 'refresh')

  const background = BACKGROUNDS.find((b) => b.id === bg)?.css ?? 'transparent'
  const detectedLabel = LANGUAGES.find((l) => l.id === detected)?.label ?? detected

  async function render(kind: 'png' | 'blob') {
    const node = frame.current
    if (!node) throw new Error('Nothing to capture.')
    const { domToPng, domToBlob } = await import('modern-screenshot')
    const opts = { scale: 2, backgroundColor: null as string | null }
    return kind === 'png' ? domToPng(node, opts) : domToBlob(node, { ...opts, type: 'image/png' })
  }

  async function exportPng() {
    setJob('png')
    setStatus(null)
    try {
      const url = (await render('png')) as string
      const a = document.createElement('a')
      a.href = url
      a.download = imageFileName(title)
      a.click()
      setStatus((s) => ({ ok: true, text: `Saved ${imageFileName(title)} (2× resolution)`, n: (s?.n ?? 0) + 1 }))
    } catch (e) {
      setStatus((s) => ({ ok: false, text: `Export failed: ${e instanceof Error ? e.message : String(e)}`, n: (s?.n ?? 0) + 1 }))
    } finally {
      setJob(null)
    }
  }

  async function copyImage() {
    setJob('copy')
    setStatus(null)
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('this browser cannot copy images; use Download PNG instead.')
      // Pass the promise straight to ClipboardItem so Safari keeps the click's permission.
      const blob = render('blob').then((b) => b as Blob)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setStatus((s) => ({ ok: true, text: 'Image copied to the clipboard. Paste it into chat, docs or slides.', n: (s?.n ?? 0) + 1 }))
    } catch (e) {
      setStatus((s) => ({ ok: false, text: `Copy failed: ${e instanceof Error ? e.message : String(e)}`, n: (s?.n ?? 0) + 1 }))
    } finally {
      setJob(null)
    }
  }

  return (
    <div>
      <label htmlFor="cs-code">Code</label>
      <textarea id="cs-code" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} style={{ minHeight: 200 }} />

      <div className="cs-controls">
        <div>
          <label htmlFor="cs-lang">Language</label>
          <select id="cs-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="auto">Auto-detect{detected && language === 'auto' ? ` (${detectedLabel})` : ''}</option>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cs-theme">Theme</label>
          <select id="cs-theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <optgroup label="Dark">
              {THEMES.filter((t) => t.dark).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
            <optgroup label="Light">
              {THEMES.filter((t) => !t.dark).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          </select>
        </div>
        <div>
          <label htmlFor="cs-title">Window title</label>
          <input id="cs-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="untitled" />
        </div>
        <div>
          <label htmlFor="cs-pad">Padding <span className="muted cs-val">{padding}px</span></label>
          <input id="cs-pad" type="range" min={0} max={128} step={8} value={padding} onChange={(e) => setPadding(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div>
          <label htmlFor="cs-font">Font size <span className="muted cs-val">{fontSize}px</span></label>
          <input id="cs-font" type="range" min={11} max={24} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div className="cs-checks">
          <label><input type="checkbox" checked={chrome} onChange={(e) => setChrome(e.target.checked)} /> Window chrome</label>
          <label><input type="checkbox" checked={lineNumbers} onChange={(e) => setLineNumbers(e.target.checked)} /> Line numbers</label>
        </div>
      </div>

      <label id="cs-bg-label">Background</label>
      <PillRow label="Background" className="cs-bgs">
        {BACKGROUNDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`btn cs-bg-btn ${bg === b.id ? 'primary' : ''}`}
            aria-pressed={bg === b.id}
            onClick={() => setBg(b.id)}
            title={b.name}
          >
            <span className={`cs-swatch ${b.id === 'none' ? 'cs-checker' : ''}`} style={b.id === 'none' ? undefined : { background: b.css }} aria-hidden="true" />
            {b.name}
          </button>
        ))}
      </PillRow>

      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={exportPng} disabled={job !== null}>
          <Icon name="arrow-down-circle" size={18} /> Download PNG
        </button>
        <button type="button" className="btn btn-icon" onClick={copyImage} disabled={job !== null}>
          <Icon name="clipboard" size={18} /> Copy image
        </button>
        {job && <Busy label={job === 'png' ? 'Rendering PNG…' : 'Copying image…'} />}
        {!job && status && (
          <span key={status.n} className={`cs-status ${status.ok ? 'ok' : 'error'}`} role="status">
            {status.ok && <Check size={16} />} {status.text}
          </span>
        )}
      </div>
      {!hljs && !loadError && <Busy label="Loading syntax highlighter…" />}
      {loadError && <p className="error">{loadError}</p>}

      <div className={`cs-scroll ${job ? 'busy-bar' : ''}`} aria-label="Preview" aria-busy={job !== null}>
        <div ref={frame} className={`cs-frame ${status?.ok ? 'cs-flash' : ''}`} key={status?.ok ? status.n : 'frame'} style={{ background, padding }}>
          <div ref={win} className={`cs-window cs-theme-${theme} ${bg === 'none' ? 'cs-flat' : ''}`} style={{ fontSize }}>
            {chrome && (
              <div className="cs-bar">
                <span className="cs-dots" aria-hidden="true"><i /><i /><i /></span>
                <span className="cs-title">{title}</span>
              </div>
            )}
            <pre className={`cs-code ${lineNumbers ? 'cs-numbered' : ''}`}>
              <code>
                {lines.map((l, i) => (
                  <span key={i} className="cs-line">
                    {lineNumbers && <span className="cs-ln" aria-hidden="true">{i + 1}</span>}
                    {/* highlight.js escapes the code; only its own <span> markup is added. */}
                    <span className="cs-src" dangerouslySetInnerHTML={{ __html: l }} />
                  </span>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Paste code, pick a theme and background, then download a sharp 2× PNG or copy it straight to the clipboard. Rendering happens in your browser; the code never leaves your device.
        Tabs are shown as two spaces. Copying images needs a recent browser (Chrome, Edge, Safari or Firefox 127+).
      </p>
    </div>
  )
}
