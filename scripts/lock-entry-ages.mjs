#!/usr/bin/env node
// Lockfile entry age gate: every package version that a change adds to
// yarn.lock or services/rust-api/Cargo.lock must have been published at least
// MIN_AGE_DAYS (7) days ago, unless security/lock-age-allowlist.json accepts
// it.
//
// Why: Dependabot's cooldown only delays the dependency a PR is about. The
// transitive versions that come with it in the lockfile, and Cargo
// lockfile-only updates, can be hours old. A compromised release is often
// published and pulled within a few days; this checks every new lockfile
// entry, direct or transitive, on every PR.
//
// What counts as new: a "name@version" in the head lockfile that the base
// lockfile does not have. Removed versions do not count. A change of only
// `resolved`, `integrity` or `checksum` for the same name@version is NOT in
// the scope of this gate (the age belongs to the published version, not to
// the URL or hash in the lockfile); the closed grammar below still validates
// those lines.
//
// Age: now - publish time, with the publish time from the registry:
//   npm      `time[version]` of https://registry.npmjs.org/<name> (the version
//            must also be in `versions`: an unpublished version is missing);
//   crates   `version.created_at` of https://crates.io/api/v1/crates/<name>/<version>.
// An entry passes when its age is at least MIN_AGE_DAYS * 24 h, to the
// millisecond: exactly 7 days old passes, 7 days minus 1 ms fails. A publish
// time in the future is "too young".
//
// Lockfiles are read with the closed grammar shared with the advisory gate
// (scripts/lib/lockfile-grammar.mjs: parseYarnLock, parseCargoLock), imported,
// not copied, so the two gates cannot read the same lockfile differently. Any
// line outside that grammar is exit 2. A lockfile missing in the base counts
// as empty (every entry of the head is new, e.g. a promotion PR into a branch
// that predates Cargo.lock); missing in the head is exit 2. That grammar only accepts registry sources: a yarn.lock `resolved`
// outside https://registry.npmjs.org or registry.yarnpkg.com (git, tarball
// URL, file:, another registry) and a Cargo.lock `source` other than crates.io
// fail both gates, with no exception possible, because there is no registry
// publish time to check. Cargo packages without `source` (the local crate,
// path dependencies, workspace members) are not published and are skipped.
//
// Exceptions (security/lock-age-allowlist.json, read from the head, like the
// advisory allowlist): exact ecosystem + package + version, a reason, the
// GHSA the young version is needed for, and reviewBy (at most
// MAX_EXCEPTION_DAYS ahead). Package names and versions must be exact (npm or
// crate name grammar, SemVer): no ranges or wildcards. An exception accepts the age only: the registry
// lookup must still succeed. Any invalid or expired entry fails the gate,
// whether or not this change uses it. Entries the change adds or edits are
// listed as warnings, because they take effect in the same run and need a
// human reviewer. The file must not be deleted, even when empty: its presence
// in the base branch is what makes CI run the base's copy of this gate, so a
// change that deletes it (the base has it, the head does not) fails (exit 1).
//
// Fails closed: exit 0 only if every new entry was looked up and is old
// enough or accepted. Network errors (after a short retry), HTTP errors, a
// missing package or version, an answer about a different package, or a
// publish time that is not an ISO 8601 date are exit 2.
//
// CI runs this file and the scripts/lib/ modules it imports from the PR's base
// branch (see ci.yml), with the lockfiles and the exceptions of the head, so a
// PR cannot weaken the gate that judges it. The minimum age is a constant
// here, not a command-line option, for the same reason. It does not import
// advisory-gate.mjs: importing a script that has a CLI entry point could run
// that CLI. Every file is read with `git show <ref>:<path>`, never from the
// working tree.
//
// Usage (from anywhere inside the repo):
//   node scripts/lock-entry-ages.mjs                      # origin/develop vs HEAD
//   node scripts/lock-entry-ages.mjs --base <ref> --head <ref>
// To review a PR, run develop's copy of this file and of scripts/lib/, not the
// PR's (see CONTRIBUTING.md, "Dependency updates (Dependabot)").
// Writes a Markdown report to $GITHUB_STEP_SUMMARY when it is set.
//
// Network: read-only GETs to registry.npmjs.org and crates.io, with a generic
// User-Agent naming this repository (crates.io rejects requests without one),
// at most one crates.io request per second (its crawler policy), a timeout,
// no redirects followed (a redirect is an error) and up to 3 attempts per
// request, one request per package (npm) or version
// (crates.io) per run.
//
// Exit codes: 0 pass; 1 the policy failed (an entry younger than the minimum
// age and not accepted, an invalid or expired exception, the exceptions file
// deleted); 2 the check could not run (registry lookup, git, a lockfile
// outside the grammar): NOT a clean result. A pass prints exactly one
// "Result: PASS" line, as its last line. CI counts a run as a pass only with
// exit 0 AND that line, so an exit 0 that skipped the check (e.g. the CLI did
// not start) is not a pass.

