import { useEffect, useMemo, useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Choice, Hint, PlayBar, Toggle, useRunning } from '../../sim/controls'
import { circle, rrect, text } from '../../sim/draw'
import { alpha, useTheme } from '../../sim/theme'
import Roll from '../../motion/Roll'
import { FUEL_PRESETS, rupiah, tripCost, type ConsumptionUnit } from './logic'
import './tool.css'

const W = 640
const H = 280
const DRIVE_S = 4.5

const ROUTES = [
  { name: 'Jakarta → Bandung', from: 'Jakarta', to: 'Bandung', km: 150 },
  { name: 'Jakarta → Yogyakarta', from: 'Jakarta', to: 'Yogyakarta', km: 560 },
  { name: 'Jakarta → Surabaya', from: 'Jakarta', to: 'Surabaya', km: 780 },
  { name: 'Surabaya → Malang', from: 'Surabaya', to: 'Malang', km: 95 },
  { name: 'Medan → Danau Toba', from: 'Medan', to: 'Parapat', km: 175 },
]

/** A winding road sampled into points with cumulative lengths. */
const PATH = (() => {
  const pts: [number, number][] = []
  for (let i = 0; i <= 200; i++) {
    const t = i / 200
    pts.push([40 + t * 420, 170 + Math.sin(t * Math.PI * 3.2) * 55 * (1 - 0.3 * t) - t * 30])
  }
  const len = [0]
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  return { pts, len, total: len[len.length - 1] }
})()

function at(u: number): [number, number, number] {
  const d = Math.min(1, Math.max(0, u)) * PATH.total
  let i = 1
  while (i < PATH.len.length - 1 && PATH.len[i] < d) i++
  const [x0, y0] = PATH.pts[i - 1]
  const [x1, y1] = PATH.pts[i]
  const f = (d - PATH.len[i - 1]) / (PATH.len[i] - PATH.len[i - 1] || 1)
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, Math.atan2(y1 - y0, x1 - x0)]
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

