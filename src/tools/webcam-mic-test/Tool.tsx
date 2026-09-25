import { useEffect, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import Check from '../../motion/Check'
import { audioConstraints, dbToMeter, describeMediaError, describeVideo, levelToDb, QUALITIES, resolutionName, rms, videoConstraints, type Quality } from './media'
import './tool.css'

const BARS = 24

function stopStream(s: MediaStream | null) {
  s?.getTracks().forEach((t) => t.stop())
}

async function listDevices(kind: MediaDeviceKind): Promise<MediaDeviceInfo[]> {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === kind)
  } catch {
    return []
  }
}

function Camera() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [quality, setQuality] = useState<Quality>('hd')
  const [mirror, setMirror] = useState(true)
  const [info, setInfo] = useState('')
  const [shot, setShot] = useState('')
  const [flash, setFlash] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const current = useRef<MediaStream | null>(null)

  useEffect(() => () => stopStream(current.current), [])

  async function start(id = deviceId, q = quality) {
    setBusy(true)
    setError('')
    stopStream(current.current)
    try {
      const s = await navigator.mediaDevices.getUserMedia(videoConstraints(id, q))
      current.current = s
      setStream(s)
      if (video.current) video.current.srcObject = s
      const track = s.getVideoTracks()[0]
      const settings = track.getSettings()
      setInfo(`${describeVideo(settings)}${resolutionName(settings.width, settings.height) ? ` (${resolutionName(settings.width, settings.height)})` : ''}`)
      setDevices(await listDevices('videoinput'))
      if (!id && settings.deviceId) setDeviceId(settings.deviceId)
      track.addEventListener('ended', () => { setStream(null); setError('The camera was disconnected or turned off.') })
    } catch (err) {
      current.current = null
      setStream(null)
      setError(describeMediaError(err, 'camera'))
    } finally {
      setBusy(false)
    }
  }

  function stop() {
    stopStream(current.current)
    current.current = null
    setStream(null)
    if (video.current) video.current.srcObject = null
  }

  function snapshot() {
    const v = video.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')!
    if (mirror) {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0)
    setShot(c.toDataURL('image/png'))
    setFlash((f) => f + 1)
  }

  return (
    <section className="wb-sec" aria-labelledby="wb-cam-h">
      <h2 id="wb-cam-h"><i className={`wb-state ${stream ? 'on' : ''}`} aria-hidden="true" />Webcam</h2>
      <div className="wb-controls">
        <div>
          <label htmlFor="wb-cam">Camera</label>
          <select id="wb-cam" value={deviceId} onChange={(e) => { setDeviceId(e.target.value); if (stream) void start(e.target.value) }} disabled={!devices.length}>
            {!devices.length && <option value="">Start the camera to list devices</option>}
            {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="wb-q">Requested quality</label>
          <select id="wb-q" value={quality} onChange={(e) => { const q = e.target.value as Quality; setQuality(q); if (stream) void start(deviceId, q) }}>
            {(Object.keys(QUALITIES) as Quality[]).map((q) => <option key={q} value={q}>{QUALITIES[q].label}</option>)}
          </select>
        </div>
      </div>
      <div className="row">
        {stream ? <button type="button" className="btn" onClick={stop}>Stop camera</button> : <button type="button" className="btn primary" onClick={() => void start()} disabled={busy}>{busy ? 'Starting…' : 'Start camera'}</button>}
        <button type="button" className="btn" onClick={snapshot} disabled={!stream}>Take snapshot</button>
        <label style={{ display: 'flex', gap: 6, fontWeight: 500 }}><input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> Mirror</label>
      </div>
      {busy && <Busy label="Waiting for camera permission…" />}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="wb-video">
        <video ref={video} autoPlay muted playsInline className={mirror ? 'mirror' : ''} style={{ display: stream ? 'block' : 'none' }} />
        {!stream && <span className="wb-empty">Camera is off. Press “Start camera” and allow access when the browser asks.</span>}
        {flash > 0 && <i key={flash} className="wb-flash" />}
      </div>
      {stream && info && <p style={{ margin: '10px 0 0' }}><span className="chip good" key={info}><Check /> Camera works: {info}</span></p>}
      {shot && (
        <div className="wb-shot">
          <img key={flash} src={shot} alt="Snapshot from your webcam" />
          <a className="btn" href={shot} download={`webcam-snapshot-${Date.now()}.png`}>Download PNG</a>
        </div>
      )}
    </section>
  )
}

