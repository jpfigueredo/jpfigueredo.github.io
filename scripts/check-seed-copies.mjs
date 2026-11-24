#!/usr/bin/env node
// Fails CI when a copy of an Ohara trail seed or of its JSON Schema is
// versioned outside its one canonical place, packages/ohara-data
// (@jpfig/ohara-data). A second copy gets read by someone and drifts in
// silence: import from @jpfig/ohara-data instead of copying the file.
//
// What it scans: every *.json in the git index, any case (.JSON too:
// `git ls-files -s ':(icase)*.json'`), read from the index blobs, so only versioned content counts. Untracked
// files, node_modules and build output never enter. It runs as a plain
// script in CI, not as a turbo task, so no task cache can skip it.
//
// A file is Ohara data if any of these holds (same heuristics as before):
//   - name: its name is seed*.json and its path mentions "ohara";
//   - shape: it is a trail seed (trail.id is a string and nodes is an array),
//     which also catches a renamed copy that already diverged;
//   - schema: it declares the $id of packages/ohara-data/schema.json.
// Ohara data is allowed only at packages/ohara-data/seed.<name>.json,
// packages/ohara-data/schema.json and the paths in ALLOWLIST below.
//
// Usage: node scripts/check-seed-copies.mjs
// Exit codes: 0 no copy; 1 copies found (or a stale allowlist entry);
// 2 git error, or the canonical seed/schema not found (the scan would be empty).

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { annotation, oneLine } from './lib/gate-report.mjs';

export const CANONICAL_DIR = 'packages/ohara-data';
export const SCHEMA_PATH = `${CANONICAL_DIR}/schema.json`;
const CANONICAL = /^packages\/ohara-data\/(seed\.[a-z0-9-]+\.json|schema\.json)$/;

// Legitimate Ohara-shaped files outside the canonical place (test fixtures).
// Each entry needs a reason; an entry whose file is gone or no longer looks
// like Ohara data fails the check, so the list cannot rot.
//   { path: 'apps/ohara/front/src/test/fixtures/tiny-trail.json', reason: 'ten-node fixture for the graph tests' }
export const ALLOWLIST = [];

class GuardError extends Error {}

function git(repoRoot, args, input) {
  try {
    return execFileSync('git', ['-c', 'core.quotepath=off', ...args], {
      cwd: repoRoot,
      input,
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new GuardError(`git ${args[0]} failed: ${oneLine(err.stderr?.toString() || err.message)}`);
  }
}

// Versioned *.json files with their content from the index: [{ path, content }].
export function versionedJson(repoRoot) {
  const entries = git(repoRoot, ['ls-files', '-s', '-z', '--', ':(icase)*.json'])
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      // "<mode> <sha> <stage>\t<path>": the path runs to the end of the record
      // and may itself contain a TAB.
      const tab = line.indexOf('\t');
      const [mode, sha] = line.slice(0, tab).split(' ');
      return { mode, sha, path: line.slice(tab + 1) };
    })
    // Regular files only: skip symlinks (120000) and submodules (160000).
    .filter((e) => e.mode === '100644' || e.mode === '100755');
  if (entries.length === 0) return [];
  const out = git(repoRoot, ['cat-file', '--batch'], entries.map((e) => `${e.sha}\n`).join(''));
  const files = [];
  let pos = 0;
  for (const e of entries) {
    const nl = out.indexOf(10, pos);
    const header = out.subarray(pos, nl).toString('utf8').split(' ');
    if (header[0] !== e.sha || header[1] !== 'blob') throw new GuardError(`unexpected git cat-file output for ${e.path}`);
    const size = Number(header[2]);
    files.push({ path: e.path, content: out.subarray(nl + 1, nl + 1 + size).toString('utf8') });
    pos = nl + 1 + size + 1;
  }
  return files;
}

// Why a file is Ohara data (list of matched heuristics), or [] when it is not.
export function oharaDataReasons(relPath, content, schemaId) {
  const reasons = [];
  const name = relPath.slice(relPath.lastIndexOf('/') + 1);
  if (/^seed.*\.json$/i.test(name) && /ohara/i.test(relPath)) reasons.push('name');
  let json;
  try {
    json = JSON.parse(content);
  } catch {
    return reasons;
  }
  if (json === null || typeof json !== 'object') return reasons;
  if (typeof json.trail?.id === 'string' && Array.isArray(json.nodes)) reasons.push('shape');
  if (schemaId && json.$id === schemaId) reasons.push('schema $id');
  return reasons;
}

export function findCopies(files, allowlist = ALLOWLIST) {
  const schemaFile = files.find((f) => f.path === SCHEMA_PATH);
  if (!schemaFile) throw new GuardError(`${SCHEMA_PATH} is not versioned: nothing to compare against`);
  let schemaId;
  try {
    schemaId = JSON.parse(schemaFile.content).$id;
  } catch {
    throw new GuardError(`${SCHEMA_PATH} is not valid JSON`);
  }
  if (typeof schemaId !== 'string' || !schemaId) throw new GuardError(`${SCHEMA_PATH} has no $id`);

  const allowed = new Map(allowlist.map((a) => [a.path, a]));
  const detected = files
    .map((f) => ({ path: f.path, reasons: oharaDataReasons(f.path, f.content, schemaId) }))
    .filter((f) => f.reasons.length > 0);
  const canonical = detected.filter((f) => CANONICAL.test(f.path)).map((f) => f.path);
  const copies = detected.filter((f) => !CANONICAL.test(f.path) && !allowed.has(f.path));
  const detectedPaths = new Set(detected.map((f) => f.path));
  const stale = allowlist.filter((a) => !detectedPaths.has(a.path) || !a.reason);

  // The scan must see what it protects: the schema and at least one seed.
  if (!canonical.includes(SCHEMA_PATH)) throw new GuardError(`${SCHEMA_PATH} was not recognised by its own $id`);
  if (!canonical.some((p) => p !== SCHEMA_PATH)) throw new GuardError(`no seed.<name>.json recognised in ${CANONICAL_DIR}`);
  return { scanned: files.length, canonical, copies, stale };
}

export function run(repoRoot, { log = console.log, err = console.error, allowlist = ALLOWLIST } = {}) {
  let result;
  try {
    result = findCopies(versionedJson(repoRoot), allowlist);
  } catch (e) {
    if (!(e instanceof GuardError)) throw e;
    err(annotation('error', 'seed copy guard', e.message));
    return 2;
  }
  const { scanned, canonical, copies, stale } = result;
  log(`seed copy guard: ${scanned} versioned JSON file(s), canonical: ${canonical.join(', ')}; allowlisted: ${allowlist.length}`);
  for (const c of copies) {
    err(annotation('error', 'seed copy guard', `${c.path} is a copy of Ohara data (${c.reasons.join(', ')}). ` +
      `Seeds and schema live only in ${CANONICAL_DIR}: import @jpfig/ohara-data instead.`));
  }
  for (const a of stale) {
    err(annotation('error', 'seed copy guard', `allowlist entry ${a.path} ${a.reason ? 'is not versioned or no longer looks like Ohara data' : 'has no reason'}: remove or fix it.`));
  }
  if (copies.length || stale.length) return 1;
  log('seed copy guard: ok');
  return 0;
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
  if (process.argv.length > 2) {
    console.error('usage: node scripts/check-seed-copies.mjs');
    process.exitCode = 2;
  } else {
    process.exitCode = run(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  }
}
