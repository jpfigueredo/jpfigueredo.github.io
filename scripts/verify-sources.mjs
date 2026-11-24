#!/usr/bin/env node
// Source link verifier. Checks that the free sources of each trail seed still
// answer over HTTPS, classifies each URL (primary / avoid / unclassified) and
// writes a Markdown report.
//
// What it reads:
//   - Ohara trail seeds, from their one canonical place:
//     packages/ohara-data/seed.*.json (format: packages/ohara-data/schema.json).
//     A node's sources are objects; only `sourceType: "free"` sources are
//     checked (the schema requires a `url` on them). Retail and preview-embed
//     sources and the explainers (secondary material, not sources) are counted
//     as "not checked" in the report.
//   - Older datasets under web/src/data/**/seed.json, whose nodes[].sources[]
//     are plain URL strings, plus their link-rules.json (canonical link
//     suggestions).
//
// Network safety. The URLs come from reviewed seeds, but this runs on CI
// runners, so every request is screened anyway:
//   - https: only; URLs with credentials are refused;
//   - the host must not be (or resolve to) a loopback, private, link-local,
//     CGNAT, multicast, documentation or otherwise reserved address, and
//     single-label names and *.localhost are refused (SSRF against the runner
//     and its metadata endpoints);
//   - redirects are followed by hand, at most MAX_REDIRECTS, and every hop is
//     screened again;
//   - no credentials, cookies or tokens are sent, and the User-Agent is a
//     generic one;
//   - every request has a timeout, at most CONCURRENCY requests run at once,
//     and a GET asks for one byte and drops the body.
//   Residual risk: the address is screened before fetch() resolves the name
//   again, so a host that changes its DNS answer in between (rebinding) is not
//   caught. Acceptable for URLs that come from a reviewed file.
//
// Usage:
//   node scripts/verify-sources.mjs [--ci | --warn] [--out <file>]
//     --ci    exit 1 if any URL is broken or refused (::error annotations)
//     --warn  print ::warning annotations, always exit 0 (pull requests)
//     --out   report path (default reports/links.md)
// Exit codes: 0 ok (or report-only); 1 broken/refused links with --ci;
// 2 usage error, unreadable seed, or nothing to check.

import { lookup } from 'node:dns/promises';
import { realpathSync } from 'node:fs';
import { glob, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { BlockList, isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { annotation, md, oneLine } from './lib/gate-report.mjs';

export const OHARA_DATA_DIR = 'packages/ohara-data';
export const OHARA_SEED_NAME = /^seed\.[a-z0-9-]+\.json$/;
export const LEGACY_SEED_GLOB = 'web/src/data/**/seed.json';
export const LEGACY_RULES_GLOB = 'web/src/data/**/link-rules.json';

export const USER_AGENT = 'link-checker/1.0';
export const TIMEOUT_MS = 15_000;
export const MAX_REDIRECTS = 5;
export const CONCURRENCY = 4;
export const RETRY_DELAY_MS = 2_000;

const PREFER_DOMAINS = [
  'arxiv.org', 'doi.org', 'dl.acm.org', 'ieeexplore.ieee.org', 'jstor.org',
  'springer.com', 'nature.com', 'science.org', 'mit.edu', 'stanford.edu',
  'harvard.edu', 'cmu.edu', 'berkeley.edu', 'ox.ac.uk', 'cam.ac.uk',
  'dartmouth.edu', 'nist.gov', 'nasa.gov', 'loc.gov', 'archive.org', 'w3.org',
];
// Social, video and blogging hosts: secondary by nature.
const AVOID_DOMAINS = ['linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 'medium.com', 'youtube.com', 'youtu.be'];
// Corporate and marketing paths.
const AVOID_PATHS = /\/(about|careers|company|press|blog)(\/|$)/i;

// Matches the domain and its subdomains only (x.com, not dropbox.com).
const onDomain = (host, domain) => host === domain || host.endsWith(`.${domain}`);

export function classify(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { host: '', klass: 'avoid' };
  }
  const host = u.hostname.toLowerCase();
  if (AVOID_DOMAINS.some((d) => onDomain(host, d)) || AVOID_PATHS.test(u.pathname)) return { host, klass: 'avoid' };
  if (PREFER_DOMAINS.some((d) => onDomain(host, d))) return { host, klass: 'primary' };
  return { host, klass: 'unclassified' };
}

// ------------------------------------------------------------ address screen

const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
]) BLOCKED.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 (embeds an IPv4 address)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (deprecated)
  ['ff00::', 8], // multicast
]) BLOCKED.addSubnet(net, prefix, 'ipv6');

