import { describe, expect, it } from 'vitest'
import { PRESETS, animationCss, clampDelay, clampDuration, keyframesCss, type AnimConfig } from './animation'

const config: AnimConfig = {
  duration: 1,
  delay: 0.2,
  easing: 'ease-in-out',
  iteration: 'infinite',
  direction: 'normal',
  distance: 24,
}

describe('css animation builder', () => {
  it('ships the seven presets', () => {
    expect(PRESETS.map((p) => p.id)).toEqual(['fade', 'slide', 'bounce', 'pulse', 'shake', 'spin', 'float'])
    for (const p of PRESETS) expect(typeof p.frames(config)).toBe('string')
  })

  it('clamps durations and delays', () => {
    expect(clampDuration(-1)).toBe(0.1)
    expect(clampDuration(99)).toBe(10)
    expect(clampDuration(NaN)).toBe(1)
    expect(clampDuration(1.234)).toBe(1.23)
    expect(clampDelay(-1)).toBe(0)
    expect(clampDelay(1.5)).toBe(1.5)
  })

  it('writes keyframes', () => {
    expect(keyframesCss('fadeIn', 'fade', config)).toBe('@keyframes fadeIn {\n  0% { opacity: 0; }\n  100% { opacity: 1; }\n}')
    expect(keyframesCss('bounce', 'bounce', config)).toContain('transform: translateY(-24px);')
  })

  it('falls back to the first preset for an unknown id', () => {
    expect(keyframesCss('x', 'does-not-exist', config)).toBe(keyframesCss('x', 'fade', config))
  })

  it('writes the animation shorthand', () => {
    expect(animationCss('fadeIn', config)).toBe('animation: fadeIn 1s ease-in-out 0.2s infinite normal;')
    expect(animationCss('fadeIn', { ...config, iteration: 3, direction: 'alternate' })).toBe('animation: fadeIn 1s ease-in-out 0.2s 3 alternate;')
    expect(animationCss('fadeIn', { ...config, duration: 99 })).toContain('fadeIn 10s')
    expect(animationCss('fadeIn', { ...config, iteration: 0 })).toContain(' 1 normal;')
  })
})
