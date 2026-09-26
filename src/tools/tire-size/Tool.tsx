import { useRef, useState } from 'react'
import Stage from '../../sim/Stage'
import { Hint, PlayBar, useRunning } from '../../sim/controls'
import { circle, line, text } from '../../sim/draw'
import { alpha, useTheme } from '../../sim/theme'
import Roll from '../../motion/Roll'
import { actualSpeed, ASPECTS, diffPercent, parseTire, RIMS, tireLabel, tireStats, WIDTHS, type Tire } from './logic'
import './tool.css'

const W = 640
const H = 300
const GROUND = 270
const COLORS = ['#1c7ed6', '#e8590c']

function TireInput({ tire, onChange, label, color }: { tire: Tire; onChange: (t: Tire) => void; label: string; color: string }) {
  const [draft, setDraft] = useState(tireLabel(tire))
  const [bad, setBad] = useState(false)
  const pick = (t: Tire) => {
    onChange(t)
    setDraft(tireLabel(t))
    setBad(false)
  }
  const sel = (k: keyof Tire, opts: number[], name: string) => (
    <select aria-label={`${label} ${name}`} value={tire[k]} onChange={(e) => pick({ ...tire, [k]: Number(e.target.value) })}>
      {(opts.includes(tire[k]) ? opts : [...opts, tire[k]].sort((a, b) => a - b)).map((v) => <option key={v} value={v}>{k === 'rim' ? `R${v}` : v}</option>)}
    </select>
  )
  return (
    <div className="tz-card" style={{ borderTopColor: color }}>
      <label htmlFor={`tz-${label}`}>{label}</label>
      <input
        id={`tz-${label}`}
        type="text"
        className="tz-text"
        value={draft}
        spellCheck={false}
        placeholder="185/65R15"
        onChange={(e) => {
          setDraft(e.target.value)
          const t = parseTire(e.target.value)
          setBad(!t)
          if (t) onChange(t)
        }}
      />
      {bad && <p className="error tz-err">Use the format 185/65R15.</p>}
      <div className="tz-sels">
        {sel('width', WIDTHS, 'width')}<span>/</span>{sel('aspect', ASPECTS, 'aspect')}{sel('rim', RIMS, 'rim')}
      </div>
    </div>
  )
}

