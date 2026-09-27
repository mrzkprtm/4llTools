import { useState, useEffect, useRef, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

function freqToNote(freq: number): { note: string; cents: number; octave: number } {
  if (freq <= 0) return { note: '', cents: 0, octave: 0 }
  const midi = 69 + 12 * Math.log2(freq / 440)
  const rounded = Math.round(midi)
  const cents = Math.round((midi - rounded) * 100)
  const noteIndex = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  return { note: NOTE_NAMES[noteIndex], cents, octave }
}

const NOTE_FREQS: Record<string, number> = {}
for (let o = 0; o <= 8; o++) {
  for (let i = 0; i < 12; i++) {
    const midi = (o + 1) * 12 + i
    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    const name = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][i] + o
    NOTE_FREQS[name] = freq
  }
}

export default function FrequencyAnalyzer() {
  const [running, setRunning] = useState(false)
  const [spectrumData, setSpectrumData] = useState<Uint8Array | null>(null)
  const [peakFreq, setPeakFreq] = useState(0)
  const [peakNote, setPeakNote] = useState('')
  const [peakCents, setPeakCents] = useState(0)
  const [peakDb, setPeakDb] = useState(-Infinity)
  const [smoothing, setSmoothing] = useState(0.8)
  const [fftSize, setFftSize] = useState(2048)
  const [scale, setScale] = useState<'linear' | 'log' | 'mel'>('log')
  const [minDb, setMinDb] = useState(-100)
  const [maxDb, setMaxDb] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number>()

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const startAnalyzer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      streamRef.current = stream

      const ctx = getAudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = fftSize
      analyser.smoothingTimeConstant = smoothing
      source.connect(analyser)

      analyserRef.current = analyser
      setRunning(true)
      requestAnimationFrame(analyze)
    } catch (err) {
      alert('Microphone access denied or not available')
      console.error(err)
    }
  }

  const stopAnalyzer = () => {
    setRunning(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
  }

  const analyze = () => {
    if (!running || !analyserRef.current) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)
    setSpectrumData(dataArray)

    // Find peak
    let maxVal = -1
    let maxIndex = -1
    for (let i = 0; i < bufferLength; i++) {
      if (dataArray[i] > maxVal) {
        maxVal = dataArray[i]
        maxIndex = i
      }
    }

    if (maxIndex >= 0) {
      const sampleRate = audioContextRef.current?.sampleRate || 44100
      const freq = maxIndex * sampleRate / fftSize
      const note = freqToNote(freq)
      const exactFreq = maxIndex * sampleRate / fftSize
      const targetFreq = 440 * Math.pow(2, (Math.round(69 + 12 * Math.log2(exactFreq / 440)) - 69) / 12)
      const cents = Math.round(1200 * Math.log2(exactFreq / targetFreq))

      setPeakFreq(freq)
      setPeakNote(`${NOTE_NAMES[((Math.round(69 + 12 * Math.log2(exactFreq / 440)) % 12) + 12) % 12]}${Math.floor((Math.round(69 + 12 * Math.log2(exactFreq / 440))) / 12) - 1}`)
      setPeakCents(cents)
      setPeakDb(maxVal - 128)
    }

    animationRef.current = requestAnimationFrame(analyze)
  }

  useEffect(() => {
    if (analyserRef.current) {
      analyserRef.current.smoothingTimeConstant = smoothing
    }
  }, [smoothing])

  useEffect(() => {
    if (running && analyserRef.current) {
      analyserRef.current.fftSize = fftSize
    }
  }, [fftSize, running])

  const notesWithFreqs = useMemo(() => {
    const arr: { name: string; freq: number }[] = []
    for (let o = 1; o <= 7; o++) {
      for (let i = 0; i < 12; i++) {
        const name = NOTE_NAMES[i] + o
        const midi = (o + 1) * 12 + i
        arr.push({ name, freq: 440 * Math.pow(2, (midi - 69) / 12) })
      }
    }
    return arr
  }, [])

  const noteMarkers = useMemo(() => {
    const markers: { freq: number; name: string; freqLog: number }[] = []
    const sampleRate = audioContextRef.current?.sampleRate || 44100
    const nyquist = sampleRate / 2

    for (const { name, freq } of notesWithFreqs) {
      if (freq > nyquist) break
      const freqLog = fftSize > 0 ? freq / nyquist : 0
      if (freqLog > 0 && freqLog <= 1) {
        markers.push({ freq, name, freqLog })
      }
    }
    return markers
  }, [fftSize])

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Frequency Analyzer</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={running ? stopAnalyzer : startAnalyzer} style={{ padding: '12px 24px', fontSize: '1.1rem', background: running ? 'var(--danger)' : 'var(--ok)' }}>
            {running ? 'Stop' : 'Start Analyzer'}
          </button>
        </div>
        <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>FFT Size</span>
            <select value={fftSize} onChange={e => setFftSize(Number(e.target.value))} style={{ width: 100 }}>
              <option value={512}>512</option>
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
              <option value={8192}>8192</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Smoothing</span>
            <input type="range" min={0} max={1} step={0.05} value={smoothing} onChange={e => setSmoothing(Number(e.target.value))} style={{ width: 120 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Scale</span>
            <select value={scale} onChange={e => setScale(e.target.value as any)} style={{ width: 100 }}>
              <option value="linear">Linear</option>
              <option value="log">Logarithmic</option>
              <option value="mel">Mel</option>
            </select>
          </label>
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="stat"><b><Roll value={peakFreq.toFixed(1)} /></b><span className="muted">Peak Freq (Hz)</span></div>
        <div className="stat"><b style={{ color: 'var(--accent)' }}>{peakNote}</b><span className="muted">Peak Note</span></div>
        <div className="stat"><b style={{ color: Math.abs(peakCents) < 5 ? 'var(--ok)' : 'var(--danger)' }}>{peakCents > 0 ? '+' : ''}{peakCents}¢</b><span className="muted">Cents</span></div>
        <div className="stat"><b>{peakDb.toFixed(1)}</b><span className="muted">Peak Level (dBFS)</span></div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>Spectrum</h4>
        <div style={{ position: 'relative', height: 300, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <svg width="100%" height="100%" viewBox="0 0 800 300" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spectrumGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="var(--ok)" />
                <stop offset="50%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--danger)" />
              </linearGradient>
            </defs>
            {spectrumData && (
              <g>
                <polyline
                  fill="none"
                  stroke="url(#spectrumGrad)"
                  strokeWidth="1.5"
                  points={Array.from(spectrumData).map((val, i) => {
                    const x = (i / spectrumData.length) * 800
                    const normalized = (val - (minDb + 128)) / (maxDb - minDb + 128)
                    const y = 300 - Math.max(0, Math.min(1, normalized)) * 300
                    return `${x},${y}`
                  }).join(' ')}
                />
              </g>
            )}
            {noteMarkers.map((marker, i) => {
              const x = marker.freqLog * 800
              if (x < 0 || x > 800) return null
              return (
                <g key={i}>
                  <line x1={x} y1={0} x2={x} y2={300} stroke="var(--muted)" strokeWidth="0.5" strokeDasharray="4,4" opacity="0.5" />
                  <text x={x + 2} y={12} fontSize="8" fill="var(--muted)" fontFamily="monospace">{marker.name}</text>
                </g>
              )
            })}
            <line x1="0" y1={300 - 128 * 300 / 255} x2={800} y2={300 - 128 * 300 / 255} stroke="var(--border)" strokeWidth="1" />
          </svg>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
            <span>0 Hz</span>
            <span>{(audioContextRef.current?.sampleRate || 44100) / 2} Hz</span>
          </div>
        </div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 12px' }}>Note Frequencies Reference</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'A2', 'A3', 'A4', 'A5', 'A6'].map(note => (
            <div key={note} style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{note}</div>
              <div className="muted" style={{ fontSize: '0.75rem' }}>{NOTE_FREQS[note]?.toFixed(1) || '—'} Hz</div>
            </div>
          ))}
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Real-time FFT spectrum analyzer. Shows frequency spectrum with note markers. Peak detection with note name and cents deviation.
      </p>
    </div>
  )
}