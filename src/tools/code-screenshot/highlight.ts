import type { HLJSApi, LanguageFn } from 'highlight.js'

type Loader = () => Promise<{ default: LanguageFn }>

/** Languages offered in the picker, with their highlight.js loaders. */
export const LANGUAGES: { id: string; label: string; load: Loader }[] = [
  { id: 'javascript', label: 'JavaScript / JSX', load: () => import('highlight.js/lib/languages/javascript') },
  { id: 'typescript', label: 'TypeScript / TSX', load: () => import('highlight.js/lib/languages/typescript') },
  { id: 'python', label: 'Python', load: () => import('highlight.js/lib/languages/python') },
  { id: 'go', label: 'Go', load: () => import('highlight.js/lib/languages/go') },
  { id: 'rust', label: 'Rust', load: () => import('highlight.js/lib/languages/rust') },
  { id: 'java', label: 'Java', load: () => import('highlight.js/lib/languages/java') },
  { id: 'kotlin', label: 'Kotlin', load: () => import('highlight.js/lib/languages/kotlin') },
  { id: 'swift', label: 'Swift', load: () => import('highlight.js/lib/languages/swift') },
  { id: 'dart', label: 'Dart', load: () => import('highlight.js/lib/languages/dart') },
  { id: 'c', label: 'C', load: () => import('highlight.js/lib/languages/c') },
  { id: 'cpp', label: 'C++', load: () => import('highlight.js/lib/languages/cpp') },
  { id: 'csharp', label: 'C#', load: () => import('highlight.js/lib/languages/csharp') },
  { id: 'php', label: 'PHP', load: () => import('highlight.js/lib/languages/php') },
  { id: 'ruby', label: 'Ruby', load: () => import('highlight.js/lib/languages/ruby') },
  { id: 'lua', label: 'Lua', load: () => import('highlight.js/lib/languages/lua') },
  { id: 'bash', label: 'Bash / Shell', load: () => import('highlight.js/lib/languages/bash') },
  { id: 'powershell', label: 'PowerShell', load: () => import('highlight.js/lib/languages/powershell') },
  { id: 'sql', label: 'SQL', load: () => import('highlight.js/lib/languages/sql') },
  { id: 'json', label: 'JSON', load: () => import('highlight.js/lib/languages/json') },
  { id: 'yaml', label: 'YAML', load: () => import('highlight.js/lib/languages/yaml') },
  { id: 'xml', label: 'HTML / XML', load: () => import('highlight.js/lib/languages/xml') },
  { id: 'css', label: 'CSS', load: () => import('highlight.js/lib/languages/css') },
  { id: 'scss', label: 'SCSS', load: () => import('highlight.js/lib/languages/scss') },
  { id: 'markdown', label: 'Markdown', load: () => import('highlight.js/lib/languages/markdown') },
  { id: 'dockerfile', label: 'Dockerfile', load: () => import('highlight.js/lib/languages/dockerfile') },
  { id: 'ini', label: 'INI / TOML', load: () => import('highlight.js/lib/languages/ini') },
  { id: 'diff', label: 'Diff', load: () => import('highlight.js/lib/languages/diff') },
  { id: 'plaintext', label: 'Plain text', load: () => import('highlight.js/lib/languages/plaintext') },
]

let loading: Promise<HLJSApi> | null = null

/** Loads highlight.js core with every language above registered (once). */
export function loadHighlighter(): Promise<HLJSApi> {
  loading ??= (async () => {
    const [{ default: hljs }, ...langs] = await Promise.all([import('highlight.js/lib/core'), ...LANGUAGES.map((l) => l.load())])
    langs.forEach((mod, i) => hljs.registerLanguage(LANGUAGES[i].id, mod.default))
    return hljs
  })()
  return loading
}

/** Highlights code; `language` 'auto' picks the best match. Output HTML is escaped by highlight.js. */
export function highlight(hljs: HLJSApi, code: string, language: string): { html: string; language: string } {
  if (language === 'auto') {
    const r = hljs.highlightAuto(code, LANGUAGES.map((l) => l.id).filter((id) => id !== 'plaintext'))
    return { html: r.value, language: r.language ?? 'plaintext' }
  }
  const lang = hljs.getLanguage(language) ? language : 'plaintext'
  return { html: hljs.highlight(code, { language: lang, ignoreIllegals: true }).value, language: lang }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Splits highlighted HTML into one string per source line. Spans that cross a
 * line break (block comments, template strings) are closed at the end of the
 * line and reopened on the next, so each line is well-formed on its own.
 */
export function splitLines(html: string): string[] {
  const lines: string[] = []
  const open: string[] = []
  let cur = ''
  for (const m of html.matchAll(/<span[^>]*>|<\/span>|\n|[^<\n]+|</g)) {
    const tok = m[0]
    if (tok === '\n') {
      lines.push(cur + '</span>'.repeat(open.length))
      cur = open.join('')
    } else if (tok.startsWith('<span')) {
      open.push(tok)
      cur += tok
    } else if (tok === '</span>') {
      open.pop()
      cur += tok
    } else cur += tok
  }
  lines.push(cur + '</span>'.repeat(open.length))
  return lines
}

export interface Theme {
  id: string
  name: string
  dark: boolean
}

/** Colour palettes; each one is a `.cs-theme-<id>` class in tool.css. */
export const THEMES: Theme[] = [
  { id: 'dracula', name: 'Dracula', dark: true },
  { id: 'one-dark', name: 'One Dark', dark: true },
  { id: 'nord', name: 'Nord', dark: true },
  { id: 'monokai', name: 'Monokai', dark: true },
  { id: 'night-owl', name: 'Night Owl', dark: true },
  { id: 'github-light', name: 'GitHub Light', dark: false },
  { id: 'solarized-light', name: 'Solarized Light', dark: false },
  { id: 'paper', name: 'Paper', dark: false },
]

export const BACKGROUNDS: { id: string; name: string; css: string }[] = [
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)' },
  { id: 'candy', name: 'Candy', css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'grape', name: 'Grape', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'mint', name: 'Mint', css: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 'aurora', name: 'Aurora', css: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'peach', name: 'Peach', css: 'linear-gradient(120deg, #fccb90 0%, #d57eeb 100%)' },
  { id: 'mesh', name: 'Mesh', css: 'radial-gradient(at 20% 20%, #ff9a8b 0, transparent 50%), radial-gradient(at 80% 0%, #a18cd1 0, transparent 50%), radial-gradient(at 80% 90%, #84fab0 0, transparent 50%), #fbc2eb' },
  { id: 'charcoal', name: 'Charcoal', css: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { id: 'none', name: 'Transparent', css: 'transparent' },
]

/** File name for the exported image, from the window title. */
export function imageFileName(title: string): string {
  const base = title.trim().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `${base || 'code'}.png`
}
