import { useEffect, useState } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import Icon from '../../components/Icon'
import Check from '../../motion/Check'
import PillRow from '../../motion/PillRow'
import SettleOutput from '../../motion/SettleOutput'
import { useScramble } from '../../motion/useScramble'
import './tool.css'
import { DEFAULT_ITERATIONS, MAGIC, decryptBytes, decryptText, encryptBytes, encryptText, wrap } from './crypto'

type Tab = 'encrypt' | 'decrypt' | 'file'

const EXT = '.4lt'

function PassField({ id, value, onChange, show, setShow }: { id: string; value: string; onChange: (v: string) => void; show: boolean; setShow: (b: boolean) => void }) {
  return (
    <>
      <label htmlFor={id}>Passphrase</label>
      <div className="ae-pass">
        <input id={id} type={show ? 'text' : 'password'} className="ae-input" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="A long passphrase you can remember" />
        <button type="button" className="btn btn-icon" onClick={() => setShow(!show)} aria-pressed={show} aria-controls={id}>
          <Icon key={show ? 'a' : 'b'} name={show ? 'eye-off' : 'eye'} size={18} />
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </>
  )
}

function Scrambled({ text }: { text: string }) {
  const shown = useScramble(text, { limit: 80, duration: 500, pool: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/' })
  return <div className="output ae-out" aria-live="polite">{shown}</div>
}

export default function TextEncryption() {
  const [tab, setTab] = useState<Tab>('encrypt')
  const [pass, setPass] = useState(['kopi', 'hitam', 'tanpa', 'gula'].join(' '))
  const [show, setShow] = useState(false)
  const [plain, setPlain] = useState('Wifi password for the office: see the sticky note in the second drawer.')
  const [wrapped, setWrapped] = useState(false)
  const [cipher, setCipher] = useState('')
  const [encBusy, setEncBusy] = useState(false)
  const [encError, setEncError] = useState('')
  const [encMs, setEncMs] = useState(0)

  const [cipherIn, setCipherIn] = useState('')
  const [decPass, setDecPass] = useState('')
  const [decOut, setDecOut] = useState<string | null>(null)
  const [decBusy, setDecBusy] = useState(false)
  const [decError, setDecError] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [fileMode, setFileMode] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [fileBusy, setFileBusy] = useState(false)
  const [fileError, setFileError] = useState('')
  const [fileDone, setFileDone] = useState('')

  async function encrypt() {
    setEncBusy(true)
    setEncError('')
    const t = performance.now()
    try {
      setCipher(await encryptText(plain, pass))
      setEncMs(performance.now() - t)
    } catch (err) {
      setEncError(err instanceof Error ? err.message : String(err))
    } finally {
      setEncBusy(false)
    }
  }

  async function decrypt(input = cipherIn, p = decPass) {
    setDecBusy(true)
    setDecError('')
    setDecOut(null)
    try {
      setDecOut(await decryptText(input, p))
    } catch (err) {
      setDecError(err instanceof Error ? err.message : String(err))
    } finally {
      setDecBusy(false)
    }
  }

  useEffect(() => {
    void encrypt()
    // Show a real result on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function pickFile(f: File | null) {
    setFile(f)
    setFileError('')
    setFileDone('')
    if (!f) return
    const head = new Uint8Array(await f.slice(0, 3).arrayBuffer())
    setFileMode(MAGIC.every((b, i) => head[i] === b) ? 'decrypt' : 'encrypt')
  }

  async function runFile() {
    if (!file) return
    setFileBusy(true)
    setFileError('')
    setFileDone('')
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      const out = fileMode === 'encrypt' ? await encryptBytes(data, pass) : await decryptBytes(data, pass)
      const name = fileMode === 'encrypt' ? file.name + EXT : file.name.endsWith(EXT) ? file.name.slice(0, -EXT.length) : `decrypted-${file.name}`
      const url = URL.createObjectURL(new Blob([out as BlobPart], { type: 'application/octet-stream' }))
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setFileDone(name)
    } catch (err) {
      setFileError(err instanceof Error ? err.message : String(err))
    } finally {
      setFileBusy(false)
    }
  }

  const cipherShown = wrapped ? wrap(cipher) : cipher

  return (
    <div>
      <PillRow role="tablist" label="Mode">
        {([['encrypt', 'Encrypt text'], ['decrypt', 'Decrypt text'], ['file', 'Encrypt a file']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`btn ${tab === t ? 'primary' : ''}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </PillRow>

      {tab === 'encrypt' && (
        <div className="settle-in">
          <label htmlFor="ae-plain">Text to encrypt</label>
          <textarea id="ae-plain" value={plain} onChange={(e) => setPlain(e.target.value)} style={{ minHeight: 110 }} />
          <PassField id="ae-pass" value={pass} onChange={setPass} show={show} setShow={setShow} />
          <div className="row">
            <button type="button" className="btn primary" onClick={encrypt} disabled={encBusy || !pass}>{encBusy ? 'Encrypting…' : 'Encrypt'}</button>
          </div>
          {encBusy && <Busy label={`Deriving a key with ${DEFAULT_ITERATIONS.toLocaleString('en-US')} PBKDF2 rounds…`} />}
          {encError && <p className="error" role="alert">{encError}</p>}
          {cipher && !encBusy && (
            <div className="ae-result">
              <label>
                Encrypted (Base64) <span className="muted ae-meta">{(encMs / 1000).toFixed(2)} s · {cipher.length} chars</span>
              </label>
              <Scrambled text={cipherShown} />
              <div className="row">
                <CopyButton text={cipherShown} />
                <label className="ae-check"><input type="checkbox" checked={wrapped} onChange={(e) => setWrapped(e.target.checked)} /> Wrap at 64 chars</label>
                <button type="button" className="btn" onClick={() => { setCipherIn(cipherShown); setDecPass(''); setDecOut(null); setDecError(''); setTab('decrypt') }}>Try decrypting →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'decrypt' && (
        <div className="settle-in">
          <label htmlFor="ae-cin">Encrypted text</label>
          <textarea id="ae-cin" value={cipherIn} onChange={(e) => { setCipherIn(e.target.value); setDecOut(null); setDecError('') }} spellCheck={false} placeholder="NExUAQAJJ8A…" style={{ minHeight: 110 }} />
          <PassField id="ae-dpass" value={decPass} onChange={(v) => { setDecPass(v); setDecError('') }} show={show} setShow={setShow} />
          <div className="row">
            <button type="button" className="btn primary" onClick={() => decrypt()} disabled={decBusy || !cipherIn.trim() || !decPass}>{decBusy ? 'Decrypting…' : 'Decrypt'}</button>
          </div>
          {decBusy && <Busy label="Deriving the key and checking the passphrase…" />}
          {decError && <p className="error" role="alert">{decError}</p>}
          {decOut !== null && !decBusy && (
            <div className="ae-result">
              <p><span className="chip good"><Check size={14} /> Decrypted and verified</span></p>
              <SettleOutput value={decOut} aria-label="Decrypted text" style={{ minHeight: 100 }} />
              <div className="row"><CopyButton text={decOut} /></div>
            </div>
          )}
        </div>
      )}

      {tab === 'file' && (
        <div className="settle-in">
          <label htmlFor="ae-file">File (any type)</label>
          <input id="ae-file" type="file" onChange={(e) => void pickFile(e.target.files?.[0] ?? null)} />
          {file && (
            <p className="muted ae-meta">
              {file.name} · {(file.size / 1024).toFixed(1)} KB {fileMode === 'decrypt' && <span className="chip">Encrypted by this tool</span>}
            </p>
          )}
          {file && file.size > 200 * 1024 * 1024 && <p className="error">Files over 200 MB may run out of memory in the browser.</p>}
          <PillRow role="radiogroup" label="File action">
            <button type="button" role="radio" aria-checked={fileMode === 'encrypt'} className={`btn ${fileMode === 'encrypt' ? 'primary' : ''}`} onClick={() => setFileMode('encrypt')}>Encrypt</button>
            <button type="button" role="radio" aria-checked={fileMode === 'decrypt'} className={`btn ${fileMode === 'decrypt' ? 'primary' : ''}`} onClick={() => setFileMode('decrypt')}>Decrypt</button>
          </PillRow>
          <PassField id="ae-fpass" value={pass} onChange={setPass} show={show} setShow={setShow} />
          <div className="row">
            <button type="button" className="btn primary btn-icon" onClick={runFile} disabled={!file || !pass || fileBusy}>
              <Icon name="arrow-down" size={18} /> {fileBusy ? 'Working…' : fileMode === 'encrypt' ? `Encrypt & download ${EXT}` : 'Decrypt & download'}
            </button>
          </div>
          {fileBusy && <div className="bar busy-bar"><i style={{ transform: 'scaleX(0.5)' }} /></div>}
          {fileError && <p className="error" role="alert">{fileError}</p>}
          {fileDone && <p><span className="chip good"><Check size={14} /> Saved {fileDone}</span></p>}
        </div>
      )}

      <p className="muted">
        AES-256-GCM with a key from PBKDF2-SHA-256 ({DEFAULT_ITERATIONS.toLocaleString('en-US')} rounds, per OWASP) and a random salt and IV every time. The output holds everything needed to decrypt except the passphrase,
        and any change to it is detected. It all runs in your browser with Web Crypto; nothing is uploaded. There is no way to recover data if you forget the passphrase.
      </p>
    </div>
  )
}
