import { useEffect, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { CHAR_SETS, charRows, toAscii, toAsciiHtml } from './ascii'

const SET_NAMES = Object.keys(CHAR_SETS)

export default function ImageToAscii() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [name, setName] = useState('')
  const [width, setWidth] = useState(100)
  const [charset, setCharset] = useState('classic')
  const [color, setColor] = useState(false)
  const [invert, setInvert] = useState(false)
  const [error, setError] = useState('')
  const [plain, setPlain] = useState('')
  const [html, setHtml] = useState('')
  const urlRef = useRef('')

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!bitmap) return
    const rows = charRows(bitmap.width, bitmap.height, width)
    const sample = document.createElement('canvas')
    sample.width = width
    sample.height = rows
    const ctx = sample.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, rows)
    const pixels = ctx.getImageData(0, 0, width, rows).data
    const ramp = invert ? [...CHAR_SETS[charset]].reverse().join('') : CHAR_SETS[charset]
    setPlain(toAscii(pixels, width, rows, ramp).join('\n'))
    setHtml(color ? toAsciiHtml(pixels, width, rows, ramp) : '')
  }, [bitmap, width, charset, color, invert])

  async function open(file: File) {
    setError('')
    try {
      const bmp = await createImageBitmap(file)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(file)
      setBitmap(bmp)
      setName(file.name)
    } catch {
      setError('That file could not be opened as an image.')
    }
  }

  function downloadTxt() {
    const url = URL.createObjectURL(new Blob([plain], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `ascii-${name || 'image'}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const rows = bitmap ? charRows(bitmap.width, bitmap.height, width) : 0

  return (
    <div>
      <label htmlFor="asc-file">Choose an image</label>
      <input
        id="asc-file"
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

      <div className="row">
        <label style={{ margin: 0 }} htmlFor="asc-width">
          Width — <b><Roll>{width}</Roll> characters</b>
        </label>
        <input
          id="asc-width"
          type="range"
          min={20}
          max={240}
          value={width}
          onChange={(e) => setWidth(Math.round(Number(e.target.value)))}
          style={{ flex: '1 1 200px' }}
        />
        <label style={{ margin: 0 }} htmlFor="asc-set">Characters</label>
        <select id="asc-set" value={charset} onChange={(e) => setCharset(e.target.value)} style={{ width: 'auto' }}>
          {SET_NAMES.map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
        <label style={{ fontWeight: 400, margin: 0 }}>
          <input type="checkbox" checked={color} onChange={(e) => setColor(e.target.checked)} /> Color output
        </label>
        <label style={{ fontWeight: 400, margin: 0 }}>
          <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Invert for dark backgrounds
        </label>
      </div>

      {bitmap && (
        <div className="stats">
          <div className="stat"><b><Roll>{width}</Roll>×<Roll>{rows}</Roll></b>Characters</div>
          <div className="stat"><b><Roll>{CHAR_SETS[charset].length}</Roll></b>Glyphs in ramp</div>
          <div className="stat"><b><Roll>{[...plain].length}</Roll></b>Characters of art</div>
        </div>
      )}

      {plain ? (
        <>
          {color ? (
            <pre
              className="output"
              style={{ overflowX: 'auto', lineHeight: 1, fontSize: '0.6rem', margin: 0 }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <pre className="output" style={{ overflowX: 'auto', lineHeight: 1, fontSize: '0.6rem', margin: 0 }}>
              {plain}
            </pre>
          )}
          <div className="row">
            <CopyButton text={plain} label="Copy ASCII" />
            <button type="button" className="btn btn-icon" onClick={downloadTxt}>
              <Icon name="arrow-down-circle" size={18} />
              Download .txt
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.84rem' }}>
            Paste it into a document set in a monospace font, or keep it as a .txt file. The luminance used for each
            glyph is Rec. 709 (green counts most), which matches how the eye reads brightness.
          </p>
        </>
      ) : (
        <p className="muted">Add a photo to turn it into text art.</p>
      )}
    </div>
  )
}
