import { useEffect, useState } from 'react'
import CopyButton from '../../components/CopyButton'
import { KEY_SIZES, generateRsaKeys, type GeneratedKeys, type KeySize, type Purpose } from './rsa'

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/x-pem-file' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

function KeyBlock({ title, text, file }: { title: string; text: string; file: string }) {
  return (
    <div style={{ minWidth: 0, animation: 'rsa-in .25s ease-out' }}>
      <label>{title}</label>
      <pre className="output" style={{ whiteSpace: 'pre', overflowX: 'auto', wordBreak: 'normal', margin: 0, maxHeight: 280, fontSize: '0.78rem' }}>{text}</pre>
      <div className="row" style={{ marginTop: 8 }}>
        <CopyButton text={text} />
        <button type="button" className="btn" onClick={() => download(file, text)}>Download {file}</button>
      </div>
    </div>
  )
}

export default function RsaKeyGenerator() {
  const [bits, setBits] = useState<KeySize>(2048)
  const [purpose, setPurpose] = useState<Purpose>('sign')
  const [comment, setComment] = useState('user@host')
  const [keys, setKeys] = useState<GeneratedKeys | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setBusy(true)
    setError('')
    try {
      // Let the spinner paint before the (blocking in some browsers) key generation starts.
      await new Promise((r) => setTimeout(r, 30))
      setKeys(await generateRsaKeys(bits, purpose, comment))
    } catch (err) {
      setError(`Could not generate keys: ${err instanceof Error ? err.message : String(err)}. Your browser may not support WebCrypto RSA (it needs HTTPS).`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    // Show a real 2048-bit key pair on first load.
    void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <style>{`@keyframes rsa-spin{to{transform:rotate(360deg)}}@keyframes rsa-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <div className="two-col">
        <div>
          <label htmlFor="rsa-bits">Key size</label>
          <select id="rsa-bits" value={bits} onChange={(e) => setBits(Number(e.target.value) as KeySize)}>
            {KEY_SIZES.map((b) => <option key={b} value={b}>{b} bits{b === 2048 ? ' (fast, common)' : b === 4096 ? ' (strongest, slow)' : ''}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rsa-purpose">Purpose</label>
          <select id="rsa-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as Purpose)}>
            <option value="sign">Signing / SSH / JWT (RSASSA-PKCS1-v1_5, SHA-256)</option>
            <option value="encrypt">Encryption (RSA-OAEP, SHA-256)</option>
          </select>
        </div>
      </div>
      <label htmlFor="rsa-comment">SSH key comment</label>
      <input id="rsa-comment" type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="user@host" />
      <div className="row">
        <button type="button" className="btn primary" onClick={generate} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {busy && <span aria-hidden style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'rsa-spin .7s linear infinite', display: 'inline-block' }} />}
          {busy ? `Generating ${bits}-bit key…` : keys ? 'Generate new key pair' : 'Generate key pair'}
        </button>
        {busy && bits === 4096 && <span className="muted" role="status">4096-bit keys can take a few seconds.</span>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {keys && (
        <div style={{ opacity: busy ? 0.5 : 1, transition: 'opacity .2s' }}>
          <p className="ok" style={{ margin: '4px 0' }}>
            ✓ {keys.bits}-bit {keys.algorithm} key pair made in {(keys.ms / 1000).toFixed(2)} s
          </p>
          <label>SSH fingerprint</label>
          <div className="output" style={{ fontSize: '0.85rem' }}>{keys.fingerprint}</div>
          <KeyBlock title="OpenSSH public key (for ~/.ssh/authorized_keys)" text={keys.sshPublic} file="id_rsa.pub" />
          <div className="two-col">
            <KeyBlock title="Private key (PKCS#8 PEM)" text={keys.privatePem} file="private.pem" />
            <KeyBlock title="Public key (SPKI PEM)" text={keys.publicPem} file="public.pem" />
          </div>
        </div>
      )}
      <p className="muted">
        Keys are generated with your browser's WebCrypto and never leave this page. The private key is PKCS#8 PEM (<code>BEGIN PRIVATE KEY</code>), not the
        OpenSSH private key format; modern OpenSSH reads it directly (<code>chmod 600 private.pem</code>, then <code>ssh -i private.pem</code>), and{' '}
        <code>ssh-keygen -y -f private.pem</code> prints its public key. Keep the private key secret and store it safely.
      </p>
    </div>
  )
}
