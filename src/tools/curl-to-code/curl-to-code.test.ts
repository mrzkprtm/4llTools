import { describe, expect, it } from 'vitest'
import { generate, LANGUAGES } from './generate'
import { jsonBody, parseCurl, tokenizeBash, tokenizeCmd } from './parse'

describe('tokenizer', () => {
  it('handles quotes, escapes and continuations', () => {
    expect(tokenizeBash(`curl 'a b' "c \\"d\\" $x" e\\ f \\\n -H x`)).toEqual(['curl', 'a b', 'c "d" $x', 'e f', '-H', 'x'])
    expect(tokenizeBash(`echo $'line1\\nit\\'s \\x41\\u00e9'`)).toEqual(['echo', "line1\nit's Aé"])
    expect(tokenizeBash(`a"b"'c'`)).toEqual(['abc'])
    expect(() => tokenizeBash(`curl 'oops`)).toThrow()
  })

  it('handles Chrome "Copy as cURL (cmd)" output', () => {
    const cmd = 'curl ^"https://api.example.com/x?a=1^&b=2^" ^\n  -H ^"content-type: application/json^" ^\n  --data-raw ^"^{^\\^"name^\\^":^\\^"Budi^\\^"^}^"'
    expect(tokenizeCmd(cmd)).toEqual(['curl', 'https://api.example.com/x?a=1&b=2', '-H', 'content-type: application/json', '--data-raw', '{"name":"Budi"}'])
    const r = parseCurl(cmd)
    expect(r.url).toBe('https://api.example.com/x?a=1&b=2')
    expect(jsonBody(r)).toEqual({ name: 'Budi' })
  })
})

describe('parseCurl', () => {
  it('parses a typical POST', () => {
    const r = parseCurl(`curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -H "Authorization: Bearer t0k" -d '{"name":"Siti","age":30}'`)
    expect(r.method).toBe('POST')
    expect(r.url).toBe('https://api.example.com/users')
    expect(r.headers).toEqual([['Content-Type', 'application/json'], ['Authorization', 'Bearer t0k']])
    expect(jsonBody(r)).toEqual({ name: 'Siti', age: 30 })
  })

  it('infers methods and joins data', () => {
    expect(parseCurl('curl example.com').method).toBe('GET')
    expect(parseCurl('curl example.com').url).toBe('http://example.com')
    const r = parseCurl('curl https://x.io -d a=1 --data b=2 --data-urlencode "q=hello world"')
    expect(r.method).toBe('POST')
    expect(r.body).toEqual({ kind: 'raw', text: 'a=1&b=2&q=hello%20world' })
    expect(r.headers).toContainEqual(['Content-Type', 'application/x-www-form-urlencoded'])
    expect(parseCurl('curl -I https://x.io').method).toBe('HEAD')
    expect(parseCurl('curl -XDELETE https://x.io/1').method).toBe('DELETE')
    expect(parseCurl('curl --request=PATCH https://x.io/1').method).toBe('PATCH')
  })

  it('moves data to the query string with -G', () => {
    const r = parseCurl('curl -G https://x.io/search?x=1 -d q=cat -d page=2')
    expect(r.method).toBe('GET')
    expect(r.url).toBe('https://x.io/search?x=1&q=cat&page=2')
    expect(r.body).toBeUndefined()
  })

  it('handles --json, auth, cookies, agents and combined flags', () => {
    const r = parseCurl(`curl -sSLk --compressed -u admin:$API_PASS -b 'a=1; b=2' -A 'MyAgent/1.0' -e https://ref.example --json '{"ok":true}' --url https://x.io/api`)
    expect(r.method).toBe('POST')
    expect(r.url).toBe('https://x.io/api')
    expect(r.auth).toEqual({ user: 'admin', pass: '$API_PASS' })
    expect(r.insecure && r.followRedirects && r.compressed).toBe(true)
    expect(r.headers).toContainEqual(['Cookie', 'a=1; b=2'])
    expect(r.headers).toContainEqual(['User-Agent', 'MyAgent/1.0'])
    expect(r.headers).toContainEqual(['Referer', 'https://ref.example'])
    expect(r.headers).toContainEqual(['Content-Type', 'application/json'])
    expect(r.headers).toContainEqual(['Accept', 'application/json'])
  })

  it('parses multipart forms', () => {
    const r = parseCurl('curl -F name=Budi -F "photo=@/tmp/me.jpg;type=image/jpeg" https://x.io/upload')
    expect(r.method).toBe('POST')
    expect(r.body).toEqual({ kind: 'form', fields: [{ name: 'name', value: 'Budi', type: undefined }, { name: 'photo', file: '/tmp/me.jpg', type: 'image/jpeg' }] })
  })

  it('notes unknown options and errors helpfully', () => {
    expect(parseCurl('curl --frobnicate https://x.io').notes.join()).toMatch(/frobnicate/)
    expect(parseCurl('curl -d @body.json https://x.io').notes.join()).toMatch(/body\.json/)
    expect(() => parseCurl('curl -H')).toThrow(/needs a value/)
    expect(() => parseCurl('curl -s')).toThrow(/No URL/)
    expect(() => parseCurl('')).toThrow()
  })
})

