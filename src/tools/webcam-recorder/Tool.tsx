import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import Icon from '../../components/Icon'
import { downloadBlob } from '../../audio/decode'
import { fmtBytes, fmtTime } from '../../audio/fmt'
import { describeResolution, extForVideoMime, pickVideoMimeType } from './recorder'

type Phase = 'idle' | 'live' | 'recording' | 'done'

export default function WebcamRecorder() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [mime, setMime] = useState('')
  const [resolution, setResolution] = useState('—')
  const [videoUrl, setVideoUrl] = useState('')
  const [blob, setBlob] = useState<Blob | null>(null)
  const [done, setDone] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => stopAll(), [])

  function stopAll() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function startCamera() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const settings = track?.getSettings()
      if (settings?.width && settings?.height) {
        setResolution(describeResolution(settings.width, settings.height))
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        await videoRef.current.play().catch(() => undefined)
      }
      setPhase('live')
    } catch {
      setError('Camera or microphone permission was denied. Allow access and try again.')
    }
  }

  function startRecording() {
    const stream = streamRef.current
    if (!stream) return
    const chosen = pickVideoMimeType((m) => MediaRecorder.isTypeSupported(m))
    setMime(chosen)
    chunksRef.current = []
    const recorder = new MediaRecorder(stream, chosen ? { mimeType: chosen } : undefined)
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const type = chosen || 'video/webm'
      const b = new Blob(chunksRef.current, { type })
      setBlob(b)
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(b)
      })
      setPhase('done')
    }
    recorder.start(250)
    setSeconds(0)
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    setPhase('recording')
  }

  function stopRecording() {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  function reset() {
    stopAll()
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
    setBlob(null)
    setSeconds(0)
    setDone(false)
    setPhase('idle')
  }

  const ext = extForVideoMime(mime)

  return (
    <div>
      <p className="muted">
        Record yourself with your webcam. Video stays on your device and is saved as a file the
        moment you stop.
      </p>

      <div className="panel" style={{ marginTop: 4, padding: 8, background: '#000' }}>
        <video
          ref={videoRef}
          controls={phase === 'done'}
          playsInline
          src={phase === 'done' ? videoUrl : undefined}
          style={{ width: '100%', display: 'block', borderRadius: 4, minHeight: 180, background: '#000' }}
        />
      </div>

      {error && <p className="error">{error}</p>}

      {(phase === 'live' || phase === 'recording') && (
        <div className="stats" style={{ marginTop: 12 }}>
          <div className="stat">
            <Roll>{fmtTime(seconds)}</Roll>
            <span>{phase === 'recording' ? 'Recording' : 'Ready'}</span>
          </div>
          <div className="stat">
            <Roll>{resolution}</Roll>
            <span>Resolution</span>
          </div>
          <div className="stat">
            <Roll>{(mime || 'video/webm').split(';')[0].replace('video/', '').toUpperCase()}</Roll>
            <span>Container</span>
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
        {phase === 'idle' && (
          <button className="btn primary" onClick={startCamera}>
            <Icon name="camera" size={18} /> Start camera
          </button>
        )}
        {phase === 'live' && (
          <button className="btn primary" onClick={startRecording}>
            <Icon name="video" size={18} /> Start recording
          </button>
        )}
        {phase === 'recording' && (
          <button className="btn primary" onClick={stopRecording}>
            <Icon name="stop-circle" size={18} /> Stop ({fmtTime(seconds)})
          </button>
        )}
        {phase === 'done' && blob && (
          <>
            <button className="btn" onClick={reset}>
              <Icon name="reload" size={18} /> Record again
            </button>
            <button
              className={'btn primary' + (done ? ' is-done' : '')}
              onClick={() => {
                downloadBlob(blob, `webcam-recording-${Date.now()}.${ext}`)
                setDone(true)
              }}
            >
              <Icon name="save" size={18} /> {done ? 'Saved' : `Download .${ext}`}
            </button>
          </>
        )}
      </div>

      {phase === 'done' && blob && (
        <p className="muted" style={{ marginTop: 12 }}>
          {fmtBytes(blob.size)} · {fmtTime(seconds)} · {ext.toUpperCase()}
        </p>
      )}
    </div>
  )
}
