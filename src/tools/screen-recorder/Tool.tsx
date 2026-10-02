import { useEffect, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import Check from '../../motion/Check'
import { captureSupport, clock, extFor, fileName, pickMimeType, sizeLabel, type CaptureSupport } from './recorder'
import './tool.css'

type Phase = 'idle' | 'choosing' | 'countdown' | 'recording' | 'paused' | 'done'

interface Result {
  url: string
  size: number
  mime: string
  name: string
  ms: number
}

function errorText(err: unknown): string {
  const name = (err as { name?: string })?.name
  if (name === 'NotAllowedError') return 'Screen sharing was cancelled or blocked. Click Start and choose a screen, window or tab to record.'
  if (name === 'NotFoundError') return 'No screen or window was available to capture.'
  if (name === 'NotReadableError') return 'The system would not let the browser capture the screen. On macOS, allow screen recording for your browser in System Settings → Privacy & Security.'
  return `Could not start recording${err instanceof Error && err.message ? `: ${err.message}` : '.'}`
}

export default function ScreenRecorder() {
  const [support, setSupport] = useState<CaptureSupport | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [mic, setMic] = useState(true)
  const [sysAudio, setSysAudio] = useState(true)
  const [countdown, setCountdown] = useState(true)
  const [fps, setFps] = useState(30)
  const [count, setCount] = useState(3)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [, setTick] = useState(0)
  const live = useRef<HTMLVideoElement>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const streams = useRef<MediaStream[]>([])
  const audioCtx = useRef<AudioContext | null>(null)
  const chunks = useRef<Blob[]>([])
  const timing = useRef({ acc: 0, since: 0 })
  const countTimer = useRef(0)
  const mime = useRef('')
  const urlRef = useRef('')

  useEffect(() => {
    setSupport(captureSupport(navigator as never, typeof MediaRecorder !== 'undefined', window.isSecureContext))
    return () => {
      cleanup()
      clearTimeout(countTimer.current)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 'recording') return
    const id = setInterval(() => setTick((t) => t + 1), 250)
    return () => clearInterval(id)
  }, [phase])

  function cleanup() {
    for (const s of streams.current) for (const t of s.getTracks()) t.stop()
    streams.current = []
    void audioCtx.current?.close().catch(() => undefined)
    audioCtx.current = null
    if (live.current) live.current.srcObject = null
  }

  const elapsed = () => timing.current.acc + (phase === 'recording' && timing.current.since ? Date.now() - timing.current.since : 0)

  async function start() {
    setError('')
    setNote('')
    setPhase('choosing')
    let display: MediaStream
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: fps } }, audio: sysAudio })
    } catch (err) {
      setError(errorText(err))
      setPhase(result ? 'done' : 'idle')
      return
    }
    streams.current = [display]
    const audioTracks: MediaStreamTrack[] = [...display.getAudioTracks()]
    if (sysAudio && !audioTracks.length) setNote('No system audio was shared. In Chrome/Edge, tick “Share tab audio” (or system audio on Windows) in the picker; macOS and Firefox cannot share system audio.')
    if (mic) {
      try {
        const m = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        streams.current.push(m)
        audioTracks.push(...m.getAudioTracks())
      } catch {
        setNote((n) => `${n ? `${n} ` : ''}The microphone was not available, so the recording has no voice.`)
      }
    }
    let audio: MediaStreamTrack[] = audioTracks
    if (audioTracks.length > 1) {
      // Mix system audio and microphone into one track.
      const ctx = new AudioContext()
      audioCtx.current = ctx
      const dest = ctx.createMediaStreamDestination()
      for (const t of audioTracks) ctx.createMediaStreamSource(new MediaStream([t])).connect(dest)
      audio = dest.stream.getAudioTracks()
    }
    const video = display.getVideoTracks()[0]
    const combined = new MediaStream([video, ...audio])
    if (live.current) live.current.srcObject = display
    video.addEventListener('ended', () => stop())

    mime.current = pickMimeType((t) => MediaRecorder.isTypeSupported(t), audio.length > 0)
    const begin = () => {
      try {
        const r = mime.current ? new MediaRecorder(combined, { mimeType: mime.current }) : new MediaRecorder(combined)
        chunks.current = []
        r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
        r.onstop = finish
        r.start(1000)
        rec.current = r
        timing.current = { acc: 0, since: Date.now() }
        setPhase('recording')
      } catch (err) {
        cleanup()
        setError(errorText(err))
        setPhase('idle')
      }
    }
    if (countdown) {
      setPhase('countdown')
      setCount(3)
      let n = 3
      const step = () => {
        n -= 1
        if (n <= 0) return begin()
        setCount(n)
        countTimer.current = window.setTimeout(step, 1000)
      }
      countTimer.current = window.setTimeout(step, 1000)
    } else begin()
  }

  function finish() {
    const type = rec.current?.mimeType || mime.current || 'video/webm'
    const blob = new Blob(chunks.current, { type: type.split(';')[0] })
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    setResult({ url, size: blob.size, mime: type, name: fileName(type), ms: timing.current.acc })
    rec.current = null
    cleanup()
    setPhase('done')
  }

  function stop() {
    clearTimeout(countTimer.current)
    const r = rec.current
    if (r && r.state !== 'inactive') {
      if (timing.current.since) timing.current.acc += Date.now() - timing.current.since
      timing.current.since = 0
      r.stop()
    } else {
      cleanup()
      setPhase(result ? 'done' : 'idle')
    }
  }

  function togglePause() {
    const r = rec.current
    if (!r) return
    if (r.state === 'recording') {
      r.pause()
      timing.current.acc += Date.now() - timing.current.since
      timing.current.since = 0
      setPhase('paused')
    } else if (r.state === 'paused') {
      r.resume()
      timing.current.since = Date.now()
      setPhase('recording')
    }
  }

  const active = phase === 'recording' || phase === 'paused' || phase === 'countdown'
  const showLive = active || phase === 'choosing'

  if (support && !support.ok) {
    return (
      <div>
        <p className="error" role="alert">{support.reason}</p>
        <p className="muted">Screen recording in the browser needs the Screen Capture API (getDisplayMedia) and MediaRecorder, which desktop Chrome, Edge, Firefox and Safari 14.1+ provide. Android and iOS browsers do not allow websites to record the screen.</p>
      </div>
    )
  }

  return (
    <div>
      <fieldset disabled={active || phase === 'choosing'} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="muted" style={{ fontSize: '0.88rem', padding: 0 }}>Options</legend>
        <div className="sr-opts">
          <label className="sr-opt"><input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} /><span>Record microphone<small>Your voice, mixed with the screen audio</small></span></label>
          <label className="sr-opt"><input type="checkbox" checked={sysAudio} onChange={(e) => setSysAudio(e.target.checked)} /><span>Record tab / system audio<small>Chrome and Edge; tick “Share audio” in the picker</small></span></label>
          <label className="sr-opt"><input type="checkbox" checked={countdown} onChange={(e) => setCountdown(e.target.checked)} /><span>3-second countdown<small>Time to switch to the window you are showing</small></span></label>
          <div>
            <label htmlFor="sr-fps" style={{ margin: '0 0 4px', fontSize: '0.88rem' }}>Frame rate</label>
            <select id="sr-fps" value={fps} onChange={(e) => setFps(Number(e.target.value))}>
              <option value={15}>15 fps (small files, slides)</option>
              <option value={30}>30 fps (recommended)</option>
              <option value={60}>60 fps (smooth motion, larger)</option>
            </select>
          </div>
        </div>
      </fieldset>

      <div className="row">
        {!active && phase !== 'choosing' && <button type="button" className="btn primary sr-rec" onClick={start} disabled={!support}>● {result ? 'Record again' : 'Start recording'}</button>}
        {(phase === 'recording' || phase === 'paused') && (
          <>
            <button type="button" className="btn primary sr-rec" onClick={stop}>■ Stop</button>
            <button type="button" className="btn" onClick={togglePause}>{phase === 'paused' ? '▶ Resume' : '❚❚ Pause'}</button>
            <span className="sr-timer" aria-live="off">{clock(elapsed())}</span>
          </>
        )}
        {phase === 'countdown' && <button type="button" className="btn" onClick={stop}>Cancel</button>}
      </div>
      {phase === 'choosing' && <Busy label="Waiting for you to choose a screen, window or tab…" />}
      {error && <p className="error" role="alert">{error}</p>}
      {note && <p className="muted" style={{ fontSize: '0.88rem' }}>{note}</p>}

      <div className="sr-stage">
        <video ref={live} autoPlay muted playsInline style={{ display: showLive ? 'block' : 'none' }} />
        {!showLive && result && <video key={result.url} src={result.url} controls playsInline className="settle-in" />}
        {!showLive && !result && (
          <div className="sr-empty">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="2.5" y="4" width="19" height="13" rx="2" /><path d="M8 21h8M12 17v4" /><circle cx="12" cy="10.5" r="2.5" fill="#ef4444" stroke="none" /></svg>
            <span>Your preview appears here. Click “Start recording” and pick what to share.</span>
          </div>
        )}
        {phase === 'countdown' && <div className="sr-count" aria-live="assertive"><span key={count}>{count}</span></div>}
        {(phase === 'recording' || phase === 'paused') && <div className={`sr-hud ${phase === 'paused' ? 'paused' : ''}`}><i className="sr-dot" />{phase === 'paused' ? 'Paused' : 'REC'} {clock(elapsed())}</div>}
      </div>

      {phase === 'done' && result && (
        <div className="settle-in">
          <div className="sr-meta">
            <span className="chip good"><Check /> Recording ready</span>
            <span className="chip">{clock(result.ms)}</span>
            <span className="chip">{sizeLabel(result.size)}</span>
            <span className="chip">{extFor(result.mime).toUpperCase()}{result.mime.includes('codecs=') ? ` · ${result.mime.split('codecs=')[1]}` : ''}</span>
          </div>
          <div className="row">
            <a className="btn primary" href={result.url} download={result.name}>Download {extFor(result.mime).toUpperCase()}</a>
            <button type="button" className="btn" onClick={() => { URL.revokeObjectURL(result.url); urlRef.current = ''; setResult(null); setPhase('idle') }}>Discard</button>
          </div>
        </div>
      )}

      <p className="muted">
        Recording happens entirely in your browser: the video is kept in memory and saved only when you download it, never uploaded. Chrome, Edge and Firefox save WebM (VP9/VP8), Safari saves MP4. WebM files from browsers can lack a duration header, so some players show no length or seek slowly; VLC plays them fine, and you can convert to MP4 with any video converter. Long recordings use a lot of memory, so keep them under about 30 minutes. Phones and tablets cannot record the screen from a website.
      </p>
    </div>
  )
}
