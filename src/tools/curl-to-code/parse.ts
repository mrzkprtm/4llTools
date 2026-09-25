export interface FormField {
  name: string
  value?: string
  /** Path of a file to upload (from name=@path). */
  file?: string
  type?: string
}

export interface ParsedRequest {
  url: string
  method: string
  headers: [string, string][]
  body?: { kind: 'raw'; text: string } | { kind: 'form'; fields: FormField[] }
  auth?: { user: string; pass: string }
  insecure: boolean
  followRedirects: boolean
  compressed: boolean
  head: boolean
  notes: string[]
}

/** Splits a shell command line into words, handling quotes, escapes and $'…'. */
export function tokenizeBash(input: string): string[] {
  const s = input.replace(/\\\r?\n/g, ' ')
  const out: string[] = []
  let cur = ''
  let inWord = false
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      if (inWord) { out.push(cur); cur = ''; inWord = false }
      i++
      continue
    }
    inWord = true
    if (c === "'") {
      const end = s.indexOf("'", i + 1)
      if (end < 0) throw new Error('Unclosed single quote.')
      cur += s.slice(i + 1, end)
      i = end + 1
    } else if (c === '$' && s[i + 1] === "'") {
      i += 2
      while (i < s.length && s[i] !== "'") {
        if (s[i] === '\\' && i + 1 < s.length) {
          const n = s[i + 1]
          const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', v: '\v', '?': '?' }
          if (n in simple) { cur += simple[n]; i += 2 }
          else if (n === 'x') {
            const m = s.slice(i + 2).match(/^[0-9a-fA-F]{1,2}/)
            cur += m ? String.fromCharCode(parseInt(m[0], 16)) : '\\x'
            i += 2 + (m ? m[0].length : 0)
          } else if (n === 'u' || n === 'U') {
            const m = s.slice(i + 2).match(n === 'u' ? /^[0-9a-fA-F]{1,4}/ : /^[0-9a-fA-F]{1,8}/)
            cur += m ? String.fromCodePoint(parseInt(m[0], 16)) : '\\' + n
            i += 2 + (m ? m[0].length : 0)
          } else if (/[0-7]/.test(n)) {
            const m = s.slice(i + 1).match(/^[0-7]{1,3}/)!
            cur += String.fromCharCode(parseInt(m[0], 8))
            i += 1 + m[0].length
          } else { cur += '\\' + n; i += 2 }
        } else cur += s[i++]
      }
      if (i >= s.length) throw new Error("Unclosed $'…' quote.")
      i++
    } else if (c === '"') {
      i++
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\' && i + 1 < s.length && '$`"\\\n'.includes(s[i + 1])) { cur += s[i + 1]; i += 2 }
        else cur += s[i++]
      }
      if (i >= s.length) throw new Error('Unclosed double quote.')
      i++
    } else if (c === '\\' && i + 1 < s.length) {
      cur += s[i + 1]
      i += 2
    } else {
      cur += c
      i++
    }
  }
  if (inWord) out.push(cur)
  return out
}

/**
 * Windows cmd syntax as produced by Chrome's "Copy as cURL (cmd)": ^ escapes the
 * next character, ^ at a line end continues the line, and "^<newline><newline>"
 * is a newline inside a value. After removing the carets, arguments are split
 * with the Microsoft C runtime rules (quotes group, \" is a literal quote).
 */
export function tokenizeCmd(input: string): string[] {
  const NL = '\u0000'
  const s = input
    .replace(/\^\r?\n\r?\n/g, NL)
    .replace(/\^\r?\n/g, ' ')
    .replace(/%\^/g, '%')
    .replace(/\^([\s\S])/g, '$1')
  const out: string[] = []
  let cur = ''
  let inWord = false
  let inQuote = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') {
      let n = 0
      while (s[i + n] === '\\') n++
      if (s[i + n] === '"') {
        cur += '\\'.repeat(Math.floor(n / 2))
        if (n % 2 === 1) cur += '"'
        else inQuote = !inQuote
        i += n
      } else {
        cur += '\\'.repeat(n)
        i += n - 1
      }
      inWord = true
      continue
    }
    if (c === '"') {
      if (inQuote && s[i + 1] === '"') { cur += '"'; i++; continue }
      inQuote = !inQuote
      inWord = true
      continue
    }
    if (!inQuote && /\s/.test(c)) {
      if (inWord) { out.push(cur.split(NL).join('\n')); cur = ''; inWord = false }
      continue
    }
    cur += c
    inWord = true
  }
  if (inQuote) throw new Error('Unclosed double quote.')
  if (inWord) out.push(cur.split(NL).join('\n'))
  return out
}

export function looksLikeCmd(input: string): boolean {
  return /\^\r?\n/.test(input) || /\^"/.test(input) || /^\s*curl(\.exe)?\s+"/i.test(input)
}

const SHORT_WITH_ARG = new Set('XHdFubAeoxmTrwEKzYyCcQtP'.split(''))
const LONG_WITH_ARG = new Set([
  'request', 'header', 'data', 'data-raw', 'data-binary', 'data-ascii', 'data-urlencode', 'json', 'form', 'form-string', 'user',
  'cookie', 'user-agent', 'referer', 'url', 'output', 'max-time', 'connect-timeout', 'proxy', 'proxy-user', 'cert', 'key', 'cacert',
  'capath', 'write-out', 'retry', 'retry-delay', 'retry-max-time', 'upload-file', 'range', 'oauth2-bearer', 'resolve', 'connect-to',
  'interface', 'limit-rate', 'max-redirs', 'cookie-jar', 'config', 'trace', 'trace-ascii', 'dump-header', 'ciphers', 'aws-sigv4',
  'unix-socket', 'abstract-unix-socket', 'time-cond', 'local-port', 'dns-servers', 'noproxy', 'socks5', 'socks5-hostname', 'expect100-timeout',
  'keepalive-time', 'speed-limit', 'speed-time', 'tls-max', 'pinnedpubkey', 'request-target', 'variable', 'url-query', 'form-escape',
])
const SHORT_ALIASES: Record<string, string> = {
  X: 'request', H: 'header', d: 'data', F: 'form', u: 'user', b: 'cookie', A: 'user-agent', e: 'referer', G: 'get', I: 'head',
  L: 'location', k: 'insecure', o: 'output', x: 'proxy', m: 'max-time', T: 'upload-file', r: 'range', w: 'write-out', s: 'silent',
  S: 'show-error', i: 'include', v: 'verbose', f: 'fail', g: 'globoff', N: 'no-buffer', O: 'remote-name', Z: 'parallel', '4': 'ipv4',
  '6': 'ipv6', '0': 'http1.0', '2': 'sslv2', '3': 'sslv3', '#': 'progress-bar', n: 'netrc', q: 'disable', R: 'remote-time', j: 'junk-session-cookies',
  J: 'remote-header-name', l: 'list-only', a: 'append', B: 'use-ascii', M: 'manual', V: 'version', h: 'help', p: 'proxytunnel',
  E: 'cert', K: 'config', z: 'time-cond', Y: 'speed-limit', y: 'speed-time', C: 'continue-at', c: 'cookie-jar', Q: 'quote', t: 'telnet-option', P: 'ftp-port',
}
// Harmless flags that don't change the request
const IGNORED = new Set(['silent', 'show-error', 'include', 'verbose', 'fail', 'fail-with-body', 'globoff', 'no-buffer', 'progress-bar', 'http1.1', 'http2', 'http2-prior-knowledge', 'http3', 'tlsv1.2', 'tlsv1.3', 'tlsv1', 'ipv4', 'ipv6', 'no-progress-meter', 'output', 'write-out', 'remote-name', 'remote-header-name', 'dump-header', 'max-time', 'connect-timeout', 'retry', 'retry-delay', 'retry-max-time', 'max-redirs', 'trace', 'trace-ascii', 'no-keepalive', 'keepalive-time', 'tcp-nodelay', 'path-as-is', 'raw', 'styled-output', 'no-styled-output', 'create-dirs', 'remote-time', 'limit-rate', 'speed-limit', 'speed-time', 'parallel', 'sslv2', 'sslv3', 'http1.0', 'tls-max', 'ssl-no-revoke'])

function basicB64(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

export { basicB64 }

/** Parses a curl command (bash or Windows cmd syntax) into a request description. */
export function parseCurl(command: string): ParsedRequest {
  const text = command.trim().replace(/^\$\s+/, '')
  if (!text) throw new Error('Paste a curl command.')
  const tokens = looksLikeCmd(text) ? tokenizeCmd(text) : tokenizeBash(text)
  if (!tokens.length) throw new Error('Paste a curl command.')
  if (/^curl(\.exe)?$/i.test(tokens[0])) tokens.shift()

  const req: ParsedRequest = { url: '', method: '', headers: [], insecure: false, followRedirects: false, compressed: false, head: false, notes: [] }
  const data: string[] = []
  const form: FormField[] = []
  let json = false
  let get = false
  let explicitMethod = ''
  const urls: string[] = []
  const queryParts: string[] = []

  const addHeader = (line: string) => {
    const idx = line.indexOf(':')
    if (idx <= 0) {
      req.notes.push(`Ignored malformed header “${line}”.`)
      return
    }
    const name = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!value && line.trim().endsWith(':')) {
      // "-H 'Name:'" removes a default header in curl
      req.headers = req.headers.filter(([n]) => n.toLowerCase() !== name.toLowerCase())
      return
    }
    req.headers.push([name, value])
  }

  const handle = (opt: string, arg: string | undefined) => {
    switch (opt) {
      case 'request': explicitMethod = (arg ?? '').toUpperCase(); break
      case 'header': addHeader(arg ?? ''); break
      case 'data': case 'data-ascii': case 'data-raw': case 'data-binary': {
        let v = arg ?? ''
        if (opt !== 'data-raw' && v.startsWith('@')) {
          req.notes.push(`The body is read from the file “${v.slice(1)}”; it is shown as a placeholder.`)
          v = `<contents of ${v.slice(1)}>`
        } else if (opt === 'data' || opt === 'data-ascii') v = v.replace(/[\r\n]/g, '')
        data.push(v)
        break
      }
      case 'data-urlencode': {
        const v = arg ?? ''
        const eq = v.indexOf('=')
        const at = v.indexOf('@')
        if (eq === -1 && at > 0) {
          req.notes.push(`--data-urlencode reads “${v.slice(at + 1)}” from a file; shown as a placeholder.`)
          data.push(`${v.slice(0, at)}=<contents of ${v.slice(at + 1)}>`)
        } else if (eq === -1) data.push(encodeURIComponent(v))
        else if (eq === 0) data.push(encodeURIComponent(v.slice(1)))
        else data.push(`${v.slice(0, eq)}=${encodeURIComponent(v.slice(eq + 1))}`)
        break
      }
      case 'json': {
        json = true
        let v = arg ?? ''
        if (v.startsWith('@')) { req.notes.push(`The JSON body is read from “${v.slice(1)}”; shown as a placeholder.`); v = `<contents of ${v.slice(1)}>` }
        data.push(v)
        break
      }
      case 'form': case 'form-string': {
        const v = arg ?? ''
        const eq = v.indexOf('=')
        if (eq <= 0) { req.notes.push(`Ignored malformed form field “${v}”.`); break }
        const name = v.slice(0, eq)
        const rest = v.slice(eq + 1)
        if (opt === 'form' && (rest.startsWith('@') || rest.startsWith('<'))) {
          const [path, ...params] = rest.slice(1).split(';')
          const type = params.find((p) => p.startsWith('type='))?.slice(5)
          if (rest.startsWith('<')) form.push({ name, value: `<contents of ${path}>` })
          else form.push({ name, file: path, type })
        } else {
          const [value, ...params] = opt === 'form' ? rest.split(';type=') : [rest]
          form.push({ name, value, type: params[0] })
        }
        break
      }
      case 'user': {
        const v = arg ?? ''
        const i = v.indexOf(':')
        req.auth = i === -1 ? { user: v, pass: '' } : { user: v.slice(0, i), pass: v.slice(i + 1) }
        if (i === -1) req.notes.push('No password given with -u; curl would prompt for it. Using an empty password.')
        break
      }
      case 'cookie': {
        const v = arg ?? ''
        if (v.includes('=')) req.headers.push(['Cookie', v])
        else req.notes.push(`-b “${v}” reads cookies from a file, which cannot be converted.`)
        break
      }
      case 'user-agent': req.headers.push(['User-Agent', arg ?? '']); break
      case 'referer': req.headers.push(['Referer', (arg ?? '').replace(/;auto$/, '')]); break
      case 'oauth2-bearer': req.headers.push(['Authorization', `Bearer ${arg ?? ''}`]); break
      case 'url': urls.push(arg ?? ''); break
      case 'url-query': queryParts.push(arg ?? ''); break
      case 'get': get = true; break
      case 'head': req.head = true; break
      case 'location': case 'location-trusted': req.followRedirects = true; break
      case 'insecure': req.insecure = true; break
      case 'compressed': req.compressed = true; break
      case 'upload-file': req.notes.push(`-T uploads the file “${arg}” with PUT; shown as a placeholder body.`); data.push(`<contents of ${arg}>`); if (!explicitMethod) explicitMethod = 'PUT'; break
      case 'range': req.headers.push(['Range', `bytes=${arg}`]); break
      case 'proxy': req.notes.push(`Proxy “${arg}” is not included in the generated code.`); break
      case 'cert': case 'key': case 'cacert': case 'capath': req.notes.push(`Client TLS option --${opt} is not included.`); break
      default:
        if (!IGNORED.has(opt)) req.notes.push(`Ignored unsupported option --${opt}${arg !== undefined ? ` ${arg}` : ''}.`)
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.startsWith('--') && t.length > 2) {
      let name = t.slice(2)
      let arg: string | undefined
      const eq = name.indexOf('=')
      if (eq > 0 && LONG_WITH_ARG.has(name.slice(0, eq))) { arg = name.slice(eq + 1); name = name.slice(0, eq) }
      else if (LONG_WITH_ARG.has(name)) {
        if (i + 1 >= tokens.length) throw new Error(`Option --${name} needs a value.`)
        arg = tokens[++i]
      }
      if (name.startsWith('no-') && !IGNORED.has(name)) { req.notes.push(`Ignored --${name}.`); continue }
      handle(name, arg)
    } else if (t.startsWith('-') && t.length > 1) {
      for (let j = 1; j < t.length; j++) {
        const ch = t[j]
        const name = SHORT_ALIASES[ch]
        if (!name) { req.notes.push(`Ignored unknown option -${ch}.`); continue }
        if (SHORT_WITH_ARG.has(ch)) {
          let arg = t.slice(j + 1)
          if (!arg) {
            if (i + 1 >= tokens.length) throw new Error(`Option -${ch} needs a value.`)
            arg = tokens[++i]
          }
          handle(name, arg)
          break
        }
        handle(name, undefined)
      }
    } else {
      urls.push(t)
    }
  }

  if (!urls.length) throw new Error('No URL found in the command.')
  if (urls.length > 1) req.notes.push(`Several URLs given; using the first (${urls[0]}).`)
  let url = urls[0]
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'http://' + url
  if (queryParts.length) url += (url.includes('?') ? '&' : '?') + queryParts.join('&')

  const hasHeader = (n: string) => req.headers.some(([k]) => k.toLowerCase() === n.toLowerCase())
  if (json) {
    if (!hasHeader('content-type')) req.headers.push(['Content-Type', 'application/json'])
    if (!hasHeader('accept')) req.headers.push(['Accept', 'application/json'])
  }

  if (get && data.length) {
    url += (url.includes('?') ? '&' : '?') + data.join('&')
    data.length = 0
  }
  if (form.length && data.length) req.notes.push('Both -d and -F were given; curl refuses this. Using the form fields.')
  if (form.length) req.body = { kind: 'form', fields: form }
  else if (data.length) {
    req.body = { kind: 'raw', text: data.join('&') }
    if (!hasHeader('content-type') && !json) req.headers.push(['Content-Type', 'application/x-www-form-urlencoded'])
  }

  req.url = url
  req.method = explicitMethod || (req.head ? 'HEAD' : get ? 'GET' : req.body ? 'POST' : 'GET')
  return req
}

/** The JSON value of the body when the request sends JSON, else undefined. */
export function jsonBody(req: ParsedRequest): unknown {
  if (req.body?.kind !== 'raw') return undefined
  const ct = req.headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
  if (!/json/i.test(ct)) return undefined
  try {
    return JSON.parse(req.body.text)
  } catch {
    return undefined
  }
}
