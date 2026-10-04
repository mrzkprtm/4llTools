import { useEffect, useRef, useState } from 'react'
import { downloadBlob } from '../../audio/decode'
import { fmtTime } from '../../audio/fmt'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { extForMime, pickMimeType } from './recorder'

type Phase = 'idle' | 'recording' | 'paused' | 'done'

export default function Tool() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [mime, setMime] = useState('')
  const [url, setUrl] = useState('')
  const [size, setSize] = useState(0)
  const [error, setError] = useState('')

  const mediaRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const timerRef = useRef(0)

  useEffect(() => () => stopAll(), [])

  function stopAll() {
    cancelAnimationFrame(rafRef.current)
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (mediaRef.current?.state !== 'inactive') mediaRef.current?.stop()
    void audioCtxRef.current?.close().catch(() => undefined)
    streamRef.current = null
    mediaRef.current = null
    audioCtxRef.current = null
  }

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const chosen = pickMimeType((t) => MediaRecorder.isTypeSupported(t))
      setMime(chosen || 'default')
      const recorder = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined)
      mediaRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || chosen || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        setSize(blob.size)
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(blob)
        })
      }
      recorder.start(250)

      // Level meter
      const AC = window.AudioContext
      const actx = new AC()
      audioCtxRef.current = actx
      const src = actx.createMediaStreamSource(stream)
      const analyser = actx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128)
        setLevel(peak)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)

      setSeconds(0)
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
      setPhase('recording')
    } catch {
      setError('Microphone access was blocked. Allow the permission and try again — audio never leaves this page.')
    }
  }

  function pause() {
    mediaRef.current?.pause()
    clearInterval(timerRef.current)
    cancelAnimationFrame(rafRef.current)
    setPhase('paused')
  }

  function resume() {
    mediaRef.current?.resume()
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    setPhase('recording')
  }

  function stop() {
    stopAll()
    setPhase('done')
    setLevel(0)
  }

  function reset() {
    if (url) URL.revokeObjectURL(url)
    setUrl('')
    setSize(0)
    setSeconds(0)
    setPhase('idle')
  }

  const recording = phase === 'recording'

  return (
    <div className="panel" style={{ textAlign: 'center', padding: '36px 24px' }}>
      <div
        style={{
          width: 96,
          height: 96,
          margin: '0 auto',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: recording ? 'var(--accent)' : 'var(--sunken)',
          color: recording ? 'var(--accent-text)' : 'var(--text)',
          border: '1px solid var(--border-strong)',
          boxShadow: recording ? '0 0 0 10px var(--accent-soft)' : 'none',
          transition: 'background 0.2s, box-shadow 0.2s',
        }}
      >
        <Icon name="microphone" size={40} />
      </div>

      <p className="big-number" style={{ margin: '18px 0 4px' }}>
        <Roll>{fmtTime(seconds)}</Roll>
      </p>
      <p className="muted" style={{ margin: 0 }}>
        {phase === 'idle' && 'Press record to start — nothing is uploaded.'}
        {phase === 'recording' && `Recording… format: ${mime || 'browser default'}`}
        {phase === 'paused' && 'Paused'}
        {phase === 'done' && 'Recording ready — listen back or download.'}
      </p>

      <div
        role="meter"
        aria-label="Input level"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        style={{
          height: 8,
          maxWidth: 320,
          margin: '20px auto',
          borderRadius: 4,
          background: 'var(--sunken)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, level * 100)}%`,
            background: level > 0.92 ? 'var(--danger)' : 'var(--accent)',
            transition: 'width 0.08s linear, background 0.2s',
          }}
        />
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        {(phase === 'idle' || phase === 'done') && (
          <button type="button" className="btn primary btn-icon" onClick={() => void start()}>
            <Icon name="play-circle" size={16} /> {phase === 'done' ? 'Record again' : 'Record'}
          </button>
        )}
        {recording && (
          <button type="button" className="btn btn-icon" onClick={pause}>
            <Icon name="pause-circle" size={16} /> Pause
          </button>
        )}
        {phase === 'paused' && (
          <button type="button" className="btn primary btn-icon" onClick={resume}>
            <Icon name="play-circle" size={16} /> Resume
          </button>
        )}
        {(recording || phase === 'paused') && (
          <button type="button" className="btn btn-icon" onClick={stop}>
            <Icon name="stop-circle" size={16} /> Stop
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {phase === 'done' && url && (
        <div style={{ marginTop: 24 }}>
          <audio controls src={url} style={{ width: '100%', maxWidth: 420 }} />
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button
              type="button"
              className="btn primary btn-icon"
              onClick={() =>
                void fetch(url)
                  .then((r) => r.blob())
                  .then((b) => downloadBlob(b, `recording-${Date.now()}.${extForMime(b.type)}`))
              }
            >
              <Icon name="save" size={16} /> Download
            </button>
            <button type="button" className="btn" onClick={reset}>
              Discard
            </button>
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            {size > 0 && `${(size / 1024).toFixed(0)} KB recorded locally.`} Tip: download, then convert to MP3 with
            the Audio Converter if you need a smaller file.
          </p>
        </div>
      )}
    </div>
  )
}
