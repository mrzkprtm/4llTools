import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, rrect, text } from '../../sim/draw'
import { TAU, clamp } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { ELEMENTS, chargeLabel, configString, element, isStable, shellCounts, superscriptConfig, type Category } from './atom'

const W = 800
const H = 500
const CX = 250
const CY = 214
const SHELL = [70, 108, 146, 184, 222]
const NR = 4.6
const BINS = [
  { kind: 'p', label: 'Protons', x: 40, color: '#e03131' },
  { kind: 'n', label: 'Neutrons', x: 180, color: '#868e96' },
  { kind: 'e', label: 'Electrons', x: 320, color: '#1c7ed6' },
] as const
const DARK: Record<string, string> = { '#e03131': '#8f1515', '#868e96': '#3d4247', '#1c7ed6': '#0b4280' }
const BIN_Y = 434
const BIN_W = 120
const BIN_H = 52
const TILE: Record<Category, string> = {
  nonmetal: '#2f9e44',
  'noble gas': '#ae3ec9',
  'alkali metal': '#e03131',
  'alkaline earth metal': '#f76707',
  metalloid: '#0ca678',
  halogen: '#1c7ed6',
  'transition metal': '#f59f00',
  'post-transition metal': '#5c7cfa',
}

type Kind = 'p' | 'n' | 'e'
interface Particle {
  kind: Kind
  x: number
  y: number
  phase: number
}
interface Atom {
  p: number
  n: number
  e: number
}
const LIMIT: Atom = { p: 36, n: 60, e: 38 }

/** Position of slot i in a sunflower spiral: a compact, evenly packed nucleus. */
function slot(i: number, total: number): [number, number] {
  if (total === 1) return [0, 0]
  const r = NR * 1.05 * Math.sqrt(i + 0.5)
  const a = i * 2.399963
  return [Math.cos(a) * r, Math.sin(a) * r]
}

const binOf = (k: Kind) => BINS.find((b) => b.kind === k)!

