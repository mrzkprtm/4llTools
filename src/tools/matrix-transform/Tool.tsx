import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { arrow, circle, clear, line, rrect, text } from '../../sim/draw'
import { fmt, round } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { apply, det, eigen2x2, IDENTITY, lerpMatrix, PRESETS, trace, type Mat } from './matrix'

const W = 800
const H = 520
const OX = W / 2
const OY = H / 2
const IC = '#2f9e44'
const JC = '#e03131'
const GRID = '#5c7cfa'
const POS = '#f59f00'
const NEG = '#ae3ec9'
// The letter F, so reflections are easy to spot.
const F_SHAPE: [number, number][] = [[0, 0], [0.3, 0], [0.3, 0.7], [0.8, 0.7], [0.8, 1], [0.3, 1], [0.3, 1.4], [1, 1.4], [1, 1.7], [0, 1.7]].map(([x, y]) => [x - 2.3, y + 0.25])

const ease = (u: number) => u * u * (3 - 2 * u)
/** Morph loop: grow for 2 s, hold, shrink back, hold. */
function morphT(ph: number) {
  const p = ph % 6
  if (p < 2) return ease(p / 2)
  if (p < 3.5) return 1
  if (p < 5.5) return ease(1 - (p - 3.5) / 2)
  return 0
}

const show = (v: number) => String(round(v, 3))

