#!/usr/bin/env node
// Lists every package version that a change adds to yarn.lock or
// services/rust-api/Cargo.lock, with how long ago that version was published,
// and fails if any is younger than the minimum age (default 7 days).
//
// Why: Dependabot's cooldown only delays the dependency a PR is about. The
// transitive versions that come with it in the lockfile, and Cargo
// lockfile-only updates, can be hours old. This checks every new lockfile
// entry, direct or not.
//
// Fails closed: exit 0 only if every new entry was looked up and is old
// enough. A lookup that fails (network, unknown version, non-registry source)
// is an error, not a pass.
//
// Usage (from anywhere inside the repo):
//   node scripts/lock-entry-ages.mjs                      # origin/develop vs HEAD
//   node scripts/lock-entry-ages.mjs --base <ref> --head <ref> --min-days 7
//
// Reads the two lockfiles with `git show <ref>:<path>`; never installs
// anything. Network: read-only GET requests to registry.npmjs.org (package
// document, `time` field) and crates.io (one version at a time, at most one
// request per second, as the crates.io crawler policy asks). crates.io
// rejects requests without a User-Agent; set LOCK_AGES_USER_AGENT to override
// the default one below.
//
// Exit codes: 0 all new entries old enough (or none); 1 at least one is
// younger than --min-days; 2 a lookup failed or bad usage.

import { execFileSync } from 'node:child_process';

const LOCKFILES = [
  { ecosystem: 'npm', path: 'yarn.lock', parse: parseYarnLock },
  { ecosystem: 'cargo', path: 'services/rust-api/Cargo.lock', parse: parseCargoLock },
];
const CRATES_IO_INDEX = 'registry+https://github.com/rust-lang/crates.io-index';
const NPM_REGISTRY_HOSTS = new Set(['registry.npmjs.org', 'registry.yarnpkg.com']);
const USER_AGENT =
  process.env.LOCK_AGES_USER_AGENT ||
  'lock-entry-ages (https://github.com/jpfigueredo/jpfigueredo.github.io)';
const TIMEOUT_MS = 30_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function usage(message) {
  if (message) console.error(`error: ${message}`);
  console.error('usage: node scripts/lock-entry-ages.mjs [--base <ref>] [--head <ref>] [--min-days <n>]');
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { base: 'origin/develop', head: 'HEAD', minDays: 7 };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1];
    switch (argv[i]) {
      case '--base': if (!value) usage('--base needs a ref'); opts.base = value; i += 1; break;
      case '--head': if (!value) usage('--head needs a ref'); opts.head = value; i += 1; break;
      case '--min-days':
        if (!/^\d+$/.test(value ?? '')) usage('--min-days needs a non-negative integer');
        opts.minDays = Number(value); i += 1; break;
      case '-h': case '--help': usage(); break;
      default: usage(`unknown argument: ${argv[i]}`);
    }
  }
  return opts;
}

// Contents of <path> at <ref>, or null if the file does not exist there.
// Any other git error (unknown ref, not a repo) is fatal.
function gitShow(ref, path) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { stdio: 'pipe' });
  } catch {
    usage(`unknown git ref: ${ref}`);
  }
  const git = (args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  const listed = git(['ls-tree', '--name-only', '--full-tree', ref, '--', path]).trim();
  if (listed === '') return null;
  return git(['show', `${ref}:${path}`]);
}

// yarn 1 lockfile -> Map "name@version" -> { name, version, source }.
// The package name comes from the `resolved` URL, so aliases
// ("string-width-cjs@npm:string-width@^4") resolve to the real package.
function parseYarnLock(text) {
  const entries = new Map();
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l && !l.startsWith('#'));
    if (lines.length === 0 || lines[0].startsWith(' ')) continue;
    const version = /^ {2}version "([^"]+)"/m.exec(block)?.[1];
    const resolved = /^ {2}resolved "([^"]+)"/m.exec(block)?.[1];
    if (!version) throw new Error(`yarn.lock entry without version: ${lines[0]}`);
    let name = null;
    let source = resolved ?? '(no resolved field)';
    if (resolved) {
      const url = new URL(resolved);
      const marker = url.pathname.indexOf('/-/');
      if (NPM_REGISTRY_HOSTS.has(url.hostname) && marker > 0) {
        name = decodeURIComponent(url.pathname.slice(1, marker));
        source = 'npm';
      }
    }
    if (!name) {
      // Not from the npm registry (git, file, tarball URL): no publish date to check.
      const key = lines[0].replace(/:$/, '').split(',')[0].trim().replace(/^"|"$/g, '');
      name = key.slice(0, key.lastIndexOf('@')) || key;
    }
    entries.set(`${name}@${version}`, { name, version, source });
  }
  return entries;
}

