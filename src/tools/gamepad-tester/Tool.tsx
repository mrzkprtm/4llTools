import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { Hint, Slider } from '../../sim/controls'
import { axisLabel, buttonLabel, computeDrift, type Drift, type Vec } from './logic'
import { PadSvg, StickView, type Snapshot } from './Pad'
import './tool.css'

interface Rumbler {
  playEffect?: (type: string, params: { duration: number; startDelay?: number; strongMagnitude: number; weakMagnitude: number }) => Promise<unknown>
}

const TRAIL = 36
const DRIFT_MS = 3000

function read(): Snapshot[] {
  const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []
  const out: Snapshot[] = []
  for (const g of list) {
    if (!g || !g.connected) continue
    out.push({
      index: g.index,
      id: g.id,
      mapping: g.mapping,
      axes: [...g.axes],
      buttons: g.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
      timestamp: g.timestamp,
      rumble: typeof (g as unknown as { vibrationActuator?: Rumbler }).vibrationActuator?.playEffect === 'function',
    })
  }
  return out
}

export default function GamepadTester() {
  const [supported, setSupported] = useState(true)
  const [pads, setPads] = useState<Snapshot[]>([])
  const [sel, setSel] = useState(0)
  const [deadzone, setDeadzone] = useState(0.08)
  const [measuring, setMeasuring] = useState(false)
  const [drift, setDrift] = useState<{ left: Drift; right: Drift } | null>(null)
  const [rumbleMsg, setRumbleMsg] = useState('')
  const trails = useRef<Record<number, { l: Vec[]; r: Vec[] }>>({})
  const samples = useRef<{ until: number; l: Vec[]; r: Vec[] } | null>(null)
  const selRef = useRef(sel)
  selRef.current = sel

  useEffect(() => {
    if (!('getGamepads' in navigator)) {
      setSupported(false)
      return
    }
    let raf = 0
    let sig = ''
    const loop = () => {
      raf = requestAnimationFrame(loop)
      let list: Snapshot[] = []
      try { list = read() } catch { /* some browsers block gamepads in iframes */ }
      const next = list.map((p) => `${p.index}:${p.timestamp}`).join(',')
      if (next === sig && !samples.current) return
      sig = next
      for (const p of list) {
        const t = (trails.current[p.index] ??= { l: [], r: [] })
        t.l.push({ x: p.axes[0] ?? 0, y: p.axes[1] ?? 0 })
        t.r.push({ x: p.axes[2] ?? 0, y: p.axes[3] ?? 0 })
        if (t.l.length > TRAIL) t.l.shift()
        if (t.r.length > TRAIL) t.r.shift()
      }
      const m = samples.current
      const cur = list.find((p) => p.index === selRef.current) ?? list[0]
      if (m && cur) {
        m.l.push({ x: cur.axes[0] ?? 0, y: cur.axes[1] ?? 0 })
        m.r.push({ x: cur.axes[2] ?? 0, y: cur.axes[3] ?? 0 })
        if (performance.now() > m.until) {
          const res = { left: computeDrift(m.l), right: computeDrift(m.r) }
          setDrift(res)
          setDeadzone(Math.max(res.left.deadzone, res.right.deadzone))
          setMeasuring(false)
          samples.current = null
        }
      }
      setPads(list)
    }
    raf = requestAnimationFrame(loop)
    const onConn = () => { sig = '' }
    window.addEventListener('gamepadconnected', onConn)
    window.addEventListener('gamepaddisconnected', onConn)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('gamepadconnected', onConn)
      window.removeEventListener('gamepaddisconnected', onConn)
    }
  }, [])

  const pad = pads.find((p) => p.index === sel) ?? pads[0]
  const trail = pad ? trails.current[pad.index] : undefined

  function measure() {
    setDrift(null)
    setMeasuring(true)
    samples.current = { until: performance.now() + DRIFT_MS, l: [], r: [] }
  }

  async function rumble(strong: number, weak: number) {
    const g = pad && navigator.getGamepads()[pad.index]
    const act = (g as unknown as { vibrationActuator?: Rumbler } | null)?.vibrationActuator
    if (!act?.playEffect) return setRumbleMsg('This controller or browser does not support vibration.')
    try {
      await act.playEffect('dual-rumble', { duration: 700, startDelay: 0, strongMagnitude: strong, weakMagnitude: weak })
      setRumbleMsg('Did you feel it? If not, the motors may be weak or unsupported over this connection.')
    } catch {
      setRumbleMsg('Vibration was refused by the browser.')
    }
  }

  if (!supported) return <p className="error">This browser does not support the Gamepad API. Try a recent Chrome, Edge, Firefox or Safari.</p>

  if (!pad)
    return (
      <div className="gp-empty">
        <div className="gp-wait"><Icon name="headset" size={40} /></div>
        <h3>No controller detected yet</h3>
        <p>Connect a controller by USB or Bluetooth, then <b>press any button</b>. Browsers hide controllers until a button is pressed on this page.</p>
        <Hint>Works with Xbox, PlayStation, Switch Pro and most generic controllers. Nothing is sent anywhere; the page only reads inputs while it is open.</Hint>
      </div>
    )

  const L = { x: pad.axes[0] ?? 0, y: pad.axes[1] ?? 0 }
  const R = { x: pad.axes[2] ?? 0, y: pad.axes[3] ?? 0 }
  const verdict = (d: Drift) => <span className={`chip ${d.verdict === 'good' ? 'good' : d.verdict === 'drift' ? 'bad' : ''}`}>{d.verdict === 'good' ? 'No drift' : d.verdict === 'slight' ? 'Slight drift' : 'Drift'} · max {(d.max * 100).toFixed(1)}%</span>

  return (
    <div className="gp">
      {pads.length > 1 && (
        <div className="row gp-tabs">
          {pads.map((p) => (
            <button key={p.index} type="button" className={`btn ${p.index === pad.index ? 'primary' : ''}`} onClick={() => setSel(p.index)}>Player {p.index + 1}</button>
          ))}
        </div>
      )}
      <p className="gp-id"><span className="gp-dot" /> {pad.id} <span className="muted">· mapping: {pad.mapping || 'non-standard'}</span></p>

      <PadSvg p={pad} />

      <div className="gp-sticks">
        <StickView label="Left stick" pos={L} trail={trail?.l ?? []} deadzone={deadzone} />
        <StickView label="Right stick" pos={R} trail={trail?.r ?? []} deadzone={deadzone} />
      </div>

      <div className="gp-drift">
        <button type="button" className="btn primary" onClick={measure} disabled={measuring}>{measuring ? 'Hands off… measuring' : 'Measure stick drift (3 s)'}</button>
        {drift && (
          <div className="gp-drift-res pop">
            <span>Left: {verdict(drift.left)}</span>
            <span>Right: {verdict(drift.right)}</span>
            <span className="muted">Suggested deadzone: {Math.round(Math.max(drift.left.deadzone, drift.right.deadzone) * 100)}%</span>
          </div>
        )}
        <Slider label="Deadzone preview" value={Math.round(deadzone * 100)} min={0} max={40} unit="%" onChange={(v) => setDeadzone(v / 100)} />
      </div>

      <div className="row gp-rumble">
        <button type="button" className="btn btn-icon" onClick={() => rumble(1, 0.4)} disabled={!pad.rumble}><Icon name="lightning-bolt" size={18} /> Strong rumble</button>
        <button type="button" className="btn" onClick={() => rumble(0, 1)} disabled={!pad.rumble}>Light rumble</button>
        {!pad.rumble && <span className="muted">Vibration is not available for this controller in this browser.</span>}
      </div>
      {rumbleMsg && <p className="muted">{rumbleMsg}</p>}

      <details className="gp-raw" open>
        <summary>Raw values</summary>
        <table className="simple">
          <tbody>
            {pad.axes.map((a, i) => (
              <tr key={`a${i}`}>
                <td>{axisLabel(i, pad.mapping)}</td>
                <td className="gp-mono">{a.toFixed(4)}</td>
                <td className="gp-bar-cell"><div className="gp-axis"><i style={{ left: `${50 + Math.min(0, a) * 50}%`, width: `${Math.abs(a) * 50}%` }} /></div></td>
              </tr>
            ))}
            {pad.buttons.map((b, i) => (
              <tr key={`b${i}`} className={b.pressed ? 'gp-hot' : ''}>
                <td>{buttonLabel(i, pad.mapping)}</td>
                <td className="gp-mono">{b.value.toFixed(2)}</td>
                <td className="gp-bar-cell"><div className="gp-axis"><i style={{ left: 0, width: `${b.value * 100}%` }} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <Hint>Move the sticks and press every button to see them light up. For drift, let go of both sticks and press Measure: a resting stick that reads more than a few percent off center is drifting.</Hint>
    </div>
  )
}