// IPv4-mapped IPv6 (::ffff:a.b.c.d, also written ::ffff:7f00:1): screened by
// the IPv4 rules.
function mappedV4(address) {
  const m = /^::ffff:(?:(\d{1,3}(?:\.\d{1,3}){3})|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i.exec(address);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2], 16);
  const lo = parseInt(m[3], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

// True unless the address is a public unicast address.
export function isBlockedAddress(address) {
  const family = isIP(address);
  if (family === 4) return BLOCKED.check(address, 'ipv4');
  if (family === 6) {
    const v4 = mappedV4(address);
    return v4 ? BLOCKED.check(v4, 'ipv4') : BLOCKED.check(address, 'ipv6');
  }
  return true; // not an IP address: refuse
}

const defaultResolveHost = (host) => lookup(host, { all: true, verbatim: true });

// Returns a refusal reason, or null when the URL may be fetched.
export async function screenUrl(url, resolveHost = defaultResolveHost) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return 'not a URL';
  }
  if (u.protocol !== 'https:') return `scheme ${u.protocol} (https only)`;
  if (u.username || u.password) return 'credentials in URL';
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return 'no host';
  if (isIP(host)) return isBlockedAddress(host) ? `non-public address ${host}` : null;
  if (host === 'localhost' || host.endsWith('.localhost')) return `local name ${host}`;
  if (!host.includes('.')) return `single-label name ${host}`;
  let addresses;
  try {
    addresses = await resolveHost(host);
  } catch (err) {
    return `DNS lookup failed (${err?.code ?? 'error'})`;
  }
  if (!Array.isArray(addresses) || addresses.length === 0) return 'DNS lookup returned no address';
  const blocked = addresses.map((a) => a?.address).filter(isBlockedAddress);
  if (blocked.length > 0) return `${host} resolves to non-public address ${blocked[0]}`;
  return null;
}

// --------------------------------------------------------------- requests

const REDIRECT = new Set([301, 302, 303, 307, 308]);
const okStatus = (s) => s >= 200 && s < 300;
const retryable = (r) => !r.refused && (r.status === 0 || r.status === 429 || r.status >= 500);

async function drop(res) {
  try {
    await res.body?.cancel();
  } catch {
    // body already consumed or closed: nothing to drop
  }
}

// One request, following redirects by hand. Never throws.
async function request(url, method, deps) {
  let current = url;
  for (let hop = 0; ; hop++) {
    const refused = await screenUrl(current, deps.resolveHost);
    if (refused) return { ok: false, status: 0, refused, finalUrl: current, redirects: hop };
    let res;
    try {
      res = await deps.fetchImpl(current, {
        method,
        redirect: 'manual',
        credentials: 'omit',
        headers: method === 'GET'
          ? { 'user-agent': USER_AGENT, accept: '*/*', range: 'bytes=0-0' }
          : { 'user-agent': USER_AGENT, accept: '*/*' },
        signal: AbortSignal.timeout(deps.timeoutMs),
      });
    } catch (err) {
      const cause = err?.cause?.code ?? err?.name ?? 'error';
      return { ok: false, status: 0, error: oneLine(cause), finalUrl: current, redirects: hop };
    }
    await drop(res);
    if (REDIRECT.has(res.status)) {
      const location = res.headers.get('location');
      if (!location) return { ok: false, status: res.status, error: 'redirect without Location', finalUrl: current, redirects: hop };
      if (hop >= deps.maxRedirects) {
        return { ok: false, status: res.status, error: `more than ${deps.maxRedirects} redirects`, finalUrl: current, redirects: hop };
      }
      try {
        current = new URL(location, current).href;
      } catch {
        return { ok: false, status: res.status, error: 'invalid Location', finalUrl: current, redirects: hop };
      }
      continue;
    }
    return {
      ok: okStatus(res.status),
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      finalUrl: current,
      redirects: hop,
    };
  }
}

