import { useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, SimLayout, Slider, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { fmt, rng } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { DEAD, INF, MARKET, QZONE, REC, SUS, VAC, applyPolicies, counts, createWorld, effectiveR, infectAgent, meanFieldBeta, sirCurve, stepWorld, type Extra, type World } from './epidemic'

const W = 820
const H = 500
const BX = 10
const BY = 10
const BW = 480
const BH = 480
const SEEDS = 3
const COLORS = ['#1c7ed6', '#e03131', '#2f9e44', '#ae3ec9', '#868e96']
const NAMES = ['Susceptible', 'Infected', 'Recovered', 'Vaccinated', 'Deceased']
/** Chart stacking order, bottom to top: the infected band sits on the axis so its peak is easy to see. */
const STACK = [INF, SUS, VAC, REC, DEAD]

export default function EpidemicSimulator() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [speed, setSpeed] = useState(5)
  const [pop, setPop] = useState(400)
  const [radius, setRadius] = useState(8)
  const [pInfect, setPInfect] = useState(60)
  const [recoverDays, setRecoverDays] = useState(12)
  const [distancing, setDistancing] = useState(0)
  const [vaccinated, setVaccinated] = useState(0)
  const [mortality, setMortality] = useState(3)
  const [extra, setExtra] = useState<Extra>('none')
  const random = useRef(rng(7))
  const world = useRef<World>(null as unknown as World)
  if (!world.current) world.current = createWorld(pop, BW, BH, 0, 0, SEEDS, 'none', random.current)
  const [info, setInfo] = useState({ day: 0, inf: SEEDS, peak: SEEDS, peakDay: 0, total: SEEDS, dead: 0, r: NaN })

  function reset(n = pop, ex = extra) {
    random.current = rng(Math.floor(Math.random() * 1e9))
    world.current = createWorld(n, BW, BH, distancing / 100, vaccinated / 100, SEEDS, ex, random.current)
    setInfo({ day: 0, inf: SEEDS, peak: SEEDS, peakDay: 0, total: SEEDS, dead: 0, r: NaN })
  }

  const params = { radius, pInfect: pInfect / 100, recoverDays, mortality: mortality / 100, extra }
  const beta = meanFieldBeta(params.pInfect, radius, pop, BW * BH)
  const gamma = 1 / recoverDays
  const ode = useMemo(() => {
    const i0 = SEEDS / pop
    return sirCurve(beta, gamma, Math.max(0, 1 - vaccinated / 100 - i0), i0, 400)
  }, [beta, gamma, pop, vaccinated])

  function onPointer(p: SimPointer) {
    if (p.type !== 'down') return
    const wd = world.current
    const px = p.x - BX
    const py = p.y - BY
    let best = -1
    let bd = 20 * 20
    for (let i = 0; i < wd.n; i++) {
      if (wd.state[i] !== SUS) continue
      const d = (wd.x[i] - px) ** 2 + (wd.y[i] - py) ** 2
      if (d < bd) (bd = d), (best = i)
    }
    if (best >= 0) infectAgent(wd, best, recoverDays, random.current)
  }

  function drawChart(ctx: CanvasRenderingContext2D) {
    const wd = world.current
    const hist = wd.history
    const cx = 548
    const cy = 40
    const cw = 256
    const ch = 240
    const span = Math.max(60, Math.ceil((wd.day + 8) / 20) * 20)
    const X = (d: number) => cx + (d / span) * cw
    const Y = (f: number) => cy + ch - f * ch
    text(ctx, 'Share of people over time', 510, 24, { color: theme.text, size: 13, weight: 600 })
    rrect(ctx, cx, cy, cw, ch, 0, theme.surface)
    const m = hist.length
    if (m > 1) {
      const n = wd.n
      const base = new Float32Array(m)
      for (const s of STACK) {
        ctx.beginPath()
        for (let k = 0; k < m; k++) ctx.lineTo(X(k * 0.5), Y((base[k] + hist[k][s]) / n))
        for (let k = m - 1; k >= 0; k--) ctx.lineTo(X(k * 0.5), Y(base[k] / n))
        ctx.closePath()
        ctx.fillStyle = alpha(COLORS[s], s === INF ? 0.9 : 0.55)
        ctx.fill()
        for (let k = 0; k < m; k++) base[k] += hist[k][s]
      }
    }
    // The well-mixed ODE prediction for the infected share.
    ctx.beginPath()
    for (let k = 0; k < ode.length && k * 0.5 <= span; k++) ctx.lineTo(X(k * 0.5), Y(ode[k][1]))
    ctx.strokeStyle = theme.text
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 4])
    ctx.stroke()
    ctx.setLineDash([])
    if (wd.peak > 0) {
      const px = X(wd.peakDay)
      const py = Y(wd.peak / wd.n)
      line(ctx, px, py, px, cy + ch, theme.text, 1, [2, 3])
      circle(ctx, px, py, 4, COLORS[INF], theme.surface, 2)
      text(ctx, `peak ${wd.peak}`, Math.min(px + 6, cx + cw - 70), Math.max(py - 6, cy + 14), { color: theme.text, size: 12, weight: 600 })
    }
    line(ctx, cx, cy + ch, cx + cw, cy + ch, theme.border)
    line(ctx, cx, cy, cx, cy + ch, theme.border)
    for (const f of [0, 0.5, 1]) text(ctx, `${f * 100}%`, cx - 5, Y(f) + 4, { color: theme.muted, size: 12, align: 'right' })
    text(ctx, 'day 0', cx, cy + ch + 16, { color: theme.muted, size: 12 })
    text(ctx, `day ${span}`, cx + cw, cy + ch + 16, { color: theme.muted, size: 12, align: 'right' })

    line(ctx, 512, 330, 540, 330, theme.text, 1.5, [5, 4])
    text(ctx, 'infected, well-mixed SIR model', 548, 334, { color: theme.muted, size: 12 })
    text(ctx, `R₀ = β/γ ≈ ${fmt(beta / gamma, 2)}  (β ${fmt(beta, 3)}, γ ${fmt(gamma, 3)} /day)`, 512, 356, { color: theme.muted, size: 12 })

    const c = counts(wd)
    NAMES.forEach((name, s) => {
      const y = 386 + s * 21
      circle(ctx, 518, y - 4, 6, COLORS[s])
      text(ctx, name, 532, y, { color: theme.text, size: 13 })
      rrect(ctx, 650, y - 11, 110 * (c[s] / wd.n), 12, 3, alpha(COLORS[s], 0.6))
      text(ctx, String(c[s]), 804, y, { color: theme.text, size: 13, align: 'right' })
    })
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Crowd of ${pop} people with ${info.inf} infected on day ${Math.floor(info.day)}, and a stacked chart of susceptible, infected and recovered shares.`}
            onFrame={(ctx, f) => {
              const wd = world.current
              if (f.dt > 0 && counts(wd)[INF] > 0) {
                const days = f.dt * speed
                const n = Math.ceil(days / 0.05)
                for (let i = 0; i < n; i++) stepWorld(wd, params, days / n, random.current)
              }
              clear(ctx, W, H, theme.sunken)
              rrect(ctx, BX, BY, BW, BH, 6, theme.surface, theme.border)
              ctx.save()
              ctx.translate(BX, BY)
              if (extra === 'market') {
                rrect(ctx, BW / 2 - MARKET, BH / 2 - MARKET, MARKET * 2, MARKET * 2, 6, alpha('#f59f00', 0.16), alpha('#f59f00', 0.7), 1.5)
                text(ctx, 'market', BW / 2, BH / 2 - MARKET - 5, { color: theme.muted, size: 12, align: 'center' })
              }
              if (extra === 'quarantine') {
                rrect(ctx, 0, 0, QZONE, QZONE, 6, alpha(COLORS[INF], 0.08), alpha(COLORS[INF], 0.6), 1.5)
                text(ctx, 'quarantine', QZONE / 2, QZONE + 15, { color: theme.muted, size: 12, align: 'center' })
              }
              // Faint contact discs around infected people show the infection radius.
              ctx.fillStyle = alpha(COLORS[INF], 0.12)
              ctx.beginPath()
              for (let i = 0; i < wd.n; i++)
                if (wd.state[i] === INF && !wd.quarantined[i]) {
                  ctx.moveTo(wd.x[i] + radius, wd.y[i])
                  ctx.arc(wd.x[i], wd.y[i], radius, 0, Math.PI * 2)
                }
              ctx.fill()
              for (const s of [SUS, VAC, REC, DEAD, INF]) {
                ctx.beginPath()
                for (let i = 0; i < wd.n; i++) {
                  if (wd.state[i] !== s) continue
                  const r = s === DEAD ? 2 : wd.still[i] ? 3.4 : 3
                  ctx.moveTo(wd.x[i] + r, wd.y[i])
                  ctx.arc(wd.x[i], wd.y[i], r, 0, Math.PI * 2)
                }
                ctx.fillStyle = COLORS[s]
                ctx.fill()
              }
              ctx.restore()
              drawChart(ctx)
              if (f.frame % 10 === 0) {
                const c = counts(wd)
                setInfo({ day: wd.day, inf: c[INF], peak: wd.peak, peakDay: wd.peakDay, total: wd.everInfected, dead: c[DEAD], r: effectiveR(wd) })
              }
            }}
          />
          <Legend items={NAMES.map((n, i) => [COLORS[i], n] as const)} />
          <Readout
            items={[
              ['Day', Math.floor(info.day)],
              ['Infected now', info.inf],
              ['Peak infected', info.peak],
              ['Peak day', Math.round(info.peakDay)],
              ['Total infected', `${info.total} · ${Math.round((info.total / pop) * 100)}%`],
              ['Deaths', info.dead],
              ['Effective R', info.inf === 0 && info.day > 1 ? 'over' : fmt(info.r, 2)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => reset()} resetLabel="New outbreak" />
      <Slider label="Speed" value={speed} min={1} max={15} unit=" days/s" onChange={setSpeed} />
      <Slider label="Population" value={pop} min={100} max={1000} step={50} onChange={(v) => { setPop(v); reset(v) }} />
      <Slider label="Infection radius" value={radius} min={3} max={20} onChange={setRadius} />
      <Slider label="Infection chance per day of contact" value={pInfect} min={5} max={100} step={5} unit="%" onChange={setPInfect} />
      <Slider label="Days to recover" value={recoverDays} min={3} max={30} onChange={setRecoverDays} />
      <Slider label="Practising distancing" value={distancing} min={0} max={90} step={5} unit="%" onChange={(v) => { setDistancing(v); applyPolicies(world.current, v / 100, vaccinated / 100) }} />
      <Slider label="Vaccinated" value={vaccinated} min={0} max={90} step={5} unit="%" onChange={(v) => { setVaccinated(v); applyPolicies(world.current, distancing / 100, v / 100) }} />
      <Slider label="Mortality" value={mortality} min={0} max={30} unit="%" onChange={setMortality} />
      <Choice label="Extra" value={extra} options={[['none', 'None'], ['market', 'Market'], ['quarantine', 'Quarantine']]} onChange={(v) => { setExtra(v); reset(pop, v) }} />
      <Hint>Click a person to infect them. Raise distancing or vaccination and watch the red hump on the chart get lower and wider: that is flattening the curve. The dashed line is the classic SIR equation for a perfectly mixed crowd.</Hint>
    </SimLayout>
  )
}
