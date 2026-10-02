import { useDeferredValue, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import PillRow from '../../motion/PillRow'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import { useFlip } from '../../motion/useFlip'
import { applyRules, buildRegex, findMatches, type Options, type Rule } from './replace'
import './tool.css'

const SAMPLE = `Meeting notes 2026-09-25
Contact: budi.santoso@example.com, siti@example.org
Status: TODO review draft; TODO send invoice
Next meeting: 2026-10-02`

const MARK_CAP = 2000
let nextId = 3

export default function FindReplace() {
  const [text, setText] = useState(SAMPLE)
  const [opts, setOpts] = useState<Options>({ regex: true, caseSensitive: false, wholeWord: false, multiline: true, dotAll: false })
  const [rules, setRules] = useState<Rule[]>([
    { id: 'r1', find: '(\\d{4})-(\\d{2})-(\\d{2})', replace: '$3/$2/$1', enabled: true },
    { id: 'r2', find: 'TODO', replace: 'DONE', enabled: true },
  ])
  const [active, setActive] = useState('r1')
  const list = useRef<HTMLOListElement>(null)
  useFlip(list)
  const deferred = useDeferredValue(text)

  const { output, results } = useMemo(() => applyRules(deferred, rules, opts), [deferred, rules, opts])
  const activeIndex = Math.max(0, rules.findIndex((r) => r.id === active))
  const activeRule = rules[activeIndex]

  // Text as the active rule sees it (after the rules before it have run).
  const preview = useMemo(() => {
    const stage = applyRules(deferred, rules.slice(0, activeIndex), opts).output
    const built = activeRule && activeRule.enabled && activeRule.find ? buildRegex(activeRule.find, opts) : null
    const matches = built && built.ok ? findMatches(stage, built.re, MARK_CAP + 1) : []
    return { stage, matches }
  }, [deferred, rules, activeIndex, activeRule, opts])

  const total = results.reduce((a, r) => a + r.count, 0)

  function update(id: string, patch: Partial<Rule>) {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function add() {
    const id = `r${nextId++}`
    setRules((rs) => [...rs, { id, find: '', replace: '', enabled: true }])
    setActive(id)
  }
  function remove(id: string) {
    const rest = rules.filter((r) => r.id !== id)
    const next = rest.length ? rest : [{ id: `r${nextId++}`, find: '', replace: '', enabled: true }]
    setRules(next)
    if (active === id) setActive(next[0].id)
  }
  function move(id: string, dir: -1 | 1) {
    setRules((rs) => {
      const i = rs.findIndex((r) => r.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= rs.length) return rs
      const next = [...rs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([output], { type: 'text/plain;charset=utf-8' }))
    a.download = 'replaced.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const marked: ReactNode[] = []
  {
    let p = 0
    preview.matches.slice(0, MARK_CAP).forEach((m, i) => {
      if (m.length === 0) return
      marked.push(preview.stage.slice(p, m.index))
      marked.push(<mark key={i} className="fr-mark">{m.text}</mark>)
      p = m.index + m.length
    })
    marked.push(preview.stage.slice(p))
  }

  const set = (k: keyof Options) => (e: ChangeEvent<HTMLInputElement>) => setOpts({ ...opts, [k]: e.target.checked })

  return (
    <div>
      <label htmlFor="fr-in">Text</label>
      <textarea id="fr-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the text to search in…" />

      <PillRow label="Search mode">
        <button type="button" className={`btn ${!opts.regex ? 'primary' : ''}`} aria-pressed={!opts.regex} onClick={() => setOpts({ ...opts, regex: false })}>Plain text</button>
        <button type="button" className={`btn ${opts.regex ? 'primary' : ''}`} aria-pressed={opts.regex} onClick={() => setOpts({ ...opts, regex: true })}>Regex</button>
      </PillRow>
      <div className="row" style={{ gap: 14 }}>
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={opts.caseSensitive} onChange={set('caseSensitive')} /> Match case</label>
        <label style={{ fontWeight: 400 }}><input type="checkbox" checked={opts.wholeWord} onChange={set('wholeWord')} /> Whole word</label>
        {opts.regex && <label style={{ fontWeight: 400 }}><input type="checkbox" checked={opts.multiline} onChange={set('multiline')} /> ^ $ per line</label>}
        {opts.regex && <label style={{ fontWeight: 400 }}><input type="checkbox" checked={opts.dotAll} onChange={set('dotAll')} /> . matches newline</label>}
      </div>

      <h3 className="fr-h">Rules <span className="muted" style={{ fontWeight: 400, fontSize: '0.85rem' }}>applied top to bottom</span></h3>
      <ol ref={list} className="fr-rules">
        {rules.map((r, i) => {
          const res = results[i]
          const isActive = r.id === activeRule?.id
          return (
            <li key={r.id} data-flip={r.id} className={`fr-rule ${isActive ? 'on' : ''} ${r.enabled ? '' : 'off'}`} onFocusCapture={() => setActive(r.id)} onClick={() => setActive(r.id)}>
              <span className="fr-num" aria-hidden="true">{i + 1}</span>
              <div className="fr-fields">
                <div>
                  <label htmlFor={`f-${r.id}`} className="fr-lab">Find</label>
                  <input id={`f-${r.id}`} type="text" value={r.find} onChange={(e) => update(r.id, { find: e.target.value })} spellCheck={false} autoComplete="off" aria-invalid={!!res?.error} className="fr-input" placeholder={opts.regex ? 'e.g. (\\w+)@(\\w+)' : 'word or phrase'} />
                </div>
                <div>
                  <label htmlFor={`r-${r.id}`} className="fr-lab">Replace with</label>
                  <input id={`r-${r.id}`} type="text" value={r.replace} onChange={(e) => update(r.id, { replace: e.target.value })} spellCheck={false} autoComplete="off" className="fr-input" placeholder={opts.regex ? '$1, $<name>, \\n' : 'leave empty to delete'} />
                </div>
              </div>
              <div className="fr-side">
                <span key={`${res?.count}`} className={`chip ${res?.error ? 'bad' : res?.count ? 'good' : ''}`} title="Replacements made by this rule">
                  {res?.error ? 'error' : <><Roll>{res?.count ?? 0}</Roll>×</>}
                </span>
                <div className="fr-actions">
                  <label className="fr-switch" title="Enable rule"><input type="checkbox" checked={r.enabled} onChange={(e) => update(r.id, { enabled: e.target.checked })} aria-label={`Enable rule ${i + 1}`} /></label>
                  <button type="button" className="fr-icon" onClick={() => move(r.id, -1)} disabled={i === 0} aria-label={`Move rule ${i + 1} up`}><Icon name="arrow-up" size={16} /></button>
                  <button type="button" className="fr-icon" onClick={() => move(r.id, 1)} disabled={i === rules.length - 1} aria-label={`Move rule ${i + 1} down`}><Icon name="arrow-down" size={16} /></button>
                  <button type="button" className="fr-icon" onClick={() => remove(r.id)} aria-label={`Delete rule ${i + 1}`}><Icon name="delete-bin" size={16} /></button>
                </div>
              </div>
              {res?.error && <p className="error fr-err" role="alert">{res.error}</p>}
            </li>
          )
        })}
      </ol>
      <div className="row">
        <button type="button" className="btn btn-icon" onClick={add}><Icon name="plus" size={18} /> Add rule</button>
      </div>

      <div className="two-col">
        <div style={{ minWidth: 0 }}>
          <label>Matches for rule {activeIndex + 1} <span className="chip" key={preview.matches.length}>{preview.matches.length > MARK_CAP ? `${MARK_CAP}+` : preview.matches.length}</span></label>
          <div className="fr-preview" aria-label="Text with matches highlighted">{marked}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <label htmlFor="fr-out">Result <span className="chip good" key={total}><Roll>{total}</Roll>&nbsp;replaced</span></label>
          <SettleOutput id="fr-out" value={output} motion="order" style={{ minHeight: 200 }} />
          <div className="row">
            <CopyButton text={output} />
            <button type="button" className="btn btn-icon" onClick={download} disabled={!output}><Icon name="file" size={18} /> Download</button>
            <button type="button" className="btn" onClick={() => setText(output)} disabled={output === text}>Use as input</button>
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Plain mode finds the exact text and inserts the replacement literally. Regex mode uses JavaScript regular expressions: use $1, $2 or $&lt;name&gt; for captured
        groups, $&amp; for the whole match, and \n or \t for a new line or tab. Each rule runs on the output of the one above it, so you can chain clean-up steps.
        Everything happens in your browser.
      </p>
    </div>
  )
}
