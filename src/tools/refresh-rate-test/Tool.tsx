import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import { Hint, PlayBar, Readout, Slider, useRunning } from '../../sim/controls'
import { useTheme, type Theme } from '../../sim/theme'
import { estimateHz, liveFps, type Estimate } from './logic'
import './tool.css'

const MEASURE_MS = 2000
const LANES = [1, 2, 4] as const

function fit(c: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = Math.max(1, Math.round(c.clientWidth * dpr))
  const h = Math.max(1, Math.round(c.clientHeight * dpr))
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
  }
  const ctx = c.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w: c.clientWidth, h: c.clientHeight }
}

function drawUfo(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y + 6, 26, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(160, 220, 255, 0.9)'
  ctx.beginPath()
  ctx.ellipse(x, y, 12, 11, 0, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = '#fff'
  for (const dx of [-14, 0, 14]) ctx.fillRect(x + dx - 2, y + 5, 4, 3)
}

function drawGraph(ctx: CanvasRenderingContext2D, w: number, h: number, intervals: number[], target: number, th: Theme) {
  ctx.clearRect(0, 0, w, h)
  const max = Math.max(target * 2.5, 20)
  const y = (ms: number) => h - 4 - (Math.min(ms, max) / max) * (h - 8)
  ctx.strokeStyle = th.border
  ctx.setLineDash([4, 4])
  if (target) {
    ctx.beginPath()
    ctx.moveTo(0, y(target))
    ctx.lineTo(w, y(target))
    ctx.stroke()
  }
  ctx.setLineDash([])
  const n = Math.min(intervals.length, Math.floor(w / 3))
  const start = intervals.length - n
  for (let i = 0; i < n; i++) {
    const v = intervals[start + i]
    ctx.fillStyle = target && v > target * 1.5 ? th.danger : th.accent
    const top = y(v)
    ctx.fillRect(w - (n - i) * 3, top, 2, h - 4 - top)
  }
  ctx.fillStyle = th.muted
  ctx.font = '11px ui-monospace, monospace'
  if (target) ctx.fillText(`${target.toFixed(2)} ms`, 6, y(target) - 4)
}

export default function RefreshRateTest() {
  const th = useTheme()
  const [running, setRunning] = useRunning()
  const [speed, setSpeed] = useState(480)
  const [fps, setFps] = useState(0)
  const [est, setEst] = useState<Estimate | null>(null)
  const [measuring, setMeasuring] = useState(true)
  const graph = useRef<HTMLCanvasElement>(null)
  const lanes = useRef<HTMLCanvasElement>(null)
  const live = useRef({ th, running, speed, hz: 60 })
  live.current = { th, running, speed, hz: est?.hz || 60 }
  const measureStart = useRef<number | null>(null)

  useEffect(() => {
    let raf = 0
    let last = 0
    let frame = 0
    const laneT = [0, 0, 0]
    let t = 0
    const stamps: number[] = []
    const intervals: number[] = []
    let sample: number[] = []
    let lastUi = 0
    measureStart.current = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const L = live.current
      if (last) {
        const dt = now - last
        intervals.push(dt)
        if (intervals.length > 600) intervals.shift()
        if (measureStart.current !== null) sample.push(dt)
        if (L.running) t += Math.min(dt, 100)
      }
      last = now
      stamps.push(now)
      if (stamps.length > 400) stamps.shift()
      frame++
      if (measureStart.current !== null && now - measureStart.current >= MEASURE_MS) {
        setEst(estimateHz(sample))
        setMeasuring(false)
        measureStart.current = null
        sample = []
      }
      if (now - lastUi > 250) {
        lastUi = now
        setFps(Math.round(liveFps(stamps, now)))
      }
      const g = graph.current
      if (g) {
        const { ctx, w, h } = fit(g)
        if (ctx) drawGraph(ctx, w, h, intervals, 1000 / L.hz, L.th)
      }
      const c = lanes.current
      if (c) {
        const { ctx, w, h } = fit(c)
        if (!ctx) return
        ctx.clearRect(0, 0, w, h)
        const laneH = h / 3
        LANES.forEach((div, k) => {
          if (frame % div === 0) laneT[k] = t
          const y = laneH * k
          ctx.fillStyle = k % 2 ? L.th.sunken : L.th.surface
          ctx.fillRect(0, y, w, laneH)
          const span = w + 60
          const x = ((laneT[k] / 1000) * L.speed) % span - 30
          drawUfo(ctx, x, y + laneH / 2 - 2, ['#1c7ed6', '#2f9e44', '#e8590c'][k])
          ctx.fillStyle = L.th.muted
          ctx.font = '12px ui-monospace, monospace'
          ctx.fillText(`${Math.round(L.hz / div)} fps${div === 1 ? ' (full)' : div === 2 ? ' (half)' : ' (quarter)'}`, 8, y + 16)
        })
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  function remeasure() {
    setMeasuring(true)
    setEst(null)
    measureStart.current = performance.now()
  }

  return (
    <div className="rr">
      <div className={`rr-hero ${measuring ? 'measuring' : ''}`}>
        <div className="rr-big">
          <b>{est ? <Roll>{String(est.hz)}</Roll> : '…'}</b>
          <span>Hz</span>
        </div>
        <p className="muted">{measuring ? 'Measuring… keep this tab in front and hands off for 2 seconds.' : est?.snapped ? `Your screen refreshes about ${est.hz} times per second (measured ${est.raw.toFixed(1)} Hz).` : `Measured ${est?.raw.toFixed(1)} Hz, which is not a common panel rate, so the browser may be throttling.`}</p>
        <button type="button" className="btn primary" onClick={remeasure} disabled={measuring}>Measure again</button>
      </div>

      <Readout
        items={[
          ['live fps', <Roll key="f">{String(fps)}</Roll>],
          ['frame time', est ? `${est.frameMs.toFixed(2)} ms` : '–'],
          ['jitter', est ? `±${est.jitter.toFixed(2)} ms` : '–'],
          ['skipped frames', est ? String(est.dropped) : '–'],
        ]}
      />

      <div>
        <h4 className="rr-h">Frame times</h4>
        <canvas ref={graph} className="rr-graph" role="img" aria-label="Bar graph of recent frame times; red bars are skipped frames" />
      </div>

      <div>
        <h4 className="rr-h">Motion smoothness</h4>
        <canvas ref={lanes} className="rr-lanes" role="img" aria-label="Three moving saucers updated at full, half and quarter frame rate" />
        <PlayBar running={running} setRunning={setRunning} />
        <Slider label="Speed" value={speed} min={120} max={1920} step={120} unit=" px/s" onChange={setSpeed} />
      </div>

      <p className="rr-note">Laptops and phones on battery saver often cap the rate at 60 Hz or lower, and variable refresh (FreeSync, G-Sync, ProMotion) can lower it when little moves. Plug in, pick the highest rate in display settings and re-measure.</p>
      <Hint>The number is the median time between browser frames. Watch the top saucer against the half and quarter rate ones: on a high refresh screen it should look clearly smoother and less blurry.</Hint>
    </div>
  )
}
