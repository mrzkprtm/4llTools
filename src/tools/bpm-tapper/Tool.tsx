import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

export default function BPMTapper() {
  const [taps, setTaps] = useState<number[]>(() => {
    const saved = localStorage.getItem('bpm-tapper')
    return saved ? JSON.parse(saved) : []
  })
  const [bpm, setBpm] = useState(0)
  const [avgBpm, setAvgBpm] = useState(0)
  const [beatPhase, setBeatPhase] = useState(0)
  const [running, setRunning] = useState(false)
  const lastTapRef = useRef<number>(0)
  const animationRef = useRef<number>(undefined)

  useEffect(() => {
    try { localStorage.setItem('bpm-tapper', JSON.stringify(taps)) } catch {}
  }, [taps])

  useEffect(() => {
    if (taps.length >= 2) {
      const intervals = []
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1])
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
      const calculatedBpm = 60000 / avgInterval
      setBpm(Math.round(calculatedBpm * 10) / 10)
      setAvgBpm(Math.round((intervals.reduce((a, b) => a + b, 0) / intervals.length / 60000 * 60000) * 10) / 10)
    } else {
      setBpm(0)
      setAvgBpm(0)
    }
  }, [taps])

  const handleTap = () => {
    const now = Date.now()
    if (lastTapRef.current > 0) {
      const interval = now - lastTapRef.current
      if (interval > 200 && interval < 3000) {
        setTaps(prev => [...prev.slice(-15), now])
      }
    }
    lastTapRef.current = now
    setBeatPhase(1)
    setTimeout(() => setBeatPhase(0), 100)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      handleTap()
    }
    if (e.code === 'KeyC') clearTaps()
    if (e.code === 'KeyR') resetBeat()
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const clearTaps = () => {
    setTaps([])
    setBpm(0)
    setAvgBpm(0)
    lastTapRef.current = 0
  }

  const resetBeat = () => {
    setBeatPhase(0)
  }

  const commonTempos = [60, 70, 80, 90, 100, 110, 120, 128, 130, 140, 150, 160, 170, 180]

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ margin: 0 }}>BPM Tapper</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={clearTaps} disabled={taps.length === 0}>Clear</button>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="pop-row" style={{
          padding: 24, textAlign: 'center', minWidth: 200,
          background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
        }}>
          <div className="muted" style={{ fontSize: '0.9rem', marginBottom: 8 }}>Current BPM</div>
          <div style={{ fontSize: '4rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
            <Roll value={bpm || '—'} />
          </div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>{taps.length} taps</div>
        </div>

        <div className="pop-row" style={{
          padding: 24, textAlign: 'center', minWidth: 200,
          background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
          animationDelay: '100ms',
        }}>
          <div className="muted" style={{ fontSize: '0.9rem', marginBottom: 8 }}>Average BPM</div>
          <div style={{ fontSize: '4rem', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ok)' }}>
            <Roll value={avgBpm || '—'} />
          </div>
          <div className="muted" style={{ fontSize: '0.8rem' }}>Stable tempo</div>
        </div>
      </div>

      <div className="pop-row" style={{
        padding: 32, textAlign: 'center', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        marginBottom: 16, animation: reducedMotion() ? 'none' : 'pop 0.3s var(--spring-bouncy) both',
      }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%', margin: '0 auto 16px',
          background: `radial-gradient(circle, ${beatPhase ? 'var(--accent)' : 'var(--border)'} 0%, var(--sunken) 70%)`,
          border: '4px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.1s',
          boxShadow: beatPhase ? '0 0 30px var(--accent)' : 'none',
        }}>
          <span style={{ fontSize: '2rem', fontWeight: 700, color: beatPhase ? 'white' : 'var(--muted)' }}>TAP</span>
        </div>
        <button
          onClick={handleTap}
          onMouseDown={e => { e.preventDefault(); handleTap() }}
          style={{
            width: 120, height: 120, borderRadius: '50%', border: 'none',
            background: 'transparent', cursor: 'pointer', position: 'relative', marginTop: -120,
          }}
        />
        <p className="muted" style={{ marginTop: 8 }}>Click, press Space/Enter, or tap on mobile</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Quick Tempo Reference</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
          {commonTempos.map(tempo => (
            <button key={tempo} className="btn" style={{
              padding: '12px 8px', fontSize: '0.85rem',
              background: bpm && Math.abs(bpm - tempo) <= 2 ? 'var(--accent)' : 'var(--bg)',
              color: bpm && Math.abs(bpm - tempo) <= 2 ? 'white' : 'var(--text)',
              border: bpm && Math.abs(bpm - tempo) <= 2 ? '2px solid var(--accent)' : '1px solid var(--border)',
            }}>
              {tempo} BPM
            </button>
          ))}
        </div>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <h4 style={{ margin: '0 0 12px' }}>Tap History (last 16)</h4>
        {taps.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 16 }}>No taps yet. Start tapping!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {taps.slice(-16).map((tap, i) => {
              if (i === 0) return <div key={i} className="muted" style={{ padding: 8 }}>First tap</div>
              const interval = taps[taps.length - 16 + i] - taps[taps.length - 16 + i - 1]
              const instBpm = 60000 / interval
              return (
                <div key={i} style={{ padding: 8, background: 'var(--bg)', borderRadius: 4, textAlign: 'center' }}>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--mono)' }}>{Math.round(instBpm * 10) / 10}</div>
                  <div className="muted" style={{ fontSize: '0.7rem' }}>{interval}ms</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Tap Space/Enter or click the circle in time with the beat. BPM calculated from intervals between taps. Press C to clear, R to reset visual.
      </p>
    </div>
  )
}