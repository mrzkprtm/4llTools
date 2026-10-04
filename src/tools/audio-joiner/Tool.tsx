import { useState } from 'react'
import Roll from '../../motion/Roll'
import Icon from '../../components/Icon'
import { decodeFile, downloadBlob } from '../../audio/decode'
import { concatBuffers, encodeWav, type BufferLike } from '../../audio/wav'
import { resampleLinear } from '../../audio/resample'
import { encodeMp3 } from '../../audio/mp3'
import { fmtBytes, fmtTime } from '../../audio/fmt'
import { clampGap, moveItem, outputName, totalDuration } from './join'

interface Clip {
  id: number
  name: string
  buffer: BufferLike
}

let nextId = 1

export default function AudioJoiner() {
  const [clips, setClips] = useState<Clip[]>([])
  const [gap, setGap] = useState(0)
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const [done, setDone] = useState(false)

  const total = totalDuration(clips.map((c) => ({ id: c.id, name: c.name, duration: c.buffer.duration })))

  async function add(files: FileList | null) {
    if (!files) return
    setError('')
    setResult(null)
    setDone(false)
    for (const file of Array.from(files)) {
      try {
        const buffer = await decodeFile(file)
        setClips((prev) => [...prev, { id: nextId++, name: file.name, buffer }])
      } catch {
        setError(`Could not decode ${file.name} — skipped.`)
      }
    }
  }

  async function join() {
    if (clips.length === 0) return
    setBusy(true)
    setError('')
    setResult(null)
    setDone(false)
    await new Promise((r) => setTimeout(r, 30))
    try {
      const targetRate = clips[0].buffer.sampleRate
      const parts = clips.map((c) => c.buffer)
      const gapped =
        gap > 0
          ? [
              ...parts.flatMap((p, i) =>
                i < parts.length - 1 ? [p, silentBuffer(targetRate, gap)] : [p],
              ),
            ]
          : parts
      const merged = concatBuffers(gapped, resampleLinear)
      const blob =
        format === 'mp3'
          ? await encodeMp3(merged)
          : new Blob([encodeWav(merged)], { type: 'audio/wav' })
      setResult({ blob, name: outputName(clips[0].name, clips.length, format) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Join failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="muted">
        Add clips in the order you want them played, rearrange as needed, and export a single file.
      </p>

      <div
        className="panel"
        style={{ borderStyle: 'dashed', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => document.getElementById('aj-files')?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          add(e.dataTransfer.files)
        }}
      >
        <input
          id="aj-files"
          type="file"
          accept="audio/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
        <Icon name="plus" size={28} />
        <div style={{ marginTop: 8 }}>
          <strong>Drop audio clips here or click to add</strong>
        </div>
        <div className="muted" style={{ marginTop: 4 }}>You can add several files at once</div>
      </div>

      {error && <p className="error">{error}</p>}

      {clips.length > 0 && (
        <>
          <ol style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 8 }}>
            {clips.map((clip, i) => (
              <li
                key={clip.id}
                className="panel row"
                style={{ gap: 8, alignItems: 'center', animationDelay: `${i * 40}ms`, margin: 0, padding: '8px 12px' }}
              >
                <span className="chip">{i + 1}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {clip.name}
                </span>
                <span className="muted">{fmtTime(clip.buffer.duration)}</span>
                <button className="btn-icon" aria-label={`Move ${clip.name} up`} disabled={i === 0} onClick={() => setClips((c) => moveItem(c, i, i - 1))}>
                  <Icon name="chevron-up" size={16} />
                </button>
                <button className="btn-icon" aria-label={`Move ${clip.name} down`} disabled={i === clips.length - 1} onClick={() => setClips((c) => moveItem(c, i, i + 1))}>
                  <Icon name="chevron-down" size={16} />
                </button>
                <button className="btn-icon" aria-label={`Remove ${clip.name}`} onClick={() => setClips((c) => c.filter((x) => x.id !== clip.id))}>
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ol>

          <div className="stats" style={{ marginTop: 16 }}>
            <div className="stat">
              <Roll>{clips.length}</Roll>
              <span>Clips</span>
            </div>
            <div className="stat">
              <Roll>{fmtTime(total + clampGap(gap) * Math.max(0, clips.length - 1))}</Roll>
              <span>Total length</span>
            </div>
            <div className="stat">
              <Roll>{clampGap(gap).toFixed(1)}</Roll>
              <span>Gap / s</span>
            </div>
          </div>

          <div className="two-col" style={{ marginTop: 16 }}>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label style={{ margin: 0 }}>
                Gap between clips (s)
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={gap}
                  onChange={(e) => setGap(clampGap(Number(e.target.value)))}
                />
              </label>
              <label style={{ margin: 0 }}>
                Format
                <select value={format} onChange={(e) => setFormat(e.target.value as 'mp3' | 'wav')}>
                  <option value="mp3">MP3 · 128 kbps</option>
                  <option value="wav">WAV · 16-bit PCM</option>
                </select>
              </label>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={join} disabled={busy || clips.length === 0}>
                {busy ? (
                  <span className="busy busy-dots" aria-label="Joining"><i /><i /><i /></span>
                ) : (
                  <>
                    <Icon name="playlist" size={18} /> Join {clips.length > 1 ? `${clips.length} clips` : 'clip'}
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {result && (
        <div className="output" style={{ marginTop: 20 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{result.name}</strong>
              <div className="muted" style={{ marginTop: 4 }}>{fmtBytes(result.blob.size)}</div>
            </div>
            <button
              className={'btn primary' + (done ? ' is-done' : '')}
              onClick={() => {
                downloadBlob(result.blob, result.name)
                setDone(true)
              }}
            >
              <Icon name="save" size={18} /> {done ? 'Saved' : 'Download'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function silentBuffer(sampleRate: number, seconds: number): BufferLike {
  const length = Math.max(1, Math.round(sampleRate * seconds))
  const channel = new Float32Array(length)
  return {
    numberOfChannels: 1,
    length,
    sampleRate,
    duration: seconds,
    getChannelData: () => channel,
  }
}
