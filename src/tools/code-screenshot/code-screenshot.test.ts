import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BACKGROUNDS, escapeHtml, highlight, imageFileName, loadHighlighter, splitLines, THEMES } from './highlight'

describe('code screenshot helpers', () => {
  it('splits highlighted HTML into balanced lines', () => {
    const html = 'a <span class="c">/* one\ntwo */</span> b\n<span class="k">x</span>'
    expect(splitLines(html)).toEqual(['a <span class="c">/* one</span>', '<span class="c">two */</span> b', '<span class="k">x</span>'])
    expect(splitLines('')).toEqual([''])
    expect(splitLines('1\n\n3')).toEqual(['1', '', '3'])
  })

  it('handles nested spans across lines', () => {
    const lines = splitLines('<span class="s">`a ${<span class="v">b\nc</span>}`</span>')
    expect(lines[0]).toBe('<span class="s">`a ${<span class="v">b</span></span>')
    expect(lines[1]).toBe('<span class="s"><span class="v">c</span>}`</span>')
  })

  it('escapes HTML for the plain-text fallback', () => {
    expect(escapeHtml('<img src=x onerror="y">&')).toBe('&lt;img src=x onerror=&quot;y&quot;&gt;&amp;')
  })

  it('highlights with escaping and auto-detects common languages', async () => {
    const hljs = await loadHighlighter()
    const js = highlight(hljs, 'const x = "<b>" // hi', 'javascript')
    expect(js.html).toContain('&lt;b&gt;')
    expect(js.html).not.toContain('<b>')
    expect(js.html).toContain('hljs-keyword')
    expect(highlight(hljs, 'def greet(name):\n    print(f"Hello {name}")\n\nif __name__ == "__main__":\n    greet("x")', 'auto').language).toBe('python')
    expect(highlight(hljs, 'x', 'no-such-lang').language).toBe('plaintext')
  })

  it('defines a CSS class for every theme and unique backgrounds', () => {
    const css = readFileSync(new URL('./tool.css', import.meta.url), 'utf8')
    for (const t of THEMES) expect(css, t.id).toContain(`.cs-theme-${t.id} {`)
    expect(new Set(BACKGROUNDS.map((b) => b.id)).size).toBe(BACKGROUNDS.length)
  })

  it('makes a safe image file name from the title', () => {
    expect(imageFileName('debounce.ts')).toBe('debounce.png')
    expect(imageFileName('  My Snippet!! ')).toBe('my-snippet.png')
    expect(imageFileName('')).toBe('code.png')
  })
})
