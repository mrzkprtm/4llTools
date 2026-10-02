import { useRef, useState } from 'react'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Choice, Hint, Legend, PlayBar, Readout, Select, SimLayout, Slider, useRunning } from '../../sim/controls'
import { chart, circle, clear, line, makeBuffer, rrect, text } from '../../sim/draw'
import { clamp, fmt, pushCap, rng } from '../../sim/math'
import { alpha, useTheme } from '../../sim/theme'
import { createNet, evaluate, forward, makeData, paramCount, trainEpoch, type Act, type Dataset, type Net, type Point } from './nn'

const W = 820
const H = 500
const X0 = 10
const Y0 = 10
const S = 480
const RES = 48
const TH = 12
const BLUE: [number, number, number] = [28, 126, 214]
const ORANGE: [number, number, number] = [232, 89, 12]
const DATASETS = [['circle', 'Circle'], ['xor', 'XOR'], ['spiral', 'Spiral'], ['gauss', 'Two gaussians'], ['empty', 'Empty (click to add)']] as const
const RATES = [['0.003', '0.003'], ['0.01', '0.01'], ['0.03', '0.03'], ['0.1', '0.1'], ['0.3', '0.3'], ['1', '1'], ['3', '3']] as const
const BATCHES = [['1', '1'], ['10', '10'], ['30', '30'], ['1000', 'All points']] as const
const LAMBDAS = [['0', 'None'], ['0.0003', '0.0003'], ['0.001', '0.001'], ['0.003', '0.003'], ['0.01', '0.01'], ['0.03', '0.03']] as const

type DataChoice = Dataset | 'empty'

const toPx = (x: number, y: number): [number, number] => [X0 + ((x + 1) / 2) * S, Y0 + ((1 - y) / 2) * S]

/** Blends a light background toward blue (v < 0) or orange (v > 0) by |v|. */
function shade(data: Uint8ClampedArray, o: number, v: number, bg: [number, number, number]) {
  const c = v < 0 ? BLUE : ORANGE
  const t = Math.min(1, Math.abs(v)) * 0.75
  data[o] = bg[0] + (c[0] - bg[0]) * t
  data[o + 1] = bg[1] + (c[1] - bg[1]) * t
  data[o + 2] = bg[2] + (c[2] - bg[2]) * t
  data[o + 3] = 255
}

