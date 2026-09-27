import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const TIME_SIGNATURES = [
  { name: '4/4', beats: 4, subdivision: 1 },
  { name: '3/4', beats: 3, subdivision: 1 },
  { name: '2/4', beats: 2, subdivision: 1 },
  { name: '6/8', beats: 6, subdivision: 3 },
  { name: '9/8', beats: 9, subdivision: 3 },
  { name: '12/8', beats: 12, subdivision: 3 },
  { name: '5/4', beats: 5, subdivision: 1 },
  { name: '7/8', beats: 7, subdivision: 1 },
]

const SUBDIVISIONS = [
  { label: 'Quarter (♩)', value: 1, beatsPerClick: 1 },
  { label: 'Eighth (♪)', value: 2, beatsPerClick: 0.5 },
  { label: 'Triplet (♪♪♪)', value: 3, beatsPerClick: 1/3 },
  { label: 'Sixteenth (♬)', value: 4, beatsPerClick: 0.25 },
]

export default function Metronome() {
  const [bpm, setBpm] = useState(120)
  const [timeSig, setTimeSig] = useState(TIME_SIGNATURES[0])
  const [subdivision, setSubdivision] = useState(SUBDIVISIONS[0])
  const [running, setRunning] = useState(false)
  const [beat, setBeat] = useState(0)
  const [subBeat, setSubBeat] = useState(0)
  const [volume, setVolume] = useState(0.5)
  const [accentFirst, setAccentFirst] = useState(true)
  const [tapTimes, setTapTimes] = useState<number[]>([])

  const audioContextRef = useRef<AudioContext | null>(null)
  const intervalRef = useRef<NodeJS.Timeout>()

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const playClick = (isAccent: boolean) => {
    try {
      const ctx = getAudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'square'
      osc.frequency.value = isAccent ? 880 : 440
      gain.gain.value = volume * (isAccent ? 1 : 0.6)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)

      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } catch (e) {
      console.warn('Audio not available', e)
    }
  }

  const msPerBeat = useMemo(() => 60000 / bpm / subdivision.value, [bpm, subdivision])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        const totalSubBeats = timeSig.beats * subdivision.value
        const isAccent = accentFirst && (subBeat % totalSubBeats === 0)
        playClick(isAccent)

        setSubBeat(s => (s + 1) % totalSubBeats)
        if (subBeat % subdivision.value === subdivision.value - 1) {
          setBeat(b => (b + 1) % timeSig.beats)
        }
      }, msPerBeat)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, msPerBeat, timeSig, subdivision, accentFirst, beat, subBeat])

  const handleTap = () => {
    const now = Date.now()
    setTapTimes(prev => [...prev.slice(-4), now])
    if (tapTimes.length >= 1) {
      const intervals = tapTimes.slice(-4).map((t, i, arr) => i > 0 ? t - arr[i-1] : 0).slice(1)
      if (intervals.length > 0) {
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const tappedBpm = Math.round(60000 / avg)
        if (tappedBpm > 30 && tappedBpm < 300) setBpm(tappedBpm)
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') { e.preventDefault(); handleTap() }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    return `${m}:${(s % 60).toString().padStart(2, '0')}`
  }

  const totalClicks = beat * subdivision.value + subBeat
  const progress = totalClicks / (timeSig.beats * subdivision.value)

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Metronome</h3>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 100 }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Time Sig</span>
            <select value={timeSig.name} onChange={e => setTimeSig(TIME_SIGNATURES.find(t => t.name === e.target.value)!)} style={{ width: 80 }}>
              {TIME_SIGNATURES.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
            <span className="muted" style={{ fontSize: '0.7rem' }}>Subdivision</span>
            <select value={subdivision.value} onChange={e => setSubdivision(SUBDIVISIONS.find(s => s.value === Number(e.target.value))!)} style={{ width: 100 }}>
              {SUBDIVISIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="pop-row" style={{ padding: 24, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both' }}>
        <div className="muted" style={{ fontSize: '0.9rem', marginBottom: 8 }}>BPM</div>
        <div style={{ fontSize: '4rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 16 }}>
          <Roll value={bpm} />
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 16, marginBottom: 16 }}>
          <button className="btn" onClick={() => setBpm(b => Math.max(20, b - 10))} style={{ minWidth: 60 }}>-10</button>
          <button className="btn" onClick={() => setBpm(b => Math.max(20, b - 1))} style={{ minWidth: 60 }}>-1</button>
          <button className="btn" onClick={() => setBpm(b => Math.min(300, b + 1))} style={{ minWidth: 60 }}>+1</button>
          <button className="btn" onClick={() => setBpm(b => Math.min(300, b + 10))} style={{ minWidth: 60 }}>+10</button>
        </div>

        <div style={{ width: 200, height: 200, margin: '0 auto 16px', position: 'relative' }}>
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: `rotate(${beat * (360 / timeSig.beats) + subBeat * (360 / (timeSig.beats * subdivision.value))}deg)` }}>
            <circle cx="100" cy="100" r="90" fill="none" stroke="var(--border)" strokeWidth="2" />
            <line x1="100" y1="100" x2="100" y2="10" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="10" r="8" fill="var(--accent)" />
          </svg>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 120, height: 120, borderRadius: '50%', border: '4px solid var(--border)',
            background: `conic-gradient(var(--accent) ${progress * 100}%, var(--border) 0%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
              {beat + 1} / {timeSig.beats}
            </div>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="btn" onClick={() => { setRunning(!running); if (!running) { setBeat(0); setSubBeat(0) } }} style={{ padding: '16px 32px', fontSize: '1.2rem', minWidth: 140, background: running ? 'var(--danger)' : 'var(--ok)' }}>
            {running ? 'Stop' : 'Start'}
          </button>
          <button className="btn" onClick={handleTap} style={{ padding: '16px 32px', fontSize: '1.2rem', minWidth: 140, background: 'var(--accent)' }}>
            Tap Tempo
          </button>
        </div>

        <div className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>
          Tap Space or click "Tap Tempo" 4+ times. {tapTimes.length > 0 && <span>Tap BPM: ~{Math.round(60000 / (tapTimes.slice(-4).reduce((a, b, i, arr) => i > 0 ? a + (b - arr[i-1]) : 0, 0) / Math.max(1, tapTimes.length - 1)))}</span>}
        </div>
      </div>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="pop-row" style={{ flex: 1, minWidth: 200, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Quick Tempos</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 8 }}>
            {[40, 50, 60, 70, 80, 90, 100, 110, 120, 128, 140, 160, 180, 200].map(t => (
              <button key={t} className="btn" onClick={() => setBpm(t)} style={{
                background: bpm === t ? 'var(--accent)' : 'var(--bg)',
                color: bpm === t ? 'white' : 'var(--text)',
                border: bpm === t ? '2px solid var(--accent)' : '1px solid var(--border)',
              }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="pop-row" style={{ flex: 1, minWidth: 200, padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <h4 style={{ margin: '0 0 12px' }}>Settings</h4>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={accentFirst} onChange={e => setAccentFirst(e.target.checked)} />
              <span>Accent first beat</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>Volume</span>
                <span>{Math.round(volume * 100)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))} />
            </label>
          </div>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Precise metronome with visual pendulum. Supports common time signatures and subdivisions. Tap tempo with Space bar. Audio requires user interaction.
      </p>
    </div>
  )
}