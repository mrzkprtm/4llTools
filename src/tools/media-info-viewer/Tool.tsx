import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import Icon from '../../components/Icon'
import { decodeFile } from '../../audio/decode'
import { fmtBytes, fmtTime, fmtBitrate } from '../../audio/fmt'
import { aspectRatio, guessKind, overallBitrateKbps, type MediaKind } from './info'

interface Row {
  label: string
  value: string
}

interface Probe {
  kind: MediaKind
  file: File
  rows: Row[]
  previewUrl?: string
  previewKind: 'audio' | 'video' | 'image' | null
}

export default function MediaInfoViewer() {
  const [probe, setProbe] = useState<Probe | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const urlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  async function inspect(f: File) {
    setError('')
    setBusy(true)
    setProbe(null)
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    const kind = guessKind(f.type, f.name)
    const rows: Row[] = [
      { label: 'File name', value: f.name },
      { label: 'File size', value: fmtBytes(f.size) },
      { label: 'MIME type', value: f.type || 'unknown' },
      { label: 'Category', value: kind === 'other' ? 'Not a media file' : kind },
    ]
    let previewUrl: string | undefined
    let previewKind: Probe['previewKind'] = null
    try {
      if (kind === 'audio' || kind === 'video') {
        const buffer = await decodeFile(f)
        rows.push(
          { label: 'Duration', value: fmtTime(buffer.duration) },
          { label: 'Channels', value: String(buffer.numberOfChannels) },
          { label: 'Sample rate', value: `${buffer.sampleRate.toLocaleString()} Hz` },
          { label: 'Audio bitrate (est.)', value: fmtBitrate(overallBitrateKbps(f.size, buffer.duration)) },
        )
        if (kind === 'video') {
          const dim = await probeVideo(f)
          if (dim) {
            rows.push(
              { label: 'Resolution', value: `${dim.w} × ${dim.h}` },
              { label: 'Aspect ratio', value: aspectRatio(dim.w, dim.h) },
            )
          }
          previewUrl = URL.createObjectURL(f)
          urlRef.current = previewUrl
          previewKind = 'video'
        } else {
          previewUrl = URL.createObjectURL(f)
          urlRef.current = previewUrl
          previewKind = 'audio'
        }
      } else if (kind === 'image') {
        const dim = await probeImage(f)
        if (dim) {
          rows.push(
            { label: 'Dimensions', value: `${dim.w} × ${dim.h}` },
            { label: 'Aspect ratio', value: aspectRatio(dim.w, dim.h) },
            { label: 'Megapixels', value: ((dim.w * dim.h) / 1_000_000).toFixed(2) },
          )
        }
        previewUrl = URL.createObjectURL(f)
        urlRef.current = previewUrl
        previewKind = 'image'
      }
      setProbe({ kind, file: f, rows, previewUrl, previewKind })
    } catch {
      setError('Could not read details from that file. It may be corrupt or unsupported.')
    } finally {
      setBusy(false)
    }
  }

  function probeVideo(f: File): Promise<{ w: number; h: number } | null> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const url = URL.createObjectURL(f)
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(video.videoWidth > 0 ? { w: video.videoWidth, h: video.videoHeight } : null)
      }
      video.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      video.src = url
    })
  }

  function probeImage(f: File): Promise<{ w: number; h: number } | null> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(f)
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img.naturalWidth > 0 ? { w: img.naturalWidth, h: img.naturalHeight } : null)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    })
  }

  return (
    <div>
      <p className="muted">
        Drop any audio, video or image file to see its technical details — duration, resolution,
        bitrate and more.
      </p>

      <div
        className="panel"
        style={{ borderStyle: 'dashed', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => document.getElementById('mi-file')?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) inspect(f)
        }}
      >
        <input
          id="mi-file"
          type="file"
          accept="audio/*,video/*,image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) inspect(f)
            e.target.value = ''
          }}
        />
        <Icon name="info-circle" size={28} />
        <div style={{ marginTop: 8 }}>
          {busy ? (
            <span className="busy busy-dots" aria-label="Inspecting"><i /><i /><i /></span>
          ) : (
            <strong>Drop a media file here or click to browse</strong>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {probe && (
        <>
          {probe.previewUrl && probe.previewKind === 'image' && (
            <img
              src={probe.previewUrl}
              alt={probe.file.name}
              style={{ marginTop: 16, maxWidth: '100%', maxHeight: 240, borderRadius: 8, display: 'block' }}
            />
          )}
          {probe.previewUrl && probe.previewKind === 'video' && (
            <video
              controls
              src={probe.previewUrl}
              style={{ marginTop: 16, maxWidth: '100%', maxHeight: 240, borderRadius: 8, display: 'block', background: '#000' }}
            />
          )}
          {probe.previewUrl && probe.previewKind === 'audio' && (
            <audio controls src={probe.previewUrl} style={{ marginTop: 16, width: '100%' }} />
          )}

          <div className="stats" style={{ marginTop: 16 }}>
            <div className="stat">
              <Roll>{fmtBytes(probe.file.size)}</Roll>
              <span>Size</span>
            </div>
            <div className="stat">
              <Roll>{probe.rows.length}</Roll>
              <span>Fields found</span>
            </div>
          </div>

          <table className="simple" style={{ marginTop: 16 }}>
            <tbody>
              {probe.rows.map((row, i) => (
                <tr key={row.label} style={{ animationDelay: `${i * 30}ms` }}>
                  <td className="muted" style={{ width: '40%' }}>{row.label}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
