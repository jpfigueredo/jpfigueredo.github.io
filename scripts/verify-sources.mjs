#!/usr/bin/env node
// Lightweight primary-source link verifier with heuristics.
// - Reads datasets from web/src/data/**/seed.json
// - Checks nodes[].sources[] for HTTP(S) validity and "primary-ness"
// - Outputs a markdown report to reports/links.md
// - Exit code 1 on broken links when --ci is passed

import { readFile, writeFile, mkdir } from 'fs/promises';
import { glob } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const preferDomains = [
  'arxiv.org', 'doi.org', 'dl.acm.org', 'ieeexplore.ieee.org', 'jstor.org',
  'springer.com', 'nature.com', 'science.org', 'mit.edu', 'stanford.edu',
  'harvard.edu', 'cmu.edu', 'berkeley.edu', 'ox.ac.uk', 'cam.ac.uk',
  'dartmouth.edu', 'nist.gov', 'nasa.gov', 'loc.gov', 'archive.org', 'w3.org'
];

const avoidPatterns = [
  /linkedin\.com/i,
  /facebook\.com/i,
  /twitter\.com|x\.com/i,
  /medium\.com\/@?/i,
  /youtube\.com|youtu\.be/i,
  /github\.com\/$/i,
  /about|careers|company|press|blog\//i,
];

const controllerWithTimeout = (ms) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(t) };
};

function classify(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const preferred = preferDomains.some(d => host.endsWith(d));
    const avoided = avoidPatterns.some(re => re.test(url));
    return { host, preferred, avoided };
  } catch {
    return { host: '', preferred: false, avoided: true };
  }
}

async function checkUrl(url) {
  try {
    const { signal, clear } = controllerWithTimeout(8000);
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal });
    if (!res.ok || res.status >= 400 || res.status === 405) {
      // Some hosts don't allow HEAD; try GET with range
      const { signal: s2, clear: c2 } = controllerWithTimeout(12000);
      res = await fetch(url, { method: 'GET', headers: { 'Range': 'bytes=0-512' }, redirect: 'follow', signal: s2 });
      c2();
    }
    clear();
    const ctype = res.headers.get('content-type') || '';
    const ok = res.ok && res.status < 400;
    return { ok, status: res.status, contentType: ctype };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

async function readDatasets() {
  const matches = await glob(path.join(repoRoot, 'web/src/data/**/seed.json'));
  const datasets = [];
  for (const fp of matches) {
    try {
      const raw = await readFile(fp, 'utf8');
      const json = JSON.parse(raw);
      datasets.push({ file: path.relative(repoRoot, fp), data: json });
    } catch (e) {
      // skip invalid json
    }
  }
  return datasets;
}

async function readRules() {
  const files = await glob(path.join(repoRoot, 'web/src/data/**/link-rules.json'));
  const all = [];
  for (const fp of files) {
    try {
      const raw = await readFile(fp, 'utf8');
      const json = JSON.parse(raw);
      if (Array.isArray(json?.rules)) {
        all.push(...json.rules);
      }
    } catch {}
  }
  const byId = new Map();
  for (const r of all) byId.set(r.id, r);
  return byId;
}

function markdownEscape(s) {
  return s.replaceAll('|', '\\|');
}

async function main() {
  const ci = process.argv.includes('--ci');
  const datasets = await readDatasets();
  const rulesById = await readRules();
  const rows = [];
  let broken = 0;
  let suggestions = 0;
  for (const ds of datasets) {
    const nodes = Array.isArray(ds.data?.nodes) ? ds.data.nodes : [];
    for (const n of nodes) {
      const sources = Array.isArray(n?.sources) ? n.sources : [];
      const rule = rulesById.get(n.id);
      const preferredList = Array.isArray(rule?.preferred) ? rule.preferred : [];
      // Check if a preferred canonical is present
      const hasPreferred = preferredList.some(p => sources.includes(p));
      if (rule && preferredList.length && !hasPreferred) {
        suggestions++;
        rows.push({ file: ds.file, id: n.id, label: n.label, url: '[suggest:add-canonical]', host: 'canonical', status: 'suggest', ok: true, primaryScore: 3, contentType: rule.notes || '', avoided: false });
      }
      for (const src of sources) {
        const meta = classify(src);
        const res = await checkUrl(src);
        const primaryScore = (meta.preferred ? 2 : 0) + (!meta.avoided ? 1 : 0);
        const health = res.ok ? 'OK' : 'BROKEN';
        if (!res.ok) broken++;
        rows.push({ file: ds.file, id: n.id, label: n.label, url: src, host: meta.host, status: res.status, ok: res.ok, primaryScore, contentType: res.contentType || '', avoided: meta.avoided });
      }
    }
  }

  rows.sort((a, b) => (a.ok === b.ok) ? (b.primaryScore - a.primaryScore) : (a.ok ? -1 : 1));

  const outDir = path.join(repoRoot, 'reports');
  await mkdir(outDir, { recursive: true });
  const md = [];
  md.push('# Primary Sources Link Report');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push('');
  md.push('| Status | Score | Host | Type | Node | URL | File |');
  md.push('|---|---:|---|---|---|---|---|');
  for (const r of rows) {
    md.push(`| ${r.ok ? '✅' : '❌'} | ${r.primaryScore} | ${markdownEscape(r.host)} | ${markdownEscape(r.contentType)} | ${markdownEscape(r.label || r.id)} | ${markdownEscape(r.url)} | ${markdownEscape(r.file)} |`);
  }
  md.push('');
  md.push('Heuristics: prefer academic/primary domains (e.g., arXiv, DOI, ACM, IEEE, .edu, .gov); flag corporate/social/marketing paths.');
  md.push('');
  md.push('Canonical rules are read from `web/src/data/**/link-rules.json` and surfaced as suggestions when missing.');
  await writeFile(path.join(outDir, 'links.md'), md.join('\n'), 'utf8');

  if (ci && (broken > 0)) {
    console.error(`Found ${broken} broken source link(s). See reports/links.md`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


