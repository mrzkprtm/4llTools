import { useEffect, useMemo, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import { reducedMotion } from '../../motion/springs'
import { cleanError, debounce, errorLine, pngSize, svgSize, TEMPLATES, withPixelSize } from './diagram'
import './tool.css'

type MermaidApi = (typeof import('mermaid'))['default']
type ThemeChoice = 'auto' | 'default' | 'dark' | 'forest' | 'neutral'

let renderSeq = 0

function download(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

export default function MermaidEditor() {
  const [code, setCode] = useState(TEMPLATES[0].code)
  const [template, setTemplate] = useState(TEMPLATES[0].id)
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('auto')
  const [systemDark, setSystemDark] = useState(false)
  const [mermaid, setMermaid] = useState<MermaidApi | null>(null)
  const [loadError, setLoadError] = useState('')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [rendering, setRendering] = useState(false)
  const [fit, setFit] = useState(true)
  const [transparent, setTransparent] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const preview = useRef<HTMLDivElement>(null)
  const editor = useRef<HTMLTextAreaElement>(null)

  const theme = themeChoice === 'auto' ? (systemDark ? 'dark' : 'default') : themeChoice

  // Follow the visitor's light/dark setting.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(mq.matches)
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    let alive = true
    import('mermaid')
      .then((m) => alive && setMermaid(() => m.default))
      .catch(() => alive && setLoadError('Mermaid could not load. Check your connection and reload the page.'))
    return () => {
      alive = false
    }
  }, [])

  // Latest render wins: each call gets a sequence number, stale results are dropped.
  const latest = useRef(0)
  const renderNow = useMemo(
    () => async (api: MermaidApi, text: string, th: string) => {
      const seq = ++renderSeq
      latest.current = seq
      setRendering(true)
      const id = `mmd-${seq}`
      try {
        api.initialize({ startOnLoad: false, securityLevel: 'strict', theme: th as 'default', htmlLabels: false, fontFamily: 'ui-sans-serif, system-ui, sans-serif' })
        await api.parse(text)
        const out = await api.render(id, text)
        if (latest.current !== seq) return
        setSvg(out.svg)
        setError('')
      } catch (e) {
        if (latest.current !== seq) return
        setError(cleanError(e instanceof Error ? e.message : String(e)))
      } finally {
        document.getElementById(id)?.remove()
        document.getElementById(`d${id}`)?.remove()
        if (latest.current === seq) setRendering(false)
      }
    },
    [],
  )
  const debounced = useMemo(() => debounce(renderNow, 350), [renderNow])

  useEffect(() => {
    if (!mermaid) return
    if (!code.trim()) {
      debounced.cancel()
      setSvg('')
      setError('')
      return
    }
    debounced(mermaid, code, theme)
  }, [mermaid, code, theme, debounced])
  useEffect(() => () => debounced.cancel(), [debounced])

  // Mermaid's strict mode sanitises the SVG; insert it and play a small settle.
  useEffect(() => {
    const el = preview.current
    if (!el) return
    el.innerHTML = svg
    const s = el.querySelector('svg')
    if (s && !fit) {
      const { width, height } = svgSize(svg)
      s.style.maxWidth = 'none'
      s.setAttribute('width', String(width))
      s.setAttribute('height', String(height))
    }
    if (s && !reducedMotion()) s.animate([{ opacity: 0.4, transform: 'scale(0.985)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
  }, [svg, fit])

  const line = error ? errorLine(error) : null

  function jumpToLine(n: number) {
    const ta = editor.current
    if (!ta) return
    const lines = code.split('\n')
    const start = lines.slice(0, n - 1).reduce((a, l) => a + l.length + 1, 0)
    ta.focus()
    ta.setSelectionRange(start, start + (lines[n - 1]?.length ?? 0))
  }

  const bgColor = theme === 'dark' ? '#1b1a17' : '#ffffff'

  function exportSvg() {
    const { width, height } = svgSize(svg)
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${withPixelSize(svg, width, height)}`], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    download(url, `${template}-diagram.svg`)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function exportPng() {
    setExporting(true)
    setExportMsg('')
    try {
      const { width, height } = svgSize(svg)
      const size = pngSize(width, height, 2)
      const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withPixelSize(svg, width, height))}`
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('the SVG could not be drawn'))
        img.src = src
      })
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const ctx = canvas.getContext('2d')!
      if (!transparent) {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, size.width, size.height)
      }
      ctx.drawImage(img, 0, 0, size.width, size.height)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('the browser refused to create the image')
      const url = URL.createObjectURL(blob)
      download(url, `${template}-diagram.png`)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportMsg(`Saved ${size.width} × ${size.height} px PNG`)
    } catch (e) {
      setExportMsg(`PNG export failed (${e instanceof Error ? e.message : String(e)}). Try SVG instead.`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <label id="mm-tpl-label">Templates</label>
      <div className="mm-templates" role="group" aria-labelledby="mm-tpl-label">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn mm-tpl ${template === t.id ? 'primary' : ''}`}
            aria-pressed={template === t.id}
            onClick={() => {
              setTemplate(t.id)
              setCode(t.code)
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="mm-grid">
        <div className="mm-edit">
          <div className="row" style={{ justifyContent: 'space-between', margin: '16px 0 6px' }}>
            <label htmlFor="mm-code" style={{ margin: 0 }}>Mermaid code</label>
            <CopyButton text={code} label="Copy code" />
          </div>
          <textarea
            id="mm-code"
            ref={editor}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? 'mm-error' : undefined}
            className="mm-textarea"
          />
          {error && (
            <div id="mm-error" className="error mm-error" role="alert" key={error}>
              <div className="row" style={{ margin: '0 0 4px' }}>
                <b>Syntax error</b>
                {line && (
                  <button type="button" className="chip bad mm-line" onClick={() => jumpToLine(line)}>Go to line {line}</button>
                )}
              </div>
              <pre>{error}</pre>
            </div>
          )}
        </div>

        <div className="mm-view">
          <div className="row" style={{ justifyContent: 'space-between', margin: '16px 0 6px' }}>
            <span className="mm-label">Preview</span>
            <PillRow label="Zoom" className="mm-zoom">
              <button type="button" aria-pressed={fit} className={`btn ${fit ? 'primary' : ''}`} onClick={() => setFit(true)}>Fit</button>
              <button type="button" aria-pressed={!fit} className={`btn ${!fit ? 'primary' : ''}`} onClick={() => setFit(false)}>100%</button>
            </PillRow>
          </div>
          <div className={`mm-stage ${rendering ? 'busy-bar' : ''} ${error && svg ? 'mm-stale' : ''} ${theme === 'dark' ? 'mm-dark' : ''}`}>
            {!mermaid && !loadError && <Busy label="Loading Mermaid…" />}
            {loadError && <p className="error">{loadError}</p>}
            {mermaid && !svg && !error && !code.trim() && <p className="muted">Type a diagram or pick a template.</p>}
            <div ref={preview} className={`mm-svg ${fit ? 'mm-fit' : ''}`} aria-label="Rendered diagram" role="img" />
          </div>
        </div>
      </div>

      <div className="row">
        <label htmlFor="mm-theme" style={{ fontWeight: 400 }}>Theme</label>
        <select id="mm-theme" value={themeChoice} onChange={(e) => setThemeChoice(e.target.value as ThemeChoice)} style={{ width: 'auto' }}>
          <option value="auto">Match site ({systemDark ? 'dark' : 'light'})</option>
          <option value="default">Default</option>
          <option value="dark">Dark</option>
          <option value="forest">Forest</option>
          <option value="neutral">Neutral</option>
        </select>
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} /> Transparent PNG</label>
      </div>
      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={exportPng} disabled={!svg || exporting}>
          <Icon name="image" size={18} /> Download PNG
        </button>
        <button type="button" className="btn btn-icon" onClick={exportSvg} disabled={!svg}>
          <Icon name="arrow-down-circle" size={18} /> Download SVG
        </button>
        <CopyButton text={svg} label="Copy SVG" />
        {exporting && <Busy label="Rendering PNG…" />}
        {!exporting && exportMsg && <span key={exportMsg} className={`mm-msg ${exportMsg.startsWith('Saved') ? 'ok' : 'error'}`} role="status">{exportMsg}</span>}
      </div>

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        The preview redraws a moment after you stop typing. Diagrams render in your browser with Mermaid in strict security mode, so scripts and click handlers in the code are ignored.
        PNG export draws at 2× (capped at 8192 px per side). On a phone, switch to 100% and scroll the preview sideways for large diagrams.
      </p>
    </div>
  )
}
