import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import Icon from '../../components/Icon'
import { decodeFile, downloadBlob } from '../../audio/decode'
import { encodeMp3 } from '../../audio/mp3'
import { fmtBytes, fmtTime } from '../../audio/fmt'
import { estimateMp3Size, mp3Name, qualityHint, QUALITIES } from './extract'

interface Loaded {
  file: File
  duration: number
  channels: number
  sampleRate: number
}

export default function VideoToMp3() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [kbps, setKbps] = useState<number>(128)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string; url: string } | null>(null)
  const [done, setDone] = useState(false)
  const urlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  async function pick(f: File) {
    setError('')
    setResult(null)
    setDone(false)
    setBusy(true)
    try {
      const buffer = await decodeFile(f)
      setLoaded({
        file: f,
        duration: buffer.duration,
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
      })
    } catch {
      setError('Could not read an audio track from that file. Try an MP4, WebM or MOV.')
      setLoaded(null)
    } finally {
      setBusy(false)
    }
  }

  async function extract() {
    if (!loaded) return
    setBusy(true)
    setError('')
    setResult(null)
    setDone(false)
    await new Promise((r) => setTimeout(r, 30))
    try {
      const buffer = await decodeFile(loaded.file)
      const blob = encodeMp3(buffer, kbps)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      const url = URL.createObjectURL(blob)
      urlRef.current = url
      setResult({ blob, name: mp3Name(loaded.file.name), url })
    } catch {
      setError('Extraction failed — the file may be corrupt.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="muted">
        Pull the sound out of a video file and save it as MP3. The video is decoded on your device —
        nothing is uploaded anywhere.
      </p>

      <div
        className="panel"
        style={{ borderStyle: 'dashed', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => document.getElementById('v2a-file')?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) pick(f)
        }}
      >
        <input
          id="v2a-file"
          type="file"
          accept="video/*,audio/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
            e.target.value = ''
          }}
        />
        <Icon name="video" size={28} />
        <div style={{ marginTop: 8 }}>
          {busy && !loaded ? (
            <span className="busy busy-dots" aria-label="Reading file"><i /><i /><i /></span>
          ) : (
            <strong>{loaded ? loaded.file.name : 'Drop a video here or click to browse'}</strong>
          )}
        </div>
        {loaded && <div className="muted" style={{ marginTop: 4 }}>{fmtBytes(loaded.file.size)} on disk</div>}
      </div>

      {error && <p className="error">{error}</p>}

      {loaded && (
        <>
          <div className="stats" style={{ marginTop: 16 }}>
            <div className="stat">
              <Roll>{fmtTime(loaded.duration)}</Roll>
              <span>Audio length</span>
            </div>
            <div className="stat">
              <Roll>{loaded.channels}</Roll>
              <span>Channels</span>
            </div>
            <div className="stat">
              <Roll>{loaded.sampleRate.toLocaleString()}</Roll>
              <span>Sample rate / Hz</span>
            </div>
            <div className="stat">
              <Roll>{fmtBytes(estimateMp3Size(loaded.duration, kbps))}</Roll>
              <span>Est. MP3 size</span>
            </div>
          </div>

          <div className="row" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
            {QUALITIES.map((q, i) => (
              <button
                key={q}
                className={'btn' + (kbps === q ? ' primary' : '')}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => {
                  setKbps(q)
                  setResult(null)
                  setDone(false)
                }}
              >
                <Icon name="music-note" size={16} /> {q} kbps
              </button>
            ))}
            <span className="muted" style={{ alignSelf: 'center' }}>{qualityHint(kbps)}</span>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={extract} disabled={busy}>
              {busy ? (
                <span className="busy busy-dots" aria-label="Extracting"><i /><i /><i /></span>
              ) : (
                <>
                  <Icon name="music-note" size={18} /> Extract MP3
                </>
              )}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="output" style={{ marginTop: 20, display: 'grid', gap: 12 }}>
          <audio controls src={result.url} style={{ width: '100%' }} />
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{result.name}</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                {fmtBytes(result.blob.size)} · {kbps} kbps
                {loaded && ` · ${Math.max(1, Math.round((result.blob.size / loaded.file.size) * 100))}% of video size`}
              </div>
            </div>
            <button
              className={'btn primary' + (done ? ' is-done' : '')}
              onClick={() => {
                downloadBlob(result.blob, result.name)
                setDone(true)
              }}
            >
              <Icon name="save" size={18} /> {done ? 'Saved' : 'Download MP3'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
