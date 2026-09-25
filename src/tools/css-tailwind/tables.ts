/** Data tables shared by both conversion directions (Tailwind v3 defaults, with v4 differences noted). */

export type TwVersion = 3 | 4

export const SPACING_KEYS = ['0', 'px', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8', '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '44', '48', '52', '56', '60', '64', '72', '80', '96']

export const FRACTIONS: [string, string][] = [
  ['1/2', '50%'], ['1/3', '33.333333%'], ['2/3', '66.666667%'], ['1/4', '25%'], ['3/4', '75%'],
  ['1/5', '20%'], ['2/5', '40%'], ['3/5', '60%'], ['4/5', '80%'],
  ['1/6', '16.666667%'], ['5/6', '83.333333%'], ['1/12', '8.333333%'], ['5/12', '41.666667%'], ['7/12', '58.333333%'], ['11/12', '91.666667%'],
  ['full', '100%'],
]

export const FONT_SIZE: [string, string, string][] = [
  ['xs', '0.75rem', '1rem'], ['sm', '0.875rem', '1.25rem'], ['base', '1rem', '1.5rem'], ['lg', '1.125rem', '1.75rem'],
  ['xl', '1.25rem', '1.75rem'], ['2xl', '1.5rem', '2rem'], ['3xl', '1.875rem', '2.25rem'], ['4xl', '2.25rem', '2.5rem'],
  ['5xl', '3rem', '1'], ['6xl', '3.75rem', '1'], ['7xl', '4.5rem', '1'], ['8xl', '6rem', '1'], ['9xl', '8rem', '1'],
]

export const FONT_WEIGHT: [string, string][] = [
  ['thin', '100'], ['extralight', '200'], ['light', '300'], ['normal', '400'], ['medium', '500'],
  ['semibold', '600'], ['bold', '700'], ['extrabold', '800'], ['black', '900'],
]

export const LEADING: [string, string][] = [
  ['none', '1'], ['tight', '1.25'], ['snug', '1.375'], ['normal', '1.5'], ['relaxed', '1.625'], ['loose', '2'],
  ['3', '0.75rem'], ['4', '1rem'], ['5', '1.25rem'], ['6', '1.5rem'], ['7', '1.75rem'], ['8', '2rem'], ['9', '2.25rem'], ['10', '2.5rem'],
]

export const TRACKING: [string, string][] = [
  ['tighter', '-0.05em'], ['tight', '-0.025em'], ['normal', '0em'], ['wide', '0.025em'], ['wider', '0.05em'], ['widest', '0.1em'],
]

export const RADIUS: Record<TwVersion, [string, string][]> = {
  3: [['none', '0px'], ['sm', '0.125rem'], ['DEFAULT', '0.25rem'], ['md', '0.375rem'], ['lg', '0.5rem'], ['xl', '0.75rem'], ['2xl', '1rem'], ['3xl', '1.5rem'], ['full', '9999px']],
  4: [['none', '0px'], ['xs', '0.125rem'], ['sm', '0.25rem'], ['DEFAULT', '0.25rem'], ['md', '0.375rem'], ['lg', '0.5rem'], ['xl', '0.75rem'], ['2xl', '1rem'], ['3xl', '1.5rem'], ['4xl', '2rem'], ['full', '9999px']],
}

