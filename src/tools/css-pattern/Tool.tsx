import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { PATTERNS, patternCss, patternSvg, type PatternId } from './pattern'

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export default function CssPattern() {
  const [preset, setPreset] = useState<PatternId>('polka')
  const [fg, setFg] = useState('#c2410c')
  const [bg, setBg] = useState('#fcfbf7')
  const [size, setSize] = useState(28)
  const [angle, setAngle] = useState(0)
  const [saved, setSaved] = useState(false)

  const opts = { fg, bg, size, angle }
  const value = patternCss(preset, opts)
  const code = `.pattern {\n  background: ${value};\n}`

  function downloadPng() {
    const svg = patternSvg(preset, opts, 640, 360)
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 360
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((out) => {
        if (!out) return
        saveBlob(out, `pattern-${preset}.png`)
        setSaved(true)
        window.setTimeout(() => setSaved(false), 2000)
      }, 'image/png')
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  return (
    <div>
      <div aria-hidden="true" style={{ height: 220, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: value }} />

      <PillRow label="Pattern">
        {PATTERNS.map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id} className={preset === p.id ? 'btn primary' : 'btn'} onClick={() => setPreset(p.id)}>{p.name}</button>
        ))}
      </PillRow>

      <div className="two-col">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <span style={{ flex: 1 }}>
            <label htmlFor="pt-fg" style={{ marginTop: 0 }}>Pattern color</label>
            <input id="pt-fg" type="color" value={fg} onChange={(e) => setFg(e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} aria-label="Pattern color" />
          </span>
          <span style={{ flex: 1 }}>
            <label htmlFor="pt-bg" style={{ marginTop: 0 }}>Background color</label>
            <input id="pt-bg" type="color" value={bg} onChange={(e) => setBg(e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} aria-label="Background color" />
          </span>
        </div>
        <div>
          <label htmlFor="pt-size">Tile size — <b>{size}px</b></label>
          <input id="pt-size" type="range" min={4} max={120} value={size} onChange={(e) => setSize(Number(e.target.value))} />

          <label htmlFor="pt-angle">Angle — <b>{angle}°</b></label>
          <input id="pt-angle" type="range" min={0} max={180} step={5} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
        </div>
      </div>

      <SettleOutput value={code} aria-label="Pattern CSS" rows={3} />
      <div className="row">
        <CopyButton text={code} />
        <button type="button" className={`btn btn-icon ${saved ? 'is-done' : ''}`} onClick={downloadPng}>
          <Icon name="arrow-down" size={16} />
          {saved ? 'Saved!' : 'Download PNG'}
        </button>
      </div>
      <p className="muted">
        Each pattern is a single <code>background</code> value built from repeating gradients, so it scales with the tile size and needs
        no image file. The angle rotates line and dot patterns. The PNG export renders the same pattern at 640×360 on your device.
      </p>
    </div>
  )
}
