import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, makeBuffer, rrect, text } from '../../sim/draw'
import { clamp, fmt, gaussian } from '../../sim/math'
import { PALETTE, alpha, useTheme } from '../../sim/theme'
import { blobs, elbow, initCentroids, lloyd, type LloydStep, type Pt } from './kmeans'

const W = 800
const H = 500
const RES = 8
const COLOURS = [...PALETTE, '#868e96', '#d6336c']
const RGB = COLOURS.map((c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)))
const BOX = { x: 20, y: 20, w: W - 40, h: H - 40 }

type Init = 'random' | 'plusplus'

function fresh(points: Pt[], kk: number, how: Init) {
  const centroids = initCentroids(points, kk, how, Math.random)
  const labels = new Int32Array(points.length).fill(-1)
  return {
    points,
    labels,
    centroids,
    shown: centroids.map((c) => ({ ...c })),
    trails: centroids.map((c) => [{ ...c }]),
    gen: lloyd(points, centroids, labels) as Generator<LloydStep>,
    step: null as LloydStep | null,
    t: 1,
    lines: 0,
    iter: 0,
    inertia: NaN,
    converged: false,
  }
}

export default function KMeansClustering() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [k, setK] = useState(4)
  const [kTrue, setKTrue] = useState(4)
  const [spread, setSpread] = useState(45)
  const [count, setCount] = useState(400)
  const [init, setInit] = useState<Init>('plusplus')
  const [ips, setIps] = useState(1.2)
  const [voronoi, setVoronoi] = useState(true)
  const [elbowData, setElbowData] = useState<number[] | null>(null)
  const [, setTick] = useState(0)
  const [initial] = useState(() => fresh(blobs(400, 4, 45, Math.random, BOX), 4, 'plusplus'))
  const sim = useRef(initial)
  const buf = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const spray = useRef<Pt | null>(null)
  const bump = () => setTick((t) => t + 1)

  function reset(points = sim.current.points, kk = k, how = init) {
    sim.current = fresh(points, kk, how)
    bump()
  }

  /** Moves on to the next half-step of Lloyd's algorithm. */
  function advance() {
    const s = sim.current
    if (s.converged) return
    s.shown = s.step?.centroids.map((c) => ({ ...c })) ?? s.shown
    const r = s.gen.next()
    if (r.done) return
    const st = r.value
    s.step = st
    s.inertia = st.inertia
    if (st.phase === 'done') {
      s.converged = true
      s.t = 1
    } else {
      s.t = 0
      s.iter = st.iter
      if (st.phase === 'assign') s.lines = 1
      else st.centroids.forEach((c, j) => s.trails[j]?.push({ ...c }))
    }
  }

  function points(pts: Pt[]) {
    setElbowData(null)
    reset(pts)
  }

  function onPointer(p: SimPointer) {
    if (p.type === 'down') spray.current = { x: p.x, y: p.y }
    else if (p.type === 'move' && spray.current && p.down) spray.current = { x: p.x, y: p.y }
    if (p.type === 'up') {
      spray.current = null
      // Keep the centroids but let Lloyd's algorithm continue with the new points.
      const s = sim.current
      setElbowData(null)
      if (s.centroids.length < Math.min(k, s.points.length)) return reset(s.points)
      const labels = new Int32Array(s.points.length).fill(-1)
      const c = s.step?.centroids ?? s.centroids
      Object.assign(s, { labels, centroids: c, gen: lloyd(s.points, c, labels), step: null, converged: false, t: 1, shown: c.map((q) => ({ ...q })) })
      bump()
    }
  }

  const s = sim.current

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`${s.points.length} points in ${k} clusters; iteration ${s.iter}${s.converged ? ', converged' : ''}.`}
            onFrame={(ctx, f) => {
              const m = sim.current
              const sp = spray.current
              if (sp && m.points.length < 3000) {
                for (let i = 0; i < 4; i++) m.points.push({ x: clamp(sp.x + gaussian() * 14, 2, W - 2), y: clamp(sp.y + gaussian() * 14, 2, H - 2) })
              }
              // Each half-step takes half an "iteration" of screen time.
              const dur = 0.5 / ips
              if (f.dt > 0 && !sp) {
                m.t = Math.min(1, m.t + f.dt / dur)
                if (m.t >= 1 && !m.converged) advance()
              }
              m.lines = Math.max(0, m.lines - (f.dt || 1 / 60) / Math.max(0.25, dur))
              const st = m.step
              const ease = 1 - (1 - m.t) ** 3
              // Centroids glide from their old spot to the new mean during an update step.
              const cents = st?.phase === 'update' && st.previous ? st.centroids.map((c, j) => ({ x: st.previous![j].x + (c.x - st.previous![j].x) * ease, y: st.previous![j].y + (c.y - st.previous![j].y) * ease })) : (st?.centroids ?? m.shown)
              const labels = st?.labels

              clear(ctx, W, H, theme.sunken)
              if (voronoi && cents.length) {
                const bw = W / RES
                const bh = Math.ceil(H / RES)
                if (!buf.current) buf.current = makeBuffer(bw, bh)
                const d = buf.current.data
                for (let y = 0; y < bh; y++)
                  for (let x = 0; x < bw; x++) {
                    const px = x * RES + RES / 2
                    const py = y * RES + RES / 2
                    let best = 0
                    let bd = Infinity
                    for (let j = 0; j < cents.length; j++) {
                      const dd = (cents[j].x - px) ** 2 + (cents[j].y - py) ** 2
                      if (dd < bd) {
                        bd = dd
                        best = j
                      }
                    }
                    const o = (y * bw + x) * 4
                    const c = RGB[best % RGB.length]
                    d[o] = c[0]
                    d[o + 1] = c[1]
                    d[o + 2] = c[2]
                    d[o + 3] = theme.dark ? 46 : 38
                  }
                buf.current.flush()
                ctx.imageSmoothingEnabled = false
                ctx.drawImage(buf.current.canvas, 0, 0, bw * RES, bh * RES)
              }
              // Assignment step: brief spokes from each point to its centroid.
              if (labels && m.lines > 0) {
                ctx.globalAlpha = m.lines * 0.35
                for (let i = 0; i < m.points.length; i++) {
                  const l = labels[i]
                  if (l < 0 || !cents[l]) continue
                  line(ctx, m.points[i].x, m.points[i].y, cents[l].x, cents[l].y, COLOURS[l % COLOURS.length], 1)
                }
                ctx.globalAlpha = 1
              }
              for (let i = 0; i < m.points.length; i++) {
                const l = labels && i < labels.length ? labels[i] : -1
                circle(ctx, m.points[i].x, m.points[i].y, 3.2, l >= 0 ? COLOURS[l % COLOURS.length] : alpha(theme.text, 0.45))
              }
              // Centroids with their trails.
              cents.forEach((c, j) => {
                const col = COLOURS[j % COLOURS.length]
                const tr = m.trails[j] ?? []
                if (tr.length > 1) {
                  ctx.beginPath()
                  tr.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)))
                  ctx.strokeStyle = alpha(col, 0.7)
                  ctx.lineWidth = 2
                  ctx.setLineDash([4, 4])
                  ctx.stroke()
                  ctx.setLineDash([])
                  tr.forEach((q) => circle(ctx, q.x, q.y, 2.5, alpha(col, 0.7)))
                }
                circle(ctx, c.x, c.y, 11, col, theme.surface, 3)
                line(ctx, c.x - 5, c.y, c.x + 5, c.y, theme.surface, 2.5)
                line(ctx, c.x, c.y - 5, c.x, c.y + 5, theme.surface, 2.5)
              })
              const phase = m.converged ? 'Converged: no point changed cluster' : st?.phase === 'assign' ? `Iteration ${st.iter}: assign each point to its nearest centroid (${st.changed} changed)` : st?.phase === 'update' ? `Iteration ${st.iter}: move each centroid to the mean of its points` : 'Press Play or Step'
              rrect(ctx, 10, 10, Math.min(W - 20, phase.length * 7.4 + 20), 26, 6, alpha(theme.surface, 0.85))
              text(ctx, phase, 20, 28, { color: m.converged ? theme.ok : theme.text, size: 13, weight: 600 })

              // Elbow chart: inertia against k.
              if (elbowData) {
                const px = W - 250
                const py = 46
                const pw = 236
                const ph = 150
                rrect(ctx, px, py, pw, ph, 8, alpha(theme.surface, 0.95), theme.border)
                text(ctx, 'Elbow: inertia vs k', px + 10, py + 20, { color: theme.muted, size: 12, weight: 700 })
                const max = Math.max(...elbowData) || 1
                const X = (i: number) => px + 22 + (i / (elbowData.length - 1)) * (pw - 40)
                const Y = (v: number) => py + ph - 24 - (v / max) * (ph - 54)
                ctx.beginPath()
                elbowData.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))))
                ctx.strokeStyle = theme.accent
                ctx.lineWidth = 2
                ctx.stroke()
                elbowData.forEach((v, i) => {
                  circle(ctx, X(i), Y(v), i + 1 === k ? 6 : 3.5, i + 1 === k ? theme.accent : theme.surface, theme.accent, 2)
                  text(ctx, String(i + 1), X(i), py + ph - 8, { color: i + 1 === k ? theme.text : theme.muted, size: 12, align: 'center' })
                })
              }
              if (f.frame % 8 === 0 && (running || sp)) bump()
            }}
          />
          <Readout
            items={[
              ['Iteration', s.iter],
              ['Inertia', Number.isFinite(s.inertia) ? fmt(s.inertia, 0) : '—'],
              ['Converged', s.converged ? 'yes' : 'no'],
              ['Points', s.points.length],
            ]}
          />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning} onStep={() => { const m = sim.current; m.t = 1; advance(); bump() }} onReset={() => reset()} resetLabel="New centroids" />
      <Slider label="Clusters k" value={k} min={1} max={10} onChange={(v) => { setK(v); reset(sim.current.points, v) }} />
      <Choice label="Start" value={init} options={[['random', 'Random points'], ['plusplus', 'k-means++']]} onChange={(v) => { setInit(v); reset(sim.current.points, k, v) }} />
      <Slider label="Speed" value={ips} min={0.2} max={6} step={0.1} unit=" iter/s" onChange={setIps} />
      <Toggle label="Colour the regions (Voronoi)" checked={voronoi} onChange={setVoronoi} />
      <div className="sim-field">
        <span className="sim-label">Generate blobs</span>
        <Slider label="True clusters" value={kTrue} min={1} max={8} onChange={setKTrue} />
      </div>
      <Slider label="Spread" value={spread} min={10} max={120} unit=" px" onChange={setSpread} />
      <Slider label="Points" value={count} min={50} max={1500} step={50} onChange={setCount} />
      <div className="row sim-bar">
        <button type="button" className="btn" onClick={() => points(blobs(count, kTrue, spread, Math.random, BOX))}>Generate</button>
        <button type="button" className="btn" onClick={() => points([])}>Clear</button>
        <button type="button" className="btn" onClick={() => setElbowData(elbowData ? null : elbow(sim.current.points, 10, Math.random))}>
          {elbowData ? 'Hide elbow' : 'Elbow chart'}
        </button>
      </div>
      <Hint>Drag on the canvas to spray extra points. Each iteration colours every point by its nearest centroid, then moves each centroid to the middle of its colour. The elbow chart shows where adding another cluster stops paying off.</Hint>
    </SimLayout>
  )
}