const S = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  x2: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
}
export const SHADOW: Record<TwVersion, [string, string][]> = {
  3: [['sm', S.xs], ['DEFAULT', S.sm], ['md', S.md], ['lg', S.lg], ['xl', S.xl], ['2xl', S.x2], ['inner', 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)'], ['none', '0 0 #0000']],
  4: [['2xs', '0 1px rgb(0 0 0 / 0.05)'], ['xs', S.xs], ['sm', S.sm], ['md', S.md], ['lg', S.lg], ['xl', S.xl], ['2xl', S.x2], ['none', '0 0 #0000']],
}

export const MAX_WIDTH: [string, string][] = [
  ['none', 'none'], ['xs', '20rem'], ['sm', '24rem'], ['md', '28rem'], ['lg', '32rem'], ['xl', '36rem'], ['2xl', '42rem'],
  ['3xl', '48rem'], ['4xl', '56rem'], ['5xl', '64rem'], ['6xl', '72rem'], ['7xl', '80rem'], ['full', '100%'],
  ['min', 'min-content'], ['max', 'max-content'], ['fit', 'fit-content'], ['prose', '65ch'],
  ['screen-sm', '640px'], ['screen-md', '768px'], ['screen-lg', '1024px'], ['screen-xl', '1280px'], ['screen-2xl', '1536px'],
]

export const BREAKPOINTS: [string, number][] = [['sm', 640], ['md', 768], ['lg', 1024], ['xl', 1280], ['2xl', 1536]]

const PALETTE_SRC: Record<string, string> = {
  slate: 'f8fafc f1f5f9 e2e8f0 cbd5e1 94a3b8 64748b 475569 334155 1e293b 0f172a 020617',
  gray: 'f9fafb f3f4f6 e5e7eb d1d5db 9ca3af 6b7280 4b5563 374151 1f2937 111827 030712',
  zinc: 'fafafa f4f4f5 e4e4e7 d4d4d8 a1a1aa 71717a 52525b 3f3f46 27272a 18181b 09090b',
  neutral: 'fafafa f5f5f5 e5e5e5 d4d4d4 a3a3a3 737373 525252 404040 262626 171717 0a0a0a',
  stone: 'fafaf9 f5f5f4 e7e5e4 d6d3d1 a8a29e 78716c 57534e 44403c 292524 1c1917 0c0a09',
  red: 'fef2f2 fee2e2 fecaca fca5a5 f87171 ef4444 dc2626 b91c1c 991b1b 7f1d1d 450a0a',
  orange: 'fff7ed ffedd5 fed7aa fdba74 fb923c f97316 ea580c c2410c 9a3412 7c2d12 431407',
  amber: 'fffbeb fef3c7 fde68a fcd34d fbbf24 f59e0b d97706 b45309 92400e 78350f 451a03',
  yellow: 'fefce8 fef9c3 fef08a fde047 facc15 eab308 ca8a04 a16207 854d0e 713f12 422006',
  lime: 'f7fee7 ecfccb d9f99d bef264 a3e635 84cc16 65a30d 4d7c0f 3f6212 365314 1a2e05',
  green: 'f0fdf4 dcfce7 bbf7d0 86efac 4ade80 22c55e 16a34a 15803d 166534 14532d 052e16',
  emerald: 'ecfdf5 d1fae5 a7f3d0 6ee7b7 34d399 10b981 059669 047857 065f46 064e3b 022c22',
  teal: 'f0fdfa ccfbf1 99f6e4 5eead4 2dd4bf 14b8a6 0d9488 0f766e 115e59 134e4a 042f2e',
  cyan: 'ecfeff cffafe a5f3fc 67e8f9 22d3ee 06b6d4 0891b2 0e7490 155e75 164e63 083344',
  sky: 'f0f9ff e0f2fe bae6fd 7dd3fc 38bdf8 0ea5e9 0284c7 0369a1 075985 0c4a6e 082f49',
  blue: 'eff6ff dbeafe bfdbfe 93c5fd 60a5fa 3b82f6 2563eb 1d4ed8 1e40af 1e3a8a 172554',
  indigo: 'eef2ff e0e7ff c7d2fe a5b4fc 818cf8 6366f1 4f46e5 4338ca 3730a3 312e81 1e1b4b',
  violet: 'f5f3ff ede9fe ddd6fe c4b5fd a78bfa 8b5cf6 7c3aed 6d28d9 5b21b6 4c1d95 2e1065',
  purple: 'faf5ff f3e8ff e9d5ff d8b4fe c084fc a855f7 9333ea 7e22ce 6b21a8 581c87 3b0764',
  fuchsia: 'fdf4ff fae8ff f5d0fe f0abfc e879f9 d946ef c026d3 a21caf 86198f 701a75 4a044e',
  pink: 'fdf2f8 fce7f3 fbcfe8 f9a8d4 f472b6 ec4899 db2777 be185d 9d174d 831843 500724',
  rose: 'fff1f2 ffe4e6 fecdd3 fda4af fb7185 f43f5e e11d48 be123c 9f1239 881337 4c0519',
}
const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']

/** "red-500" → "#ef4444" (Tailwind v3 palette). */
export const PALETTE = new Map<string, string>()
for (const [name, hexes] of Object.entries(PALETTE_SRC)) {
  hexes.split(' ').forEach((h, i) => PALETTE.set(`${name}-${SHADES[i]}`, `#${h}`))
}
export const SPECIAL_COLORS: [string, string][] = [
  ['transparent', 'transparent'], ['current', 'currentColor'], ['inherit', 'inherit'], ['black', '#000'], ['white', '#fff'],
]

/**
 * Keyword utilities: [class, css]. Used in both directions. The css may hold
 * several declarations separated by ";" (those are only used for Tailwind → CSS).
 */
export const STATIC: [string, string][] = [
  // display
  ['block', 'display: block'], ['inline-block', 'display: inline-block'], ['inline', 'display: inline'], ['flex', 'display: flex'],
  ['inline-flex', 'display: inline-flex'], ['grid', 'display: grid'], ['inline-grid', 'display: inline-grid'], ['table', 'display: table'],
  ['table-row', 'display: table-row'], ['table-cell', 'display: table-cell'], ['contents', 'display: contents'], ['list-item', 'display: list-item'],
  ['flow-root', 'display: flow-root'], ['hidden', 'display: none'],
  // position & visibility
  ['static', 'position: static'], ['fixed', 'position: fixed'], ['absolute', 'position: absolute'], ['relative', 'position: relative'], ['sticky', 'position: sticky'],
  ['visible', 'visibility: visible'], ['invisible', 'visibility: hidden'], ['collapse', 'visibility: collapse'],
  ['isolate', 'isolation: isolate'], ['isolation-auto', 'isolation: auto'],
  ['float-left', 'float: left'], ['float-right', 'float: right'], ['float-none', 'float: none'],
  ['clear-left', 'clear: left'], ['clear-right', 'clear: right'], ['clear-both', 'clear: both'], ['clear-none', 'clear: none'],
  ['box-border', 'box-sizing: border-box'], ['box-content', 'box-sizing: content-box'],
  // flexbox
  ['flex-row', 'flex-direction: row'], ['flex-row-reverse', 'flex-direction: row-reverse'], ['flex-col', 'flex-direction: column'], ['flex-col-reverse', 'flex-direction: column-reverse'],
  ['flex-wrap', 'flex-wrap: wrap'], ['flex-wrap-reverse', 'flex-wrap: wrap-reverse'], ['flex-nowrap', 'flex-wrap: nowrap'],
  ['flex-1', 'flex: 1 1 0%'], ['flex-auto', 'flex: 1 1 auto'], ['flex-initial', 'flex: 0 1 auto'], ['flex-none', 'flex: none'],
  ['grow', 'flex-grow: 1'], ['grow-0', 'flex-grow: 0'], ['shrink', 'flex-shrink: 1'], ['shrink-0', 'flex-shrink: 0'],
  ['justify-normal', 'justify-content: normal'], ['justify-start', 'justify-content: flex-start'], ['justify-end', 'justify-content: flex-end'], ['justify-center', 'justify-content: center'],
  ['justify-between', 'justify-content: space-between'], ['justify-around', 'justify-content: space-around'], ['justify-evenly', 'justify-content: space-evenly'], ['justify-stretch', 'justify-content: stretch'],
  ['justify-items-start', 'justify-items: start'], ['justify-items-end', 'justify-items: end'], ['justify-items-center', 'justify-items: center'], ['justify-items-stretch', 'justify-items: stretch'],
  ['justify-self-auto', 'justify-self: auto'], ['justify-self-start', 'justify-self: start'], ['justify-self-end', 'justify-self: end'], ['justify-self-center', 'justify-self: center'], ['justify-self-stretch', 'justify-self: stretch'],
  ['items-start', 'align-items: flex-start'], ['items-end', 'align-items: flex-end'], ['items-center', 'align-items: center'], ['items-baseline', 'align-items: baseline'], ['items-stretch', 'align-items: stretch'],
  ['content-normal', 'align-content: normal'], ['content-center', 'align-content: center'], ['content-start', 'align-content: flex-start'], ['content-end', 'align-content: flex-end'],
  ['content-between', 'align-content: space-between'], ['content-around', 'align-content: space-around'], ['content-evenly', 'align-content: space-evenly'], ['content-baseline', 'align-content: baseline'], ['content-stretch', 'align-content: stretch'],
  ['self-auto', 'align-self: auto'], ['self-start', 'align-self: flex-start'], ['self-end', 'align-self: flex-end'], ['self-center', 'align-self: center'], ['self-stretch', 'align-self: stretch'], ['self-baseline', 'align-self: baseline'],
  ['place-content-center', 'place-content: center'], ['place-content-start', 'place-content: start'], ['place-content-end', 'place-content: end'], ['place-content-between', 'place-content: space-between'], ['place-content-stretch', 'place-content: stretch'],
  ['place-items-center', 'place-items: center'], ['place-items-start', 'place-items: start'], ['place-items-end', 'place-items: end'], ['place-items-stretch', 'place-items: stretch'],
  ['place-self-auto', 'place-self: auto'], ['place-self-center', 'place-self: center'], ['place-self-start', 'place-self: start'], ['place-self-end', 'place-self: end'], ['place-self-stretch', 'place-self: stretch'],
  // grid
  ['grid-flow-row', 'grid-auto-flow: row'], ['grid-flow-col', 'grid-auto-flow: column'], ['grid-flow-dense', 'grid-auto-flow: dense'], ['grid-flow-row-dense', 'grid-auto-flow: row dense'], ['grid-flow-col-dense', 'grid-auto-flow: column dense'],
  ['grid-cols-none', 'grid-template-columns: none'], ['grid-cols-subgrid', 'grid-template-columns: subgrid'], ['grid-rows-none', 'grid-template-rows: none'], ['grid-rows-subgrid', 'grid-template-rows: subgrid'],
  ['col-auto', 'grid-column: auto'], ['col-span-full', 'grid-column: 1 / -1'], ['row-auto', 'grid-row: auto'], ['row-span-full', 'grid-row: 1 / -1'],
  ['auto-cols-auto', 'grid-auto-columns: auto'], ['auto-cols-min', 'grid-auto-columns: min-content'], ['auto-cols-max', 'grid-auto-columns: max-content'], ['auto-cols-fr', 'grid-auto-columns: minmax(0, 1fr)'],
  ['auto-rows-auto', 'grid-auto-rows: auto'], ['auto-rows-min', 'grid-auto-rows: min-content'], ['auto-rows-max', 'grid-auto-rows: max-content'], ['auto-rows-fr', 'grid-auto-rows: minmax(0, 1fr)'],
  // typography
  ['text-left', 'text-align: left'], ['text-center', 'text-align: center'], ['text-right', 'text-align: right'], ['text-justify', 'text-align: justify'], ['text-start', 'text-align: start'], ['text-end', 'text-align: end'],
  ['uppercase', 'text-transform: uppercase'], ['lowercase', 'text-transform: lowercase'], ['capitalize', 'text-transform: capitalize'], ['normal-case', 'text-transform: none'],
  ['italic', 'font-style: italic'], ['not-italic', 'font-style: normal'],
  ['underline', 'text-decoration-line: underline'], ['overline', 'text-decoration-line: overline'], ['line-through', 'text-decoration-line: line-through'], ['no-underline', 'text-decoration-line: none'],
  ['whitespace-normal', 'white-space: normal'], ['whitespace-nowrap', 'white-space: nowrap'], ['whitespace-pre', 'white-space: pre'], ['whitespace-pre-line', 'white-space: pre-line'], ['whitespace-pre-wrap', 'white-space: pre-wrap'], ['whitespace-break-spaces', 'white-space: break-spaces'],
  ['break-all', 'word-break: break-all'], ['break-keep', 'word-break: keep-all'], ['break-words', 'overflow-wrap: break-word'], ['break-normal', 'overflow-wrap: normal; word-break: normal'],
  ['text-ellipsis', 'text-overflow: ellipsis'], ['text-clip', 'text-overflow: clip'],
  ['truncate', 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap'],
  ['text-wrap', 'text-wrap: wrap'], ['text-nowrap', 'text-wrap: nowrap'], ['text-balance', 'text-wrap: balance'], ['text-pretty', 'text-wrap: pretty'],
  ['align-baseline', 'vertical-align: baseline'], ['align-top', 'vertical-align: top'], ['align-middle', 'vertical-align: middle'], ['align-bottom', 'vertical-align: bottom'],
  ['align-text-top', 'vertical-align: text-top'], ['align-text-bottom', 'vertical-align: text-bottom'], ['align-sub', 'vertical-align: sub'], ['align-super', 'vertical-align: super'],
  ['list-none', 'list-style-type: none'], ['list-disc', 'list-style-type: disc'], ['list-decimal', 'list-style-type: decimal'], ['list-inside', 'list-style-position: inside'], ['list-outside', 'list-style-position: outside'],
  ['tabular-nums', 'font-variant-numeric: tabular-nums'], ['ordinal', 'font-variant-numeric: ordinal'], ['normal-nums', 'font-variant-numeric: normal'],
  ['antialiased', '-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale'],
  ['font-sans', 'font-family: ui-sans-serif, system-ui, sans-serif'], ['font-serif', 'font-family: ui-serif, Georgia, serif'], ['font-mono', 'font-family: ui-monospace, SFMono-Regular, monospace'],
  // overflow
  ['overflow-auto', 'overflow: auto'], ['overflow-hidden', 'overflow: hidden'], ['overflow-clip', 'overflow: clip'], ['overflow-visible', 'overflow: visible'], ['overflow-scroll', 'overflow: scroll'],
  ['overflow-x-auto', 'overflow-x: auto'], ['overflow-x-hidden', 'overflow-x: hidden'], ['overflow-x-clip', 'overflow-x: clip'], ['overflow-x-visible', 'overflow-x: visible'], ['overflow-x-scroll', 'overflow-x: scroll'],
  ['overflow-y-auto', 'overflow-y: auto'], ['overflow-y-hidden', 'overflow-y: hidden'], ['overflow-y-clip', 'overflow-y: clip'], ['overflow-y-visible', 'overflow-y: visible'], ['overflow-y-scroll', 'overflow-y: scroll'],
  // backgrounds
  ['bg-auto', 'background-size: auto'], ['bg-cover', 'background-size: cover'], ['bg-contain', 'background-size: contain'],
  ['bg-repeat', 'background-repeat: repeat'], ['bg-no-repeat', 'background-repeat: no-repeat'], ['bg-repeat-x', 'background-repeat: repeat-x'], ['bg-repeat-y', 'background-repeat: repeat-y'], ['bg-repeat-round', 'background-repeat: round'], ['bg-repeat-space', 'background-repeat: space'],
  ['bg-center', 'background-position: center'], ['bg-top', 'background-position: top'], ['bg-bottom', 'background-position: bottom'], ['bg-left', 'background-position: left'], ['bg-right', 'background-position: right'],
  ['bg-fixed', 'background-attachment: fixed'], ['bg-local', 'background-attachment: local'], ['bg-scroll', 'background-attachment: scroll'],
  ['bg-clip-border', 'background-clip: border-box'], ['bg-clip-padding', 'background-clip: padding-box'], ['bg-clip-content', 'background-clip: content-box'], ['bg-clip-text', 'background-clip: text'],
  ['bg-none', 'background-image: none'],
  // borders & outline
  ['border-solid', 'border-style: solid'], ['border-dashed', 'border-style: dashed'], ['border-dotted', 'border-style: dotted'], ['border-double', 'border-style: double'], ['border-hidden', 'border-style: hidden'], ['border-none', 'border-style: none'],
  ['border-collapse', 'border-collapse: collapse'], ['border-separate', 'border-collapse: separate'],
  ['outline-none', 'outline: 2px solid transparent; outline-offset: 2px'], ['outline', 'outline-style: solid'], ['outline-dashed', 'outline-style: dashed'], ['outline-dotted', 'outline-style: dotted'], ['outline-double', 'outline-style: double'],
  // tables, interactivity
  ['table-auto', 'table-layout: auto'], ['table-fixed', 'table-layout: fixed'],
  ['pointer-events-none', 'pointer-events: none'], ['pointer-events-auto', 'pointer-events: auto'],
  ['select-none', 'user-select: none'], ['select-text', 'user-select: text'], ['select-all', 'user-select: all'], ['select-auto', 'user-select: auto'],
  ['resize-none', 'resize: none'], ['resize', 'resize: both'], ['resize-x', 'resize: horizontal'], ['resize-y', 'resize: vertical'],
  ['appearance-none', 'appearance: none'], ['appearance-auto', 'appearance: auto'],
  ['scroll-smooth', 'scroll-behavior: smooth'], ['scroll-auto', 'scroll-behavior: auto'],
  ['object-contain', 'object-fit: contain'], ['object-cover', 'object-fit: cover'], ['object-fill', 'object-fit: fill'], ['object-none', 'object-fit: none'], ['object-scale-down', 'object-fit: scale-down'],
  ['object-center', 'object-position: center'], ['object-top', 'object-position: top'], ['object-bottom', 'object-position: bottom'], ['object-left', 'object-position: left'], ['object-right', 'object-position: right'],
  ['aspect-auto', 'aspect-ratio: auto'], ['aspect-square', 'aspect-ratio: 1 / 1'], ['aspect-video', 'aspect-ratio: 16 / 9'],
  ['transition-none', 'transition-property: none'],
  ['sr-only', 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0'],
  // blend
  ['mix-blend-normal', 'mix-blend-mode: normal'], ['mix-blend-multiply', 'mix-blend-mode: multiply'], ['mix-blend-screen', 'mix-blend-mode: screen'], ['mix-blend-overlay', 'mix-blend-mode: overlay'],
]

export const CURSORS = ['auto', 'default', 'pointer', 'wait', 'text', 'move', 'help', 'not-allowed', 'none', 'context-menu', 'progress', 'cell', 'crosshair', 'vertical-text', 'alias', 'copy', 'no-drop', 'grab', 'grabbing', 'all-scroll', 'col-resize', 'row-resize', 'ew-resize', 'ns-resize', 'zoom-in', 'zoom-out']

/** CSS value aliases that should map to the same class as another value. */
export const VALUE_ALIASES: Record<string, string> = {
  'flex:1': 'flex: 1 1 0%',
  'flex:1 1 0': 'flex: 1 1 0%',
  'flex:1 1 0px': 'flex: 1 1 0%',
  'flex:auto': 'flex: 1 1 auto',
  'flex:initial': 'flex: 0 1 auto',
  'flex:0 0 auto': 'flex: none',
  'justify-content:start': 'justify-content: flex-start',
  'justify-content:end': 'justify-content: flex-end',
  'align-items:start': 'align-items: flex-start',
  'align-items:end': 'align-items: flex-end',
  'align-self:start': 'align-self: flex-start',
  'align-self:end': 'align-self: flex-end',
  'align-content:start': 'align-content: flex-start',
  'align-content:end': 'align-content: flex-end',
  'text-decoration:underline': 'text-decoration-line: underline',
  'text-decoration:none': 'text-decoration-line: none',
  'text-decoration:line-through': 'text-decoration-line: line-through',
  'text-decoration:overline': 'text-decoration-line: overline',
  'list-style:none': 'list-style-type: none',
  'outline:none': 'outline: 2px solid transparent; outline-offset: 2px',
  'outline:0': 'outline: 2px solid transparent; outline-offset: 2px',
  'background:none': 'background-image: none',
  'aspect-ratio:1': 'aspect-ratio: 1 / 1',
  'aspect-ratio:16/9': 'aspect-ratio: 16 / 9',
  'aspect-ratio:1/1': 'aspect-ratio: 1 / 1',
  'grid-column:1/-1': 'grid-column: 1 / -1',
  'grid-row:1/-1': 'grid-row: 1 / -1',
  'transition:none': 'transition-property: none',
  'word-wrap:break-word': 'overflow-wrap: break-word',
  'background-position:50% 50%': 'background-position: center',
  'background-position:center center': 'background-position: center',
  'box-shadow:none': 'box-shadow: 0 0 #0000',
  'border:none': 'border-style: none',
  'border:0': 'border-width: 0px',
  'grid-auto-flow:column': 'grid-auto-flow: column',
}