import { execFileSync } from 'node:child_process';
import { appendFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CRATE_NAME, GateError, NPM_NAME, SEMVER, parseCargoLock, parseYarnLock } from './lib/lockfile-grammar.mjs';
import { annotation, changedAllowlistEntries, md, oneLine } from './lib/gate-report.mjs';

export const MIN_AGE_DAYS = 7;
export const MAX_EXCEPTION_DAYS = 30;
export const EXCEPTIONS_PATH = 'security/lock-age-allowlist.json';
export const USER_AGENT = 'lock-entry-ages (+https://github.com/jpfigueredo/jpfigueredo.github.io)';
const NPM_REGISTRY = 'https://registry.npmjs.org';
const CRATES_API = 'https://crates.io/api/v1/crates';
const LOCKFILES = [
  { ecosystem: 'npm', path: 'yarn.lock', parse: (text) => parseYarnLock(text).byPackage },
  { ecosystem: 'crates.io', path: 'services/rust-api/Cargo.lock', parse: parseCargoLock },
];
const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_AGE_MS = MIN_AGE_DAYS * DAY_MS;
const TIMEOUT_MS = 30_000;
const ATTEMPTS = 3;
const WORKERS = 6;
const CRATES_INTERVAL_MS = 1000;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GHSA = /^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/;
const ENTRY_KEYS = ['ecosystem', 'package', 'version', 'ghsa', 'reason', 'reviewBy'];
const TOP_KEYS = new Set(['$comment', 'version', 'entries']);
const RESULT = ['PASS', 'FAIL (policy, exit 1)', 'ERROR (exit 2): not every new entry was checked'];

const sleepReal = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const utcDay = (ms) => Date.parse(`${new Date(ms).toISOString().slice(0, 10)}T00:00:00Z`);

// ------------------------------------------------------------------ lockfiles

// Entries of the head lockfile whose name@version the base does not have.
export function newEntries(baseMap, headMap) {
  return [...headMap.entries()].filter(([id]) => !baseMap.has(id)).map(([, e]) => ({ name: e.name, version: e.version }));
}

function parseLock({ path, parse }, text, ref) {
  try {
    return parse(text);
  } catch (err) {
    if (!(err instanceof GateError)) throw err;
    throw new GateError(
      `${path} at ${ref} does not fit the closed lockfile grammar shared with the advisory gate (only registry.npmjs.org/registry.yarnpkg.com tarballs and crates.io packages are accepted; git, tarball, file and other registries have no publish date to check and cannot be excepted): ${err.message}`,
    );
  }
}

// ------------------------------------------------------------------ exceptions