function Microphone() {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<{ text: string; tone: string }>({ text: '', tone: '' })
  const [recording, setRecording] = useState(false)
  const [recProgress, setRecProgress] = useState(0)
  const [clip, setClip] = useState('')
  const stream = useRef<MediaStream | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const raf = useRef(0)
  const bars = useRef<HTMLDivElement>(null)
  const level = useRef<HTMLElement>(null)
  const peakEl = useRef<HTMLElement>(null)
  const dbEl = useRef<HTMLSpanElement>(null)
  const clipUrl = useRef('')

  useEffect(() => () => { teardown(); if (clipUrl.current) URL.revokeObjectURL(clipUrl.current) }, [])

  function teardown() {
    cancelAnimationFrame(raf.current)
    stopStream(stream.current)
    stream.current = null
    void ctx.current?.close().catch(() => undefined)
    ctx.current = null
  }

  async function start(id = deviceId, proc = processing) {
    setBusy(true)
    setError('')
    teardown()
    try {
      const s = await navigator.mediaDevices.getUserMedia(audioConstraints(id, proc))
      stream.current = s
      const ac = new AudioContext()
      ctx.current = ac
      const analyser = ac.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.6
      ac.createMediaStreamSource(s).connect(analyser)
      const time = new Float32Array(analyser.fftSize)
      const freq = new Uint8Array(analyser.frequencyBinCount)
      let peak = -100
      let peakAt = 0
      let lastStatus = 0
      let loudest = -100
      const loop = (t: number) => {
        analyser.getFloatTimeDomainData(time)
        analyser.getByteFrequencyData(freq)
        const db = levelToDb(rms(time))
        loudest = Math.max(loudest, db)
        if (db > peak || t - peakAt > 1200) { peak = db; peakAt = t }
        if (level.current) level.current.style.transform = `scaleX(${dbToMeter(db)})`
        if (peakEl.current) peakEl.current.style.transform = `translateX(${dbToMeter(peak) * (peakEl.current.parentElement?.clientWidth ?? 0)}px)`
        if (dbEl.current) dbEl.current.textContent = `${db <= -99 ? '−∞' : db.toFixed(0)} dBFS`
        const kids = bars.current?.children
        if (kids) {
          // Log-spaced bands up to ~8 kHz so speech fills the meter.
          const top = Math.min(freq.length, Math.floor((8000 / (ac.sampleRate / 2)) * freq.length))
          for (let i = 0; i < kids.length; i++) {
            const a = Math.floor(Math.pow(top, i / BARS))
            const b = Math.max(a + 1, Math.floor(Math.pow(top, (i + 1) / BARS)))
            let m = 0
            for (let j = a; j < b && j < freq.length; j++) m = Math.max(m, freq[j])
            ;(kids[i] as HTMLElement).style.transform = `scaleY(${Math.max(0.02, m / 255)})`
          }
        }
        if (t - lastStatus > 600) {
          lastStatus = t
          const l = loudest
          loudest = -100
          setStatus(l > -1 ? { text: 'Too loud: clipping, move back or lower input gain', tone: 'bad' } : l > -45 ? { text: 'Microphone works: sound detected', tone: 'good' } : l > -75 ? { text: 'Very quiet: speak up or move closer', tone: '' } : { text: 'Silence: say something', tone: '' })
        }
        raf.current = requestAnimationFrame(loop)
      }
      raf.current = requestAnimationFrame(loop)
      setOn(true)
      setDevices(await listDevices('audioinput'))
      const sid = s.getAudioTracks()[0]?.getSettings().deviceId
      if (!id && sid) setDeviceId(sid)
    } catch (err) {
      setOn(false)
      setError(describeMediaError(err, 'microphone'))
    } finally {
      setBusy(false)
    }
  }

  function stop() {
    teardown()
    setOn(false)
    setStatus({ text: '', tone: '' })
    if (level.current) level.current.style.transform = 'scaleX(0)'
  }

  function record() {
    const s = stream.current
    if (!s || typeof MediaRecorder === 'undefined') return setError('This browser cannot record audio (MediaRecorder is missing).')
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t))
    const r = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s)
    const parts: Blob[] = []
    r.ondataavailable = (e) => { if (e.data.size) parts.push(e.data) }
    r.onstop = () => {
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current)
      clipUrl.current = URL.createObjectURL(new Blob(parts, { type: (r.mimeType || 'audio/webm').split(';')[0] }))
      setClip(clipUrl.current)
      setRecording(false)
    }
    r.start()
    setRecording(true)
    setClip('')
    const t0 = Date.now()
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / 5000)
      setRecProgress(p)
      if (p < 1 && r.state === 'recording') setTimeout(tick, 100)
      else if (r.state === 'recording') r.stop()
    }
    tick()
  }

  return (
    <section className="wb-sec" aria-labelledby="wb-mic-h">
      <h2 id="wb-mic-h"><i className={`wb-state ${on ? 'on' : ''}`} aria-hidden="true" />Microphone</h2>
      <div className="wb-controls">
        <div>
          <label htmlFor="wb-mic">Microphone</label>
          <select id="wb-mic" value={deviceId} onChange={(e) => { setDeviceId(e.target.value); if (on) void start(e.target.value) }} disabled={!devices.length}>
            {!devices.length && <option value="">Start the mic to list devices</option>}
            {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', gap: 8, fontWeight: 500, alignItems: 'center', alignSelf: 'end', margin: '12px 0 10px' }}>
          <input type="checkbox" checked={processing} onChange={(e) => { setProcessing(e.target.checked); if (on) void start(deviceId, e.target.checked) }} />
          Noise suppression &amp; auto gain (as in calls)
        </label>
      </div>
      <div className="row">
        {on ? <button type="button" className="btn" onClick={stop}>Stop mic</button> : <button type="button" className="btn primary" onClick={() => void start()} disabled={busy}>{busy ? 'Starting…' : 'Start microphone'}</button>}
        <button type="button" className="btn" onClick={record} disabled={!on || recording}>{recording ? `Recording… ${Math.ceil(5 - recProgress * 5)}s` : 'Record 5 seconds'}</button>
        <span ref={dbEl} className="wb-db muted" aria-hidden="true">{on ? '' : '— dBFS'}</span>
      </div>
      {busy && <Busy label="Waiting for microphone permission…" />}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="wb-meter" ref={bars} aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => <i key={i} />)}
      </div>
      <div className="wb-level" role="img" aria-label="Input level meter"><i ref={level} /><b ref={peakEl} /></div>
      {recording && <div className="bar busy-bar" style={{ marginTop: 10 }} role="progressbar" aria-label="Recording" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(recProgress * 100)}><i style={{ transform: `scaleX(${recProgress})` }} /></div>}
      {on && status.text && <p role="status" style={{ margin: '10px 0 0' }}><span key={status.text} className={`chip ${status.tone} calm`}>{status.tone === 'good' && <Check />}{status.text}</span></p>}
      {clip && (
        <div className="settle-in" style={{ marginTop: 12 }}>
          <label htmlFor="wb-clip" style={{ marginTop: 0 }}>Your recording (listen with headphones to hear how you sound)</label>
          <audio id="wb-clip" src={clip} controls autoPlay style={{ width: '100%' }} />
        </div>
      )}
    </section>
  )
}

