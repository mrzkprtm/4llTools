import { useMemo, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Roll from '../../motion/Roll'
import { parseVideoId } from '../youtube-thumbnail/yt'
import { fmtStamp, parseChapters, stampLink, toMarkdown, toYoutubeText } from './links'

const EXAMPLE = '0:00 Intro\n1:23 The setup\n4:56 The payoff\n1:07:30 Finale'

export default function YouTubeTimestamp() {
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const id = parseVideoId(url)
  const dirty = url.trim() !== ''
  const chapters = useMemo(() => parseChapters(text), [text])
  const skipped = useMemo(
    () => text.split('\n').filter((l) => l.trim() && !/^(\d+(?::[0-5]?\d){0,2})\s+.+$/.test(l.trim())).length,
    [text],
  )

  async function pasteUrl() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setUrl(t.trim())
    } catch {
      /* clipboard denied — manual paste still works */
    }
  }

  const single = (t: number) => (id ? stampLink(id, t) : `…?t=${t}`)

  return (
    <div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="YouTube link — watch, youtu.be, or Shorts"
          style={{ flex: 1, minWidth: 0 }}
          aria-label="YouTube link"
        />
        <button type="button" className="btn btn-icon" onClick={pasteUrl}>
          <Icon name="clipboard" size={16} />
          Paste
        </button>
      </div>
      {dirty && !id && <p className="error">That doesn't look like a YouTube link — a watch, share, or Shorts URL works best.</p>}

      <label htmlFor="chapters">Chapters — one per line as <code>time title</code></label>
      <textarea
        id="chapters"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        style={{ minHeight: 130 }}
      />
      <p className="muted" style={{ marginTop: 6, fontSize: '0.85rem' }}>
        Times can be <code>1:23</code>, <code>1:02:03</code>, plain seconds, or written units like <code>2 minutes</code>.
      </p>
      {skipped > 0 && <p className="error">{skipped} line{skipped > 1 ? 's' : ''} couldn't be read — use <code>time title</code> with the time first.</p>}

      {chapters.length > 0 && (
        <>
          <div className="stats">
            <div className="stat">
              Chapters
              <b><Roll>{chapters.length}</Roll></b>
            </div>
            <div className="stat">
              First stamp
              <b style={{ fontSize: '1.15rem' }}>{fmtStamp(chapters[0].time)}</b>
            </div>
            <div className="stat">
              Last stamp
              <b style={{ fontSize: '1.15rem' }}>{fmtStamp(chapters[chapters.length - 1].time)}</b>
            </div>
          </div>

          {!id && <p className="muted" style={{ marginTop: 12 }}>Add a YouTube link above to turn each row into a clickable deep link.</p>}

          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table className="simple">
              <thead>
                <tr><th>Time</th><th>Title</th><th style={{ width: '38%' }}>Link</th><th /></tr>
              </thead>
              <tbody>
                {chapters.map((c, i) => (
                  <tr key={`${c.time}-${c.label}`} style={{ animationDelay: `${i * 30}ms` }}>
                    <td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}><b>{fmtStamp(c.time)}</b></td>
                    <td>{c.label}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                      {id ? <a href={single(c.time)} target="_blank" rel="noreferrer">{single(c.time)}</a> : <span className="muted">—</span>}
                    </td>
                    <td>{id && <CopyButton text={single(c.time)} label="Copy" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row">
            <CopyButton text={toYoutubeText(chapters)} label="Copy for YouTube description" />
            <CopyButton text={id ? toMarkdown(id, chapters) : toYoutubeText(chapters)} label={id ? 'Copy as Markdown' : 'Copy as text'} />
          </div>
        </>
      )}

      {!text.trim() && (
        <p className="muted">
          Paste a chapter list (or type one) and every row becomes a link that jumps straight to that moment —
          recipients start watching where you want them to.
        </p>
      )}

      {text.trim() && chapters.length === 0 && !skipped && (
        <p className="muted">Start a line with a time — for example <code>{EXAMPLE.split('\n')[1]}</code> — followed by the chapter title.</p>
      )}
    </div>
  )
}