export default function MatrixTransform() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [cells, setCells] = useState<string[]>(['1', '1', '0', '1'])
  const [preset, setPreset] = useState('shear')
  const [tView, setTView] = useState(0)
  const [zoom, setZoom] = useState(64)
  const [showEigen, setShowEigen] = useState(true)
  const [showCircle, setShowCircle] = useState(false)
  const tRef = useRef(0)
  const ph = useRef(0)
  const drag = useRef<'i' | 'j' | 'v' | null>(null)
  const probe = useRef<[number, number]>([1.6, 1.1])

  const M = cells.map((c) => (Number.isFinite(parseFloat(c)) ? parseFloat(c) : 0)) as Mat
  const D = det(M)
  const eig = eigen2x2(M)

  function setMatrix(m: Mat, id = 'custom') {
    setCells(m.map(show))
    setPreset(id)
  }
  function setT(t: number) {
    setRunning(false)
    tRef.current = t
    setTView(t)
  }

  const U = zoom
  const sx = (x: number) => OX + x * U
  const sy = (y: number) => OY - y * U

  function onPointer(p: SimPointer) {
    const A = lerpMatrix(IDENTITY, M, tRef.current)
    const snap = (v: number) => (p.shift ? round(v, 2) : Math.round(v * 10) / 10)
    const x = snap((p.x - OX) / U)
    const y = snap((OY - p.y) / U)
    if (p.type === 'down') {
      const [ix, iy] = apply(A, 1, 0)
      const [jx, jy] = apply(A, 0, 1)
      if (Math.hypot(p.x - sx(ix), p.y - sy(iy)) < 20) drag.current = 'i'
      else if (Math.hypot(p.x - sx(jx), p.y - sy(jy)) < 20) drag.current = 'j'
      else drag.current = 'v'
      if (drag.current !== 'v') {
        setT(1)
        ph.current = 2
      }
    }
    if (!drag.current) return
    if (drag.current === 'i') setMatrix([x, M[1], y, M[3]])
    else if (drag.current === 'j') setMatrix([M[0], x, M[2], y])
    else {
      // Place the probe so that its image lands under the pointer when the matrix is invertible.
      const a = lerpMatrix(IDENTITY, M, tRef.current)
      const d = det(a)
      probe.current = Math.abs(d) > 1e-6 ? [(a[3] * x - a[1] * y) / d, (-a[2] * x + a[0] * y) / d] : [x, y]
    }
    if (p.type === 'up') drag.current = null
  }

  const eigText = eig.real ? (eig.all ? `${fmt(eig.values[0], 3)} (every direction)` : `${fmt(eig.values[0], 3)}, ${fmt(eig.values[1], 3)}`) : `${fmt(eig.re, 3)} ± ${fmt(eig.im, 3)}i`

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            cursor="grab"
            label={`The plane transformed by the matrix with rows ${M[0]}, ${M[1]} and ${M[2]}, ${M[3]}; determinant ${fmt(D, 3)}.`}
            onFrame={(ctx, f) => {
              if (f.dt > 0) {
                ph.current += f.dt
                tRef.current = morphT(ph.current)
                if (f.frame % 5 === 0) setTView(round(tRef.current, 2))
              }
              const t = tRef.current
              const A = lerpMatrix(IDENTITY, M, t)
              const P = (x: number, y: number): [number, number] => {
                const [a, b] = apply(A, x, y)
                return [sx(a), sy(b)]
              }
              clear(ctx, W, H, theme.sunken)
              // Original grid.
              const R = Math.ceil(Math.max(W, H) / U / 2) + 1
              ctx.beginPath()
              for (let i = -R; i <= R; i++) {
                ctx.moveTo(sx(i), 0)
                ctx.lineTo(sx(i), H)
                ctx.moveTo(0, sy(i))
                ctx.lineTo(W, sy(i))
              }
              ctx.strokeStyle = alpha(theme.muted, 0.16)
              ctx.lineWidth = 1
              ctx.stroke()
              // Transformed grid: images of the lines x = i and y = i.
              const G = 14
              ctx.beginPath()
              for (let i = -G; i <= G; i++) {
                if (i === 0) continue
                ctx.moveTo(...P(i, -G))
                ctx.lineTo(...P(i, G))
                ctx.moveTo(...P(-G, i))
                ctx.lineTo(...P(G, i))
              }
              ctx.strokeStyle = alpha(GRID, 0.38)
              ctx.lineWidth = 1.2
              ctx.stroke()
              line(ctx, ...P(-G, 0), ...P(G, 0), alpha(GRID, 0.85), 2)
              line(ctx, ...P(0, -G), ...P(0, G), alpha(GRID, 0.85), 2)

              // Unit square → parallelogram whose signed area is the determinant.
              const d = det(A)
              ctx.beginPath()
              ctx.moveTo(...P(0, 0))
              ctx.lineTo(...P(1, 0))
              ctx.lineTo(...P(1, 1))
              ctx.lineTo(...P(0, 1))
              ctx.closePath()
              ctx.fillStyle = alpha(d >= 0 ? POS : NEG, 0.32)
              ctx.fill()
              ctx.strokeStyle = d >= 0 ? POS : NEG
              ctx.lineWidth = 1.5
              ctx.stroke()
              const [cx, cy] = P(0.5, 0.5)
              text(ctx, `det ${fmt(d, 2)}`, cx, cy + 4, { color: theme.text, size: 13, align: 'center', weight: 700 })

              // The letter F and, optionally, the unit circle turned into an ellipse.
              ctx.beginPath()
              F_SHAPE.forEach(([x, y], i) => (i ? ctx.lineTo(...P(x, y)) : ctx.moveTo(...P(x, y))))
              ctx.closePath()
              ctx.fillStyle = alpha(theme.text, 0.18)
              ctx.fill()
              ctx.strokeStyle = theme.text
              ctx.lineWidth = 1.5
              ctx.stroke()
              if (showCircle) {
                ctx.beginPath()
                for (let k = 0; k <= 64; k++) ctx.lineTo(...P(Math.cos((k / 64) * Math.PI * 2), Math.sin((k / 64) * Math.PI * 2)))
                ctx.strokeStyle = theme.accent
                ctx.lineWidth = 2
                ctx.stroke()
              }

              // Eigen-directions stay on their own line throughout the morph; vectors there only stretch.
              if (showEigen && eig.real)
                eig.vectors.forEach(([ex, ey], k) => {
                  line(ctx, sx(-ex * 20), sy(-ey * 20), sx(ex * 20), sy(ey * 20), alpha(theme.accent, 0.75), 1.5, [7, 6])
                  const lk = eig.values[k]
                  const lamNow = 1 - t + t * lk
                  arrow(ctx, OX, OY, sx(ex * lamNow), sy(ey * lamNow), theme.accent, 3, 10)
                  const lx = Math.min(W - 80, Math.max(10, sx(ex * 3.2)))
                  const ly = Math.min(H - 10, Math.max(20, sy(ey * 3.2)))
                  rrect(ctx, lx - 4, ly - 15, 76, 21, 5, alpha(theme.surface, 0.9))
                  text(ctx, `λ = ${fmt(lk, 2)}`, lx, ly, { color: theme.accent, size: 13, weight: 700 })
                })

              // Probe vector v and its image.
              const [vx, vy] = probe.current
              line(ctx, OX, OY, sx(vx), sy(vy), alpha(theme.text, 0.45), 1.5, [4, 4])
              circle(ctx, sx(vx), sy(vy), 3, alpha(theme.text, 0.5))
              const [avx, avy] = P(vx, vy)
              arrow(ctx, OX, OY, avx, avy, theme.text, 2.5, 10)
              text(ctx, 'Av', avx + 8, avy - 6, { color: theme.text, size: 13, weight: 700 })

              // Basis vectors with draggable tips.
              const [ix, iy] = P(1, 0)
              const [jx, jy] = P(0, 1)
              arrow(ctx, OX, OY, ix, iy, IC, 4, 14)
              arrow(ctx, OX, OY, jx, jy, JC, 4, 14)
              circle(ctx, ix, iy, 9, alpha(IC, 0.25), IC, 2)
              circle(ctx, jx, jy, 9, alpha(JC, 0.25), JC, 2)
              text(ctx, 'î', ix + 12, iy + 16, { color: IC, size: 18, weight: 800, mono: false })
              text(ctx, 'ĵ', jx - 20, jy - 8, { color: JC, size: 18, weight: 800, mono: false })
              circle(ctx, OX, OY, 3.5, theme.text)

              // Current matrix A(t) in the corner.
              rrect(ctx, 10, 10, 178, 70, 8, alpha(theme.surface, 0.92), theme.border)
              text(ctx, `t = ${t.toFixed(2)}`, 20, 30, { color: theme.muted, size: 12 })
              text(ctx, `[ ${A[0].toFixed(2).padStart(5)}  ${A[1].toFixed(2).padStart(5)} ]`, 20, 50, { color: theme.text, size: 13 })
              text(ctx, `[ ${A[2].toFixed(2).padStart(5)}  ${A[3].toFixed(2).padStart(5)} ]`, 20, 69, { color: theme.text, size: 13 })
            }}
          />
          <Legend items={[[IC, 'î = first column'], [JC, 'ĵ = second column'], [POS, 'unit square (det > 0)'], [NEG, 'flipped (det < 0)'], [theme.accent, 'eigenvectors']]} />
          <Readout
            items={[
              ['Determinant', fmt(D, 3)],
              ['Trace', fmt(trace(M), 3)],
              ['Eigenvalues', eigText],
              ['Orientation', Math.abs(D) < 1e-9 ? 'collapsed' : D > 0 ? 'kept' : 'flipped'],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={() => { ph.current = 0; tRef.current = 0; setTView(0); setRunning(true) }} resetLabel="Replay" />
      <Slider label="Morph t" value={tView} min={0} max={1} step={0.01} onChange={setT} />
      <Select label="Preset" value={preset} options={[...PRESETS.map((p) => [p.id, p.name] as [string, string]), ['custom', 'Custom']]} onChange={(id) => { const p = PRESETS.find((q) => q.id === id); if (p) setMatrix(p.m, id) }} />
      <div className="sim-field">
        <span className="sim-label">Matrix A</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '0 8px', borderLeft: '2px solid var(--text)', borderRight: '2px solid var(--text)', borderRadius: 4 }}>
          {cells.map((c, i) => (
            <input key={i} type="number" step={0.1} aria-label={`Row ${(i >> 1) + 1}, column ${(i & 1) + 1}`} className="sim-mono" style={{ padding: '6px 8px', color: i % 2 ? JC : IC }} value={c}
              onChange={(e) => { const next = [...cells]; next[i] = e.target.value; setCells(next); setPreset('custom') }} />
          ))}
        </div>
      </div>
      <Slider label="Zoom" value={zoom} min={30} max={110} unit=" px/unit" onChange={setZoom} />
      <Toggle label="Show eigenvectors" checked={showEigen} onChange={setShowEigen} />
      <Toggle label="Show unit circle" checked={showCircle} onChange={setShowCircle} />
      <Hint>Drag the green and red arrow tips to change the matrix columns (hold Shift for fine steps), or drag anywhere to move the probe vector. The shaded square's area is the determinant; along an eigenvector the arrow only stretches.</Hint>
    </SimLayout>
  )
}
