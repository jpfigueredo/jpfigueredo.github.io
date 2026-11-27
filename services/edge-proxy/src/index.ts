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

export default {
  async fetch(request: Request, env: { BFF_HOST?: string }): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (!PROXY_METHODS.includes(request.method)) {
        return apiError(405, 'method not allowed', { Allow: PROXY_METHODS.join(', ') });
      }
      // Fail closed: no valid BFF_HOST, no request leaves the Worker.
      const origin = bffOrigin(env.BFF_HOST);
      if (origin === null) {
        return apiError(503, 'upstream not configured');
      }
      const target = new URL(url.pathname + url.search, origin);
      const proxied = await fetch(new Request(target.toString(), request));
      const resp = new Response(proxied.body, proxied);
      for (const [name, value] of Object.entries(CORS_HEADERS)) resp.headers.set(name, value);
      return withSecurityHeaders(resp);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    return withSecurityHeaders(new Response('edge-proxy ok', { status: 200 }));
  }
} satisfies ExportedHandler<{ BFF_HOST?: string }>;
