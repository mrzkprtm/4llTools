/** CSS Grid state: track helpers and a full rule serialiser. */

export interface GridState {
  columns: number
  rows: number
  columnSize: string
  rowSize: string
  gap: number
  /** A plain area map, one grid row per line, names separated by spaces. */
  areas: string
}

export const DEFAULT_GRID: GridState = {
  columns: 3,
  rows: 3,
  columnSize: '1fr',
  rowSize: '1fr',
  gap: 12,
  areas: 'header header header\naside main main\nfooter footer footer',
}

const clampTracks = (n: number) => (Number.isFinite(n) ? Math.min(24, Math.max(1, Math.round(n))) : 1)
const clampGap = (n: number) => (Number.isFinite(n) ? Math.min(200, Math.max(0, Math.round(n))) : 0)

/** A `grid-template-columns`/`rows` value. Flexible tracks gain a `minmax()` floor equal to the gap. */
export function trackList(count: number, size: string, gap: number): string {
  const n = clampTracks(count)
  const s = size.trim() || '1fr'
  const track = gap > 0 && s.endsWith('fr') ? `minmax(${clampGap(gap)}px, ${s})` : s
  return `repeat(${n}, ${track})`
}

export interface AreaMap {
  rows: string[][]
  columns: number
  names: string[]
  /** The value for `grid-template-areas`, or '' when there are no areas. */
  template: string
}

/** Turn a plain area map into `grid-template-areas`, padding short rows with `.` holes. */
export function parseAreas(text: string): AreaMap {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/))
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const padded = rows.map((row) => {
    const cells = row.slice(0, columns)
    while (cells.length < columns) cells.push('.')
    return cells
  })
  const names: string[] = []
  for (const row of padded) for (const cell of row) if (cell !== '.' && !names.includes(cell)) names.push(cell)
  const template = padded.map((row) => `"${row.join(' ')}"`).join(' ')
  return { rows: padded, columns, names, template }
}

/** The ready-to-paste CSS for a container and its named areas. */
export function gridCss(state: GridState): string {
  const gap = clampGap(state.gap)
  const areas = parseAreas(state.areas)
  const columns = areas.columns > 0 ? areas.columns : clampTracks(state.columns)
  const rows = areas.rows.length > 0 ? areas.rows.length : clampTracks(state.rows)
  const lines = [
    'display: grid;',
    `grid-template-columns: ${trackList(columns, state.columnSize, gap)};`,
    `grid-template-rows: ${trackList(rows, state.rowSize, gap)};`,
    `gap: ${gap}px;`,
  ]
  if (areas.template) lines.push(`grid-template-areas: ${areas.template};`)
  const body = lines.map((line) => `  ${line}`).join('\n')
  const child = areas.names.map((name) => `.${name} { grid-area: ${name}; }`).join('\n')
  return child ? `.grid {\n${body}\n}\n${child}` : `.grid {\n${body}\n}`
}
