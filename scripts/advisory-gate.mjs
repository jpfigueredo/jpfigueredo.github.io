#!/usr/bin/env node
// Dependency advisory gate: every package version in yarn.lock and
// services/rust-api/Cargo.lock is checked against OSV (https://osv.dev), which
// carries the GitHub Advisory Database (GHSA) for npm and crates.io plus the
// RustSec database. This is the same advisory data the repository's Dependabot
// alerts come from, without needing a token.
//
// Two modes:
//   ratchet  (pull requests) fails if the head introduces an advisory that the
//            base does not have, for the same package and workspace, unless
//            the allowlist accepts it. Advisories already in the base do not
//            fail the PR: the weekly absolute run keeps them visible.
//   absolute (scheduled, on develop) fails on every advisory the allowlist
//            does not accept.
// Both modes fail on an invalid allowlist, on an expired entry (reviewBy in
// the past) and on an entry whose reviewBy is further away than the severity
// allows (MAX_REVIEW_DAYS).
//
// Fails closed: exit 0 only if every lockfile entry was looked up. Any OSV
// error (network, HTTP status, malformed or incomplete answer), unknown git
// ref, unparsable lockfile or dependency that cannot be resolved is exit 2.
//
// Severity, per advisory, from the OSV record (highest of the advisory and its
// aliases that OSV also returned):
//   1. database_specific.severity (GitHub's own label, what Dependabot shows):
//      CRITICAL, HIGH, MODERATE -> medium, LOW;
//   2. else a CVSS v3.x vector (severity[] or RustSec's
//      affected[].database_specific.cvss), base score per the CVSS 3.1
//      specification: 9.0+ critical, 7.0+ high, 4.0+ medium, 0.1+ low;
//   3. else a RustSec informational advisory (unmaintained, unsound, notice):
//      info;
//   4. else unknown (e.g. only a CVSS v4 vector). For the allowlist deadline,
//      unknown counts as high.
// In both modes every advisory fails the gate when it is not accepted,
// whatever its severity; severity only sets how far reviewBy may be.
//
// Where an advisory applies ("path"): the workspace directory that reaches the
// package through its package.json (following yarn.lock and sibling
// workspaces), "." for the root package.json, or "services/rust-api" for
// Cargo.lock. Scope "prod" means reachable through dependencies or
// optionalDependencies only; "dev" means only through a devDependencies edge.
// A ratchet key is (ecosystem, package, advisory, path): adding a vulnerable
// package to a new workspace is a new finding even if another workspace
// already had it.
//
// CI runs the copy of this file from the PR's base branch (see ci.yml), with
// the lockfiles and the allowlist of the head, so a PR cannot weaken the gate
// that judges it. For that reason this file is self-contained: no imports
// except node: built-ins, and nothing read from the working tree; every file
// is read with `git show <ref>:<path>`.
//
// Usage (from anywhere inside the repo):
//   node scripts/advisory-gate.mjs                                 # ratchet, origin/develop vs HEAD
//   node scripts/advisory-gate.mjs --mode ratchet --base <ref> --head <ref>
//   node scripts/advisory-gate.mjs --mode absolute --head <ref>
//   ... [--json <file>]   also writes every finding as JSON
// Writes a Markdown report to $GITHUB_STEP_SUMMARY when it is set.
//
// Network: POST https://api.osv.dev/v1/querybatch (name, ecosystem and version
// of each lockfile entry) and GET https://api.osv.dev/v1/vulns/<id>.
//
// Exit codes: 0 pass; 1 the policy failed (new or not-accepted advisory,
// allowlist problem); 2 the check could not run (OSV, git, input).

import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';

export const OSV_API = 'https://api.osv.dev/v1';
export const ALLOWLIST_PATH = 'security/advisory-allowlist.json';
const YARN_LOCK = 'yarn.lock';
const CARGO_LOCK = 'services/rust-api/Cargo.lock';
const CARGO_PATH = 'services/rust-api';
const CRATES_IO_INDEX = 'registry+https://github.com/rust-lang/crates.io-index';
const NPM_REGISTRY_HOSTS = new Set(['registry.npmjs.org', 'registry.yarnpkg.com']);
const TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;
const BATCH_SIZE = 500;
const DETAIL_WORKERS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// How far in the future reviewBy may be, by the highest severity the entry
// covers. A high or critical advisory can only be accepted for a short time.
export const MAX_REVIEW_DAYS = { critical: 30, high: 30, unknown: 30, medium: 90, low: 90, info: 90 };
// An entry this close to reviewBy gets a warning, so it does not expire by
// surprise in an unrelated PR.
const WARN_DAYS = 14;

