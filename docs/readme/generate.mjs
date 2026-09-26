// Regenerates the animated SVGs used by README.md (banner and category chart,
// each in a light and a dark version) from the tools in src/tools.
//
//   node docs/readme/generate.mjs
//
// The SVGs animate with plain CSS, which GitHub renders inside <img>, and they
// stop moving for readers who ask for reduced motion.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const toolsDir = join(here, '../../src/tools')

const tools = readdirSync(toolsDir)
  .filter((d) => existsSync(join(toolsDir, d, 'meta.ts')))
  .map((d) => readFileSync(join(toolsDir, d, 'meta.ts'), 'utf8').match(/category:\s*'([^']+)'/)[1])
const counts = [...tools.reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
const total = tools.length

// Same hue angles as the category tiles in src/styles.css.
const HUE = { 'Scan & Code': 35, Text: 255, Developer: 155, Security: 0, Convert: 200, Calculator: 85, Design: 315, Image: 125, Network: 285, Utility: 60, Physics: 230, Math: 20, Algorithms: 175, Science: 105, Art: 340, Money: 140, Health: 210, Home: 330, Productivity: 10, Travel: 180, Learning: 265, Music: 30, Work: 240, Everyday: 355 }
const SIMULATIONS = new Set(['Physics', 'Math', 'Algorithms', 'Science', 'Art'])
const sims = tools.filter((c) => SIMULATIONS.has(c)).length

const THEMES = {
  light: { bg: '#f3f0e8', surface: '#fcfbf7', sunken: '#ece8de', text: '#1b1a17', muted: '#676357', border: '#d8d2c3', accent: '#c2410c', l: 48, tile: 88 },
  dark: { bg: '#141311', surface: '#1c1b18', sunken: '#100f0d', text: '#efebe2', muted: '#a39d8f', border: '#2f2d28', accent: '#ff7033', l: 62, tile: 24 },
}

const SANS = `'Bricolage Grotesque', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
const MONO = `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
const still = `@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }`

function banner(t) {
  const bars = [0.35, 0.8, 0.55, 0.2, 0.95, 0.65, 0.45, 0.75]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="400" viewBox="0 0 1280 400" role="img" aria-label="4llTools: ${total} free tools and simulations that run in your browser">
<style>
  .t { font-family: ${SANS}; fill: ${t.text}; }
  .m { font-family: ${MONO}; fill: ${t.muted}; letter-spacing: 0.08em; }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes swing { 0%, 100% { transform: rotate(26deg); } 50% { transform: rotate(-26deg); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes spin2 { to { transform: rotate(-360deg); } }
  @keyframes scroll { to { transform: translateX(-120px); } }
  @keyframes bar { 0%, 100% { transform: scaleY(var(--a)); } 50% { transform: scaleY(var(--b)); } }
  @keyframes pop { 0%, 100% { transform: scale(0.6); opacity: 0.35; } 50% { transform: scale(1); opacity: 1; } }
  @keyframes blink { 50% { opacity: 0; } }
  .rise { animation: rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .pend { transform-origin: 900px 72px; animation: swing 2.4s ease-in-out infinite; }
  .orbit { transform-origin: 1148px 150px; animation: spin 6s linear infinite; }
  .moon { transform-origin: 1148px 150px; animation: spin2 2.6s linear infinite; }
  .wave { animation: scroll 1.6s linear infinite; }
  .bar { transform-box: fill-box; transform-origin: bottom; animation: bar 1.8s ease-in-out infinite; }
  .dot { transform-box: fill-box; transform-origin: center; animation: pop 2s ease-in-out infinite; }
  .caret { animation: blink 1s steps(1) infinite; }
  ${still}
</style>
<defs>
  <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="${t.border}" stroke-width="1" opacity="0.55"/></pattern>
  <clipPath id="waveclip"><rect x="836" y="236" width="224" height="124" rx="10"/></clipPath>
</defs>
<rect width="1280" height="400" rx="20" fill="${t.bg}"/>
<rect width="1280" height="400" rx="20" fill="url(#grid)"/>
<rect x="0.5" y="0.5" width="1279" height="399" rx="19.5" fill="none" stroke="${t.border}"/>

<g class="rise"><text x="64" y="92" class="m" font-size="15">A POCKET WORKBENCH · ${total} TOOLS</text></g>
<g class="rise" style="animation-delay: 80ms"><text x="60" y="176" class="t" font-size="96" font-weight="800" letter-spacing="-4"><tspan fill="${t.accent}">4</tspan>ll<tspan font-weight="400">Tools</tspan><tspan class="caret" fill="${t.accent}" font-weight="400">_</tspan></text></g>
<g class="rise" style="animation-delay: 160ms">
  <text x="64" y="232" class="t" font-size="27" font-weight="650">Small tools for everyday jobs.</text>
  <text x="64" y="268" class="t" font-size="27" font-weight="400" fill="${t.muted}" style="fill: ${t.muted}">Nothing you type leaves this tab.</text>
</g>
<g class="rise" style="animation-delay: 240ms" font-family="${MONO}" font-size="14">
  ${[[`${sims} simulations`, 0], [`${total - sims} everyday tools`, 172], ['0 uploads · 0 sign-ups', 364]]
    .map(([s, x]) => `<g transform="translate(${64 + x} 306)"><rect width="${String(s).length * 8.6 + 28}" height="34" rx="17" fill="${t.surface}" stroke="${t.border}"/><text x="14" y="22" fill="${t.text}">${s}</text></g>`)
    .join('\n  ')}
</g>

<!-- Pendulum -->
<g>
  <rect x="836" y="40" width="224" height="180" rx="10" fill="${t.surface}" stroke="${t.border}"/>
  <text x="850" y="208" class="m" font-size="11">PHYSICS</text>
  <rect x="870" y="64" width="60" height="8" rx="2" fill="${t.text}"/>
  <path d="M858 162 A 42 42 0 0 0 942 162" fill="none" stroke="${t.border}" stroke-dasharray="3 5" transform="translate(0 0)"/>
  <g class="pend"><line x1="900" y1="72" x2="900" y2="172" stroke="${t.text}" stroke-width="2.5"/><circle cx="900" cy="172" r="13" fill="${t.accent}" stroke="${t.surface}" stroke-width="3"/></g>
  <circle cx="900" cy="72" r="4" fill="${t.surface}" stroke="${t.text}" stroke-width="2"/>
</g>

<!-- Orbit -->
<g>
  <rect x="1076" y="40" width="152" height="180" rx="10" fill="#0d0c0b" stroke="${t.border}"/>
  <text x="1090" y="208" class="m" font-size="11" style="fill:#a39d8f">SPACE</text>
  <circle cx="1148" cy="150" r="46" fill="none" stroke="#3a3833" stroke-dasharray="2 4"/>
  <circle cx="1148" cy="150" r="12" fill="#f59f00"/><circle cx="1148" cy="150" r="20" fill="#f59f00" opacity="0.18"/>
  <g class="orbit"><circle cx="1194" cy="150" r="6" fill="#4dabf7"/><g class="moon" style="transform-origin: 1194px 150px"><circle cx="1206" cy="150" r="2.5" fill="#efebe2"/></g></g>
  ${[[1092, 60], [1210, 76], [1100, 120], [1214, 196], [1130, 70], [1180, 190]].map(([x, y], i) => `<circle class="dot" style="animation-delay:${i * 0.3}s" cx="${x}" cy="${y}" r="1.4" fill="#efebe2"/>`).join('')}
</g>

<!-- Wave -->
<g>
  <rect x="836" y="236" width="224" height="124" rx="10" fill="${t.surface}" stroke="${t.border}"/>
  <g clip-path="url(#waveclip)"><g class="wave">
    <path d="${Array.from({ length: 61 }, (_, i) => `${i ? 'L' : 'M'}${836 + i * 6},${298 - Math.sin((i * 6 * Math.PI) / 60) * 26}`).join(' ')}" fill="none" stroke="${t.accent}" stroke-width="3" stroke-linecap="round"/>
    <path d="${Array.from({ length: 61 }, (_, i) => `${i ? 'L' : 'M'}${836 + i * 6},${298 - Math.cos((i * 6 * Math.PI) / 60) * 14}`).join(' ')}" fill="none" stroke="#1c7ed6" stroke-width="2" opacity="0.7"/>
  </g></g>
  <text x="850" y="350" class="m" font-size="11">MATH</text>
</g>

<!-- Sorting bars -->
<g>
  <rect x="1076" y="236" width="152" height="124" rx="10" fill="${t.surface}" stroke="${t.border}"/>
  ${bars.map((a, i) => `<rect class="bar" style="--a:${a};--b:${bars[(i + 3) % bars.length]};animation-delay:${i * 0.12}s" x="${1090 + i * 16}" y="252" width="11" height="80" rx="2" fill="hsl(${HUE.Algorithms} 55% ${t.l}%)"/>`).join('\n  ')}
  <text x="1090" y="350" class="m" font-size="11">ALGORITHMS</text>
</g>
</svg>
`
}

function chart(t) {
  const rowH = 30
  const top = 96
  const left = 170
  const width = 1280
  const height = top + counts.length * rowH + 36
  const max = counts[0][1]
  const barW = 900
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${total} tools in ${counts.length} categories: ${counts.map(([c, n]) => `${c.replace('&', 'and')} ${n}`).join(', ')}">
<style>
  .t { font-family: ${SANS}; fill: ${t.text}; }
  .m { font-family: ${MONO}; fill: ${t.muted}; }
  @keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes shine { 0%, 70% { transform: translateX(-120px); } 100% { transform: translateX(${barW + 120}px); } }
  .bar { transform-box: fill-box; transform-origin: left; animation: grow 1.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .n { animation: fade 0.5s ease-out both; }
  .shine { animation: shine 4s ease-in-out infinite; }
  ${still}
</style>
<defs><linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<rect width="${width}" height="${height}" rx="20" fill="${t.bg}"/>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="19.5" fill="none" stroke="${t.border}"/>
<text x="40" y="52" class="t" font-size="26" font-weight="750">${total} tools in ${counts.length} categories</text>
<text x="40" y="76" class="m" font-size="13">BARS IN A CATEGORY'S TILE COLOR · ★ = INTERACTIVE SIMULATIONS</text>
${counts
  .map(([c, n], i) => {
    const y = top + i * rowH
    const w = (n / max) * barW
    const color = `hsl(${HUE[c] ?? 60} 48% ${t.l}%)`
    const delay = `${i * 70}ms`
    return `<g>
  <text x="${left - 14}" y="${y + 18}" class="t" font-size="15" font-weight="600" text-anchor="end">${SIMULATIONS.has(c) ? '★ ' : ''}${c.replace('&', '&amp;')}</text>
  <rect x="${left}" y="${y + 4}" width="${barW}" height="18" rx="5" fill="${t.sunken}"/>
  <rect class="bar" style="animation-delay:${delay}" x="${left}" y="${y + 4}" width="${w}" height="18" rx="5" fill="${color}"/>
  <text class="n m" style="animation-delay:${i * 70 + 600}ms" x="${left + w + 10}" y="${y + 18}" font-size="13" font-weight="600">${n}</text>
</g>`
  })
  .join('\n')}
<clipPath id="barsclip"><rect x="${left}" y="${top}" width="${barW}" height="${counts.length * rowH}"/></clipPath>
<g clip-path="url(#barsclip)"><rect class="shine" x="${left}" y="${top}" width="120" height="${counts.length * rowH}" fill="url(#sh)"/></g>
</svg>
`
}

for (const [name, t] of Object.entries(THEMES)) {
  writeFileSync(join(here, `banner-${name}.svg`), banner(t))
  writeFileSync(join(here, `categories-${name}.svg`), chart(t))
}
console.log(`Wrote banner and category chart for ${total} tools in ${counts.length} categories.`)

// Rebuild the tool catalog in README.md between the <!-- tools:start --> and
// <!-- tools:end --> markers, one collapsible section per category.
const SITE = 'https://4lltools.morizdigital.com'
const EMOJI = { Physics: '🪐', Math: '📐', Algorithms: '🧮', Science: '🧬', Art: '🎨', Developer: '🛠️', Text: '📝', Security: '🔐', Design: '🎛️', Calculator: '🧾', Image: '🖼️', Network: '🌐', Convert: '🔁', Utility: '⏱️', 'Scan & Code': '📷', Money: '💰', Health: '❤️', Home: '🏠', Productivity: '✅', Travel: '✈️', Learning: '📚', Music: '🎵', Work: '💼', Everyday: '🌙' }
const str = (src, key) => (src.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`))?.[1] ?? '').replace(/\\(.)/g, '$1')
const all = readdirSync(toolsDir)
  .filter((d) => existsSync(join(toolsDir, d, 'meta.ts')))
  .map((slug) => {
    const src = readFileSync(join(toolsDir, slug, 'meta.ts'), 'utf8')
    return { slug, name: str(src, 'name'), description: str(src, 'description'), category: str(src, 'category'), symbol: str(src, 'symbol') }
  })
  .sort((a, b) => a.name.localeCompare(b.name))
const order = [...counts.map(([c]) => c).filter((c) => SIMULATIONS.has(c)).sort(), ...counts.map(([c]) => c).filter((c) => !SIMULATIONS.has(c))]
const cell = (s) => s.replace(/\|/g, '\\|')
const section = (c) => {
  const list = all.filter((t) => t.category === c)
  return `<details>
<summary><b>${EMOJI[c] ?? '•'} ${c}</b> · ${list.length} tools${SIMULATIONS.has(c) ? ' · ★ interactive simulations' : ''}</summary>

| | Tool | What it does |
| :-: | --- | --- |
${list.map((t) => `| \`${cell(t.symbol)}\` | [${cell(t.name)}](${SITE}/${t.slug}) | ${cell(t.description.replace(/\.$/, ''))} |`).join('\n')}

</details>`
}
const catalog = `#### Simulations (${all.filter((t) => SIMULATIONS.has(t.category)).length})

${order.filter((c) => SIMULATIONS.has(c)).map(section).join('\n\n')}

#### Everyday tools (${all.filter((t) => !SIMULATIONS.has(t.category)).length})

${order.filter((c) => !SIMULATIONS.has(c)).map(section).join('\n\n')}`
const readmePath = join(here, '../../README.md')
const readme = readFileSync(readmePath, 'utf8')
if (readme.includes('<!-- tools:start -->')) {
  writeFileSync(readmePath, readme.replace(/<!-- tools:start -->[\s\S]*<!-- tools:end -->/, `<!-- tools:start -->\n${catalog}\n<!-- tools:end -->`))
  console.log(`Rebuilt the README catalog (${all.length} tools).`)
}
