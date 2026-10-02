import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { arrow, chart, circle, clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { EQUINOX_DAY, YEAR, dayLabel, dayLength, declination, noonElevation, season, sunLongitude } from './seasons'

const W = 820
const H = 500
const D2R = Math.PI / 180
// Orbit view.
const OX = 245
const OY = 150
const RX = 190
const RY = 72
// Globe view.
const GX = 665
const GY = 132
const GR = 88
// Charts.
const C1 = { x: 44, y: 336, w: 350, h: 130 }
const C2 = { x: 454, y: 336, w: 350, h: 130 }
const MONTHS = 'JFMAMJJASOND'
const DAYLIGHT = '#ffd43b'
const NIGHT = '#364fc7'
const ELEV = '#ff922b'

const latLabel = (v: number) => (v === 0 ? '0° (equator)' : `${Math.abs(v)}° ${v > 0 ? 'N' : 'S'}`)
const hours = (h: number) => `${Math.floor(h + 1e-9)} h ${String(Math.round((h - Math.floor(h + 1e-9)) * 60) % 60).padStart(2, '0')} m`

/** Screen angle of Earth on the tilted orbit ellipse for a given day. */
const orbitAngle = (day: number) => (270 - sunLongitude(day)) * D2R

export default function EarthSeasons() {
  const [running, setRunning] = useRunning()
  const [tilt, setTilt] = useState(23.44)
  const [lat, setLat] = useState(45)
  const [speed, setSpeed] = useState(20)
  const day = useRef(172)
  const [shown, setShown] = useState(172)
  const drag = useRef<'orbit' | 'globe' | 'chart' | null>(null)

  const curves = useMemo(() => {
    const len: number[] = []
    const elev: number[] = []
    for (let d = 1; d <= 365; d++) {
      const dec = declination(d, tilt)
      len.push(dayLength(lat, dec))
      elev.push(Math.max(-30, noonElevation(lat, dec)))
    }
    return { len, elev }
  }, [lat, tilt])

  function setDay(d: number) {
    day.current = ((d - 1 + 365) % 365) + 1
    setShown(day.current)
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') drag.current = p.y > 305 ? 'chart' : p.x > 485 ? 'globe' : 'orbit'
    if (!drag.current || !p.down) {
      drag.current = null
      return
    }
    if (drag.current === 'orbit') {
      const a = Math.atan2((p.y - OY) / RY, (p.x - OX) / RX) / D2R
      setDay(EQUINOX_DAY + (((270 - a + 720) % 360) / 360) * YEAR)
    } else if (drag.current === 'chart') {
      const c = p.x > 420 ? C2 : C1
      setDay(1 + clamp((p.x - c.x) / c.w, 0, 1) * 364)
    } else {
      // Latitude from the pointer's height along the tilted axis.
      const dec = declination(day.current, tilt) * D2R
      const along = ((p.x - GX) * -Math.sin(dec) + (p.y - GY) * -Math.cos(dec)) / GR
      setLat(Math.round(Math.asin(clamp(along, -1, 1)) / D2R))
    }
  }

  const dec = declination(shown, tilt)
  const len = dayLength(lat, dec)

  function drawOrbit(ctx: CanvasRenderingContext2D, d: number) {
    rrect(ctx, 10, 10, 470, 290, 10, '#15140f', '#2f2d28')
    ctx.beginPath()
    ctx.ellipse(OX, OY, RX, RY, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 1
    ctx.stroke()
    const keys: [number, string][] = [[172, 'June solstice'], [356, 'December solstice'], [80, 'March equinox'], [266, 'September equinox']]
    for (const [kd, name] of keys) {
      const a = orbitAngle(kd)
      const x = OX + RX * Math.cos(a)
      const y = OY + RY * Math.sin(a)
      circle(ctx, x, y, 3, 'rgba(255,255,255,0.4)')
      const below = Math.sin(a) > 0.5
      const above = Math.sin(a) < -0.5
      text(ctx, name, clamp(x, 80, 410), y + (below ? 30 : above ? -12 : 44), { color: 'rgba(255,255,255,0.5)', size: 12, align: 'center' })
    }
    const a = orbitAngle(d)
    const ex = OX + RX * Math.cos(a)
    const ey = OY + RY * Math.sin(a)
    const er = 16 + 4 * Math.sin(a)
    const sun = () => {
      circle(ctx, OX, OY, 34, 'rgba(255, 200, 80, 0.12)')
      circle(ctx, OX, OY, 22, '#ffd43b')
      text(ctx, 'Sun', OX, OY + 4, { color: '#5c3d00', size: 12, align: 'center', weight: 700 })
    }
    const earth = () => {
      circle(ctx, ex, ey, er, '#1b3a57')
      const toSun = Math.atan2(OY - ey, OX - ex)
      ctx.beginPath()
      ctx.arc(ex, ey, er, toSun - Math.PI / 2, toSun + Math.PI / 2)
      ctx.closePath()
      ctx.fillStyle = '#4dabf7'
      ctx.fill()
      // The axis keeps pointing the same way in space all year.
      const ax = Math.sin(tilt * D2R)
      const ay = -Math.cos(tilt * D2R)
      line(ctx, ex - ax * (er + 10), ey - ay * (er + 10), ex + ax * (er + 12), ey + ay * (er + 12), '#fff', 2)
      text(ctx, 'N', ex + ax * (er + 22), ey + ay * (er + 22) + 4, { color: '#fff', size: 12, align: 'center', weight: 700 })
    }
    if (ey < OY) {
      earth()
      sun()
    } else {
      sun()
      earth()
    }
    text(ctx, 'orbit (seen from above the plane) · drag Earth', 22, 290, { color: 'rgba(255,255,255,0.45)', size: 12 })
  }

  function drawGlobe(ctx: CanvasRenderingContext2D, dec: number) {
    rrect(ctx, 490, 10, 320, 290, 10, '#15140f', '#2f2d28')
    for (let k = 0; k < 5; k++) arrow(ctx, 500, 60 + k * 36, 540, 60 + k * 36, 'rgba(255, 212, 59, 0.5)', 1.5, 7)
    text(ctx, 'sunlight', 502, 34, { color: 'rgba(255, 212, 59, 0.8)', size: 12 })
    const d = dec * D2R
    const a = [-Math.sin(d), -Math.cos(d)]
    const s = [-Math.cos(d), Math.sin(d)]
    const phi = lat * D2R
    circle(ctx, GX, GY, GR, '#1b2a3d')
    ctx.beginPath()
    ctx.arc(GX, GY, GR, Math.PI / 2, (3 * Math.PI) / 2)
    ctx.closePath()
    ctx.fillStyle = '#3d7ab8'
    ctx.fill()
    line(ctx, GX, GY - GR, GX, GY + GR, 'rgba(255,255,255,0.35)', 1, [3, 3])
    // A circle of latitude, tipped slightly toward us so the far side shows.
    const ring = (lt: number, lit: string, dark: string, width: number) => {
      const N = 96
      let prev: [number, number, boolean, boolean] | null = null
      for (let i = 0; i <= N; i++) {
        const h = (i / N) * Math.PI * 2
        const u = Math.cos(lt) * Math.cos(h)
        const v = Math.sin(lt) + 0.22 * Math.cos(lt) * Math.sin(h)
        const x = GX + GR * (u * s[0] + v * a[0])
        const y = GY + GR * (u * s[1] + v * a[1])
        const day = Math.cos(lt) * Math.cos(d) * Math.cos(h) + Math.sin(lt) * Math.sin(d) > 0
        const front = Math.sin(h) > 0
        if (prev) line(ctx, prev[0], prev[1], x, y, prev[2] ? lit : dark, front ? width : width * 0.6, front ? undefined : [2, 3])
        prev = [x, y, day, front]
      }
    }
    ring(0, 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.2)', 1)
    ring(phi, DAYLIGHT, '#91a7ff', 3)
    line(ctx, GX - a[0] * (GR + 14), GY - a[1] * (GR + 14), GX + a[0] * (GR + 18), GY + a[1] * (GR + 18), '#fff', 2)
    text(ctx, 'N', GX + a[0] * (GR + 28), GY + a[1] * (GR + 28) + 4, { color: '#fff', size: 12, align: 'center', weight: 700 })
    // Where the Sun is straight overhead at noon, and our observer at noon.
    const sub = [GX + GR * (Math.cos(d) * s[0] + Math.sin(d) * a[0]), GY + GR * (Math.cos(d) * s[1] + Math.sin(d) * a[1])]
    circle(ctx, sub[0], sub[1], 5, '#ffd43b', '#000', 1)
    const obs = [GX + GR * (Math.cos(phi) * s[0] + Math.sin(phi) * a[0]), GY + GR * (Math.cos(phi) * s[1] + Math.sin(phi) * a[1])]
    circle(ctx, obs[0], obs[1], 5, '#fff', '#000', 1)
    text(ctx, latLabel(lat), 800, 34, { color: '#fff', size: 12, align: 'right' })
    const L = dayLength(lat, dec)
    text(ctx, `day ${hours(L)} · night ${hours(24 - L)}`, GX - 10, 250, { color: 'rgba(255,255,255,0.8)', size: 12, align: 'center' })
    rrect(ctx, 520, 262, 270, 14, 4, NIGHT)
    rrect(ctx, 520 + (270 * (24 - L)) / 48, 262, (270 * L) / 24, 14, 4, DAYLIGHT)
    text(ctx, '0h', 520, 292, { color: 'rgba(255,255,255,0.5)', size: 12 })
    text(ctx, 'noon', 655, 292, { color: 'rgba(255,255,255,0.5)', size: 12, align: 'center' })
    text(ctx, '24h', 790, 292, { color: 'rgba(255,255,255,0.5)', size: 12, align: 'right' })
  }

  function drawChart(ctx: CanvasRenderingContext2D, c: typeof C1, data: number[], lo: number, hi: number, color: string, title: string, ticks: number[], unit: string, d: number) {
    rrect(ctx, c.x - 34, c.y - 26, c.w + 44, c.h + 56, 10, '#15140f', '#2f2d28')
    text(ctx, title, c.x, c.y - 10, { color: 'rgba(255,255,255,0.7)', size: 12 })
    for (const t of ticks) {
      const y = c.y + c.h - ((t - lo) / (hi - lo)) * c.h
      line(ctx, c.x, y, c.x + c.w, y, t === 0 && lo < 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)')
      text(ctx, `${t}${unit}`, c.x - 5, y + 4, { color: 'rgba(255,255,255,0.5)', size: 12, align: 'right' })
    }
    chart(ctx, c.x, c.y, c.w, c.h, [{ data, color, width: 2.5 }], { min: lo, max: hi })
    for (let m = 0; m < 12; m++) text(ctx, MONTHS[m], c.x + ((m * 30.4 + 15) / 365) * c.w, c.y + c.h + 16, { color: 'rgba(255,255,255,0.45)', size: 12, align: 'center' })
    const x = c.x + ((d - 1) / 364) * c.w
    const v = data[clamp(Math.round(d) - 1, 0, 364)]
    line(ctx, x, c.y, x, c.y + c.h, 'rgba(255,255,255,0.5)', 1, [3, 3])
    circle(ctx, x, c.y + c.h - ((v - lo) / (hi - lo)) * c.h, 5, color, '#000', 1)
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            onPointer={onPointer}
            label={`Earth on ${dayLabel(shown)} with an axial tilt of ${tilt} degrees. At latitude ${latLabel(lat)} the day lasts ${hours(len)}.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0 && !drag.current) {
                day.current += f.dt * speed
                if (day.current >= 366) day.current -= 365
              }
              const d = day.current
              const dc = declination(d, tilt)
              clear(ctx, W, H, '#0d0c0b')
              drawOrbit(ctx, d)
              drawGlobe(ctx, dc)
              drawChart(ctx, C1, curves.len, 0, 24, DAYLIGHT, `day length at ${latLabel(lat)}`, [0, 6, 12, 18, 24], 'h', d)
              drawChart(ctx, C2, curves.elev, -30, 90, ELEV, 'Sun’s height at noon', [-30, 0, 30, 60, 90], '°', d)
              if (f.frame % 6 === 0 && f.dt > 0) setShown(d)
            }}
          />
          <Readout
            items={[
              ['Date', dayLabel(shown)],
              ['Subsolar latitude', `${fmt(dec, 1)}°`],
              ['Day length', hours(len)],
              ['Noon sun elevation', `${fmt(noonElevation(lat, dec), 1)}°`],
              ['Season (north)', season(shown, true, tilt)],
              ['Season (south)', season(shown, false, tilt)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} />
      <Slider label="Date" value={Math.round(shown)} min={1} max={365} format={dayLabel} onChange={setDay} />
      <Slider label="Speed" value={speed} min={2} max={60} unit=" days/s" onChange={setSpeed} />
      <Slider label="Axial tilt" value={tilt} min={0} max={90} step={0.01} unit="°" format={(v) => fmt(v, 2)} onChange={setTilt} />
      <Slider label="Latitude" value={lat} min={-90} max={90} format={latLabel} onChange={setLat} />
      <div className="row" style={{ margin: 0, gap: 6 }}>
        <button type="button" className="btn" onClick={() => setTilt(23.44)}>
          Earth’s tilt
        </button>
        <button type="button" className="btn" onClick={() => setTilt(0)}>
          No tilt
        </button>
        <button type="button" className="btn" onClick={() => setTilt(82.23)}>
          Uranus-like
        </button>
      </div>
      <Hint>Seasons come from the tilt, not the distance to the Sun: the axis keeps pointing the same way, so each hemisphere leans toward the Sun for half the year. Drag Earth along its orbit, drag on the globe to pick a latitude, or set the tilt to 0 and watch the seasons vanish.</Hint>
    </SimLayout>
  )
}
