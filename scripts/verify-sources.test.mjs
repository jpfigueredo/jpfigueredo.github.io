// Tests for scripts/verify-sources.mjs. Built-in test runner, no network: every
// request goes to an injected fetch and every DNS answer comes from an injected
// resolver. The seeds are synthetic, written to a temporary directory, except
// for the tests that read the real canonical seed (still without network).
//   node --test scripts/verify-sources.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CONCURRENCY,
  MAX_REDIRECTS,
  USER_AGENT,
  checkUrl,
  classify,
  invokedAsCli,
  isBlockedAddress,
  legacyTargets,
  loadDatasets,
  mapLimit,
  oharaTargets,
  parseArgs,
  renderReport,
  resultText,
  run,
  screenUrl,
} from './verify-sources.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const REPO = join(SCRIPTS, '..');
const SCRIPT = join(SCRIPTS, 'verify-sources.mjs');

// ---------------------------------------------------------------- fixtures

const temps = [];
after(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

function tempRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'verify-sources-'));
  temps.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

const PUBLIC_IP = '8.8.8.8';
// Every name resolves to a public address unless listed.
const resolver = (table = {}) => {
  const calls = [];
  const fn = async (host) => {
    calls.push(host);
    if (host in table) {
      const v = table[host];
      if (v instanceof Error) throw v;
      return v.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
    }
    return [{ address: PUBLIC_IP, family: 4 }];
  };
  fn.calls = calls;
  return fn;
};

// Fake fetch. `routes` maps "METHOD url" (or "url" for any method) to a status,
// a [status, headers] pair, a function (init) => Response, or an Error to throw.
// Unknown requests answer 404. Every call is recorded.
const fakeFetch = (routes = {}) => {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const route = routes[`${init.method} ${url}`] ?? routes[url] ?? 404;
    if (route instanceof Error) throw route;
    if (typeof route === 'function') return route(init);
    const [status, headers] = Array.isArray(route) ? route : [route, {}];
    return new Response(status === 204 || status === 304 || (status >= 300 && status < 400) ? null : 'x', { status, headers });
  };
  fn.calls = calls;
  return fn;
};

const noFetch = () => {
  const fn = async (url) => {
    fn.calls.push(url);
    throw new Error(`fetch must not be called (${url})`);
  };
  fn.calls = [];
  return fn;
};

const noSleep = () => {
  const fn = async (ms) => fn.calls.push(ms);
  fn.calls = [];
  return fn;
};

const oharaSeed = (nodes) => ({ trail: { id: 't', title: 'T', tags: ['x'] }, nodes, edges: [] });

// ------------------------------------------------------------ classification

describe('classify', () => {
  for (const [url, klass] of [
    ['https://doi.org/10.1145/359545.359563', 'primary'],
    ['https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf', 'primary'],
    ['https://arxiv.org/abs/1234.5678', 'primary'],
    ['https://www.youtube.com/watch?v=abc', 'avoid'],
    ['https://youtu.be/abc', 'avoid'],
    ['https://x.com/someone', 'avoid'],
    ['https://medium.com/@someone/post', 'avoid'],
    ['https://www.example.org/blog/post', 'avoid'],
    ['https://www.example.org/about', 'avoid'],
    ['https://lamport.azurewebsites.net/pubs/time-clocks.pdf', 'unclassified'],
    ['https://www.dropbox.com/s/paper.pdf', 'unclassified'], // x.com only as a domain
    ['https://summit.edu/paper.pdf', 'unclassified'], // mit.edu only as a domain
    ['https://example.org/compressed/paper.pdf', 'unclassified'], // "press" only as a path segment
    ['not a url', 'avoid'],
  ]) {
    it(`${url} -> ${klass}`, () => assert.equal(classify(url).klass, klass));
  }
});

// ---------------------------------------------------------- address screen

