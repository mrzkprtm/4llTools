import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage from '../../sim/Stage'
import { Choice, Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { circle, clear, line, text } from '../../sim/draw'
import { TAU, fmt } from '../../sim/math'
import { bandLevels, dbUnit, logEdges, midiFrequency, noteName, peakFrequency, risingZero, rmsDb } from './analysis'

const W = 800
const H = 480
const PLOT = { x: 46, y: 22, w: 736, h: 404 }
const F_MIN = 30
const F_MAX = 16000
const BANDS = 72
const EDGES = logEdges(BANDS, F_MIN, F_MAX)
const TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000]
const SW = 480
const SH = 220
const MELODY = [60, 64, 67, 72, 69, 67, 64, 62, 60, 62, 64, 67, 71, 72, 67, 55]

type View = 'bars' | 'wave' | 'radial' | 'water'
type Source = 'test' | 'mic'
type Signal = 'tone' | 'sweep' | 'melody'

const GRADIENTS: Record<string, [number, number, number][]> = {
  aurora: [[12, 10, 40], [50, 60, 170], [30, 190, 200], [170, 255, 150], [255, 255, 255]],
  fire: [[12, 0, 12], [120, 0, 70], [230, 60, 30], [255, 190, 50], [255, 255, 220]],
  ocean: [[4, 10, 30], [0, 60, 130], [0, 150, 210], [120, 230, 255], [240, 255, 255]],
  mono: [[8, 8, 8], [70, 70, 70], [150, 150, 150], [215, 215, 215], [255, 255, 255]],
}
type GradientKey = keyof typeof GRADIENTS
const GRADIENT_OPTIONS = [['aurora', 'Aurora'], ['fire', 'Fire'], ['ocean', 'Ocean'], ['mono', 'Mono']] as const

