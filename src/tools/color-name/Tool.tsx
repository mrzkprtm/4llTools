import { useEffect, useRef, useState, type MouseEvent } from 'react'
import CopyButton from '../../components/CopyButton'
import SettleOutput from '../../motion/SettleOutput'
import { hexToRgb, nearestNames, type Rgb } from './names'

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`

export default function ColorName() {
  const [text, setText] = useState('#c2410c')
  const [lastRgb, setLastRgb] = useState<Rgb>(() => hexToRgb('#c2410c') as Rgb)
  const [error, setError] = useState('')
  const [hasImage, setHasImage] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const parsed = hexToRgb(text)
  useEffect(() => {
    if (parsed) setLastRgb(parsed)
  }, [text, parsed?.r, parsed?.g, parsed?.b])
  const rgb = parsed ?? lastRgb

  const matches = nearestNames(rgb.r, rgb.g, rgb.b, 8)
  const best = matches[0]
  const currentHex = toHex(rgb.r, rgb.g, rgb.b)
  const code = `color: ${best.name}; /* ${currentHex} → ${best.hex}, distance ${best.distance} */`

  function onFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.')
      return
    }
    setError('')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        URL.revokeObjectURL(url)
        return
      }
      const scale = Math.min(1, 800 / img.width)
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      setHasImage(true)
    }
    img.onerror = () => {
      setError('That image could not be read.')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  function pick(e: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !hasImage) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.min(canvas.width - 1, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * canvas.width)))
    const y = Math.min(canvas.height - 1, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * canvas.height)))
    const data = ctx.getImageData(x, y, 1, 1).data
    setText(toHex(data[0], data[1], data[2]))
  }

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="cn-hex">Hex color</label>
          <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
            <input
              type="color"
              value={currentHex}
              onChange={(e) => setText(e.target.value)}
              style={{ width: 44, height: 40, padding: 0, border: 'none', background: 'none', flex: 'none' }}
              aria-label="Pick a color"
            />
            <input id="cn-hex" type="text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder="#c2410c" style={{ fontFamily: 'var(--mono)' }} />
          </div>
          {!parsed && <p className="error">Enter a hex value like #c2410c, #c2410c80 or #f90.</p>}
        </div>
        <div>
          <label htmlFor="cn-img">Or pick a pixel from an image</label>
          <input id="cn-img" type="file" accept="image/*" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ width: 88, height: 88, flex: 'none', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: currentHex }} />
        <div>
          <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{best.name}</p>
          <p className="muted" style={{ margin: '2px 0 0', fontFamily: 'var(--mono)', fontSize: '0.82rem' }}>
            {currentHex} · nearest {best.hex} · distance {best.distance}
          </p>
        </div>
      </div>

      <h3 className="eyebrow" style={{ marginTop: 22 }}>Closest CSS names</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
        {matches.map((m) => (
          <li key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', padding: '5px 0' }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, flex: 'none', borderRadius: 5, border: '1px solid var(--border)', background: m.hex }} />
            <span style={{ textTransform: 'capitalize' }}>{m.name}</span>
            <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>{m.hex}</span>
            <span className="muted" style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: '0.78rem' }}>{m.distance}</span>
          </li>
        ))}
      </ul>

      <h3 className="eyebrow" style={{ marginTop: 22 }}>Image pixels</h3>
      <canvas
        ref={canvasRef}
        onClick={pick}
        style={{ display: hasImage ? 'block' : 'none', width: '100%', maxWidth: 560, height: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'crosshair', background: 'var(--sunken)' }}
        aria-label="Sample a pixel color from the uploaded image"
      />
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
        {hasImage ? 'Click anywhere on the image to sample that pixel.' : 'Choose an image above to sample pixel colors from it.'}
      </p>

      <SettleOutput value={code} aria-label="CSS snippet" rows={1} style={{ marginTop: 16 }} />
      <div className="row">
        <CopyButton text={code} />
        <CopyButton text={best.name} label="Copy name" />
      </div>
      <p className="muted">
        Distances use the “redmean” approximation, a weighted euclidean measure that tracks how the eye reads color better than a plain
        RGB distance. A distance of 0 is an exact match. Uploaded images are read in your browser and never sent anywhere.
      </p>
    </div>
  )
}