export default function AtomBuilder() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [atom, setAtomState] = useState<Atom>({ p: 6, n: 6, e: 6 })
  const [labels, setLabels] = useState(true)
  const sim = useRef({ nucleons: [] as Particle[], electrons: [] as Particle[], leaving: [] as (Particle & { life: number })[], t: 0 })
  const s = sim.current

  function setAtom(a: Atom) {
    setAtomState({ p: clamp(a.p, 0, LIMIT.p), n: clamp(a.n, 0, LIMIT.n), e: clamp(a.e, 0, LIMIT.e) })
  }
  const change = (k: Kind, d: number) => setAtom({ ...atom, [k]: atom[k] + d })

  function newParticle(kind: Kind): Particle {
    const b = binOf(kind)
    return { kind, x: b.x + BIN_W / 2 + (Math.random() - 0.5) * 30, y: BIN_Y + BIN_H / 2, phase: Math.random() * TAU }
  }

  function leave(p: Particle) {
    s.leaving.push({ ...p, life: 1 })
  }

  /** Brings the particle lists in line with the counts, animating additions and removals. */
  function reconcile() {
    const want = { p: atom.p, n: atom.n }
    for (const k of ['p', 'n'] as const) {
      let have = s.nucleons.filter((q) => q.kind === k).length
      while (have < want[k]) {
        // Interleave new nucleons so protons and neutrons stay mixed.
        const q = newParticle(k)
        const at = Math.floor(Math.random() * (s.nucleons.length + 1))
        s.nucleons.splice(Math.min(at, s.nucleons.length), 0, q)
        have++
      }
      while (have > want[k]) {
        const i = s.nucleons.map((q) => q.kind).lastIndexOf(k)
        leave(s.nucleons[i])
        s.nucleons.splice(i, 1)
        have--
      }
    }
    while (s.electrons.length < atom.e) s.electrons.push(newParticle('e'))
    while (s.electrons.length > atom.e) leave(s.electrons.pop()!)
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down') return
    for (const b of BINS)
      if (p.x > b.x && p.x < b.x + BIN_W && p.y > BIN_Y && p.y < BIN_Y + BIN_H) {
        change(b.kind, p.shift ? -1 : 1)
        return
      }
    // Click a particle in the atom to take it out.
    let best: { kind: Kind; list: Particle[]; i: number; d: number } | null = null
    for (const [list, r] of [[s.electrons, 9], [s.nucleons, NR + 1]] as const)
      list.forEach((q, i) => {
        const d = Math.hypot(q.x - p.x, q.y - p.y)
        if (d < r && (!best || d < best.d)) best = { kind: q.kind, list, i, d }
      })
    const hit = best as { kind: Kind; list: Particle[]; i: number; d: number } | null
    if (hit) {
      leave(hit.list[hit.i])
      hit.list.splice(hit.i, 1)
      change(hit.kind, -1)
    }
  }

  const el = element(atom.p)
  const A = atom.p + atom.n
  const charge = atom.p - atom.e
  const stable = el ? isStable(atom.p, atom.n) : false
  const shells = shellCounts(atom.e)
  const full = configString(atom.e)
  const short = configString(atom.e, true)

  function sphere(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.35, color)
    g.addColorStop(1, DARK[color] ?? color)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fillStyle = g
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 0.6
    ctx.stroke()
  }

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="pointer"
            label={`Bohr model with ${atom.p} protons, ${atom.n} neutrons and ${atom.e} electrons${el ? `: ${el.name}-${A}` : ''}.`}
            onFrame={(ctx, f) => {
              reconcile()
              s.t += f.dt
              const ease = f.frame < 2 ? 1 : Math.min(1, (f.dt || 1 / 60) * 7)
              clear(ctx, W, H, theme.sunken)

              // Shells.
              shells.forEach((_, k) => circle(ctx, CX, CY, SHELL[k], undefined, alpha(theme.text, 0.18), 1.5))
              const nuc = s.nucleons.length
              const nucR = nuc ? NR * 1.05 * Math.sqrt(nuc) + NR : 0
              if (nuc) circle(ctx, CX, CY, nucR + 6, alpha(theme.accent, 0.08))

              // Nucleus: drawn outside-in so the middle sits on top, with a gentle jiggle.
              for (let i = nuc - 1; i >= 0; i--) {
                const q = s.nucleons[i]
                const [ox, oy] = slot(i, nuc)
                const jig = 0.7
                const tx = CX + ox + Math.sin(s.t * 9 + q.phase) * jig
                const ty = CY + oy + Math.cos(s.t * 11 + q.phase * 1.3) * jig
                q.x += (tx - q.x) * ease
                q.y += (ty - q.y) * ease
                sphere(ctx, q.x, q.y, NR, q.kind === 'p' ? '#e03131' : '#868e96')
              }

              // Electrons orbit their shells; inner shells go round faster.
              let idx = 0
              shells.forEach((count, k) => {
                const r = SHELL[k]
                const w = 1.4 / (k + 1)
                for (let j = 0; j < count; j++, idx++) {
                  const q = s.electrons[idx]
                  if (!q) continue
                  const a = s.t * w + (TAU * j) / count + k * 0.7
                  const tx = CX + Math.cos(a) * r
                  const ty = CY + Math.sin(a) * r
                  q.x += (tx - q.x) * ease
                  q.y += (ty - q.y) * ease
                  circle(ctx, q.x, q.y, 9, alpha('#1c7ed6', 0.18))
                  sphere(ctx, q.x, q.y, 4.5, '#1c7ed6')
                }
                if (labels) text(ctx, String(count), CX + r * Math.cos(-0.78) + 6, CY + r * Math.sin(-0.78) - 6, { color: theme.muted, size: 12, weight: 700 })
              })

              // Particles heading back to their bins.
              s.leaving = s.leaving.filter((q) => {
                const b = binOf(q.kind)
                q.x += (b.x + BIN_W / 2 - q.x) * Math.min(1, (f.dt || 1 / 60) * 6)
                q.y += (BIN_Y + BIN_H / 2 - q.y) * Math.min(1, (f.dt || 1 / 60) * 6)
                q.life -= f.dt || 1 / 60
                ctx.globalAlpha = clamp(q.life, 0, 1)
                sphere(ctx, q.x, q.y, q.kind === 'e' ? 4.5 : NR, b.color)
                ctx.globalAlpha = 1
                return q.life > 0
              })

              // Bins.
              for (const b of BINS) {
                rrect(ctx, b.x, BIN_Y, BIN_W, BIN_H, 10, alpha(b.color, 0.14), alpha(b.color, 0.7), 1.5)
                sphere(ctx, b.x + 20, BIN_Y + 20, 7, b.color)
                sphere(ctx, b.x + 30, BIN_Y + 30, 7, b.color)
                text(ctx, b.label, b.x + 44, BIN_Y + 22, { color: theme.text, size: 13, weight: 700, mono: false })
                text(ctx, `${atom[b.kind]}`, b.x + 44, BIN_Y + 40, { color: theme.muted, size: 13, weight: 700 })
              }

              // Periodic table tile.
              const tx = 540
              const ty = 20
              const tw = 200
              const th = 206
              const tc = el ? TILE[el.category] : theme.muted
              rrect(ctx, tx, ty, tw, th, 12, alpha(tc, theme.dark ? 0.22 : 0.14), tc, 2.5)
              text(ctx, String(atom.p), tx + 14, ty + 28, { color: theme.text, size: 20, weight: 700 })
              if (el) text(ctx, String(el.mass), tx + tw - 14, ty + 26, { color: theme.muted, size: 13, align: 'right' })
              text(ctx, el ? el.symbol : '?', tx + tw / 2, ty + 116, { color: theme.text, size: 72, weight: 700, align: 'center', mono: false })
              text(ctx, el ? el.name : 'no protons', tx + tw / 2, ty + 152, { color: theme.text, size: 17, weight: 600, align: 'center', mono: false })
              text(ctx, el ? el.category : 'not an element', tx + tw / 2, ty + 180, { color: theme.muted, size: 13, align: 'center' })

              // Isotope notation with mass number, atomic number and charge.
              const iy = 290
              const sym = el ? el.symbol : '?'
              ctx.font = `700 40px ui-sans-serif, system-ui, sans-serif`
              const sw = ctx.measureText(sym).width
              const sx = tx + tw / 2 - sw / 2 + 10
              text(ctx, sym, sx, iy, { color: theme.text, size: 40, weight: 700, mono: false })
              text(ctx, String(A), sx - 4, iy - 22, { color: theme.text, size: 16, align: 'right', weight: 700 })
              text(ctx, String(atom.p), sx - 4, iy + 2, { color: theme.muted, size: 16, align: 'right' })
              if (charge) text(ctx, `${Math.abs(charge) > 1 ? Math.abs(charge) : ''}${charge > 0 ? '+' : '−'}`, sx + sw + 4, iy - 22, { color: theme.accent, size: 16, weight: 700 })

              const stab = !el ? '' : stable ? 'stable isotope' : 'unstable: radioactive'
              if (el) rrect(ctx, tx, iy + 18, tw, 26, 13, alpha(stable ? theme.ok : theme.danger, 0.15))
              text(ctx, stab, tx + tw / 2, iy + 36, { color: stable ? theme.ok : theme.danger, size: 13, weight: 700, align: 'center' })
              text(ctx, chargeLabel(charge), tx + tw / 2, iy + 66, { color: theme.text, size: 13, align: 'center' })
              text(ctx, superscriptConfig(short), tx + tw / 2, iy + 96, { color: theme.text, size: 15, weight: 600, align: 'center' })
              text(ctx, `shells ${shells.join(', ') || '—'}`, tx + tw / 2, iy + 120, { color: theme.muted, size: 13, align: 'center' })
              if (el && !stable) {
                const near = el.stable.reduce((a, b) => (Math.abs(b - atom.n) < Math.abs(a - atom.n) ? b : a))
                text(ctx, `nearest stable: ${el.symbol}-${atom.p + near}`, tx + tw / 2, iy + 144, { color: theme.muted, size: 12, align: 'center' })
              }
            }}
          />
          <Readout
            items={[
              ['Atomic number Z', atom.p],
              ['Mass number A', A],
              ['Charge', charge > 0 ? `+${charge}` : charge < 0 ? `−${-charge}` : '0'],
              ['Isotope', el ? `${el.symbol}-${A}` : '—'],
              ['Stability', el ? (stable ? 'stable' : 'unstable') : '—'],
            ]}
          />
          <p className="sim-mono" style={{ margin: 0 }}>
            Electron configuration: {superscriptConfig(full)}
          </p>
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => setAtom({ p: 0, n: 0, e: 0 })} resetLabel="Empty" />
      {BINS.map((b) => (
        <div key={b.kind} className="row" style={{ margin: 0, gap: 6, alignItems: 'center' }}>
          <button type="button" className="btn" onClick={() => change(b.kind, -1)} aria-label={`Remove one ${b.label.toLowerCase().slice(0, -1)}`}>
            −
          </button>
          <button type="button" className="btn" onClick={() => change(b.kind, 1)} aria-label={`Add one ${b.label.toLowerCase().slice(0, -1)}`}>
            +
          </button>
          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
            <span style={{ color: b.color }}>●</span> {b.label}: <span className="sim-mono">{atom[b.kind]}</span>
          </span>
        </div>
      ))}
      <Select
        label="Jump to element"
        value={String(atom.p)}
        options={[['0', 'Empty'] as const, ...ELEMENTS.map((e) => [String(e.z), `${e.z} ${e.symbol} ${e.name}`] as const)]}
        onChange={(v) => {
          const e = element(Number(v))
          setAtom(e ? { p: e.z, n: e.stable[0], e: e.z } : { p: 0, n: 0, e: 0 })
        }}
      />
      <div className="row" style={{ margin: 0, gap: 6 }}>
        <button type="button" className="btn" onClick={() => setAtom({ ...atom, e: atom.p })}>
          Make neutral
        </button>
        <button type="button" className="btn" disabled={!el} onClick={() => el && setAtom({ ...atom, n: el.stable[0] })}>
          Stable isotope
        </button>
      </div>
      <Toggle label="Shell counts" checked={labels} onChange={setLabels} />
      <Hint>Click a bin to add a particle (Shift-click takes one away) or click a particle in the atom to remove it. Protons decide the element, neutrons the isotope, and electrons the charge.</Hint>
    </SimLayout>
  )
}
