import './reflect-shim'
import {
  AuthorityInfoAccessExtension,
  BasicConstraintsExtension,
  CRLDistributionPointsExtension,
  CertificatePolicyExtension,
  ExtendedKeyUsageExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  PemConverter,
  Pkcs10CertificateRequest,
  SubjectAlternativeNameExtension,
  SubjectKeyIdentifierExtension,
  AuthorityKeyIdentifierExtension,
  X509Certificate,
  type PublicKey,
} from '@peculiar/x509'

export interface Field {
  label: string
  value: string
}

export interface DecodedCert {
  kind: 'certificate'
  subject: string
  subjectCN: string
  issuer: string
  issuerCN: string
  serial: string
  notBefore: Date
  notAfter: Date
  key: string
  signature: string
  sans: string[]
  keyUsage: string[]
  extKeyUsage: string[]
  basicConstraints: string
  isCA: boolean
  selfIssued: boolean
  aia: { ocsp: string[]; caIssuers: string[] }
  crl: string[]
  policies: string[]
  ski: string
  aki: string
  sha1: string
  sha256: string
  pem: string
}

export interface DecodedCsr {
  kind: 'csr'
  subject: string
  subjectCN: string
  key: string
  signature: string
  sans: string[]
  signatureValid: boolean
  pem: string
}

export type Decoded = DecodedCert | DecodedCsr

const EKU_NAMES: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': 'TLS server authentication',
  '1.3.6.1.5.5.7.3.2': 'TLS client authentication',
  '1.3.6.1.5.5.7.3.3': 'Code signing',
  '1.3.6.1.5.5.7.3.4': 'Email protection (S/MIME)',
  '1.3.6.1.5.5.7.3.8': 'Time stamping',
  '1.3.6.1.5.5.7.3.9': 'OCSP signing',
  '1.3.6.1.4.1.311.10.3.3': 'Microsoft Server Gated Crypto',
  '2.16.840.1.113730.4.1': 'Netscape Server Gated Crypto',
}

const POLICY_NAMES: Record<string, string> = {
  '2.23.140.1.2.1': 'Domain validated (DV)',
  '2.23.140.1.2.2': 'Organization validated (OV)',
  '2.23.140.1.2.3': 'Individual validated (IV)',
  '2.23.140.1.1': 'Extended validation (EV)',
}

const CURVES: Record<string, string> = { 'P-256': 'P-256 (secp256r1)', 'P-384': 'P-384 (secp384r1)', 'P-521': 'P-521 (secp521r1)' }

export function hex(buf: ArrayBuffer | Uint8Array, sep = ':'): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(sep)
}

function describeKey(pk: PublicKey): string {
  const a = pk.algorithm as Algorithm & { modulusLength?: number; namedCurve?: string }
  if (a.name.startsWith('RSA')) return `RSA ${a.modulusLength ?? '?'} bits`
  if (a.name === 'ECDSA' || a.name === 'ECDH') return `EC ${CURVES[a.namedCurve ?? ''] ?? a.namedCurve ?? ''}`.trim()
  return a.name
}

function describeSig(alg: Algorithm & { hash?: Algorithm | string }): string {
  const hash = typeof alg.hash === 'string' ? alg.hash : alg.hash?.name
  const name = alg.name === 'RSASSA-PKCS1-v1_5' ? 'RSA' : alg.name === 'RSA-PSS' ? 'RSA-PSS' : alg.name
  return hash ? `${hash.replace('-', '')} with ${name}` : name
}

function cn(dn: string): string {
  const m = dn.match(/(?:^|,\s*)CN=((?:\\,|[^,])+)/)
  return m ? m[1].replace(/\\,/g, ',') : dn
}

function keyUsages(flags: number): string[] {
  return Object.entries(KeyUsageFlags)
    .filter(([name, bit]) => typeof bit === 'number' && isNaN(Number(name)) && flags & bit)
    .map(([name]) => name)
}

function sanList(ext: SubjectAlternativeNameExtension | null): string[] {
  return ext ? ext.names.items.map((n) => `${n.type.toUpperCase()}: ${n.value}`) : []
}

function csrSans(csr: Pkcs10CertificateRequest): string[] {
  const ext = csr.extensions.find((e) => e.type === '2.5.29.17')
  if (!ext) return []
  return sanList(ext instanceof SubjectAlternativeNameExtension ? ext : new SubjectAlternativeNameExtension(ext.rawData))
}

function uris(names: { type: string; value: string }[]): string[] {
  return names.filter((n) => n.type === 'url').map((n) => n.value)
}