// HEAD first; some hosts refuse HEAD, so a failed HEAD is tried again as a
// one-byte GET. A network error, 429 or 5xx is retried once after a pause.
// Never throws.
export async function checkUrl(url, options = {}) {
  const deps = {
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    resolveHost: options.resolveHost ?? defaultResolveHost,
    timeoutMs: options.timeoutMs ?? TIMEOUT_MS,
    maxRedirects: options.maxRedirects ?? MAX_REDIRECTS,
  };
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const retries = options.retries ?? 1;
  let result;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);
    result = await request(url, 'HEAD', deps);
    if (!result.ok && !result.refused) result = await request(url, 'GET', deps);
    if (!retryable(result)) break;
  }
  return result;
}

// Runs fn over items with at most `limit` calls in flight; keeps item order.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ---------------------------------------------------------------- datasets

const withUrl = (list) => (Array.isArray(list) ? list : []).filter((x) => typeof x?.url === 'string');

// Ohara seed (packages/ohara-data/schema.json): free sources are checked; every
// other URL (retail/preview-embed sources, explainers) is counted as not checked.
export function oharaTargets(seed) {
  const targets = [];
  let notChecked = 0;
  for (const node of Array.isArray(seed?.nodes) ? seed.nodes : []) {
    for (const src of withUrl(node?.sources)) {
      if (src.sourceType === 'free') targets.push({ id: String(node.id), label: node.label, url: src.url });
      else notChecked++;
    }
    notChecked += withUrl(node?.explainers).length;
  }
  return { targets, notChecked };
}

// Older datasets: nodes[].sources[] are URL strings.
export function legacyTargets(seed, rulesById = new Map()) {
  const targets = [];
  const suggestions = [];
  for (const node of Array.isArray(seed?.nodes) ? seed.nodes : []) {
    const sources = (Array.isArray(node?.sources) ? node.sources : []).filter((s) => typeof s === 'string');
    const rule = rulesById.get(node?.id);
    const preferred = Array.isArray(rule?.preferred) ? rule.preferred : [];
    if (preferred.length && !preferred.some((p) => sources.includes(p))) {
      suggestions.push({ id: String(node.id), label: node.label, preferred, notes: rule.notes ?? '' });
    }
    for (const url of sources) targets.push({ id: String(node.id), label: node.label, url });
  }
  return { targets, suggestions };
}

class InputError extends Error {}

async function readJson(repoRoot, rel) {
  try {
    return JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));
  } catch (err) {
    throw new InputError(`cannot read ${rel}: ${err.message}`);
  }
}

async function globRel(repoRoot, pattern) {
  const out = [];
  for await (const p of glob(pattern, { cwd: repoRoot })) out.push(p.split(path.sep).join('/'));
  return out.sort();
}

export async function loadDatasets(repoRoot) {
  let names;
  try {
    names = (await readdir(path.join(repoRoot, OHARA_DATA_DIR))).filter((n) => OHARA_SEED_NAME.test(n)).sort();
  } catch (err) {
    throw new InputError(`cannot list ${OHARA_DATA_DIR}: ${err.message}`);
  }
  if (names.length === 0) throw new InputError(`no Ohara seed (seed.*.json) in ${OHARA_DATA_DIR}`);
  const datasets = [];
  for (const name of names) {
    const file = `${OHARA_DATA_DIR}/${name}`;
    datasets.push({ file, kind: 'ohara', suggestions: [], ...oharaTargets(await readJson(repoRoot, file)) });
  }
  const rulesById = new Map();
  for (const file of await globRel(repoRoot, LEGACY_RULES_GLOB)) {
    const rules = (await readJson(repoRoot, file))?.rules;
    for (const r of Array.isArray(rules) ? rules : []) rulesById.set(r?.id, r);
  }
  for (const file of await globRel(repoRoot, LEGACY_SEED_GLOB)) {
    datasets.push({ file, kind: 'legacy', notChecked: 0, ...legacyTargets(await readJson(repoRoot, file), rulesById) });
  }
  return datasets;
}

// ------------------------------------------------------------------ report

const KLASS_ORDER = { primary: 0, unclassified: 1, avoid: 2 };

export function resultText(r) {
  if (r.ok) return r.redirects ? `ok (${r.redirects} redirect(s))` : 'ok';
  const at = r.redirects ? ` (after ${r.redirects} redirect(s), at ${r.finalUrl})` : '';
  if (r.refused) return `REFUSED: ${r.refused}${at}`;
  return `${r.error ? `BROKEN: ${r.error}` : 'BROKEN'}${at}`;
}

