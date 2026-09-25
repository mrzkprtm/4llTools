import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import PillRow from '../../motion/PillRow'
import { SKIN_TONES, codepoints, flatten, pushRecent, searchEmojis, shortcode, withSkinTone, type EmojiItem, type RawGroup } from './emoji'
import './tool.css'

const GROUP_ICONS: Record<string, string> = {
  'Smileys & Emotion': '😀',
  'People & Body': '👋',
  'Animals & Nature': '🐻',
  'Food & Drink': '🍔',
  'Travel & Places': '✈️',
  Activities: '⚽',
  Objects: '💡',
  Symbols: '❤️',
  Flags: '🏁',
}
const PAGE = 180
const RECENT_KEY = '4lltools:emoji-recent'
const TONE_KEY = '4lltools:emoji-tone'

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage blocked: recent list just isn't remembered */
  }
}

export default function EmojiPicker() {
  const [items, setItems] = useState<EmojiItem[] | null>(null)
  const [groupNames, setGroupNames] = useState<string[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('Smileys & Emotion')
  const [tone, setTone] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [selected, setSelected] = useState<EmojiItem | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null)
  const timer = useRef(0)
  const q = useDeferredValue(query)

  useEffect(() => {
    let alive = true
    import('unicode-emoji-json/data-by-group.json')
      .then((mod) => {
        if (!alive) return
        const groups = (mod.default ?? mod) as RawGroup[]
        const all = flatten(groups)
        setItems(all)
        setGroupNames(groups.map((g) => g.name).filter((n) => n !== 'Component'))
        setSelected((s) => s ?? all.find((e) => e.slug === 'thumbs_up') ?? all[0])
      })
      .catch(() => alive && setError('The emoji list could not be loaded. Check your connection and reload.'))
    try {
      const r = JSON.parse(readStore(RECENT_KEY) ?? '[]')
      if (Array.isArray(r)) setRecent(r.filter((x): x is string => typeof x === 'string').slice(0, 24))
    } catch {
      /* ignore bad data */
    }
    const t = readStore(TONE_KEY)
    if (t && SKIN_TONES.some((s) => s.id === t)) setTone(t)
    return () => {
      alive = false
      clearTimeout(timer.current)
    }
  }, [])

  const bySlugEmoji = useMemo(() => new Map((items ?? []).map((e) => [e.emoji, e])), [items])

  const list = useMemo(() => {
    if (!items) return []
    if (q.trim()) return searchEmojis(items, q, 400)
    if (tab === 'Recent') return recent.map((e) => bySlugEmoji.get(e) ?? { emoji: e, name: 'recent', slug: 'recent', group: 'Recent', skin: false, version: '' })
    return items.filter((e) => e.group === tab)
  }, [items, q, tab, recent, bySlugEmoji])

  useEffect(() => setLimit(PAGE), [q, tab])

  const shown = list.slice(0, limit)
  const display = (e: EmojiItem) => (e.skin ? withSkinTone(e.emoji, tone) : e.emoji)

  async function pick(e: EmojiItem) {
    const value = display(e)
    setSelected(e)
    const next = pushRecent(recent, e.emoji)
    setRecent(next)
    writeStore(RECENT_KEY, JSON.stringify(next))
    try {
      await navigator.clipboard.writeText(value)
      setToast((t) => ({ text: `Copied ${value}`, n: (t?.n ?? 0) + 1 }))
    } catch {
      setToast((t) => ({ text: `Selected ${value} (copy blocked, use the button below)`, n: (t?.n ?? 0) + 1 }))
    }
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 1800)
  }

  function chooseTone(id: string) {
    setTone(id)
    writeStore(TONE_KEY, id)
  }

  const sel = selected ? display(selected) : ''

  return (
    <div>
      <label htmlFor="em-q">Search emoji</label>
      <input id="em-q" type="search" className="em-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try “fire”, “heart”, “senyum”, “kucing”…" autoComplete="off" />

      <div className="row em-tones" role="radiogroup" aria-label="Skin tone">
        <span className="muted" style={{ fontSize: '0.85rem' }}>Skin tone</span>
        {SKIN_TONES.map((s) => (
          <button key={s.label} type="button" role="radio" aria-checked={tone === s.id} className={`em-tone ${tone === s.id ? 'on' : ''}`} onClick={() => chooseTone(s.id)} title={s.label} aria-label={s.label}>
            {s.swatch}
          </button>
        ))}
      </div>

      {!query.trim() && items && (
        <div className="em-tabs">
          <PillRow label="Emoji groups" style={{ flexWrap: 'nowrap', margin: 0 }}>
            <button type="button" className={`btn em-tab ${tab === 'Recent' ? 'primary' : ''}`} aria-pressed={tab === 'Recent'} onClick={() => setTab('Recent')} title="Recently used">🕘</button>
            {groupNames.map((g) => (
              <button key={g} type="button" className={`btn em-tab ${tab === g ? 'primary' : ''}`} aria-pressed={tab === g} onClick={() => setTab(g)} title={g} aria-label={g}>
                {GROUP_ICONS[g] ?? g.slice(0, 2)}
              </button>
            ))}
          </PillRow>
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      {!items && !error && <Busy label="Loading 1,900+ emoji…" />}

      {items && (
        <>
          <p className="muted em-count" aria-live="polite">
            {query.trim() ? `${list.length}${list.length === 400 ? '+' : ''} result${list.length === 1 ? '' : 's'} for “${query.trim()}”` : tab === 'Recent' ? (recent.length ? 'Recently used' : 'Emoji you copy will show up here.') : tab}
          </p>
          <div className="em-grid" key={`${q}|${tab}`}>
            {shown.map((e, i) => (
              <button
                key={e.emoji}
                type="button"
                className={`em-cell ${selected?.emoji === e.emoji ? 'on' : ''}`}
                onClick={() => pick(e)}
                title={e.name}
                aria-label={e.name}
                style={i < 60 ? { animationDelay: `${i * 8}ms` } : { animation: 'none' }}
              >
                {display(e)}
              </button>
            ))}
          </div>
          {query.trim() && !list.length && <p className="muted">No emoji match. Try an English word such as “happy”, “cat” or “party”.</p>}
          {list.length > limit && (
            <div className="row">
              <button type="button" className="btn" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, list.length - limit)} more</button>
            </div>
          )}
        </>
      )}

      {toast && <div key={toast.n} className="em-toast chip good" role="status">{toast.text}</div>}

      {selected && (
        <div className="em-detail" key={selected.emoji + tone}>
          <span className="em-big pop" aria-hidden="true">{sel}</span>
          <div style={{ minWidth: 0 }}>
            <b className="em-name">{selected.name}</b>
            <dl className="em-facts">
              <dt>Codepoints</dt><dd>{codepoints(sel)}</dd>
              <dt>Shortcode</dt><dd>{shortcode(selected.slug)}</dd>
              {selected.version && <><dt>Emoji version</dt><dd>{selected.version}</dd></>}
              <dt>Group</dt><dd>{selected.group}</dd>
            </dl>
            <div className="row" style={{ margin: '8px 0 0' }}>
              <CopyButton text={sel} label="Copy emoji" />
              <CopyButton text={shortcode(selected.slug)} label="Copy shortcode" />
              <CopyButton text={codepoints(sel)} label="Copy codepoints" />
            </div>
          </div>
        </div>
      )}

      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Data from the Unicode emoji list (unicode-emoji-json). Search matches English names, and common Indonesian words such as senyum, hati, api, tertawa, kucing or kopi.
        How an emoji looks depends on your device’s font; very new emoji may show as boxes on older phones. Shortcodes follow the Unicode name and may differ from Slack or GitHub.
        Your recent emoji are kept only in this browser.
      </p>
    </div>
  )
}
