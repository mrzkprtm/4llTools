import { useEffect, useMemo, useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { clear, line, rrect, text } from '../../sim/draw'
import { clamp, fmt } from '../../sim/math'
import { angleAt, apply, distance, len, mul, orthonormalize, project, rotation, type Mat3, type Vec3 } from './geometry'
import { ELEMENTS, MOLECULES, type El } from './molecules'

const W = 800
const H = 520
const CX = W / 2
const CY = H / 2 + 10
const BOND_R = 0.11
const START: Mat3 = mul(rotation([1, 0, 0], 0.35), rotation([0, 1, 0], -0.5))

type Style = 'ball' | 'space'
interface Shown {
  x: number
  y: number
  z: number
  r: number
}

/** Mixes a #rrggbb colour towards white (k > 0) or black (k < 0). */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`
}

export default function MoleculeViewer() {
  const [running, setRunning] = useRunning()
  const [id, setId] = useState('h2o')
  const [style, setStyle] = useState<Style>('ball')
  const [labels, setLabels] = useState(true)
  const [auto, setAuto] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [picked, setPicked] = useState<number[]>([])
  const view = useRef({ R: START, spin: [0, 0] as [number, number], shown: [] as Shown[] })
  const drag = useRef<{ x: number; y: number; moved: number; t: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const mol = MOLECULES.find((m) => m.id === id) ?? MOLECULES[0]
  const extent = useMemo(() => Math.max(1, ...mol.atoms.map((a) => len(a.p) + ELEMENTS[a.el].vdw * 0.6)), [mol])

  // Mouse wheel zoom (the Stage has no wheel hook, so listen on its canvas).
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(clamp(Math.round(zoomRef.current * Math.exp(-e.deltaY * 0.0015) * 100) / 100, 0.4, 3))
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
  }, [])

  function choose(next: string) {
    setId(next)
    setPicked([])
    view.current.R = START
  }

  function resetView() {
    view.current.R = START
    view.current.spin = [0, 0]
    setZoom(1)
    setPicked([])
  }

  function rotateBy(dx: number, dy: number) {
    const v = view.current
    v.R = orthonormalize(mul(mul(rotation([0, 1, 0], dx), rotation([1, 0, 0], dy)), v.R))
  }

  function onPointer(p: SimPointer) {
    const d = drag.current
    if (p.type === 'down') {
      drag.current = { x: p.x, y: p.y, moved: 0, t: performance.now() }
      view.current.spin = [0, 0]
    } else if (p.type === 'move' && d && p.down) {
      const dx = (p.x - d.x) * 0.01
      const dy = (p.y - d.y) * 0.01
      rotateBy(dx, dy)
      const now = performance.now()
      const dt = Math.max(1, now - d.t) / 1000
      view.current.spin = [dx / dt, dy / dt]
      Object.assign(d, { x: p.x, y: p.y, moved: d.moved + Math.hypot(p.x - d.x, p.y - d.y), t: now })
    } else if (p.type === 'up' && d) {
      if (performance.now() - d.t > 80) view.current.spin = [0, 0]
      if (d.moved < 5) {
        // A click: pick the frontmost atom under the pointer.
        const shown = view.current.shown
        let best = -1
        shown.forEach((a, i) => {
          if (Math.hypot(a.x - p.x, a.y - p.y) < Math.max(a.r, 8) && (best < 0 || a.z > shown[best].z)) best = i
        })
        if (best < 0) setPicked([])
        else setPicked((prev) => (prev.includes(best) ? prev.filter((i) => i !== best) : prev.length >= 3 ? [best] : [...prev, best]))
      }
      drag.current = null
    }
  }

  const refAngle = angleAt(mol.atoms[mol.angle[0]].p, mol.atoms[mol.angle[1]].p, mol.atoms[mol.angle[2]].p)
  const pa = picked.map((i) => mol.atoms[i])
  const measure =
    picked.length === 2
      ? `${fmt(distance(pa[0].p, pa[1].p), 2)} Å`
      : picked.length === 3
        ? `${fmt(angleAt(pa[0].p, pa[1].p, pa[2].p), 1)}°`
        : 'click atoms'
  const elements = [...new Set(mol.atoms.map((a) => a.el))] as El[]

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            canvasRef={canvasRef}
            className="sim-dark"
            cursor="grab"
            label={`3D model of ${mol.name}, ${mol.formula}, ${mol.geometry}.`}
            onFrame={(ctx, f) => {
              const v = view.current
              if (f.dt > 0 && !drag.current) {
                const damp = Math.exp(-f.dt * 1.5)
                v.spin = [v.spin[0] * damp, v.spin[1] * damp]
                rotateBy(v.spin[0] * f.dt + (auto ? 0.5 * f.dt : 0), v.spin[1] * f.dt)
              }
              const px = (Math.min(W, H) * 0.42 * zoom) / extent
              const cam = extent * 5
              const pts = mol.atoms.map((a) => apply(v.R, a.p))
              const proj = pts.map((q) => project(q, cam, px, CX, CY))
              const radius = (el: El) => (style === 'space' ? ELEMENTS[el].vdw : ELEMENTS[el].vdw * 0.3)
              v.shown = proj.map((q, i) => ({ x: q.x, y: q.y, z: q.z, r: radius(mol.atoms[i].el) * q.s }))

              clear(ctx, W, H, '#0d0c0b')
              type Item = { z: number; draw: () => void }
              const items: Item[] = []
              if (style === 'ball')
                for (const [i, j, order] of mol.bonds)
                  for (const [a, b] of [[i, j], [j, i]]) {
                    const pa3 = pts[a]
                    const pb3 = pts[b]
                    const dir: Vec3 = [pb3[0] - pa3[0], pb3[1] - pa3[1], pb3[2] - pa3[2]]
                    const mid: Vec3 = [(pa3[0] + pb3[0]) / 2, (pa3[1] + pb3[1]) / 2, (pa3[2] + pb3[2]) / 2]
                    const l = len(dir)
                    const r0 = (radius(mol.atoms[a].el) * 0.8) / l
                    const s3: Vec3 = [pa3[0] + dir[0] * r0, pa3[1] + dir[1] * r0, pa3[2] + dir[2] * r0]
                    const A = project(s3, cam, px, CX, CY)
                    const M = project(mid, cam, px, CX, CY)
                    const color = ELEMENTS[mol.atoms[a].el].color
                    items.push({
                      z: (pa3[2] + mid[2]) / 2 - 0.01,
                      draw: () => {
                        const w = BOND_R * 2 * M.s * (order > 1 ? 0.62 : 1)
                        const ang = Math.atan2(M.y - A.y, M.x - A.x)
                        const nx = -Math.sin(ang)
                        const ny = Math.cos(ang)
                        const offsets = order === 1 ? [0] : order === 2 ? [-0.85, 0.85] : [-1.6, 0, 1.6]
                        ctx.lineCap = 'round'
                        for (const o of offsets) {
                          const ox = nx * o * w
                          const oy = ny * o * w
                          line(ctx, A.x + ox, A.y + oy, M.x + ox, M.y + oy, shade(color, -0.55), w)
                          line(ctx, A.x + ox - nx * w * 0.12, A.y + oy - ny * w * 0.12, M.x + ox - nx * w * 0.12, M.y + oy - ny * w * 0.12, color, w * 0.6)
                          line(ctx, A.x + ox - nx * w * 0.22, A.y + oy - ny * w * 0.22, M.x + ox - nx * w * 0.22, M.y + oy - ny * w * 0.22, shade(color, 0.55), w * 0.18)
                        }
                        ctx.lineCap = 'butt'
                      },
                    })
                  }
              mol.atoms.forEach((a, i) => {
                const q = v.shown[i]
                items.push({
                  z: q.z,
                  draw: () => {
                    const base = ELEMENTS[a.el].color
                    const g = ctx.createRadialGradient(q.x - q.r * 0.35, q.y - q.r * 0.4, q.r * 0.08, q.x, q.y, q.r)
                    g.addColorStop(0, shade(base, 0.75))
                    g.addColorStop(0.45, base)
                    g.addColorStop(1, shade(base, -0.6))
                    ctx.beginPath()
                    ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2)
                    ctx.fillStyle = g
                    ctx.fill()
                    const k = picked.indexOf(i)
                    if (k >= 0) {
                      ctx.strokeStyle = '#ffd43b'
                      ctx.lineWidth = 3
                      ctx.stroke()
                      text(ctx, String(k + 1), q.x + q.r * 0.75, q.y - q.r * 0.75, { color: '#ffd43b', size: 13, weight: 700 })
                    }
                    if (labels && q.r > 7) text(ctx, a.el, q.x, q.y + 1, { color: a.el === 'H' || a.el === 'S' || a.el === 'F' || a.el === 'Cl' ? '#1b1a17' : '#fff', size: clamp(q.r * 0.8, 12, 20), align: 'center', baseline: 'middle', weight: 700 })
                  },
                })
              })
              items.sort((a, b) => a.z - b.z)
              for (const it of items) it.draw()

              // Measurement overlay.
              const sel = picked.map((i) => v.shown[i])
              if (sel.length >= 2) {
                for (let k = 0; k + 1 < sel.length; k++) line(ctx, sel[k].x, sel[k].y, sel[k + 1].x, sel[k + 1].y, '#ffd43b', 2, [5, 4])
                const msg = sel.length === 2 ? `${measure} apart` : `angle ${measure}`
                const lx = sel.length === 2 ? (sel[0].x + sel[1].x) / 2 : sel[1].x
                const ly = sel.length === 2 ? (sel[0].y + sel[1].y) / 2 : sel[1].y
                rrect(ctx, lx + 10, ly - 30, msg.length * 8 + 16, 24, 6, 'rgba(0,0,0,0.75)', '#ffd43b')
                text(ctx, msg, lx + 18, ly - 13, { color: '#ffd43b', size: 13, weight: 700 })
              }
              text(ctx, `${mol.name}  ${mol.formula}`, 16, 28, { color: '#f1f3f5', size: 18, weight: 700, mono: false })
              text(ctx, mol.geometry, 16, 48, { color: '#adb5bd', size: 13 })
              text(ctx, 'drag to rotate · scroll to zoom · click atoms to measure', W - 16, H - 14, { color: '#868e96', size: 12, align: 'right' })
            }}
          />
          <Readout
            items={[
              ['Formula', mol.formula],
              ['Atoms', mol.atoms.length],
              ['Geometry', mol.geometry.split(' (')[0]],
              ['Bond angle', `${fmt(refAngle, 1)}°`],
              [picked.length === 3 ? 'Picked angle' : 'Picked distance', measure],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onReset={resetView} resetLabel="Reset view" />
      <Select label="Molecule" value={id} options={MOLECULES.map((m) => [m.id, `${m.name} (${m.formula})`] as const)} onChange={choose} />
      <Choice label="Style" value={style} options={[['ball', 'Ball & stick'], ['space', 'Space-filling']]} onChange={setStyle} />
      <Slider label="Zoom" value={zoom} min={0.4} max={3} step={0.05} unit="×" onChange={setZoom} />
      <Toggle label="Auto-rotate" checked={auto} onChange={setAuto} />
      <Toggle label="Element labels" checked={labels} onChange={setLabels} />
      <Legend items={elements.map((e) => [ELEMENTS[e].color, ELEMENTS[e].name] as const)} />
      <Hint>Drag to spin the model (let go while moving and it keeps turning). Click two atoms for a distance or three for the angle at the middle one: water’s H–O–H is 104.5°, methane’s H–C–H 109.5°.</Hint>
    </SimLayout>
  )
}

