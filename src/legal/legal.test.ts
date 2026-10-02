import { describe, expect, it } from 'vitest'
import packages from 'virtual:licenses'
import { tools } from '../tools/registry'
import { infoPages } from './LegalPages'

describe('site information pages', () => {
  it('gives each page a path that no tool uses and a description search engines show in full', () => {
    for (const [path, { meta }] of Object.entries(infoPages)) {
      expect(meta.path).toBe(path)
      expect(tools.some((t) => `/${t.slug}` === path), path).toBe(false)
      expect(meta.title.length).toBeLessThanOrEqual(70)
      expect(meta.description.length, meta.description).toBeGreaterThanOrEqual(70)
      expect(meta.description.length, meta.description).toBeLessThanOrEqual(160)
    }
  })

  it('lists the runtime packages and bundled icons, but not build-only tools', () => {
    const names = packages.map((p) => p.name)
    expect(names).toEqual(expect.arrayContaining(['react', 'mermaid', 'majesticons', '@fontsource-variable/jetbrains-mono']))
    expect(names).not.toContain('vite')
    expect(names).not.toContain('typescript')
    for (const p of packages) expect(p.license, p.name).toBeTruthy()
  })
})