// VEX "not affected" justifications (CISA, "Vulnerability Exploitability
// eXchange (VEX) - Status Justifications").
export const VEX_JUSTIFICATIONS = new Set([
  'component_not_present',
  'vulnerable_code_not_present',
  'vulnerable_code_not_in_execute_path',
  'vulnerable_code_cannot_be_controlled_by_adversary',
  'inline_mitigations_already_exist',
]);
const ENTRY_KEYS = new Set(['id', 'ecosystem', 'package', 'version', 'range', 'paths', 'reason', 'justification', 'reviewBy']);
const ECOSYSTEMS = new Set(['npm', 'crates.io']);
const SEVERITY_RANK = { info: 0, low: 1, medium: 2, unknown: 3, high: 4, critical: 5 };
const SEVERITY_ORDER = ['critical', 'high', 'unknown', 'medium', 'low', 'info'];

export class GateError extends Error {}

// ------------------------------------------------------------------ lockfiles

// yarn 1 lockfile -> { entries: Map key -> entry, byPackage: Map "name@version" -> entry }.
// Each block lists its keys ("name@range", several per block), version,
// resolved, dependencies and optionalDependencies. The real package name comes
// from the `resolved` URL, so aliases ("string-width-cjs@npm:string-width@^4")
// resolve to the published package. Anything not from the npm registry cannot
// be looked up in OSV by name and version: that is an error.
export function parseYarnLock(text) {
  const byKey = new Map();
  const byPackage = new Map();
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '' && !l.startsWith('#'));
    if (lines.length === 0) continue;
    if (lines[0].startsWith(' ')) throw new GateError(`yarn.lock: unexpected indented block start: ${lines[0]}`);
    const keys = lines[0]
      .replace(/:$/, '')
      .split(/,\s*/)
      .map((k) => k.trim().replace(/^"|"$/g, ''));
    let version = null;
    let resolved = null;
    const deps = [];
    let section = null;
    for (const line of lines.slice(1)) {
      const top = /^ {2}(\S+)(?: (.*))?$/.exec(line);
      if (top) {
        section = null;
        const [, field, rawValue] = top;
        const value = rawValue?.replace(/^"|"$/g, '');
        if (field === 'version') version = value;
        else if (field === 'resolved') resolved = value;
        else if (field === 'dependencies:' || field === 'optionalDependencies:') section = field;
        continue;
      }
      const dep = /^ {4}("[^"]+"|\S+) ("[^"]*"|\S+)$/.exec(line);
      if (dep && section) {
        deps.push({ name: dep[1].replace(/^"|"$/g, ''), range: dep[2].replace(/^"|"$/g, '') });
      }
    }
    if (!version) throw new GateError(`yarn.lock: entry without version: ${lines[0]}`);
    if (!resolved) throw new GateError(`yarn.lock: entry without resolved URL: ${lines[0]}`);
    let url;
    try {
      url = new URL(resolved);
    } catch {
      throw new GateError(`yarn.lock: invalid resolved URL for ${lines[0]}: ${resolved}`);
    }
    const marker = url.pathname.indexOf('/-/');
    if (!NPM_REGISTRY_HOSTS.has(url.hostname) || marker <= 0) {
      throw new GateError(`yarn.lock: ${lines[0]} is not from the npm registry (${resolved}); OSV cannot check it`);
    }
    const name = decodeURIComponent(url.pathname.slice(1, marker));
    const id = `${name}@${version}`;
    const entry = byPackage.get(id) ?? { ecosystem: 'npm', name, version, deps: [] };
    entry.deps.push(...deps);
    byPackage.set(id, entry);
    for (const key of keys) byKey.set(key, entry);
  }
  if (byPackage.size === 0) throw new GateError('yarn.lock has no entries');
  return { byKey, byPackage };
}

// Cargo.lock -> Map "name@version" -> entry. Packages without `source` are the
// local crate (rust-api itself) and are skipped; any source other than
// crates.io is an error (OSV cannot check a git dependency by version).
export function parseCargoLock(text) {
  const byPackage = new Map();
  for (const block of text.split(/^\[\[package\]\]$/m).slice(1)) {
    const name = /^name = "([^"]+)"/m.exec(block)?.[1];
    const version = /^version = "([^"]+)"/m.exec(block)?.[1];
    const source = /^source = "([^"]+)"/m.exec(block)?.[1];
    if (!name || !version) throw new GateError(`Cargo.lock: package without name or version: ${block.slice(0, 80)}`);
    if (!source) continue;
    if (source !== CRATES_IO_INDEX) {
      throw new GateError(`Cargo.lock: ${name} ${version} is not from crates.io (${source}); OSV cannot check it`);
    }
    byPackage.set(`${name}@${version}`, { ecosystem: 'crates.io', name, version, deps: [] });
  }
  if (byPackage.size === 0) throw new GateError('Cargo.lock has no crates.io packages');
  return byPackage;
}

// ------------------------------------------------------------------ workspaces

function workspaceGlobToRegExp(glob) {
  const parts = glob.replace(/\/+$/, '').split('/').map((seg) => {
    if (seg === '*') return '[^/]+';
    if (!/^[A-Za-z0-9._@-]+$/.test(seg)) throw new GateError(`unsupported workspace pattern: ${glob}`);
    return seg.replace(/\./g, '\\.');
  });
  return new RegExp(`^${parts.join('/')}/package\\.json$`);
}

