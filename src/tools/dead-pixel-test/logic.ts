/** Test patterns for the dead pixel & screen tester. Pure, so the stepping is testable. */

export type Mode = 'solid' | 'gradient' | 'black' | 'checker' | 'fixer'

export interface Pattern {
  name: string
  /** CSS background for flat patterns; empty for canvas-drawn ones. */
  css: string
  /** Canvas pattern id for per-pixel patterns. */
  pixel?: 'checker' | 'checker-inv' | 'v-lines' | 'h-lines'
}

export const SOLIDS: Pattern[] = [
  { name: 'Black', css: '#000000' },
  { name: 'White', css: '#ffffff' },
  { name: 'Red', css: '#ff0000' },
  { name: 'Green', css: '#00ff00' },
  { name: 'Blue', css: '#0000ff' },
  { name: 'Cyan', css: '#00ffff' },
  { name: 'Magenta', css: '#ff00ff' },
  { name: 'Yellow', css: '#ffff00' },
  { name: 'Grey 50%', css: '#808080' },
]

const steps = Array.from({ length: 16 }, (_, i) => {
  const v = Math.round((i / 15) * 255)
  return `rgb(${v},${v},${v}) ${(i / 16) * 100}% ${((i + 1) / 16) * 100}%`
}).join(', ')

export const GRADIENTS: Pattern[] = [
  { name: 'Grey ramp', css: 'linear-gradient(to right, #000, #fff)' },
  { name: 'Red ramp', css: 'linear-gradient(to right, #000, #f00)' },
  { name: 'Green ramp', css: 'linear-gradient(to right, #000, #0f0)' },
  { name: 'Blue ramp', css: 'linear-gradient(to right, #000, #00f)' },
  { name: '16 grey steps', css: `linear-gradient(to right, ${steps})` },
  { name: 'Hue sweep', css: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' },
]

export const PATTERNS: Record<Mode, Pattern[]> = {
  solid: SOLIDS,
  gradient: GRADIENTS,
  black: [{ name: 'Backlight bleed (black)', css: '#000000' }],
  checker: [
    { name: '1-pixel checkerboard', css: '', pixel: 'checker' },
    { name: 'Inverted checkerboard', css: '', pixel: 'checker-inv' },
    { name: 'Vertical lines', css: '', pixel: 'v-lines' },
    { name: 'Horizontal lines', css: '', pixel: 'h-lines' },
  ],
  fixer: [{ name: 'Pixel fixer', css: '#000000' }],
}

export const MODES: readonly (readonly [Mode, string])[] = [
  ['solid', 'Colors'],
  ['gradient', 'Gradients'],
  ['black', 'Bleed'],
  ['checker', 'Pixels'],
  ['fixer', 'Fixer'],
]

export interface Pos {
  mode: Mode
  index: number
}

/** Moves forward (dir 1) or back (dir -1) through the current mode's patterns, wrapping around. */
export function step(pos: Pos, dir: 1 | -1): Pos {
  const n = PATTERNS[pos.mode].length
  return { mode: pos.mode, index: (((pos.index + dir) % n) + n) % n }
}

/** Walks through every pattern of every mode except the fixer, for the full test tour. */
export function tourStep(pos: Pos, dir: 1 | -1): Pos {
  const order: Mode[] = MODES.map(([m]) => m).filter((m) => m !== 'fixer')
  const n = PATTERNS[pos.mode].length
  const next = pos.index + dir
  if (next >= 0 && next < n) return { mode: pos.mode, index: next }
  const mi = order.indexOf(pos.mode)
  const nm = order[(((mi + dir) % order.length) + order.length) % order.length]
  return { mode: nm, index: dir === 1 ? 0 : PATTERNS[nm].length - 1 }
}

/** The value (0 or 255) of pixel (x, y) for a per-pixel pattern. */
export function pixelOn(kind: NonNullable<Pattern['pixel']>, x: number, y: number): boolean {
  switch (kind) {
    case 'checker':
      return (x + y) % 2 === 0
    case 'checker-inv':
      return (x + y) % 2 === 1
    case 'v-lines':
      return x % 2 === 0
    case 'h-lines':
      return y % 2 === 0
  }
}

const FIX = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000']
/** Pixel fixer color for a frame: cycles primaries, white and black. */
export function fixerColor(frame: number): string {
  return FIX[((frame % FIX.length) + FIX.length) % FIX.length]
}
