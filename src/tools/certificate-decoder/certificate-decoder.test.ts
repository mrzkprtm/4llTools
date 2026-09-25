import { describe, expect, it } from 'vitest'
import { checkChain, daysLeft, decodeAll, splitFile, splitInput, type DecodedCert, type DecodedCsr } from './cert'
import { CA_PEM, CSR_PEM, LEAF_PEM } from './fixtures'

describe('certificate decoder', () => {
  it('decodes a leaf certificate', async () => {
    const { decoded, errors } = await decodeAll(splitInput(LEAF_PEM))
    expect(errors).toEqual([])
    const c = decoded[0] as DecodedCert
    expect(c.kind).toBe('certificate')
    expect(c.subjectCN).toBe('test.example')
    expect(c.issuerCN).toBe('4llTools Test Root CA')
    expect(c.serial).toBe('1234ABCD')
    expect(c.key).toBe('RSA 2048 bits')
    expect(c.signature).toBe('SHA256 with ECDSA')
    expect(c.sans).toEqual(['DNS: test.example', 'DNS: www.test.example', 'IP: 192.0.2.1'])
    expect(c.keyUsage).toEqual(['digitalSignature', 'keyEncipherment'])
    expect(c.extKeyUsage).toEqual(['TLS server authentication', 'TLS client authentication'])
    expect(c.basicConstraints).toBe('Not a CA (end-entity)')
    expect(c.aia).toEqual({ ocsp: ['http://ocsp.test.example'], caIssuers: ['http://ca.test.example/ca.crt'] })
    expect(c.crl).toEqual(['http://crl.test.example/ca.crl'])
    expect(c.sha256).toBe('E2:0A:8A:47:F7:3B:70:E7:F9:F7:A8:63:34:0C:DB:55:93:9B:56:8C:5F:46:CF:C6:02:97:6F:2A:B7:6D:EC:20')
    expect(c.sha1).toBe('AD:8F:A1:17:CA:70:97:10:E3:A9:06:2E:AD:7E:E6:CC:DA:A4:C6:CC')
    expect(c.notAfter.toISOString()).toBe('2036-09-22T04:14:03.000Z')
    expect(daysLeft(c.notAfter, new Date('2036-09-12T04:14:03Z'))).toBe(10)
  })

  it('checks chain order', async () => {
    const good = await decodeAll(splitInput(LEAF_PEM + '\n' + CA_PEM))
    const ca = good.decoded[1] as DecodedCert
    expect(ca.isCA).toBe(true)
    expect(ca.selfIssued).toBe(true)
    expect(ca.key).toMatch(/^EC P-256/)
    const chain = await checkChain(good.certs)
    expect(chain.ordered).toBe(true)
    expect(chain.links[0]).toMatchObject({ nameMatch: true, signatureValid: true })
    const wrong = await checkChain((await decodeAll(splitInput(CA_PEM + LEAF_PEM))).certs)
    expect(wrong.ordered).toBe(false)
  })

  it('decodes a CSR and DER input', async () => {
    const csr = (await decodeAll(splitInput(CSR_PEM))).decoded[0] as DecodedCsr
    expect(csr.kind).toBe('csr')
    expect(csr.subjectCN).toBe('test.example')
    expect(csr.signatureValid).toBe(true)
    expect(csr.sans).toContain('DNS: www.test.example')
    const der = new Uint8Array(splitInput(LEAF_PEM)[0].der)
    const fromDer = await decodeAll(splitFile(der))
    expect((fromDer.decoded[0] as DecodedCert).subjectCN).toBe('test.example')
    const b64 = LEAF_PEM.replace(/-----[^-]+-----/g, '')
    expect(splitInput(b64)).toHaveLength(1)
  })

  it('reports bad input and refuses private keys', async () => {
    expect(() => splitInput('hello')).toThrow(/BEGIN CERTIFICATE/)
    expect(() => splitFile(new Uint8Array([1, 2, 3]))).toThrow(/neither PEM nor DER/)
    const pk = ['-----BEGIN', 'PRIVATE KEY-----\nAAAA\n-----END', 'PRIVATE KEY-----'].join(' ')
    const r = await decodeAll(splitInput(pk))
    expect(r.errors[0]).toMatch(/private key/)
    const junk = await decodeAll(splitInput('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----'))
    expect(junk.errors[0]).toMatch(/could not be decoded/)
  })
})