// Workspace directories ("." for the root) and their package.json, at a ref.
export function listWorkspaces(rootManifest, filesAtRef, readFile) {
  const globs = Array.isArray(rootManifest.workspaces) ? rootManifest.workspaces : rootManifest.workspaces?.packages ?? [];
  const patterns = globs.map(workspaceGlobToRegExp);
  const workspaces = [{ path: '.', manifest: rootManifest }];
  for (const file of filesAtRef) {
    if (!patterns.some((re) => re.test(file))) continue;
    const dir = file.slice(0, -'/package.json'.length);
    let manifest;
    try {
      manifest = JSON.parse(readFile(file));
    } catch (err) {
      throw new GateError(`invalid JSON in ${file}: ${err.message}`);
    }
    workspaces.push({ path: dir, manifest });
  }
  return workspaces;
}

// For each yarn.lock package ("name@version"): Map path -> 'prod' | 'dev'.
export function attributeYarn(lock, workspaces) {
  const byName = new Map(workspaces.filter((w) => w.manifest.name).map((w) => [w.manifest.name, w]));
  const result = new Map();
  const unresolved = new Set();
  for (const ws of workspaces) {
    // scope per lock package for this workspace; 'prod' wins over 'dev'.
    const seen = new Map();
    const seenWorkspaces = new Map();
    const queue = [];
    const pushManifestDeps = (manifest, scope) => {
      for (const field of ['dependencies', 'optionalDependencies', 'devDependencies']) {
        const edgeScope = field === 'devDependencies' ? 'dev' : scope;
        for (const [name, range] of Object.entries(manifest[field] ?? {})) queue.push({ name, range, scope: edgeScope, from: manifest.name ?? ws.path });
      }
    };
    pushManifestDeps(ws.manifest, 'prod');
    while (queue.length > 0) {
      const { name, range, scope, from } = queue.shift();
      const entry = lock.byKey.get(`${name}@${range}`);
      if (entry) {
        const id = `${entry.name}@${entry.version}`;
        const prev = seen.get(id);
        if (prev === 'prod' || prev === scope) continue;
        seen.set(id, scope);
        for (const dep of entry.deps) queue.push({ name: dep.name, range: dep.range, scope, from: id });
        continue;
      }
      const sibling = byName.get(name);
      if (sibling) {
        const prev = seenWorkspaces.get(sibling.path);
        if (prev === 'prod' || prev === scope) continue;
        seenWorkspaces.set(sibling.path, scope);
        // A sibling's devDependencies are not part of what this workspace
        // uses; only its dependencies and optionalDependencies are followed.
        for (const field of ['dependencies', 'optionalDependencies']) {
          for (const [n, r] of Object.entries(sibling.manifest[field] ?? {})) queue.push({ name: n, range: r, scope, from: name });
        }
        continue;
      }
      unresolved.add(`${name}@${range} (from ${from} in ${ws.path})`);
    }
    for (const [id, scope] of seen) {
      if (!result.has(id)) result.set(id, new Map());
      result.get(id).set(ws.path, scope);
    }
  }
  if (unresolved.size > 0) {
    throw new GateError(`dependencies with no yarn.lock entry (run yarn install): ${[...unresolved].slice(0, 10).join(', ')}`);
  }
  return result;
}

// ------------------------------------------------------------------ git

function makeGit(cwd) {
  const git = (args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 128 * 1024 * 1024 });
  return {
    resolve(ref) {
      try {
        return git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim();
      } catch {
        throw new GateError(`unknown git ref: ${ref}`);
      }
    },
    files(ref) {
      return git(['ls-tree', '-r', '--name-only', '--full-tree', ref]).split('\n').filter(Boolean);
    },
    show(ref, path) {
      return git(['show', '--no-textconv', `${ref}:${path}`]);
    },
  };
}

// Everything the gate needs from one commit.
export function loadSnapshot(git, ref) {
  const sha = git.resolve(ref);
  const files = new Set(git.files(sha));
  for (const required of ['package.json', YARN_LOCK, CARGO_LOCK]) {
    if (!files.has(required)) throw new GateError(`${required} is missing at ${ref}`);
  }
  let rootManifest;
  try {
    rootManifest = JSON.parse(git.show(sha, 'package.json'));
  } catch (err) {
    throw new GateError(`invalid package.json at ${ref}: ${err.message}`);
  }
  const yarn = parseYarnLock(git.show(sha, YARN_LOCK));
  const workspaces = listWorkspaces(rootManifest, files, (p) => git.show(sha, p));
  const yarnPaths = attributeYarn(yarn, workspaces);
  const cargo = parseCargoLock(git.show(sha, CARGO_LOCK));
  const packages = [];
  for (const [id, entry] of yarn.byPackage) {
    const paths = yarnPaths.get(id) ?? new Map([['(unattributed)', 'dev']]);
    packages.push({ ecosystem: 'npm', name: entry.name, version: entry.version, paths });
  }
  for (const entry of cargo.values()) {
    packages.push({ ecosystem: 'crates.io', name: entry.name, version: entry.version, paths: new Map([[CARGO_PATH, '-']]) });
  }
  const allowlistText = files.has(ALLOWLIST_PATH) ? git.show(sha, ALLOWLIST_PATH) : null;
  return { ref, sha, packages, allowlistText, counts: { npm: yarn.byPackage.size, cargo: cargo.size } };
}