export default function FuelCost() {
  const [route, setRoute] = useState(1)
  const [distance, setDistance] = useState('560')
  const [unit, setUnit] = useState<ConsumptionUnit>('kmpl')
  const [consumption, setConsumption] = useState('13')
  const [fuel, setFuel] = useState('pertalite')
  const [price, setPrice] = useState('10000')
  const [roundTrip, setRoundTrip] = useState(true)
  const [passengers, setPassengers] = useState(4)
  const [extras, setExtras] = useState('750000')
  const [tank, setTank] = useState('40')
  const [running, setRunning] = useRunning()
  const theme = useTheme()
  const prog = useRef(running ? 0 : 1)
  const [shown, setShown] = useState(running ? 0 : 1)
  const lastPush = useRef(0)

  const r = useMemo(
    () => tripCost({ distanceKm: num(distance) || 0, consumption: num(consumption), unit, price: num(price) || 0, roundTrip, passengers, extras: num(extras) || 0, tank: num(tank) || 0 }),
    [distance, consumption, unit, price, roundTrip, passengers, extras, tank],
  )
  const badConsumption = !(num(consumption) > 0)
  const place = ROUTES[route]

  // Replay the drive whenever the trip changes.
  useEffect(() => {
    prog.current = running ? 0 : 1
    setShown(prog.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.total, r.liters, roundTrip])

  function pickFuel(id: string) {
    setFuel(id)
    const p = FUEL_PRESETS.find((f) => f.id === id)
    if (p) setPrice(String(p.price))
  }

  function pickRoute(i: number) {
    setRoute(i)
    if (i >= 0) setDistance(String(ROUTES[i].km))
  }

  function onFrame(ctx: CanvasRenderingContext2D, f: { dt: number; t: number }) {
    if (f.dt > 0 && prog.current < 1) prog.current = Math.min(1, prog.current + f.dt / DRIVE_S)
    const p = prog.current
    const now = performance.now()
    if (now - lastPush.current > 90 || (p === 1 && shown !== 1)) {
      lastPush.current = now
      if (Math.abs(p - shown) > 0.001) setShown(p)
    }
    ctx.clearRect(0, 0, W, H)
    // Road.
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    PATH.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.strokeStyle = alpha(theme.text, 0.18)
    ctx.lineWidth = 16
    ctx.stroke()
    ctx.setLineDash([8, 10])
    ctx.strokeStyle = alpha(theme.surface, 0.9)
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.setLineDash([])
    // Driven part.
    const u = roundTrip ? (p < 0.5 ? p * 2 : 2 - p * 2) : p
    ctx.beginPath()
    const upto = roundTrip && p >= 0.5 ? 1 : u
    for (let i = 0; i <= 80; i++) {
      const [x, y] = at((i / 80) * upto)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    }
    ctx.strokeStyle = alpha(theme.accent, 0.55)
    ctx.lineWidth = 5
    ctx.stroke()
    // Towns.
    const [ax, ay] = at(0)
    const [bx, by] = at(1)
    circle(ctx, ax, ay, 9, theme.surface, theme.text, 2)
    circle(ctx, bx, by, 9, theme.surface, theme.accent, 3)
    text(ctx, route >= 0 ? place.from : 'Start', ax, ay + 30, { color: theme.text, size: 12, align: 'center', mono: false, weight: 600 })
    text(ctx, route >= 0 ? place.to : 'Destination', bx, by - 18, { color: theme.text, size: 12, align: 'center', mono: false, weight: 600 })
    // Car.
    const [cx, cy, ang] = at(u)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(ang + (roundTrip && p >= 0.5 ? Math.PI : 0))
    const bob = f.dt > 0 && p < 1 ? Math.sin(f.t * 30) * 0.6 : 0
    rrect(ctx, -15, -9 + bob, 30, 18, 5, theme.accent)
    rrect(ctx, -5, -7 + bob, 11, 14, 3, alpha(theme.surface, 0.8))
    for (const [wx, wy] of [[-9, -10], [9, -10], [-9, 10], [9, 10]]) rrect(ctx, wx - 4, wy - 2, 8, 4, 2, theme.text)
    ctx.restore()
    // Fuel gauge: drops with liters burned, refills when the tank runs dry.
    const tankL = num(tank) || 0
    const burned = r.liters * p
    const level = tankL > 0 ? 1 - (burned % tankL) / tankL : 1 - p
    const refilled = tankL > 0 ? Math.floor(burned / tankL) : 0
    const gx = 555
    const gy = 120
    const R = 58
    ctx.beginPath()
    ctx.arc(gx, gy, R, Math.PI, 0)
    ctx.strokeStyle = alpha(theme.text, 0.15)
    ctx.lineWidth = 10
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(gx, gy, R, Math.PI, Math.PI + Math.PI * level)
    ctx.strokeStyle = level < 0.2 ? theme.danger : theme.ok
    ctx.stroke()
    const na = Math.PI + Math.PI * level
    ctx.beginPath()
    ctx.moveTo(gx, gy)
    ctx.lineTo(gx + Math.cos(na) * (R - 10), gy + Math.sin(na) * (R - 10))
    ctx.strokeStyle = theme.text
    ctx.lineWidth = 3
    ctx.stroke()
    circle(ctx, gx, gy, 5, theme.text)
    text(ctx, 'E', gx - R, gy + 18, { color: theme.muted, size: 12, align: 'center' })
    text(ctx, 'F', gx + R, gy + 18, { color: theme.muted, size: 12, align: 'center' })
    text(ctx, `${(r.liters * p).toFixed(1)} L`, gx, gy + 34, { color: theme.text, size: 16, align: 'center', weight: 700 })
    text(ctx, refilled > 0 ? `refueled ${refilled}×` : 'fuel used', gx, gy + 52, { color: theme.muted, size: 11, align: 'center' })
    text(ctx, `${Math.round(r.km * p)} km`, gx, 40, { color: theme.text, size: 20, align: 'center', weight: 700 })
    text(ctx, roundTrip ? (p < 0.5 ? 'heading out' : p < 1 ? 'heading home' : 'back home') : p < 1 ? 'on the road' : 'arrived', gx, 58, { color: theme.muted, size: 11, align: 'center' })
  }

  return (
    <div>
      <div className="row" style={{ marginTop: 0 }}>
        <select aria-label="Route" value={route} onChange={(e) => pickRoute(Number(e.target.value))} style={{ maxWidth: '100%' }}>
          {ROUTES.map((x, i) => <option key={x.name} value={i}>{x.name} (~{x.km} km)</option>)}
          <option value={-1}>Custom distance</option>
        </select>
      </div>
      <Stage world={[W, H]} running={running} onFrame={onFrame} label={`A car drives ${Math.round(r.km)} km using ${r.liters.toFixed(1)} liters of fuel, costing ${rupiah(r.total)} in total.`} className="sim-flat" />
      <PlayBar running={running} setRunning={setRunning} onReset={() => { prog.current = 0; setShown(0); setRunning(true) }} resetLabel="Drive again" />

      <div className="stats fc-stats">
        <div className="stat fc-big"><b><Roll>{rupiah(r.total * shown)}</Roll></b>Total trip cost</div>
        <div className="stat"><b><Roll>{rupiah(r.perPerson * shown)}</Roll></b>Per person ({passengers})</div>
        <div className="stat"><b>{r.liters.toFixed(1)} L</b>Fuel for {Math.round(r.km)} km</div>
        <div className="stat"><b>{rupiah(r.perKm)}</b>Cost per km</div>
      </div>

      <div className="fc-grid">
        <div>
          <label htmlFor="fc-d">Distance one way (km)</label>
          <input id="fc-d" type="number" inputMode="decimal" min={0} value={distance} onChange={(e) => { setDistance(e.target.value); setRoute(-1) }} />
        </div>
        <div>
          <label htmlFor="fc-c">Fuel economy</label>
          <div className="fc-inline">
            <input id="fc-c" type="number" inputMode="decimal" min={0} step={0.1} value={consumption} onChange={(e) => setConsumption(e.target.value)} />
            <Choice value={unit} options={[['kmpl', 'km/L'], ['l100', 'L/100 km']]} onChange={(u) => { setUnit(u); const v = num(consumption); if (v > 0) setConsumption(String(Math.round((100 / v) * 10) / 10)) }} />
          </div>
          {badConsumption && <p className="error">Enter a fuel economy above 0.</p>}
        </div>
        <div>
          <label htmlFor="fc-fuel">Fuel</label>
          <select id="fc-fuel" value={fuel} onChange={(e) => pickFuel(e.target.value)}>
            {FUEL_PRESETS.map((f) => <option key={f.id} value={f.id}>{f.name} (~{rupiah(f.price)}/L)</option>)}
            <option value="custom">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="fc-p">Price per liter (Rp)</label>
          <input id="fc-p" type="number" inputMode="decimal" min={0} step={100} value={price} onChange={(e) => { setPrice(e.target.value); setFuel('custom') }} />
        </div>
        <div>
          <label htmlFor="fc-x">Tolls, parking, extras (Rp, whole trip)</label>
          <input id="fc-x" type="number" inputMode="decimal" min={0} step={1000} value={extras} onChange={(e) => setExtras(e.target.value)} />
        </div>
        <div>
          <label htmlFor="fc-t">Tank size (L)</label>
          <input id="fc-t" type="number" inputMode="decimal" min={0} value={tank} onChange={(e) => setTank(e.target.value)} />
        </div>
      </div>
      <div className="row">
        <Toggle label="Round trip (there and back)" checked={roundTrip} onChange={setRoundTrip} />
        <span className="fc-pax">
          Passengers
          <button type="button" className="btn" aria-label="Fewer passengers" onClick={() => setPassengers(Math.max(1, passengers - 1))}>−</button>
          <b>{passengers}</b>
          <button type="button" className="btn" aria-label="More passengers" onClick={() => setPassengers(Math.min(20, passengers + 1))}>+</button>
        </span>
      </div>
      {r.refuels > 0 && <p className="chip">Plan about {r.refuels} refuel stop{r.refuels > 1 ? 's' : ''} starting from a full {tank} L tank.</p>}
      <Hint>Pick a route or type a distance, set your car&apos;s fuel economy and the pump price, and watch the drive add up. Fuel prices are approximate and change often, so edit the price to match today&apos;s pump.</Hint>
    </div>
  )
}