// Returns { entries, errors }. todayMs is UTC midnight of the run. Only valid
// entries are returned: an invalid one accepts nothing (and fails the gate).
export function parseExceptions(text, todayMs) {
  const errors = [];
  if (text === null) return { entries: [], errors };
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    return { entries: [], errors: [`${EXCEPTIONS_PATH} is not valid JSON: ${err.message}`] };
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc) || doc.version !== 1 || !Array.isArray(doc.entries)) {
    return { entries: [], errors: [`${EXCEPTIONS_PATH} must be { "version": 1, "entries": [...] }`] };
  }
  for (const k of Object.keys(doc)) if (!TOP_KEYS.has(k)) errors.push(`${EXCEPTIONS_PATH}: unknown top-level field "${k}"`);
  const entries = [];
  const seen = new Set();
  doc.entries.forEach((e, i) => {
    const isObject = e !== null && typeof e === 'object' && !Array.isArray(e);
    const where = `${EXCEPTIONS_PATH} entry ${i}${isObject && typeof e.package === 'string' ? ` (${e.package}@${e.version})` : ''}`;
    const before = errors.length;
    const err = (msg) => errors.push(`${where}: ${msg}`);
    if (!isObject) return err('not an object');
    for (const k of Object.keys(e)) if (!ENTRY_KEYS.includes(k)) err(`unknown field "${k}"`);
    if (e.ecosystem !== 'npm' && e.ecosystem !== 'crates.io') err('"ecosystem" must be "npm" or "crates.io"');
    const nameRe = e.ecosystem === 'crates.io' ? CRATE_NAME : NPM_NAME;
    if (typeof e.package !== 'string' || !nameRe.test(e.package)) err('"package" must be the exact package name (no alias, no wildcard)');
    if (typeof e.version !== 'string' || !SEMVER.test(e.version)) err('"version" must be one exact SemVer version (no range, no wildcard)');
    if (typeof e.ghsa !== 'string' || !GHSA.test(e.ghsa)) err('"ghsa" must be the GHSA id (GHSA-xxxx-xxxx-xxxx) that needs this version now');
    if (typeof e.reason !== 'string' || e.reason.trim().length < 20) err('"reason" must explain why the version cannot wait (20+ characters)');
    const reviewByMs = typeof e.reviewBy === 'string' && DATE.test(e.reviewBy) ? Date.parse(`${e.reviewBy}T00:00:00Z`) : NaN;
    if (Number.isNaN(reviewByMs) || new Date(reviewByMs).toISOString().slice(0, 10) !== e.reviewBy) {
      err('"reviewBy" must be a date (YYYY-MM-DD)');
    } else {
      const daysLeft = Math.round((reviewByMs - todayMs) / DAY_MS);
      if (daysLeft < 0) err(`expired on ${e.reviewBy}: remove the entry (the version is old enough by now) or review it and set a new reviewBy`);
      else if (daysLeft > MAX_EXCEPTION_DAYS) err(`reviewBy ${e.reviewBy} is ${daysLeft} days away; at most ${MAX_EXCEPTION_DAYS}`);
    }
    const key = `${e.ecosystem}|${e.package}@${e.version}`;
    if (seen.has(key)) err('duplicate entry');
    seen.add(key);
    if (errors.length === before) entries.push({ ...e, index: i });
  });
  return { entries, errors };
}

// ------------------------------------------------------------------ registries

// { body } on success, { notFound: true } on 404. Retries network errors, 429
// and 5xx; any other status is an error.
async function getJson(fetchImpl, url, sleep, retryDelayMs) {
  let lastError = 'no attempt';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (attempt > 1) await sleep(retryDelayMs * (attempt - 1));
    let res;
    try {
      res = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      lastError = `${err.name}: ${err.cause?.code ?? err.message}`;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastError = `HTTP ${res.status}`;
      continue;
    }
    if (res.status === 404) return { notFound: true };
    if (!res.ok) throw new GateError(`GET ${url}: HTTP ${res.status}`);
    try {
      return { body: await res.json() };
    } catch (err) {
      throw new GateError(`GET ${url}: response is not JSON (${err.message})`);
    }
  }
  throw new GateError(`GET ${url}: failed after ${ATTEMPTS} attempts (${lastError})`);
}

