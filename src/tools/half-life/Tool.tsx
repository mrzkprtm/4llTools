import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, rrect, text } from '../../sim/draw'
import { TAU, fmt } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { tone } from '../../sim/audio'
import { ISOTOPES, decayProbability, gridFor, stepDecay, theoretical } from './decay'

const W = 800
const H = 480
const GX = 20
const GY = 44
const GS = 420
const CX = 500
const CY = 44
const CW = 276
const CH = 236
const MAX = 2500
const PARENT = '#2f9e44'
const DAUGHTER = '#5c7cfa'
const FLASH = '#f59f00'

/** Readable big numbers: 5.73 thousand, 4.47 billion. */
function big(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e9) return `${fmt(v / 1e9, 2)} billion`
  if (a >= 1e6) return `${fmt(v / 1e6, 2)} million`
  return fmt(v, a < 10 ? 2 : 0)
}

export default function HalfLife() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [isoId, setIsoId] = useState('c14')
  const [count, setCount] = useState(1000)
  const [pace, setPace] = useState(3)
  const [customT, setCustomT] = useState(4)
  const [clicks, setClicks] = useState(false)
  const [theory, setTheory] = useState(true)
  const [info, setInfo] = useState({ h: 0, left: 1000 })
  const sim = useRef({
    state: new Uint8Array(MAX),
    flash: new Float32Array(MAX),
    at: new Float32Array(MAX),
    n0: 0,
    iso: '',
    h: 0,
    left: 0,
    history: [] as [number, number][],
    target: null as number | null,
  })
  const hover = useRef<{ x: number; y: number } | null>(null)

  const iso = ISOTOPES.find((i) => i.id === isoId) ?? ISOTOPES[0]
  const halfLife = iso.id === 'custom' ? customT : iso.halfLife
  const secPerHalfLife = iso.id === 'custom' ? customT : pace
  const s = sim.current

  function rebuild() {
    s.state.fill(0)
    s.flash.fill(0)
    s.at.fill(0)
    s.n0 = count
    s.iso = isoId
    s.h = 0
    s.left = count
    s.history = [[0, count]]
    s.target = null
  }
  function reset() {
    rebuild()
    setInfo({ h: 0, left: count })
  }
  if (s.n0 !== count || s.iso !== isoId) rebuild()

  function oneHalfLife() {
    s.target = s.h + 1
    setRunning(true)
  }

  function onPointer(p: SimPointer) {
    hover.current = { x: p.x, y: p.y }
  }

  const { cols, rows } = gridFor(s.n0)
  const cell = Math.min(GS / cols, GS / rows)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`${s.n0} ${iso.name} atoms decaying at random; ${info.left} are left after ${fmt(info.h, 2)} half-lives.`}
            onFrame={(ctx, f) => {
              // Advance time in units of half-lives.
              let dh = f.dt / secPerHalfLife
              if (s.target !== null && s.h + dh >= s.target) dh = Math.max(0, s.target - s.h)
              if (dh > 0) {
                const hit = stepDecay(s.state, s.n0, decayProbability(dh, 1))
                s.h += dh
                for (const i of hit) {
                  s.flash[i] = 1
                  s.at[i] = s.h
                }
                s.left -= hit.length
                if (hit.length && clicks) tone(1200 + Math.random() * 1600, 8, 'square', 0.04)
                const last = s.history[s.history.length - 1]
                if (s.h - last[0] > 0.02 || hit.length) s.history.push([s.h, s.left])
                if (s.history.length > 4000) s.history.splice(1, 1)
              }
              if (s.target !== null && s.h >= s.target - 1e-9) {
                s.target = null
                setRunning(false)
              }
              for (let i = 0; i < s.n0; i++) if (s.flash[i] > 0) s.flash[i] = Math.max(0, s.flash[i] - f.dt * 2.2)

              clear(ctx, W, H, theme.sunken)

              // Atom grid, batched by colour.
              const r = cell * 0.4
              const pos = (i: number) => [GX + (i % cols) * cell + cell / 2, GY + Math.floor(i / cols) * cell + cell / 2] as const
              for (const [st, color] of [[0, PARENT], [1, alpha(DAUGHTER, 0.55)]] as const) {
                ctx.beginPath()
                for (let i = 0; i < s.n0; i++) {
                  if (s.state[i] !== st) continue
                  const [x, y] = pos(i)
                  ctx.moveTo(x + r, y)
                  ctx.arc(x, y, r, 0, TAU)
                }
                ctx.fillStyle = color
                ctx.fill()
              }
              for (let i = 0; i < s.n0; i++)
                if (s.flash[i] > 0) {
                  const [x, y] = pos(i)
                  const k = s.flash[i]
                  circle(ctx, x, y, r * (1 + (1 - k) * 2.2), alpha(FLASH, k * 0.5))
                  circle(ctx, x, y, r, alpha(FLASH, k))
                }
              text(ctx, `${s.n0} ${iso.name} atoms`, GX, GY - 14, { color: theme.text, size: 14, weight: 700, mono: false })

              // Chart: atoms left against time in half-lives.
              const xmax = Math.max(6, Math.ceil(s.h + 0.25))
              const X = (h: number) => CX + (h / xmax) * CW
              const Y = (n: number) => CY + CH - (n / Math.max(1, s.n0)) * CH
              rrect(ctx, CX, CY, CW, CH, 4, theme.surface, theme.border)
              for (let k = 1; k <= 3; k++) {
                line(ctx, CX, Y(s.n0 / 2 ** k), CX + CW, Y(s.n0 / 2 ** k), alpha(theme.muted, 0.35), 1, [3, 4])
                text(ctx, ['½', '¼', '⅛'][k - 1], CX - 6, Y(s.n0 / 2 ** k) + 4, { color: theme.muted, size: 12, align: 'right' })
              }
              const step = xmax > 12 ? 2 : 1
              for (let k = step; k <= xmax; k += step) {
                line(ctx, X(k), CY, X(k), CY + CH, alpha(theme.muted, 0.35), 1, [3, 4])
                text(ctx, String(k), X(k), CY + CH + 16, { color: theme.muted, size: 12, align: 'center' })
              }
              text(ctx, 'N₀', CX - 6, CY + 10, { color: theme.muted, size: 12, align: 'right' })
              text(ctx, 'atoms left over time', CX, CY - 14, { color: theme.text, size: 14, weight: 700, mono: false })
              text(ctx, 'time (half-lives) →', CX + CW, CY + CH + 32, { color: theme.muted, size: 12, align: 'right' })
              if (theory) {
                ctx.beginPath()
                for (let i = 0; i <= 160; i++) {
                  const h = (i / 160) * xmax
                  const y = Y(theoretical(s.n0, h, 1))
                  if (i) ctx.lineTo(X(h), y)
                  else ctx.moveTo(X(h), y)
                }
                ctx.strokeStyle = theme.accent
                ctx.lineWidth = 2
                ctx.setLineDash([6, 4])
                ctx.stroke()
                ctx.setLineDash([])
              }
              ctx.beginPath()
              s.history.forEach(([h, n], i) => (i ? ctx.lineTo(X(h), Y(n)) : ctx.moveTo(X(h), Y(n))))
              ctx.strokeStyle = PARENT
              ctx.lineWidth = 2.5
              ctx.stroke()
              circle(ctx, X(s.h), Y(s.left), 5, PARENT, theme.surface, 2)

              // Hover: read the chart, or inspect an atom.
              const hv = hover.current
              if (hv && hv.x > CX && hv.x < CX + CW && hv.y > CY && hv.y < CY + CH) {
                const h = ((hv.x - CX) / CW) * xmax
                line(ctx, hv.x, CY, hv.x, CY + CH, alpha(theme.text, 0.5))
                const lbl = `${fmt(h, 2)} T½: expect ${Math.round(theoretical(s.n0, h, 1))}`
                rrect(ctx, CX + 6, CY + CH - 30, CW - 12, 22, 4, alpha(theme.surface, 0.9))
                text(ctx, lbl, CX + 12, CY + CH - 14, { color: theme.text, size: 12 })
              } else if (hv && hv.x > GX && hv.x < GX + cols * cell && hv.y > GY && hv.y < GY + rows * cell) {
                const i = Math.floor((hv.y - GY) / cell) * cols + Math.floor((hv.x - GX) / cell)
                if (i < s.n0) {
                  const [x, y] = pos(i)
                  circle(ctx, x, y, Math.max(r + 3, 6), undefined, theme.text, 2)
                  const msg = s.state[i] ? `atom ${i + 1} decayed at ${fmt(s.at[i], 2)} half-lives` : `atom ${i + 1} has not decayed yet`
                  rrect(ctx, GX, H - 26, GS, 22, 4, alpha(theme.surface, 0.92))
                  text(ctx, msg, GX + 8, H - 10, { color: theme.text, size: 12 })
                }
              }

              // Decay equation and parent/daughter split.
              const by = 340
              text(ctx, `${iso.parent}  →  ${iso.daughter}  +  ${iso.mode}`, CX, by, { color: theme.text, size: 18, weight: 700, mono: false })
              text(ctx, `half-life ${big(halfLife)} ${iso.unit}`, CX, by + 22, { color: theme.muted, size: 13 })
              const frac = s.n0 ? s.left / s.n0 : 0
              rrect(ctx, CX, by + 38, CW, 26, 5, alpha(DAUGHTER, 0.55))
              if (frac > 0) rrect(ctx, CX, by + 38, Math.max(6, CW * frac), 26, 5, PARENT)
              text(ctx, `${s.left} ${iso.parent}`, CX + 8, by + 56, { color: '#fff', size: 12, weight: 700 })
              text(ctx, `${s.n0 - s.left} ${iso.daughter}`, CX + CW - 8, by + 56, { color: theme.text, size: 12, weight: 700, align: 'right' })
              text(ctx, `Each atom has a ${fmt(decayProbability(0.1, 1) * 100, 1)}% chance to decay`, CX, by + 88, { color: theme.muted, size: 12 })
              text(ctx, 'in every tenth of a half-life.', CX, by + 104, { color: theme.muted, size: 12 })

              if (f.frame % 8 === 0 && (info.h !== s.h || info.left !== s.left)) setInfo({ h: s.h, left: s.left })
            }}
          />
          <Readout
            items={[
              ['Elapsed', `${big(info.h * halfLife)} ${iso.unit}`],
              ['Remaining', info.left],
              ['% remaining', `${fmt(s.n0 ? (info.left / s.n0) * 100 : 0, 1)}%`],
              ['Half-lives', fmt(info.h, 2)],
              ['Expected left', fmt(theoretical(s.n0, info.h, 1), 0)],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={reset}>
        <button type="button" className="btn" onClick={oneHalfLife}>
          Run 1 half-life
        </button>
      </PlayBar>
      <Select label="Isotope" value={isoId} options={ISOTOPES.map((i) => [i.id, i.id === 'custom' ? 'Custom half-life' : `${i.name} (${big(i.halfLife)} ${i.unit})`] as const)} onChange={setIsoId} />
      <Slider label="Atoms" value={count} min={100} max={MAX} step={100} onChange={setCount} />
      {iso.id === 'custom' ? (
        <Slider label="Half-life" value={customT} min={0.5} max={20} step={0.5} unit=" s" onChange={setCustomT} />
      ) : (
        <Slider label="Display pace: 1 half-life =" value={pace} min={0.5} max={10} step={0.5} unit=" s" onChange={setPace} />
      )}
      <Toggle label="Theoretical curve N₀·2^(−t/T½)" checked={theory} onChange={setTheory} />
      <Toggle label="Geiger counter clicks" checked={clicks} onChange={setClicks} />
      <Legend items={[[PARENT, `${iso.parent} (undecayed)`], [DAUGHTER, `${iso.daughter} (decayed)`], [FLASH, 'decaying now']]} />
      <Hint>No single atom knows when it will decay, yet the crowd halves every half-life. Press “Run 1 half-life” a few times, and hover the atoms or the chart to inspect them. Fewer atoms means a noisier curve.</Hint>
    </SimLayout>
  )
}
