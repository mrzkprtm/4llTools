import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { reducedMotion } from '../../motion/springs'
import { SIZES, parseVideoId, thumbUrl, type ThumbSize } from './yt'

type CardState = 'loading' | 'ok' | 'missing'

/** Fetches the JPEG, re-encodes it as PNG and saves it. False → caller falls back to a new tab. */
async function savePng(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url)
    if (!res.ok) return false
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    canvas.getContext('2d')!.drawImage(bmp, 0, 0)
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (!png) return false
    const a = document.createElement('a')
    a.href = URL.createObjectURL(png)
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    return true
  } catch {
    return false
  }
}

function ThumbCard({
  id,
  size,
  index,
  onState,
}: {
  id: string
  size: ThumbSize
  index: number
  onState: (key: string, s: CardState) => void
}) {
  const [state, setState] = useState<CardState>('loading')
  const [dims, setDims] = useState(size.label)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const url = thumbUrl(id, size.key)

  const report = (s: CardState) => {
    setState(s)
    onState(size.key, s)
  }

  async function download() {
    setBusy(true)
    const saved = await savePng(url, `${id}-${size.key}.png`)
    if (!saved) window.open(url, '_blank', 'noopener')
    setDone(saved)
    setBusy(false)
    if (saved) window.setTimeout(() => setDone(false), 2000)
  }

  return (
    <div
      className="settle-in"
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        background: 'var(--sunken)',
        animationDelay: `${index * 55}ms`,
        opacity: state === 'missing' ? 0.55 : 1,
        transition: 'opacity 0.3s',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#000' }}>
        {state !== 'missing' && (
          <img
            src={url}
            alt={`YouTube thumbnail ${size.label}`}
            loading="lazy"
            onLoad={(e) => {
              setDims(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)
              report('ok')
            }}
            onError={() => report('missing')}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: state === 'ok' ? 'cover' : 'contain',
              animation: reducedMotion() ? 'none' : 'fade 0.4s both',
            }}
          />
        )}
        {state === 'loading' && (
          <span className="busy-dots" style={{ position: 'absolute', inset: 0, margin: 'auto', width: 25, height: 7 }} aria-label="Loading thumbnail">
            <i /> <i /> <i />
          </span>
        )}
        {state === 'missing' && (
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', gap: 2, color: 'var(--muted)', fontSize: '0.82rem' }}>
            <Icon name="image-off" size={26} />
            <span>Not available</span>
          </span>
        )}
      </div>
      <div style={{ padding: '10px 12px', display: 'grid', gap: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: 'var(--muted)' }}>
          {size.key} · <b style={{ color: 'var(--text)' }}><Roll>{dims}</Roll></b>
        </span>
        <span className="row" style={{ margin: 0, flexWrap: 'nowrap' }}>
          <button type="button" className={`btn btn-icon ${done ? 'is-done' : ''}`} onClick={download} disabled={state !== 'ok' || busy} style={{ flex: 1, justifyContent: 'center' }}>
            <Icon name={done ? 'clipboard-check' : 'arrow-right'} size={16} />
            {busy ? 'Saving…' : done ? 'Saved!' : 'PNG'}
          </button>
          <CopyButton text={url} label="URL" />
        </span>
      </div>
    </div>
  )
}

function Results({ id }: { id: string }) {
  const [states, setStates] = useState<Record<string, CardState>>({})
  const report = (key: string, s: CardState) => setStates((prev) => (prev[key] === s ? prev : { ...prev, [key]: s }))
  const okSizes = SIZES.filter((s) => states[s.key] === 'ok')
  const best = okSizes[0]
  const loading = okSizes.length + Object.values(states).filter((s) => s === 'missing').length < SIZES.length

  return (
    <div>
      <div className="stats" style={{ marginTop: 16 }}>
        <div className="stat">
          Video ID
          <b style={{ fontSize: '1.05rem', wordBreak: 'break-all' }}><Roll>{id}</Roll></b>
        </div>
        <div className="stat">
          Sizes found
          <b><Roll>{okSizes.length}</Roll>/{SIZES.length}</b>
        </div>
        <div className="stat">
          Sharpest
          <b style={{ fontSize: '1.05rem' }}>{best ? best.label : loading ? '…' : '—'}</b>
        </div>
      </div>
      {best && (
        <p className="row" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn-icon primary"
            onClick={async (e) => {
              const btn = e.currentTarget
              const saved = await savePng(thumbUrl(id, best.key), `${id}.png`)
              if (!saved) window.open(thumbUrl(id, best.key), '_blank', 'noopener')
              else {
                btn.classList.add('is-done')
                window.setTimeout(() => btn.classList.remove('is-done'), 2000)
              }
            }}
          >
            <Icon name="arrow-right" size={16} />
            Download best ({best.label})
          </button>
          <CopyButton text={thumbUrl(id, best.key)} label="Copy best URL" />
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {loading ? 'Checking every size…' : 'Full quality comes straight from YouTube — no recompression.'}
          </span>
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginTop: 6 }}>
        {SIZES.map((s, i) => (
          <ThumbCard key={`${id}-${s.key}`} id={id} size={s} index={i} onState={report} />
        ))}
      </div>
    </div>
  )
}

export default function YouTubeThumbnail() {
  const [input, setInput] = useState('')
  const id = parseVideoId(input)
  const dirty = input.trim() !== ''

  async function paste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setInput(text.trim())
    } catch {
      /* clipboard denied — the input stays focused for a manual paste */
    }
  }

  return (
    <div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…  or  youtu.be/…  or the 11-character ID"
          style={{ flex: 1, minWidth: 0 }}
          aria-label="YouTube link or video ID"
        />
        <button type="button" className="btn btn-icon" onClick={paste}>
          <Icon name="clipboard" size={16} />
          Paste
        </button>
      </div>
      {dirty && !id && <p className="error">That doesn't look like a YouTube link. Try a watch, share, or Shorts URL — or the 11-character video ID itself.</p>}
      {id && <Results key={id} id={id} />}
      {!dirty && (
        <p className="muted">
          Paste any YouTube link — watch page, <code>youtu.be</code> share, or Shorts — and every thumbnail size appears with a one-click PNG download.
          Only the video ID is sent to Google's image servers.
        </p>
      )}
    </div>
  )
}