function publishTime(value, what) {
  if (typeof value !== 'string' || !ISO_TIME.test(value) || Number.isNaN(Date.parse(value))) {
    throw new GateError(`${what}: publish time ${String(JSON.stringify(value)).slice(0, 80)} is not an ISO 8601 date`);
  }
  return value;
}

// Publish-time lookups with a per-run cache: one npm document per package,
// one crates.io request per version, crates.io requests serialised.
export function makeRegistry({ fetchImpl = fetch, sleep = sleepReal, retryDelayMs = 2000, cratesIntervalMs = CRATES_INTERVAL_MS } = {}) {
  const npmDocs = new Map();
  const crates = new Map();
  let cratesQueue = Promise.resolve();
  let cratesRequests = 0;

  const npmDoc = (name) => {
    if (!npmDocs.has(name)) {
      // Names passed the npm name grammar; only the scope separator needs encoding.
      npmDocs.set(name, getJson(fetchImpl, `${NPM_REGISTRY}/${name.replace('/', '%2f')}`, sleep, retryDelayMs));
    }
    return npmDocs.get(name);
  };

  const crate = (name, version) => {
    const id = `${name}@${version}`;
    if (!crates.has(id)) {
      const url = `${CRATES_API}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
      const request = cratesQueue.then(async () => {
        if (cratesRequests > 0) await sleep(cratesIntervalMs);
        cratesRequests += 1;
        return getJson(fetchImpl, url, sleep, retryDelayMs);
      });
      cratesQueue = request.catch(() => {});
      crates.set(id, request);
    }
    return crates.get(id);
  };

  return {
    async published(ecosystem, name, version) {
      const id = `${name}@${version}`;
      if (ecosystem === 'npm') {
        const { body, notFound } = await npmDoc(name);
        if (notFound) throw new GateError(`npm: package ${name} is not in the registry`);
        if (body === null || typeof body !== 'object' || body.name !== name) {
          throw new GateError(`npm: the registry answered about ${String(JSON.stringify(body?.name)).slice(0, 80)} instead of ${name}`);
        }
        if (!body.versions || typeof body.versions !== 'object' || !Object.hasOwn(body.versions, version)) {
          throw new GateError(`npm: ${id} is not in the registry (never published, or unpublished)`);
        }
        const time = body.time && typeof body.time === 'object' && Object.hasOwn(body.time, version) ? body.time[version] : undefined;
        return publishTime(time, `npm: ${id}`);
      }
      if (ecosystem === 'crates.io') {
        const { body, notFound } = await crate(name, version);
        if (notFound) throw new GateError(`crates.io: ${id} is not in the registry`);
        const v = body?.version;
        if (!v || typeof v !== 'object' || v.crate !== name || v.num !== version) {
          throw new GateError(`crates.io: the answer for ${id} is about ${JSON.stringify(`${v?.crate}@${v?.num}`).slice(0, 80)}`);
        }
        return publishTime(v.created_at, `crates.io: ${id}`);
      }
      throw new GateError(`unknown ecosystem ${ecosystem}`);
    },
  };
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
    // File contents at a commit, or null if the path is not there.
    read(sha, path) {
      const listed = git(['ls-tree', '--name-only', '--full-tree', sha, '--', path]).trim();
      return listed === path ? git(['show', '--no-textconv', `${sha}:${path}`]) : null;
    },
  };
}

// ------------------------------------------------------------------ run

// Rows: one per new lockfile entry, status ok | young | accepted | failed.
export async function run(opts, { git = makeGit(process.cwd()), fetchImpl = fetch, nowMs = Date.now(), sleep = sleepReal, retryDelayMs, cratesIntervalMs, log = console.log } = {}) {
  const head = git.resolve(opts.head);
  const base = git.resolve(opts.base);
  const added = [];
  for (const lock of LOCKFILES) {
    const headText = git.read(head, lock.path);
    const baseText = git.read(base, lock.path);
    if (headText === null) throw new GateError(`${lock.path} is missing at ${opts.head}`);
    if (baseText === null) log(`${lock.path} is not in the base (${opts.base}): every entry of the head counts as new.`);
    const baseEntries = baseText === null ? new Map() : parseLock(lock, baseText, opts.base);
    const entries = newEntries(baseEntries, parseLock(lock, headText, opts.head));
    log(`${lock.path}: ${entries.length} new name@version entr${entries.length === 1 ? 'y' : 'ies'}`);
    for (const e of entries) added.push({ ecosystem: lock.ecosystem, ...e });
  }

  const headExceptions = git.read(head, EXCEPTIONS_PATH);
  const baseExceptions = git.read(base, EXCEPTIONS_PATH);
  const { entries: exceptions, errors } = parseExceptions(headExceptions, utcDay(nowMs));
  // The file in the base branch is what makes CI run the base's copy of this
  // gate (ci.yml). Deleting it would let the next PR run its own copy.
  if (headExceptions === null && baseExceptions !== null) {
    errors.push(
      `${EXCEPTIONS_PATH} is in the base but not in the head: this change deletes it. Its presence in the base branch is what makes CI run the base's copy of this gate, so it must stay, even when empty. Restore the file.`,
    );
  }
  const warnings = changedAllowlistEntries(headExceptions, baseExceptions).map(
    (e) => `${EXCEPTIONS_PATH}: this change adds or edits the exception ${e.ecosystem} ${e.package}@${e.version} (${e.ghsa}, reviewBy ${e.reviewBy}); it is already in effect in this run, so a reviewer must approve it`,
  );

  const registry = makeRegistry({ fetchImpl, sleep, retryDelayMs, cratesIntervalMs });
  const rows = new Array(added.length);
  let next = 0;
  const lookup = async (i) => {
    const e = added[i];
    try {
      const published = await registry.published(e.ecosystem, e.name, e.version);
      const ageMs = nowMs - Date.parse(published);
      const exception = exceptions.find((x) => x.ecosystem === e.ecosystem && x.package === e.name && x.version === e.version) ?? null;
      const status = ageMs >= MIN_AGE_MS ? 'ok' : exception ? 'accepted' : 'young';
      rows[i] = { ...e, published, ageDays: ageMs / DAY_MS, status, exception: status === 'accepted' ? exception : null };
    } catch (err) {
      if (!(err instanceof GateError)) throw err;
      rows[i] = { ...e, status: 'failed', error: err.message };
    }
  };
  await Promise.all(
    Array.from({ length: WORKERS }, async () => {
      while (next < added.length) {
        const i = next;
        next += 1;
        await lookup(i);
      }
    }),
  );

  const failed = rows.filter((r) => r.status === 'failed');
  const young = rows.filter((r) => r.status === 'young');
  const exitCode = failed.length > 0 ? 2 : young.length > 0 || errors.length > 0 ? 1 : 0;
  return { head, base, rows, errors, warnings, failed, young, exitCode };
}

