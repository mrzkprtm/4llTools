export interface StatusCode {
  code: number
  name: string
  /** Plain-language explanation. */
  desc: string
  /** When to send it / typical scenario. */
  when: string
  /** Common causes and fixes (mostly for errors). */
  fixes?: string
  /** Headers that usually go with it. */
  headers?: string[]
  /** Not registered with IANA (vendor or framework specific). */
  unofficial?: string
  /** Deprecated or unused. */
  deprecated?: boolean
  /** Specification that defines it. */
  spec?: string
}

/** Codes cacheable by default (heuristically cacheable per RFC 9110 §15.1). */
export const CACHEABLE = new Set([200, 203, 204, 206, 300, 301, 308, 404, 405, 410, 414, 501])

export const CLASSES: Record<string, string> = {
  '1': 'Informational',
  '2': 'Success',
  '3': 'Redirection',
  '4': 'Client error',
  '5': 'Server error',
}

export const classOf = (code: number) => String(Math.floor(code / 100))

export const CODES: StatusCode[] = [
  // ---------- 1xx ----------
  { code: 100, name: 'Continue', spec: 'RFC 9110', desc: 'The server got the request headers and the client should go ahead and send the body.', when: 'A client sent Expect: 100-continue before uploading a large body, and the server is willing to accept it.', headers: ['Expect'] },
  { code: 101, name: 'Switching Protocols', spec: 'RFC 9110', desc: 'The server agrees to switch to the protocol the client asked for in the Upgrade header.', when: 'Opening a WebSocket connection (Upgrade: websocket) or upgrading to h2c.', headers: ['Upgrade', 'Connection', 'Sec-WebSocket-Accept'] },
  { code: 102, name: 'Processing', spec: 'RFC 2518', deprecated: true, desc: 'WebDAV: the server is still working on the request and no response is ready yet.', when: 'Long WebDAV operations, to stop the client timing out. Rarely used today.' },
  { code: 103, name: 'Early Hints', spec: 'RFC 8297', desc: 'A preliminary response with Link headers so the browser can start preloading while the server prepares the real response.', when: 'Sending Link: rel=preload / preconnect hints for CSS, fonts or origins while the page is still being generated.', headers: ['Link'] },

  // ---------- 2xx ----------
  { code: 200, name: 'OK', spec: 'RFC 9110', desc: 'The request succeeded and the response contains the result.', when: 'The default success response for GET, and for POST/PUT when you return a body.' },
  { code: 201, name: 'Created', spec: 'RFC 9110', desc: 'The request succeeded and a new resource was created.', when: 'After POST creates a record (or PUT creates one at a new URL). Point to it with Location.', headers: ['Location', 'ETag'] },
  { code: 202, name: 'Accepted', spec: 'RFC 9110', desc: 'The request was accepted for processing, but processing has not finished.', when: 'Queued background jobs, batch imports, async APIs. Return a status URL the client can poll.', headers: ['Location', 'Retry-After'] },
  { code: 203, name: 'Non-Authoritative Information', spec: 'RFC 9110', desc: 'Success, but a transforming proxy changed the payload from the origin’s 200 response.', when: 'Proxies that modify content. Almost never sent by applications.' },
  { code: 204, name: 'No Content', spec: 'RFC 9110', desc: 'Success, and there is intentionally no response body.', when: 'DELETE, PUT or PATCH that has nothing to return, or saving a form without navigating away. Answering a CORS preflight.', fixes: 'Do not send a body with 204; some clients fail to parse the next response if you do.' },
  { code: 205, name: 'Reset Content', spec: 'RFC 9110', desc: 'Success; the client should reset the document view (e.g. clear the form).', when: 'After a form submission where the user will enter another item. Rarely used.' },
  { code: 206, name: 'Partial Content', spec: 'RFC 9110', desc: 'The response contains only the byte ranges the client asked for.', when: 'Video/audio seeking, resumable downloads, requests with a Range header.', headers: ['Content-Range', 'Accept-Ranges', 'Range'] },
  { code: 207, name: 'Multi-Status', spec: 'RFC 4918', desc: 'WebDAV: the body is an XML document with separate status codes for several resources.', when: 'Batch operations where each item can succeed or fail separately.' },
  { code: 208, name: 'Already Reported', spec: 'RFC 5842', desc: 'WebDAV: members of a binding were already listed earlier in this multistatus response.', when: 'Avoiding repeated enumeration of the same collection in WebDAV.' },
  { code: 226, name: 'IM Used', spec: 'RFC 3229', desc: 'The server applied instance manipulations (a delta encoding) to the current instance.', when: 'HTTP delta encoding. Very rare in practice.', headers: ['IM', 'A-IM'] },

  // ---------- 3xx ----------
  { code: 300, name: 'Multiple Choices', spec: 'RFC 9110', desc: 'There are several representations of the resource and the client should pick one.', when: 'Content negotiation with a list of choices. Rarely used; servers usually choose automatically.', headers: ['Location'] },
  { code: 301, name: 'Moved Permanently', spec: 'RFC 9110', desc: 'The resource has a new permanent URL; clients and search engines should use it from now on.', when: 'Changing domains, forcing HTTPS or www, restructuring URLs. Passes SEO value to the new URL.', fixes: 'Browsers may change POST to GET when following a 301; use 308 to keep the method. Browsers cache 301s hard, so test with 302 first.', headers: ['Location'] },
  { code: 302, name: 'Found', spec: 'RFC 9110', desc: 'The resource is temporarily at another URL; keep using the original URL.', when: 'Temporary redirects such as login redirects or maintenance pages.', fixes: 'Browsers usually turn POST into GET. Use 303 for “go GET this page after a POST”, or 307 to keep the method.', headers: ['Location'] },
  { code: 303, name: 'See Other', spec: 'RFC 9110', desc: 'Go fetch another URL with GET to see the result.', when: 'Post/Redirect/Get: after a form POST, redirect to a result page so refreshing does not resubmit.', headers: ['Location'] },
  { code: 304, name: 'Not Modified', spec: 'RFC 9110', desc: 'The cached copy the client already has is still valid, so no body is sent.', when: 'Replying to conditional requests (If-None-Match / If-Modified-Since) when nothing changed.', headers: ['ETag', 'Last-Modified', 'Cache-Control', 'If-None-Match', 'If-Modified-Since'] },
  { code: 305, name: 'Use Proxy', spec: 'RFC 9110', deprecated: true, desc: 'Deprecated: the resource had to be accessed through a proxy.', when: 'Do not use. Browsers ignore it for security reasons.' },
  { code: 306, name: '(Unused)', spec: 'RFC 9110', deprecated: true, desc: 'Reserved. It was “Switch Proxy” in an old draft and is no longer used.', when: 'Never send this code.' },
  { code: 307, name: 'Temporary Redirect', spec: 'RFC 9110', desc: 'Temporarily at another URL; repeat the request there with the same method and body.', when: 'Temporary redirects of POST/PUT requests, or internal HTTP → HTTPS redirects from HSTS in browsers.', headers: ['Location'] },
  { code: 308, name: 'Permanent Redirect', spec: 'RFC 9110', desc: 'Permanently moved; repeat the request at the new URL with the same method and body.', when: 'Permanent API endpoint moves where POST must stay POST.', headers: ['Location'] },

  // ---------- 4xx ----------
  { code: 400, name: 'Bad Request', spec: 'RFC 9110', desc: 'The server cannot process the request because it is malformed.', when: 'Invalid JSON, missing required fields, wrong types, bad query parameters.', fixes: 'Check the request body and Content-Type header match, validate JSON, and read the error body for which field failed. Oversized or corrupt cookies can cause it too.' },
  { code: 401, name: 'Unauthorized', spec: 'RFC 9110', desc: 'Authentication is required and was missing or invalid (it really means “unauthenticated”).', when: 'No token, expired token, wrong password.', fixes: 'Send valid credentials (Authorization: Bearer …), refresh expired tokens, check the token audience/issuer and clock skew.', headers: ['WWW-Authenticate', 'Authorization'] },
  { code: 402, name: 'Payment Required', spec: 'RFC 9110', desc: 'Reserved for future use; some APIs use it when a payment or plan upgrade is needed.', when: 'Billing failures or quota tied to a paid plan (e.g. Stripe, SaaS APIs).', fixes: 'Check your account billing or subscription.' },
  { code: 403, name: 'Forbidden', spec: 'RFC 9110', desc: 'The server understood who you are but refuses to allow the action.', when: 'Logged in but lacking permission, IP blocks, WAF blocks, directory listing disabled.', fixes: 'Check user roles/scopes, file permissions on the server (e.g. chmod 644/755), WAF or bot-protection rules, and missing CSRF tokens.' },
  { code: 404, name: 'Not Found', spec: 'RFC 9110', desc: 'There is nothing at this URL (or the server hides that it exists).', when: 'Unknown URLs, deleted records, wrong IDs. Also used instead of 403 to avoid revealing a resource exists.', fixes: 'Check spelling, trailing slashes, case sensitivity, base path and API version; for SPAs configure the server to fall back to index.html.' },
  { code: 405, name: 'Method Not Allowed', spec: 'RFC 9110', desc: 'The URL exists but does not support this HTTP method.', when: 'POST to a read-only endpoint, DELETE not implemented.', fixes: 'Use a method listed in the Allow header. A CORS preflight (OPTIONS) failing with 405 means the server does not handle OPTIONS.', headers: ['Allow'] },
  { code: 406, name: 'Not Acceptable', spec: 'RFC 9110', desc: 'The server cannot produce a response matching the client’s Accept headers.', when: 'Client asks for Accept: application/xml but only JSON is available.', fixes: 'Relax the Accept header or add a supported format.', headers: ['Accept', 'Accept-Language', 'Accept-Encoding'] },
  { code: 407, name: 'Proxy Authentication Required', spec: 'RFC 9110', desc: 'Like 401, but the proxy between you and the server needs credentials.', when: 'Corporate proxies requiring login.', fixes: 'Configure proxy credentials in your client or system settings.', headers: ['Proxy-Authenticate', 'Proxy-Authorization'] },
  { code: 408, name: 'Request Timeout', spec: 'RFC 9110', desc: 'The server gave up waiting for the client to finish sending the request.', when: 'Slow or stalled uploads, idle keep-alive connections being closed.', fixes: 'Retry; check network stability and upload size; increase server read timeouts if legitimate.', headers: ['Connection: close'] },
  { code: 409, name: 'Conflict', spec: 'RFC 9110', desc: 'The request conflicts with the current state of the resource.', when: 'Duplicate unique values (email already registered), edit conflicts, version mismatches.', fixes: 'Reload the latest state, resolve the conflict and retry.' },
  { code: 410, name: 'Gone', spec: 'RFC 9110', desc: 'The resource used to exist and was removed permanently, with no forwarding address.', when: 'Deleted content you want search engines to drop quickly, retired API versions.' },
  { code: 411, name: 'Length Required', spec: 'RFC 9110', desc: 'The server requires a Content-Length header.', when: 'Uploads sent with chunked encoding to servers that do not accept it.', fixes: 'Send Content-Length (most HTTP clients do this when the body size is known).', headers: ['Content-Length'] },
  { code: 412, name: 'Precondition Failed', spec: 'RFC 9110', desc: 'A condition in the request headers (If-Match, If-Unmodified-Since) was false.', when: 'Optimistic concurrency: someone else changed the resource since you read it.', fixes: 'Fetch the latest version (new ETag) and retry.', headers: ['If-Match', 'If-Unmodified-Since', 'ETag'] },
  { code: 413, name: 'Content Too Large', spec: 'RFC 9110', desc: 'The request body is larger than the server allows (formerly “Payload Too Large”).', when: 'File uploads over the limit.', fixes: 'Upload smaller files or raise limits (nginx client_max_body_size, PHP upload_max_filesize/post_max_size, body-parser limit).', headers: ['Retry-After'] },
  { code: 414, name: 'URI Too Long', spec: 'RFC 9110', desc: 'The URL is longer than the server will process.', when: 'Huge query strings, redirect loops appending parameters.', fixes: 'Send large data in a POST body instead of the query string.' },
  { code: 415, name: 'Unsupported Media Type', spec: 'RFC 9110', desc: 'The server does not accept the request body’s format.', when: 'Sending form data to a JSON-only API, or missing Content-Type.', fixes: 'Set the right Content-Type (e.g. application/json) and encode the body to match.', headers: ['Content-Type', 'Accept-Post', 'Accept-Patch'] },
  { code: 416, name: 'Range Not Satisfiable', spec: 'RFC 9110', desc: 'The requested byte range is outside the file.', when: 'Resuming a download of a file that has since changed or shrunk.', fixes: 'Restart the download without a Range header.', headers: ['Content-Range'] },
  { code: 417, name: 'Expectation Failed', spec: 'RFC 9110', desc: 'The server cannot meet the Expect request header.', when: 'Expect: 100-continue not supported by a proxy.', fixes: 'Remove the Expect header (e.g. curl -H "Expect:").', headers: ['Expect'] },
  { code: 418, name: "I'm a teapot", unofficial: 'RFC 2324 April Fools joke; reserved by IANA as unused', desc: 'A joke from the Hyper Text Coffee Pot Control Protocol: the server refuses to brew coffee because it is a teapot.', when: 'Easter eggs; some sites return it to bots they want to reject.' },
  { code: 419, name: 'Page Expired', unofficial: 'Laravel', desc: 'Laravel: the CSRF token is missing or expired.', when: 'Submitting a form after the session expired.', fixes: 'Include @csrf in forms / X-CSRF-TOKEN in AJAX requests, and check session and cookie domain settings.' },
  { code: 420, name: 'Enhance Your Calm', unofficial: 'Twitter API v1 (legacy)', desc: 'Old Twitter API rate-limit response; today’s equivalent is 429.', when: 'Legacy clients only.' },
  { code: 421, name: 'Misdirected Request', spec: 'RFC 9110', desc: 'The request reached a server that cannot answer for this host.', when: 'HTTP/2 connection reuse across hostnames where the certificate or virtual host does not match.', fixes: 'Check TLS certificates and virtual host (SNI) configuration.' },
  { code: 422, name: 'Unprocessable Content', spec: 'RFC 9110', desc: 'The request is well-formed but its content fails validation.', when: 'Validation errors: password too short, invalid email, business rules. Popular in Rails and Laravel APIs.', fixes: 'Read the error body for the failing fields and fix the input.' },
  { code: 423, name: 'Locked', spec: 'RFC 4918', desc: 'WebDAV: the resource is locked.', when: 'Editing a file someone else has locked.' },
  { code: 424, name: 'Failed Dependency', spec: 'RFC 4918', desc: 'WebDAV: the action failed because another action it depended on failed.', when: 'Batch operations where an earlier step failed.' },
  { code: 425, name: 'Too Early', spec: 'RFC 8470', desc: 'The server will not process a request that might be replayed (sent in TLS 1.3 early data).', when: 'Rejecting non-idempotent requests sent as 0-RTT data.', fixes: 'Retry after the TLS handshake completes (clients do this automatically).' },
  { code: 426, name: 'Upgrade Required', spec: 'RFC 9110', desc: 'The server refuses the current protocol and requires an upgrade.', when: 'Requiring TLS or a newer HTTP version.', headers: ['Upgrade'] },
  { code: 428, name: 'Precondition Required', spec: 'RFC 6585', desc: 'The server requires the request to be conditional (If-Match) to avoid lost updates.', when: 'APIs that force optimistic locking on updates.', fixes: 'Send If-Match with the ETag you last received.', headers: ['If-Match'] },
  { code: 429, name: 'Too Many Requests', spec: 'RFC 6585', desc: 'You sent too many requests in a given time (rate limiting).', when: 'API rate limits, login brute-force protection, scraping protection.', fixes: 'Wait for Retry-After, use exponential backoff with jitter, cache responses, batch requests.', headers: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'] },
  { code: 431, name: 'Request Header Fields Too Large', spec: 'RFC 6585', desc: 'The request headers (often cookies) are too big.', when: 'Too many or too large cookies, huge tokens in headers.', fixes: 'Clear cookies for the site, shrink JWTs, or raise the server header buffer (nginx large_client_header_buffers).' },
  { code: 444, name: 'No Response', unofficial: 'nginx', desc: 'nginx: close the connection without sending anything. Only visible in logs; clients see a dropped connection.', when: 'Blocking malicious or unwanted requests silently.' },
  { code: 451, name: 'Unavailable For Legal Reasons', spec: 'RFC 7725', desc: 'The resource is blocked for legal reasons, such as a court order or government censorship.', when: 'Geo-blocking for legal compliance, DMCA takedowns.', headers: ['Link (rel="blocked-by")'] },
  { code: 494, name: 'Request Header Too Large', unofficial: 'nginx', desc: 'nginx: the client sent headers that are too large (nginx’s own variant of 431).', when: 'Oversized cookies or headers hitting nginx buffers.', fixes: 'Clear cookies or raise large_client_header_buffers.' },
  { code: 495, name: 'SSL Certificate Error', unofficial: 'nginx', desc: 'nginx: the client certificate is invalid.', when: 'Mutual TLS setups.', fixes: 'Check the client certificate chain and expiry.' },
  { code: 496, name: 'SSL Certificate Required', unofficial: 'nginx', desc: 'nginx: a client certificate was required but not sent.', when: 'Mutual TLS setups.', fixes: 'Configure the client to present its certificate.' },
  { code: 497, name: 'HTTP Request Sent to HTTPS Port', unofficial: 'nginx', desc: 'nginx: plain HTTP was sent to a port expecting HTTPS.', when: 'Misconfigured URLs like http://example.com:443.', fixes: 'Use https:// or redirect with error_page 497.' },
  { code: 499, name: 'Client Closed Request', unofficial: 'nginx', desc: 'nginx: the client closed the connection before the server answered. Only visible in server logs.', when: 'Users navigating away, client timeouts shorter than server processing time.', fixes: 'Speed up slow endpoints or raise the client/load balancer timeout.' },

  // ---------- 5xx ----------
  { code: 500, name: 'Internal Server Error', spec: 'RFC 9110', desc: 'Something went wrong on the server and it has no more specific code.', when: 'Unhandled exceptions, bugs, misconfiguration.', fixes: 'Check server logs for the stack trace; common causes are uncaught exceptions, bad .htaccess rules, missing env variables, database errors.' },
  { code: 501, name: 'Not Implemented', spec: 'RFC 9110', desc: 'The server does not support the functionality needed (usually an unknown method).', when: 'Unrecognized HTTP methods, features not built yet.' },
  { code: 502, name: 'Bad Gateway', spec: 'RFC 9110', desc: 'A proxy or gateway got an invalid response from the upstream server.', when: 'nginx or a load balancer cannot talk to your app (crashed, wrong port, malformed response).', fixes: 'Check the app process is running and listening on the port the proxy expects; check upstream logs and response header sizes (proxy_buffer_size).' },
  { code: 503, name: 'Service Unavailable', spec: 'RFC 9110', desc: 'The server is temporarily unable to handle requests (overload or maintenance).', when: 'Planned maintenance, overload shedding, no healthy backends.', fixes: 'Retry later (honour Retry-After); scale up or check health checks. For maintenance, send Retry-After so crawlers come back.', headers: ['Retry-After'] },
  { code: 504, name: 'Gateway Timeout', spec: 'RFC 9110', desc: 'A proxy or gateway did not get a response from upstream in time.', when: 'Slow database queries or long-running requests behind nginx, a CDN or a load balancer.', fixes: 'Optimize the slow endpoint, move long work to background jobs (202), or raise proxy_read_timeout / load balancer idle timeout.' },
  { code: 505, name: 'HTTP Version Not Supported', spec: 'RFC 9110', desc: 'The server does not support the HTTP version used in the request.', when: 'Very old or very new protocol versions against an incompatible server.' },
  { code: 506, name: 'Variant Also Negotiates', spec: 'RFC 2295', desc: 'Server misconfiguration in transparent content negotiation (circular reference).', when: 'Rare server configuration errors.' },
  { code: 507, name: 'Insufficient Storage', spec: 'RFC 4918', desc: 'WebDAV: the server cannot store what is needed to complete the request.', when: 'Disk full or quota exceeded.', fixes: 'Free disk space or raise the quota.' },
  { code: 508, name: 'Loop Detected', spec: 'RFC 5842', desc: 'WebDAV: the server found an infinite loop while processing the request.', when: 'Circular bindings in WebDAV collections.' },
  { code: 509, name: 'Bandwidth Limit Exceeded', unofficial: 'Apache / cPanel', desc: 'The hosting account has used its bandwidth allowance.', when: 'Shared hosting bandwidth caps.', fixes: 'Wait for the quota to reset or upgrade the hosting plan.' },
  { code: 510, name: 'Not Extended', spec: 'RFC 2774', deprecated: true, desc: 'Further extensions to the request are required (HTTP Extension Framework, now historic).', when: 'Practically never.' },
  { code: 511, name: 'Network Authentication Required', spec: 'RFC 6585', desc: 'You must log in to the network before getting access (a captive portal).', when: 'Hotel, airport and café Wi-Fi login pages.', fixes: 'Open any http:// page in a browser to reach the portal and sign in.' },
  { code: 520, name: 'Web Server Returned an Unknown Error', unofficial: 'Cloudflare', desc: 'Cloudflare: the origin returned an empty, unknown or unexpected response.', when: 'Origin crashes, resets connections or sends oversized headers.', fixes: 'Check origin logs, header sizes (over 32 KB?) and firewall rules resetting Cloudflare IPs.' },
  { code: 521, name: 'Web Server Is Down', unofficial: 'Cloudflare', desc: 'Cloudflare: the origin refused the connection.', when: 'Origin web server stopped, or blocking Cloudflare IP ranges.', fixes: 'Start the web server and allow Cloudflare IP ranges in the firewall.' },
  { code: 522, name: 'Connection Timed Out', unofficial: 'Cloudflare', desc: 'Cloudflare: the TCP connection to the origin timed out.', when: 'Origin overloaded, wrong DNS origin IP, firewall dropping packets.', fixes: 'Check the origin IP in DNS, server load, and that the firewall allows Cloudflare.' },
  { code: 523, name: 'Origin Is Unreachable', unofficial: 'Cloudflare', desc: 'Cloudflare: the origin could not be reached (routing/DNS problem).', when: 'Wrong origin IP or network routing issues.', fixes: 'Verify DNS A/AAAA records point to the right server.' },
  { code: 524, name: 'A Timeout Occurred', unofficial: 'Cloudflare', desc: 'Cloudflare: connected to the origin but it did not reply within 100 seconds.', when: 'Long-running requests such as reports or exports.', fixes: 'Make the request faster or process it in the background and poll.' },
  { code: 525, name: 'SSL Handshake Failed', unofficial: 'Cloudflare', desc: 'Cloudflare: the TLS handshake with the origin failed.', when: 'Origin has no valid TLS setup in Full/Strict SSL mode, or cipher mismatch.', fixes: 'Install a valid certificate on the origin (e.g. a Cloudflare Origin CA certificate) and check SNI support.' },
  { code: 526, name: 'Invalid SSL Certificate', unofficial: 'Cloudflare', desc: 'Cloudflare: the origin’s certificate could not be validated (Full Strict mode).', when: 'Expired, self-signed or hostname-mismatched origin certificate.', fixes: 'Renew or replace the origin certificate, or use a Cloudflare Origin CA certificate.' },
  { code: 530, name: 'Origin DNS Error / Frozen', unofficial: 'Cloudflare / Pantheon', desc: 'Cloudflare: returned alongside a 1xxx error such as a DNS resolution failure for the origin.', when: 'Misconfigured origin DNS or tunnels.', fixes: 'Check the accompanying Cloudflare 1xxx error code.' },
]

export function findCode(code: number): StatusCode | undefined {
  return CODES.find((c) => c.code === code)
}

export function searchCodes(query: string, cls: string | null): StatusCode[] {
  const q = query.trim().toLowerCase()
  return CODES.filter((c) => {
    if (cls && classOf(c.code) !== cls) return false
    if (!q) return true
    if (/^\d{1,3}$/.test(q)) return String(c.code).startsWith(q)
    if (/^\dxx$/.test(q)) return classOf(c.code) === q[0]
    return [c.name, c.desc, c.when, c.fixes ?? '', c.unofficial ?? '', ...(c.headers ?? [])].some((s) => s.toLowerCase().includes(q))
  })
}

/** Best-effort description for a code that is not in the list. */
export function describeUnknown(code: number): string {
  const cls = CLASSES[classOf(code)]
  return cls ? `${code} is not a registered code. Clients treat unknown codes like x00 of their class: ${cls.toLowerCase()} (${classOf(code)}00).` : `${code} is outside the valid 100–599 range.`
}
