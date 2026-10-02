import { useId, useState, type ReactNode } from 'react'
import Icon from '../components/Icon'
import PillRow from '../motion/PillRow'
import { reducedMotion } from '../motion/springs'
import './sim.css'

/** Play/pause state that starts paused when the visitor prefers reduced motion. */
export function useRunning(initial = true) {
  return useState(() => initial && !reducedMotion())
}

/** The stage on the left (or on top on phones) and the controls beside it. */
export function SimLayout({ stage, children, below, wide = false }: { stage: ReactNode; children: ReactNode; below?: ReactNode; wide?: boolean }) {
  return (
    <div>
      <div className={`sim ${wide ? 'sim-wide' : ''}`}>
        <div className="sim-main">{stage}</div>
        <div className="sim-side">{children}</div>
      </div>
      {below}
    </div>
  )
}

interface PlayProps {
  running: boolean
  setRunning: (v: boolean) => void
  onReset?: () => void
  onStep?: () => void
  resetLabel?: string
  children?: ReactNode
}

/** Play / pause, reset and single-step buttons, plus a reduced-motion note. */
export function PlayBar({ running, setRunning, onReset, onStep, resetLabel = 'Reset', children }: PlayProps) {
  return (
    <div>
      <div className="row sim-bar">
        <button type="button" className="btn primary btn-icon" onClick={() => setRunning(!running)} aria-pressed={running}>
          <Icon key={running ? 'pause' : 'play'} name={running ? 'pause-circle' : 'play-circle'} size={18} />
          {running ? 'Pause' : 'Play'}
        </button>
        {onStep && (
          <button type="button" className="btn btn-icon" onClick={onStep} disabled={running}>
            <Icon name="forward-end-circle" size={18} />
            Step
          </button>
        )}
        {onReset && (
          <button type="button" className="btn btn-icon" onClick={onReset}>
            <Icon name="reload" size={18} />
            {resetLabel}
          </button>
        )}
        {children}
      </div>
      {!running && reducedMotion() && <p className="muted sim-hint">Reduced motion is on, so this starts paused. Press Play to run it.</p>}
    </div>
  )
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  format?: (v: number) => string
  disabled?: boolean
}

export function Slider({ label, value, min, max, step = 1, unit = '', onChange, format, disabled }: SliderProps) {
  const id = useId()
  return (
    <div className="sim-field">
      <label htmlFor={id} className="sim-label">
        <span>{label}</span>
        <output htmlFor={id} className="sim-val">
          {format ? format(value) : value}
          {unit}
        </output>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sim-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

/** A row of toggle buttons for picking one of a few modes. */
export function Choice<T extends string | number>({ label, value, options, onChange }: { label?: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="sim-field">
      {label && <span className="sim-label">{label}</span>}
      <PillRow className="sim-choice" label={label}>
        {options.map(([v, name]) => (
          <button key={String(v)} type="button" className={`btn ${v === value ? 'primary' : ''}`} aria-pressed={v === value} onClick={() => onChange(v)}>
            {name}
          </button>
        ))}
      </PillRow>
    </div>
  )
}

export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  const id = useId()
  return (
    <div className="sim-field">
      <label htmlFor={id} className="sim-label">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, name]) => (
          <option key={v} value={v}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Live numbers under or beside the stage. */
export function Readout({ items }: { items: readonly (readonly [string, ReactNode])[] }) {
  return (
    <div className="stats sim-stats" aria-live="off">
      {items.map(([k, v]) => (
        <div key={k} className="stat">
          <b>{v}</b>
          {k}
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <div className="sim-legend">
      {items.map(([color, name]) => (
        <span key={name}>
          <i style={{ background: color }} />
          {name}
        </span>
      ))}
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="muted sim-hint">{children}</p>
}