function Speakers() {
  const [playing, setPlaying] = useState<'left' | 'right' | 'both' | null>(null)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  function play(side: 'left' | 'right' | 'both') {
    try {
      const ac = new AudioContext()
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      const pan = ac.createStereoPanner()
      osc.frequency.value = side === 'both' ? 523.25 : 440
      pan.pan.value = side === 'left' ? -1 : side === 'right' ? 1 : 0
      osc.connect(gain).connect(pan).connect(ac.destination)
      const t = ac.currentTime
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.05)
      gain.gain.setValueAtTime(0.3, t + 1.1)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
      osc.start(t)
      osc.stop(t + 1.45)
      osc.onended = () => void ac.close()
      setPlaying(side)
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setPlaying(null), 1400)
    } catch {
      setPlaying(null)
    }
  }

  const Spk = ({ flip }: { flip?: boolean }) => (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M4 9h3l5-4v14l-5-4H4z" fill="var(--accent-soft)" />
      <path className="wb-wave" d="M16 9.5a3.5 3.5 0 0 1 0 5" />
      <path className="wb-wave" d="M18.5 7a7 7 0 0 1 0 10" style={{ animationDelay: '0.15s' }} />
    </svg>
  )

  return (
    <section className="wb-sec" aria-labelledby="wb-spk-h">
      <h2 id="wb-spk-h"><i className={`wb-state ${playing ? 'on' : ''}`} aria-hidden="true" />Speakers &amp; headphones</h2>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.88rem' }}>Plays a short tone in one channel at a time. If you hear “left” from the right side, your headphones are on backwards.</p>
      <div className="wb-speakers">
        <button type="button" className={`btn wb-spk ${playing === 'left' ? 'playing' : ''}`} onClick={() => play('left')}><Spk flip />Left</button>
        <button type="button" className={`btn wb-spk ${playing === 'both' ? 'playing' : ''}`} onClick={() => play('both')}><Spk />Both</button>
        <button type="button" className={`btn wb-spk ${playing === 'right' ? 'playing' : ''}`} onClick={() => play('right')}><Spk />Right</button>
      </div>
    </section>
  )
}

export default function WebcamMicTest() {
  const [problem, setProblem] = useState('')
  useEffect(() => {
    if (!window.isSecureContext) setProblem('This page is not on a secure (https) connection, so the browser will not allow the camera or microphone. Open it over https.')
    else if (!navigator.mediaDevices?.getUserMedia) setProblem('This browser does not support camera and microphone access (getUserMedia). Try a recent Chrome, Edge, Firefox or Safari.')
  }, [])

  return (
    <div>
      {problem && <p className="error" role="alert">{problem}</p>}
      <Camera />
      <Microphone />
      <Speakers />
      <p className="muted">
        Check your setup before a Zoom, Google Meet or Teams call. Video and sound are processed only on your device and never recorded or uploaded, except the 5-second clip, which stays in this tab until you leave. If access was blocked, click the camera or lock icon in the address bar to allow it; on macOS also check System Settings → Privacy &amp; Security → Camera / Microphone. Only one app can use a camera at a time on some systems, so close other video apps first.
      </p>
    </div>
  )
}
