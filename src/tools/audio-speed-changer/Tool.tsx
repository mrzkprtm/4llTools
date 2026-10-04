import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import Icon from '../../components/Icon'
import { decodeFile, downloadBlob, baseName } from '../../audio/decode'
import { encodeWav, type BufferLike } from '../../audio/wav'
import { speedBuffer } from '../../audio/resample'
import { encodeMp3 } from '../../audio/mp3'
import { fmtBytes, fmtTime } from '../../audio/fmt'
import { clampSpeed, labelForSpeed, newDuration, SPEEDS } from './speed'

interface Loaded {
  file: File
  buffer: BufferLike
}

export default function AudioSpeedChanger() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [speed, setSpeed] = useState(1.5)
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string; url: string } | null>(null)
  const [done, setDone] = useState(false)
  const urlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  const duration = loaded ? loaded.buffer.duration : 0

  async function pick(f: File) {
    setError('')
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setResult(null)
    setDone(false)
    try {
      const buffer = await decodeFile(f)
      setLoaded({ file: f, buffer })
    } catch {
      setError('Could not decode that file. Try a different audio format.')
      setLoaded(null)
    }
  }

  async function change() {
    if (!loaded) return
    setBusy(true)
    setError('')
    setResult(null)
    setDone(false)
    await new Promise((r) => setTimeout(r, 30))
    try {
      const sped = speedBuffer(loaded.buffer, speed)
      const blob =
        format === 'mp3'
          ? await encodeMp3(sped)
          : new Blob([encodeWav(sped)], { type: 'audio/wav' })
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(blob)
      urlRef.current = url
      setResult({ blob, name: `${baseName(loaded.file.name)}-${speed}x.${format}`, url })
    } catch {
      setError('Processing failed — the file may be corrupt.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="muted">
        Time-stretches your audio so it plays faster or slower without changing the pitch — great for
        podcasts, lectures and language practice.
      </p>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => document.getElementById('spd-file')?.click()}>
          <Icon name="plus" size={18} /> {loaded ? 'Choose another file' : 'Choose audio file'}
        </button>
        <input
          id="spd-file"
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
          <div className="row" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
            {SPEEDS.map((s, i) => (
              <button
                key={s}
                className={'btn' + (speed === s ? ' primary' : '')}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => {
                  setSpeed(s)
                  setResult(null)
                  setDone(false)
                }}
              >
                <Icon name="forward-circle" size={16} /> {labelForSpeed(s)}
              </button>
            ))}
          </div>

          <div className="stats" style={{ marginTop: 16 }}>
            <div className="stat">
              <Roll>{fmtTime(duration)}</Roll>
              <span>Original</span>
            </div>
            <div className="stat">
              <Roll>{labelForSpeed(clampSpeed(speed))}</Roll>
              <span>Speed</span>
            </div>
            <div className="stat">
              <Roll>{fmtTime(newDuration(duration, clampSpeed(speed)))}</Roll>
              <span>New length</span>
            </div>
          </div>

          <div className="two-col" style={{ marginTop: 16 }}>
            <label style={{ margin: 0 }}>
              Format
              <select value={format} onChange={(e) => setFormat(e.target.value as 'mp3' | 'wav')}>
                <option value="mp3">MP3 · 128 kbps</option>
                <option value="wav">WAV · 16-bit PCM</option>
              </select>
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={change} disabled={busy}>
                {busy ? (
                  <span className="busy busy-dots" aria-label="Processing"><i /><i /><i /></span>
                ) : (
                  <>
                    <Icon name="reload" size={18} /> Apply {labelForSpeed(speed)}
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {result && (
        <div className="output" style={{ marginTop: 20, display: 'grid', gap: 12 }}>
          <audio controls src={result.url} style={{ width: '100%' }} />
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{result.name}</strong>
              <div className="muted" style={{ marginTop: 4 }}>{fmtBytes(result.blob.size)}</div>
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
