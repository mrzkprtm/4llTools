import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

export default function QrGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [text, setText] = useState('https://')
  const [size, setSize] = useState(320)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!canvasRef.current || !text) return
    QRCode.toCanvas(canvasRef.current, text, { width: size, margin: 2 })
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
  }

  return (
    <div>
      <label htmlFor="qr-text">Text or link</label>
      <textarea id="qr-text" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 90 }} />
      <label htmlFor="qr-size">Size: {size}px</label>
      <input id="qr-size" type="range" min={160} max={1024} step={32} value={size} onChange={(e) => setSize(Number(e.target.value))} />
      {error && <p className="error">{error}</p>}
      <div className="row" hidden={!text || !!error}>
        <div className="qr-preview">
          <canvas ref={canvasRef} />
        </div>
      </div>
      <div className="row">
        <button type="button" className="btn primary" onClick={download} disabled={!text || !!error}>
          Download PNG
        </button>
      </div>
    </div>
  )
}
