import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import { useSettled } from '../../motion/useSettled'

/** Codes up to this many modules per side animate module by module; bigger ones draw as one shape. */
const ANIMATE_UP_TO = 57

export default function QrGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [text, setText] = useState('https://')
  const [size, setSize] = useState(320)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  // Re-lay the grid only once typing pauses, so each new code grows in once.
  const [shownText, setShownText] = useState(text)
  const settled = useSettled(text, 120)
  useEffect(() => setShownText(text), [settled])

  const matrix = useMemo(() => {
    if (!shownText) return null
    try {
      const { modules } = QRCode.create(shownText, { errorCorrectionLevel: 'M' })
      return { n: modules.size, dark: (x: number, y: number) => modules.get(x, y) === 1 }
    } catch {
      return null
    }
  }, [shownText])

  useEffect(() => {
    if (!canvasRef.current || !text) return
    QRCode.toCanvas(canvasRef.current, text, { width: size, margin: 2, errorCorrectionLevel: 'M' })
      .then(() => setError(''))
      .catch(() => setError('That text is too long to fit in a QR code.'))
  }, [text, size])

  function download() {
    const url = canvasRef.current?.toDataURL('image/png')
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = 'qr-code.png'
    a.click()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div>
      <label htmlFor="qr-text">Text or link</label>
      <textarea id="qr-text" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 90 }} />
      <label htmlFor="qr-size">Size: {size}px</label>
      <input id="qr-size" type="range" min={160} max={1024} step={32} value={size} onChange={(e) => setSize(Number(e.target.value))} />
      {error && <p className="error">{error}</p>}
      <canvas ref={canvasRef} hidden />
      <div className="row" hidden={!text || !!error}>
        <div className="qr-preview" style={{ width: Math.min(size, 480), maxWidth: '100%' }}>
          {matrix && <QrSvg key={shownText} n={matrix.n} dark={matrix.dark} />}
        </div>
      </div>
      <div className="row">
        <button type="button" className="btn primary btn-icon" onClick={download} disabled={!text || !!error}>
          {saved ? <Check /> : <Icon name="arrow-down" size={18} />}
          {saved ? 'Saved' : 'Download PNG'}
        </button>
      </div>
    </div>
  )
}

/** The code as SVG squares that grow outward from the three finder patterns. */
function QrSvg({ n, dark }: { n: number; dark: (x: number, y: number) => boolean }) {
  const m = 2
  const finders = [[3, 3], [n - 4, 3], [3, n - 4]]
  const cells: { x: number; y: number; d: number }[] = []
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (dark(x, y)) cells.push({ x, y, d: Math.min(...finders.map(([fx, fy]) => Math.hypot(x - fx, y - fy))) })
  const far = Math.max(1, ...cells.map((c) => c.d))
  const animate = n <= ANIMATE_UP_TO

  return (
    <svg viewBox={`${-m} ${-m} ${n + 2 * m} ${n + 2 * m}`} width="100%" style={{ display: 'block' }} shapeRendering="crispEdges" role="img" aria-label="QR code preview">
      {animate ? (
        cells.map((c) => (
          <rect
            key={`${c.x}-${c.y}`}
            className={c.d < 4.3 ? 'qr-mod qr-finder' : 'qr-mod'}
            x={c.x}
            y={c.y}
            width="1.02"
            height="1.02"
            style={{ animationDelay: `${Math.round((c.d / far) * 220)}ms` }}
          />
        ))
      ) : (
        <path className="qr-fade" d={cells.map((c) => `M${c.x} ${c.y}h1v1h-1z`).join('')} />
      )}
    </svg>
  )
}
