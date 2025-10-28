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

export default {
  async fetch(request: Request, env: { BFF_HOST?: string }): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const target = new URL(request.url);
      target.host = env.BFF_HOST || 'your-cloud-run-host';
      target.protocol = 'https:';
      const proxied = await fetch(new Request(target.toString(), request));
      // Add CORS for frontend origin(s) if needed
      const resp = new Response(proxied.body, proxied);
      resp.headers.set('Access-Control-Allow-Origin', '*');
      resp.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      resp.headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
      return withSecurityHeaders(resp);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization,Content-Type'
        }
      });
    }

    return withSecurityHeaders(new Response('edge-proxy ok', { status: 200 }));
  }
} satisfies ExportedHandler;
