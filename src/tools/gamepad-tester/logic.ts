/** Standard gamepad mapping labels and stick drift / deadzone math. */

export const STANDARD_BUTTONS = [
  'A / Cross', 'B / Circle', 'X / Square', 'Y / Triangle',
  'LB / L1', 'RB / R1', 'LT / L2', 'RT / R2',
  'View / Share', 'Menu / Options', 'L3 (left stick)', 'R3 (right stick)',
  'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right',
  'Home / PS', 'Touchpad',
] as const

export const STANDARD_AXES = ['Left stick X', 'Left stick Y', 'Right stick X', 'Right stick Y'] as const

export function buttonLabel(i: number, mapping: string): string {
  return mapping === 'standard' && i < STANDARD_BUTTONS.length ? STANDARD_BUTTONS[i] : `Button ${i}`
}

export function axisLabel(i: number, mapping: string): string {
  return mapping === 'standard' && i < STANDARD_AXES.length ? STANDARD_AXES[i] : `Axis ${i}`
}

export interface Vec {
  x: number
  y: number
}

export const magnitude = (v: Vec) => Math.hypot(v.x, v.y)

export interface Drift {
  /** Largest distance from center while the stick was left alone (0–1). */
  max: number
  /** Average resting offset. */
  mean: number
  /** Center the stick actually rests at. */
  center: Vec
  /** A deadzone that hides the drift with a small margin, rounded up to 0.01. */
  deadzone: number
  verdict: 'good' | 'slight' | 'drift'
}

/** Summarizes resting samples of one stick. */
export function computeDrift(samples: readonly Vec[]): Drift {
  if (!samples.length) return { max: 0, mean: 0, center: { x: 0, y: 0 }, deadzone: 0.05, verdict: 'good' }
  let max = 0
  let sum = 0
  let cx = 0
  let cy = 0
  for (const s of samples) {
    const m = magnitude(s)
    max = Math.max(max, m)
    sum += m
    cx += s.x
    cy += s.y
  }
  const deadzone = Math.min(0.5, Math.ceil((max + 0.02) * 100) / 100)
  return {
    max,
    mean: sum / samples.length,
    center: { x: cx / samples.length, y: cy / samples.length },
    deadzone,
    verdict: max < 0.06 ? 'good' : max < 0.15 ? 'slight' : 'drift',
  }
}

/** Radial scaled deadzone: inside `dz` reads 0, outside is rescaled so full tilt is still 1. */
export function applyDeadzone(v: Vec, dz: number): Vec {
  const m = magnitude(v)
  if (m <= dz || dz >= 1) return { x: 0, y: 0 }
  const scaled = Math.min(1, (m - dz) / (1 - dz))
  return { x: (v.x / m) * scaled, y: (v.y / m) * scaled }
}
