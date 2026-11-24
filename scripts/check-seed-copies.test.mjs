// Tests for scripts/check-seed-copies.mjs. Built-in test runner, no network,
// no dependencies. Each case builds a throwaway git repository in a temp dir;
// one case runs the guard against this repository.
//   node --test scripts/check-seed-copies.test.mjs

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ALLOWLIST, findCopies, oharaDataReasons, run, versionedJson } from './check-seed-copies.mjs';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const REPO = join(SCRIPTS, '..');
const SCRIPT = join(SCRIPTS, 'check-seed-copies.mjs');

const SCHEMA_ID = 'https://example.invalid/ohara/schema.json';
const SCHEMA = { $schema: 'http://json-schema.org/draft-07/schema#', $id: SCHEMA_ID, type: 'object' };
const SEED = {
  trail: { id: 'trail-a', title: 'Trail A', tags: ['t'] },
  nodes: [{ id: 'n1', type: 'paper', label: 'N1', year: 1970, sources: [{ sourceType: 'free', url: 'https://example.org/n1' }] }],
  edges: [],
};
const BASE = {
  'package.json': { name: 'root', private: true },
  'packages/ohara-data/schema.json': SCHEMA,
  'packages/ohara-data/seed.trail-a.json': SEED,
};

const temps = [];
after(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

const GIT_ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };

// A git repository with `tracked` added to the index and `untracked` only on disk.
function repo(tracked, untracked = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'seed-copies-'));
  temps.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir, env: GIT_ENV });
  const write = (files) => {
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    }
  };
  write(tracked);
  write(untracked);
  if (Object.keys(tracked).length) execFileSync('git', ['add', '--', ...Object.keys(tracked)], { cwd: dir, env: GIT_ENV });
  return dir;
}

const quiet = () => {
  const lines = { out: [], err: [] };
  return { lines, log: (s) => lines.out.push(s), err: (s) => lines.err.push(s) };
};
const copiesIn = (dir, allowlist = []) => findCopies(versionedJson(dir), allowlist).copies.map((c) => [c.path, c.reasons.join('+')]);

describe('oharaDataReasons (the three heuristics)', () => {
  it('name: seed*.json in a path that mentions ohara, even when broken', () => {
    assert.deepEqual(oharaDataReasons('apps/ohara/front/src/data/seed.novo.json', '{', SCHEMA_ID), ['name']);
  });
  it('shape: trail.id + nodes[] under any name, even divergent', () => {
    assert.deepEqual(oharaDataReasons('web/src/data/trilha.json', JSON.stringify({ ...SEED, nodes: [] }), SCHEMA_ID), ['shape']);
  });
  it('schema: declares the schema $id under any name', () => {
    assert.deepEqual(oharaDataReasons('web/src/contrato.json', JSON.stringify(SCHEMA), SCHEMA_ID), ['schema $id']);
  });
  it('all three at once', () => {
    assert.deepEqual(oharaDataReasons('x/ohara/seed.json', JSON.stringify({ ...SEED, $id: SCHEMA_ID }), SCHEMA_ID), ['name', 'shape', 'schema $id']);
  });
  for (const [rel, content] of [
    ['web/src/data/outro/seed.json', JSON.stringify({ nodes: [], edges: [] })], // another project's seed, no trail
    ['web/src/data/x.json', JSON.stringify({ trail: { id: 1 }, nodes: [] })], // trail.id not a string
    ['web/src/data/y.json', JSON.stringify({ trail: { id: 'a' }, nodes: {} })], // nodes not an array
    ['web/src/data/z.json', 'null'],
    ['web/src/data/w.json', '[1,2]'],
    ['web/src/seed.json', '{'], // seed name but no "ohara" in the path
    ['package.json', JSON.stringify({ name: 'ohara' })],
  ]) {
    it(`not Ohara data: ${rel} ${content.slice(0, 40)}`, () => assert.deepEqual(oharaDataReasons(rel, content, SCHEMA_ID), []));
  }
});

