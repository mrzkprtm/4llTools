/** CSS keyframe presets and their timing serialisation. */

export interface AnimConfig {
  /** Seconds. */
  duration: number
  /** Seconds. */
  delay: number
  easing: string
  iteration: number | 'infinite'
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  /** Pixels, used by presets that move or grow. */
  distance: number
}

export interface AnimPreset {
  id: string
  name: string
  frames: (config: AnimConfig) => string
}

const frame = (at: string, decls: string) => `  ${at} { ${decls} }`
const j = (lines: string[]) => lines.join('\n')

export const PRESETS: AnimPreset[] = [
  { id: 'fade', name: 'Fade', frames: () => j([frame('0%', 'opacity: 0;'), frame('100%', 'opacity: 1;')]) },
  {
    id: 'slide',
    name: 'Slide',
    frames: (c) => j([frame('0%', `transform: translateX(-${clampDistance(c.distance)}px); opacity: 0;`), frame('100%', 'transform: none; opacity: 1;')]),
  },
  {
    id: 'bounce',
    name: 'Bounce',
    frames: (c) => j([frame('0%, 100%', 'transform: translateY(0);'), frame('50%', `transform: translateY(-${clampDistance(c.distance)}px);`)]),
  },
  {
    id: 'pulse',
    name: 'Pulse',
    frames: () => j([frame('0%, 100%', 'transform: scale(1);'), frame('50%', 'transform: scale(1.08);')]),
  },
  {
    id: 'shake',
    name: 'Shake',
    frames: (c) => {
      const d = clampDistance(c.distance) / 3
      return j([frame('0%, 100%', 'transform: translateX(0);'), frame('20%, 60%', `transform: translateX(-${d}px);`), frame('40%, 80%', `transform: translateX(${d}px);`)])
    },
  },
  { id: 'spin', name: 'Spin', frames: () => j([frame('0%', 'transform: rotate(0deg);'), frame('100%', 'transform: rotate(360deg);')]) },
  {
    id: 'float',
    name: 'Float',
    frames: (c) => j([frame('0%, 100%', 'transform: translateY(0);'), frame('50%', `transform: translateY(-${clampDistance(c.distance)}px);`)]),
  },
]

export function clampDuration(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.round(Math.min(10, Math.max(0.1, n)) * 100) / 100
}

export function clampDelay(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.min(10, Math.max(0, n)) * 100) / 100
}

function clampDistance(n: number): number {
  if (!Number.isFinite(n)) return 24
  return Math.round(Math.min(200, Math.max(1, n)))
}

function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(100, Math.max(1, Math.round(n)))
}

/** The `@keyframes` rule. An unknown preset id falls back to the first preset. */
export function keyframesCss(name: string, preset: string, config: AnimConfig): string {
  const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[0]
  return `@keyframes ${name} {\n${p.frames(config)}\n}`
}

/** The `animation` shorthand declaration. */
export function animationCss(name: string, config: AnimConfig): string {
  const duration = clampDuration(config.duration)
  const delay = clampDelay(config.delay)
  const iteration = config.iteration === 'infinite' ? 'infinite' : clampCount(config.iteration)
  return `animation: ${name} ${duration}s ${config.easing} ${delay}s ${iteration} ${config.direction};`
}
