import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const INSTRUMENT_STRINGS = {
  'Guitar (EADGBE)': ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  'Bass (EADG)': ['E1', 'A1', 'D2', 'G2'],
  'Ukulele (GCEA)': ['G4', 'C4', 'E4', 'A4'],
  'Violin (GDAE)': ['G3', 'D4', 'A4', 'E5'],
  'Cello (CGDA)': ['C2', 'G2', 'D3', 'A3'],
  'Mandolin (GDAE)': ['G3', 'D4', 'A4', 'E5'],
  'Banjo (GDGBD)': ['G4', 'D3', 'G3', 'B3', 'D4'],
}

const NOTE_TO_FREQ: Record<string, number> = {}
const generateFrequencies = () => {
  for (let octave = 0; octave <= 8; octave++) {
    for (let i = 0; i < 12; i++) {
      const midi = (octave + 1) * 12 + i
      const freq = 440 * Math.pow(2, (midi - 69) / 12)
      const name = NOTE_NAMES[i] + octave
      NOTE_TO_FREQ[name] = freq
    }
  }
}
generateFrequencies()

function freqToNote(freq: number): { note: string; cents: number; freq: number } {
  if (freq <= 0) return { note: '', cents: 0, freq: 0 }
  const midi = 69 + 12 * Math.log2(freq / 440)
  const rounded = Math.round(midi)
  const cents = Math.round((midi - rounded) * 100)
  const noteIndex = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  const note = NOTE_NAMES[noteIndex] + octave
  return { note, cents, freq: 440 * Math.pow(2, (rounded - 69) / 12) }
}