describe('isBlockedAddress', () => {
  for (const a of [
    '127.0.0.1', '127.255.255.254', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '192.0.2.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '::ffff:10.0.0.1',
    '64:ff9b::7f00:1', '2002:7f00:1::', 'not-an-ip', '',
  ]) {
    it(`blocks ${a || '(empty)'}`, () => assert.equal(isBlockedAddress(a), true));
  }
  for (const a of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    it(`allows ${a}`, () => assert.equal(isBlockedAddress(a), false));
  }
});

describe('screenUrl (SSRF and scheme screen)', () => {
  for (const [url, reason] of [
    ['http://example.org/', /https only/],
    ['ftp://example.org/f', /https only/],
    ['javascript:alert(1)', /https only/],
    ['file:///etc/passwd', /https only/],
    ['https://user:secret@example.org/', /credentials/],
    ['https://127.0.0.1/', /non-public address 127\.0\.0\.1/],
    ['https://2130706433/', /non-public address 127\.0\.0\.1/], // decimal form of 127.0.0.1
    ['https://0x7f.1/', /non-public address 127\.0\.0\.1/], // hex shorthand
    ['https://169.254.169.254/latest/meta-data/', /non-public address 169\.254/],
    ['https://10.0.0.8:8443/admin', /non-public address 10\./],
    ['https://[::1]/', /non-public address ::1/],
    ['https://[::ffff:127.0.0.1]/', /non-public address/],
    ['https://[fd00::1]/', /non-public address/],
    ['https://localhost/', /local name/],
    ['https://api.localhost/', /local name/],
    ['https://metadata/computeMetadata/v1/', /single-label/],
    ['not a url', /not a URL/],
  ]) {
    it(`refuses ${url} without a DNS lookup`, async () => {
      const resolve = resolver();
      assert.match(await screenUrl(url, resolve), reason);
      assert.deepEqual(resolve.calls, []);
    });
  }

  it('refuses a name that resolves to a private address', async () => {
    const resolve = resolver({ 'internal.example.org': ['10.0.0.5'] });
    assert.match(await screenUrl('https://internal.example.org/x', resolve), /resolves to non-public address 10\.0\.0\.5/);
  });

  it('refuses a name with one public and one loopback address', async () => {
    const resolve = resolver({ 'mixed.example.org': ['8.8.8.8', '::1'] });
    assert.match(await screenUrl('https://mixed.example.org/', resolve), /non-public address ::1/);
  });

  it('refuses a name that resolves to the cloud metadata address', async () => {
    const resolve = resolver({ 'metadata.google.internal': ['169.254.169.254'] });
    assert.match(await screenUrl('https://metadata.google.internal/', resolve), /169\.254\.169\.254/);
  });

  it('refuses when DNS fails or returns nothing', async () => {
    const err = Object.assign(new Error('nope'), { code: 'ENOTFOUND' });
    assert.match(await screenUrl('https://gone.example.org/', resolver({ 'gone.example.org': err })), /DNS lookup failed \(ENOTFOUND\)/);
    assert.match(await screenUrl('https://empty.example.org/', resolver({ 'empty.example.org': [] })), /no address/);
  });

  it('lets a public https URL through (trailing dot and public IP literal too)', async () => {
    assert.equal(await screenUrl('https://example.org/paper.pdf', resolver()), null);
    assert.equal(await screenUrl('https://example.org./paper.pdf', resolver()), null);
    assert.equal(await screenUrl('https://8.8.8.8/', resolver()), null);
  });
});

// ------------------------------------------------------------------ checkUrl

