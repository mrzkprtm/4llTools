import { useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { parseVideoId } from '../youtube-thumbnail/yt'
import { extractChannel, extractTags, extractTitle, fetchWatchHtml, toHashtags, toPlain } from './tags'

type Status = 'idle' | 'busy' | 'done' | 'error'

export default function YouTubeTags() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [tags, setTags] = useState<string[]>([])
  const [title, setTitle] = useState<string | null>(null)
  const [channel, setChannel] = useState<string | null>(null)
  const [error, setError] = useState('')
  const id = parseVideoId(url)

  async function extract() {
    if (!id || status === 'busy') return
    setStatus('busy')
    setError('')
    try {
      const html = await fetchWatchHtml(id)
      const found = extractTags(html)
      setTags(found)
      setTitle(extractTitle(html))
      setChannel(extractChannel(html))
      setStatus('done')
      if (found.length === 0) setError('This video publishes no keyword tags — many newer videos leave them empty.')
    } catch {
      setStatus('error')
      setError("Couldn't reach YouTube through the proxy. Check your connection and try again.")
    }
  }

  async function paste() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setUrl(t.trim())
    } catch {
      /* clipboard denied */
    }
  }

  return (
    <div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          style={{ flex: 1, minWidth: 0 }}
          aria-label="YouTube link"
          onKeyDown={(e) => e.key === 'Enter' && extract()}
        />
        <button type="button" className="btn btn-icon" onClick={paste}>
          <Icon name="clipboard" size={16} />
          Paste
        </button>
        <button type="button" className="btn btn-icon primary" onClick={extract} disabled={!id || status === 'busy'}>
          <Icon name="tag" size={16} />
          Extract tags
        </button>
      </div>
      {url.trim() && !id && <p className="error">That doesn't look like a YouTube link.</p>}
      {status === 'busy' && (
        <p className="busy">
          <span className="busy-dots"><i /><i /><i /></span>
          Fetching the watch page…
        </p>
      )}
      {error && status !== 'busy' && <p className={status === 'error' ? 'error' : 'muted'}>{error}</p>}

      {status === 'done' && tags.length > 0 && (
        <>
          {(title || channel) && (
            <div className="output" style={{ marginBottom: 12 }}>
              {title && <div><b>{title}</b></div>}
              {channel && <div className="muted" style={{ fontSize: '0.82rem' }}>{channel}</div>}
            </div>
          )}
          <div className="stats">
            <div className="stat">
              Tags
              <b><Roll>{tags.length}</Roll></b>
            </div>
            <div className="stat">
              Characters
              <b><Roll>{toPlain(tags).length}</Roll></b>
            </div>
            <div className="stat">
              Limit left
              <b><Roll>{Math.max(0, 500 - toPlain(tags).length)}</Roll></b>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {tags.map((t, i) => (
              <button
                key={t}
                type="button"
                className="chip"
                style={{ cursor: 'copy', animationDelay: `${Math.min(i, 14) * 35}ms` }}
                title="Click to copy"
                onClick={(e) => {
                  void navigator.clipboard.writeText(t)
                  const el = e.currentTarget
                  el.classList.add('good')
                  window.setTimeout(() => el.classList.remove('good'), 900)
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="row">
            <CopyButton text={toPlain(tags)} label="Copy comma-separated" />
            <CopyButton text={toHashtags(tags)} label="Copy as hashtags" />
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>Click a tag to copy it on its own. YouTube allows about 500 characters of tags per video.</p>
        </>
      )}

      {status === 'idle' && (
        <p className="muted">
          Creators hide their tags in the page source — this tool fetches the watch page and pulls them out,
          ready to paste into YouTube Studio. Only the video ID leaves your browser.
        </p>
      )}
    </div>
  )
}
