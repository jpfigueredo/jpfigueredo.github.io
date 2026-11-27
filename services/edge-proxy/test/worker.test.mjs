// Tests of the edge-proxy Worker, run in workerd through Miniflare.
//
// - The Worker is bundled the way it is deployed (`wrangler deploy --dry-run`)
//   into a temp dir, so these tests run the same JavaScript as production.
// - Miniflare and workerd are the versions wrangler itself depends on (resolved
//   from wrangler's own package), so no extra dependency and no version drift.
// - No network: every fetch the Worker makes goes to `fakeBff` or
//   `droppingBff` below (Miniflare outboundService, in this process). The BFF
//   host used here (`bff.test`) is never resolved.
// - Every Miniflare instance is disposed in `after`, so no workerd process is
//   left behind.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
const wranglerPkgJson = createRequire(join(pkgDir, 'package.json')).resolve('wrangler/package.json');
const wranglerBin = join(dirname(wranglerPkgJson), 'bin', 'wrangler.js');
const { Miniflare } = await import(
  pathToFileURL(createRequire(wranglerPkgJson).resolve('miniflare')).href
);

const compatibilityDate = readFileSync(join(pkgDir, 'wrangler.toml'), 'utf8').match(
  /^compatibility_date\s*=\s*"([^"]+)"/m,
)?.[1];
assert.ok(compatibilityDate, 'compatibility_date not found in wrangler.toml');

const SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'no-referrer-when-downgrade',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
  'content-security-policy': [
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
    "frame-ancestors 'self'",
  ].join('; '),
};
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,HEAD,OPTIONS',
  'access-control-allow-headers': 'Authorization,Content-Type',
};

function assertHeaders(res, expected) {
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(res.headers.get(name), value, `header ${name}`);
  }
}

// Fake BFF (Miniflare `fetcher` outbound service: gets the exact Request the
// Worker fetched). Records what reached it and answers by path.
// `upstream` is one array shared by every test (reset in `call`), so the tests
// must run one at a time: do not turn on `concurrency` in this file.
const upstream = [];
async function fakeBff(req) {
  const url = new URL(req.url);
  const body = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text();
  upstream.push({ method: req.method, url: req.url, headers: Object.fromEntries(req.headers), body });
  if (url.pathname === '/api/err') {
    return new Response('nope', { status: 503, statusText: 'Busy', headers: { 'Retry-After': '5' } });
  }
  if (url.pathname === '/api/cors') {
    return new Response('c', {
      headers: { 'Access-Control-Allow-Origin': 'https://only.me', 'X-Frame-Options': 'DENY', 'Set-Cookie': 'a=1' },
    });
  }
  if (url.pathname === '/api/redirect') {
    return new Response(null, { status: 302, headers: { Location: 'https://elsewhere.test/x' } });
  }
  return new Response(JSON.stringify({ path: url.pathname + url.search, method: req.method, len: body.length }), {
    headers: { 'Content-Type': 'application/json', 'X-Upstream': 'bff' },
  });
}

