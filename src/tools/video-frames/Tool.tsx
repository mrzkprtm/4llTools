import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import Icon from '../../components/Icon'
import { baseName } from '../../audio/decode'
import { fmtTime } from '../../audio/fmt'
import { clampEvery, frameName, frameTimes } from './frames'

interface Shot {
  time: number
  url: string
  blob: Blob
}

const MAX_FRAMES = 60

export default function VideoFrames() {
  const [file, setFile] = useState<File | null>(null)
  const [duration, setDuration] = useState(0)
  const [videoSize, setVideoSize] = useState('—')
  const [every, setEvery] = useState(1)
  const [format, setFormat] = useState<'png' | 'jpg'>('jpg')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [shots, setShots] = useState<Shot[]>([])
  const [savedAll, setSavedAll] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const urlRef = useRef<string | null>(null)
  const shotsRef = useRef<Shot[]>([])

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url))
  }, [])

  function pick(f: File) {
    setError('')
    setShots([])
    shotsRef.current = []
    setSavedAll(false)
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(f)
    urlRef.current = url
    setFile(f)
    const video = videoRef.current
    if (!video) return
    video.preload = 'metadata'
    video.src = url
    video.onloadedmetadata = () => {
      setDuration(video.duration)
      setVideoSize(`${video.videoWidth} × ${video.videoHeight}`)
    }
    video.onerror = () => setError('Could not read that video file. Try MP4, WebM or MOV.')
  }

  function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        resolve()
      }
      const onError = () => {
        video.removeEventListener('error', onError)
        reject(new Error('seek failed'))
      }
      video.addEventListener('seeked', onSeeked, { once: true })
      video.addEventListener('error', onError, { once: true })
      video.currentTime = t
    })
  }

  async function extract() {
    const video = videoRef.current
    if (!video || duration <= 0) return
    setBusy(true)
    setError('')
    setShots([])
    setSavedAll(false)
    setProgress(0)
    shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url))
    shotsRef.current = []
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setBusy(false)
      setError('Canvas is not available in this browser.')
      return
    }
    try {
      const times = frameTimes(duration, clampEvery(every), MAX_FRAMES)
      const out: Shot[] = []
      for (let i = 0; i < times.length; i++) {
        await seekTo(video, times[i])
        ctx.drawImage(video, 0, 0)
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.85),
        )
        if (blob) {
          out.push({ time: times[i], url: URL.createObjectURL(blob), blob })
        }
        setProgress(i + 1)
        setShots([...out])
      }
      shotsRef.current = out
    } catch {
      setError('Frame extraction failed partway through.')
    } finally {
      setBusy(false)
    }
  }

  async function downloadAll() {
    for (let i = 0; i < shots.length; i++) {
      const a = document.createElement('a')
      a.href = shots[i].url
      a.download = file ? frameName(baseName(file.name), i, format) : `frame-${i + 1}.${format}`
      a.click()
      await new Promise((r) => setTimeout(r, 450))
    }
    setSavedAll(true)
  }

  return (
    <div>
      <p className="muted">
        Turn a video into a set of still images. Pick an interval, extract, then download individual
        frames or the whole set.
      </p>

      <input
        id="vf-file"
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) pick(f)
          e.target.value = ''
        }}
      />
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => document.getElementById('vf-file')?.click()}>
          <Icon name="plus" size={18} /> {file ? 'Choose another video' : 'Choose video file'}
        </button>
        {file && (
          <span className="muted">
            {file.name} · {fmtTime(duration)} · {videoSize}
          </span>
        )}
      </div>

      <video ref={videoRef} style={{ display: 'none' }} muted playsInline />

      {error && <p className="error">{error}</p>}

      {duration > 0 && (
        <>
          <div className="stats" style={{ marginTop: 16 }}>
            <div className="stat">
              <Roll>{fmtTime(duration)}</Roll>
              <span>Duration</span>
            </div>
            <div className="stat">
              <Roll>{frameTimes(duration, clampEvery(every), MAX_FRAMES).length}</Roll>
              <span>Frames to extract</span>
            </div>
            <div className="stat">
              <Roll>{format.toUpperCase()}</Roll>
              <span>Format</span>
            </div>
          </div>

          <div className="two-col" style={{ marginTop: 16 }}>
            <label style={{ margin: 0 }}>
              One frame every (seconds)
              <input
                type="number"
                min={0.1}
                max={60}
                step={0.1}
                value={every}
                onChange={(e) => setEvery(clampEvery(Number(e.target.value)))}
              />
            </label>
            <div className="row" style={{ gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <label style={{ margin: 0 }}>
                Format
                <select value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'jpg')}>
                  <option value="jpg">JPG · smaller</option>
                  <option value="png">PNG · lossless</option>
                </select>
              </label>
              <button className="btn primary" onClick={extract} disabled={busy}>
                {busy ? (
                  <span className="busy busy-dots" aria-label="Extracting"><i /><i /><i /></span>
                ) : (
                  <>
                    <Icon name="image-multiple" size={18} /> Extract frames
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {busy && (
        <p className="muted" style={{ marginTop: 12 }}>
          Extracting… {progress} / {frameTimes(duration, clampEvery(every), MAX_FRAMES).length}
        </p>
      )}

      {shots.length > 0 && !busy && (
        <>
          <div className="row" style={{ marginTop: 20, justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <strong>{shots.length} frames extracted</strong>
            <button className={'btn primary' + (savedAll ? ' is-done' : '')} onClick={downloadAll}>
              <Icon name="save" size={18} /> {savedAll ? 'Saved all' : 'Download all'}
            </button>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
            {shots.map((shot, i) => (
              <figure key={shot.url} style={{ margin: 0, width: 160, animationDelay: `${i * 30}ms` }}>
                <a href={shot.url} download={file ? frameName(baseName(file.name), i, format) : `frame-${i + 1}.${format}`}>
                  <img
                    src={shot.url}
                    alt={`Frame at ${fmtTime(shot.time)}`}
                    style={{ width: '100%', borderRadius: 6, display: 'block' }}
                    loading="lazy"
                  />
                </a>
                <figcaption className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
                  {fmtTime(shot.time)}
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