describe('generators', () => {
  const post = parseCurl(`curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -H 'X-Api-Key: abc' -d '{"name":"Siti","tags":["a"],"active":true,"x":null}'`)
  const form = parseCurl('curl -k -u u:p -F name=Budi -F "file=@photo.png" https://x.io/up')

  it('generates fetch', () => {
    const c = generate(post, 'fetch')
    expect(c).toContain("await fetch('https://api.example.com/users'")
    expect(c).toContain("method: 'POST'")
    expect(c).toContain("'X-Api-Key': 'abc'")
    expect(c).toContain('JSON.stringify(')
    expect(generate(form, 'fetch')).toContain('new FormData()')
    expect(generate(form, 'fetch')).toContain(`Authorization: 'Basic ${btoa('u:p')}'`)
  })

  it('generates axios', () => {
    const c = generate(post, 'axios')
    expect(c).toContain("import axios from 'axios'")
    expect(c).toContain("method: 'post'")
    expect(c).toContain("name: 'Siti'")
    const f = generate(form, 'axios')
    expect(f).toContain('fs.createReadStream(\'photo.png\')')
    expect(f).toContain('rejectUnauthorized: false')
    expect(f).toContain("username: 'u'")
  })

  it('generates python', () => {
    const c = generate(post, 'python')
    expect(c).toContain('requests.post("https://api.example.com/users", headers=headers, json=json_data)')
    expect(c).toContain('"active": True')
    expect(c).toContain('"x": None')
    expect(c).not.toContain('"Content-Type"')
    const f = generate(form, 'python')
    expect(f).toContain('files=files')
    expect(f).toContain('auth=("u", "p")')
    expect(f).toContain('verify=False')
  })

  it('generates php', () => {
    const c = generate(post, 'php')
    expect(c).toContain("curl_setopt($ch, CURLOPT_URL, 'https://api.example.com/users');")
    expect(c).toContain('CURLOPT_POST, true')
    expect(c).toContain(`CURLOPT_POSTFIELDS, '{"name":"Siti","tags":["a"],"active":true,"x":null}'`)
    expect(generate(form, 'php')).toContain("new CURLFile('photo.png')")
    expect(generate(parseCurl("curl -X PUT -d \"it's\" x.io"), 'php')).toContain("'it\\'s'")
  })

  it('generates go', () => {
    const c = generate(post, 'go')
    expect(c).toContain('package main')
    expect(c).toContain('http.NewRequest("POST", "https://api.example.com/users", data)')
    expect(c).toContain('req.Header.Set("X-Api-Key", "abc")')
    const f = generate(form, 'go')
    expect(f).toContain('multipart.NewWriter')
    expect(f).toContain('InsecureSkipVerify: true')
    expect(f).toContain('req.SetBasicAuth("u", "p")')
  })

  it('generates rust', () => {
    const c = generate(post, 'rust')
    expect(c).toContain('client.post("https://api.example.com/users")')
    expect(c).toContain('.header("X-Api-Key", "abc")')
    expect(c).toContain('r#"{"name":"Siti"')
    const f = generate(form, 'rust')
    expect(f).toContain('danger_accept_invalid_certs(true)')
    expect(f).toContain('"multipart"')
    expect(generate(parseCurl('curl -X PURGE https://x.io'), 'rust')).toContain('Method::from_bytes')
  })

  it('produces output for every language without throwing', () => {
    const head = parseCurl('curl -I -L https://x.io')
    for (const { id } of LANGUAGES) {
      expect(generate(head, id).length).toBeGreaterThan(20)
      expect(generate(post, id)).toContain('api.example.com')
    }
  })
})