export default function Tuner() {
  const [running, setRunning] = useState(false)
  const [detectedNote, setDetectedNote] = useState('')
  const [cents, setCents] = useState(0)
  const [frequency, setFrequency] = useState(0)
  const [volume, setVolume] = useState(0)
  const [referencePitch, setReferencePitch] = useState(440)
  const [instrument, setInstrument] = useState('Guitar (EADGBE)')
  const [useFlats, setUseFlats] = useState(false)
  const [targetString, setTargetString] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number>()
  const dataArrayRef = useRef<Uint8Array>()

  const strings = INSTRUMENT_STRINGS[instrument as keyof typeof INSTRUMENT_STRINGS]
  const targetNote = strings[targetString]

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const startTuner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      streamRef.current = stream

      const ctx = getAudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)

      analyserRef.current = analyser
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)

      setRunning(true)
      requestAnimationFrame(detectPitch)
    } catch (err) {
      alert('Microphone access denied or not available')
      console.error(err)
    }
  }

  const stopTuner = () => {
    setRunning(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    setDetectedNote('')
    setCents(0)
    setFrequency(0)
    setVolume(0)
  }

  const detectPitch = () => {
    if (!running || !analyserRef.current) return

    const analyser = analyserRef.current
    const data = dataArrayRef.current!
    analyser.getByteTimeDomainData(data)

    // Autocorrelation for pitch detection
    let bestOffset = -1
    let bestCorrelation = 0
    const bufferSize = data.length

    for (let offset = 10; offset < bufferSize / 2; offset++) {
      let correlation = 0
      for (let i = 0; i < bufferSize - offset; i++) {
        correlation += (data[i] - 128) * (data[i + offset] - 128)
      }
      correlation = correlation / (bufferSize - offset)
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestOffset = offset
      }
    }

    if (bestCorrelation > 0.01 && bestOffset > 0) {
      const sampleRate = audioContextRef.current!.sampleRate
      const freq = sampleRate / bestOffset
      const result = freqToNote(freq)

      if (freq > 50 && freq < 2000 && bestCorrelation > 0.1) {
        setFrequency(freq)
        setDetectedNote(result.note)
        setCents(result.cents)
        setVolume(bestCorrelation * 100)
      }
    } else {
      setVolume(0)
    }

    animationRef.current = requestAnimationFrame(detectPitch)
  }

  const playReference = (noteName: string) => {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const freq = NOTE_TO_FREQ[noteName]
    if (!freq) return

    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.value = 0.1
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2)

    osc.start()
    osc.stop(ctx.currentTime + 2)
  }

  const getTargetCents = () => {
    if (!detectedNote || !targetNote) return 0
    const targetFreq = NOTE_TO_FREQ[targetNote]
    if (!targetFreq) return 0
    const currentFreq = frequency
    return Math.round(1200 * Math.log2(currentFreq / targetFreq))
  }

  const targetCents = getTargetCents()

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Instrument Tuner</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Reference Pitch (A4)</span>
            <input type="number" min={415} max={460} value={referencePitch} onChange={e => setReferencePitch(Number(e.target.value))} style={{ width: 100 }} />
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Instrument</span>
            <select value={instrument} onChange={e => { setInstrument(e.target.value); setTargetString(0) }}>
              {Object.keys(INSTRUMENT_STRINGS).map(inst => <option key={inst} value={inst}>{inst}</option>)}
            </select>
          </label>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={useFlats} onChange={e => setUseFlats(e.target.checked)} />
          <span>Flats (♭)</span>
        </label>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {strings.map((str, i) => (
          <button
            key={i}
            className="btn"
            onClick={() => { setTargetString(i); playReference(str) }}
            style={{
              flex: 1, minWidth: 80, padding: '16px 12px', fontSize: '1.1rem', fontWeight: 600,
              background: i === targetString ? 'var(--accent)' : 'var(--bg)',
              color: i === targetString ? 'white' : 'var(--text)',
              border: i === targetString ? '2px solid var(--accent)' : '1px solid var(--border)',
            }}
          >
            {str}
          </button>
        ))}
      </div>

      <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        {!running ? (
          <div>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎤</div>
            <h3 style={{ margin: '0 0 8px' }}>Click "Start Tuner" to begin</h3>
            <p className="muted">Allow microphone access. Works best in quiet environment.</p>
            <button className="btn" onClick={startTuner} style={{ marginTop: 16, padding: '16px 32px', fontSize: '1.2rem' }}>
              Start Tuner
            </button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div className="muted" style={{ fontSize: '0.8rem', marginBottom: 8 }}>Target: {targetNote}</div>
              <button className="btn" onClick={() => playReference(targetNote)} style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Play Reference Tone</button>
            </div>

            <div style={{ fontSize: '4rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)', marginBottom: 8 }}>
              {detectedNote || '—'}
            </div>
            <div style={{ fontSize: '1.5rem', fontFamily: 'var(--mono)', color: 'var(--muted)', marginBottom: 16 }}>
              {frequency > 0 ? frequency.toFixed(1) + ' Hz' : '—'}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ height: 12, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: `calc(50% + ${Math.max(-50, Math.min(50, cents / 2))}%)`,
                    width: '4px', background: Math.abs(cents) < 5 ? 'var(--ok)' : Math.abs(cents) < 15 ? 'var(--accent)' : 'var(--danger)',
                    transform: 'translateX(-50%)', transition: 'left 0.1s',
                  }}
                />
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: 'var(--muted)', transform: 'translateX(-50%)' }} />
                <div style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: '1px', background: 'var(--border)' }} />
                <div style={{ position: 'absolute', left: '75%', top: 0, bottom: 0, width: '1px', background: 'var(--border)' }} />
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, fontSize: '0.8rem' }}>
                <span className="muted">-50¢</span>
                <span className="muted">0¢</span>
                <span className="muted">+50¢</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="muted">Detected Cents</span>
                <span style={{ fontWeight: 700, color: Math.abs(cents) < 5 ? 'var(--ok)' : Math.abs(cents) < 15 ? 'var(--accent)' : 'var(--danger)' }}>
                  {cents > 0 ? '+' : ''}{cents}¢
                </span>
              </div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="muted">Target Cents</span>
                <span style={{ fontWeight: 700, color: Math.abs(targetCents) < 5 ? 'var(--ok)' : Math.abs(targetCents) < 15 ? 'var(--accent)' : 'var(--danger)' }}>
                  {targetCents > 0 ? '+' : ''}{targetCents}¢
                </span>
              </div>
            </div>

            <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, volume)}%`, height: '100%',
                background: volume > 10 ? 'var(--ok)' : 'var(--danger)', borderRadius: 4, transition: 'width 0.1s'
              }} />
            </div>
            <div className="muted" style={{ fontSize: '0.8rem' }}>Input Volume: {Math.round(volume)}%</div>

            <button className="btn" onClick={stopTuner} style={{ marginTop: 16, padding: '12px 24px', fontSize: '1rem', background: 'var(--danger)' }}>
              Stop Tuner
            </button>
          </>
        )}
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <h4 style={{ margin: '0 0 12px' }}>Quick Reference Tones</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
          {['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4', 'D4', 'G4', 'B4', 'E5'].map(note => (
            <button key={note} className="btn" onClick={() => playReference(note)} style={{ padding: '8px 12px', fontSize: '0.85rem' }}>
              {note}
            </button>
          ))}
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Chromatic tuner with microphone input. Select instrument and target string. Shows detected note, cents deviation, and target cents for selected string.
      </p>
    </div>
  )
}