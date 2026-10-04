import { useState, type CSSProperties } from 'react'
import CopyButton from '../../components/CopyButton'
import SettleOutput from '../../motion/SettleOutput'
import { DEFAULT_GRID, gridCss, parseAreas, trackList, type GridState } from './grid'

const SIZES = ['1fr', '2fr', '120px', '200px', 'auto']

export default function CssGridGenerator() {
  const [state, setState] = useState<GridState>(DEFAULT_GRID)

  const set = (patch: Partial<GridState>) => setState((s) => ({ ...s, ...patch }))
  const gap = Math.min(200, Math.max(0, Math.round(state.gap)))
  const areas = parseAreas(state.areas)
  const cols = areas.columns > 0 ? areas.columns : Math.max(1, Math.min(12, Math.round(state.columns)))
  const rows = areas.rows.length > 0 ? areas.rows.length : Math.max(1, Math.min(12, Math.round(state.rows)))
  const code = gridCss(state)

  const preview: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: trackList(cols, state.columnSize, gap),
    gridTemplateRows: trackList(rows, state.rowSize, gap),
    gap,
    gridTemplateAreas: areas.template || undefined,
    height: 300,
    marginTop: 16,
  }

  const cell: CSSProperties = {
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.78rem',
    fontWeight: 600,
    fontFamily: 'var(--mono)',
    color: 'var(--text)',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
  }

  return (
    <div>
      <div className="two-col">
        <div>
          <label htmlFor="gg-cols">Columns — <b>{state.columns}</b></label>
          <input id="gg-cols" type="range" min={1} max={12} value={state.columns} onChange={(e) => set({ columns: Number(e.target.value) })} />

          <label htmlFor="gg-col-size">Column size</label>
          <select id="gg-col-size" value={state.columnSize} onChange={(e) => set({ columnSize: e.target.value })}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="gg-rows">Rows — <b>{state.rows}</b></label>
          <input id="gg-rows" type="range" min={1} max={12} value={state.rows} onChange={(e) => set({ rows: Number(e.target.value) })} />

          <label htmlFor="gg-row-size">Row size</label>
          <select id="gg-row-size" value={state.rowSize} onChange={(e) => set({ rowSize: e.target.value })}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <label htmlFor="gg-gap">Gap — <b>{gap}px</b></label>
      <input id="gg-gap" type="range" min={0} max={60} value={state.gap} onChange={(e) => set({ gap: Number(e.target.value) })} />

      <label htmlFor="gg-areas">Named areas (one grid row per line, use . for a gap)</label>
      <textarea
        id="gg-areas"
        value={state.areas}
        onChange={(e) => set({ areas: e.target.value })}
        rows={4}
        style={{ minHeight: 96 }}
        placeholder={'header header\naside main'}
        spellCheck={false}
      />
      {areas.template ? (
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
          {cols} columns × {rows} rows · areas: {areas.names.join(', ')}
        </p>
      ) : (
        <p className="muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>No areas: the column and row counts above apply.</p>
      )}

      <div style={preview}>
        {areas.names.length > 0
          ? areas.names.map((name) => (
              <div key={name} style={{ ...cell, gridArea: name }}>{name}</div>
            ))
          : Array.from({ length: cols * rows }, (_, i) => (
              <div key={i} style={cell}>{i + 1}</div>
            ))}
      </div>

      <SettleOutput value={code} aria-label="Grid CSS" rows={code.split('\n').length} />
      <div className="row">
        <CopyButton text={code} />
      </div>
      <p className="muted">
        Every line of the area map is one grid row and every name is one column, so keep the rows the same length. A name that repeats
        across cells makes that item span them, which is how a header or sidebar is built. When areas are present they decide the column
        and row count.
      </p>
    </div>
  )
}
