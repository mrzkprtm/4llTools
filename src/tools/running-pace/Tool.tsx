import { useState } from 'react'
import { Roll } from '../../motion/Roll'

export default function RunningPace() {
  const [mode, setMode] = useState<'pace' | 'time' | 'distance'>('pace')
  const [distance, setDistance] = useState(10)
  const [timeMinutes, setTimeMinutes] = useState(50)
  const [timeSeconds, setTimeSeconds] = useState(0)
  const [paceMinutes, setPaceMinutes] = useState(5)
  const [paceSeconds, setPaceSeconds] = useState(0)

  const totalTimeSec = timeMinutes * 60 + timeSeconds
  const totalDistanceKm = distance
  const paceSecPerKm = totalDistanceKm > 0 ? totalTimeSec / totalDistanceKm : 0
  const paceMin = Math.floor(paceSecPerKm / 60)
  const paceSec = Math.round(paceSecPerKm % 60)

  const timeFromPaceSec = totalDistanceKm * (paceMinutes * 60 + paceSeconds)
  const timeH = Math.floor(timeFromPaceSec / 3600)
  const timeM = Math.floor((timeFromPaceSec % 3600) / 60)
  const timeS = Math.round(timeFromPaceSec % 60)

  const distFromPace = totalTimeSec > 0 ? totalTimeSec / (paceMinutes * 60 + paceSeconds) : 0

  // Riegel prediction
  const riegel = (t1: number, d1: number, d2: number) => t1 * Math.pow(d2 / d1, 1.06)
  const marathonTime = riegel(totalTimeSec, distance, 42.195)
  const halfMarathonTime = riegel(totalTimeSec, distance, 21.0975)
  const tenKTime = riegel(totalTimeSec, distance, 10)
  const fiveKTime = riegel(totalTimeSec, distance, 5)

  const fmtTime = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = Math.round(sec % 60)
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div>
      <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Calculate</span>
          <select value={mode} onChange={e => setMode(e.target.value as any)} className="btn">
            <option value="pace">Pace from Time & Distance</option>
            <option value="time">Time from Pace & Distance</option>
            <option value="distance">Distance from Pace & Time</option>
          </select>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Distance (km)</span>
          <input type="number" step={0.01} min={0.1} value={distance} onChange={e => setDistance(Number(e.target.value))} />
        </div>

        {(mode === 'pace' || mode === 'distance') && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Time (min:sec)</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="number" min={0} max={999} value={timeMinutes} onChange={e => setTimeMinutes(Number(e.target.value))} style={{ width: 70 }} placeholder="Min" />
                <input type="number" min={0} max={59} value={timeSeconds} onChange={e => setTimeSeconds(Number(e.target.value))} style={{ width: 70 }} placeholder="Sec" />
              </div>
            </div>
          </div>
        )}

        {(mode === 'time' || mode === 'distance') && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Pace (min:sec/km)</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <input type="number" min={0} max={30} value={paceMinutes} onChange={e => setPaceMinutes(Number(e.target.value))} style={{ width: 70 }} placeholder="Min" />
                <input type="number" min={0} max={59} value={paceSeconds} onChange={e => setPaceSeconds(Number(e.target.value))} style={{ width: 70 }} placeholder="Sec" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat"><b style={{ fontSize: '1.5rem' }}><Roll>{mode === 'pace' ? `${paceMin}:${String(paceSec).padStart(2, '0')}` : mode === 'time' ? fmtTime(timeFromPaceSec) : `${distFromPace.toFixed(2)} km`}</Roll></b><span className="muted">{mode === 'pace' ? 'Pace/km' : mode === 'time' ? 'Time' : 'Distance'}</span></div>
        <div className="stat"><b><Roll>{mode !== 'time' ? fmtTime(totalTimeSec) : fmtTime(timeFromPaceSec)}</Roll></b><span className="muted">Total Time</span></div>
        <div className="stat"><b><Roll>{totalDistanceKm.toFixed(2)}</Roll></b><span className="muted">Distance (km)</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 12 }}>Race Predictions (Riegel Formula)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {[
            { name: '5K', dist: 5 },
            { name: '10K', dist: 10 },
            { name: 'Half', dist: 21.0975 },
            { name: 'Marathon', dist: 42.195 },
          ].map(r => (
            <div key={r.name} className="stat" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{r.name}</div>
              <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.1rem' }}><Roll>{fmtTime(riegel(totalTimeSec || paceSecPerKm * distance, distance, r.dist))}</Roll></div>
            </div>
          ))}
        </div>
      </div>

      <Hint>Choose what to calculate. Riegel formula predicts race times: T₂ = T₁ × (D₂/D₁)^1.06</Hint>
    </div>
  )
}

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}