describe('findCopies over the git index', () => {
  it('a clean repository passes and names the canonical files', () => {
    const r = findCopies(versionedJson(repo(BASE)), []);
    assert.deepEqual(r.copies, []);
    assert.deepEqual(r.canonical.sort(), ['packages/ohara-data/schema.json', 'packages/ohara-data/seed.trail-a.json']);
    assert.equal(r.scanned, 3);
  });

  it('catches an identical copy, a renamed copy and a divergent copy', () => {
    const dir = repo({
      ...BASE,
      'apps/ohara/front/src/data/seed.trail-a.json': SEED, // identical
      'web/src/data/trilha.json': SEED, // renamed
      'services/api/fixture.json': { ...SEED, trail: { ...SEED.trail, title: 'changed' }, nodes: [] }, // divergent
    });
    assert.deepEqual(copiesIn(dir), [
      ['apps/ohara/front/src/data/seed.trail-a.json', 'name+shape'],
      ['services/api/fixture.json', 'shape'],
      ['web/src/data/trilha.json', 'shape'],
    ]);
  });

  it('catches a copy of the schema under another name', () => {
    assert.deepEqual(copiesIn(repo({ ...BASE, 'web/src/data/contract.json': SCHEMA })), [['web/src/data/contract.json', 'schema $id']]);
  });

  it('catches a second copy inside the canonical package under a non-canonical name', () => {
    assert.deepEqual(copiesIn(repo({ ...BASE, 'packages/ohara-data/backup/seed-old.json': SEED })), [['packages/ohara-data/backup/seed-old.json', 'name+shape']]);
  });

  it('ignores files that are not versioned (untracked copies)', () => {
    const dir = repo(BASE, { 'web/src/data/trilha.json': SEED, 'apps/ohara/seed.x.json': SEED });
    assert.deepEqual(copiesIn(dir), []);
  });

  it('reads the index, not the working tree', () => {
    const dir = repo({ ...BASE, 'web/src/data/notes.json': { a: 1 } });
    // Becomes a seed copy on disk only; the index still has the harmless blob.
    writeFileSync(join(dir, 'web/src/data/notes.json'), JSON.stringify(SEED));
    assert.deepEqual(copiesIn(dir), []);
    execFileSync('git', ['add', 'web/src/data/notes.json'], { cwd: dir, env: GIT_ENV });
    assert.deepEqual(copiesIn(dir), [['web/src/data/notes.json', 'shape']]);
  });

  it('handles paths with spaces and non-ASCII names', () => {
    assert.deepEqual(copiesIn(repo({ ...BASE, 'web/src/dados/trilha ção.json': SEED })), [['web/src/dados/trilha ção.json', 'shape']]);
  });

  it('skips a versioned symlink (its blob is a path, not JSON)', () => {
    const dir = repo(BASE);
    symlinkSync('../packages/ohara-data/seed.trail-a.json', join(dir, 'link.json'));
    execFileSync('git', ['add', 'link.json'], { cwd: dir, env: GIT_ENV });
    assert.equal(versionedJson(dir).some((f) => f.path === 'link.json'), false);
  });

  it('an allowlisted fixture passes; a stale or reasonless entry fails', () => {
    const dir = repo({ ...BASE, 'apps/ohara/front/src/test/fixtures/tiny.json': SEED });
    const ok = findCopies(versionedJson(dir), [{ path: 'apps/ohara/front/src/test/fixtures/tiny.json', reason: 'graph tests' }]);
    assert.deepEqual([ok.copies, ok.stale], [[], []]);
    const stale = findCopies(versionedJson(dir), [
      { path: 'apps/ohara/front/src/test/fixtures/tiny.json', reason: '' },
      { path: 'gone.json', reason: 'removed fixture' },
    ]);
    assert.deepEqual(stale.stale.map((a) => a.path), ['apps/ohara/front/src/test/fixtures/tiny.json', 'gone.json']);
  });

  it('refuses to pass empty: no schema, schema without $id, or no seed', () => {
    assert.throws(() => findCopies(versionedJson(repo({ 'package.json': {} })), []), /schema\.json is not versioned/);
    assert.throws(() => findCopies(versionedJson(repo({ ...BASE, 'packages/ohara-data/schema.json': { type: 'object' } })), []), /has no \$id/);
    assert.throws(() => findCopies(versionedJson(repo({ ...BASE, 'packages/ohara-data/schema.json': '{' })), []), /not valid JSON/);
    const noSeed = { 'packages/ohara-data/schema.json': SCHEMA };
    assert.throws(() => findCopies(versionedJson(repo(noSeed)), []), /no seed\.<name>\.json recognised/);
  });
});

describe('run (exit codes and messages)', () => {
  it('0 when clean, 1 with ::error per copy, 1 for a stale allowlist entry, 2 outside a git repository', () => {
    let q = quiet();
    assert.equal(run(repo(BASE), { ...q, allowlist: [] }), 0);
    assert.match(q.lines.out.at(-1), /seed copy guard: ok/);

    q = quiet();
    assert.equal(run(repo({ ...BASE, 'web/src/data/trilha.json': SEED }), { ...q, allowlist: [] }), 1);
    assert.equal(q.lines.err.length, 1);
    assert.match(q.lines.err[0], /^::error title=seed copy guard::web\/src\/data\/trilha\.json is a copy of Ohara data \(shape\)/);

    q = quiet();
    assert.equal(run(repo(BASE), { ...q, allowlist: [{ path: 'gone.json', reason: 'x' }] }), 1);
    assert.match(q.lines.err[0], /allowlist entry gone\.json/);

    const notGit = mkdtempSync(join(tmpdir(), 'seed-copies-nogit-'));
    temps.push(notGit);
    q = quiet();
    assert.equal(run(notGit, { ...q, allowlist: [] }), 2);
    assert.match(q.lines.err[0], /git ls-files failed/);
  });

  it('this repository has no copy, and the shipped allowlist is valid', () => {
    const q = quiet();
    assert.equal(run(REPO, q), 0, q.lines.err.join('\n'));
    for (const a of ALLOWLIST) assert.ok(a.path && a.reason, JSON.stringify(a));
  });

  it('by path: exits 0 on this repository, 2 on an extra argument', () => {
    const ok = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', cwd: tmpdir() });
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /seed copy guard: ok/);
    const bad = spawnSync(process.execPath, [SCRIPT, '--x'], { encoding: 'utf8' });
    assert.equal(bad.status, 2);
  });

  it('the canonical seed in this repository is recognised by shape and name rules', () => {
    const seed = readFileSync(join(REPO, 'packages/ohara-data/seed.distributed-systems.json'), 'utf8');
    const schemaId = JSON.parse(readFileSync(join(REPO, 'packages/ohara-data/schema.json'), 'utf8')).$id;
    assert.deepEqual(oharaDataReasons('web/src/data/copy.json', seed, schemaId), ['shape']);
  });
});
