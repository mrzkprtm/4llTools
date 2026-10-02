import { useMemo, useRef, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import { useFlip } from '../../motion/useFlip'
import { buildGitignore, searchTemplates, TEMPLATE_BY_ID, TEMPLATES, type TemplateGroup } from './templates'
import './tool.css'

const GROUPS: TemplateGroup[] = ['Language', 'Framework', 'Tool', 'Editor', 'OS']

const STACKS: { label: string; ids: string[] }[] = [
  { label: 'React + Vite', ids: ['node', 'vite', 'env', 'logs', 'vscode', 'macos', 'windows'] },
  { label: 'Next.js', ids: ['node', 'nextjs', 'env', 'logs', 'vscode', 'macos'] },
  { label: 'Python API', ids: ['python', 'django', 'env', 'logs', 'jetbrains', 'macos'] },
  { label: 'Go service', ids: ['go', 'docker', 'env', 'vscode', 'macos', 'linux'] },
  { label: 'Laravel', ids: ['php', 'node', 'env', 'logs', 'jetbrains'] },
  { label: 'Unity game', ids: ['unity', 'vscode', 'windows', 'macos'] },
]

export default function GitignoreGenerator() {
  const [selected, setSelected] = useState<string[]>(['node', 'vite', 'env', 'vscode', 'macos'])
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState('')
  const picked = useRef<HTMLDivElement>(null)
  useFlip(picked)

  const matches = useMemo(() => searchTemplates(query), [query])
  const result = useMemo(() => buildGitignore(selected, custom), [selected, custom])

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  function download() {
    const blob = new Blob([result.text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = '.gitignore'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <div>
      <label htmlFor="gi-search">Search templates ({TEMPLATES.length})</label>
      <input
        id="gi-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches.length) {
            e.preventDefault()
            toggle(matches[0].id)
            setQuery('')
          }
        }}
        placeholder="node, python, unity, jetbrains…  (Enter adds the first match)"
        autoComplete="off"
        spellCheck={false}
      />

      <div className="row" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Quick stacks:</span>
        {STACKS.map((s) => (
          <button key={s.label} type="button" className="btn gi-stack" onClick={() => setSelected(s.ids)}>{s.label}</button>
        ))}
      </div>

      {GROUPS.map((g) => {
        const list = matches.filter((m) => m.group === g)
        if (!list.length) return null
        return (
          <div key={g} className="gi-group">
            <span className="gi-group-name">{g}</span>
            <div className="gi-chips" role="group" aria-label={`${g} templates`}>
              {list.map((m) => {
                const on = selected.includes(m.id)
                return (
                  <button key={m.id} type="button" aria-pressed={on} className={`gi-chip ${on ? 'on' : ''}`} onClick={() => toggle(m.id)}>
                    <span className="gi-tick" aria-hidden="true">{on ? '✓' : '+'}</span>
                    {m.name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {!matches.length && <p className="muted">No template matches “{query}”. Add your own patterns below.</p>}

      <label>Selected ({selected.length})</label>
      <div ref={picked} className="gi-picked" aria-live="polite">
        {selected.length === 0 && <span className="muted" style={{ fontSize: '0.88rem' }}>Nothing selected yet: pick a template or a quick stack.</span>}
        {selected.map((id) => (
          <button key={id} data-flip={id} type="button" className="chip gi-sel" onClick={() => toggle(id)} aria-label={`Remove ${TEMPLATE_BY_ID.get(id)?.name}`}>
            {TEMPLATE_BY_ID.get(id)?.name} <span aria-hidden="true">×</span>
          </button>
        ))}
        {selected.length > 0 && (
          <button type="button" className="btn gi-clear" onClick={() => setSelected([])}>Clear all</button>
        )}
      </div>

      <label htmlFor="gi-custom">Extra patterns (optional)</label>
      <textarea id="gi-custom" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={'uploads/\n*.sqlite\n!keep-me.txt'} style={{ minHeight: 80 }} spellCheck={false} />

      <div className="stats">
        <div className="stat"><b><Roll>{String(selected.length)}</Roll></b>templates</div>
        <div className="stat"><b><Roll>{String(result.lines)}</Roll></b>patterns</div>
        <div className="stat"><b><Roll>{String(result.removed)}</Roll></b>duplicates removed</div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <label htmlFor="gi-out" style={{ margin: 0 }}>.gitignore</label>
        <span className="row" style={{ margin: 0 }}>
          <CopyButton text={result.text} />
          <button type="button" className="btn btn-icon" onClick={download} disabled={!result.text}>
            <Icon name="arrow-down-circle" size={18} /> Download
          </button>
        </span>
      </div>
      <SettleOutput id="gi-out" value={result.text} motion="order" style={{ minHeight: 320 }} placeholder="Pick templates to build your .gitignore" />
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Templates are curated and merged in the order you pick them. A pattern that already appears in an earlier section is skipped, so the file stays short.
        Save it as <code>.gitignore</code> in your repository root. Files Git already tracks stay tracked until you run <code>git rm --cached &lt;file&gt;</code>.
      </p>
    </div>
  )
}