export default function TireSize() {
  const [a, setA] = useState<Tire>({ width: 185, aspect: 65, rim: 15 })
  const [b, setB] = useState<Tire>({ width: 195, aspect: 55, rim: 16 })
  const [running, setRunning] = useRunning()
  const theme = useTheme()
  const dist = useRef(0)
  const sa = tireStats(a)
  const sb = tireStats(b)
  const diff = diffPercent(a, b)
  const big = Math.abs(diff) > 3

  function drawTire(ctx: CanvasRenderingContext2D, cx: number, t: Tire, scale: number, color: string, label: string) {
    const s = tireStats(t)
    const R = (s.diameter / 2) * scale
    const r = (s.rimMm / 2) * scale
    const cy = GROUND - R
    const angle = dist.current / R
    circle(ctx, cx, cy, R, theme.dark ? '#2b2a27' : '#2d2c29')
    // Tread blocks.
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    for (let i = 0; i < 28; i++) {
      ctx.rotate((Math.PI * 2) / 28)
      ctx.fillStyle = '#48463f'
      ctx.fillRect(-3, -R, 6, 6)
    }
    circle(ctx, 0, 0, r, theme.dark ? '#8a8a8a' : '#c9c9c9', '#777', 2)
    for (let i = 0; i < 5; i++) {
      const a2 = (i / 5) * Math.PI * 2
      line(ctx, Math.cos(a2) * r * 0.25, Math.sin(a2) * r * 0.25, Math.cos(a2) * r * 0.92, Math.sin(a2) * r * 0.92, '#6b6b6b', r * 0.18)
    }
    circle(ctx, 0, 0, r * 0.25, '#9a9a9a', '#666', 1.5)
    circle(ctx, 0, -(R + r) / 2, Math.max(4, (R - r) * 0.18), color)
    ctx.restore()
    // Sidewall bracket.
    line(ctx, cx + R + 10, cy - R, cx + R + 10, cy - r, alpha(theme.text, 0.6), 1.5)
    text(ctx, `${Math.round(s.sidewall)} mm`, cx + R + 14, cy - (R + r) / 2 + 4, { color: theme.muted, size: 10 })
    text(ctx, label, cx, 20, { color, size: 14, weight: 700, align: 'center' })
    text(ctx, `${Math.round(s.diameter)} mm · ${(dist.current / (2 * Math.PI * R)).toFixed(1)} turns`, cx, 38, { color: theme.muted, size: 11, align: 'center' })
  }

  function onFrame(ctx: CanvasRenderingContext2D, f: { dt: number }) {
    dist.current += f.dt * 140
    ctx.clearRect(0, 0, W, H)
    const scale = 200 / Math.max(sa.diameter, sb.diameter)
    // Top of the larger tire, as a reference line.
    const top = GROUND - Math.max(sa.diameter, sb.diameter) * scale
    line(ctx, 30, top, W - 30, top, alpha(theme.text, 0.25), 1, [4, 4])
    line(ctx, 0, GROUND, W, GROUND, theme.text, 2)
    for (let x = -(dist.current % 40); x < W; x += 40) line(ctx, x, GROUND + 8, x + 16, GROUND + 8, alpha(theme.text, 0.3), 3)
    drawTire(ctx, W * 0.27, a, scale, COLORS[0], tireLabel(a))
    drawTire(ctx, W * 0.73, b, scale, COLORS[1], tireLabel(b))
  }

  const rows: [string, (s: typeof sa) => number, string, number][] = [
    ['Overall diameter', (s) => s.diameter, 'mm', 1],
    ['Circumference', (s) => s.circumference, 'mm', 0],
    ['Sidewall height', (s) => s.sidewall, 'mm', 1],
    ['Revolutions per km', (s) => s.revsPerKm, '', 1],
  ]

  return (
    <div>
      <div className="tz-inputs">
        <TireInput tire={a} onChange={setA} label="Current tire" color={COLORS[0]} />
        <TireInput tire={b} onChange={setB} label="New tire" color={COLORS[1]} />
      </div>
      <Stage world={[W, H]} running={running} onFrame={onFrame} className="sim-flat" label={`${tireLabel(a)} is ${Math.round(sa.diameter)} mm tall; ${tireLabel(b)} is ${Math.round(sb.diameter)} mm, a ${diff.toFixed(1)}% difference.`} />
      <PlayBar running={running} setRunning={setRunning} onReset={() => { dist.current = 0 }} resetLabel="Reset turns" />

      <div className={`tz-diff ${big ? 'bad' : 'good'}`} key={big ? 'b' : 'g'}>
        <b><Roll>{`${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(2)}%`}</Roll></b>
        <span>{big ? 'Diameter differs by more than 3%: expect speedometer, ABS and clearance issues. Check with your tire shop.' : 'Within the usual ±3% range for a safe swap.'}</span>
      </div>

      <div className="tz-table">
        <table className="simple">
          <thead><tr><th /><th style={{ color: COLORS[0] }}>{tireLabel(a)}</th><th style={{ color: COLORS[1] }}>{tireLabel(b)}</th><th>Change</th></tr></thead>
          <tbody>
            {rows.map(([name, get, unit, dp]) => (
              <tr key={name}><td>{name}</td><td>{get(sa).toFixed(dp)} {unit}</td><td>{get(sb).toFixed(dp)} {unit}</td><td>{get(sb) - get(sa) >= 0 ? '+' : ''}{(get(sb) - get(sa)).toFixed(dp)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="tz-h">Speedometer check</h3>
      <div className="tz-table">
        <table className="simple">
          <thead><tr><th>Speedometer shows</th><th>Actual speed</th><th>Difference</th></tr></thead>
          <tbody>
            {[40, 60, 80, 100].map((v) => {
              const act = actualSpeed(a, b, v)
              return <tr key={v}><td>{v} km/h</td><td><b>{act.toFixed(1)} km/h</b></td><td className={Math.abs(act - v) > 3 ? 'tz-warn' : ''}>{act - v >= 0 ? '+' : ''}{(act - v).toFixed(1)} km/h</td></tr>
            })}
          </tbody>
        </table>
      </div>
      <Hint>Type sizes like 185/65R15 or use the dropdowns. Both tires roll at the same road speed, so the smaller one has to spin more turns. Bigger tires make your speedometer read low.</Hint>
    </div>
  )
}