export function renderReport(datasets, generatedAt) {
  const all = datasets.flatMap((d) => d.results);
  const refused = all.filter((r) => r.refused).length;
  const broken = all.filter((r) => !r.ok && !r.refused).length;
  const lines = [
    '# Source link report',
    '',
    `Generated: ${generatedAt}`,
    '',
    `Checked ${all.length} URL(s): ${all.length - broken - refused} ok, ${broken} broken, ${refused} refused.`,
    '',
    'Class: primary = academic or institutional host; avoid = social, video or blogging host, or a ' +
      'corporate/marketing path; unclassified = neither (author and project hosts land here).',
  ];
  for (const ds of datasets) {
    lines.push('', `## ${md(ds.file)}`, '');
    if (ds.kind === 'ohara') {
      lines.push(
        `Free sources (sourceType "free"), by node. Not checked: ${ds.notChecked} other URL(s) ` +
          '(retail/preview-embed sources and explainers).',
        '',
      );
    }
    lines.push('| Node | URL | HTTP | Class | Result |', '|---|---|---:|---|---|');
    const rows = [...ds.results].sort(
      (a, b) => Number(a.ok) - Number(b.ok) || KLASS_ORDER[a.klass] - KLASS_ORDER[b.klass] || a.id.localeCompare(b.id),
    );
    for (const r of rows) {
      lines.push(`| ${md(r.label || r.id)} | ${md(r.url)} | ${r.status || '-'} | ${r.klass} | ${md(resultText(r))} |`);
    }
    for (const s of ds.suggestions) {
      lines.push('', `Suggestion for ${md(s.label || s.id)}: add a canonical link (${s.preferred.map(md).join(', ')}). ${md(s.notes)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

// --------------------------------------------------------------------- main

export function parseArgs(argv) {
  const opts = { mode: 'report', out: 'reports/links.md' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ci') opts.mode = 'ci';
    else if (a === '--warn') opts.mode = 'warn';
    else if (a === '--out' && argv[i + 1]) opts.out = argv[++i];
    else throw new InputError(`unknown or incomplete argument: ${a}`);
  }
  return opts;
}

export async function run(argv, { repoRoot, fetchImpl, resolveHost, sleep, log = console.log, err = console.error, now = () => new Date() } = {}) {
  let opts;
  let datasets;
  try {
    opts = parseArgs(argv);
    datasets = await loadDatasets(repoRoot);
  } catch (e) {
    err(e instanceof InputError ? e.message : (e?.stack ?? String(e)));
    return 2;
  }
  const jobs = datasets.flatMap((ds) => ds.targets.map((t) => ({ ds, t })));
  if (jobs.length === 0) {
    err('no URL to check: the seeds have no free source');
    return 2;
  }
  for (const ds of datasets) ds.results = [];
  await mapLimit(jobs, CONCURRENCY, async ({ ds, t }) => {
    const res = await checkUrl(t.url, { fetchImpl, resolveHost, sleep });
    ds.results.push({ ...t, ...res, klass: classify(t.url).klass });
  });
  const outPath = path.resolve(repoRoot, opts.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, renderReport(datasets, now().toISOString()), 'utf8');

  const results = datasets.flatMap((d) => d.results.map((r) => ({ ...r, file: d.file })));
  const failed = results.filter((r) => !r.ok);
  for (const r of failed) {
    const msg = `${r.file} ${r.id}: ${r.url} ${r.refused ? '' : `HTTP ${r.status || '-'} `}${resultText(r)}`;
    if (opts.mode === 'ci') err(annotation('error', 'source link', msg));
    else if (opts.mode === 'warn') err(annotation('warning', 'source link', msg));
    else err(oneLine(msg));
  }
  log(`checked ${results.length} URL(s) in ${datasets.length} seed(s): ${failed.length} failed. Report: ${path.relative(repoRoot, outPath)}`);
  return opts.mode === 'ci' && failed.length > 0 ? 1 : 0;
}

export function invokedAsCli(moduleUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (invokedAsCli(import.meta.url)) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  run(process.argv.slice(2), { repoRoot }).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(e?.stack ?? String(e));
      process.exitCode = 2;
    },
  );
}