export default function NeuralNetwork() {
  const theme = useTheme()
  const [running, setRunning] = useRunning()
  const [dataset, setDataset] = useState<DataChoice>('circle')
  const [noise, setNoise] = useState(0.05)
  const [layers, setLayers] = useState(2)
  const [neurons, setNeurons] = useState([4, 4, 4])
  const [act, setAct] = useState<Act>('tanh')
  const [lr, setLr] = useState<(typeof RATES)[number][0]>('0.1')
  const [batch, setBatch] = useState<(typeof BATCHES)[number][0]>('10')
  const [lambda, setLambda] = useState<(typeof LAMBDAS)[number][0]>('0')
  const [epochsPerFrame, setEpochsPerFrame] = useState(2)
  const [addClass, setAddClass] = useState<0 | 1>(1)
  const random = useRef(rng(3))
  const sizes = [2, ...neurons.slice(0, layers), 1]
  const net = useRef<Net>(null as unknown as Net)
  if (!net.current) net.current = createNet(sizes, act, random.current)
  const data = useRef<Point[]>(null as unknown as Point[])
  if (!data.current) data.current = makeData('circle', 200, noise, random.current)
  const train = useRef({ epoch: 0, losses: [] as number[] })
  const heat = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const thumbs = useRef<ReturnType<typeof makeBuffer> | null>(null)
  const [info, setInfo] = useState({ epoch: 0, loss: NaN, acc: NaN })

  function rebuild(s = sizes, a = act) {
    net.current = createNet(s, a, random.current)
    train.current = { epoch: 0, losses: [] }
  }

  function newData(kind = dataset, nz = noise) {
    data.current = kind === 'empty' ? [] : makeData(kind, 200, nz, random.current)
    rebuild()
  }

  function setArch(nLayers: number, per: number[]) {
    setLayers(nLayers)
    setNeurons(per)
    rebuild([2, ...per.slice(0, nLayers), 1])
  }

  function onPointer(p: SimPointer) {
    if (p.type !== 'down' || p.x < X0 || p.x > X0 + S || p.y < Y0 || p.y > Y0 + S) return
    const x = ((p.x - X0) / S) * 2 - 1
    const y = 1 - ((p.y - Y0) / S) * 2
    const label = (p.button === 2 || p.shift ? 1 - addClass : addClass) as 0 | 1
    data.current.push({ x, y, label })
  }

  function drawNetwork(ctx: CanvasRenderingContext2D, bg: [number, number, number], refresh: boolean) {
    const n = net.current
    const L = n.sizes.length
    if (!thumbs.current) thumbs.current = makeBuffer(TH * 5, TH * 8)
    const tb = thumbs.current
    if (refresh) {
      // Each neuron's output over the input square, as a tiny heatmap (like the TensorFlow Playground).
      const grid: Float64Array[][] = []
      for (let gy = 0; gy < TH; gy++)
        for (let gx = 0; gx < TH; gx++) grid.push(forward(n, ((gx + 0.5) / TH) * 2 - 1, 1 - ((gy + 0.5) / TH) * 2))
      for (let l = 0; l < L; l++)
        for (let j = 0; j < n.sizes[l]; j++) {
          let max = 1e-9
          if (n.act === 'relu' && l > 0 && l < L - 1) for (const g of grid) max = Math.max(max, g[l][j])
          grid.forEach((g, k) => {
            const raw = g[l][j]
            const v = l === 0 ? raw : l === L - 1 ? raw * 2 - 1 : n.act === 'tanh' ? raw : n.act === 'relu' ? raw / max : raw * 2 - 1
            const gx = k % TH
            const gy = Math.floor(k / TH)
            shade(tb.data, ((j * TH + gy) * TH * 5 + l * TH + gx) * 4, v, bg)
          })
        }
      tb.flush()
    }
    const colX = (l: number) => 540 + (l / (L - 1)) * 238
    const rowY = (l: number, j: number) => {
      const m = n.sizes[l]
      const gap = Math.min(34, 240 / m)
      return 150 + (j - (m - 1) / 2) * gap
    }
    const box = 24
    for (let l = 0; l < L - 1; l++) {
      const m = n.sizes[l]
      for (let j = 0; j < n.sizes[l + 1]; j++)
        for (let i = 0; i < m; i++) {
          const w = n.w[l][j * m + i]
          line(ctx, colX(l) + box / 2, rowY(l, i), colX(l + 1) - box / 2, rowY(l + 1, j), alpha(w > 0 ? '#e8590c' : '#1c7ed6', clamp(0.15 + Math.abs(w) * 0.35, 0.15, 0.9)), clamp(0.5 + Math.abs(w) * 1.2, 0.5, 5))
        }
    }
    ctx.imageSmoothingEnabled = true
    for (let l = 0; l < L; l++)
      for (let j = 0; j < n.sizes[l]; j++) {
        const x = colX(l) - box / 2
        const y = rowY(l, j) - box / 2
        ctx.drawImage(tb.canvas, l * TH, j * TH, TH, TH, x, y, box, box)
        rrect(ctx, x, y, box, box, 3, undefined, theme.text, l === L - 1 ? 2 : 1)
      }
    text(ctx, 'x', colX(0) - 20, rowY(0, 0) + 4, { color: theme.muted, size: 12, align: 'right' })
    text(ctx, 'y', colX(0) - 20, rowY(0, 1) + 4, { color: theme.muted, size: 12, align: 'right' })
    text(ctx, 'out', colX(L - 1), rowY(L - 1, 0) + 30, { color: theme.muted, size: 12, align: 'center' })
    text(ctx, `${n.sizes.join(' → ')}  ·  ${paramCount(n)} weights`, 660, 292, { color: theme.muted, size: 12, align: 'center' })
  }

  const bgOf = (): [number, number, number] => (theme.dark ? [38, 36, 33] : [250, 248, 243])

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            onPointer={onPointer}
            label={`Neural network ${sizes.join('-')} learning the ${dataset} dataset. Epoch ${info.epoch}, accuracy ${Math.round((info.acc || 0) * 100)} percent.`}
            onFrame={(ctx, f) => {
              const n = net.current
              const tr = train.current
              const pts = data.current
              if (f.dt > 0 && pts.length) {
                for (let k = 0; k < epochsPerFrame; k++) {
                  const loss = trainEpoch(n, pts, Number(lr), Number(batch), Number(lambda), random.current)
                  tr.epoch++
                  if (!Number.isFinite(loss)) break
                }
                pushCap(tr.losses, evaluate(n, pts).loss, 400)
              }
              const bg = bgOf()
              const refresh = f.frame % 3 === 0 || f.dt === 0
              clear(ctx, W, H, theme.sunken)
              if (!heat.current) heat.current = makeBuffer(RES, RES)
              const hb = heat.current
              if (refresh) {
                for (let gy = 0; gy < RES; gy++)
                  for (let gx = 0; gx < RES; gx++) {
                    const a = forward(n, ((gx + 0.5) / RES) * 2 - 1, 1 - ((gy + 0.5) / RES) * 2)
                    shade(hb.data, (gy * RES + gx) * 4, a[a.length - 1][0] * 2 - 1, bg)
                  }
                hb.flush()
              }
              ctx.imageSmoothingEnabled = true
              ctx.drawImage(hb.canvas, X0, Y0, S, S)
              rrect(ctx, X0, Y0, S, S, 0, undefined, theme.border)
              line(ctx, X0 + S / 2, Y0, X0 + S / 2, Y0 + S, alpha(theme.text, 0.12))
              line(ctx, X0, Y0 + S / 2, X0 + S, Y0 + S / 2, alpha(theme.text, 0.12))
              for (const p of pts) {
                const [x, y] = toPx(p.x, p.y)
                circle(ctx, x, y, 4.5, p.label ? '#e8590c' : '#1c7ed6', theme.dark ? '#111' : '#fff', 1.5)
              }
              rrect(ctx, 504, 10, 306, 290, 8, theme.surface, theme.border)
              drawNetwork(ctx, bg, refresh)
              rrect(ctx, 504, 310, 306, 180, 8, theme.surface, theme.border)
              const top = Math.max(0.8, ...tr.losses)
              chart(ctx, 520, 336, 276, 130, [{ data: tr.losses, color: theme.accent, width: 2 }], { min: 0, max: top, axis: theme.border, span: 400 })
              text(ctx, 'training loss (cross-entropy)', 518, 328, { color: theme.muted, size: 12 })
              text(ctx, fmt(top, 2), 796, 328, { color: theme.muted, size: 12, align: 'right' })
              text(ctx, `last ${Math.min(400, tr.losses.length)} frames`, 796, 482, { color: theme.muted, size: 12, align: 'right' })
              if (!pts.length) text(ctx, 'Click to add points', X0 + S / 2, Y0 + S / 2 - 20, { color: theme.text, size: 15, align: 'center', weight: 600 })
              if (f.frame % 10 === 0) {
                const ev = evaluate(n, pts)
                setInfo({ epoch: tr.epoch, loss: pts.length ? ev.loss : NaN, acc: pts.length ? ev.accuracy : NaN })
              }
            }}
          />
          <Legend items={[['#1c7ed6', 'Blue class / negative weight'], ['#e8590c', 'Orange class / positive weight']]} />
          <Readout
            items={[
              ['Epoch', fmt(info.epoch, 0)],
              ['Train loss', fmt(info.loss, 3)],
              ['Accuracy', Number.isFinite(info.acc) ? `${fmt(info.acc * 100, 1)}%` : '—'],
              ['Points', data.current.length],
              ['Weights', paramCount(net.current)],
            ]}
          />
        </>
      }
    >
      <PlayBar
        running={running}
        setRunning={setRunning}
        onReset={() => rebuild()}
        resetLabel="New weights"
        onStep={() => {
          trainEpoch(net.current, data.current, Number(lr), Number(batch), Number(lambda), random.current)
          train.current.epoch++
          pushCap(train.current.losses, evaluate(net.current, data.current).loss, 400)
        }}
      />
      <Select label="Dataset" value={dataset} options={DATASETS} onChange={(v) => { setDataset(v); newData(v) }} />
      <Slider label="Noise" value={noise} min={0} max={0.3} step={0.01} onChange={(v) => { setNoise(v); newData(dataset, v) }} />
      <Choice label="Click adds" value={addClass} options={[[1, 'Orange'], [0, 'Blue']]} onChange={setAddClass} />
      <Slider label="Hidden layers" value={layers} min={0} max={3} onChange={(v) => setArch(v, neurons)} />
      {neurons.slice(0, layers).map((v, i) => (
        <Slider key={i} label={`Neurons in layer ${i + 1}`} value={v} min={1} max={8} onChange={(k) => setArch(layers, neurons.map((old, j) => (j === i ? k : old)))} />
      ))}
      <Choice label="Activation" value={act} options={[['tanh', 'tanh'], ['relu', 'ReLU'], ['sigmoid', 'sigmoid']]} onChange={(a) => { setAct(a); rebuild(sizes, a) }} />
      <Select label="Learning rate" value={lr} options={RATES} onChange={setLr} />
      <Select label="Batch size" value={batch} options={BATCHES} onChange={setBatch} />
      <Select label="L2 regularisation" value={lambda} options={LAMBDAS} onChange={setLambda} />
      <Slider label="Epochs per frame" value={epochsPerFrame} min={1} max={10} onChange={setEpochsPerFrame} />
      <Hint>The background shows what the network predicts everywhere; each small square in the diagram is one neuron's own picture. Click to add orange points, right-click (or Shift-click) for blue. The spiral needs at least two hidden layers.</Hint>
    </SimLayout>
  )
}
