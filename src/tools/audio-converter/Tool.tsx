import { useEffect, useRef, useState } from 'react'
import Roll from '../../motion/Roll'
import Icon from '../../components/Icon'
import { decodeFile, downloadBlob, baseName } from '../../audio/decode'
import { encodeWav } from '../../audio/wav'
import { encodeMp3 } from '../../audio/mp3'
import { fmtBytes, fmtTime } from '../../audio/fmt'
import { describeBuffer, estimateBytes, extForFormat, labelForFormat, type AudioFacts, type OutFormat } from './convert'

interface Result {
  format: OutFormat
  blob: Blob
  name: string
}

export default function AudioConverter() {
  const [file, setFile] = useState<File | null>(null)
  const [facts, setFacts] = useState<AudioFacts | null>(null)
  const [error, setError] = useState('')
  const [decoding, setDecoding] = useState(false)
  const [format, setFormat] = useState<OutFormat>('mp3')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [done, setDone] = useState(false)
  const urlRef = useRef<string | null>(null)

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
  }, [])

  async function pick(f: File) {
    setError('')
    setResult(null)
    setDone(false)
    setFile(f)
    setDecoding(true)
    setFacts(null)
    try {
      const buf = await decodeFile(f)
      setFacts(describeBuffer(buf))
    } catch {
      setError('Could not decode that file. Try a different audio format.')
      setFile(null)
    } finally {
      setDecoding(false)
    }
  }

  async function convert() {
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    setDone(false)
    await new Promise((r) => setTimeout(r, 30))
    try {
      const buf = await decodeFile(file)
      const blob =
        format === 'mp3'
          ? encodeMp3(buf)
          : new Blob([encodeWav(buf)], { type: 'audio/wav' })
      setResult({ format, blob, name: baseName(file.name) + extForFormat(format) })
    } catch {
      setError('Conversion failed — the file may be corrupt or too large.')
    } finally {
      setBusy(false)
    }
  }

  function download() {
    if (!result) return
    downloadBlob(result.blob, result.name)
    setDone(true)
  }

  const est = facts ? estimateBytes(facts, format) : 0

  return (
    <div>
      <p className="muted">
        Re-encode audio from one format to another. Decoding and conversion happen entirely on your
        device — nothing is uploaded.
      </p>

      <div
        className="panel"
        style={{ borderStyle: 'dashed', cursor: 'pointer', textAlign: 'center' }}
        onClick={() => document.getElementById('ac-file')?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) pick(f)
        }}
      >
        <input
          id="ac-file"
          type="file"
          accept="audio/*,video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
            e.target.value = ''
          }}
        />
        <Icon name="plus" size={28} />
        <div style={{ marginTop: 8 }}>
          {decoding ? (
            <span className="busy busy-dots" aria-label="Decoding">
              <i /><i /><i />
            </span>
          ) : (
            <strong>{file ? file.name : 'Drop an audio file here or click to browse'}</strong>
          )}
        </div>
        {file && facts && <div className="muted" style={{ marginTop: 4 }}>{fmtBytes(file.size)} on disk</div>}
      </div>

      {error && <p className="error">{error}</p>}

      {facts && (
        <>
          <div className="stats" style={{ marginTop: 16 }}>
            <div className="stat">
              <Roll>{fmtTime(facts.duration)}</Roll>
              <span>Duration</span>
            </div>
            <div className="stat">
              <Roll>{facts.channels}</Roll>
              <span>Channels</span>
            </div>
            <div className="stat">
              <Roll>{facts.sampleRate.toLocaleString()}</Roll>
              <span>Sample rate / Hz</span>
            </div>
            <div className="stat">
              <Roll>{facts.samples.toLocaleString()}</Roll>
              <span>Samples</span>
            </div>
          </div>

          <div className="row" style={{ marginTop: 20, gap: 12 }}>
            {(['mp3', 'wav'] as OutFormat[]).map((f, i) => (
              <button
                key={f}
                className={'btn' + (format === f ? ' primary' : '')}
                style={{ animationDelay: `${i * 60}ms` }}
                onClick={() => {
                  setFormat(f)
                  setResult(null)
                  setDone(false)
                }}
              >
                <Icon name={f === 'mp3' ? 'music-note' : 'playlist'} size={18} />
                {labelForFormat(f)}
                <span className="muted" style={{ marginLeft: 6 }}>≈ {fmtBytes(estimateBytes(facts, f))}</span>
              </button>
            ))}
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={convert} disabled={busy}>
              {busy ? (
                <span className="busy busy-dots" aria-label="Converting"><i /><i /><i /></span>
              ) : (
                <>
                  <Icon name="reload" size={18} /> Convert to {format.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="output" style={{ marginTop: 20 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>{result.name}</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                Estimated {fmtBytes(est)} → actual {fmtBytes(result.blob.size)} ·{' '}
                {((result.blob.size / Math.max(1, file?.size ?? 1)) * 100).toFixed(0)}% of original
              </div>
            </div>
            <button className={'btn primary' + (done ? ' is-done' : '')} onClick={download}>
              <Icon name="save" size={18} /> {done ? 'Saved' : 'Download'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
