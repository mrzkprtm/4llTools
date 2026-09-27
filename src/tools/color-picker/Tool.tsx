import { useState, useEffect, useMemo } from 'react'
import { Roll } from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'

const CSS_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
  azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000', blanchedalmond: '#ffebcd',
  blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a', burlywood: '#deb887',
  cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e', coral: '#ff7f50',
  cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c', cyan: '#00ffff',
  darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b', darkgray: '#a9a9a9',
  darkgreen: '#006400', darkkhaki: '#bdb76b', darkmagenta: '#8b008b', darkolivegreen: '#556b2f',
  darkorange: '#ff8c00', darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f', darkslateblue: '#483d8b', darkslategray: '#2f4f4f', darkturquoise: '#00ced1',
  darkviolet: '#9400d3', deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700',
  goldenrod: '#daa520', gray: '#808080', green: '#008000', greenyellow: '#adff2f',
  honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c', indigo: '#4b0082',
  ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa', lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080',
  lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3', lightgreen: '#90ee90',
  lightpink: '#ffb6c1', lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa',
  lightslategray: '#778899', lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00',
  limegreen: '#32cd32', linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000',
  mediumaquamarine: '#66cdaa', mediumblue: '#0000cd', mediumorchid: '#ba55d3', mediumpurple: '#9370db',
  mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc', mediumvioletred: '#c71585', midnightblue: '#191970',
  mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead',
  navy: '#000080', oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23',
  orange: '#ffa500', orangered: '#ff4500', orchid: '#da70d6', palegoldenrod: '#eee8aa',
  palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093', papayawhip: '#ffefd5',
  peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb', plum: '#dda0dd', powderblue: '#b0e0e6',
  purple: '#800080', rebeccapurple: '#663399', red: '#ff0000', rosybrown: '#bc8f8f',
  royalblue: '#4169e1', saddlebrown: '#8b4513', salmon: '#fa8072', sandybrown: '#f4a460',
  seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d', silver: '#c0c0c0',
  skyblue: '#87ceeb', slateblue: '#6a5acd', slategray: '#708090', snow: '#fffafa',
  springgreen: '#00ff7f', steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080',
  thistle: '#d8bfd8', tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee',
  wheat: '#f5deb3', white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32',
}

