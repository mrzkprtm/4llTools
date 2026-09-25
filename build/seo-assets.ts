// Build-time image generation for SEO: share images for every page, and the
// favicon set made from public/favicon.svg. Runs in Node from the prerender
// plugin in vite.config.ts, so new tools get their images automatically.
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'

const require = createRequire(import.meta.url)
const fontFile = (weight: number) =>
  readFileSync(require.resolve(`@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-${weight}-normal.woff`))

const fonts = [
  { name: 'Bricolage', data: fontFile(400), weight: 400 as const, style: 'normal' as const },
  { name: 'Bricolage', data: fontFile(800), weight: 800 as const, style: 'normal' as const },
]

// Palette from src/styles.css.
const PAPER = '#f3f0e8'
const INK = '#1b1a17'
const MUTED = '#676357'
const ACCENT = '#c2410c'
const BORDER = '#d8d2c3'

/** Category hues, copied from the [data-cat] rules in src/styles.css. Unknown categories fall back to 60. */
let stylesCss: string | undefined
function categoryHue(key: string): number {
  stylesCss ??= readFileSync(fileURLToPath(new URL('../src/styles.css', import.meta.url)), 'utf8')
  const css = stylesCss
  const m = css.match(new RegExp(`\\[data-cat='${key}'\\]\\s*\\{\\s*--h:\\s*(\\d+)`))
  return m ? Number(m[1]) : 60
}

/** Converts OKLCH to an sRGB hex colour, clamping anything out of gamut. */
export function oklchToHex(l: number, c: number, h: number): string {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  return (
    '#' +
    lin
      .map((v) => {
        const x = Math.min(1, Math.max(0, v))
        const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
        return Math.round(s * 255).toString(16).padStart(2, '0')
      })
      .join('')
  )
}

