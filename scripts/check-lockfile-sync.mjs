#!/usr/bin/env node
// Fails if any workspace package.json declares a dependency range that has no
// entry in yarn.lock.
//
// Why: in a yarn 1 workspace, `yarn install --frozen-lockfile` does not catch a
// package.json that drifted from yarn.lock. It resolves the missing range from
// the registry, installs it and exits 0, so the lockfile no longer describes
// what was installed. PR CI catches this by installing without the flag and
// diffing yarn.lock, but that does not work for production installs:
// `--production` rewrites yarn.lock without devDependencies. This check needs
// no install and no network.
//
// Usage (from anywhere): node scripts/check-lockfile-sync.mjs

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// yarn.lock v1: each entry starts with an unindented line listing its patterns,
// comma-separated, optionally quoted, ending with ':'.
function lockPatterns(text) {
  const patterns = new Set();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#') || /^\s/.test(line)) continue;
    for (const raw of line.replace(/:\s*$/, '').split(/,\s+/)) {
      patterns.add(raw.replace(/^"(.*)"$/, '$1'));
    }
  }
  return patterns;
}

// Expands the workspace globs used by this repo ("dir", "dir/*", "dir/*/*").
function workspaceDirs(globs) {
  const dirs = new Set();
  for (const glob of globs) {
    let current = [repoRoot];
    for (const part of glob.split('/')) {
      const next = [];
      for (const dir of current) {
        if (part === '*') {
          if (!existsSync(dir)) continue;
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory() && entry.name !== 'node_modules') {
              next.push(path.join(dir, entry.name));
            }
          }
        } else {
          next.push(path.join(dir, part));
        }
      }
      current = next;
    }
    for (const dir of current) {
      if (existsSync(path.join(dir, 'package.json'))) dirs.add(dir);
    }
  }
  return [...dirs];
}

const rootPkg = readJson(path.join(repoRoot, 'package.json'));
const patterns = lockPatterns(readFileSync(path.join(repoRoot, 'yarn.lock'), 'utf8'));
const manifests = [repoRoot, ...workspaceDirs(rootPkg.workspaces ?? [])].map((dir) => ({
  dir: path.relative(repoRoot, dir) || '.',
  pkg: readJson(path.join(dir, 'package.json')),
}));
// yarn 1 links sibling workspaces instead of locking them.
const workspaceNames = new Set(manifests.map(({ pkg }) => pkg.name));

const missing = [];
for (const { dir, pkg } of manifests) {
  for (const field of FIELDS) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      if (workspaceNames.has(name)) continue;
      if (!patterns.has(`${name}@${range}`)) missing.push(`${dir}: ${field}.${name}@${range}`);
    }
  }
}

if (missing.length > 0) {
  console.error('yarn.lock is out of sync with package.json. Missing entries:');
  for (const entry of missing) console.error(`  ${entry}`);
  console.error('Run `yarn install` and commit yarn.lock.');
  process.exit(1);
}
console.log(`yarn.lock in sync with ${manifests.length} package.json files.`);
