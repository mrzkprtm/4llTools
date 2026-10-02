import { useCallback, useEffect, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Busy from '../../components/Busy'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { bestTextColor, oklchToRgb, parseColor, rgbToHex, rgbToOklch } from './oklch'
import { HARMONIES, exportCss, exportJson, exportTailwind, formatAs, generate, mergeLocked, type ColorFormat, type Harmony, type Swatch } from './palette'
import './tool.css'

const FORMATS: { id: ColorFormat; label: string }[] = [
  { id: 'hex', label: 'HEX' },
  { id: 'rgb', label: 'RGB' },
  { id: 'hsl', label: 'HSL' },
  { id: 'oklch', label: 'OKLCH' },
]

type ExportKind = 'css' | 'tailwind' | 'json'

const START = '#4f46e5'

function initial(): Swatch[] {
  const base = rgbToOklch(parseColor(START)!)
  return mergeLocked([], generate(base, 'analogous', () => 0.5))
}

/** True when Space should keep its normal meaning: typing, or a swatch's own copy/lock buttons. */
function keepSpace(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'A', 'SUMMARY'].includes(el.tagName)) return true
  return el.tagName === 'BUTTON' && !!el.closest('.cp-strip')
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ColorPalette() {
  const [baseText, setBaseText] = useState(START)
  const [kind, setKind] = useState<Harmony>('analogous')
  const [swatches, setSwatches] = useState<Swatch[]>(initial)
  const [gen, setGen] = useState(0)
  const [format, setFormat] = useState<ColorFormat>('hex')
  const [exportKind, setExportKind] = useState<ExportKind>('css')
  const [copied, setCopied] = useState(-1)
  const [pngBusy, setPngBusy] = useState(false)
  const copyTimer = useRef(0)

  const parsed = parseColor(baseText)
  const baseHex = parsed ? rgbToHex(parsed) : '#000000'

  const regenerate = useCallback(
    (nextKind: Harmony = kind, text: string = baseText, fromBase = false) => {
      const rgb = parseColor(text)
      if (!rgb && nextKind !== 'random') return
      const base = rgb ? rgbToOklch(rgb) : { l: 0.6, c: 0.1, h: 0 }
      // Editing the base recolours in place (stable, no re-entrance); Generate shuffles and re-animates.
      setSwatches((cur) => mergeLocked(cur, generate(base, nextKind, fromBase ? () => 0.5 : Math.random)))
      if (!fromBase) setGen((g) => g + 1)
    },
    [kind, baseText],
  )

  // Spacebar regenerates, like Coolors — but not while typing or on a focused control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || keepSpace(e.target)) return
      e.preventDefault()
      regenerate()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [regenerate])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  function pickKind(k: Harmony) {
    setKind(k)
    regenerate(k)
  }

  function onBase(text: string) {
    setBaseText(text)
    if (parseColor(text)) regenerate(kind === 'random' ? 'analogous' : kind, text, true)
    if (kind === 'random' && parseColor(text)) setKind('analogous')
  }

  async function copySwatch(i: number) {
    try {
      await navigator.clipboard.writeText(formatAs(swatches[i].color, format))
      setCopied(i)
      clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(-1), 1200)
    } catch {
      setCopied(-1)
    }
  }

  const toggleLock = (i: number) => setSwatches((s) => s.map((x, j) => (j === i ? { ...x, locked: !x.locked } : x)))

  const hexes = swatches.map((s) => s.hex)
  const colors = swatches.map((s) => s.color)
  const exportText = exportKind === 'css' ? exportCss(hexes, format, colors) : exportKind === 'tailwind' ? exportTailwind(hexes) : exportJson(colors)

  async function exportPng() {
    setPngBusy(true)
    try {
      const w = 200
      const h = 260
      const canvas = document.createElement('canvas')
      canvas.width = w * swatches.length
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas is not available')
      swatches.forEach((s, i) => {
        ctx.fillStyle = s.hex
        ctx.fillRect(i * w, 0, w, h)
        ctx.fillStyle = bestTextColor(oklchToRgb(s.color))
        ctx.font = '600 22px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.textAlign = 'center'
        ctx.fillText(s.hex.toUpperCase(), i * w + w / 2, h - 28)
      })
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (blob) download('palette.png', blob)
    } finally {
      setPngBusy(false)
    }
  }

  return (
    <div>
      <div className="row cp-base">
        <label htmlFor="cp-base-text">Base color</label>
        <input type="color" aria-label="Pick base color" value={baseHex} onChange={(e) => onBase(e.target.value)} className="cp-picker" />
        <input id="cp-base-text" type="text" value={baseText} onChange={(e) => onBase(e.target.value)} spellCheck={false} placeholder="#4f46e5, rgb(), hsl() or oklch()" className="cp-base-input" />
      </div>
      {!parsed && <p className="error">Could not read that color. Try #4f46e5, rgb(79 70 229), hsl(243, 75%, 59%) or oklch(51% 0.23 277).</p>}

      <PillRow label="Harmony">
        {HARMONIES.map((h) => (
          <button key={h.id} type="button" aria-pressed={kind === h.id} className={kind === h.id ? 'btn primary' : 'btn'} onClick={() => pickKind(h.id)}>
            {h.label}
          </button>
        ))}
      </PillRow>
      <p className="muted cp-hint">{HARMONIES.find((h) => h.id === kind)?.hint} Press <kbd>Space</kbd> to regenerate; locked swatches stay put.</p>

      <div className="row">
        <button type="button" className="btn primary cp-gen" onClick={() => regenerate()}>
          <span key={gen} className="cp-dice" aria-hidden="true">⟳</span> Generate
        </button>
        <PillRow label="Copy format">
          {FORMATS.map((f) => (
            <button key={f.id} type="button" aria-pressed={format === f.id} className={format === f.id ? 'btn primary' : 'btn'} onClick={() => setFormat(f.id)}>
              {f.label}
            </button>
          ))}
        </PillRow>
      </div>

      <div className="cp-strip" aria-label="Palette">
        {swatches.map((s, i) => {
          const ink = bestTextColor(oklchToRgb(s.color))
          const value = formatAs(s.color, format)
          return (
            <div key={s.locked ? `lock-${i}-${s.hex}` : `${gen}-${i}`} className={`cp-swatch ${s.locked ? 'is-locked' : ''}`} style={{ ['--i' as string]: i, background: s.hex, color: ink }}>
              <button type="button" className="cp-copy" onClick={() => copySwatch(i)} aria-label={`Copy ${value}`}>
                <span className="cp-value">{value}</span>
                {copied === i ? <span className="cp-copied" aria-live="polite">Copied!</span> : <span className="cp-tap">Click to copy</span>}
              </button>
              <button type="button" className="cp-lock" aria-pressed={s.locked} onClick={() => toggleLock(i)} aria-label={s.locked ? `Unlock swatch ${i + 1}` : `Lock swatch ${i + 1}`} title={s.locked ? 'Unlock' : 'Lock'}>
                <LockGlyph locked={s.locked} />
              </button>
            </div>
          )
        })}
      </div>

      <label>Export</label>
      <div className="row" style={{ marginTop: 0 }}>
        <PillRow label="Export format">
          {(['css', 'tailwind', 'json'] as ExportKind[]).map((k) => (
            <button key={k} type="button" aria-pressed={exportKind === k} className={exportKind === k ? 'btn primary' : 'btn'} onClick={() => setExportKind(k)}>
              {k === 'css' ? 'CSS variables' : k === 'tailwind' ? 'Tailwind' : 'JSON'}
            </button>
          ))}
        </PillRow>
      </div>
      <SettleOutput value={exportText} aria-label="Exported palette" className="cp-export" rows={Math.min(14, exportText.split('\n').length + 1)} />
      <div className="row">
        <CopyButton text={exportText} />
        <button type="button" className="btn" onClick={() => download(`palette.${exportKind === 'json' ? 'json' : exportKind === 'css' ? 'css' : 'js'}`, new Blob([exportText], { type: 'text/plain' }))}>Download</button>
        <button type="button" className="btn" onClick={exportPng} disabled={pngBusy}>PNG strip</button>
        {pngBusy && <Busy label="Painting PNG…" />}
      </div>
      <p className="muted">
        Palettes are built in OKLCH, a perceptual color space, so hue steps look evenly spaced and colors outside the sRGB screen gamut are pulled back by lowering chroma. Everything runs in your browser.
      </p>
    </div>
  )
}

function LockGlyph({ locked }: { locked: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path className="cp-shackle" d={locked ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.6-1.7'} />
    </svg>
  )
}
