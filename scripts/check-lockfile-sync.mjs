#!/usr/bin/env node
// Checks that yarn.lock fully describes what yarn 1 installs.
//
// Fails if:
//   - any package.json (root or workspace) declares a dependency range with no
//     entry in yarn.lock;
//   - a workspace depends on a sibling workspace with a range the sibling's
//     version does not satisfy (yarn would fetch that name from the registry);
//   - the root package.json has `resolutions` (they override yarn.lock at
//     install time, even with --frozen-lockfile).
//
// Why: in a yarn 1 workspace, `yarn install --frozen-lockfile` does not catch a
// package.json that drifted from yarn.lock. It resolves the missing range from
// the registry, installs it and exits 0. PR CI also diffs yarn.lock after a
// full install, but that cannot be used for production installs: `--production`
// rewrites yarn.lock without devDependencies. This check needs no install and
// no network. Workspaces are listed by yarn itself (`yarn workspaces info`).
//
// Usage (from anywhere):
//   node scripts/check-lockfile-sync.mjs
//   node scripts/check-lockfile-sync.mjs --installed services/bff-api
//   node scripts/check-lockfile-sync.mjs --installed services/edge-proxy --include-dev
//
// With --installed <dir>, after an install it also reads, for each dependency
// of <dir>/package.json, the package.json that Node resolves from <dir>
// (nearest node_modules walking up) and fails if its version differs from the
// version yarn.lock pins for that range. This catches a stale node_modules
// (e.g. restored from a build cache) shadowing the locked version.
// By default it checks `dependencies` and `optionalDependencies` only, which is
// what a `--production` install has. Add --include-dev to also check
// `devDependencies` (e.g. a deploy tool such as wrangler); a missing
// devDependency then fails too.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];

function fail(lines) {
  for (const line of [].concat(lines)) console.error(line);
  process.exit(1);
}

function readText(file, what) {
  try {
    return readFileSync(file, 'utf8');
  } catch (error) {
    return fail(`Cannot read ${what} (${path.relative(repoRoot, file)}): ${error.code ?? error.message}`);
  }
}

function readJson(file) {
  const text = readText(file, 'package.json');
  try {
    return JSON.parse(text);
  } catch (error) {
    return fail(`Invalid JSON in ${path.relative(repoRoot, file)}: ${error.message}`);
  }
}

// yarn.lock v1: an entry starts with an unindented line listing its patterns
// (comma-separated, optionally quoted, ending with ':'), followed by indented
// fields such as `  version "x.y.z"`. Returns Map(pattern -> version).
function parseLock(text) {
  const versions = new Map();
  let current = [];
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = line
        .replace(/:\s*$/, '')
        .split(/,\s+/)
        .map((raw) => raw.replace(/^"(.*)"$/, '$1'));
      for (const pattern of current) versions.set(pattern, undefined);
      continue;
    }
    const match = /^ {2}version "([^"]+)"$/.exec(line);
    if (match) for (const pattern of current) versions.set(pattern, match[1]);
  }
  return versions;
}

function yarnWorkspaces() {
  let out;
  try {
    out = execFileSync('yarn', ['-s', 'workspaces', 'info'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // yarn prints `error <message>` followed by a stack; keep the message only.
    const lines = (error.stderr || error.message || '').toString().trim().split('\n');
    const detail = (lines.find((line) => line.startsWith('error ')) ?? lines[0] ?? '').replace(/^error /, '');
    return fail(`\`yarn workspaces info\` failed: ${detail.replace(`${repoRoot}${path.sep}`, '')}`);
  }
  try {
    return JSON.parse(out);
  } catch {
    return fail('`yarn workspaces info` did not print JSON (is this yarn 1?).');
  }
}

const lockFile = path.join(repoRoot, 'yarn.lock');
if (!existsSync(lockFile)) fail('yarn.lock not found at the repository root.');
const lock = parseLock(readText(lockFile, 'yarn.lock'));

const rootPkg = readJson(path.join(repoRoot, 'package.json'));
if (rootPkg.resolutions && Object.keys(rootPkg.resolutions).length > 0) {
  fail([
    'Root package.json has `resolutions`, which override yarn.lock at install time:',
    ...Object.entries(rootPkg.resolutions).map(([name, value]) => `  ${name}: ${value}`),
    'This check does not support them; remove them or extend the check.',
  ]);
}

const workspaces = yarnWorkspaces();
const manifests = [
  { dir: '.', pkg: rootPkg, mismatched: [] },
  ...Object.values(workspaces).map((info) => ({
    dir: info.location,
    pkg: readJson(path.join(repoRoot, info.location, 'package.json')),
    mismatched: info.mismatchedWorkspaceDependencies ?? [],
  })),
];
// yarn 1 links a sibling workspace (no lock entry) when its version satisfies
// the range; otherwise it lists it as mismatched and fetches it from the registry.
const workspaceNames = new Set(Object.keys(workspaces));

const problems = [];
for (const { dir, pkg, mismatched } of manifests) {
  for (const name of mismatched) {
    problems.push(`${dir}: workspace dependency ${name} does not match the local workspace version (yarn would fetch it from the registry)`);
  }
  for (const field of FIELDS) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (workspaceNames.has(name)) continue;
      if (!lock.has(`${name}@${range}`)) problems.push(`${dir}: ${field}.${name}@${range} has no yarn.lock entry`);
    }
  }
}
if (problems.length > 0) {
  fail(['yarn.lock is out of sync with package.json:', ...problems.map((p) => `  ${p}`), 'Run `yarn install` and commit yarn.lock.']);
}
console.log(`yarn.lock in sync with ${manifests.length} package.json files.`);

// --installed <dir>: verify what Node actually resolves from <dir>.
const flag = process.argv.indexOf('--installed');
if (flag !== -1) {
  const relDir = process.argv[flag + 1];
  if (!relDir) fail('--installed needs a workspace directory, e.g. services/bff-api');
  const startDir = path.resolve(repoRoot, relDir);
  const pkg = readJson(path.join(startDir, 'package.json'));
  const includeDev = process.argv.includes('--include-dev');
  const required = includeDev ? ['dependencies', 'devDependencies'] : ['dependencies'];
  const mismatches = [];
  for (const field of [...required, 'optionalDependencies']) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (workspaceNames.has(name)) continue;
      const locked = lock.get(`${name}@${range}`);
      let found;
      for (let dir = startDir; ; dir = path.dirname(dir)) {
        const candidate = path.join(dir, 'node_modules', name, 'package.json');
        if (existsSync(candidate)) {
          found = candidate;
          break;
        }
        if (path.dirname(dir) === dir) break;
      }
      if (!found) {
        if (required.includes(field)) mismatches.push(`${name}@${range}: not installed (locked ${locked})`);
        continue;
      }
      const installed = readJson(found).version;
      const where = path.relative(repoRoot, found);
      console.log(`${relDir} uses ${name}@${installed} (${where}), yarn.lock: ${locked}`);
      if (installed !== locked) mismatches.push(`${name}@${range}: installed ${installed} at ${where}, yarn.lock pins ${locked}`);
    }
  }
  if (mismatches.length > 0) {
    fail([`Installed versions for ${relDir} differ from yarn.lock:`, ...mismatches.map((m) => `  ${m}`)]);
  }
}
