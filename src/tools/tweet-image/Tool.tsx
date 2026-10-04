import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { CARD, THEMES, type ThemeName, type TweetOpts, drawTweet, initialsFrom } from './tweet'

function savePng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }, 'image/png')
}

export default function TweetImage() {
  const [opts, setOpts] = useState<TweetOpts>({
    name: 'Grace Hopper',
    handle: 'gracehopper',
    timeLabel: '2h',
    text: 'The most dangerous phrase in the language is: we have always done it this way.',
    avatarBg: '#7c3aed',
    avatarImg: null,
    verified: true,
    replies: '128',
    retweets: '1.4K',
    likes: '12K',
    theme: 'light',
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) drawTweet(ctx, opts)
  }, [opts])

  const set = <K extends keyof TweetOpts>(key: K, value: TweetOpts[K]) => setOpts((o) => ({ ...o, [key]: value }))

  function onAvatarFile(file: File | null) {
    if (!file) return
    const img = new Image()
    img.onload = () => set('avatarImg', img)
    img.src = URL.createObjectURL(file)
  }

  return (
    <div>
      <div className="two-col">
        <div>
          <div className="row" style={{ marginTop: 0 }}>
            <span style={{ flex: 2, minWidth: 140 }}>
              <label htmlFor="t-name" style={{ marginTop: 0 }}>Name</label>
              <input id="t-name" type="text" value={opts.name} maxLength={30} onChange={(e) => set('name', e.target.value)} />
            </span>
            <span style={{ flex: 2, minWidth: 140 }}>
              <label htmlFor="t-handle" style={{ marginTop: 0 }}>Handle</label>
              <input id="t-handle" type="text" value={opts.handle} maxLength={30} onChange={(e) => set('handle', e.target.value)} />
            </span>
            <span style={{ flex: 1, minWidth: 70 }}>
              <label htmlFor="t-time" style={{ marginTop: 0 }}>Posted</label>
              <input id="t-time" type="text" value={opts.timeLabel} maxLength={12} onChange={(e) => set('timeLabel', e.target.value)} />
            </span>
          </div>

          <label htmlFor="t-text">Post text</label>
          <textarea id="t-text" value={opts.text} maxLength={560} onChange={(e) => set('text', e.target.value)} style={{ minHeight: 110 }} />

          <div className="row" style={{ alignItems: 'flex-end' }}>
            <span style={{ flex: 1 }}>
              <label htmlFor="t-avatar" style={{ marginTop: 0 }}>Avatar image</label>
              <input id="t-avatar" type="file" accept="image/*" onChange={(e) => onAvatarFile(e.target.files?.[0] ?? null)} />
            </span>
            {!opts.avatarImg && (
              <span style={{ width: 56 }}>
                <label htmlFor="t-avcolor" style={{ marginTop: 0 }}>or {initialsFrom(opts.name)}</label>
                <input id="t-avcolor" type="color" value={opts.avatarBg} onChange={(e) => set('avatarBg', e.target.value)} style={{ width: '100%', height: 40, padding: 0, border: 'none', background: 'none' }} aria-label="Avatar colour" />
              </span>
            )}
          </div>
          {opts.avatarImg && (
            <button type="button" className="btn" onClick={() => set('avatarImg', null)} style={{ marginTop: 6 }}>
              Remove image avatar
            </button>
          )}

          <div className="row">
            <span style={{ flex: 1, minWidth: 90 }}>
              <label htmlFor="t-replies" style={{ marginTop: 0 }}>Replies</label>
              <input id="t-replies" type="text" value={opts.replies} maxLength={10} onChange={(e) => set('replies', e.target.value)} />
            </span>
            <span style={{ flex: 1, minWidth: 90 }}>
              <label htmlFor="t-retweets" style={{ marginTop: 0 }}>Reposts</label>
              <input id="t-retweets" type="text" value={opts.retweets} maxLength={10} onChange={(e) => set('retweets', e.target.value)} />
            </span>
            <span style={{ flex: 1, minWidth: 90 }}>
              <label htmlFor="t-likes" style={{ marginTop: 0 }}>Likes</label>
              <input id="t-likes" type="text" value={opts.likes} maxLength={10} onChange={(e) => set('likes', e.target.value)} />
            </span>
          </div>

          <div className="row" style={{ alignItems: 'center' }}>
            <label htmlFor="t-theme" style={{ margin: 0 }}>Theme</label>
            <select id="t-theme" value={opts.theme} onChange={(e) => set('theme', e.target.value as ThemeName)} style={{ flex: 1 }}>
              {Object.keys(THEMES).map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
            <label className="row" style={{ margin: 0, fontWeight: 400, gap: 6 }}>
              <input type="checkbox" checked={opts.verified} onChange={(e) => set('verified', e.target.checked)} />
              Verified
            </label>
          </div>
        </div>

        <div>
          <canvas
            ref={canvasRef}
            width={CARD}
            height={CARD}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
            aria-label="Post card preview"
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 6 }}>
            Square {CARD}×{CARD} card — sized for feeds that crop vertical screenshots.
          </p>
        </div>
      </div>

      <div className="row">
        <button
          type="button"
          className={`btn btn-icon primary ${saved ? 'is-done' : ''}`}
          onClick={() => {
            if (canvasRef.current) {
              savePng(canvasRef.current, 'post-card.png')
              setSaved(true)
              window.setTimeout(() => setSaved(false), 2000)
            }
          }}
        >
          <Icon name={saved ? 'clipboard-check' : 'arrow-right'} size={16} />
          {saved ? 'Saved!' : 'Download PNG'}
        </button>
        <span className="muted" style={{ fontSize: '0.85rem' }}>Made-up quotes only — don't impersonate real people.</span>
      </div>
    </div>
  )
}