export async function decodeCert(cert: X509Certificate): Promise<DecodedCert> {
  const bc = cert.getExtension(BasicConstraintsExtension)
  const ku = cert.getExtension(KeyUsagesExtension)
  const eku = cert.getExtension(ExtendedKeyUsageExtension)
  const aia = cert.getExtension(AuthorityInfoAccessExtension)
  const crl = cert.getExtension(CRLDistributionPointsExtension)
  const pol = cert.getExtension(CertificatePolicyExtension)
  const ski = cert.getExtension(SubjectKeyIdentifierExtension)
  const aki = cert.getExtension(AuthorityKeyIdentifierExtension)
  const crlUrls = (crl?.distributionPoints ?? []).flatMap((dp) => (dp.distributionPoint?.fullName ?? []).map((g) => g.uniformResourceIdentifier).filter((u): u is string => !!u))
  return {
    kind: 'certificate',
    subject: cert.subject,
    subjectCN: cn(cert.subject),
    issuer: cert.issuer,
    issuerCN: cn(cert.issuer),
    serial: cert.serialNumber.toUpperCase(),
    notBefore: cert.notBefore,
    notAfter: cert.notAfter,
    key: describeKey(cert.publicKey),
    signature: describeSig(cert.signatureAlgorithm as Algorithm),
    sans: sanList(cert.getExtension(SubjectAlternativeNameExtension)),
    keyUsage: ku ? keyUsages(ku.usages) : [],
    extKeyUsage: eku ? eku.usages.map((u) => EKU_NAMES[String(u)] ?? String(u)) : [],
    basicConstraints: bc ? (bc.ca ? `CA${bc.pathLength !== undefined ? `, path length ${bc.pathLength}` : ''}` : 'Not a CA (end-entity)') : '(not present)',
    isCA: !!bc?.ca,
    selfIssued: cert.subject === cert.issuer,
    aia: { ocsp: aia ? uris(aia.ocsp) : [], caIssuers: aia ? uris(aia.caIssuers) : [] },
    crl: crlUrls,
    policies: pol ? pol.policies.map((p) => POLICY_NAMES[p] ?? p) : [],
    ski: ski?.keyId.toUpperCase() ?? '',
    aki: aki?.keyId?.toUpperCase() ?? '',
    sha1: hex(await cert.getThumbprint('SHA-1')),
    sha256: hex(await cert.getThumbprint('SHA-256')),
    pem: cert.toString('pem'),
  }
}

export async function decodeCsr(csr: Pkcs10CertificateRequest): Promise<DecodedCsr> {
  let valid = false
  try {
    valid = await csr.verify()
  } catch {
    valid = false
  }
  return {
    kind: 'csr',
    subject: csr.subject,
    subjectCN: cn(csr.subject),
    key: describeKey(csr.publicKey),
    signature: describeSig(csr.signatureAlgorithm as Algorithm),
    sans: csrSans(csr),
    signatureValid: valid,
    pem: csr.toString('pem'),
  }
}

const PEM_RE = /-----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END \1-----/g

/** Splits pasted text (one or more PEM blocks, or bare Base64 DER) into DER buffers with their PEM label. */
export function splitInput(input: string): { label: string; der: ArrayBuffer }[] {
  const text = input.trim()
  if (!text) return []
  const blocks = text.match(PEM_RE)
  if (blocks) {
    return blocks.map((b) => {
      const label = b.match(/-----BEGIN ([A-Z0-9 ]+)-----/)![1]
      return { label, der: PemConverter.decode(b)[0] }
    })
  }
  const clean = text.replace(/\s+/g, '')
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(clean) && clean.length > 100) {
    const bin = atob(clean)
    return [{ label: 'CERTIFICATE', der: Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer }]
  }
  throw new Error('Paste a PEM block that starts with -----BEGIN CERTIFICATE----- (or CERTIFICATE REQUEST).')
}

/** Reads uploaded bytes: PEM text or binary DER. */
export function splitFile(bytes: Uint8Array): { label: string; der: ArrayBuffer }[] {
  const head = new TextDecoder().decode(bytes.slice(0, 200))
  if (head.includes('-----BEGIN')) return splitInput(new TextDecoder().decode(bytes))
  if (bytes[0] !== 0x30) throw new Error('This file is neither PEM nor DER (DER starts with byte 0x30).')
  return [{ label: 'DER', der: bytes.slice().buffer }]
}

export async function decodeAll(items: { label: string; der: ArrayBuffer }[]): Promise<{ decoded: Decoded[]; certs: X509Certificate[]; errors: string[] }> {
  const decoded: Decoded[] = []
  const certs: X509Certificate[] = []
  const errors: string[] = []
  for (const [i, item] of items.entries()) {
    try {
      if (/REQUEST/.test(item.label)) {
        decoded.push(await decodeCsr(new Pkcs10CertificateRequest(item.der)))
        continue
      }
      if (/PRIVATE KEY/.test(item.label)) {
        errors.push(`Block ${i + 1} is a private key. Never paste private keys into websites; it was ignored.`)
        continue
      }
      let cert: X509Certificate
      try {
        cert = new X509Certificate(item.der)
      } catch (err) {
        if (item.label === 'DER') {
          decoded.push(await decodeCsr(new Pkcs10CertificateRequest(item.der)))
          continue
        }
        throw err
      }
      certs.push(cert)
      decoded.push(await decodeCert(cert))
    } catch (err) {
      errors.push(`Block ${i + 1} (${item.label}) could not be decoded: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  return { decoded, certs, errors }
}

export interface ChainLink {
  from: number
  to: number
  nameMatch: boolean
  signatureValid: boolean | null
}

/** Checks that each certificate is issued by the next one (leaf first, as servers send them). */
export async function checkChain(certs: X509Certificate[]): Promise<{ links: ChainLink[]; ordered: boolean }> {
  const links: ChainLink[] = []
  for (let i = 0; i < certs.length - 1; i++) {
    const nameMatch = certs[i].issuer === certs[i + 1].subject
    let signatureValid: boolean | null = null
    try {
      signatureValid = await certs[i].verify({ publicKey: certs[i + 1].publicKey, signatureOnly: true })
    } catch {
      signatureValid = null
    }
    links.push({ from: i, to: i + 1, nameMatch, signatureValid })
  }
  return { links, ordered: links.every((l) => l.nameMatch && l.signatureValid !== false) }
}

export function daysLeft(notAfter: Date, now = new Date()): number {
  return Math.floor((notAfter.getTime() - now.getTime()) / 86_400_000)
}