// ------------------------------------------------------------------ OSV

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestJson(fetchImpl, url, init, { retryDelayMs = 2000 } = {}) {
  let lastError = 'no attempt';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (attempt > 1) await sleep(retryDelayMs * (attempt - 1));
    let res;
    try {
      res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      lastError = `${err.name}: ${err.cause?.code ?? err.message}`;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastError = `HTTP ${res.status}`;
      continue;
    }
    if (!res.ok) throw new GateError(`${init?.method ?? 'GET'} ${url}: HTTP ${res.status}`);
    try {
      return await res.json();
    } catch (err) {
      throw new GateError(`${init?.method ?? 'GET'} ${url}: response is not JSON (${err.message})`);
    }
  }
  throw new GateError(`${init?.method ?? 'GET'} ${url}: failed after ${ATTEMPTS} attempts (${lastError})`);
}

const VULN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

// Map "ecosystem|name@version" -> [vuln ids], for every package given.
export async function queryOsv(packages, { fetchImpl = fetch, retryDelayMs } = {}) {
  const pending = packages.map((p) => ({ pkg: p, pageToken: undefined }));
  const out = new Map(packages.map((p) => [pkgKey(p), new Set()]));
  while (pending.length > 0) {
    const batch = pending.splice(0, BATCH_SIZE);
    const queries = batch.map(({ pkg, pageToken }) => ({
      package: { ecosystem: pkg.ecosystem, name: pkg.name },
      version: pkg.version,
      ...(pageToken ? { page_token: pageToken } : {}),
    }));
    const body = await requestJson(
      fetchImpl,
      `${OSV_API}/querybatch`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ queries }) },
      { retryDelayMs },
    );
    if (!Array.isArray(body?.results) || body.results.length !== queries.length) {
      throw new GateError(`OSV querybatch returned ${Array.isArray(body?.results) ? body.results.length : 'no'} results for ${queries.length} queries`);
    }
    body.results.forEach((result, i) => {
      if (result === null || typeof result !== 'object') throw new GateError(`OSV querybatch: result ${i} is not an object`);
      const vulns = result.vulns ?? [];
      if (!Array.isArray(vulns)) throw new GateError(`OSV querybatch: result ${i} has a non-array vulns field`);
      for (const v of vulns) {
        if (typeof v?.id !== 'string' || !VULN_ID.test(v.id)) throw new GateError(`OSV querybatch: invalid vuln id ${JSON.stringify(v?.id)}`);
        out.get(pkgKey(batch[i].pkg)).add(v.id);
      }
      if (result.next_page_token) pending.push({ pkg: batch[i].pkg, pageToken: result.next_page_token });
    });
  }
  return out;
}

