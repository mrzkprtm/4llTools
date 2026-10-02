import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { fmt, rng } from '../../sim/math'
import { alpha } from '../../sim/theme'
import { PLANETS, dateFromDay, dayNumber, orbitRadius, position } from './orrery'

const W = 800
const H = 540
const CX = 400
const CY = 270
const R_OUT = 250
const SPEEDS = [0, 1, 3, 7, 15, 30, 60, 120, 365, 1000, 3650]

type Scale = 'log' | 'linear' | 'inner'

function toPx(scale: Scale, r: number): number {
  if (scale === 'log') return 30 + ((R_OUT - 30) * Math.log(r / 0.3)) / Math.log(31 / 0.3)
  return r * (R_OUT / (scale === 'inner' ? 1.7 : 31))
}

const iso = (d: number) => dateFromDay(d).toISOString().slice(0, 10)
const pretty = (d: number) => dateFromDay(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default function SolarSystem() {
  const [running, setRunning] = useRunning()
  const [speedIdx, setSpeedIdx] = useState(5)
  const [scale, setScale] = useState<Scale>('log')
  const [orbits, setOrbits] = useState(true)
  const [labels, setLabels] = useState(true)
  const [elliptical, setElliptical] = useState(true)
  const [selected, setSelected] = useState(2)
  const day = useRef<number>(NaN)
  if (Number.isNaN(day.current)) day.current = dayNumber(new Date())
  const [info, setInfo] = useState(() => ({ day: day.current }))
  const days = Math.sign(speedIdx) * SPEEDS[Math.abs(speedIdx)]

  function setDay(d: number) {
    day.current = d
    setInfo({ day: d })
  }

  function planetXY(i: number, d: number): [number, number] {
    const { lon, r } = position(PLANETS[i], d, elliptical)
    const R = toPx(scale, r)
    const a = (lon * Math.PI) / 180
    return [CX + R * Math.cos(a), CY - R * Math.sin(a)]
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down') return
    let best = -1
    let bd = 18
    PLANETS.forEach((_, i) => {
      const [x, y] = planetXY(i, day.current)
      const d = Math.hypot(x - p.x, y - p.y)
      if (d < bd) (bd = d), (best = i)
    })
    if (best >= 0) setSelected(best)
  }

  const sel = PLANETS[selected]
  const selPos = position(sel, info.day, elliptical)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            onPointer={onPointer}
            label={`Orrery of the eight planets on ${pretty(info.day)}; ${sel.name} is selected.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) day.current += f.dt * days
              const d = day.current
              clear(ctx, W, H, '#0d0c0b')
              const stars = rng(5)
              for (let i = 0; i < 140; i++) circle(ctx, stars() * W, stars() * H, stars() * 1.1, 'rgba(255,255,255,0.35)')
              line(ctx, CX, CY, W - 12, CY, 'rgba(255,255,255,0.18)', 1, [4, 6])
              text(ctx, '0° (vernal equinox)', W - 12, CY - 8, { color: 'rgba(255,255,255,0.45)', size: 12, align: 'right' })
              PLANETS.forEach((p, i) => {
                if (!orbits) return
                ctx.beginPath()
                for (let k = 0; k <= 120; k++) {
                  const nu = (k / 120) * Math.PI * 2
                  const r = elliptical ? orbitRadius(p, nu) : p.a
                  const a = nu + (p.peri * Math.PI) / 180
                  const R = toPx(scale, r)
                  const x = CX + R * Math.cos(a)
                  const y = CY - R * Math.sin(a)
                  if (k) ctx.lineTo(x, y)
                  else ctx.moveTo(x, y)
                }
                ctx.strokeStyle = i === selected ? alpha(p.color, 0.6) : 'rgba(255,255,255,0.14)'
                ctx.lineWidth = i === selected ? 1.5 : 1
                ctx.stroke()
              })
              circle(ctx, CX, CY, 26, 'rgba(255, 200, 80, 0.12)')
              circle(ctx, CX, CY, 16, 'rgba(255, 200, 80, 0.25)')
              circle(ctx, CX, CY, 10, '#ffd43b')
              PLANETS.forEach((p, i) => {
                const [x, y] = planetXY(i, d)
                if (x < -20 || x > W + 20 || y < -20 || y > H + 20) return
                if (i === selected) {
                  line(ctx, CX, CY, x, y, alpha(p.color, 0.45), 1, [3, 4])
                  circle(ctx, x, y, p.size + 6, undefined, '#fff', 1.5)
                }
                if (p.name === 'Saturn') {
                  ctx.beginPath()
                  ctx.ellipse(x, y, p.size * 1.9, p.size * 0.7, -0.4, 0, Math.PI * 2)
                  ctx.strokeStyle = alpha(p.color, 0.8)
                  ctx.lineWidth = 1.5
                  ctx.stroke()
                }
                circle(ctx, x, y, p.size, p.color)
                if (labels) text(ctx, p.name, x + p.size + 5, y - p.size - 2, { color: 'rgba(255,255,255,0.8)', size: 12 })
              })
              if (scale === 'inner') text(ctx, 'Jupiter and beyond are off the edge at this scale', 12, H - 44, { color: 'rgba(255,255,255,0.5)', size: 12 })
              text(ctx, pretty(d), 12, H - 16, { color: '#fff', size: 18, weight: 600 })
              text(ctx, days === 0 ? 'time stopped' : `${days > 0 ? '+' : '−'}${Math.abs(days)} days / s`, W - 12, H - 16, { color: 'rgba(255,255,255,0.6)', size: 13, align: 'right' })

              // Info card for the selected planet.
              const p = PLANETS[selected]
              const now = position(p, d, elliptical)
              rrect(ctx, 10, 10, 236, 146, 8, 'rgba(30, 28, 25, 0.88)', alpha(p.color, 0.7))
              circle(ctx, 28, 32, 7, p.color)
              text(ctx, p.name, 42, 38, { color: '#fff', size: 16, weight: 700 })
              const rows = [
                p.note,
                `orbit   ${fmt(p.a, 3)} AU (e ${fmt(p.e, 3)})`,
                `year    ${fmt(p.period, 1)} d = ${fmt(p.period / 365.25, 2)} yr`,
                `moons   ${p.moons}`,
                `now     ${fmt(now.r, 3)} AU at ${fmt(now.lon, 1)}°`,
              ]
              rows.forEach((s, k) => text(ctx, s, 20, 62 + k * 20, { color: k ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)', size: 12, mono: k > 0 }))
              if (f.frame % 10 === 0 && f.dt > 0) setInfo({ day: d })
            }}
          />
          <Readout
            items={[
              ['Date', pretty(info.day)],
              ['Days since J2000', fmt(info.day, 1)],
              [`${sel.name} longitude`, `${fmt(selPos.lon, 1)}°`],
              [`${sel.name} from Sun`, `${fmt(selPos.r, 3)} AU`],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning}>
        <button type="button" className="btn" onClick={() => setDay(dayNumber(new Date()))}>
          Today
        </button>
      </PlayBar>
      <div className="sim-field">
        <label className="sim-label" htmlFor="orrery-date">
          Date
        </label>
        <input
          id="orrery-date"
          type="date"
          className="sim-text"
          value={iso(info.day)}
          min="1600-01-01"
          max="2400-12-31"
          onChange={(e) => {
            const [y, m, dd] = e.target.value.split('-').map(Number)
            if (y && m && dd) setDay(dayNumber(new Date(Date.UTC(y, m - 1, dd, 12))))
          }}
        />
      </div>
      <Slider
        label="Time speed"
        value={speedIdx}
        min={-10}
        max={10}
        format={(v) => (v === 0 ? 'stopped' : `${v < 0 ? '−' : ''}${SPEEDS[Math.abs(v)]} d/s`)}
        onChange={setSpeedIdx}
      />
      <Choice label="Distance scale" value={scale} options={[['log', 'Log'], ['linear', 'True'], ['inner', 'Inner']]} onChange={setScale} />
      <Toggle label="Show orbits" checked={orbits} onChange={setOrbits} />
      <Toggle label="Labels" checked={labels} onChange={setLabels} />
      <Toggle label="Elliptical orbits (Kepler)" checked={elliptical} onChange={setElliptical} />
      <Hint>Click a planet for its facts. Drag the time slider left to run time backwards. On the true scale the inner planets huddle near the Sun: that is why the log scale is the default. Positions are approximate (about a degree) and ignore orbital tilt.</Hint>
    </SimLayout>
  )
}
