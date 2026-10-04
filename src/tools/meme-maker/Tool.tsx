import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { BACKGROUNDS, type MemeOpts, drawMeme, memeCanvasSize } from './meme'

function savePng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }, 'image/png')
}

export default function MemeMaker() {
  const [opts, setOpts] = useState<MemeOpts>({ top: '', bottom: '', size: 64, caps: true })
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [bg, setBg] = useState<string>(BACKGROUNDS[0])
  const [dragOver, setDragOver] = useState(false)
  const [dims, setDims] = useState({ w: 800, h: 800 })
  const [saved, setSaved] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  imgRef.current = img

  const loadFile = useCallback((file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      setImg(image)
      setDims(memeCanvasSize(image))
      URL.revokeObjectURL(url)
    }
    image.src = url
  }, [])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawMeme(ctx, imgRef.current, bg, opts)
  }, [opts, img, bg, dims])

  const set = <K extends keyof MemeOpts>(key: K, value: MemeOpts[K]) => setOpts((o) => ({ ...o, [key]: value }))

  return (
    <div>
      <div className="row" style={{ marginTop: 0, alignItems: 'flex-start' }}>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            loadFile(e.dataTransfer.files?.[0] ?? null)
          }}
          style={{
            flex: '1 1 320px',
            minWidth: 0,
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            transition: 'border-color 0.2s',
            background: dragOver ? 'var(--accent-soft)' : undefined,
          }}
        >
          <div className="row" style={{ margin: 0, justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>
              <Icon name="image-plus" size={18} /> {img ? 'Image loaded' : 'Drop an image here'}
            </span>
            <label className="btn btn-icon" style={{ margin: 0 }}>
              <Icon name="arrow-right" size={16} />
              Browse
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => loadFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {!img && (
            <>
              <label htmlFor="m-bg" style={{ marginTop: 14 }}>Text-only background</label>
              <div className="row" style={{ marginTop: 4 }}>
                {BACKGROUNDS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBg(c)}
                    aria-label={`Background ${c}`}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--radius-sm)',
                      background: c,
                      border: c === bg ? '3px solid var(--accent)' : '1px solid var(--border-strong)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </>
          )}
          {img && (
            <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => { setImg(null); setDims({ w: 800, h: 800 }) }}>
              Remove image
            </button>
          )}
        </div>

        <div style={{ flex: '2 1 300px', minWidth: 0 }}>
          <canvas
            ref={canvasRef}
            width={dims.w}
            height={dims.h}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
            aria-label="Meme preview"
          />
          <p className="muted" style={{ fontSize: '0.78rem', marginTop: 6, fontFamily: 'var(--mono)' }}>
            <Roll>{dims.w}</Roll>×<Roll>{dims.h}</Roll> {img ? 'from your image' : 'square canvas'}
          </p>
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <span>
          <label htmlFor="m-top">Top caption</label>
          <input id="m-top" type="text" value={opts.top} maxLength={90} onChange={(e) => set('top', e.target.value)} placeholder="WHEN THE CODE COMPILES" />
        </span>
        <span>
          <label htmlFor="m-bottom">Bottom caption</label>
          <input id="m-bottom" type="text" value={opts.bottom} maxLength={90} onChange={(e) => set('bottom', e.target.value)} placeholder="ON THE FIRST TRY" />
        </span>
      </div>
      <p className="muted" style={{ fontSize: '0.82rem', marginTop: 4 }}>New lines become extra rows (up to 3 per caption).</p>

      <div className="row" style={{ alignItems: 'center' }}>
        <label htmlFor="m-size" style={{ margin: 0 }}>Font</label>
        <input id="m-size" type="range" min={36} max={120} step={2} value={opts.size} onChange={(e) => set('size', Number(e.target.value))} style={{ flex: 1, minWidth: 120 }} />
        <b style={{ width: 34, textAlign: 'right' }}><Roll>{opts.size}</Roll></b>
        <label className="row" style={{ margin: 0, fontWeight: 400, gap: 6 }}>
          <input type="checkbox" checked={opts.caps} onChange={(e) => set('caps', e.target.checked)} />
          ALL CAPS
        </label>
        <button
          type="button"
          className={`btn btn-icon primary ${saved ? 'is-done' : ''}`}
          onClick={() => {
            if (canvasRef.current) {
              savePng(canvasRef.current, 'meme.png')
              setSaved(true)
              window.setTimeout(() => setSaved(false), 2000)
            }
          }}
        >
          <Icon name={saved ? 'clipboard-check' : 'arrow-right'} size={16} />
          {saved ? 'Saved!' : 'Download PNG'}
        </button>
      </div>
    </div>
  )
}