function colorAt(key: GradientKey, u: number): [number, number, number] {
  const g = GRADIENTS[key]
  const t = Math.max(0, Math.min(1, u)) * (g.length - 1)
  const i = Math.min(g.length - 2, Math.floor(t))
  const f = t - i
  return [0, 1, 2].map((k) => Math.round(g[i][k] + (g[i + 1][k] - g[i][k]) * f)) as [number, number, number]
}
const css = (c: [number, number, number], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
const logX = (f: number) => PLOT.x + (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * PLOT.w
const freqFromSlider = (v: number) => Math.round(40 * 100 ** (v / 1000))
const sliderFromFreq = (f: number) => Math.round((Math.log(f / 40) / Math.log(100)) * 1000)

interface Graph {
  ctx: AudioContext
  analyser: AnalyserNode
  osc?: OscillatorNode
  master?: GainNode
  stop: () => void
}

/** A made-up spectrum and waveform so the stage has something to show before any audio starts. */
function preview(t: number, db: Float32Array, samples: Float32Array, sr: number, fft: number) {
  const f0 = 110 * 2 ** (1.5 + Math.sin(t * 0.35) * 1.2)
  for (let i = 0; i < db.length; i++) db[i] = -100 + Math.sin(i * 12.9898 + t * 3) * 3
  for (let h = 1; h <= 12; h++) {
    const bin = (f0 * h * fft) / sr
    const amp = -18 - 7 * Math.log2(h) + 6 * Math.sin(t * 2 + h)
    for (let i = Math.max(1, Math.floor(bin - 4)); i <= Math.min(db.length - 1, Math.ceil(bin + 4)); i++) db[i] = Math.max(db[i], amp - (i - bin) ** 2 * 3)
  }
  for (let i = 0; i < samples.length; i++) {
    const s = (i / sr) * TAU * f0
    samples[i] = 0.4 * Math.sin(s) + 0.15 * Math.sin(2 * s + t) + 0.08 * Math.sin(3 * s)
  }
}

export default function AudioVisualizer() {
  const [running, setRunning] = useRunning()
  const [source, setSource] = useState<Source>('test')
  const [signal, setSignal] = useState<Signal>('melody')
  const [wave, setWave] = useState<OscillatorType>('triangle')
  const [freqPos, setFreqPos] = useState(sliderFromFreq(440))
  const [volume, setVolume] = useState(0.3)
  const [muted, setMuted] = useState(false)
  const [view, setView] = useState<View>('bars')
  const [fft, setFft] = useState('4096')
  const [sens, setSens] = useState(10)
  const [smoothing, setSmoothing] = useState(0.75)
  const [palette, setPalette] = useState<GradientKey>('aurora')
  const [live, setLive] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState({ peak: 0, level: -Infinity })
  const graph = useRef<Graph | null>(null)
  const bufs = useRef({ db: new Float32Array(2048), samples: new Float32Array(4096), bands: new Float32Array(BANDS), peaks: new Float32Array(BANDS) })
  const spec = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; col: ImageData } | null>(null)
  const freq = freqFromSlider(freqPos)

  function stop() {
    const g = graph.current
    if (g) {
      g.stop()
      void g.ctx.close()
      graph.current = null
    }
    setLive(false)
  }

  async function start() {
    stop()
    setError('')
    let ctx: AudioContext
    try {
      ctx = new AudioContext()
    } catch {
      setError('This browser cannot create an audio context.')
      return
    }
    const analyser = ctx.createAnalyser()
    analyser.fftSize = Number(fft)
    analyser.smoothingTimeConstant = smoothing
    analyser.minDecibels = -110
    analyser.maxDecibels = -10
    if (source === 'mic') {
      if (!navigator.mediaDevices?.getUserMedia) {
        void ctx.close()
        setError('Microphone access is not available here (it needs a secure https page). Try the test signal.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        const src = ctx.createMediaStreamSource(stream)
        src.connect(analyser) // not to the speakers, so there is no feedback
        graph.current = {
          ctx,
          analyser,
          stop: () => {
            stream.getTracks().forEach((t) => t.stop())
            src.disconnect()
          },
        }
      } catch (e) {
        void ctx.close()
        const name = e instanceof DOMException ? e.name : ''
        setError(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Microphone permission was denied. Allow it in your browser’s site settings, or use the test signal instead.'
            : 'No microphone could be opened. Check that one is connected, or use the test signal instead.',
        )
        return
      }
    } else {
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      const master = ctx.createGain()
      osc.type = wave
      osc.frequency.value = freq
      env.gain.value = signal === 'melody' ? 0.0001 : 0.5
      master.gain.value = muted ? 0 : volume
      osc.connect(env)
      env.connect(analyser)
      env.connect(master)
      master.connect(ctx.destination)
      let timer = 0
      let at = ctx.currentTime + 0.05
      let step = 0
      if (signal === 'sweep') {
        const plan = () => {
          while (at < ctx.currentTime + 1) {
            const up = step++ % 2 === 0
            osc.frequency.setValueAtTime(up ? 60 : 4000, at)
            osc.frequency.exponentialRampToValueAtTime(up ? 4000 : 60, at + 5)
            at += 5
          }
        }
        plan()
        timer = window.setInterval(plan, 250)
      } else if (signal === 'melody') {
        const dur = 0.24
        const plan = () => {
          while (at < ctx.currentTime + 0.3) {
            osc.frequency.setValueAtTime(midiFrequency(MELODY[step++ % MELODY.length]), at)
            env.gain.setValueAtTime(0.0001, at)
            env.gain.linearRampToValueAtTime(0.5, at + 0.012)
            env.gain.exponentialRampToValueAtTime(0.04, at + dur * 0.95)
            at += dur
          }
        }
        plan()
        timer = window.setInterval(plan, 60)
      }
      osc.start()
      graph.current = {
        ctx,
        analyser,
        osc,
        master,
        stop: () => {
          window.clearInterval(timer)
          osc.stop()
          osc.disconnect()
        },
      }
    }
    if (ctx.state === 'suspended') await ctx.resume()
    setLive(true)
    if (!running) setRunning(true)
  }

  // Live tweaks to a running graph.
  useEffect(() => {
    const g = graph.current
    if (!g) return
    g.analyser.fftSize = Number(fft)
    g.analyser.smoothingTimeConstant = smoothing
  }, [fft, smoothing])
  useEffect(() => {
    const g = graph.current
    g?.master?.gain.setTargetAtTime(muted ? 0 : volume, g.ctx.currentTime, 0.03)
  }, [volume, muted])
  useEffect(() => {
    if (graph.current?.osc) graph.current.osc.type = wave
  }, [wave])
  useEffect(() => {
    const g = graph.current
    if (g?.osc && signal === 'tone') g.osc.frequency.setTargetAtTime(freq, g.ctx.currentTime, 0.03)
  }, [freq])
  // Switching the source or signal restarts the audio if it was on.
  useEffect(() => {
    if (graph.current) void start()
  }, [source, signal])
  // Release the microphone and audio context when leaving the page.
  useEffect(() => () => stop(), [])

  const note = noteName(info.peak)

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            className="sim-dark"
            maxDpr={1.5}
            label={`Audio visualizer showing ${view === 'bars' ? 'spectrum bars' : view === 'wave' ? 'the waveform' : view === 'radial' ? 'a radial spectrum' : 'a scrolling spectrogram'}${live ? '' : ' of a preview signal'}.`}
            onFrame={(ctx, f) => {
              const g = graph.current
              const B = bufs.current
              const size = g ? g.analyser.fftSize : 4096
              const sr = g ? g.ctx.sampleRate : 48000
              if (B.db.length !== size / 2) {
                B.db = new Float32Array(size / 2)
                B.samples = new Float32Array(size)
              }
              const fresh = f.dt > 0 || f.frame === 0
              if (fresh) {
                if (g) {
                  g.analyser.getFloatFrequencyData(B.db)
                  g.analyser.getFloatTimeDomainData(B.samples)
                } else preview(f.t, B.db, B.samples, sr, size)
              }
              const ceil = -10 - sens
              const floor = ceil - 75
              const gain = 10 ** (sens / 20)
              bandLevels(B.db, EDGES, sr, size, B.bands)

              // The spectrogram keeps scrolling in the background so it has history when you switch to it.
              if (!spec.current) {
                const canvas = document.createElement('canvas')
                canvas.width = SW
                canvas.height = SH
                const c = canvas.getContext('2d')!
                c.fillStyle = css(colorAt(palette, 0))
                c.fillRect(0, 0, SW, SH)
                spec.current = { canvas, ctx: c, col: c.createImageData(1, SH) }
              }
              const S = spec.current
              if (fresh) {
                S.ctx.drawImage(S.canvas, -1, 0)
                for (let r = 0; r < SH; r++) {
                  const fr = F_MAX * (F_MIN / F_MAX) ** (r / (SH - 1))
                  const bin = Math.min(B.db.length - 2, (fr * size) / sr)
                  const i0 = Math.floor(bin)
                  const v = dbUnit(B.db[i0] + (B.db[i0 + 1] - B.db[i0]) * (bin - i0), floor, ceil)
                  const c = colorAt(palette, v)
                  S.col.data[r * 4] = c[0]
                  S.col.data[r * 4 + 1] = c[1]
                  S.col.data[r * 4 + 2] = c[2]
                  S.col.data[r * 4 + 3] = 255
                }
                S.ctx.putImageData(S.col, SW - 1, 0)
              }

              clear(ctx, W, H, '#07070b')
              const bottom = PLOT.y + PLOT.h
              if (view === 'bars') {
                const bw = PLOT.w / BANDS
                const grad = ctx.createLinearGradient(0, bottom, 0, PLOT.y)
                for (let k = 0; k <= 4; k++) grad.addColorStop(k / 4, css(colorAt(palette, 0.3 + (k / 4) * 0.7)))
                for (let b = 0; b < BANDS; b++) {
                  const v = dbUnit(B.bands[b], floor, ceil)
                  B.peaks[b] = Math.max(v, B.peaks[b] - f.dt * 0.5)
                  const x = PLOT.x + b * bw + 1
                  ctx.fillStyle = grad
                  ctx.fillRect(x, bottom - v * PLOT.h, bw - 2, v * PLOT.h)
                  ctx.fillStyle = 'rgba(255,255,255,0.85)'
                  ctx.fillRect(x, bottom - B.peaks[b] * PLOT.h - 3, bw - 2, 2.5)
                }
              } else if (view === 'wave') {
                const mid = PLOT.y + PLOT.h / 2
                line(ctx, PLOT.x, mid, PLOT.x + PLOT.w, mid, 'rgba(255,255,255,0.12)')
                const s0 = risingZero(B.samples)
                const n = Math.min(B.samples.length - s0, 1024)
                ctx.beginPath()
                for (let i = 0; i < n; i++) {
                  const y = mid - Math.max(-1, Math.min(1, B.samples[s0 + i] * gain * 0.6)) * (PLOT.h / 2)
                  const x = PLOT.x + (i / (n - 1)) * PLOT.w
                  if (i) ctx.lineTo(x, y)
                  else ctx.moveTo(x, y)
                }
                ctx.lineJoin = 'round'
                ctx.strokeStyle = css(colorAt(palette, 0.6), 0.25)
                ctx.lineWidth = 8
                ctx.stroke()
                ctx.strokeStyle = css(colorAt(palette, 0.85))
                ctx.lineWidth = 2
                ctx.stroke()
                text(ctx, `${fmt((n / sr) * 1000, 1)} ms across`, PLOT.x + PLOT.w, bottom + 30, { color: 'rgba(255,255,255,0.5)', size: 12, align: 'right' })
              } else if (view === 'radial') {
                const cx = W / 2
                const cy = PLOT.y + PLOT.h / 2 + 8
                const r0 = 96
                const lvl = dbUnit(rmsDb(B.samples) + sens, -60, 0)
                circle(ctx, cx, cy, r0 * (0.5 + 0.4 * lvl), css(colorAt(palette, 0.5), 0.18))
                ctx.lineCap = 'round'
                ctx.lineWidth = 3.2
                for (let b = 0; b < BANDS; b++) {
                  const v = dbUnit(B.bands[b], floor, ceil)
                  const len = 6 + v * 118
                  ctx.strokeStyle = css(colorAt(palette, 0.35 + 0.65 * v))
                  for (const side of [1, -1]) {
                    const a = -Math.PI / 2 + side * ((b + 0.5) / BANDS) * Math.PI
                    ctx.beginPath()
                    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
                    ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len))
                    ctx.stroke()
                  }
                }
                ctx.lineCap = 'butt'
                ctx.beginPath()
                const m = 256
                for (let i = 0; i <= m; i++) {
                  const s = B.samples[Math.floor((i / m) * Math.min(B.samples.length - 1, 2047))] * gain
                  const r = r0 - 22 + Math.max(-1, Math.min(1, s)) * 16
                  const a = (i / m) * TAU - Math.PI / 2
                  if (i) ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
                  else ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
                }
                ctx.strokeStyle = css(colorAt(palette, 0.9), 0.8)
                ctx.lineWidth = 1.5
                ctx.stroke()
              } else {
                ctx.imageSmoothingEnabled = true
                ctx.drawImage(S.canvas, PLOT.x, PLOT.y, PLOT.w, PLOT.h)
                for (const t of TICKS) {
                  const y = PLOT.y + (Math.log(F_MAX / t) / Math.log(F_MAX / F_MIN)) * PLOT.h
                  line(ctx, PLOT.x - 4, y, PLOT.x, y, 'rgba(255,255,255,0.5)')
                  text(ctx, t >= 1000 ? `${t / 1000}k` : String(t), PLOT.x - 6, y + 4, { color: 'rgba(255,255,255,0.6)', size: 12, align: 'right' })
                }
                text(ctx, '← earlier     now →', PLOT.x + PLOT.w, bottom + 30, { color: 'rgba(255,255,255,0.5)', size: 12, align: 'right' })
              }
              if (view === 'bars')
                for (const t of TICKS) {
                  const x = logX(t)
                  line(ctx, x, bottom, x, bottom + 5, 'rgba(255,255,255,0.5)')
                  text(ctx, t >= 1000 ? `${t / 1000}k` : String(t), x, bottom + 20, { color: 'rgba(255,255,255,0.6)', size: 12, align: 'center' })
                }
              if (view === 'bars' || view === 'water') text(ctx, 'Hz', view === 'bars' ? PLOT.x : 8, view === 'bars' ? bottom + 20 : PLOT.y + 10, { color: 'rgba(255,255,255,0.45)', size: 12 })

              const pk = g ? peakFrequency(B.db, sr, size) : 0
              const nn = noteName(pk)
              if (nn && view !== 'water') {
                text(ctx, `${nn.name}${nn.octave}`, W - 24, 58, { color: '#fff', size: 36, align: 'right', weight: 700 })
                text(ctx, `${fmt(pk, 1)} Hz`, W - 24, 80, { color: 'rgba(255,255,255,0.65)', size: 14, align: 'right' })
              }
              if (!g) text(ctx, 'Preview: press Start to hear and see real audio', PLOT.x + 8, PLOT.y + 18, { color: 'rgba(255,255,255,0.7)', size: 14, mono: false, weight: 600 })
              if (f.frame % 8 === 0) setInfo({ peak: pk, level: g ? rmsDb(B.samples) : -Infinity })
            }}
          />
          <Readout
            items={[
              ['Dominant frequency', info.peak ? `${fmt(info.peak, 1)} Hz` : '—'],
              ['Nearest note', note ? note.label : '—'],
              ['Level', Number.isFinite(info.level) ? `${fmt(info.level, 1)} dBFS` : '—'],
              ['Bin width', `${fmt((graph.current?.ctx.sampleRate ?? 48000) / Number(fft), 2)} Hz`],
            ]}
          />
        </>
      }
    >
      <div className="row sim-bar" style={{ margin: 0 }}>
        {live ? (
          <button type="button" className="btn btn-icon primary" onClick={stop}>
            <Icon name="stop-circle" size={18} />
            Stop audio
          </button>
        ) : (
          <button type="button" className="btn btn-icon primary" onClick={() => void start()}>
            <Icon name={source === 'mic' ? 'microphone' : 'music-note'} size={18} />
            {source === 'mic' ? 'Start microphone' : 'Start test signal'}
          </button>
        )}
      </div>
      <PlayBar running={running} setRunning={setRunning} />
      {error && (
        <p className="sim-hint" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <Choice label="Source" value={source} options={[['test', 'Test signal'], ['mic', 'Microphone']]} onChange={setSource} />
      {source === 'test' && (
        <>
          <Choice label="Signal" value={signal} options={[['melody', 'Melody'], ['tone', 'Tone'], ['sweep', 'Sweep']]} onChange={setSignal} />
          <Select label="Waveform" value={wave} options={[['sine', 'Sine'], ['triangle', 'Triangle'], ['square', 'Square'], ['sawtooth', 'Sawtooth']]} onChange={(v) => setWave(v as OscillatorType)} />
          {signal === 'tone' && <Slider label="Frequency" value={freqPos} min={0} max={1000} format={(v) => `${freqFromSlider(v)} Hz`} onChange={setFreqPos} />}
          <Slider label="Volume" value={volume} min={0} max={1} step={0.05} onChange={setVolume} />
          <Toggle label="Mute speakers (keep analysing)" checked={muted} onChange={setMuted} />
        </>
      )}
      <Choice label="View" value={view} options={[['bars', 'Bars'], ['wave', 'Wave'], ['radial', 'Radial'], ['water', 'Waterfall']]} onChange={setView} />
      <Select label="FFT size" value={fft} options={[['512', '512'], ['1024', '1024'], ['2048', '2048'], ['4096', '4096'], ['8192', '8192']]} onChange={setFft} />
      <Slider label="Sensitivity" value={sens} min={0} max={40} unit=" dB" onChange={setSens} />
      <Slider label="Smoothing" value={smoothing} min={0} max={0.95} step={0.05} onChange={setSmoothing} />
      <Select label="Palette" value={palette} options={GRADIENT_OPTIONS} onChange={setPalette} />
      <Hint>Start the test signal (or your microphone) and watch its spectrum. The bars use a logarithmic frequency axis like a piano keyboard; notes an octave apart are the same distance apart. Stop releases the microphone.</Hint>
    </SimLayout>
  )
}
