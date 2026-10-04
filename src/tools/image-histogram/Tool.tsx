import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { buildHistogram, stats, type Histogram, type HistogramStats } from './histogram'

const CHART_W = 512
const CHART_H = 220
const SAMPLE_W = 480

const BAR_ALPHA = 0.5

export default function ImageHistogram() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [hist, setHist] = useState<Histogram | null>(null)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const urlRef = useRef('')

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = CHART_W
    canvas.height = CHART_H
    ctx.fillStyle = '#12100e'
    ctx.fillRect(0, 0, CHART_W, CHART_H)
    if (!hist) return

    let peak = 1
    for (let i = 0; i < 256; i++) peak = Math.max(peak, hist.r[i], hist.g[i], hist.b[i])

    // Quarter-tone guides so lifted or crushed blacks are easy to spot.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.lineWidth = 1
    for (let q = 1; q < 4; q++) {
      const x = Math.round((q * CHART_W) / 4) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CHART_H)
      ctx.stroke()
    }

    ctx.globalCompositeOperation = 'lighter'
    const channels: [number[], string][] = [
      [hist.r, '#ff4d4d'],
      [hist.g, '#3ddc84'],
      [hist.b, '#5b9bff'],
    ]
    ctx.globalAlpha = BAR_ALPHA
    for (const [data, color] of channels) {
      ctx.fillStyle = color
      for (let i = 0; i < 256; i++) {
        const h = Math.max(data[i] > 0 ? 1 : 0, (data[i] / peak) * CHART_H)
        ctx.fillRect((i * CHART_W) / 256, CHART_H - h, CHART_W / 256, h)
      }
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < 256; i++) {
      const y = CHART_H - (hist.lum[i] / peak) * CHART_H
      const x = ((i + 0.5) * CHART_W) / 256
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }, [hist])

  async function open(file: File) {
    setError('')
    try {
      const bmp = await createImageBitmap(file)
      const scale = Math.min(1, SAMPLE_W / bmp.width)
      const w = Math.max(1, Math.round(bmp.width * scale))
      const h = Math.max(1, Math.round(bmp.height * scale))
      const sample = document.createElement('canvas')
      sample.width = w
      sample.height = h
      const sctx = sample.getContext('2d', { willReadFrequently: true })
      if (!sctx) throw new Error('no canvas')
      sctx.drawImage(bmp, 0, 0, w, h)
      setHist(buildHistogram(sctx.getImageData(0, 0, w, h).data))
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(file)
      setBitmap(bmp)
      setName(file.name)
    } catch {
      setError('That file could not be opened as an image.')
    }
  }

  const summary: HistogramStats | null = hist ? stats(hist) : null
  const clipped =
    summary !== null && (summary.shadowsClipped > 5 || summary.highlightsClipped > 5)

  return (
    <div>
      <label htmlFor="hgm-file">Choose a photo</label>
      <input
        id="hgm-file"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) open(f)
          e.target.value = ''
        }}
      />
      {error && <p className="error" role="alert">{error}</p>}
      {bitmap && <p className="muted">{name} · {bitmap.width} × {bitmap.height} px</p>}

      <div className="two-col" style={{ marginTop: 18 }}>
        <div>
          <canvas
            ref={canvasRef}
            width={CHART_W}
            height={CHART_H}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
            aria-label="RGB and luminance histogram"
          />
          <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
            Red, green and blue bars add up where channels overlap; the white line is luminance. Bars stacked hard
            against the left or right wall mean clipped detail.
          </p>
        </div>

        <div>
          {summary ? (
            <>
              <div className="stats">
                <div className="stat"><b><Roll>{summary.mean.toFixed(1)}</Roll></b>Mean luminance</div>
                <div className="stat"><b><Roll>{summary.median}</Roll></b>Median tone</div>
                <div className="stat">
                  <b><Roll>{summary.shadowsClipped.toFixed(1)}</Roll>%</b>Shadows clipped
                </div>
                <div className="stat">
                  <b><Roll>{summary.highlightsClipped.toFixed(1)}</Roll>%</b>Highlights clipped
                </div>
              </div>
              <p className={clipped ? 'error' : 'muted'} role="status">
                {clipped
                  ? 'More than 5% of the pixels sit at the very dark or very bright end. Some detail is likely lost there.'
                  : 'Clipping is under control: no large pile-up of pixels at either end.'}
              </p>
            </>
          ) : (
            <p className="muted">Add a photo to read its tone and color distribution.</p>
          )}

          <div className="row">
            <button
              type="button"
              className="btn btn-icon"
              disabled={!bitmap}
              onClick={() => canvasRef.current?.toBlob((blob) => {
                if (!blob) return
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = `histogram-${name || 'image'}.png`
                a.click()
                setTimeout(() => URL.revokeObjectURL(a.href), 4000)
              }, 'image/png')}
            >
              <Icon name="arrow-down-circle" size={18} />
              Save chart
            </button>
            <button type="button" className="btn" disabled={!bitmap} onClick={() => { setHist(null); setBitmap(null); setName('') }}>
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