describe('checkUrl', () => {
  const U = 'https://example.org/paper.pdf';

  it('never calls fetch for a loopback, private or metadata URL', async () => {
    for (const url of ['https://127.0.0.1/', 'https://[::1]/', 'https://169.254.169.254/', 'http://example.org/']) {
      const fetchImpl = noFetch();
      const r = await checkUrl(url, { fetchImpl, resolveHost: resolver(), sleep: noSleep() });
      assert.equal(r.ok, false);
      assert.ok(r.refused, url);
      assert.deepEqual(fetchImpl.calls, [], url);
    }
  });

  it('never calls fetch for a name that resolves to a private address, and does not retry', async () => {
    const fetchImpl = noFetch();
    const sleep = noSleep();
    const r = await checkUrl('https://rebind.example.org/', { fetchImpl, resolveHost: resolver({ 'rebind.example.org': ['192.168.0.10'] }), sleep });
    assert.match(r.refused, /192\.168\.0\.10/);
    assert.deepEqual(fetchImpl.calls, []);
    assert.deepEqual(sleep.calls, []);
  });

  it('refuses a redirect to a private address and never requests it', async () => {
    const fetchImpl = fakeFetch({ [U]: [302, { location: 'https://169.254.169.254/latest/meta-data/' }] });
    const r = await checkUrl(U, { fetchImpl, resolveHost: resolver(), sleep: noSleep() });
    assert.equal(r.ok, false);
    assert.match(r.refused, /169\.254\.169\.254/);
    assert.deepEqual(fetchImpl.calls.map((c) => c.url), [U]);
  });

  it('refuses a redirect that resolves to loopback by name', async () => {
    const fetchImpl = fakeFetch({ [U]: [301, { location: 'https://evil.example.net/' }] });
    const r = await checkUrl(U, { fetchImpl, resolveHost: resolver({ 'evil.example.net': ['127.0.0.1'] }), sleep: noSleep() });
    assert.match(r.refused, /127\.0\.0\.1/);
    assert.deepEqual(fetchImpl.calls.map((c) => c.url), [U]);
  });

  it('refuses a redirect down to http', async () => {
    const fetchImpl = fakeFetch({ [U]: [301, { location: 'http://example.org/paper.pdf' }] });
    const r = await checkUrl(U, { fetchImpl, resolveHost: resolver(), sleep: noSleep() });
    assert.match(r.refused, /https only/);
    assert.equal(fetchImpl.calls.length, 1);
  });

  it('follows a relative redirect and reports the final URL', async () => {
    const fetchImpl = fakeFetch({ [U]: [301, { location: '/v2/paper.pdf' }], 'https://example.org/v2/paper.pdf': [200, { 'content-type': 'application/pdf' }] });
    const r = await checkUrl(U, { fetchImpl, resolveHost: resolver(), sleep: noSleep() });
    assert.equal(r.ok, true);
    assert.equal(r.status, 200);
    assert.equal(r.redirects, 1);
    assert.equal(r.finalUrl, 'https://example.org/v2/paper.pdf');
    assert.equal(r.contentType, 'application/pdf');
  });

  it(`stops after ${MAX_REDIRECTS} redirects (loop) with a bounded number of requests`, async () => {
    const fetchImpl = fakeFetch({ [U]: [302, { location: U }] });
    const r = await checkUrl(U, { fetchImpl, resolveHost: resolver(), sleep: noSleep(), retries: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.status, 302);
    assert.match(r.error, /more than 5 redirects/);
    // HEAD and GET, each MAX_REDIRECTS + 1 requests.
    assert.equal(fetchImpl.calls.length, 2 * (MAX_REDIRECTS + 1));
  });

  it('a redirect without Location is broken', async () => {
    const r = await checkUrl(U, { fetchImpl: fakeFetch({ [U]: 301 }), resolveHost: resolver(), sleep: noSleep() });
    assert.equal(r.ok, false);
    assert.match(r.error, /without Location/);
  });

  it('sends a generic User-Agent, no credentials, manual redirects and a timeout signal', async () => {
    const fetchImpl = fakeFetch({ [`HEAD ${U}`]: 405, [`GET ${U}`]: 206 });
    const r = await checkUrl(U, { fetchImpl, resolveHost: resolver(), sleep: noSleep() });
    assert.equal(r.ok, true);
    assert.equal(r.status, 206);
    assert.deepEqual(fetchImpl.calls.map((c) => c.init.method), ['HEAD', 'GET']);
    for (const { init } of fetchImpl.calls) {
      assert.equal(init.redirect, 'manual');
      assert.equal(init.credentials, 'omit');
      assert.ok(init.signal instanceof AbortSignal);
      const names = Object.keys(init.headers).map((h) => h.toLowerCase());
      assert.equal(init.headers['user-agent'], USER_AGENT);
      assert.doesNotMatch(USER_AGENT, /github|actions|jpfig|ohara|@|https?:/i);
      for (const forbidden of ['authorization', 'cookie', 'proxy-authorization', 'x-github-token']) {
        assert.equal(names.includes(forbidden), false, forbidden);
      }
    }
    assert.equal(fetchImpl.calls[1].init.headers.range, 'bytes=0-0');
  });

  it('times out a request that never answers', async () => {
    const hang = (init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    const r = await checkUrl(U, { fetchImpl: fakeFetch({ [U]: hang }), resolveHost: resolver(), sleep: noSleep(), timeoutMs: 20, retries: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.status, 0);
    assert.equal(r.error, 'TimeoutError');
  });

  it('retries once after a 503 and then succeeds', async () => {
    let n = 0;
    const flaky = () => new Response(null, { status: n++ < 2 ? 503 : 200 });
    const sleep = noSleep();
    const r = await checkUrl(U, { fetchImpl: fakeFetch({ [U]: flaky }), resolveHost: resolver(), sleep });
    assert.equal(r.ok, true);
    assert.equal(sleep.calls.length, 1);
  });

  it('does not retry a 404 (HEAD then GET, two requests)', async () => {
    const fetchImpl = fakeFetch();
    const sleep = noSleep();
    const r = await checkUrl(U, { fetchImpl, resolveHost: resolver(), sleep });
    assert.equal(r.ok, false);
    assert.equal(r.status, 404);
    assert.equal(fetchImpl.calls.length, 2);
    assert.deepEqual(sleep.calls, []);
  });

  it('a network error is broken with its code, after one retry', async () => {
    const err = Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
    const fetchImpl = fakeFetch({ [U]: err });
    const sleep = noSleep();
    const r = await checkUrl(U, { fetchImpl, resolveHost: resolver(), sleep });
    assert.equal(r.ok, false);
    assert.equal(r.error, 'ECONNRESET');
    assert.equal(fetchImpl.calls.length, 4);
    assert.equal(sleep.calls.length, 1);
  });
});

describe('mapLimit', () => {
  it(`keeps order and never runs more than the limit at once (CONCURRENCY = ${CONCURRENCY})`, async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([...Array(20).keys()], CONCURRENCY, async (x) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      return x * 2;
    });
    assert.deepEqual(out, [...Array(20).keys()].map((x) => x * 2));
    assert.equal(peak, CONCURRENCY);
  });

  it('handles an empty list', async () => assert.deepEqual(await mapLimit([], 4, async () => 1), []));
});

// ------------------------------------------------------------------ datasets

describe('oharaTargets (schema format: sources[] objects)', () => {
  it('checks free sources only and counts every other URL as not checked', () => {
    const { targets, notChecked } = oharaTargets(oharaSeed([
      { id: 'a', label: 'A', sources: [{ sourceType: 'free', url: 'https://a.example.org/a.pdf' }],
        explainers: [{ label: 'E', kind: 'video', sourceType: 'free', url: 'https://youtube.com/watch?v=1' }] },
      { id: 'b', label: 'B', sources: [{ sourceType: 'retail', provider: 'acm', url: 'https://dl.acm.org/doi/1' }] },
      { id: 'c', label: 'C', sources: [{ sourceType: 'retail', provider: 'amazon', query: 'c book' }],
        explainers: [{ label: 'R', kind: 'book', sourceType: 'retail', query: 'r' }] },
      { id: 'd', label: 'D', sources: [{ sourceType: 'free', url: 'https://d.example.org/1' }, { sourceType: 'preview-embed', url: 'https://d.example.org/p' }] },
    ]));
    assert.deepEqual(targets, [
      { id: 'a', label: 'A', url: 'https://a.example.org/a.pdf' },
      { id: 'd', label: 'D', url: 'https://d.example.org/1' },
    ]);
    assert.equal(notChecked, 3);
  });

  it('tolerates missing or malformed arrays', () => {
    assert.deepEqual(oharaTargets({}), { targets: [], notChecked: 0 });
    assert.deepEqual(oharaTargets({ nodes: [{ id: 'a', sources: 'x' }, null] }), { targets: [], notChecked: 0 });
  });

  it('the canonical seed yields one target per free source, all https', () => {
    const seed = JSON.parse(readFileSync(join(REPO, 'packages/ohara-data/seed.distributed-systems.json'), 'utf8'));
    const free = seed.nodes.flatMap((n) => n.sources.filter((s) => s.sourceType === 'free'));
    const { targets } = oharaTargets(seed);
    assert.ok(free.length > 0);
    assert.equal(targets.length, free.length);
    for (const t of targets) assert.match(t.url, /^https:\/\/[^/\s]+/);
  });
});

describe('legacyTargets (sources[] strings + link rules)', () => {
  it('checks string sources and suggests a missing canonical link', () => {
    const rules = new Map([['n1', { id: 'n1', preferred: ['https://doi.org/1'], notes: 'use DOI' }], ['n2', { id: 'n2', preferred: ['https://doi.org/2'] }]]);
    const { targets, suggestions } = legacyTargets({ nodes: [
      { id: 'n1', label: 'N1', sources: ['https://example.org/n1', 42] },
      { id: 'n2', label: 'N2', sources: ['https://doi.org/2'] },
    ] }, rules);
    assert.deepEqual(targets.map((t) => t.url), ['https://example.org/n1', 'https://doi.org/2']);
    assert.deepEqual(suggestions, [{ id: 'n1', label: 'N1', preferred: ['https://doi.org/1'], notes: 'use DOI' }]);
  });
});

describe('loadDatasets', () => {
  it('reads the Ohara seed from packages/ohara-data in the real repository', async () => {
    const ds = await loadDatasets(REPO);
    const ohara = ds.filter((d) => d.kind === 'ohara').map((d) => d.file);
    assert.ok(ohara.includes('packages/ohara-data/seed.distributed-systems.json'), ohara.join(','));
    assert.ok(ds.find((d) => d.kind === 'ohara').targets.length > 0);
  });

  it('reads Ohara seeds and legacy seeds, ignoring other files in the package', async () => {
    const dir = tempRepo({
      'packages/ohara-data/seed.alpha.json': oharaSeed([{ id: 'a', label: 'A', sources: [{ sourceType: 'free', url: 'https://a.example.org/' }] }]),
      'packages/ohara-data/schema.json': { $id: 'x' },
      'packages/ohara-data/seed.json': '{', // not seed.<name>.json: ignored
      'web/src/data/old/seed.json': { nodes: [{ id: 'o', label: 'O', sources: ['https://o.example.org/'] }] },
      'web/src/data/old/link-rules.json': { rules: [{ id: 'o', preferred: ['https://doi.org/o'] }] },
    });
    const ds = await loadDatasets(dir);
    assert.deepEqual(ds.map((d) => [d.file, d.kind, d.targets.length, d.suggestions.length]), [
      ['packages/ohara-data/seed.alpha.json', 'ohara', 1, 0],
      ['web/src/data/old/seed.json', 'legacy', 1, 1],
    ]);
  });

  it('fails without an Ohara seed, or with an unreadable one', async () => {
    await assert.rejects(loadDatasets(tempRepo({ 'packages/ohara-data/schema.json': {} })), /no Ohara seed/);
    await assert.rejects(loadDatasets(tempRepo({ 'web/src/data/a/seed.json': { nodes: [] } })), /cannot list packages\/ohara-data/);
    await assert.rejects(loadDatasets(tempRepo({ 'packages/ohara-data/seed.bad.json': '{' })), /cannot read packages\/ohara-data\/seed\.bad\.json/);
  });
});

// ------------------------------------------------------------------- report

describe('renderReport', () => {
  it('lists free sources by node with HTTP status, class and result, and escapes Markdown', () => {
    const md = renderReport([{
      file: 'packages/ohara-data/seed.t.json', kind: 'ohara', notChecked: 2, suggestions: [],
      results: [
        { id: 'a', label: 'Paper | A', url: 'https://doi.org/1', ok: true, status: 200, redirects: 0, klass: 'primary' },
        { id: 'b', label: 'B', url: 'https://b.example.org/', ok: false, status: 404, klass: 'unclassified' },
        { id: 'c', label: 'C', url: 'https://127.0.0.1/', ok: false, status: 0, refused: 'non-public address 127.0.0.1', klass: 'unclassified' },
      ],
    }], '2026-01-01T00:00:00.000Z');
    assert.match(md, /Checked 3 URL\(s\): 1 ok, 1 broken, 1 refused\./);
    assert.match(md, /Not checked: 2 other URL\(s\)/);
    assert.match(md, /\| B \| https:\/\/b\.example\.org\/ \| 404 \| unclassified \| BROKEN \|/);
    assert.match(md, /\| C \| https:\/\/127\.0\.0\.1\/ \| - \| unclassified \| REFUSED: non-public address 127\.0\.0\.1 \|/);
    assert.match(md, /\| Paper \\\| A \| https:\/\/doi\.org\/1 \| 200 \| primary \| ok \|/);
    // Failures first.
    assert.ok(md.indexOf('| B |') < md.indexOf('| Paper'));
  });

  it('names the redirect hop that was refused or broke', () => {
    assert.equal(
      resultText({ ok: false, refused: 'scheme http: (https only)', redirects: 2, finalUrl: 'http://example.org/x' }),
      'REFUSED: scheme http: (https only) (after 2 redirect(s), at http://example.org/x)',
    );
    assert.equal(resultText({ ok: false, status: 404, redirects: 1, finalUrl: 'https://example.org/y' }), 'BROKEN (after 1 redirect(s), at https://example.org/y)');
    assert.equal(resultText({ ok: true, redirects: 0 }), 'ok');
  });
});

// ---------------------------------------------------------------------- run

describe('run', () => {
  const seedFiles = (url2 = 'https://b.example.org/b.pdf') => ({
    'packages/ohara-data/seed.t.json': oharaSeed([
      { id: 'a', label: 'A', sources: [{ sourceType: 'free', url: 'https://doi.org/10.1/a' }] },
      { id: 'b', label: 'B', sources: [{ sourceType: 'free', url: url2 }] },
    ]),
    'web/src/data/old/seed.json': { nodes: [{ id: 'o', label: 'O', sources: ['https://o.example.org/'] }] },
  });
  const allOk = () => fakeFetch(Object.fromEntries(['https://doi.org/10.1/a', 'https://b.example.org/b.pdf', 'https://o.example.org/'].map((u) => [u, 200])));
  const capture = () => {
    const lines = { out: [], err: [] };
    return { lines, log: (s) => lines.out.push(s), err: (s) => lines.err.push(s) };
  };
  const NOW = () => new Date('2026-01-01T00:00:00Z');

  it('--ci exits 0 and writes the report when every source answers', async () => {
    const dir = tempRepo(seedFiles());
    const { lines, log, err } = capture();
    const code = await run(['--ci'], { repoRoot: dir, fetchImpl: allOk(), resolveHost: resolver(), sleep: noSleep(), log, err, now: NOW });
    assert.equal(code, 0, lines.err.join('\n'));
    const report = readFileSync(join(dir, 'reports/links.md'), 'utf8');
    assert.match(report, /## packages\/ohara-data\/seed\.t\.json/);
    assert.match(report, /## web\/src\/data\/old\/seed\.json/);
    assert.match(report, /\| A \| https:\/\/doi\.org\/10\.1\/a \| 200 \| primary \| ok \|/);
    assert.match(lines.out.join('\n'), /checked 3 URL\(s\) in 2 seed\(s\): 0 failed/);
  });

  it('a broken source: --ci exits 1 with ::error, --warn exits 0 with ::warning, no flag exits 0', async () => {
    const dir = tempRepo(seedFiles('https://b.example.org/gone'));
    for (const [argv, code, prefix] of [[['--ci'], 1, '::error '], [['--warn'], 0, '::warning '], [[], 0, 'packages/']]) {
      const { lines, log, err } = capture();
      assert.equal(await run(argv, { repoRoot: dir, fetchImpl: allOk(), resolveHost: resolver(), sleep: noSleep(), log, err, now: NOW }), code, argv.join(' '));
      assert.equal(lines.err.length, 1);
      assert.ok(lines.err[0].startsWith(prefix), lines.err[0]);
      assert.match(lines.err[0], /seed\.t\.json b: https:\/\/b\.example\.org\/gone HTTP 404 BROKEN/);
    }
  });

  it('a loopback URL in the seed is refused, never fetched, and fails --ci', async () => {
    const dir = tempRepo(seedFiles('https://127.0.0.1:8080/admin'));
    const fetchImpl = allOk();
    const { lines, log, err } = capture();
    assert.equal(await run(['--ci'], { repoRoot: dir, fetchImpl, resolveHost: resolver(), sleep: noSleep(), log, err, now: NOW }), 1);
    assert.equal(fetchImpl.calls.some((c) => c.url.includes('127.0.0.1')), false);
    assert.match(lines.err[0], /REFUSED: non-public address 127\.0\.0\.1/);
  });

  it('exits 2 on a bad argument, a missing Ohara seed or a seed with no free source', async () => {
    const opts = { fetchImpl: noFetch(), resolveHost: resolver(), sleep: noSleep(), log: () => {}, err: () => {} };
    assert.equal(await run(['--nope'], { repoRoot: tempRepo(seedFiles()), ...opts }), 2);
    assert.equal(await run(['--out'], { repoRoot: tempRepo(seedFiles()), ...opts }), 2);
    assert.equal(await run([], { repoRoot: tempRepo({ 'web/src/data/a/seed.json': { nodes: [] } }), ...opts }), 2);
    const noFree = tempRepo({ 'packages/ohara-data/seed.t.json': oharaSeed([{ id: 'a', label: 'A', sources: [{ sourceType: 'retail', query: 'q' }] }]) });
    assert.equal(await run([], { repoRoot: noFree, ...opts }), 2);
  });

  it('--out writes the report where asked', async () => {
    const dir = tempRepo(seedFiles());
    assert.equal(await run(['--out', 'out/r.md'], { repoRoot: dir, fetchImpl: allOk(), resolveHost: resolver(), sleep: noSleep(), log: () => {}, err: () => {}, now: NOW }), 0);
    assert.match(readFileSync(join(dir, 'out/r.md'), 'utf8'), /# Source link report/);
  });

  it('parseArgs: defaults', () => assert.deepEqual(parseArgs([]), { mode: 'report', out: 'reports/links.md' }));
});

describe('CLI entry point', () => {
  const URL_OF = pathToFileURL(SCRIPT).href;

  it('invokedAsCli: true only when argv[1] is this file (also through a symlink)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'verify-sources-cli-'));
    temps.push(dir);
    const link = join(dir, 'v.mjs');
    symlinkSync(SCRIPT, link);
    assert.equal(invokedAsCli(URL_OF, SCRIPT), true);
    assert.equal(invokedAsCli(URL_OF, link), true);
    assert.equal(invokedAsCli(URL_OF, join(SCRIPTS, 'extract-references.mjs')), false);
    assert.equal(invokedAsCli(URL_OF, ''), false);
  });

  it('importing the module runs nothing (no network, no report)', () => {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(URL_OF)}); console.log('imported');`], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, 'imported\n');
  });

  it('a bad argument by path exits 2 before any request', () => {
    const r = spawnSync(process.execPath, [SCRIPT, '--bogus'], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /unknown or incomplete argument: --bogus/);
  });
});
