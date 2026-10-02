import { useRef, useState } from 'react'
import Icon from '../../components/Icon'

const MAX_SIDE = 480

/** Reads an image file and returns a small JPEG data URL (longest side MAX_SIDE px). */
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) return reject(new Error('no canvas'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.6))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('not an image'))
    }
    img.src = url
  })
}

/** Take or pick a photo of the parking spot and show it as a thumbnail. */
export default function SpotPhoto({ photo, onPhoto }: { photo?: string; onPhoto: (p: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [big, setBig] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setError('')
    try {
      onPhoto(await downscale(file))
    } catch {
      setError('That file could not be read as a photo.')
    }
  }

  return (
    <div className="pt-photo">
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      {photo ? (
        <div className="pt-thumb-row">
          <button type="button" className={`pt-thumb ${big ? 'big' : ''}`} onClick={() => setBig(!big)} aria-label={big ? 'Shrink photo' : 'Enlarge photo'}>
            <img src={photo} alt="Photo of the parking spot" />
          </button>
          <div className="pt-thumb-actions">
            <button type="button" className="btn btn-icon" onClick={() => input.current?.click()}><Icon name="camera" size={18} />Retake</button>
            <button type="button" className="btn" onClick={() => onPhoto(undefined)}>Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-icon" onClick={() => input.current?.click()}><Icon name="camera" size={18} />Add a photo of the spot</button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
