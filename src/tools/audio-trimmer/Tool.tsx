import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import Icon from '../../components/Icon'
import { decodeFile, downloadBlob, baseName } from '../../audio/decode'
import { encodeWav, sliceBuffer, type BufferLike } from '../../audio/wav'
import { encodeMp3 } from '../../audio/mp3'
import { fmtBytes, fmtTime } from '../../audio/fmt'
import { clampRange, computePeaks, cutStats, formatRange, type CutRange, type PeakBucket } from './trim'

interface Loaded {
  file: File
  buffer: BufferLike
  peaks: PeakBucket[]
}

export default function AudioTrimmer() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [range, setRange] = useState<CutRange>({ start: 0, end: 0 })
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const [done, setDone] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const duration = loaded ? loaded.buffer.duration : 0
  const stats = cutStats(duration, range)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !loaded) return
    const parent = canvas.parentElement
    const dpr = window.devicePixelRatio || 1
    const w = parent ? parent.clientWidth : 640
    const h = 120
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = getComputedStyle(canvas).color
    ctx.globalAlpha = 0.9
    ctx.lineWidth = Math.max(1, w / loaded.peaks.length - 1)
    loaded.peaks.forEach((p, i) => {
      const x = (i / loaded.peaks.length) * w
      ctx.beginPath()
      ctx.moveTo(x, ((1 - p.max) / 2) * h)
      ctx.lineTo(x, ((1 - p.min) / 2) * h)
      ctx.stroke()
    })
    ctx.globalAlpha = 1
  }, [loaded])

  async function pick(f: File) {
    setError('')
    setResult(null)
    setDone(false)
    try {
      const buffer = await decodeFile(f)
      const peaks = computePeaks(buffer.getChannelData(0), 240)
      setLoaded({ file: f, buffer, peaks })
      setRange({ start: 0, end: buffer.duration })
    } catch {
      setError('Could not decode that file. Try a different audio format.')
      setLoaded(null)
    }
  }

  function setStart(v: number) {
    setRange((r) => clampRange(Math.min(v, r.end), r.end, duration))
  }

  function setEnd(v: number) {
    setRange((r) => clampRange(r.start, Math.max(v, r.start), duration))
  }

  async function cut() {
    if (!loaded) return
    setBusy(true)
    setError('')
    setResult(null)
    setDone(false)
    await new Promise((r) => setTimeout(r, 30))
    try {
      const sliced = sliceBuffer(loaded.buffer, range.start, range.end)
      const blob =
        format === 'mp3'
          ? await encodeMp3(sliced)
          : new Blob([encodeWav(sliced)], { type: 'audio/wav' })
      const suffix = format === 'mp3' ? '.mp3' : '.wav'
      setResult({ blob, name: `${baseName(loaded.file.name)}-trimmed${suffix}` })
    } catch {
      setError('Trim failed — the selection may be empty.')
    } finally {
      setBusy(false)
    }
  }

  function preview() {
    const audio = audioRef.current
    if (!audio || !loaded) return
    const url = URL.createObjectURL(loaded.file)
    audio.src = url
    audio.currentTime = range.start
    void audio.play().catch(() => undefined)
    const stopAt = range.end
    const onTime = () => {
      if (audio.currentTime >= stopAt) {
        audio.pause()
        audio.removeEventListener('timeupdate', onTime)
        URL.revokeObjectURL(url)
      }
    }
    audio.addEventListener('timeupdate', onTime)
  }

  return (
    <div>
      <p className="muted">
        Load an audio file, drag the handles to pick the part you want, and export just that slice.
      </p>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => document.getElementById('at-file')?.click()}>
          <Icon name="plus" size={18} /> {loaded ? 'Choose another file' : 'Choose audio file'}
        </button>
        <input
          id="at-file"
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
            e.target.value = ''
          }}
        />
        {loaded && (
          <span className="muted">
            {loaded.file.name} · {fmtTime(duration)}
          </span>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {loaded && (
        <>
          <div className="panel" style={{ marginTop: 16, padding: 12 }}>
            <canvas ref={canvasRef} aria-label="Waveform" />
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <span className="muted" style={{ minWidth: 44 }}>{fmtTime(0)}</span>
              <div style={{ flex: 1 }}>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.01}
                  value={range.start}
                  aria-label="Start of cut"
                  onChange={(e) => setStart(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.01}
                  value={range.end}
                  aria-label="End of cut"
                  onChange={(e) => setEnd(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <span className="muted" style={{ minWidth: 44, textAlign: 'right' }}>{fmtTime(duration)}</span>
            </div>
          </div>

          <div className="stats" style={{ marginTop: 16 }}>
            <div className="stat">
              <Roll>{formatRange(range.start, range.end)}</Roll>
              <span>Selection</span>
            </div>
            <div className="stat">
              <Roll>{fmtTime(stats.length)}</Roll>
              <span>Cut length</span>
            </div>
            <div className="stat">
              <Roll>{stats.pct.toFixed(1)}%</Roll>
              <span>Of original</span>
            </div>
          </div>

          <div className="two-col" style={{ marginTop: 16 }}>
            <div className="row" style={{ gap: 8 }}>
              <label style={{ margin: 0 }}>
                Format
                <select value={format} onChange={(e) => setFormat(e.target.value as 'mp3' | 'wav')}>
                  <option value="mp3">MP3 · 128 kbps</option>
                  <option value="wav">WAV · 16-bit PCM</option>
                </select>
              </label>
            </div>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button className="btn" onClick={preview}>
                <Icon name="play-circle" size={18} /> Preview cut
              </button>
              <button className="btn primary" onClick={cut} disabled={busy || stats.length <= 0}>
                {busy ? (
                  <span className="busy busy-dots" aria-label="Cutting"><i /><i /><i /></span>
                ) : (
                  <>
                    <Icon name="stop-circle" size={18} /> Trim & export
                  </>
                )}
              </button>
            </div>
          </div>
          <audio ref={audioRef} style={{ display: 'none' }} />
        </>
      )}

      {result && (
        <div className="output" style={{ marginTop: 20 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{result.name}</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                {fmtBytes(result.blob.size)} · {fmtTime(stats.length)}
              </div>
            </div>
            <button
              className={'btn primary' + (done ? ' is-done' : '')}
              onClick={() => {
                downloadBlob(result.blob, result.name)
                setDone(true)
              }}
            >
              <Icon name="save" size={18} /> {done ? 'Saved' : 'Download'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
