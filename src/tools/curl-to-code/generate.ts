import { basicB64, jsonBody, type ParsedRequest } from './parse'

export const LANGUAGES = [
  { id: 'fetch', label: 'JavaScript (fetch)' },
  { id: 'axios', label: 'Node.js (axios)' },
  { id: 'python', label: 'Python (requests)' },
  { id: 'php', label: 'PHP (cURL)' },
  { id: 'go', label: 'Go (net/http)' },
  { id: 'rust', label: 'Rust (reqwest, blocking)' },
] as const

export type Language = (typeof LANGUAGES)[number]['id']

/** A double-quoted string literal valid in JS, Python and Go. */
const dq = (s: string) => JSON.stringify(s)

/** Rust string literal: JSON escapes except \u{…} syntax. */
const rs = (s: string) =>
  '"' + s.replace(/[\\"\n\r\t\0]|[\x00-\x1f\x7f]/g, (c) => ({ '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\0': '\\0' })[c] ?? `\\u{${c.charCodeAt(0).toString(16)}}`) + '"'

/** PHP single-quoted literal (no interpolation), falls back to double quotes for control characters. */
const php = (s: string) =>
  /[\x00-\x1f]/.test(s)
    ? '"' + s.replace(/[\\"$\n\r\t]|[\x00-\x1f]/g, (c) => ({ '\\': '\\\\', '"': '\\"', $: '\\$', '\n': '\\n', '\r': '\\r', '\t': '\\t' })[c] ?? `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`) + '"'
    : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

const jsKey = (s: string) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
const jsStr = (s: string) => (/[\n\r\u2028\u2029]/.test(s) || s.includes("'") ? dq(s) : `'${s.replace(/\\/g, '\\\\')}'`)

function toPython(v: unknown, indent = 0): string {
  const pad = '    '.repeat(indent + 1)
  const end = '    '.repeat(indent)
  if (v === null) return 'None'
  if (v === true) return 'True'
  if (v === false) return 'False'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return dq(v)
  if (Array.isArray(v)) return v.length ? (v.every((x) => x === null || typeof x !== 'object') && JSON.stringify(v).length < 60 ? `[${v.map((x) => toPython(x)).join(', ')}]` : `[\n${v.map((x) => pad + toPython(x, indent + 1)).join(',\n')},\n${end}]`) : '[]'
  const entries = Object.entries(v as Record<string, unknown>)
  return entries.length ? `{\n${entries.map(([k, x]) => `${pad}${dq(k)}: ${toPython(x, indent + 1)}`).join(',\n')},\n${end}}` : '{}'
}

function toJs(v: unknown, indent = 0): string {
  const pad = '  '.repeat(indent + 1)
  const end = '  '.repeat(indent)
  if (v === null || typeof v === 'boolean' || typeof v === 'number') return String(v)
  if (typeof v === 'string') return jsStr(v)
  if (Array.isArray(v)) return v.length ? (v.every((x) => x === null || typeof x !== 'object') && JSON.stringify(v).length < 60 ? `[${v.map((x) => toJs(x)).join(', ')}]` : `[\n${v.map((x) => pad + toJs(x, indent + 1)).join(',\n')},\n${end}]`) : '[]'
  const entries = Object.entries(v as Record<string, unknown>)
  return entries.length ? `{\n${entries.map(([k, x]) => `${pad}${jsKey(k)}: ${toJs(x, indent + 1)}`).join(',\n')},\n${end}}` : '{}'
}

const indentLines = (s: string, n: number) => s.split('\n').map((l, i) => (i === 0 ? l : ' '.repeat(n) + l)).join('\n')

function headersWithoutAuth(req: ParsedRequest, dropContentTypeForForm = false) {
  return req.headers.filter(([k]) => !(dropContentTypeForForm && req.body?.kind === 'form' && k.toLowerCase() === 'content-type'))
}

// ---------- JavaScript fetch ----------
function genFetch(req: ParsedRequest): string {
  const lines: string[] = []
  const headers = headersWithoutAuth(req, true).map(([k, v]) => [k, v])
  if (req.auth) headers.push(['Authorization', `Basic ${basicB64(`${req.auth.user}:${req.auth.pass}`)}`])
  const opts: string[] = []
  if (req.method !== 'GET') opts.push(`  method: '${req.method}',`)
  if (headers.length) opts.push(`  headers: {\n${headers.map(([k, v]) => `    ${jsKey(k)}: ${jsStr(v)},`).join('\n')}\n  },`)
  const json = jsonBody(req)
  if (req.body?.kind === 'form') {
    lines.push('const form = new FormData()')
    for (const f of req.body.fields) {
      if (f.file) lines.push(`form.append(${jsStr(f.name)}, fileInput.files[0]) // ${f.file}`)
      else lines.push(`form.append(${jsStr(f.name)}, ${jsStr(f.value ?? '')})`)
    }
    lines.push('')
    opts.push('  body: form,')
  } else if (json !== undefined) {
    opts.push(`  body: JSON.stringify(${indentLines(toJs(json, 1), 0)}),`)
  } else if (req.body) opts.push(`  body: ${jsStr(req.body.text)},`)
  const forbidden = headers.filter(([k]) => ['cookie', 'user-agent', 'referer', 'host', 'origin', 'accept-encoding', 'content-length', 'connection'].includes(k.toLowerCase()))
  if (forbidden.length) lines.unshift(`// Note: browsers ignore ${forbidden.map(([k]) => k).join(', ')}; these work in Node.js 18+.`)
  if (req.insecure) lines.unshift('// Note: -k (skip TLS verification) has no fetch equivalent; in Node set NODE_TLS_REJECT_UNAUTHORIZED=0 for testing only.')
  lines.push(`const response = await fetch(${jsStr(req.url)}${opts.length ? `, {\n${opts.join('\n')}\n}` : ''})`)
  lines.push(req.head ? '\nconsole.log(response.status, [...response.headers])' : '\nconsole.log(response.status)\nconsole.log(await response.text())')
  return lines.join('\n')
}

// ---------- axios ----------
function genAxios(req: ParsedRequest): string {
  const top: string[] = ["import axios from 'axios'"]
  const cfg: string[] = [`  method: '${req.method.toLowerCase()}',`, `  url: ${jsStr(req.url)},`]
  const headers = headersWithoutAuth(req, true)
  const json = jsonBody(req)
  const pre: string[] = []
  if (req.body?.kind === 'form') {
    top.push("import FormData from 'form-data'")
    if (req.body.fields.some((f) => f.file)) top.push("import fs from 'node:fs'")
    pre.push('const form = new FormData()')
    for (const f of req.body.fields) {
      if (f.file) pre.push(`form.append(${jsStr(f.name)}, fs.createReadStream(${jsStr(f.file)})${f.type ? `, { contentType: ${jsStr(f.type)} }` : ''})`)
      else pre.push(`form.append(${jsStr(f.name)}, ${jsStr(f.value ?? '')})`)
    }
    pre.push('')
  }
  if (req.insecure) top.push("import https from 'node:https'")
  if (headers.length || req.body?.kind === 'form') {
    const hs = headers.map(([k, v]) => `    ${jsKey(k)}: ${jsStr(v)},`)
    if (req.body?.kind === 'form') hs.push('    ...form.getHeaders(),')
    cfg.push(`  headers: {\n${hs.join('\n')}\n  },`)
  }
  if (req.auth) cfg.push(`  auth: {\n    username: ${jsStr(req.auth.user)},\n    password: ${jsStr(req.auth.pass)},\n  },`)
  if (req.body?.kind === 'form') cfg.push('  data: form,')
  else if (json !== undefined) cfg.push(`  data: ${toJs(json, 1)},`)
  else if (req.body) cfg.push(`  data: ${jsStr(req.body.text)},`)
  if (req.insecure) cfg.push('  httpsAgent: new https.Agent({ rejectUnauthorized: false }), // -k: testing only')
  cfg.push('  validateStatus: () => true,')
  return `${top.join('\n')}\n\n${pre.join('\n')}${pre.length ? '\n' : ''}const response = await axios({\n${cfg.join('\n')}\n})\n\nconsole.log(response.status)\nconsole.log(response.data)`
}

// ---------- Python requests ----------
function genPython(req: ParsedRequest): string {
  const out: string[] = ['import requests', '']
  const headers = headersWithoutAuth(req, true)
  const json = jsonBody(req)
  const args: string[] = [dq(req.url)]
  // requests sets Content-Type for json=; drop it to avoid duplicates
  const hs = json !== undefined ? headers.filter(([k]) => k.toLowerCase() !== 'content-type') : headers
  if (hs.length) {
    out.push('headers = {', ...hs.map(([k, v]) => `    ${dq(k)}: ${dq(v)},`), '}', '')
    args.push('headers=headers')
  }
  if (req.body?.kind === 'form') {
    const files = req.body.fields.filter((f) => f.file)
    const data = req.body.fields.filter((f) => !f.file)
    if (data.length) { out.push('data = {', ...data.map((f) => `    ${dq(f.name)}: ${dq(f.value ?? '')},`), '}', ''); args.push('data=data') }
    if (files.length) {
      out.push('files = {', ...files.map((f) => `    ${dq(f.name)}: open(${dq(f.file!)}, "rb"),`), '}', '')
      args.push('files=files')
    }
  } else if (json !== undefined) {
    out.push(`json_data = ${toPython(json)}`, '')
    args.push('json=json_data')
  } else if (req.body) {
    out.push(`data = ${dq(req.body.text)}`, '')
    args.push('data=data')
  }
  if (req.auth) args.push(`auth=(${dq(req.auth.user)}, ${dq(req.auth.pass)})`)
  if (req.insecure) args.push('verify=False')
  if (req.followRedirects && req.head) args.push('allow_redirects=True')
  const fn = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method) ? req.method.toLowerCase() : null
  const call = fn ? `requests.${fn}(` : `requests.request(${dq(req.method)}, `
  out.push(`response = ${call}${args.join(', ')})`, '', 'print(response.status_code)', req.head ? 'print(response.headers)' : 'print(response.text)')
  return out.join('\n')
}

// ---------- PHP cURL ----------
function genPhp(req: ParsedRequest): string {
  const o: string[] = ['<?php', '', '$ch = curl_init();', `curl_setopt($ch, CURLOPT_URL, ${php(req.url)});`, 'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);']
  if (req.head) o.push('curl_setopt($ch, CURLOPT_NOBODY, true);')
  else if (req.method === 'POST' && req.body) o.push('curl_setopt($ch, CURLOPT_POST, true);')
  else if (req.method !== 'GET') o.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${php(req.method)});`)
  const headers = headersWithoutAuth(req, true)
  if (headers.length) o.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [', ...headers.map(([k, v]) => `    ${php(`${k}: ${v}`)},`), ']);')
  if (req.body?.kind === 'form') {
    o.push('curl_setopt($ch, CURLOPT_POSTFIELDS, [')
    for (const f of req.body.fields) o.push(f.file ? `    ${php(f.name)} => new CURLFile(${php(f.file)}${f.type ? `, ${php(f.type)}` : ''}),` : `    ${php(f.name)} => ${php(f.value ?? '')},`)
    o.push(']);')
  } else if (req.body) o.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${php(req.body.text)});`)
  if (req.auth) o.push(`curl_setopt($ch, CURLOPT_USERPWD, ${php(`${req.auth.user}:${req.auth.pass}`)});`)
  if (req.followRedirects) o.push('curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);')
  if (req.compressed) o.push("curl_setopt($ch, CURLOPT_ENCODING, '');")
  if (req.insecure) o.push('curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);', 'curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);')
  o.push('', '$response = curl_exec($ch);', 'if ($response === false) {', '    echo \'Error: \' . curl_error($ch);', '}', '$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);', 'curl_close($ch);', '', 'echo $status . PHP_EOL;', 'echo $response;')
  return o.join('\n')
}

// ---------- Go ----------
function goStr(s: string): string {
  return /["\n\\]/.test(s) && !/[`\r]/.test(s) ? '`' + s + '`' : dq(s)
}

function genGo(req: ParsedRequest): string {
  const imports = new Set(['fmt', 'io', 'log', 'net/http'])
  const body: string[] = []
  let bodyVar = 'nil'
  let contentType = ''
  if (req.body?.kind === 'form') {
    imports.add('bytes')
    imports.add('mime/multipart')
    body.push('\tvar buf bytes.Buffer', '\tw := multipart.NewWriter(&buf)')
    let n = 0
    for (const f of req.body.fields) {
      if (f.file) {
        const k = n++ ? String(n) : ''
        imports.add('os')
        imports.add('path/filepath')
        body.push(
          `\tf${k}, err := os.Open(${dq(f.file)})`, '\tif err != nil {', '\t\tlog.Fatal(err)', '\t}', `\tdefer f${k}.Close()`,
          `\tpart${k}, err := w.CreateFormFile(${dq(f.name)}, filepath.Base(${dq(f.file)}))`, '\tif err != nil {', '\t\tlog.Fatal(err)', '\t}',
          `\tif _, err := io.Copy(part${k}, f${k}); err != nil {`, '\t\tlog.Fatal(err)', '\t}',
        )
      } else body.push(`\tw.WriteField(${dq(f.name)}, ${dq(f.value ?? '')})`)
    }
    body.push('\tw.Close()', '')
    bodyVar = '&buf'
    contentType = 'w.FormDataContentType()'
  } else if (req.body) {
    imports.add('strings')
    body.push(`\tdata := strings.NewReader(${goStr(req.body.text)})`, '')
    bodyVar = 'data'
  }
  const client: string[] = []
  if (req.insecure) {
    imports.add('crypto/tls')
    client.push('\ttr := &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}} // -k: testing only')
    client.push('\tclient := &http.Client{Transport: tr}')
  } else client.push('\tclient := &http.Client{}')
  const lines = [...body, ...client, `\treq, err := http.NewRequest(${dq(req.method)}, ${dq(req.url)}, ${bodyVar})`, '\tif err != nil {', '\t\tlog.Fatal(err)', '\t}']
  for (const [k, v] of headersWithoutAuth(req, true)) lines.push(`\treq.Header.Set(${dq(k)}, ${dq(v)})`)
  if (contentType) lines.push(`\treq.Header.Set("Content-Type", ${contentType})`)
  if (req.auth) lines.push(`\treq.SetBasicAuth(${dq(req.auth.user)}, ${dq(req.auth.pass)})`)
  lines.push('\tresp, err := client.Do(req)', '\tif err != nil {', '\t\tlog.Fatal(err)', '\t}', '\tdefer resp.Body.Close()', '\tbodyText, err := io.ReadAll(resp.Body)', '\tif err != nil {', '\t\tlog.Fatal(err)', '\t}', '\tfmt.Println(resp.Status)', '\tfmt.Printf("%s\\n", bodyText)')
  const imp = [...imports].sort().map((i) => `\t"${i}"`).join('\n')
  return `package main\n\nimport (\n${imp}\n)\n\nfunc main() {\n${lines.join('\n')}\n}`
}

// ---------- Rust ----------
function genRust(req: ParsedRequest): string {
  const features = ['blocking']
  const pre: string[] = []
  const chain: string[] = []
  const m = req.method
  const simple = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(m)
  chain.push(simple ? `client.${m.toLowerCase()}(${rs(req.url)})` : `client.request(reqwest::Method::from_bytes(${rs(m)}.as_bytes())?, ${rs(req.url)})`)
  for (const [k, v] of headersWithoutAuth(req, true)) chain.push(`.header(${rs(k)}, ${rs(v)})`)
  if (req.auth) chain.push(`.basic_auth(${rs(req.auth.user)}, Some(${rs(req.auth.pass)}))`)
  if (req.body?.kind === 'form') {
    features.push('multipart')
    let form = 'reqwest::blocking::multipart::Form::new()'
    for (const f of req.body.fields) form += f.file ? `\n        .file(${rs(f.name)}, ${rs(f.file)})?` : `\n        .text(${rs(f.name)}, ${rs(f.value ?? '')})`
    pre.push(`    let form = ${form};`)
    chain.push('.multipart(form)')
  } else if (req.body) {
    const body = req.body.text
    const raw = body.includes('\n') || body.includes('"') ? (body.includes('"#') ? rs(body) : `r#"${body}"#`) : rs(body)
    chain.push(`.body(${raw})`)
  }
  chain.push('.send()?')
  const builder: string[] = []
  if (req.insecure) builder.push('.danger_accept_invalid_certs(true) // -k: testing only')
  const client = builder.length ? `reqwest::blocking::Client::builder()\n        ${builder.join('\n        ')}\n        .build()?` : 'reqwest::blocking::Client::new()'
  return [
    `// Cargo.toml: reqwest = { version = "0.12", features = [${features.map((f) => `"${f}"`).join(', ')}] }`,
    'fn main() -> Result<(), Box<dyn std::error::Error>> {',
    `    let client = ${client};`,
    ...pre,
    `    let res = ${chain.join('\n        ')};`,
    '',
    '    println!("{}", res.status());',
    req.head ? '    println!("{:#?}", res.headers());' : '    println!("{}", res.text()?);',
    '    Ok(())',
    '}',
  ].join('\n')
}

export function generate(req: ParsedRequest, lang: Language): string {
  switch (lang) {
    case 'fetch': return genFetch(req)
    case 'axios': return genAxios(req)
    case 'python': return genPython(req)
    case 'php': return genPhp(req)
    case 'go': return genGo(req)
    case 'rust': return genRust(req)
  }
}