export default function ColorPicker() {
  const [hex, setHex] = useState('#3b82f6')
  const [format, setFormat] = useState<'hex' | 'rgb' | 'hsl' | 'hsv' | 'cmyk' | 'lab'>('hex')
  const [paletteType, setPaletteType] = useState<'mono' | 'analogous' | 'complementary' | 'triadic' | 'tetradic' | 'shades' | 'tints' | 'tones'>('mono')
  const [savedColors, setSavedColors] = useState<string[]>(() => {
    const saved = localStorage.getItem('color-picker')
    return saved ? JSON.parse(saved) : ['#3b82f6', '#e11d48', '#16a34a', '#ca8a04', '#9333ea', '#f59e0b']
  })

  useEffect(() => {
    try { localStorage.setItem('color-picker', JSON.stringify(savedColors)) } catch {}
  }, [savedColors])

  const hexToRgb = (hex: string) => {
    const clean = hex.replace('#', '')
    const bigint = parseInt(clean, 16)
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
  }

  const rgbToHex = (r: number, g: number, b: number) => '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
  }

  const hslToRgb = (h: number, s: number, l: number) => {
    s /= 100; l /= 100
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = l - c / 2
    let r = 0, g = 0, b = 0
    if (h < 60) { r = c; g = x; b = 0 }
    else if (h < 120) { r = x; g = c; b = 0 }
    else if (h < 180) { r = 0; g = c; b = x }
    else if (h < 240) { r = 0; g = x; b = c }
    else if (h < 300) { r = x; g = 0; b = c }
    else { r = c; g = 0; b = x }
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
  }

  const hexToHsv = (hex: string) => {
    const { r, g, b } = hexToRgb(hex)
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0, v = max
    const d = max - min
    s = max === 0 ? 0 : d / max
    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) }
  }

  const hexToCmyk = (hex: string) => {
    const { r, g, b } = hexToRgb(hex)
    const r1 = r / 255, g1 = g / 255, b1 = b / 255
    const k = 1 - Math.max(r1, g1, b1)
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 }
    const c = Math.round((1 - r1 - k) / (1 - k) * 100)
    const m = Math.round((1 - g1 - k) / (1 - k) * 100)
    const y = Math.round((1 - b1 - k) / (1 - k) * 100)
    return { c, m, y, k: Math.round(k * 100) }
  }

  const hexToLab = (hex: string) => {
    const { r, g, b } = hexToRgb(hex)
    let r1 = r / 255, g1 = g / 255, b1 = b / 255
    r1 = r1 > 0.04045 ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92
    g1 = g1 > 0.04045 ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92
    b1 = b1 > 0.04045 ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92
    const x = r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805
    const y = r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722
    const z = r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505
    const fx = x / 0.95047, fy = y / 1.0, fz = z / 1.08883
    const f = (t: number) => t > 0.008856 ? Math.pow(t, 1/3) : (7.787 * t) + 16/116
    const L = Math.max(0, 116 * f(fy) - 16)
    const a = 500 * (f(fx) - f(fy))
    const b = 200 * (f(fy) - f(fz))
    return { L: Math.round(L * 100) / 100, a: Math.round(a * 100) / 100, b: Math.round(b * 100) / 100 }
  }

  const { r, g, b } = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)
  const { h: h2, s: s2, v } = hexToHsv(hex)
  const { c, m, y, k } = hexToCmyk(hex)
  const { L, a: labA, b: labB } = hexToLab(hex)

  const formatValue = useMemo(() => {
    switch (format) {
      case 'hex': return hex.toUpperCase()
      case 'rgb': return `rgb(${r}, ${g}, ${b})`
      case 'hsl': return `hsl(${h}°, ${s}%, ${l}%)`
      case 'hsv': return `hsv(${h2}°, ${s2}%, ${v}%)`
      case 'cmyk': return `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`
      case 'lab': return `lab(${L}%, ${labA}, ${labB})`
      default: return hex
    }
  }, [hex, format, r, g, b, h, s, l, h2, s2, v, c, m, y, k, L, labA, labB])

  const generatePalette = useMemo(() => {
    const { h, s, l } = rgbToHsl(r, g, b)
    const colors: string[] = []
    switch (paletteType) {
      case 'mono':
        for (let i = 0; i < 5; i++) {
          const newL = Math.max(0, Math.min(100, l + (i - 2) * 15))
          const { r, g, b } = hslToRgb(h, s, newL)
          colors.push(rgbToHex(r, g, b))
        }
        break
      case 'analogous':
        for (let i = -2; i <= 2; i++) {
          const newH = (h + i * 30 + 360) % 360
          const { r, g, b } = hslToRgb(newH, s, l)
          colors.push(rgbToHex(r, g, b))
        }
        break
      case 'complementary':
        colors.push(hex)
        const compH = (h + 180) % 360
        const { r, g, b } = hslToRgb(compH, s, l)
        colors.push(rgbToHex(r, g, b))
        break
      case 'triadic':
        for (let i = 0; i < 3; i++) {
          const newH = (h + i * 120) % 360
          const { r, g, b } = hslToRgb(newH, s, l)
          colors.push(rgbToHex(r, g, b))
        }
        break
      case 'tetradic':
        for (let i = 0; i < 4; i++) {
          const newH = (h + i * 90) % 360
          const { r, g, b } = hslToRgb(newH, s, l)
          colors.push(rgbToHex(r, g, b))
        }
        break
      case 'shades':
        for (let i = 0; i < 5; i++) {
          const newL = Math.max(0, l - i * 20)
          const { r, g, b } = hslToRgb(h, s, newL)
          colors.push(rgbToHex(r, g, b))
        }
        break
      case 'tints':
        for (let i = 0; i < 5; i++) {
          const newL = Math.min(100, l + i * 20)
          const { r, g, b } = hslToRgb(h, s, newL)
          colors.push(rgbToHex(r, g, b))
        }
        break
      case 'tones':
        for (let i = 0; i < 5; i++) {
          const newS = Math.max(0, s - i * 20)
          const { r, g, b } = hslToRgb(h, newS, l)
          colors.push(rgbToHex(r, g, b))
        }
        break
    }
    return colors
  }, [hex, paletteType, r, g, b, h, s, l])

  const saveColor = (color: string) => {
    if (!savedColors.includes(color)) setSavedColors([...savedColors, color])
  }

  const removeSaved = (color: string) => {
    setSavedColors(savedColors.filter(c => c !== color))
  }

  const copyFormat = () => navigator.clipboard.writeText(formatValue)

  return (
    <div>
      <h3 style={{ marginBottom: 16 }}>Color Picker & Converter</h3>

      <div className="row" style={{ gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <span>Color</span>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input type="color" value={hex} onChange={e => setHex(e.target.value)} style={{ width: 60, height: 40, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
            <input type="text" value={hex} onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{6}$/.test(v)) setHex(v) }} style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px', fontFamily: 'var(--mono)' }} />
          </div>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
          <span>Output Format</span>
          <select value={format} onChange={e => setFormat(e.target.value as any)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px' }}>
            <option value="hex">HEX</option>
            <option value="rgb">RGB</option>
            <option value="hsl">HSL</option>
            <option value="hsv">HSV</option>
            <option value="cmyk">CMYK</option>
            <option value="lab">LAB</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
          <span>Palette Type</span>
          <select value={paletteType} onChange={e => setPaletteType(e.target.value as any)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '8px' }}>
            <option value="mono">Monochromatic</option>
            <option value="analogous">Analogous</option>
            <option value="complementary">Complementary</option>
            <option value="triadic">Triadic</option>
            <option value="tetradic">Tetradic</option>
            <option value="shades">Shades</option>
            <option value="tints">Tints</option>
            <option value="tones">Tones</option>
          </select>
        </label>
      </div>

      <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ width: 80, height: 80, borderRadius: 8, background: hex, border: '2px solid var(--border)' }} />
          <div style={{ textAlign: 'center' }}>
            <div className="row" style={{ justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: '0.7rem' }}>HEX</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.2rem' }}>{hex.toUpperCase()}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: '0.7rem' }}>RGB</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.2rem' }}>rgb({r}, {g}, {b})</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: '0.7rem' }}>HSL</div>
                <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: '1.2rem' }}>hsl({h}°, {s}%, {l}%)</div>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'center', gap: 8, marginTop: 8 }}>
              <button className="btn" onClick={() => navigator.clipboard.writeText(formatValue)} style={{ padding: '8px 16px' }}>Copy {format.toUpperCase()}</button>
              <button className="btn" onClick={() => navigator.clipboard.writeText(hex)}>Copy HEX</button>
              <button className="btn" onClick={() => navigator.clipboard.writeText(`rgb(${r}, ${g}, ${b})`)}>Copy RGB</button>
              <button className="btn" onClick={() => navigator.clipboard.writeText(`hsl(${h}°, ${s}%, ${l}%)`)}>Copy HSL</button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>Generated Palette ({paletteType})</h4>
            <button className="btn" onClick={() => navigator.clipboard.writeText(generatePalette.join('\n'))}>Copy Palette</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
            {generatePalette.map((color, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, background: color, border: '2px solid var(--border)', margin: '0 auto 4px' }} />
                <div style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', fontWeight: 600 }}>{color.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ margin: '0 0 12px' }}>Color Values</h4>
            <div style={{ display: 'grid', gap: 8, fontSize: '0.85rem' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">HEX</span><code>{hex.toUpperCase()}</code></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">RGB</span><code>rgb({r}, {g}, {b})</code></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">HSL</span><code>hsl({h}°, {s}%, {l}%)</code></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">HSV</span><code>hsv({h2}°, {s2}%, {v}%)</code></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">CMYK</span><code>cmyk({c}%, {m}%, {y}%, {k}%)</code></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">LAB</span><code>lab({L}%, {labA}, {labB})</code></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">CSS Name</span><code>{Object.entries(CSS_COLORS).find(([, v]) => v.toLowerCase() === hex.toLowerCase())?.[0] || 'Custom'}</code></div>
            </div>
          </div>

          <div className="pop-row" style={{ padding: 16, background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <h4 style={{ margin: '0 0 12px' }}>Contrast Checker</h4>
            <div className="row" style={{ gap: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Foreground</span>
                <input type="color" value={hex} onChange={e => setHex(e.target.value)} style={{ width: 60, height: 40, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Background</span>
                <input type="color" value="#ffffff" onChange={e => {}} style={{ width: 60, height: 40, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
              </label>
            </div>
            <p className="muted" style={{ fontSize: '0.8rem' }}>Contrast ratio calculation available in full version.</p>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 12 }}>Saved Colors</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {savedColors.map((color, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--sunken)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ width: 24, height: 24, borderRadius: 4, background: color, border: '1px solid var(--border)' }} />
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{color.toUpperCase()}</span>
                <button onClick={() => setSavedColors(savedColors.filter(c => c !== color))} style={{ color: 'var(--danger)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>×</button>
              </div>
            ))}
            <button className="btn" onClick={() => setSavedColors([...savedColors, hex])} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ width: 24, height: 24, borderRadius: 4, background: hex, border: '1px solid var(--border)' }} />
              <span>Save Current</span>
            </button>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
          Pick colors and convert between HEX, RGB, HSL, HSV, CMYK, LAB. Generate palettes: monochromatic, analogous, complementary, triadic, tetradic, shades, tints, tones. Save favorite colors.
        </p>
      </div>
    </div>
  )
}