/** The tool's duotone Majesticon as a data URI, coloured like its tile. */
function iconUri(name: string, line: string, fill: string): string | null {
  const dir = dirname(require.resolve('majesticons/package.json'))
  const read = (p: string) => {
    try {
      return readFileSync(resolve(dir, p), 'utf8').replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, '')
    } catch {
      return null
    }
  }
  const lineSvg = read(`line/${name}-line.svg`)
  if (!lineSvg) return null
  const solid = read(`solid/${name}.svg`)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">` +
    (solid ? `<g color="${fill}">${solid.replace(/currentColor/g, fill)}</g>` : '') +
    `<g color="${line}">${lineSvg.replace(/currentColor/g, line)}</g></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

type Node = { type: string; props: Record<string, unknown> & { children?: unknown } }
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
})

export interface ShareCard {
  /** Small caps line above the title, like the category. */
  eyebrow: string
  title: string
  description: string
  /** Category key for the tile colour; omit for the brand tile. */
  categoryKey?: string
  icon?: string
  symbol?: string
}

/** Keeps text to glyphs the bundled Latin font has: arrows become slashes, anything else outside Latin is dropped. */
const drawable = (s: string) =>
  s.replace(/\s*[↔⇄→←]\s*/g, ' / ').replace(/[^\u0000-\u024f\u2013\u2014\u2018\u2019\u201c\u201d\u2026\u00b7]/g, '').replace(/\s{2,}/g, ' ')

/** Renders a 1200×630 share image as PNG. */
export async function renderShareCard(input: ShareCard): Promise<Buffer> {
  const card = { ...input, eyebrow: drawable(input.eyebrow), title: drawable(input.title), description: drawable(input.description) }
  const hue = card.categoryKey ? categoryHue(card.categoryKey) : 45
  const tileBg = card.categoryKey ? oklchToHex(0.91, 0.055, hue) : ACCENT
  const tileInk = oklchToHex(0.38, 0.14, hue)
  const tileFill = oklchToHex(0.8, 0.17, hue)
  const icon = card.icon ? iconUri(card.icon, tileInk, tileFill) : null

  const tile = h(
    'div',
    {
      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      width: 260, height: 260, borderRadius: 32, background: tileBg, flexShrink: 0,
    },
    card.symbol
      ? h('div', { position: 'absolute', top: 20, left: 24, fontSize: 34, fontWeight: 800, color: tileInk, opacity: 0.8 }, card.symbol)
      : '',
    icon
      ? { type: 'img', props: { src: icon, width: 150, height: 150, style: { marginTop: 20 } } }
      : h('div', { fontSize: 170, fontWeight: 800, color: '#fff' }, '4'),
  )

  const titleSize = card.title.length > 28 ? 64 : card.title.length > 18 ? 76 : 88
  const body = h(
    'div',
    { display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 64 },
    h('div', { fontSize: 26, letterSpacing: 3, textTransform: 'uppercase', color: MUTED }, card.eyebrow),
    h('div', { fontSize: titleSize, fontWeight: 800, color: INK, lineHeight: 1.02, letterSpacing: -2, marginTop: 16 }, card.title),
    h('div', { fontSize: 32, color: MUTED, lineHeight: 1.3, marginTop: 24 }, card.description),
  )

  const footer = h(
    'div',
    {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderTop: `2px solid ${BORDER}`, paddingTop: 28, fontSize: 30, color: MUTED,
    },
    h('div', { display: 'flex', fontWeight: 800, color: INK, fontSize: 36 }, h('span', { color: ACCENT }, '4'), 'llTools'),
    h('div', { display: 'flex' }, 'Free · No sign-up · Runs in your browser'),
  )

  const root = h(
    'div',
    {
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      width: 1200, height: 630, padding: '72px 80px 56px', background: PAPER, fontFamily: 'Bricolage',
    },
    h('div', { display: 'flex', alignItems: 'center', flex: 1, paddingBottom: 40 }, tile, body),
    footer,
  )

  const svg = await satori(root as never, { width: 1200, height: 630, fonts })
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng()
}

/**
 * The brand mark (a white "4" on orange) as SVG, with the text drawn as paths so
 * it looks the same without the font installed. `maskable` gives a full-bleed
 * square with a smaller glyph, so Android's icon mask never clips it.
 */
export async function renderFaviconSvg(maskable = false): Promise<string> {
  const mark = h(
    'div',
    {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64,
      borderRadius: maskable ? 0 : 14, background: ACCENT, fontFamily: 'Bricolage',
    },
    h('div', { fontSize: maskable ? 34 : 50, fontWeight: 800, color: '#fff', marginTop: maskable ? -3 : -4 }, '4'),
  )
  return satori(mark as never, { width: 64, height: 64, fonts })
}

/** Renders an SVG file to a square PNG. */
function pngFromSvg(svg: string, size: number): Buffer {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
}

/** A .ico file holding PNG images (supported by every current browser). */
function icoFromPngs(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * pngs.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(data.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...pngs.map((p) => p.data)])
}

/** Writes favicon.ico, apple-touch-icon.png and the web manifest icons from the brand mark. */
export async function writeFavicons(outDir: string) {
  const [favicon, maskable] = await Promise.all([renderFaviconSvg(), renderFaviconSvg(true)])
  await mkdir(resolve(outDir, 'icons'), { recursive: true })
  await writeFile(resolve(outDir, 'favicon.ico'), icoFromPngs([16, 32, 48].map((size) => ({ size, data: pngFromSvg(favicon, size) }))))
  await writeFile(resolve(outDir, 'apple-touch-icon.png'), pngFromSvg(maskable, 180))
  await writeFile(resolve(outDir, 'icons/icon-192.png'), pngFromSvg(favicon, 192))
  await writeFile(resolve(outDir, 'icons/icon-512.png'), pngFromSvg(favicon, 512))
  await writeFile(resolve(outDir, 'icons/maskable-512.png'), pngFromSvg(maskable, 512))
}