// Lines the Worker wrote with console.* (Miniflare structured logs), for
// every instance; reset in `call`, like `upstream`.
const logs = [];
// The one JSON log line of an /api/ request. Logs reach Node from workerd's
// stdout after the response, so wait for it.
async function apiLog() {
  const deadline = Date.now() + 5000;
  for (;;) {
    const line = logs.find((l) => l.message.startsWith('{'));
    if (line) return JSON.parse(line.message);
    assert.ok(Date.now() < deadline, `no /api/ log line; got ${JSON.stringify(logs)}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
// Lets late log lines arrive before a test greps all of them.
const settleLogs = () => new Promise((resolve) => setTimeout(resolve, 200));
const API_LOG_FIELDS = ['method', 'path', 'status', 'reason', 'upstream_ms'];
function assertApiLog(log, expected) {
  assert.deepEqual(Object.keys(log), API_LOG_FIELDS);
  for (const [name, value] of Object.entries(expected)) assert.equal(log[name], value, `log field ${name}`);
}
// Marked values for the credential test: none may reach a log.
const MARK = 'SECRET';

// BFF that is down: it drops every connection, so the Worker's fetch()
// rejects (a `fetcher` that throws would still answer with a 500 response).
function droppingBff(req) {
  upstream.push({ method: req.method, url: `(dropped) ${req.headers.host}${req.url}` });
  req.socket.destroy();
}

let outDir;
let script;
const instances = [];

function startWorker(bffHost, outboundService = { type: 'fetcher', handler: fakeBff }) {
  const mf = new Miniflare({
    handleStructuredLogs: (log) => logs.push(log),
    workers: [
      {
        config: {
          name: 'edge-proxy',
          compatibilityDate,
          manifest: { mainModule: 'index.js', modules: { 'index.js': { type: 'esm', contents: script } } },
          env: bffHost === undefined ? {} : { BFF_HOST: { type: 'text', value: bffHost } },
        },
        dev: { outboundService },
      },
    ],
  });
  instances.push(mf);
  return mf;
}

// One request; returns the response (body read) and what reached the BFF.
async function call(mf, path, init = {}) {
  upstream.length = 0;
  logs.length = 0;
  const res = await mf.dispatchFetch(`http://edge.test${path}`, init);
  const text = await res.text();
  return { res, text, upstream: [...upstream] };
}

before(() => {
  outDir = mkdtempSync(join(tmpdir(), 'edge-proxy-test-'));
  execFileSync(process.execPath, [wranglerBin, 'deploy', '--dry-run', '--outdir', outDir], {
    cwd: pkgDir,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_HIDE_BANNER: 'true' },
    stdio: ['ignore', 'ignore', 'inherit'],
    timeout: 120_000,
  });
  script = readFileSync(join(outDir, 'index.js'), 'utf8');
});

after(async () => {
  await Promise.all(instances.map((mf) => mf.dispose()));
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('outside /api/ (BFF_HOST set)', () => {
  let mf;
  before(() => {
    mf = startWorker('bff.test');
  });

  test('GET / answers locally with the security headers', async () => {
    const { res, text, upstream } = await call(mf, '/');
    assert.equal(res.status, 200);
    // Only /api/ requests are logged (nothing is waited for here, so this
    // only catches a log that arrives with the response).
    assert.deepEqual(logs, []);
    assert.equal(text, 'edge-proxy ok');
    assertHeaders(res, SECURITY_HEADERS);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
    assert.deepEqual(upstream, []);
  });

  test('HEAD / has no body and does not reach the BFF', async () => {
    const { res, text, upstream } = await call(mf, '/', { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal(text, '');
    assertHeaders(res, SECURITY_HEADERS);
    assert.deepEqual(upstream, []);
  });

  test('POST / is not proxied', async () => {
    const { res, text, upstream } = await call(mf, '/', { method: 'POST', body: 'x' });
    assert.equal(res.status, 200);
    assert.equal(text, 'edge-proxy ok');
    assert.deepEqual(upstream, []);
  });

  test('CORS preflight outside /api/ answers 204 with the CORS headers', async () => {
    const { res, text, upstream } = await call(mf, '/', {
      method: 'OPTIONS',
      headers: { Origin: 'https://a.test', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.status, 204);
    assert.equal(text, '');
    assertHeaders(res, CORS_HEADERS);
    assert.deepEqual(upstream, []);
  });

  for (const path of ['/api', '/apix', '/API/x']) {
    test(`${path} is not proxied (only the /api/ prefix is)`, async () => {
      const { res, text, upstream } = await call(mf, path);
      assert.equal(res.status, 200);
      assert.equal(text, 'edge-proxy ok');
      assert.deepEqual(upstream, []);
    });
  }
});

describe('proxy to the BFF (BFF_HOST set)', () => {
  let mf;
  before(() => {
    mf = startWorker('bff.test');
  });

  test('GET keeps path and query, switches to https on BFF_HOST', async () => {
    const { res, text, upstream } = await call(mf, '/api/echo?q=1&r=%C3%A7');
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(text), { path: '/api/echo?q=1&r=%C3%A7', method: 'GET', len: 0 });
    assert.equal(upstream.length, 1);
    assert.equal(upstream[0].method, 'GET');
    assert.equal(upstream[0].url, 'https://bff.test/api/echo?q=1&r=%C3%A7');
    assert.equal(res.headers.get('x-upstream'), 'bff');
    assert.equal(res.headers.get('content-type'), 'application/json');
  });

  test('logs method, path without query, status, reason and upstream time, and no credentials', async () => {
    const { res } = await call(mf, `/api/echo?token=${MARK}456`, {
      method: 'POST',
      body: `${MARK}-BODY`,
      headers: {
        Authorization: `Bearer ${MARK}123`,
        Cookie: `session=${MARK}789`,
        'User-Agent': `${MARK}-UA`,
        'X-Forwarded-For': '203.0.113.7',
      },
    });
    assert.equal(res.status, 200);
    const log = await apiLog();
    assertApiLog(log, { method: 'POST', path: '/api/echo', status: 200, reason: 'ok' });
    assert.equal(typeof log.upstream_ms, 'number');
    assert.ok(log.upstream_ms >= 0);
    await settleLogs();
    const all = JSON.stringify(logs);
    assert.ok(!all.includes(MARK), `a marked value reached the log: ${all}`);
    assert.ok(!all.includes('203.0.113.7'), `the client IP reached the log: ${all}`);
  });

  test('a BFF error status is logged as the final status', async () => {
    await call(mf, '/api/err');
    assertApiLog(await apiLog(), { method: 'GET', path: '/api/:other', status: 503, reason: 'ok' });
  });

  test('a path outside the BFF routes is logged as /api/:other', async () => {
    const { res } = await call(mf, `/api/x/${MARK}999/y`);
    assert.equal(res.status, 200);
    assertApiLog(await apiLog(), { method: 'GET', path: '/api/:other', status: 200, reason: 'ok' });
    await settleLogs();
    const all = JSON.stringify(logs);
    assert.ok(!all.includes(MARK), `a marked value reached the log: ${all}`);
  });

  for (const route of ['/api/health', '/api/echo', '/api/kafka-viz/state']) {
    test(`the BFF route ${route} is logged by name`, async () => {
      await call(mf, route);
      assertApiLog(await apiLog(), { method: 'GET', path: route, status: 200, reason: 'ok' });
    });
  }

  test('proxied response gets the CORS and security headers', async () => {
    const { res } = await call(mf, '/api/echo');
    assertHeaders(res, { ...CORS_HEADERS, ...SECURITY_HEADERS });
  });

  test('non-ASCII path reaches the BFF percent-encoded', async () => {
    const { upstream } = await call(mf, '/api/ação/\u{1F600}');
    assert.equal(upstream[0].url, 'https://bff.test/api/a%C3%A7%C3%A3o/%F0%9F%98%80');
  });

  test('POST forwards body, Authorization, Content-Type and Cookie', async () => {
    const { res, upstream } = await call(mf, '/api/echo', {
      method: 'POST',
      body: '{"a":1}',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json', Cookie: 'k=v' },
    });
    assert.equal(res.status, 200);
    assert.equal(upstream.length, 1);
    assert.equal(upstream[0].method, 'POST');
    assert.equal(upstream[0].body, '{"a":1}');
    assert.equal(upstream[0].headers.authorization, 'Bearer t');
    assert.equal(upstream[0].headers['content-type'], 'application/json');
    assert.equal(upstream[0].headers.cookie, 'k=v');
  });

  test('POST streams a 1 MiB body whole', async () => {
    const { res, text, upstream } = await call(mf, '/api/echo', { method: 'POST', body: 'x'.repeat(1024 * 1024) });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(text).len, 1024 * 1024);
    assert.equal(upstream[0].body.length, 1024 * 1024);
  });

  test('preflight under /api/ goes to the BFF and gets the CORS headers', async () => {
    const { res, upstream } = await call(mf, '/api/echo', {
      method: 'OPTIONS',
      headers: { Origin: 'https://a.test', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(upstream.length, 1);
    assert.equal(upstream[0].method, 'OPTIONS');
    assert.equal(res.status, 200);
    assertHeaders(res, CORS_HEADERS);
  });

  test('BFF error status, status text and headers pass through', async () => {
    const { res, text } = await call(mf, '/api/err');
    assert.equal(res.status, 503);
    assert.equal(res.statusText, 'Busy');
    assert.equal(res.headers.get('retry-after'), '5');
    assert.equal(text, 'nope');
    assertHeaders(res, CORS_HEADERS);
  });

  test('BFF CORS and frame headers are overwritten, other headers kept', async () => {
    const { res } = await call(mf, '/api/cors');
    assertHeaders(res, { ...CORS_HEADERS, ...SECURITY_HEADERS });
    assert.equal(res.headers.get('set-cookie'), 'a=1');
  });

  test('HEAD is proxied', async () => {
    const { res, text, upstream } = await call(mf, '/api/echo', { method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal(text, '');
    assert.equal(upstream.length, 1);
    assert.equal(upstream[0].method, 'HEAD');
  });

  for (const method of ['PUT', 'DELETE', 'PATCH']) {
    test(`${method} gets 405 with Allow and never reaches the BFF`, async () => {
      const { res, upstream } = await call(mf, '/api/echo', { method, body: method === 'DELETE' ? undefined : 'p' });
      assert.equal(res.status, 405);
      assert.equal(res.headers.get('allow'), 'GET, POST, HEAD, OPTIONS');
      assertHeaders(res, { ...CORS_HEADERS, ...SECURITY_HEADERS });
      assert.deepEqual(upstream, []);
      assertApiLog(await apiLog(), { method, path: '/api/echo', status: 405, reason: 'bad_method', upstream_ms: null });
    });
  }

  test('BFF redirect is returned, not followed', async () => {
    const { res, upstream } = await call(mf, '/api/redirect', { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://elsewhere.test/x');
    assert.equal(upstream.length, 1);
  });
});

describe('BFF down', () => {
  test('a dropped connection gives a 502 with reason upstream_error', async () => {
    const mf = startWorker('bff.test', { type: 'node-handler', handler: droppingBff });
    const { res, text, upstream } = await call(mf, `/api/echo?token=${MARK}456`, {
      method: 'POST',
      body: 'x',
      headers: { Authorization: `Bearer ${MARK}123`, Cookie: `session=${MARK}789` },
    });
    assert.ok(upstream.length >= 1, 'the Worker tried the BFF');
    assert.equal(upstream[0].url, `(dropped) bff.test/api/echo?token=${MARK}456`);
    assert.equal(res.status, 502);
    assert.equal(text, 'bad gateway');
    assertHeaders(res, { ...CORS_HEADERS, ...SECURITY_HEADERS });
    const log = await apiLog();
    assertApiLog(log, { method: 'POST', path: '/api/echo', status: 502, reason: 'upstream_error' });
    assert.equal(typeof log.upstream_ms, 'number');
    // The error message (it can hold the upstream URL and query) is not logged.
    await settleLogs();
    const all = JSON.stringify(logs);
    assert.ok(!all.includes(MARK), `a marked value reached the log: ${all}`);
  });
});

describe('BFF_HOST with a port', () => {
  test('the port is kept', async () => {
    const mf = startWorker('bff.test:8443');
    const { res, upstream } = await call(mf, '/api/echo?q=1');
    assert.equal(res.status, 200);
    assert.equal(upstream[0].url, 'https://bff.test:8443/api/echo?q=1');
  });
});

// Missing, invalid or placeholder BFF_HOST: /api/ answers 503 and nothing
// leaves the Worker.
for (const [label, bffHost] of [
  ['missing', undefined],
  ['the wrangler.toml placeholder', 'api.example.com'],
  ['the old fallback placeholder', 'your-cloud-run-host'],
  ['a placeholder with a port', 'api.example.com:443'],
  ['a URL with a scheme', 'https://x'],
  ['with credentials', 'a@b'],
  ['upper case', 'BFF.test'],
  ['a port above 65535', 'bff.test:70000'],
]) {
  describe(`BFF_HOST ${label}`, () => {
    let mf;
    before(() => {
      mf = startWorker(bffHost);
    });

    test('/api/ answers 503 without calling the BFF', async () => {
      const { res, text, upstream } = await call(mf, '/api/echo?q=1');
      assert.equal(res.status, 503);
      assert.equal(text, 'upstream not configured');
      assertHeaders(res, { ...CORS_HEADERS, ...SECURITY_HEADERS });
      assert.deepEqual(upstream, []);
      assertApiLog(await apiLog(), {
        method: 'GET',
        path: '/api/echo',
        status: 503,
        reason: 'upstream_not_configured',
        upstream_ms: null,
      });
    });
  });
}

describe('BFF_HOST missing, outside /api/', () => {
  test('GET / still answers locally', async () => {
    const mf = startWorker(undefined);
    const { res, text, upstream } = await call(mf, '/');
    assert.equal(res.status, 200);
    assert.equal(text, 'edge-proxy ok');
    assert.deepEqual(upstream, []);
  });
});
