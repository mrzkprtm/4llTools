import { useEffect, useState, type DragEvent, type ReactNode } from 'react'
import Busy from '../../components/Busy'
import CopyButton from '../../components/CopyButton'
import Check from '../../motion/Check'
import { useSettled } from '../../motion/useSettled'
import './tool.css'
import type { ChainLink, Decoded, DecodedCert } from './cert'
import { CA_PEM, LEAF_PEM } from './fixtures'

type CertModule = typeof import('./cert')

interface Output {
  decoded: Decoded[]
  errors: string[]
  chain: { links: ChainLink[]; ordered: boolean } | null
}

const SAMPLE = `${LEAF_PEM}\n${CA_PEM}`

function ValidityChip({ c }: { c: DecodedCert }) {
  const now = new Date()
  if (c.notBefore > now) return <span className="chip bad">Not valid until {c.notBefore.toLocaleDateString()}</span>
  const days = Math.floor((c.notAfter.getTime() - now.getTime()) / 86_400_000)
  if (days < 0) return <span className="chip bad">Expired {-days} days ago</span>
  if (days <= 30) return <span className="chip ce-soon">{days} days left</span>
  return <span className="chip good"><Check size={14} /> {days.toLocaleString()} days left</span>
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="ce-table-wrap">
      <table className="simple ce-table">
        <tbody>
          {rows.filter(([, v]) => v !== '' && v !== null && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Links({ urls }: { urls: string[] }) {
  return <>{urls.map((u) => <div key={u} className="ce-mono">{u}</div>)}</>
}

function CertCard({ d, index, total }: { d: Decoded; index: number; total: number }) {
  if (d.kind === 'csr') {
    return (
      <article className="ce-card" style={{ animationDelay: `${index * 70}ms` }}>
        <header className="ce-head">
          <h3>{d.subjectCN}</h3>
          <span className="chip">Certificate signing request</span>
          {d.signatureValid ? <span className="chip good"><Check size={14} /> Signature valid</span> : <span className="chip bad">Signature invalid</span>}
        </header>
        <Rows rows={[
          ['Subject', <span className="ce-mono">{d.subject}</span>],
          ['Public key', d.key],
          ['Signature', d.signature],
          ['Requested names', d.sans.length ? <div className="ce-sans">{d.sans.map((s) => <span key={s} className="ce-san">{s}</span>)}</div> : ''],
        ]} />
        <p className="muted ce-small">A CSR is what you send to a certificate authority. It holds your public key and the names you want, signed with your private key.</p>
      </article>
    )
  }
  const role = d.selfIssued ? (d.isCA ? 'Root CA' : 'Self-signed') : d.isCA ? 'Intermediate CA' : total > 1 && index === 0 ? 'Leaf' : 'End-entity'
  return (
    <article className="ce-card" style={{ animationDelay: `${index * 70}ms` }}>
      <header className="ce-head">
        <h3>{d.subjectCN}</h3>
        <span className="chip">{role}</span>
        <ValidityChip c={d} />
      </header>
      <Rows rows={[
        ['Subject', <span className="ce-mono">{d.subject}</span>],
        ['Issuer', <span className="ce-mono">{d.issuer}</span>],
        ['Valid from', d.notBefore.toLocaleString()],
        ['Valid until', d.notAfter.toLocaleString()],
        ['Serial number', <span className="ce-mono">{d.serial}</span>],
        ['Public key', d.key],
        ['Signature', d.signature],
        ['Names (SAN)', d.sans.length ? <div className="ce-sans">{d.sans.map((s) => <span key={s} className="ce-san">{s}</span>)}</div> : ''],
        ['Key usage', d.keyUsage.join(', ')],
        ['Extended key usage', d.extKeyUsage.join(', ')],
        ['Basic constraints', d.basicConstraints],
        ['Policies', d.policies.join(', ')],
        ['OCSP', d.aia.ocsp.length ? <Links urls={d.aia.ocsp} /> : ''],
        ['CA issuers', d.aia.caIssuers.length ? <Links urls={d.aia.caIssuers} /> : ''],
        ['CRL', d.crl.length ? <Links urls={d.crl} /> : ''],
        ['Subject key ID', d.ski ? <span className="ce-mono">{d.ski}</span> : ''],
        ['Authority key ID', d.aki ? <span className="ce-mono">{d.aki}</span> : ''],
        ['SHA-256 fingerprint', <span className="ce-fp"><span className="ce-mono">{d.sha256}</span><CopyButton text={d.sha256} /></span>],
        ['SHA-1 fingerprint', <span className="ce-fp"><span className="ce-mono">{d.sha1}</span><CopyButton text={d.sha1} /></span>],
      ]} />
    </article>
  )
}

function Chain({ decoded, chain }: { decoded: Decoded[]; chain: NonNullable<Output['chain']> }) {
  const certs = decoded.filter((d): d is DecodedCert => d.kind === 'certificate')
  return (
    <div className="ce-chain">
      <p className="ce-chain-title">
        <b>Chain order</b>{' '}
        {chain.ordered ? <span className="chip good"><Check size={14} /> Each certificate is signed by the next</span> : <span className="chip bad">Out of order or incomplete</span>}
      </p>
      <ol className="ce-chain-list">
        {certs.map((c, i) => (
          <li key={i} style={{ animationDelay: `${i * 90}ms` }}>
            <span className="ce-node">{c.subjectCN}</span>
            {chain.links[i] && (
              <span className={`ce-link ${chain.links[i].nameMatch && chain.links[i].signatureValid !== false ? 'ok' : 'bad'}`}>
                {chain.links[i].nameMatch ? (chain.links[i].signatureValid === false ? '✗ issuer name matches but the signature does not' : '↓ issued by') : '✗ issuer is not the next certificate'}
              </span>
            )}
          </li>
        ))}
      </ol>
      {!chain.ordered && <p className="muted ce-small">Servers should send the leaf first, then each intermediate, each one signed by the next. The root is optional.</p>}
    </div>
  )
}

export default function CertificateDecoder() {
  const [mod, setMod] = useState<CertModule | null>(null)
  const [input, setInput] = useState(SAMPLE)
  const [fileBytes, setFileBytes] = useState<{ name: string; bytes: Uint8Array } | null>(null)
  const [out, setOut] = useState<Output | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [drag, setDrag] = useState(false)
  const settled = useSettled(input, 250)

  useEffect(() => {
    import('./cert').then(setMod, () => {
      setError('Could not load the certificate parser. Check your connection and reload.')
      setBusy(false)
    })
  }, [])

  useEffect(() => {
    if (!mod) return
    let off = false
    const run = async () => {
      setBusy(true)
      try {
        const items = fileBytes ? mod.splitFile(fileBytes.bytes) : mod.splitInput(input)
        if (!items.length) {
          if (!off) {
            setOut(null)
            setError('')
          }
          return
        }
        const r = await mod.decodeAll(items)
        const chain = r.certs.length > 1 ? await mod.checkChain(r.certs) : null
        if (!off) {
          setOut({ decoded: r.decoded, errors: r.errors, chain })
          setError('')
        }
      } catch (err) {
        if (!off) {
          setOut(null)
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!off) setBusy(false)
      }
    }
    void run()
    return () => {
      off = true
    }
    // Decode once typing pauses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod, settled, fileBytes])

  async function readFile(f: File | undefined) {
    if (!f) return
    const bytes = new Uint8Array(await f.arrayBuffer())
    const head = new TextDecoder().decode(bytes.slice(0, 200))
    if (head.includes('-----BEGIN')) {
      setFileBytes(null)
      setInput(new TextDecoder().decode(bytes))
    } else {
      setFileBytes({ name: f.name, bytes })
      setInput('')
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDrag(false)
    void readFile(e.dataTransfer.files[0])
  }

  return (
    <div>
      <label htmlFor="ce-in">PEM certificate(s) or CSR</label>
      <div className={`ce-drop ${drag ? 'is-drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
        <textarea
          id="ce-in"
          value={fileBytes ? `(binary DER file: ${fileBytes.name}, ${fileBytes.bytes.length} bytes)` : input}
          onChange={(e) => { setFileBytes(null); setInput(e.target.value) }}
          spellCheck={false}
          placeholder={'-----BEGIN CERTIFICATE-----\nMIID…\n-----END CERTIFICATE-----'}
          style={{ minHeight: 150 }}
        />
      </div>
      <div className="row">
        <label className="btn ce-file">
          Open .pem / .crt / .cer / .der / .csr
          <input type="file" accept=".pem,.crt,.cer,.der,.csr,.req,application/x-x509-ca-cert,application/pkix-cert" onChange={(e) => void readFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="btn" onClick={() => { setFileBytes(null); setInput(SAMPLE) }} disabled={input === SAMPLE && !fileBytes}>Load sample</button>
        <button type="button" className="btn" onClick={() => { setFileBytes(null); setInput('') }} disabled={!input && !fileBytes}>Clear</button>
      </div>

      {busy && <Busy label={mod ? 'Decoding…' : 'Loading the X.509 parser…'} />}
      {error && <p className="error" role="alert">{error}</p>}
      {out?.errors.map((e) => <p key={e} className="error">{e}</p>)}

      {out && out.decoded.length > 0 && (
        <div className="ce-results" aria-live="polite">
          {input === SAMPLE && !fileBytes && <p className="muted ce-small">Showing a made-up test chain (test.example). Paste your own certificate to decode it.</p>}
          {out.chain && <Chain decoded={out.decoded} chain={out.chain} />}
          {out.decoded.map((d, i) => <CertCard key={`${i}-${d.kind === 'certificate' ? d.sha256 : d.pem.length}`} d={d} index={i} total={out.decoded.length} />)}
        </div>
      )}

      <details className="ce-how">
        <summary>How do I get a website’s certificate?</summary>
        <p>Run this in a terminal (it prints the whole chain the server sends), then paste the output here:</p>
        <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
          <code className="output ce-cmd">openssl s_client -connect example.com:443 -servername example.com -showcerts &lt;/dev/null</code>
          <CopyButton text="openssl s_client -connect example.com:443 -servername example.com -showcerts </dev/null" />
        </div>
        <p>Or in the browser: click the padlock → Connection is secure → Certificate → Details → Export.</p>
      </details>
      <p className="muted">
        Decoding happens in your browser with @peculiar/x509; nothing is uploaded. A browser page cannot open raw TLS connections, so it cannot fetch a certificate from a hostname by itself.
        Certificates are public, but never paste a private key into any website.
      </p>
    </div>
  )
}
