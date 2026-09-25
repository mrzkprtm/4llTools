import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import Roll from '../../motion/Roll'
import SettleOutput from '../../motion/SettleOutput'
import { CLASSES, clean, countByClass, describe, hiddenTagText, isEmojiPart, scan, type ClassId } from './invisible'
import './tool.css'

const tagText = (s: string) => Array.from(s, (c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join('')

const SAMPLE =
  '“Here’s the summary you asked for” — it’s short…\n' +
  'Price: Rp 150.000 per user; con­tact the team for details.\n' +
  'Invisible​space and a word⁠joiner hide in this line.\n' +
  'Looks fine: "user‮⁦txt.exe⁩⁦" but the order is reversed.' +
  tagText('hidden note') +
  '\nEmoji stay intact: 👩🏽‍💻 ❤️‍🔥'

const RENDER_CAP = 20000
const VISIBLE: ClassId[] = ['quote', 'dash', 'ellipsis']

export default function InvisibleCharacters() {
  const [text, setText] = useState(SAMPLE)
  const [fix, setFix] = useState<Set<ClassId>>(() => new Set(CLASSES.map((c) => c.id)))
  const deferred = useDeferredValue(text)

  const findings = useMemo(() => scan(deferred), [deferred])
  const counts = useMemo(() => countByClass(deferred, findings), [deferred, findings])
  const cleaned = useMemo(() => clean(deferred, fix), [deferred, fix])
  const hidden = useMemo(() => hiddenTagText(deferred), [deferred])
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const invisibleTotal = CLASSES.filter((c) => !VISIBLE.includes(c.id)).reduce((a, c) => a + counts[c.id], 0)

  const revealed = useMemo(() => {
    const nodes: ReactNode[] = []
    const shown = deferred.slice(0, RENDER_CAP)
    let pos = 0
    findings.forEach((f, i) => {
      if (f.index >= shown.length) return
      if (isEmojiPart(deferred, f)) return
      nodes.push(shown.slice(pos, f.index))
      const d = describe(f.cp)
      const title = `${d.name} (${d.code})`
      if (VISIBLE.includes(f.cls)) {
        nodes.push(<span key={i} className={`ic-vis ic-${f.cls}`} title={title}>{deferred.slice(f.index, f.index + f.length)}</span>)
      } else {
        nodes.push(<span key={i} className={`ic-badge ic-${f.cls}`} title={title} style={i < 80 ? { animationDelay: `${i * 12}ms` } : { animation: 'none' }}>{d.short}</span>)
        if (f.cls === 'separator') nodes.push('\n')
      }
      pos = f.index + f.length
    })
    nodes.push(shown.slice(pos))
    return nodes
  }, [deferred, findings])

  function toggle(id: ClassId, on: boolean) {
    setFix((s) => {
      const next = new Set(s)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([cleaned], { type: 'text/plain;charset=utf-8' }))
    a.download = 'cleaned.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div>
      <label htmlFor="ic-in">Paste text to inspect</label>
      <textarea id="ic-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text from ChatGPT, a PDF, a website or a chat app…" />

      <div className="row" aria-live="polite">
        {total === 0 ? (
          <span className="chip good" key="clean"><Check size={14} /> No hidden or unusual characters</span>
        ) : (
          <>
            <span className={`chip ${invisibleTotal ? 'bad calm' : ''}`} key={`i${invisibleTotal}`}><Roll>{invisibleTotal}</Roll>&nbsp;invisible</span>
            <span className="chip" key={`v${total - invisibleTotal}`}><Roll>{total - invisibleTotal}</Roll>&nbsp;typographic</span>
          </>
        )}
      </div>

      {hidden && (
        <div className="ic-alert" role="alert">
          <Icon name="alert-circle" size={20} />
          <div>
            <b>Hidden text found in Unicode tag characters:</b>
            <code>{hidden}</code>
            <span className="muted">This invisible “ASCII smuggling” trick is used to slip instructions past people into AI chatbots. Cleaning removes it.</span>
          </div>
        </div>
      )}

      <label>What’s in the text</label>
      <div className="ic-view" aria-label="Text with hidden characters shown as labels">{revealed}</div>
      {deferred.length > RENDER_CAP && <p className="muted" style={{ fontSize: '0.82rem' }}>Showing the first {RENDER_CAP.toLocaleString()} characters; counts and cleaning cover the whole text.</p>}

      <div style={{ overflowX: 'auto' }}>
        <table className="simple ic-table">
          <thead>
            <tr><th scope="col">Fix</th><th scope="col">Type</th><th scope="col">Found</th><th scope="col">Clean-up</th></tr>
          </thead>
          <tbody>
            {CLASSES.map((c) => (
              <tr key={c.id} className={counts[c.id] ? '' : 'ic-none'}>
                <td><input type="checkbox" checked={fix.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} aria-label={`Fix ${c.label}`} /></td>
                <td><span className={`ic-key ic-${c.id}`} aria-hidden="true" /> {c.label}</td>
                <td><span key={counts[c.id]} className={`chip ${counts[c.id] ? (c.risky ? 'bad calm' : '') : 'good'}`}><Roll>{counts[c.id]}</Roll></span></td>
                <td className="muted" style={{ fontSize: '0.84rem' }}>{c.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label htmlFor="ic-out">Cleaned text</label>
      <SettleOutput id="ic-out" value={cleaned} motion="order" />
      <div className="row">
        <CopyButton text={cleaned} label="Copy cleaned text" />
        <button type="button" className="btn btn-icon" onClick={download} disabled={!cleaned}><Icon name="file" size={18} /> Download</button>
        <button type="button" className="btn" onClick={() => setText(cleaned)} disabled={cleaned === text}>Replace input</button>
      </div>

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Finds zero-width spaces and joiners, byte order marks, non-breaking and odd-width spaces, soft hyphens, bidirectional overrides used in “Trojan Source” attacks,
        invisible Unicode tag characters, control characters, and the curly quotes, em dashes and ellipses that AI writing tools and word processors add.
        Joiners inside emoji (👩🏽‍💻) and tags inside flag emoji are kept so they don’t break. Nothing is uploaded: the check runs in your browser.
      </p>
    </div>
  )
}