export async function fetchVulns(ids, { fetchImpl = fetch, retryDelayMs } = {}) {
  const list = [...ids];
  const out = new Map();
  let next = 0;
  const workers = Array.from({ length: Math.min(DETAIL_WORKERS, list.length) }, async () => {
    while (next < list.length) {
      const id = list[next];
      next += 1;
      const vuln = await requestJson(fetchImpl, `${OSV_API}/vulns/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } }, { retryDelayMs });
      if (vuln?.id !== id) throw new GateError(`OSV vulns/${id} returned a record for ${JSON.stringify(vuln?.id)}`);
      out.set(id, vuln);
    }
  });
  await Promise.all(workers);
  return out;
}

// ------------------------------------------------------------------ severity

function roundUp1(x) {
  const n = Math.round(x * 100000);
  return n % 10000 === 0 ? n / 100000 : (Math.floor(n / 10000) + 1) / 10;
}

// CVSS v3.0/v3.1 base score from a vector string, or null if invalid.
export function cvss3BaseScore(vector) {
  const m = /^CVSS:3\.[01]\/(.*)$/.exec(vector ?? '');
  if (!m) return null;
  const metrics = Object.fromEntries(m[1].split('/').map((kv) => kv.split(':')));
  const W = {
    AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
    AC: { L: 0.77, H: 0.44 },
    UI: { N: 0.85, R: 0.62 },
    CIA: { H: 0.56, L: 0.22, N: 0 },
  };
  const scope = metrics.S;
  const PR = { N: 0.85, L: scope === 'C' ? 0.68 : 0.62, H: scope === 'C' ? 0.5 : 0.27 }[metrics.PR];
  const [AV, AC, UI] = [W.AV[metrics.AV], W.AC[metrics.AC], W.UI[metrics.UI]];
  const [C, I, A] = [W.CIA[metrics.C], W.CIA[metrics.I], W.CIA[metrics.A]];
  if ([AV, AC, UI, PR, C, I, A].some((v) => v === undefined) || !['U', 'C'].includes(scope)) return null;
  const iss = 1 - (1 - C) * (1 - I) * (1 - A);
  const impact = scope === 'U' ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15;
  const exploitability = 8.22 * AV * AC * PR * UI;
  if (impact <= 0) return 0;
  return scope === 'U' ? roundUp1(Math.min(impact + exploitability, 10)) : roundUp1(Math.min(1.08 * (impact + exploitability), 10));
}

function scoreToSeverity(score) {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return 'info';
}

// Severity of one OSV record, and where it came from.
export function severityOf(vuln) {
  const label = String(vuln?.database_specific?.severity ?? '').toUpperCase();
  const fromLabel = { CRITICAL: 'critical', HIGH: 'high', MODERATE: 'medium', MEDIUM: 'medium', LOW: 'low' }[label];
  if (fromLabel) return { severity: fromLabel, source: `GHSA ${label}` };
  const vectors = [
    ...(vuln?.severity ?? []).filter((s) => s?.type === 'CVSS_V3').map((s) => s.score),
    ...(vuln?.affected ?? []).map((a) => a?.database_specific?.cvss).filter((v) => typeof v === 'string'),
  ];
  for (const vector of vectors) {
    const score = cvss3BaseScore(vector);
    if (score !== null) return { severity: scoreToSeverity(score), source: `CVSS ${score}` };
  }
  const informational = (vuln?.affected ?? []).map((a) => a?.database_specific?.informational).find(Boolean);
  if (informational) return { severity: 'info', source: `RustSec ${informational}` };
  return { severity: 'unknown', source: 'no GHSA label or CVSS v3 vector' };
}

const maxSeverity = (a, b) => (SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b);

// ------------------------------------------------------------------ findings

const pkgKey = (p) => `${p.ecosystem}|${p.name}@${p.version}`;

// Groups the OSV ids found for one package into advisories: two ids are the
// same advisory when one lists the other as an alias (GHSA-x and RUSTSEC-y for
// one zip bug). The advisory key is its GHSA id if it has one, else the
// smallest id, so it is stable across runs and comparable with Dependabot.
function groupAdvisories(ids, vulns) {
  const parent = new Map([...ids].map((id) => [id, id]));
  const find = (x) => (parent.get(x) === x ? x : find(parent.get(x)));
  for (const id of ids) {
    for (const alias of vulns.get(id).aliases ?? []) {
      if (parent.has(alias)) parent.set(find(alias), find(id));
    }
  }
  const groups = new Map();
  for (const id of ids) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }
  return [...groups.values()].map((members) => {
    const allIds = new Set(members);
    for (const id of members) for (const alias of vulns.get(id).aliases ?? []) allIds.add(alias);
    const sorted = [...allIds].sort();
    const key = sorted.find((x) => x.startsWith('GHSA-')) ?? members.slice().sort()[0];
    // GitHub's label wins when any record of the group has one (that is what
    // Dependabot shows); otherwise the highest known severity; unknown only
    // when no record has any.
    const rated = members.map((id) => ({ id, ...severityOf(vulns.get(id)) }));
    const labelled = rated.filter((s) => s.source.startsWith('GHSA '));
    const known = rated.filter((s) => s.severity !== 'unknown');
    const pool = labelled.length ? labelled : known.length ? known : rated;
    const best = pool.reduce((a, b) => (SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a));
    const summary = members.map((id) => vulns.get(id).summary).find(Boolean) ?? '';
    return { key, osvIds: members.sort(), allIds: sorted, severity: best.severity, severitySource: `${best.source} (${best.id})`, summary };
  });
}

// One finding per (package version, advisory), with the paths that reach it.
export function buildFindings(packages, idsByPackage, vulns) {
  const findings = [];
  const withdrawn = new Set();
  for (const p of packages) {
    const ids = [...(idsByPackage.get(pkgKey(p)) ?? [])].filter((id) => {
      if (vulns.get(id)?.withdrawn) {
        withdrawn.add(id);
        return false;
      }
      return true;
    });
    if (ids.length === 0) continue;
    for (const adv of groupAdvisories(ids, vulns)) {
      findings.push({ ecosystem: p.ecosystem, package: p.name, version: p.version, paths: p.paths, ...adv });
    }
  }
  return { findings, withdrawn };
}

// One row per (finding, path): the unit the ratchet and the allowlist work on.
function expand(findings) {
  const rows = [];
  for (const f of findings) {
    for (const [path, scope] of f.paths) {
      rows.push({ ...f, path, scope, ratchetKey: `${f.ecosystem}|${f.package}|${f.key}|${path}` });
    }
  }
  return rows;
}

// ------------------------------------------------------------------ allowlist

function parseVersion(v) {
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(v);
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}

// "range": space-separated comparators, all must hold (">=6.0.0 <7.0.0").
// Plain numeric versions only; a prerelease or build version never matches.
export function parseRange(range) {
  const parts = String(range).trim().split(/\s+/);
  const comparators = parts.map((part) => {
    const m = /^(>=|<=|>|<|=)(\d+(?:\.\d+){0,2})$/.exec(part);
    if (!m) throw new GateError(`unsupported range comparator "${part}" (use >=, >, <=, <, = with x.y.z)`);
    return { op: m[1], v: parseVersion(m[2]) };
  });
  return (version) => {
    const v = parseVersion(version);
    if (!v) return false;
    return comparators.every(({ op, v: w }) => {
      const c = compareVersions(v, w);
      return { '>=': c >= 0, '<=': c <= 0, '>': c > 0, '<': c < 0, '=': c === 0 }[op];
    });
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Returns { entries, errors }. Entries get a `matchesVersion` function.
export function parseAllowlist(text) {
  const errors = [];
  if (text === null) return { entries: [], errors };
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    return { entries: [], errors: [`${ALLOWLIST_PATH} is not valid JSON: ${err.message}`] };
  }
  if (doc === null || typeof doc !== 'object' || doc.version !== 1 || !Array.isArray(doc.entries)) {
    return { entries: [], errors: [`${ALLOWLIST_PATH} must be { "version": 1, "entries": [...] }`] };
  }
  const entries = [];
  const seen = new Set();
  doc.entries.forEach((e, i) => {
    const where = `${ALLOWLIST_PATH} entry ${i}${e?.id ? ` (${e.id} ${e.package ?? ''})` : ''}`;
    const err = (msg) => errors.push(`${where}: ${msg}`);
    if (e === null || typeof e !== 'object' || Array.isArray(e)) return err('not an object');
    for (const k of Object.keys(e)) if (!ENTRY_KEYS.has(k)) err(`unknown field "${k}"`);
    const nonEmpty = (k) => typeof e[k] === 'string' && e[k].trim() !== '';
    if (!nonEmpty('id') || !VULN_ID.test(e.id)) err('"id" must be an advisory id (GHSA-..., RUSTSEC-..., CVE-...)');
    if (!ECOSYSTEMS.has(e.ecosystem)) err(`"ecosystem" must be one of ${[...ECOSYSTEMS].join(', ')}`);
    if (!nonEmpty('package')) err('"package" is required');
    if (!nonEmpty('reason') || e.reason.trim().length < 20) err('"reason" must explain the decision (20+ characters)');
    if (!VEX_JUSTIFICATIONS.has(e.justification)) err(`"justification" must be one of ${[...VEX_JUSTIFICATIONS].join(', ')}`);
    if (!Array.isArray(e.paths) || e.paths.length === 0 || !e.paths.every((p) => typeof p === 'string' && p !== '')) {
      err('"paths" must be a non-empty list of workspace paths ("web", "services/rust-api", "." for the root)');
    }
    let matchesVersion = () => false;
    if ((e.version === undefined) === (e.range === undefined)) err('exactly one of "version" or "range" is required');
    else if (e.version !== undefined) {
      if (!nonEmpty('version')) err('"version" must be a version string');
      else matchesVersion = (v) => v === e.version;
    } else {
      try {
        matchesVersion = parseRange(e.range);
      } catch (rangeErr) {
        err(rangeErr.message);
      }
    }
    const reviewBy = DATE.test(e.reviewBy ?? '') ? Date.parse(`${e.reviewBy}T00:00:00Z`) : NaN;
    if (Number.isNaN(reviewBy)) err('"reviewBy" must be a date (YYYY-MM-DD)');
    for (const p of Array.isArray(e.paths) ? e.paths : []) {
      const k = `${e.ecosystem}|${e.package}|${e.id}|${p}`;
      if (seen.has(k)) err(`duplicate entry for path ${p}`);
      seen.add(k);
    }
    entries.push({ ...e, index: i, reviewByMs: reviewBy, matchesVersion, matched: [] });
  });
  return { entries, errors };
}

const entryCovers = (entry, row) =>
  entry.ecosystem === row.ecosystem &&
  entry.package === row.package &&
  row.allIds.includes(entry.id) &&
  entry.paths.includes(row.path) &&
  entry.matchesVersion(row.version);

// Expiry and deadline checks, after matching (the deadline depends on the
// severity of what the entry covers).
function checkDeadlines(entries, todayMs) {
  const errors = [];
  const warnings = [];
  for (const e of entries) {
    if (Number.isNaN(e.reviewByMs)) continue;
    const label = `${ALLOWLIST_PATH}: ${e.id} ${e.package} (${e.paths.join(', ')})`;
    const daysLeft = Math.round((e.reviewByMs - todayMs) / DAY_MS);
    if (daysLeft < 0) {
      errors.push(`${label} expired on ${e.reviewBy}: fix the advisory, or review the decision and set a new reviewBy`);
      continue;
    }
    const severity = e.matched.reduce((acc, row) => maxSeverity(acc, row.severity), e.matched.length ? 'info' : 'unknown');
    const max = MAX_REVIEW_DAYS[severity];
    if (daysLeft > max) {
      errors.push(`${label}: reviewBy ${e.reviewBy} is ${daysLeft} days away; a ${severity} advisory can be accepted for at most ${max} days`);
    } else if (daysLeft <= WARN_DAYS) {
      warnings.push(`${label} expires on ${e.reviewBy} (${daysLeft} days)`);
    }
    if (e.matched.length === 0) warnings.push(`${label} matches nothing in the lockfiles any more: remove it`);
  }
  return { errors, warnings };
}

// ------------------------------------------------------------------ evaluate

// Pure policy decision, given the findings at the head (and at the base in
// ratchet mode) and the allowlist text of the head.
export function evaluate({ mode, headFindings, baseFindings, allowlistText, todayMs }) {
  const { entries, errors: allowlistErrors } = parseAllowlist(allowlistText);
  const rows = expand(headFindings);
  const baseKeys = new Set(mode === 'ratchet' ? expand(baseFindings).map((r) => r.ratchetKey) : []);
  for (const row of rows) {
    row.allowedBy = entries.find((e) => entryCovers(e, row)) ?? null;
    if (row.allowedBy) row.allowedBy.matched.push(row);
    row.inBase = baseKeys.has(row.ratchetKey);
    if (row.allowedBy) row.status = 'allowed';
    else if (mode === 'ratchet' && row.inBase) row.status = 'existing';
    else row.status = mode === 'ratchet' ? 'new' : 'not-accepted';
  }
  const deadlines = checkDeadlines(entries, todayMs);
  const blocking = rows.filter((r) => r.status === 'new' || r.status === 'not-accepted');
  const errors = [...allowlistErrors, ...deadlines.errors];
  return { rows, blocking, errors, warnings: deadlines.warnings, entries, pass: blocking.length === 0 && errors.length === 0 };
}

// ------------------------------------------------------------------ report

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function sortRows(rows) {
  return rows.slice().sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.package.localeCompare(b.package) ||
      a.key.localeCompare(b.key) ||
      a.path.localeCompare(b.path),
  );
}

function countBySeverity(rows) {
  const advisories = new Map();
  for (const r of rows) advisories.set(`${r.ecosystem}|${r.package}|${r.key}`, r.severity);
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, 0]));
  for (const s of advisories.values()) counts[s] += 1;
  return { total: advisories.size, text: SEVERITY_ORDER.filter((s) => counts[s]).map((s) => `${counts[s]} ${s}`).join(', ') || 'none' };
}

function table(rows) {
  const lines = ['| severity | advisory | package | path (scope) | OSV ids | summary |', '|---|---|---|---|---|---|'];
  for (const r of sortRows(rows)) {
    lines.push(`| ${r.severity} | ${r.key} | ${cell(`${r.package}@${r.version}`)} (${r.ecosystem}) | ${cell(r.path)} (${r.scope}) | ${r.osvIds.join(' ')} | ${cell(r.summary.slice(0, 100))} |`);
  }
  return lines.join('\n');
}

export function renderSummary({ mode, head, base, result, withdrawn }) {
  const out = [];
  const status = result.pass ? 'PASS' : 'FAIL';
  out.push(`## Dependency advisories (OSV): ${status}`);
  out.push('');
  out.push(`Mode **${mode}**. Head \`${head.ref}\` (${head.sha.slice(0, 12)}): ${head.counts.npm} npm versions in yarn.lock, ${head.counts.cargo} crates in Cargo.lock.` + (base ? ` Base \`${base.ref}\` (${base.sha.slice(0, 12)}).` : ''));
  out.push('');
  const all = countBySeverity(result.rows);
  out.push(`Advisories at head: ${all.total} (${all.text}); allowlisted rows: ${result.rows.filter((r) => r.status === 'allowed').length}.`);
  if (withdrawn.size) out.push(`Ignored (withdrawn in OSV): ${[...withdrawn].sort().join(', ')}.`);
  out.push('');
  if (result.errors.length) {
    out.push('### Allowlist problems (blocking)', '');
    for (const e of result.errors) out.push(`- ${e}`);
    out.push('');
  }
  if (result.blocking.length) {
    out.push(mode === 'ratchet' ? '### New advisories introduced by this change (blocking)' : '### Advisories not accepted by the allowlist (blocking)', '');
    out.push(table(result.blocking), '');
    out.push(`Fix: upgrade the package, or, if it does not affect this project, add an entry to \`${ALLOWLIST_PATH}\` with a VEX justification and a reviewBy date.`, '');
  }
  if (result.warnings.length) {
    out.push('### Warnings', '');
    for (const w of result.warnings) out.push(`- ${w}`);
    out.push('');
  }
  const allowed = result.rows.filter((r) => r.status === 'allowed');
  if (allowed.length) {
    out.push('<details><summary>Accepted by the allowlist</summary>', '');
    out.push(table(allowed), '', '</details>', '');
  }
  const existing = result.rows.filter((r) => r.status === 'existing');
  if (existing.length) {
    const c = countBySeverity(existing);
    out.push(`<details><summary>Already in the base branch, not blocking this PR: ${c.total} advisories (${c.text})</summary>`, '');
    out.push(table(existing), '', '</details>', '');
  }
  return out.join('\n');
}

const escapeData = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');

// ------------------------------------------------------------------ main

function usage(message) {
  if (message) console.error(`error: ${message}`);
  console.error('usage: node scripts/advisory-gate.mjs [--mode ratchet|absolute] [--base <ref>] [--head <ref>] [--json <file>]');
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { mode: 'ratchet', base: 'origin/develop', head: 'HEAD', json: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1];
    const need = () => {
      if (!value || value.startsWith('--')) usage(`${argv[i]} needs a value`);
      i += 1;
      return value;
    };
    switch (argv[i]) {
      case '--mode': opts.mode = need(); break;
      case '--base': opts.base = need(); break;
      case '--head': opts.head = need(); break;
      case '--json': opts.json = need(); break;
      case '-h': case '--help': usage(); break;
      default: usage(`unknown argument: ${argv[i]}`);
    }
  }
  if (!['ratchet', 'absolute'].includes(opts.mode)) usage('--mode must be ratchet or absolute');
  return opts;
}

export async function run(opts, { git = makeGit(process.cwd()), fetchImpl = fetch, todayMs, retryDelayMs, log = console.log } = {}) {
  const head = loadSnapshot(git, opts.head);
  const base = opts.mode === 'ratchet' ? loadSnapshot(git, opts.base) : null;
  const all = new Map();
  for (const p of [...head.packages, ...(base?.packages ?? [])]) all.set(pkgKey(p), p);
  log(`Querying OSV for ${all.size} package versions (head ${head.sha.slice(0, 12)}${base ? `, base ${base.sha.slice(0, 12)}` : ''})...`);
  const idsByPackage = await queryOsv([...all.values()], { fetchImpl, retryDelayMs });
  const ids = new Set();
  for (const set of idsByPackage.values()) for (const id of set) ids.add(id);
  log(`OSV returned ${ids.size} advisory ids; fetching their records...`);
  const vulns = await fetchVulns(ids, { fetchImpl, retryDelayMs });
  const headResult = buildFindings(head.packages, idsByPackage, vulns);
  const baseResult = base ? buildFindings(base.packages, idsByPackage, vulns) : { findings: [] };
  const today = todayMs ?? Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const result = evaluate({ mode: opts.mode, headFindings: headResult.findings, baseFindings: baseResult.findings, allowlistText: head.allowlistText, todayMs: today });
  return { head, base, result, withdrawn: headResult.withdrawn };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let outcome;
  try {
    outcome = await run(opts);
  } catch (err) {
    const msg = err instanceof GateError ? err.message : `${err.name}: ${err.message}`;
    console.log(`::error title=advisory gate::The advisory check could not run, so dependencies were NOT checked: ${escapeData(msg)}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Dependency advisories (OSV): ERROR\n\nThe check could not run, so dependencies were not checked:\n\n    ${msg}\n`);
    }
    process.exit(2);
  }
  const { head, base, result, withdrawn } = outcome;
  for (const r of sortRows(result.rows)) {
    const tag = { new: 'NEW', 'not-accepted': 'NOT ACCEPTED', existing: 'existing', allowed: 'allowed' }[r.status];
    console.log(`${tag.padEnd(12)} ${r.severity.padEnd(8)} ${r.key.padEnd(20)} ${r.ecosystem}:${r.package}@${r.version}  ${r.path} (${r.scope})`);
  }
  for (const e of result.errors) console.log(`::error title=advisory allowlist::${escapeData(e)}`);
  for (const w of result.warnings) console.log(`::warning title=advisory allowlist::${escapeData(w)}`);
  if (result.blocking.length) {
    const c = countBySeverity(result.blocking);
    const noun = c.total === 1 ? 'advisory' : 'advisories';
    const what = opts.mode === 'ratchet' ? `new ${noun} introduced by this change` : `${noun} not accepted by the allowlist`;
    console.log(`::error title=advisory gate::${c.total} ${what} (${c.text}). The table is in this step's log and in the job summary.`);
  }
  const summary = renderSummary({ mode: opts.mode, head, base, result, withdrawn });
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (opts.json) {
    const rows = result.rows.map(({ allowedBy, paths, ...r }) => ({ ...r, allowedBy: allowedBy ? allowedBy.index : null }));
    writeFileSync(opts.json, `${JSON.stringify({ mode: opts.mode, head: head.sha, base: base?.sha ?? null, pass: result.pass, errors: result.errors, warnings: result.warnings, rows }, null, 2)}\n`);
  }
  const c = countBySeverity(result.rows);
  console.log(`\nAdvisories at head: ${c.total} (${c.text}). Blocking: ${result.blocking.length} row(s), ${result.errors.length} allowlist problem(s).`);
  console.log(`Result: ${result.pass ? 'PASS' : 'FAIL'}`);
  process.exit(result.pass ? 0 : 1);
}

// Runs as a CLI (file or stdin); not when imported by the tests. If the
// runtime does not set import.meta.main, it runs: a gate that silently does
// nothing would be a pass.
if (import.meta.main !== false) {
  main().catch((err) => {
    console.log(`::error title=advisory gate::Unexpected failure, dependencies were NOT checked: ${escapeData(err.stack ?? err.message)}`);
    process.exit(2);
  });
}
