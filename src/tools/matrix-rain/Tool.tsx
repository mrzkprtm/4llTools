import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Stage, { type SimPointer } from '../../sim/Stage'
import { Hint, PlayBar, Readout, Select, SimLayout, Slider, Toggle, useRunning } from '../../sim/controls'
import { MONO, downloadCanvas } from '../../sim/draw'
import { fmt } from '../../sim/math'
import { makeColumn, mutate, parseGlyphs, spell, stepColumn, type Column, type GlyphSet } from './rain'

const W = 800
const H = 500

const SETS = [['katakana', 'Katakana + digits'], ['latin', 'Latin A–Z'], ['digits', 'Digits'], ['binary', 'Binary 0/1'], ['custom', 'Custom characters']] as const

const COLORS = {
  green: { name: 'Classic green', trail: '#00ff66', head: '#e6ffee' },
  amber: { name: 'Amber', trail: '#ffb000', head: '#fff3d6' },
  cyan: { name: 'Cyan', trail: '#00e5ff', head: '#e0fcff' },
  pink: { name: 'Pink', trail: '#ff4fd8', head: '#ffe3f8' },
  rainbow: { name: 'Rainbow', trail: '', head: '#ffffff' },
} as const
type ColorKey = keyof typeof COLORS

export default function MatrixRain() {
  const [running, setRunning] = useRunning()
  const [set, setSet] = useState<GlyphSet>('katakana')
  const [custom, setCustom] = useState('4LLTOOLS<>/{}=+*')
  const [size, setSize] = useState(16)
  const [speed, setSpeed] = useState(1)
  const [density, setDensity] = useState(0.75)
  const [color, setColor] = useState<ColorKey>('green')
  const [glow, setGlow] = useState(true)
  const [message, setMessage] = useState(true)
  const [word, setWord] = useState('4LLTOOLS')
  const [info, setInfo] = useState({ cols: 0, glyphs: 0, spelled: 0 })
  const glyphs = useMemo(() => parseGlyphs(set, custom), [set, custom])
  const cols = Math.floor(W / size)
  const rows = Math.ceil(H / size)
  const columns = useRef<Column[]>([])
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const boost = useRef<Float32Array>(new Float32Array(0))
  const nextMsg = useRef(2)
  const spelled = useRef(0)
  const canvas = useRef<HTMLCanvasElement | null>(null)

  // Rebuild the columns when the grid or the character set changes.
  useEffect(() => {
    columns.current = Array.from({ length: cols }, () => makeColumn(rows, glyphs, Math.random))
    boost.current = new Float32Array(cols)
  }, [cols, rows, glyphs])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const leave = () => (pointer.current = null)
    c.addEventListener('pointerleave', leave)
    return () => c.removeEventListener('pointerleave', leave)
  }, [])

  function onPointer(p: SimPointer) {
    pointer.current = { x: p.x, y: p.y }
  }

  const palette = COLORS[color]

  return (
    <SimLayout
      stage={
        <>
          <Stage
            world={[W, H]}
            running={running}
            speed={speed}
            className="sim-dark"
            canvasRef={canvas}
            onPointer={onPointer}
            label={`Digital rain of ${glyphs.length} different characters falling in ${cols} columns.`}
            onFrame={(ctx, f) => {
              const cs = columns.current
              // Wait for the columns to be rebuilt after the grid size changes.
              if (cs.length !== cols || cs[0]?.glyphs.length !== rows) return
              const b = boost.current
              const p = pointer.current
              // Columns near the pointer slow down and light up.
              for (let i = 0; i < cols; i++) {
                const near = p ? Math.max(0, 1 - Math.abs((i + 0.5) * size - p.x) / 70) : 0
                b[i] += (near - b[i]) * Math.min(1, (f.dt || 1 / 60) * 8)
              }
              if (f.dt > 0) {
                for (let i = 0; i < cols; i++) stepColumn(cs[i], f.dt * (1 - b[i] * 0.8), rows, Math.random, density)
                mutate(cs, Math.ceil(cols * rows * 0.6 * f.dt), glyphs, Math.random)
                if (message && word.trim() && (nextMsg.current -= f.dt) <= 0) {
                  nextMsg.current = 4 + Math.random() * 5
                  const i = Math.floor(Math.random() * cols)
                  spell(cs[i], word.trim().slice(0, rows - 2), rows)
                  spelled.current++
                }
              }
              ctx.fillStyle = '#000'
              ctx.fillRect(0, 0, W, H)
              ctx.font = `500 ${size}px ${MONO}`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              let drawn = 0
              for (let i = 0; i < cols; i++) {
                const c = cs[i]
                if (c.wait > 0) continue
                const x = (i + 0.5) * size
                const head = Math.floor(c.y)
                const trail = color === 'rainbow' ? `hsl(${(i * 9 + f.t * 30) % 360} 100% 62%)` : palette.trail
                const lit = b[i]
                for (let k = c.len - 1; k >= 0; k--) {
                  const row = head - k
                  if (row < 0 || row >= rows) continue
                  const inMsg = c.msg !== null && row >= c.msgRow && row < c.msgRow + c.msg.length
                  let a = k === 0 ? 1 : (1 - k / c.len) ** 1.4
                  if (inMsg) a = Math.max(a, 0.9)
                  a = Math.min(1, a * (1 + lit * 1.5))
                  if (a < 0.03) continue
                  ctx.globalAlpha = a
                  const bright = k === 0 || inMsg
                  ctx.fillStyle = bright ? palette.head : trail
                  if (glow && (k < 2 || inMsg)) {
                    ctx.shadowColor = trail
                    ctx.shadowBlur = 10 + lit * 10
                  }
                  ctx.fillText(c.glyphs[row], x, row * size)
                  ctx.shadowBlur = 0
                  drawn++
                }
              }
              ctx.globalAlpha = 1
              if (f.frame % 12 === 0) setInfo({ cols, glyphs: drawn, spelled: spelled.current })
            }}
          />
          <Readout items={[['Columns', info.cols], ['Glyphs on screen', fmt(info.glyphs, 0)], ['Character set', glyphs.length], ['Words spelled', info.spelled]]} />
        </>
      }
    >
      <PlayBar running={running} setRunning={setRunning}>
        <button type="button" className="btn btn-icon" onClick={() => void canvas.current?.parentElement?.requestFullscreen?.().catch(() => {})}>
          <Icon name="arrows-expand-full" size={18} />
          Fullscreen
        </button>
        <button type="button" className="btn btn-icon" onClick={() => downloadCanvas(canvas.current, 'digital-rain.png')}>
          <Icon name="arrow-down-circle" size={18} />
          Save PNG
        </button>
      </PlayBar>
      <Select label="Characters" value={set} options={SETS} onChange={setSet} />
      {set === 'custom' && (
        <div className="sim-field">
          <label className="sim-label" htmlFor="mr-custom">
            Your characters
          </label>
          <input id="mr-custom" className="sim-text" type="text" value={custom} maxLength={80} spellCheck={false} onChange={(e) => setCustom(e.target.value)} />
        </div>
      )}
      <Select label="Colour" value={color} options={Object.entries(COLORS).map(([k, c]) => [k as ColorKey, c.name] as const)} onChange={setColor} />
      <Slider label="Font size" value={size} min={12} max={32} unit=" px" onChange={setSize} />
      <Slider label="Speed" value={speed} min={0.2} max={3} step={0.1} unit="×" onChange={setSpeed} />
      <Slider label="Density" value={density} min={0.1} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={setDensity} />
      <Toggle label="Glow" checked={glow} onChange={setGlow} />
      <Toggle label="Hidden message" checked={message} onChange={setMessage} />
      {message && (
        <div className="sim-field">
          <label className="sim-label" htmlFor="mr-word">
            Message word
          </label>
          <input id="mr-word" className="sim-text" type="text" value={word} maxLength={24} spellCheck={false} onChange={(e) => setWord(e.target.value)} />
        </div>
      )}
      <Hint>Each column is a drop of characters with a bright head and a fading tail; characters flicker as they change. Hover over the rain to slow and light up the columns under the pointer, and watch for your message word spelled down a column.</Hint>
    </SimLayout>
  )
}
