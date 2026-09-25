import { useCallback, useEffect, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { reducedMotion } from '../../motion/springs'
import { cameraErrorMessage, decodeFrom, decodeWithBox, isHttpUrl } from './decode'

export default function QrReader() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)

  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraId, setCameraId] = useState('')
  // The frame's position (percent insets) while it locks onto a found code.
  const [lock, setLock] = useState<{ top: number; right: number; bottom: number; left: number } | null>(null)
  const lockTimer = useRef(0)

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setScanning(false)
    setLock(null)
  }, [])

  useEffect(() => () => { clearTimeout(lockTimer.current); stop() }, [stop])

  const scanLoop = useCallback(() => {
    const video = videoRef.current
    if (!video || !streamRef.current) return
    if (video.readyState >= video.HAVE_ENOUGH_DATA) {
      const found = decodeWithBox(video, video.videoWidth, video.videoHeight, canvasRef.current)
      if (found) {
        navigator.vibrate?.(80)
        const done = () => {
          setResult(found.data)
          stop()
        }
        if (reducedMotion()) return done()
        // Freeze the frame and fly the corners onto the code before showing the result.
        video.pause()
        const size = video.clientWidth
        const scale = Math.max(size / video.videoWidth, size / video.videoHeight)
        const offX = (size - video.videoWidth * scale) / 2
        const offY = (size - video.videoHeight * scale) / 2
        const pct = (v: number, len: number, off: number) => Math.min(100, Math.max(0, ((v * len * scale + off) / size) * 100))
        const pad = 2
        setLock({
          left: pct(found.box.left, video.videoWidth, offX) - pad,
          top: pct(found.box.top, video.videoHeight, offY) - pad,
          right: 100 - pct(found.box.right, video.videoWidth, offX) - pad,
          bottom: 100 - pct(found.box.bottom, video.videoHeight, offY) - pad,
        })
        lockTimer.current = window.setTimeout(done, 650)
        return
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop)
  }, [stop])

  async function start(deviceId = cameraId) {
    setError('')
    setResult('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot use the camera here. The camera only works on https:// pages. You can still read a QR code from an image below.')
      return
    }
    stop()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setScanning(true)
      const devices = await navigator.mediaDevices.enumerateDevices()
      setCameras(devices.filter((d) => d.kind === 'videoinput'))
      setCameraId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId)
      rafRef.current = requestAnimationFrame(scanLoop)
    } catch (err) {
      stop()
      setError(cameraErrorMessage(err))
    }
  }

  async function readFile(file: File) {
    setError('')
    setResult('')
    try {
      const bitmap = await createImageBitmap(file)
      const text = decodeFrom(bitmap, bitmap.width, bitmap.height, canvasRef.current, true)
      bitmap.close()
      if (text === null) setError('No QR code was found in that image. Try a sharper or closer photo.')
      else setResult(text)
    } catch {
      setError('That file could not be opened as an image.')
    }
  }

  return (
    <div>
      <div className="video-wrap" hidden={!scanning}>
        <video ref={videoRef} playsInline muted />
        <div className={`frame ${lock ? 'locked' : ''}`} style={lock ? { inset: `${lock.top}% ${lock.right}% ${lock.bottom}% ${lock.left}%` } : undefined}>
          <i /><i /><i /><i />
        </div>
      </div>

      <div className="row">
        {scanning ? (
          <button type="button" className="btn" onClick={stop}>
            Stop camera
          </button>
        ) : (
          <button type="button" className={`btn primary ${result ? '' : 'breathe'}`} onClick={() => start()}>
            {result ? 'Scan again' : 'Start camera'}
          </button>
        )}
        {scanning && cameras.length > 1 && (
          <select
            aria-label="Camera"
            value={cameraId}
            onChange={(e) => {
              setCameraId(e.target.value)
              start(e.target.value)
            }}
            style={{ width: 'auto' }}
          >
            {cameras.map((c, i) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        {scanning && <span className="muted">Point the camera at a QR code…</span>}
      </div>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="qr-result">
          <label>Result</label>
          <div className="output">{result}</div>
          <div className="row pop-row">
            <CopyButton text={result} />
            {isHttpUrl(result) && (
              <a className="btn primary" href={result.trim()} target="_blank" rel="noopener noreferrer">
                Open link
              </a>
            )}
          </div>
        </div>
      )}

      <label htmlFor="qr-file">Or read from an image</label>
      <input
        id="qr-file"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
