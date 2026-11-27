function withSecurityHeaders(resp: Response): Response {
  const headers = new Headers(resp.headers);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'no-referrer-when-downgrade');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'"
  ].join('; '));
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

// Methods proxied under /api/ (OPTIONS is the CORS preflight). Anything else
// gets a 405 and never reaches the BFF.
const PROXY_METHODS = ['GET', 'POST', 'HEAD', 'OPTIONS'];

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': PROXY_METHODS.join(','),
  'Access-Control-Allow-Headers': 'Authorization,Content-Type'
};

// BFF_HOST must be a lowercase host name, optionally with a port. Anything
// else (scheme, path, credentials, upper case) is rejected, so the value
// never reaches the URL host setter unchecked.
const BFF_HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/;
// Placeholder values from wrangler.toml and the old fallback: not a BFF.
const PLACEHOLDER_HOSTS = new Set(['api.example.com', 'your-cloud-run-host']);

// The BFF origin (https://host[:port]), or null when BFF_HOST is missing,
// invalid or a placeholder.
function bffOrigin(bffHost: string | undefined): string | null {
  if (bffHost === undefined || !BFF_HOST_PATTERN.test(bffHost)) return null;
  const hostname = bffHost.split(':')[0];
  if (PLACEHOLDER_HOSTS.has(hostname)) return null;
  try {
    // Throws on a port above 65535. The host name must come back unchanged
    // (no normalisation, e.g. of numeric IPv4 forms).
    const origin = new URL(`https://${bffHost}`);
    return origin.hostname === hostname ? origin.origin : null;
  } catch {
    return null;
  }
}

function apiError(status: number, message: string, extra: Record<string, string> = {}): Response {
  return withSecurityHeaders(
    new Response(message, { status, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain', ...extra } })
  );
}

// One log line per /api/ request. Allowlist: these fields are the only data
// ever logged. Never add headers, cookies, IP, user agent, query string, body
// or error messages (an upstream error can carry the URL and its query).
type ApiReason = 'ok' | 'bad_method' | 'upstream_not_configured' | 'upstream_error';
interface ApiLog {
  method: string; // request method, or OTHER if it is not a known one
  path: string; // URL path, without the query string
  status: number; // status sent to the client
  reason: ApiReason;
  upstream_ms: number | null; // time to the BFF response headers; null if not called
}
const KNOWN_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'CONNECT', 'TRACE']);

function logApi(entry: ApiLog): void {
  const line: ApiLog = {
    method: KNOWN_METHODS.has(entry.method) ? entry.method : 'OTHER',
    path: entry.path,
    status: entry.status,
    reason: entry.reason,
    upstream_ms: entry.upstream_ms
  };
  console.log(JSON.stringify(line));
}

export default {
  async fetch(request: Request, env: { BFF_HOST?: string }): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const log = { method: request.method, path: url.pathname };
      if (!PROXY_METHODS.includes(request.method)) {
        logApi({ ...log, status: 405, reason: 'bad_method', upstream_ms: null });
        return apiError(405, 'method not allowed', { Allow: PROXY_METHODS.join(', ') });
      }
      // Fail closed: no valid BFF_HOST, no request leaves the Worker.
      const origin = bffOrigin(env.BFF_HOST);
      if (origin === null) {
        logApi({ ...log, status: 503, reason: 'upstream_not_configured', upstream_ms: null });
        return apiError(503, 'upstream not configured');
      }
      const target = new URL(url.pathname + url.search, origin);
      const started = Date.now();
      let proxied: Response;
      try {
        proxied = await fetch(new Request(target.toString(), request));
      } catch {
        // fetch() rejected: the BFF could not be reached.
        logApi({ ...log, status: 502, reason: 'upstream_error', upstream_ms: Date.now() - started });
        return apiError(502, 'bad gateway');
      }
      const upstreamMs = Date.now() - started;
      const resp = new Response(proxied.body, proxied);
      for (const [name, value] of Object.entries(CORS_HEADERS)) resp.headers.set(name, value);
      logApi({ ...log, status: resp.status, reason: 'ok', upstream_ms: upstreamMs });
      return withSecurityHeaders(resp);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    return withSecurityHeaders(new Response('edge-proxy ok', { status: 200 }));
  }
} satisfies ExportedHandler<{ BFF_HOST?: string }>;
