import { describe, expect, it } from 'vitest'
import { buildGitignore, searchTemplates, TEMPLATES } from './templates'

describe('gitignore generator', () => {
  it('ships a broad, uniquely keyed template set', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(28)
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length)
    for (const t of TEMPLATES) expect(t.body.trim().length, t.id).toBeGreaterThan(0)
  })

  it('writes a header per template in the chosen order', () => {
    const { text } = buildGitignore(['python', 'macos'])
    expect(text.indexOf('### Python ###')).toBe(0)
    expect(text).toContain('### macOS ###')
    expect(text.indexOf('### Python ###')).toBeLessThan(text.indexOf('### macOS ###'))
    expect(text).toContain('__pycache__/')
    expect(text.endsWith('\n')).toBe(true)
  })

  it('drops patterns already written by an earlier section', () => {
    const { text, removed } = buildGitignore(['node', 'vite', 'nuxt'])
    const count = (p: string) => text.split('\n').filter((l) => l === p).length
    expect(count('dist/')).toBe(1)
    expect(count('.cache/')).toBe(1)
    expect(removed).toBeGreaterThanOrEqual(3)
  })

  it('removes a section entirely when all its patterns are duplicates', () => {
    const { text } = buildGitignore(['env', 'custom-missing'], '.env\n.envrc')
    expect(text).toContain('### Env files ###')
    expect(text).not.toContain('### Custom ###')
  })

  it('keeps negations and custom patterns, and leaves no orphan comments or blank runs', () => {
    const { text, lines } = buildGitignore(['vscode'], '# uploads\nuploads/\n\n\n!keep.txt')
    expect(text).toContain('!.vscode/settings.json')
    expect(text).toContain('### Custom ###\n# uploads\nuploads/\n\n!keep.txt')
    expect(text).not.toMatch(/\n\n\n/)
    expect(lines).toBe(text.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length)
  })

  it('returns an empty file for no selection and ignores unknown ids', () => {
    expect(buildGitignore([]).text).toBe('')
    expect(buildGitignore(['nope']).text).toBe('')
  })

  it('searches names and tags', () => {
    expect(searchTemplates('intellij').map((t) => t.id)).toContain('jetbrains')
    expect(searchTemplates('GOLANG').map((t) => t.id)).toEqual(['go'])
    expect(searchTemplates('').length).toBe(TEMPLATES.length)
  })
})
