import { it } from 'vitest'
import { writeFileSync } from 'fs'
import { Cloth } from './cloth'
import { makeNoise } from '../../sim/math'
it('check', () => {
  const out: string[] = []
  const noise = makeNoise(7)
  for (const [iters, g, wind, pin] of [[10, 980, 300, 'row'], [1, 980, 300, 'row'], [1, 2000, 1500, 'row'], [1, 2000, 1500, 'corners'], [3, 2000, 1500, 'corners'], [10, 2000, 1500, 'every4']] as const) {
    const c = new Cloth(36, 24, 15, 137.5, 44, pin)
    let t = 0
    let maxS = 0
    for (let s = 0; s < 120 * 8; s++) {
      t += 1 / 120
      c.step(1 / 120, { gravity: g, iterations: iters, force: (x, y) => [wind * (0.55 + 0.9 * noise(x * 0.004 + t * 0.35, y * 0.004, t * 0.25)), wind * 0.35 * noise(x * 0.006, y * 0.006 + 40, t * 0.6)] })
      if (s > 240) maxS = Math.max(maxS, c.maxStretch())
    }
    out.push(`iters ${iters} g ${g} wind ${wind} ${pin}: max stretch ${(maxS * 100).toFixed(0)}%`)
  }
  const c = new Cloth(36, 24, 15, 137.5, 44, 'row')
  const t0 = performance.now(); for (let s = 0; s < 240; s++) c.step(1 / 120, { gravity: 980, iterations: 30, force: (x, y) => [noise(x, y), 0] }); out.push(`ms per step (30 its) ${((performance.now() - t0) / 240).toFixed(3)}`)
  writeFileSync('/tmp/claude-0/-home-user-4llTools/84d0fa1c-e481-5fd6-8734-07ae7964653a/scratchpad/cloth-out.txt', out.join('\n'))
}, 60000)
