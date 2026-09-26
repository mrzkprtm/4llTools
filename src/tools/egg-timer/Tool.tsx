import { useState, useEffect, useRef } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const EGG_TYPES = [
  { name: 'Soft', time: 4 * 60, yolk: 0.3 },
  { name: 'Medium', time: 6 * 60, yolk: 0.6 },
  { name: 'Hard', time: 10 * 60, yolk: 1.0 },
]

const SIZES = [
  { name: 'Small (50g)', factor: 0.9 },
  { name: 'Medium (58g)', factor: 1.0 },
  { name: 'Large (67g)', factor: 1.1 },
  { name: 'Extra Large (75g)', factor: 1.2 },
]

const TEMPS = [
  { name: 'Fridge (4°C)', factor: 1.2 },
  { name: 'Room (20°C)', factor: 1.0 },
]

export default function EggTimer() {
  const [eggType, setEggType] = useState(0)
  const [size, setSize] = useState(1)
  const [temp, setTemp] = useState(1)
  const [running, setRunning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(EGG_TYPES[0].time * SIZES[1].factor * TEMPS[1].factor)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const baseTime = EGG_TYPES[eggType].time
  const adjustedTime = Math.round(baseTime * SIZES[size].factor * TEMPS[temp].factor)

  useEffect(() => {
    if (!running) return
    setTimeLeft(adjustedTime)
  }, [eggType, size, temp, adjustedTime, running])

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setRunning(false)
          playSound()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [running, timeLeft])

  const playSound = () => {
    try {
      const ctx = new AudioContext()
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        osc.connect(gain).connect(ctx.destination)
        const t = ctx.currentTime + i * 0.4
        gain.gain.setValueAtTime(0.3, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
        osc.start(t)
        osc.stop(t + 0.3)
      }
    } catch {}
    navigator.vibrate?.([200, 100, 200, 100, 200])
  }

  const toggle = () => {
    if (running) setRunning(false)
    else { setRunning(true) }
  }

  const reset = () => {
    setRunning(false)
  }

  const totalTime = EGG_TYPES[eggType].time * SIZES[size].factor * TEMPS[temp].factor
  const progress = totalTime > 0 ? 1 - timeLeft / totalTime : 0
  const yolkSet = EGG_TYPES[eggType].yolk * progress

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = 200 * dpr
    canvas.height = 200 * dpr
    canvas.style.width = '200px'
    canvas.style.height = '200px'
    ctx.scale(dpr, dpr)

    const draw = () => {
      ctx.clearRect(0, 0, 200, 200)
      const centerX = 100
      const centerY = 100

      // Egg shell
      ctx.beginPath()
      ctx.ellipse(100, 100, 60, 80, 0, 0, Math.PI * 2)
      ctx.fillStyle = '#f5f0e1'
      ctx.fill()
      ctx.strokeStyle = '#d4c4a8'
      ctx.lineWidth = 3
      ctx.stroke()

      // Egg white
      ctx.beginPath()
      ctx.ellipse(100, 100, 50, 70, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fill()

      // Yolk - position changes as it sets
      const yolkY = 100 + (1 - yolkSet) * 20
      const yolkR = 25 * (0.8 + 0.2 * yolkSet)
      const yolkColor = `hsl(${35 + yolkSet * 20}, 100%, ${50 - yolkSet * 15}%)`

      ctx.beginPath()
      ctx.ellipse(100, yolkY, yolkR, yolkR * 0.9, 0, 0, Math.PI * 2)
      const grad = ctx.createRadialGradient(100 - yolkR * 0.3, yolkY - yolkR * 0.3, 0, 100, yolkY, yolkR)
      grad.addColorStop(0, 'rgba(255,255,200,0.9)')
      grad.addColorStop(1, yolkColor)
      ctx.fillStyle = grad
      ctx.fill()
    }
    draw()
  }, [yolkSet])

  const totalTime = EGG_TYPES[eggType].time * SIZES[size].factor * TEMPS[temp].factor

  return (
    <div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Doneness</label>
          <select value={eggType} onChange={e => { setEggType(Number(e.target.value)); setRunning(false) }}>
            {EGG_TYPES.map((e, i) => <option key={e.name} value={i}>{e.name} ({Math.round(e.time/60)} min)</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Egg Size</label>
          <select value={size} onChange={e => { setSize(Number(e.target.value)); setRunning(false) }}>
            {SIZES.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label>Start Temperature</label>
          <select value={temp} onChange={e => { setTemp(Number(e.target.value)); setRunning(false) }}>
            {TEMPS.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <canvas ref={canvasRef} width={200} height={200} style={{ borderRadius: '50%', background: '#f5f0e1', border: '2px solid var(--border)' }} />
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}><Roll>{timeLeft}</Roll>s</span>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn primary" onClick={() => { setRunning(!running) }} style={{ minWidth: 140 }}>
          {timeLeft <= 0 ? 'Done!' : running ? 'Pause' : 'Start'}
        </button>
        <button className="btn" onClick={() => { setRunning(false); }}>Reset</button>
      </div>

      <div className="stats">
        <div className="stat"><b><Roll>{EGG_TYPES[eggType].name}</Roll></b><span className="muted">Doneness</span></div>
        <div className="stat"><b><Roll>{SIZES[size].name}</Roll></b><span className="muted">Size</span></div>
        <div className="stat"><b><Roll>{TEMPS[temp].name}</Roll></b><span className="muted">Temp</span></div>
      </div>

      <Hint>Pick doneness, size, and start temp. Cross-section shows yolk setting as countdown runs. Times adjusted for size and temp.</Hint>
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="muted" style={{ marginTop: 16, fontSize: '0.85rem' }}>{children}</p>
}