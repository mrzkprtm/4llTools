import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import SettleOutput from '../../motion/SettleOutput'
import { blobPoints, seededRandom, smoothPath } from './blob'

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export default function SvgBlob() {
  const [points, setPoints] = useState(8)
  const [jitter, setJitter] = useState(0.32)
  const [radius, setRadius] = useState(100)
  const [seed, setSeed] = useState(1234)
  const [fill, setFill] = useState('#c2410c')
  const [saved, setSaved] = useState(false)

  const list = blobPoints(points, radius, jitter, seededRandom(seed))
  const d = smoothPath(list)
  const box = radius * 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${radius} -${radius} ${box} ${box}" width="${box}" height="${box}">\n  <path d="${d}" fill="${fill}" />\n</svg>`

  function downloadPng() {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = box
      canvas.height = box
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((out) => {
        if (!out) return
        saveBlob(out, `blob-${seed}.png`)
        setSaved(true)
        window.setTimeout(() => setSaved(false), 2000)
      }, 'image/png')
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
  }

  return (
    <div>
      <div style={{ display: 'grid', placeItems: 'center', padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        <svg viewBox={`-${radius} -${radius} ${box} ${box}`} width={220} height={220} role="img" aria-label={`Random blob with ${points} points`}>
          <path d={d} fill={fill} />
        </svg>
      </div>

      <div className="two-col">
        <div>
          <label htmlFor="bl-points">Points — <b>{points}</b></label>
          <input id="bl-points" type="range" min={3} max={16} value={points} onChange={(e) => setPoints(Number(e.target.value))} />

          <label htmlFor="bl-jitter">Jitter — <b>{Math.round(jitter * 100)}%</b></label>
          <input id="bl-jitter" type="range" min={0} max={80} value={Math.round(jitter * 100)} onChange={(e) => setJitter(Number(e.target.value) / 100)} />
        </div>
        <div>
          <label htmlFor="bl-radius">Radius — <b>{radius}px</b></label>
          <input id="bl-radius" type="range" min={40} max={150} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />

          <label htmlFor="bl-fill" style={{ marginTop: 16 }}>Fill color</label>
          <input id="bl-fill" type="color" value={fill} onChange={(e) => setFill(e.target.value)} style={{ width: '100%', height: 44, padding: 0, border: 'none', background: 'none' }} aria-label="Blob fill color" />
        </div>
      </div>

      <div className="row">
        <button type="button" className="btn btn-icon" onClick={() => setSeed((Math.random() * 1e9) | 0)}>
          <Icon name="reload" size={16} /> New shape
        </button>
        <span className="muted">seed {seed}</span>
      </div>

      <SettleOutput value={svg} aria-label="Blob SVG" rows={4} />
      <div className="row">
        <CopyButton text={svg} />
        <button type="button" className="btn" onClick={() => saveBlob(new Blob([svg], { type: 'image/svg+xml' }), `blob-${seed}.svg`)}>Download SVG</button>
        <button type="button" className={`btn btn-icon ${saved ? 'is-done' : ''}`} onClick={downloadPng}>
          <Icon name="arrow-down" size={16} />
          {saved ? 'Saved!' : 'Download PNG'}
        </button>
      </div>
      <p className="muted">
        Points sit evenly around a circle and get pushed in or out by the jitter amount, then a smooth cubic-bezier path runs through
        them and closes the shape. The seed makes each shape repeatable — the same seed and settings always draw the same blob. Nothing
        leaves your device.
      </p>
    </div>
  )
}
