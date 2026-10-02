import { useEffect, useMemo, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, PlayBar, Slider, useRunning } from '../../sim/controls'
import { line, rrect, text } from '../../sim/draw'
import { alpha, useTheme } from '../../sim/theme'
import { useFlip } from '../../motion/useFlip'
import { DEFAULT_MODES, metricOf, monthly, ranked, type Metric, type ModeId, type ModeParams } from './logic'
import './tool.css'

const W = 640
const LANE = 42
const FASTEST_S = 3
const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID')
const dur = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m` : `${Math.round(min)} min`)

const FIELDS: readonly (readonly [keyof ModeParams, string])[] = [
  ['perKm', 'Rp/km'],
  ['perTrip', 'Rp/trip'],
  ['perDay', 'Rp/day'],
  ['speed', 'km/h'],
  ['wait', 'wait min'],
  ['co2', 'g CO₂/km'],
]

export default function CommuteCompare() {
  const [km, setKm] = useState(15)
  const [days, setDays] = useState(22)
  const [modes, setModes] = useState<ModeParams[]>(() => DEFAULT_MODES.map((m) => ({ ...m })))
  const [off, setOff] = useState<Set<ModeId>>(() => new Set())
  const [metric, setMetric] = useState<Metric>('cost')
  const [running, setRunning] = useRunning()
  const theme = useTheme()
  const clock = useRef(0)
  const list = useRef<HTMLOListElement>(null)
  useFlip(list, { spring: 'soft' })

  const active = useMemo(() => modes.filter((m) => !off.has(m.id)), [modes, off])
  const results = useMemo(() => active.map((m) => monthly(m, km, days)), [active, km, days])
  const order = ranked(results, metric)
  const max = Math.max(1e-9, ...results.map((r) => metricOf(r, metric)))
  const fastest = Math.min(...results.map((r) => r.tripMin))
  const H = Math.max(1, active.length) * LANE + 34

  useEffect(() => {
    clock.current = 0
  }, [km, off.size, modes])

  function onFrame(ctx: CanvasRenderingContext2D, f: { dt: number }) {
    const slowest = Math.max(...results.map((r) => r.tripMin), 1)
    const span = Math.min(16, (FASTEST_S * slowest) / Math.max(1, fastest))
    if (f.dt > 0) {
      clock.current += f.dt
      if (clock.current > span + 2) clock.current = 0
    }
    // Paused before starting: show everyone at the finish so the result is visible.
    const t = !running && clock.current === 0 ? Infinity : clock.current
    ctx.clearRect(0, 0, W, H)
    const x0 = 118
    const x1 = W - 70
    line(ctx, x1, 8, x1, H - 22, theme.text, 2, [4, 4])
    text(ctx, `${km} km`, x1, H - 8, { color: theme.muted, size: 11, align: 'center' })
    text(ctx, 'home', x0, H - 8, { color: theme.muted, size: 11, align: 'center' })
    active.forEach((m, i) => {
      const r = results[i]
      const y = 10 + i * LANE
      rrect(ctx, x0 - 6, y, x1 - x0 + 12, LANE - 8, 8, i % 2 ? alpha(theme.text, 0.04) : alpha(theme.text, 0.07))
      text(ctx, m.name, 8, y + LANE / 2 - 2, { color: theme.text, size: 12, baseline: 'middle', mono: false, weight: 600 })
      const finish = (FASTEST_S * r.tripMin) / Math.max(1, fastest)
      const waitFrac = r.tripMin > 0 ? m.wait / r.tripMin : 0
      const p = Math.min(1, t / Math.min(finish, span))
      const move = Math.max(0, (p - waitFrac) / (1 - waitFrac || 1))
      const x = x0 + (x1 - x0) * move
      ctx.save()
      ctx.translate(x, y + LANE / 2 - 3)
      ctx.scale(-1, 1)
      const bob = p > waitFrac && p < 1 ? Math.sin(t * 22 + i) * 1.2 : 0
      text(ctx, m.icon, 0, bob, { size: 22, align: 'center', baseline: 'middle', mono: false })
      ctx.restore()
      if (p < waitFrac && t > 0) text(ctx, '⏱', x + 18, y + LANE / 2 - 3, { size: 12, baseline: 'middle', mono: false, color: theme.muted })
      if (p >= 1) text(ctx, dur(r.tripMin), x1 + 8, y + LANE / 2 - 3, { color: r.tripMin === fastest ? theme.ok : theme.text, size: 11, baseline: 'middle', weight: 700 })
    })
  }

  function edit(id: ModeId, k: keyof ModeParams, v: string) {
    const n = Number(v)
    setModes(modes.map((m) => (m.id === id ? { ...m, [k]: Number.isFinite(n) && n >= 0 ? n : 0 } : m)))
  }

  const fmt = (v: number) => (metric === 'cost' ? rp(v) : metric === 'time' ? `${v.toFixed(1)} h` : `${v.toFixed(1)} kg`)

  return (
    <div>
      <div className="cc-sliders">
        <Slider label="One-way distance" value={km} min={1} max={60} unit=" km" onChange={setKm} />
        <Slider label="Commuting days per month" value={days} min={1} max={31} onChange={setDays} />
      </div>
      <div className="row cc-modes" role="group" aria-label="Modes to compare">
        {modes.map((m) => (
          <button key={m.id} type="button" className={`btn ${off.has(m.id) ? '' : 'on'}`} aria-pressed={!off.has(m.id)} onClick={() => { const n = new Set(off); if (n.has(m.id)) n.delete(m.id); else if (active.length > 1) n.add(m.id); setOff(n) }}>
            <span aria-hidden="true">{m.icon}</span> {m.name}
          </button>
        ))}
      </div>

      <Stage world={[W, H]} running={running} onFrame={onFrame} className="sim-flat" label={`Race over ${km} km. Fastest: ${modes.find((d) => d.id === ranked(results, 'time')[0]?.id)?.name ?? ''}.`} />
      <PlayBar running={running} setRunning={setRunning} onReset={() => { clock.current = 0.0001; setRunning(true) }} resetLabel="Race again" />

      <div className="row cc-metric">
        <Choice label="Sort by" value={metric} options={[['cost', 'Monthly cost'], ['time', 'Time'], ['co2', 'CO₂']]} onChange={setMetric} />
      </div>
      <ol ref={list} className="cc-list">
        {order.map((r, i) => {
          const m = modes.find((x) => x.id === r.id)!
          const v = metricOf(r, metric)
          return (
            <li key={r.id} data-flip={r.id} className={i === 0 ? 'best' : ''}>
              <span className="cc-icon" aria-hidden="true">{m.icon}</span>
              <div className="cc-body">
                <div className="cc-top"><b>{m.name}</b><span className="cc-val">{fmt(v)}{i === 0 && <span className="chip good">best</span>}</span></div>
                <div className="bar"><i style={{ transform: `scaleX(${v / max})` }} /></div>
                <div className="cc-sub muted">{rp(r.monthlyCost)}/mo · {r.monthlyHours.toFixed(1)} h/mo · {r.monthlyCo2Kg.toFixed(1)} kg CO₂ · {dur(r.tripMin)} each way</div>
              </div>
            </li>
          )
        })}
      </ol>

      <details className="cc-edit">
        <summary>Edit assumptions (fares, speeds, CO₂)</summary>
        <div className="cc-table">
          <table className="simple">
            <thead><tr><th>Mode</th>{FIELDS.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
            <tbody>
              {modes.map((m) => (
                <tr key={m.id}>
                  <td>{m.icon} {m.name}</td>
                  {FIELDS.map(([k, l]) => (
                    <td key={k}><input type="number" inputMode="decimal" min={0} aria-label={`${m.name} ${l}`} value={m[k] as number} onChange={(e) => edit(m.id, k, e.target.value)} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted cc-note">KRL: Rp3,000 for the first 25 km, then Rp1,000 per 10 km. Car and motorbike costs include fuel and wear; parking is per day. Wait time covers walking to the stop, waiting and parking. CO₂ is per passenger.</p>
        <button type="button" className="btn" onClick={() => setModes(DEFAULT_MODES.map((m) => ({ ...m })))}>Reset to defaults</button>
      </details>
      <Hint>Set your one-way distance and working days to race every mode and compare monthly cost, time and CO₂. Tap a mode to leave it out, and open the assumptions to match your real fares and speeds.</Hint>
    </div>
  )
}
