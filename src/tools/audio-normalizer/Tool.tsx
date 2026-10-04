import { useState } from 'react'
import Roll from '../../motion/Roll'
import Icon from '../../components/Icon'
import { decodeFile, downloadBlob, baseName } from '../../audio/decode'
import { encodeWav, gainBuffer, peakLevel, type BufferLike } from '../../audio/wav'
import { encodeMp3 } from '../../audio/mp3'
import { fmtBytes, fmtTime } from '../../audio/fmt'
import { normalizePlan, TARGETS, type NormalizePlan } from './normalize'

interface Loaded {
  file: File
  buffer: BufferLike
}

export default function AudioNormalizer() {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [target, setTarget] = useState(-1)
  const [format, setFormat] = useState<'mp3' | 'wav'>('mp3')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null)
  const [done, setDone] = useState(false)

  const plan: NormalizePlan | null = loaded ? normalizePlan(peakLevel(loaded.buffer), target) : null

  async function pick(f: File) {
    setError('')
    setResult(null)
    setDone(false)
    try {
      const buffer = await decodeFile(f)
      setLoaded({ file: f, buffer })
    } catch {
      setError('Could not decode that file. Try a different audio format.')
      setLoaded(null)
    }
  }

  async function apply() {
    if (!loaded || !plan) return
    setBusy(true)
    setError('')
    setResult(null)
    setDone(false)
    await new Promise((r) => setTimeout(r, 30))
    try {
      const boosted = gainBuffer(loaded.buffer, plan.gain)
      const blob =
        format === 'mp3'
          ? await encodeMp3(boosted)
          : new Blob([encodeWav(boosted)], { type: 'audio/wav' })
      setResult({ blob, name: `${baseName(loaded.file.name)}-normalized.${format}` })
    } catch {
      setError('Normalization failed — the file may be corrupt.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="muted">
        Measures the peak volume of your file and applies exactly the gain needed to reach a target
        level — no compressor, no distortion.
      </p>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => document.getElementById('nz-file')?.click()}>
          <Icon name="plus" size={18} /> {loaded ? 'Choose another file' : 'Choose audio file'}
        </button>
        <input
          id="nz-file"
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
            e.target.value = ''
          }}
        />
        {loaded && (
          <span className="muted">
            {loaded.file.name} · {fmtTime(loaded.buffer.duration)}
          </span>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {loaded && plan && (
        <>
          <div className="stats" style={{ marginTop: 16 }}>
            <div className="stat">
              <Roll>{plan.peakDb === -Infinity ? '-∞' : plan.peakDb.toFixed(1)}</Roll>
              <span>Current peak / dBFS</span>
            </div>
            <div className="stat">
              <Roll>{plan.targetDb}</Roll>
              <span>Target / dBFS</span>
            </div>
            <div className="stat">
              <Roll>{plan.gain >= 1 ? `+${plan.gain.toFixed(2)}×` : `${plan.gain.toFixed(2)}×`}</Roll>
              <span>Gain applied</span>
            </div>
            <div className="stat">
              <Roll>{plan.outPeakDb === -Infinity ? '-∞' : plan.outPeakDb.toFixed(1)}</Roll>
              <span>Result peak / dBFS</span>
            </div>
          </div>

          {plan.peakDb === -Infinity && (
            <p className="error" style={{ marginTop: 12 }}>This file is silent — there is nothing to normalize.</p>
          )}
          {plan.alreadyNormalized && (
            <p className="muted" style={{ marginTop: 12 }}>
              This file is already within half a decibel of the target. Exporting is unnecessary but
              harmless.
            </p>
          )}

          <div className="two-col" style={{ marginTop: 16 }}>
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <label style={{ margin: 0 }}>
                Target level
                <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
                  {TARGETS.map((t) => (
                    <option key={t.db} value={t.db}>{t.label}</option>
                  ))}
                </select>
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
              <button
                className="btn primary"
                onClick={apply}
                disabled={busy || plan.peakDb === -Infinity}
              >
                {busy ? (
                  <span className="busy busy-dots" aria-label="Normalizing"><i /><i /><i /></span>
                ) : (
                  <>
                    <Icon name="pulse" size={18} /> Normalize
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
