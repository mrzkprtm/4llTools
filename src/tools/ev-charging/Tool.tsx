import { useEffect, useMemo, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, PlayBar, Slider, useRunning } from '../../sim/controls'
import { line, rrect, text } from '../../sim/draw'
import { alpha, useTheme } from '../../sim/theme'
import Roll from '../../motion/Roll'
import { chargeTime, EVS, FAST_CHARGERS, hm, PRICE_HOME, PRICE_SPKLU, SLOW_CHARGERS, socAfter, type ChargeResult } from './logic'
import './tool.css'

const W = 640
const H = 330
const ANIM_S = 6
const rp = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID')
const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
const SLOW_COLOR = '#1c7ed6'
const FAST_COLOR = '#e8590c'

export default function EvCharging() {
  const [evId, setEvId] = useState('dolphin')
  const [custom, setCustom] = useState('50')
  const [from, setFrom] = useState(20)
  const [to, setTo] = useState(80)
  const [slowKw, setSlowKw] = useState<number>(7)
  const [fastKw, setFastKw] = useState<number>(50)
  const [homePrice, setHomePrice] = useState(String(PRICE_HOME))
  const [fastPrice, setFastPrice] = useState(String(PRICE_SPKLU))
  const [running, setRunning] = useRunning()
  const theme = useTheme()
  const clock = useRef(running ? 0 : 1)

  const ev = useMemo(() => EVS.find((e) => e.id === evId) ?? { id: 'custom', name: 'Custom', kwh: 0, maxAc: 11, maxDc: 150 }, [evId])
  const kwh = ev.id === 'custom' ? num(custom) || 0 : ev.kwh
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  const slow = useMemo(() => chargeTime(kwh, lo, hi, slowKw, ev, num(homePrice) || 0), [kwh, lo, hi, slowKw, ev, homePrice])
  const fast = useMemo(() => chargeTime(kwh, lo, hi, fastKw, ev, num(fastPrice) || 0), [kwh, lo, hi, fastKw, ev, fastPrice])
  const longest = Math.max(slow.hours, fast.hours, 1e-6)

  useEffect(() => {
    clock.current = running ? 0 : 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slow.hours, fast.hours])

  function battery(ctx: CanvasRenderingContext2D, x: number, y: number, r: ChargeResult, h: number, color: string, label: string) {
    const soc = socAfter(r.curve, h)
    const done = h >= r.hours
    const bw = 250
    const bh = 64
    rrect(ctx, x, y, bw, bh, 10, theme.surface, theme.border, 2)
    rrect(ctx, x + bw, y + bh / 2 - 12, 8, 24, 3, theme.border)
    rrect(ctx, x + 5, y + 5, Math.max(0, ((bw - 10) * soc) / 100), bh - 10, 7, alpha(color, done ? 0.9 : 0.7))
    // Starting level marker.
    const sx = x + 5 + ((bw - 10) * lo) / 100
    line(ctx, sx, y + 3, sx, y + bh - 3, alpha(theme.text, 0.4), 1, [3, 3])
    if (!done && h > 0) {
      // A little bolt that pulses while charging.
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 150)
      text(ctx, '⚡', x + 5 + ((bw - 10) * soc) / 100 - 4, y + bh / 2 + 1, { size: 20, align: 'right', baseline: 'middle', color: alpha(theme.text, pulse), mono: false })
    }
    text(ctx, `${Math.round(soc)}%`, x + bw / 2, y + bh / 2 + 1, { color: theme.text, size: 22, weight: 700, align: 'center', baseline: 'middle' })
    text(ctx, label, x, y - 8, { color: theme.text, size: 13, weight: 600, mono: false })
    text(ctx, done ? `done in ${hm(r.hours)}` : `${hm(Math.min(h, r.hours))}`, x + bw + 8, y - 8, { color: done ? theme.ok : theme.muted, size: 12, align: 'right' })
  }

  function onFrame(ctx: CanvasRenderingContext2D, f: { dt: number }) {
    if (f.dt > 0) {
      clock.current += f.dt / ANIM_S
      if (clock.current > 1.3) clock.current = 0
    }
    const h = Math.min(1, clock.current) * longest
    ctx.clearRect(0, 0, W, H)
    battery(ctx, 30, 36, slow, h, SLOW_COLOR, `${slowKw} kW ${slowKw <= 7 ? 'home' : 'AC'} charger`)
    battery(ctx, 350, 36, fast, h, FAST_COLOR, `${fastKw} kW DC fast charger`)
    text(ctx, `elapsed ${hm(h)}`, W / 2, 124, { color: theme.muted, size: 12, align: 'center' })

    // Power vs state-of-charge chart.
    const cx = 60
    const cy = 150
    const cw = W - 90
    const ch = 140
    const maxP = Math.max(...fast.curve.map((c) => c[1]), ...slow.curve.map((c) => c[1]), 1) * 1.1
    const X = (s: number) => cx + (s / 100) * cw
    const Y = (p: number) => cy + ch - (p / maxP) * ch
    rrect(ctx, X(80), cy, X(100) - X(80), ch, 0, alpha(theme.text, 0.05))
    text(ctx, 'taper', X(90), cy + 12, { color: theme.muted, size: 10, align: 'center' })
    line(ctx, cx, cy + ch, cx + cw, cy + ch, theme.border)
    line(ctx, cx, cy, cx, cy + ch, theme.border)
    for (const s of [0, 20, 40, 60, 80, 100]) text(ctx, `${s}%`, X(s), cy + ch + 16, { color: theme.muted, size: 10, align: 'center' })
    for (const p of [0, 0.5, 1]) text(ctx, `${Math.round(maxP * p / 1.1)}`, cx - 6, Y((maxP * p) / 1.1) + 3, { color: theme.muted, size: 10, align: 'right' })
    text(ctx, 'kW', cx - 6, cy - 6, { color: theme.muted, size: 10, align: 'right' })
    for (const [r, color] of [[slow, SLOW_COLOR], [fast, FAST_COLOR]] as const) {
      ctx.beginPath()
      r.curve.forEach(([s, p], i) => (i ? ctx.lineTo(X(s), Y(p)) : ctx.moveTo(X(s), Y(p))))
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.stroke()
      const s = socAfter(r.curve, h)
      const p = r.curve.reduce((best, c) => (Math.abs(c[0] - s) < Math.abs(best[0] - s) ? c : best))[1]
      ctx.beginPath()
      ctx.arc(X(s), Y(p), 5, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }
  }

  const saved = slow.cost - fast.cost

  return (
    <div>
      <div className="ev-grid">
        <div>
          <label htmlFor="ev-car">Car</label>
          <select id="ev-car" value={evId} onChange={(e) => setEvId(e.target.value)}>
            {EVS.map((e) => <option key={e.id} value={e.id}>{e.name} (~{e.kwh} kWh)</option>)}
            <option value="custom">Other (enter kWh)</option>
          </select>
        </div>
        {evId === 'custom' && (
          <div>
            <label htmlFor="ev-kwh">Battery capacity (kWh)</label>
            <input id="ev-kwh" type="number" inputMode="decimal" min={1} value={custom} onChange={(e) => setCustom(e.target.value)} />
          </div>
        )}
      </div>
      <div className="ev-grid ev-sliders">
        <Slider label="Current charge" value={from} min={0} max={100} unit="%" onChange={setFrom} />
        <Slider label="Charge to" value={to} min={0} max={100} unit="%" onChange={setTo} />
      </div>

      <Stage world={[W, H]} running={running} onFrame={onFrame} className="sim-flat" label={`Charging from ${lo}% to ${hi}%: ${hm(slow.hours)} on ${slowKw} kW, ${hm(fast.hours)} on ${fastKw} kW.`} />
      <PlayBar running={running} setRunning={setRunning} onReset={() => { clock.current = 0; setRunning(true) }} resetLabel="Replay" />

      <div className="ev-cols">
        <section className="ev-card" style={{ borderTopColor: SLOW_COLOR }}>
          <Choice label="Home / AC charger" value={slowKw} options={SLOW_CHARGERS.map((k) => [k, `${k} kW`] as const)} onChange={setSlowKw} />
          <label htmlFor="ev-hp">Price per kWh (Rp, PLN home tariff)</label>
          <input id="ev-hp" type="number" inputMode="decimal" min={0} value={homePrice} onChange={(e) => setHomePrice(e.target.value)} />
          <div className="stats">
            <div className="stat"><b><Roll>{hm(slow.hours)}</Roll></b>Time</div>
            <div className="stat"><b><Roll>{rp(slow.cost)}</Roll></b>Cost ({slow.drawn.toFixed(1)} kWh from grid)</div>
          </div>
        </section>
        <section className="ev-card" style={{ borderTopColor: FAST_COLOR }}>
          <Choice label="DC fast charger (SPKLU)" value={fastKw} options={FAST_CHARGERS.map((k) => [k, `${k} kW`] as const)} onChange={setFastKw} />
          <label htmlFor="ev-fp">Price per kWh (Rp, SPKLU)</label>
          <input id="ev-fp" type="number" inputMode="decimal" min={0} value={fastPrice} onChange={(e) => setFastPrice(e.target.value)} />
          <div className="stats">
            <div className="stat"><b><Roll>{hm(fast.hours)}</Roll></b>Time</div>
            <div className="stat"><b><Roll>{rp(fast.cost)}</Roll></b>Cost ({fast.drawn.toFixed(1)} kWh from grid)</div>
          </div>
          {fast.acFallback && <p className="chip bad calm">This car has no DC fast charging, so it charges at its AC limit ({ev.maxAc} kW).</p>}
        </section>
      </div>
      {hi > lo && (
        <p className="muted ev-sum">
          Adding <b>{slow.stored.toFixed(1)} kWh</b> ({hi - lo}%). Fast charging saves <b>{hm(Math.max(0, slow.hours - fast.hours))}</b>{' '}
          {saved < 0 ? <>but costs <b>{rp(-saved)}</b> more.</> : <>and costs <b>{rp(saved)}</b> less.</>}
        </p>
      )}
      <Hint>Choose your car and slide the current and target charge. Power stays flat until about 80%, then tapers, which is why the last 20% takes so long on a fast charger. Capacities, limits and tariffs are approximate; edit the prices to match yours.</Hint>
    </div>
  )
}