// ------------------------------------------------------------------ report
//
// Names and versions passed the lockfile grammar; registry answers and
// exception fields are escaped for where they go (workflow command, log line,
// Markdown summary), as in the advisory gate.

function renderSummary({ head, base, rows, errors, warnings, exitCode }) {
  const out = [
    `## Lockfile entry age (minimum ${MIN_AGE_DAYS} days): ${RESULT[exitCode]}`,
    '',
    `Head ${head.slice(0, 12)}, base ${base.slice(0, 12)}: ${rows.length} new name@version entr${rows.length === 1 ? 'y' : 'ies'}.`,
    '',
  ];
  for (const e of errors) out.push(`- error: ${md(e)}`);
  for (const w of warnings) out.push(`- warning: ${md(w)}`);
  if (rows.length) {
    out.push('', '| status | ecosystem | package | published | age (days) |', '|---|---|---|---|---|');
    for (const r of rows) {
      out.push(`| ${r.status} | ${r.ecosystem} | ${md(`${r.name}@${r.version}`)} | ${md(r.published ?? r.error)} | ${r.ageDays === undefined ? '-' : r.ageDays.toFixed(1)} |`);
    }
  }
  return out.join('\n');
}

function usage(message) {
  if (message) console.error(`error: ${message}`);
  console.error('usage: node scripts/lock-entry-ages.mjs [--base <ref>] [--head <ref>]');
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { base: 'origin/develop', head: 'HEAD' };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1];
    const need = () => {
      if (!value || value.startsWith('--')) usage(`${argv[i]} needs a value`);
      i += 1;
      return value;
    };
    switch (argv[i]) {
      case '--base': opts.base = need(); break;
      case '--head': opts.head = need(); break;
      case '-h': case '--help': usage(); break;
      default: usage(`unknown argument: ${argv[i]}`);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let outcome;
  try {
    outcome = await run(opts);
  } catch (err) {
    const msg = err instanceof GateError ? err.message : `${err.name}: ${err.message}`;
    console.log(annotation('error', 'lock age gate', `The lockfile age check could not run, so new entries were NOT checked: ${msg}`));
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Lockfile entry age: ERROR (exit 2), not checked\n\n- ${md(msg)}\n`);
    }
    console.log(`Result: ${RESULT[2]}`);
    process.exit(2);
  }
  const { rows, errors, warnings, failed, young, exitCode } = outcome;
  for (const r of rows) {
    const tag = { ok: 'ok', young: 'TOO YOUNG', accepted: 'accepted', failed: 'LOOKUP FAILED' }[r.status];
    const detail =
      r.status === 'failed'
        ? r.error
        : `published ${r.published} (${r.ageDays.toFixed(1)} days ago)${r.exception ? `, exception ${r.exception.ghsa} until ${r.exception.reviewBy}` : ''}`;
    console.log(oneLine(`${tag.padEnd(13)} ${r.ecosystem.padEnd(9)} ${r.name}@${r.version}  ${detail}`));
  }
  for (const r of failed) console.log(annotation('error', 'lock age gate', `${r.ecosystem} ${r.name}@${r.version}: ${r.error}`));
  for (const r of young) {
    console.log(
      annotation(
        'error',
        'lock age gate',
        `${r.ecosystem} ${r.name}@${r.version} was published ${r.published}, ${r.ageDays.toFixed(1)} days ago (minimum ${MIN_AGE_DAYS}). Wait, keep an older version, or add an exception to ${EXCEPTIONS_PATH} (see CONTRIBUTING.md).`,
      ),
    );
  }
  for (const e of errors) console.log(annotation('error', 'lock age exceptions', e));
  for (const w of warnings) console.log(annotation('warning', 'lock age exceptions', w));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${renderSummary(outcome)}\n`);
  const accepted = rows.filter((r) => r.status === 'accepted').length;
  console.log(`\nChecked ${rows.length} new entr${rows.length === 1 ? 'y' : 'ies'}: ${young.length} younger than ${MIN_AGE_DAYS} days, ${accepted} accepted by an exception, ${failed.length} lookup failure(s), ${errors.length} exception problem(s).`);
  console.log(`Result: ${RESULT[exitCode]}`);
  process.exit(exitCode);
}

// Runs only as a CLI: when this file is the script node was started with
// (`node <path>/lock-entry-ages.mjs`, how CI and the runbook run it), never on
// import. Does not depend on import.meta.main, which Node versions before
// 22.18/24.2 do not set. Run it by path, not from stdin (there argv[1] is
// unset, nothing runs and the exit is 0). Exported for the tests.
export function invokedAsCli(moduleUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (invokedAsCli(import.meta.url)) {
  main().catch((err) => {
    console.log(annotation('error', 'lock age gate', `Unexpected failure, new lockfile entries were NOT checked: ${err.stack ?? err.message}`));
    process.exit(2);
  });
}
