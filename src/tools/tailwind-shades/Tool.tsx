import { useEffect, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { useSettled } from '../../motion/useSettled'
import { parseColor, rgbToHex } from '../color-palette/oklch'
import { buildShades, configV3, slugName, themeV4 } from './shades'
import './tool.css'

type Out = 'v4' | 'v4hex' | 'v3'

export default function TailwindShades() {
  const [text, setText] = useState('#0ea5e9')
  const [name, setName] = useState('brand')
  const [out, setOut] = useState<Out>('v4')
  const [copied, setCopied] = useState<number | null>(null)
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  const rgb = parseColor(text)
  const [last, setLast] = useState(() => parseColor('#0ea5e9')!)
  useEffect(() => {
    if (rgb) setLast(rgb)
  }, [rgb?.r, rgb?.g, rgb?.b])
  const shades = buildShades(rgb ?? last)
  const settled = useSettled(shades.map((s) => s.hex).join(), 180)
  const slug = slugName(name)
  const code = out === 'v3' ? configV3(name, shades) : themeV4(name, shades, out === 'v4hex' ? 'hex' : 'oklch')

  async function copy(step: number, hex: string) {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(step)
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(null), 1200)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="tw-color">Base color</label>
          <div className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
            <input type="color" aria-label="Pick base color" value={rgbToHex(rgb ?? last)} onChange={(e) => setText(e.target.value)} className="tws-picker" />
            <input id="tw-color" type="text" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} style={{ fontFamily: 'var(--mono)' }} />
          </div>
          {!rgb && <p className="error">Enter a color like #0ea5e9, rgb(14 165 233), hsl(199, 89%, 48%) or oklch(68.5% 0.169 237).</p>}
        </div>
        <div>
          <label htmlFor="tw-name">Color name</label>
          <input id="tw-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="brand" spellCheck={false} />
          <p className="muted tws-small">Used as <code>--color-{slug}-500</code> and <code>bg-{slug}-500</code>.</p>
        </div>
      </div>

      <div className="tws-scale" role="group" aria-label={`${slug} shades`}>
        {shades.map((s, i) => (
          <button
            key={`${settled}-${s.step}`}
            type="button"
            className={`tws-shade ${s.isInput ? 'is-input' : ''}`}
            style={{ background: s.hex, color: s.text === 'white' ? '#fff' : '#000', ['--i' as string]: i }}
            onClick={() => copy(s.step, s.hex)}
            aria-label={`${slug}-${s.step} ${s.hex}, ${s.aa ? 'passes' : 'fails'} AA with ${s.text} text. Copy hex`}
          >
            <span className="tws-step">{s.step}</span>
            <span className="tws-hex">{copied === s.step ? <span className="tws-copied">Copied!</span> : s.hex}</span>
            <span className={`tws-aa ${s.aa ? '' : 'fail'}`}>
              {s.text === 'white' ? 'White' : 'Black'} {Math.max(s.onWhite, s.onBlack).toFixed(1)} {s.aa ? 'AA' : '✕'}
            </span>
            {s.isInput && <span className="tws-you">your color</span>}
          </button>
        ))}
      </div>
      <p className="muted tws-small">
        Your color stays exactly at the nearest step (marked). Each tile shows the text color with better contrast and whether it reaches WCAG AA (4.5:1) for body text. Click a tile to copy its hex.
      </p>

      <PillRow label="Output">
        {([['v4', 'v4 @theme (OKLCH)'], ['v4hex', 'v4 @theme (hex)'], ['v3', 'v3 config']] as [Out, string][]).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={out === k} className={out === k ? 'btn primary' : 'btn'} onClick={() => setOut(k)}>
            {l}
          </button>
        ))}
      </PillRow>
      <SettleOutput value={code} aria-label="Tailwind code" rows={Math.min(22, code.split('\n').length + 1)} />
      <div className="row">
        <CopyButton text={code} />
      </div>
      <p className="muted">
        Tailwind v4 reads colors from CSS: paste the <code>@theme</code> block into your main CSS file after <code>@import "tailwindcss";</code>. For Tailwind v3, merge the object into <code>tailwind.config.js</code>. Scales are built in OKLCH like Tailwind's own palette, with chroma reduced where a shade would fall outside the sRGB gamut.
      </p>
    </div>
  )
}
