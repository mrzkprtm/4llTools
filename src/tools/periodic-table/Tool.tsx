import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { Choice, Hint, Legend } from '../../sim/controls'
import { ELEMENTS, type Element } from './elements'
import { CATEGORY_COLORS, CATEGORY_NAMES, STATE_COLORS, STOPS, heatColor, numericValue, position, range, search, type HeatMode } from './logic'
import './tool.css'

const MODES: [HeatMode, string][] = [['category', 'Category'], ['en', 'Electronegativity'], ['radius', 'Radius'], ['melt', 'Melting point'], ['state', 'State']]
const UNIT: Partial<Record<HeatMode, string>> = { en: '', radius: ' pm', melt: ' K' }

function fmtVal(v: number | null, unit = '') {
  return v === null ? '—' : `${Number(v.toFixed(2))}${unit}`
}

/** Readable text on a colored cell. */
function textOn(color: string | null) {
  if (!color) return undefined
  const m = color.match(/\d+/g)
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16)
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150 ? '#1b1a17' : '#fff'
  }
  return m && +m[0] * 0.299 + +m[1] * 0.587 + +m[2] * 0.114 > 150 ? '#1b1a17' : '#fff'
}

function Card({ el, where }: { el: Element; where: 'in' | 'out' }) {
  const c = CATEGORY_COLORS[el.category]
  return (
    <div className={`pt-card pt-card-${where}`} key={el.z} style={{ ['--c' as string]: c }} aria-live={where === 'in' ? 'polite' : undefined}>
      <div className="pt-card-sym">
        <small>{el.z}</small>
        <b>{el.symbol}</b>
        <span>{el.mass}</span>
      </div>
      <div className="pt-card-info">
        <h3>{el.name}</h3>
        <p className="pt-cat"><i style={{ background: c }} />{CATEGORY_NAMES[el.category]}</p>
        <dl>
          <dt>Group · period</dt><dd>{el.group ?? 'f-block'} · {el.period}</dd>
          <dt>Electronegativity</dt><dd>{fmtVal(el.en)}</dd>
          <dt>Atomic radius</dt><dd>{fmtVal(el.radius, ' pm')}</dd>
          <dt>Melting point</dt><dd>{el.melt === null ? '—' : `${fmtVal(el.melt, ' K')} (${Math.round(el.melt - 273.15)} °C)`}</dd>
          <dt>At room temp</dt><dd>{el.state}</dd>
        </dl>
      </div>
    </div>
  )
}

export default function PeriodicTable() {
  const [mode, setMode] = useState<HeatMode>('category')
  const [picked, setPicked] = useState(26)
  const [hover, setHover] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const rng = useMemo(() => range(ELEMENTS, mode), [mode])
  const matches = useMemo(() => new Set(search(ELEMENTS, query).map((e) => e.z)), [query])
  const shown = ELEMENTS[(hover ?? picked) - 1]
  const numeric = mode === 'en' || mode === 'radius' || mode === 'melt'

  const legend =
    mode === 'category' ? (
      <Legend items={Object.entries(CATEGORY_NAMES).map(([k, name]) => [CATEGORY_COLORS[k as keyof typeof CATEGORY_COLORS], name] as const)} />
    ) : mode === 'state' ? (
      <Legend items={[[STATE_COLORS.solid, 'Solid'], [STATE_COLORS.liquid, 'Liquid'], [STATE_COLORS.gas, 'Gas'], [STATE_COLORS.unknown, 'Unknown']]} />
    ) : (
      <div className="pt-scale" key={mode}>
        <span>{fmtVal(rng[0], UNIT[mode])}</span>
        <i style={{ background: `linear-gradient(90deg, ${STOPS.join(', ')})` }} />
        <span>{fmtVal(rng[1], UNIT[mode])}</span>
        <span className="muted">gray = unknown</span>
      </div>
    )

  return (
    <div className="pt">
      <div className="row pt-tools">
        <label className="pt-search">
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              const first = search(ELEMENTS, query)[0]
              if (e.key === 'Enter' && first) setPicked(first.z)
            }}
            placeholder="Search name, symbol or number"
            aria-label="Search elements"
          />
        </label>
        <Choice value={mode} onChange={setMode} options={MODES} />
      </div>
      {legend}
      <Card el={shown} where="out" />
      <div className="pt-scroll">
        <div className={`pt-grid ${query ? 'searching' : ''}`} onPointerLeave={() => setHover(null)}>
          <Card el={shown} where="in" />
          <span className="pt-ph" style={{ gridColumn: 3, gridRow: 6 }}>57–71</span>
          <span className="pt-ph" style={{ gridColumn: 3, gridRow: 7 }}>89–103</span>
          {ELEMENTS.map((el) => {
            const { col, row } = position(el)
            const color = heatColor(el, mode, rng)
            const v = numericValue(el, mode)
            return (
              <button
                key={el.z}
                type="button"
                className={`pt-el ${el.z === picked ? 'on' : ''} ${query && !matches.has(el.z) ? 'dim' : ''} ${query && matches.has(el.z) ? 'hit' : ''} ${color ? '' : 'none'}`}
                style={{ gridColumn: col, gridRow: row, background: color ?? undefined, color: textOn(color), transitionDelay: `${(col + row) * 14}ms` }}
                onClick={() => setPicked(el.z)}
                onFocus={() => setPicked(el.z)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(el.z)}
                aria-label={`${el.name}, ${el.z}`}
                aria-pressed={el.z === picked}
              >
                <small>{el.z}</small>
                <b>{el.symbol}</b>
                <small className="pt-v">{numeric ? (v === null ? '—' : Number(v.toFixed(mode === 'en' ? 2 : 0))) : el.name}</small>
              </button>
            )
          })}
        </div>
      </div>
      <Hint>Hover or tap an element to see its card, and switch the heatmap to watch trends sweep across the table: electronegativity rises toward fluorine, atoms grow down each group. Press Enter in search to jump to the first match.</Hint>
    </div>
  )
}