// Cargo.lock -> Map "name@version" -> { name, version, source }.
// Packages without `source` are local crates (rust-api itself): skipped.
function parseCargoLock(text) {
  const entries = new Map();
  for (const block of text.split(/^\[\[package\]\]$/m).slice(1)) {
    const name = /^name = "([^"]+)"/m.exec(block)?.[1];
    const version = /^version = "([^"]+)"/m.exec(block)?.[1];
    const rawSource = /^source = "([^"]+)"/m.exec(block)?.[1];
    if (!name || !version) throw new Error(`Cargo.lock package without name or version: ${block.slice(0, 80)}`);
    if (!rawSource) continue;
    const source = rawSource === CRATES_IO_INDEX ? 'crates.io' : rawSource;
    entries.set(`${name}@${version}`, { name, version, source });
  }
  return entries;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
}

const npmTimes = new Map();
async function npmPublished(name, version) {
  if (!npmTimes.has(name)) {
    const path = name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
    npmTimes.set(name, getJson(`https://registry.npmjs.org/${path}`).then((doc) => doc.time ?? {}));
  }
  const published = (await npmTimes.get(name))[version];
  if (!published) throw new Error(`npm registry has no publish time for ${name}@${version}`);
  return published;
}

let lastCratesRequest = 0;
async function cratePublished(name, version) {
  const wait = lastCratesRequest + 1000 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCratesRequest = Date.now();
  const doc = await getJson(
    `https://crates.io/api/v1/crates/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
  );
  const published = doc?.version?.created_at;
  if (!published) throw new Error(`crates.io has no created_at for ${name}@${version}`);
  return published;
}

async function lookup(ecosystem, entry) {
  if (ecosystem === 'npm' && entry.source === 'npm') return npmPublished(entry.name, entry.version);
  if (ecosystem === 'cargo' && entry.source === 'crates.io') return cratePublished(entry.name, entry.version);
  throw new Error(`source is not the public registry (${entry.source}); review it by hand`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const now = Date.now();
  let young = 0;
  let failed = 0;
  let checked = 0;

  console.log(`New lockfile entries in ${opts.head} compared with ${opts.base} (minimum age ${opts.minDays} days):`);
  for (const { ecosystem, path, parse } of LOCKFILES) {
    const headText = gitShow(opts.head, path);
    if (headText === null) continue;
    const baseText = gitShow(opts.base, path);
    const before = baseText === null ? new Map() : parse(baseText);
    const added = [...parse(headText)].filter(([key]) => !before.has(key)).map(([, entry]) => entry);
    console.log(`\n${path}: ${added.length} new or changed version(s)`);

    // npm lookups run a few at a time; crates.io ones are serialised above.
    const results = new Array(added.length);
    let next = 0;
    const workers = Array.from({ length: ecosystem === 'npm' ? 6 : 1 }, async () => {
      while (next < added.length) {
        const i = next;
        next += 1;
        try {
          results[i] = { published: await lookup(ecosystem, added[i]) };
        } catch (err) {
          results[i] = { error: err.message };
        }
      }
    });
    await Promise.all(workers);

    added.forEach((entry, i) => {
      checked += 1;
      const label = `${entry.name}@${entry.version}`;
      const { published, error } = results[i];
      if (error) {
        failed += 1;
        console.log(`  LOOKUP FAILED  ${label}  ${error}`);
        return;
      }
      const days = (now - Date.parse(published)) / DAY_MS;
      const tooYoung = !(days >= opts.minDays);
      if (tooYoung) young += 1;
      console.log(`  ${tooYoung ? 'TOO YOUNG    ' : 'ok           '}  ${label}  published ${published} (${days.toFixed(1)} days ago)`);
    });
  }

  console.log(`\nChecked ${checked} entr${checked === 1 ? 'y' : 'ies'}: ${young} younger than ${opts.minDays} days, ${failed} lookup failure(s).`);
  if (failed > 0) {
    console.log('Result: FAIL (a lookup failed, so the age of those entries is unknown).');
    process.exit(2);
  }
  if (young > 0) {
    console.log(`Result: FAIL (wait until every entry is at least ${opts.minDays} days old, or justify the exception in the PR).`);
    process.exit(1);
  }
  console.log('Result: OK');
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(2);
});
