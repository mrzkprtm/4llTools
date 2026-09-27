import { useState, useRef } from 'react'

export default function AudioWaveform() {
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<'mic' | 'file'>('mic')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [playing, setPlaying] = useState(false)
  const [timeScale, setTimeScale] = useState(1)
  const [amplitudeScale, setAmplitudeScale] = useState(1)
  const [triggerLevel, setTriggerLevel] = useState(0)
  const [triggerMode, setTriggerMode] = useState<'auto' | 'normal' | 'single'>('auto')
  const [frozen, setFrozen] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const animationRef = useRef<number>(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      streamRef.current = stream

      const ctx = getAudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)

      analyserRef.current = analyser
      sourceRef.current = source as any
      setRunning(true)
      requestAnimationFrame(draw)
    } catch (err) {
      alert('Microphone access denied')
      console.error(err)
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAudioFile(file)

    const ctx = getAudioContext()
    const reader = new FileReader()
    reader.onload = (e) => {
      ctx.decodeAudioData(e.target?.result as ArrayBuffer).then(buffer => {
        bufferRef.current = buffer
        setRunning(true)
      })
    }
    reader.readAsArrayBuffer(file)
  }

  const playFile = () => {
    if (!bufferRef.current || !running) return

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    const source = ctx.createBufferSource()
    source.buffer = bufferRef.current
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    analyser.connect(ctx.destination)

    analyserRef.current = analyser
    sourceRef.current = source
    source.start(0)
    setPlaying(true)

    source.onended = () => {
      setPlaying(false)
      if (triggerMode !== 'single') {
        source.start(0)
      }
    }

    requestAnimationFrame(draw)
  }

  const stop = () => {
    setRunning(false)
    setPlaying(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
  }

  const draw = () => {
    if (!running || !analyserRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    if (mode === 'mic') {
      analyser.getByteTimeDomainData(dataArray)
    } else {
      analyser.getByteTimeDomainData(dataArray)
    }

    const width = canvas.width
    const height = canvas.height

    ctx.clearRect(0, 0, width, height)

    // Grid
    ctx.strokeStyle = 'var(--border)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      const y = (i / 10) * height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Center line
    ctx.strokeStyle = 'var(--muted)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()
    ctx.setLineDash([])

    // Trigger line
    if (triggerLevel !== 0) {
      const y = height / 2 - triggerLevel * height / 2
      ctx.strokeStyle = 'var(--accent)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Waveform
    const bufferLen = 2048 // analyser.fftSize
    const waveData = new Uint8Array(2048)
    analyser.getByteTimeDomainData(waveData)

    const samplesPerPixel = Math.max(1, Math.floor(bufferLen / (width * timeScale)))
    ctx.strokeStyle = 'var(--accent)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()

    for (let i = 0; i < bufferLen; i += samplesPerPixel) {
      let sum = 0
      for (let j = 0; j < samplesPerPixel && i + j < bufferLen; j++) {
        sum += waveData[i + j] - 128
      }
      const avg = sum / Math.min(samplesPerPixel, bufferLen - i)
      const v = (avg / 128) * amplitudeScale
      const x = (i / bufferLen) * width
      const y = height / 2 - v * height / 2

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Trigger detection for single mode
    if (triggerMode === 'single' && !frozen) {
      let triggered = false
      for (let i = 1; i < bufferLen; i++) {
        const prev = dataArray[i - 1] - 128
        const curr = dataArray[i] - 128
        const triggerVal = triggerLevel * 128
        if ((triggerLevel >= 0 && prev <= triggerVal && curr > triggerVal) ||
            (triggerLevel < 0 && prev >= triggerVal && curr < triggerVal)) {
          triggered = true
          break
        }
      }
      if (triggered) {
        setFrozen(true)
      }
    }

    animationRef.current = requestAnimationFrame(draw)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e)
    setMode('file')
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Audio Waveform Visualizer</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => { if (mode === 'mic') startMic(); else if (audioFile) playFile() }} disabled={running && (mode === 'mic' || playing)} style={{ padding: '10px 20px', fontSize: '1rem', background: running && (mode === 'mic' || playing) ? 'var(--danger)' : 'var(--ok)' }}>
            {(running && mode === 'mic') || playing ? 'Stop' : 'Start'}
          </button>
          <button className="btn" onClick={stop} disabled={!running}>Reset</button>
          <button className="btn" onClick={() => setFrozen(f => !f)} disabled={!running} style={{ background: frozen ? 'var(--accent)' : 'var(--bg)' }}>
            {frozen ? 'Unfreeze' : 'Freeze'}
          </button>
        </div>

        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="radio" name="mode" value="mic" checked={mode === 'mic'} onChange={() => { setMode('mic'); stop() }} />
            <span>Microphone</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="radio" name="mode" value="file" checked={mode === 'file'} onChange={() => setMode('file')} />
            <span>Audio File</span>
          </label>
          {mode === 'file' && (
            <input type="file" accept="audio/*" onChange={handleFileChange} style={{ display: 'none' }} id="audioFile" />
          )}
          {mode === 'file' && !running && !audioFile && (
            <label htmlFor="audioFile" className="btn">Select File</label>
          )}
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Time Scale (ms/div)</span>
              <span>{(20 / timeScale).toFixed(1)}</span>
            </div>
            <input type="range" min={0.1} max={10} step={0.1} value={timeScale} onChange={e => setTimeScale(Number(e.target.value))} />
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Amplitude Scale</span>
              <span>{amplitudeScale.toFixed(1)}×</span>
            </div>
            <input type="range" min={0.1} max={5} step={0.1} value={amplitudeScale} onChange={e => setAmplitudeScale(Number(e.target.value))} />
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span>Trigger Level</span>
              <span>{triggerLevel >= 0 ? '+' : ''}{triggerLevel.toFixed(2)}</span>
            </div>
            <input type="range" min={-1} max={1} step={0.02} value={triggerLevel} onChange={e => setTriggerLevel(Number(e.target.value))} />
          </label>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span className="muted" style={{ fontSize: '0.75rem' }}>Trigger Mode</span>
          <select value={triggerMode} onChange={e => setTriggerMode(e.target.value as any)} style={{ padding: '8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)' }}>
            <option value="auto">Auto</option>
            <option value="normal">Normal</option>
            <option value="single">Single</option>
          </select>
        </label>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          style={{ width: '100%', height: 'auto', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', display: 'block' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          <span>0 V</span>
          <span>Time →</span>
          <span>+1 V</span>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        <div className="pop-row" style={{ flex: 1, minWidth: 200, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Measurements</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Status</span>
              <span>{frozen ? 'Frozen' : running ? 'Running' : 'Stopped'}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Mode</span>
              <span>{mode === 'mic' ? 'Microphone' : 'Audio File'}</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Time Scale</span>
              <span>{(20 / timeScale).toFixed(1)} ms/div</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Amplitude Scale</span>
              <span>{amplitudeScale.toFixed(1)}×</span>
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted">Trigger</span>
              <span>{triggerMode} @ {triggerLevel >= 0 ? '+' : ''}{triggerLevel.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="pop-row" style={{ flex: 1, minWidth: 200, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Keyboard Shortcuts</h4>
          <div style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><kbd>Space</kbd><span>Start/Stop</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><kbd>F</kbd><span>Freeze/Unfreeze</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><kbd>←/→</kbd><span>Time Scale</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><kbd>↑/↓</kbd><span>Amplitude Scale</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><kbd>T</kbd><span>Trigger Level</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}><kbd>R</kbd><span>Reset View</span></div>
          </div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Real-time oscilloscope. Microphone mode shows live input. File mode plays audio files with loop. Freeze to capture waveform. Trigger modes: Auto (continuous), Normal (wait for trigger), Single (capture once).
      </p>
    </div>
  )
}