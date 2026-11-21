// Edge cases for scripts/lock-entry-ages.mjs (QA). No network: git and the
// registries are in-memory fakes, the clock is fixed.
//   node --test scripts/lock-entry-ages.edges.test.mjs

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GateError } from './lib/lockfile-grammar.mjs';
import { run } from './lock-entry-ages.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-21T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * DAY).toISOString();
const SHA1 = '0123456789abcdef0123456789abcdef01234567';
const INDEX = 'registry+https://github.com/rust-lang/crates.io-index';

function yarnEntry(keys, name, version) {
  const file = name.startsWith('@') ? name.split('/')[1] : name;
  return [
    `${keys.map((k) => `"${k}"`).join(', ')}:`,
    `  version "${version}"`,
    `  resolved "https://registry.yarnpkg.com/${name}/-/${file}-${version}.tgz#${SHA1}"`,
    '  integrity sha512-x',
  ].join('\n');
}
const yarnLock = (...entries) => `# yarn lockfile v1\n\n\n${entries.join('\n\n')}\n`;
const cargoLock = (...pkgs) =>
  `version = 4\n\n[[package]]\nname = "rust-api"\nversion = "0.1.0"\n` +
  pkgs.map(([n, v]) => `\n[[package]]\nname = "${n}"\nversion = "${v}"\nsource = "${INDEX}"\nchecksum = "${'0'.repeat(64)}"\n`).join('');

const LODASH = yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.21');
const snap = ({ yarn = [LODASH], cargo = [['serde', '1.0.0']], drop = [] } = {}) => {
  const files = { 'yarn.lock': yarnLock(...yarn), 'services/rust-api/Cargo.lock': cargoLock(...cargo) };
  for (const p of drop) delete files[p];
  return files;
};
const repo = (snapshots) => ({
  resolve(ref) {
    if (!snapshots[ref]) throw new GateError(`unknown git ref: ${ref}`);
    return ref.padEnd(40, '0');
  },
  read(sha, path) {
    return snapshots[sha.replace(/0+$/, '')][path] ?? null;
  },
});

// Raw URLs are recorded without decoding, so the encoding is what is tested.
function registry({ npm = {}, crates = {}, npmBody } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.startsWith('https://registry.npmjs.org/')) {
      const raw = url.slice('https://registry.npmjs.org/'.length);
      const name = raw.replace('%2f', '/');
      if (npmBody) return Response.json(npmBody(name));
      const times = npm[raw];
      if (!times) return Response.json({ error: 'Not found' }, { status: 404 });
      return Response.json({ name, versions: Object.fromEntries(Object.keys(times).map((v) => [v, {}])), time: times });
    }
    const m = /^https:\/\/crates\.io\/api\/v1\/crates\/([^/]+)\/([^/]+)$/.exec(url);
    if (m && crates[`${m[1]}@${m[2]}`]) return Response.json({ version: { crate: m[1], num: m[2], created_at: crates[`${m[1]}@${m[2]}`] } });
    return Response.json({}, { status: 404 });
  };
  return { fetchImpl, calls };
}
const gate = (snaps, reg) =>
  run({ base: 'base', head: 'head' }, { git: repo(snaps), fetchImpl: reg.fetchImpl, nowMs: NOW, sleep: async () => {}, retryDelayMs: 0, log: () => {} });
const rows = (out) => out.rows.map((r) => `${r.status} ${r.name}@${r.version}`);

describe('lockfile shapes', () => {
  it('scoped package: one request to /@scope%2fname, by the real name', async () => {
    const reg = registry({ npm: { '@babel%2fcore': { '8.1.3': daysAgo(1) } } });
    const out = await gate({ base: snap(), head: snap({ yarn: [LODASH, yarnEntry(['@babel/core@^8.1.3'], '@babel/core', '8.1.3')] }) }, reg);
    assert.deepEqual(reg.calls, ['https://registry.npmjs.org/@babel%2fcore']);
    assert.deepEqual(rows(out), ['young @babel/core@8.1.3']);
    assert.equal(out.exitCode, 1);
  });

  it('one block with several keys (two workspaces, two ranges) is one name@version', async () => {
    const reg = registry({ npm: { 'left-pad': { '1.3.0': daysAgo(2) } } });
    const multi = yarnEntry(['left-pad@^1.3.0', 'left-pad@~1.3.0', 'left-pad@1.3.0'], 'left-pad', '1.3.0');
    const out = await gate({ base: snap(), head: snap({ yarn: [LODASH, multi] }) }, reg);
    assert.deepEqual(rows(out), ['young left-pad@1.3.0']);
    assert.equal(reg.calls.length, 1);
  });

  it('alias and real name for the same version in separate blocks: one row, real name', async () => {
    const reg = registry({ npm: { typescript: { '5.0.2': daysAgo(3) } } });
    const real = yarnEntry(['typescript@5.0.2'], 'typescript', '5.0.2');
    const alias = yarnEntry(['ts-old@npm:typescript@5.0.2'], 'typescript', '5.0.2');
    const out = await gate({ base: snap(), head: snap({ yarn: [LODASH, real, alias] }) }, reg);
    assert.deepEqual(rows(out), ['young typescript@5.0.2']);
  });

  it('a change of only the key (range) of an existing name@version adds nothing', async () => {
    const reg = registry();
    const out = await gate({ base: snap(), head: snap({ yarn: [yarnEntry(['lodash@^4.17.21'], 'lodash', '4.17.21')] }) }, reg);
    assert.deepEqual(out.rows, []);
    assert.equal(reg.calls.length, 0);
    assert.equal(out.exitCode, 0);
  });

  it('crate with two versions: only the new one is looked up', async () => {
    const reg = registry({ crates: { 'cc@1.11.3': daysAgo(1) } });
    const out = await gate({ base: snap({ cargo: [['cc', '1.11.2']] }), head: snap({ cargo: [['cc', '1.11.2'], ['cc', '1.11.3']] }) }, reg);
    assert.deepEqual(rows(out), ['young cc@1.11.3']);
    assert.deepEqual(reg.calls, ['https://crates.io/api/v1/crates/cc/1.11.3']);
  });

  it('no Cargo.lock in the base (promotion into release/main): every crate of the head is new and checked', async () => {
    const reg = registry({ crates: { 'serde@1.0.0': daysAgo(900) } });
    const out = await gate({ base: snap({ drop: ['services/rust-api/Cargo.lock'] }), head: snap() }, reg);
    assert.deepEqual(rows(out), ['ok serde@1.0.0']);
    assert.deepEqual(reg.calls, ['https://crates.io/api/v1/crates/serde/1.0.0']);
    assert.equal(out.exitCode, 0);
  });

  it('no Cargo.lock in the head is still exit 2 (GateError)', async () => {
    await assert.rejects(gate({ base: snap(), head: snap({ drop: ['services/rust-api/Cargo.lock'] }) }, registry()), /Cargo\.lock is missing at head/);
  });
});

describe('registry answers with a missing or corrupt publish time fail closed (exit 2)', () => {
  const head = snap({ yarn: [yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.22')] });
  const cases = {
    'time absent': (name) => ({ name, versions: { '4.17.22': {} } }),
    'time not an object': (name) => ({ name, versions: { '4.17.22': {} }, time: 'yesterday' }),
    'time without the version': (name) => ({ name, versions: { '4.17.22': {} }, time: { '4.17.21': daysAgo(400) } }),
    'time without a zone (local time is ambiguous)': (name) => ({ name, versions: { '4.17.22': {} }, time: { '4.17.22': '2026-11-01T10:00:00' } }),
    'time as epoch number': (name) => ({ name, versions: { '4.17.22': {} }, time: { '4.17.22': NOW - 30 * DAY } }),
    'time inherited from the prototype': (name) => ({ name, versions: { '4.17.22': {} }, time: JSON.parse('{"__proto__": {"4.17.22": "2020-01-01T00:00:00Z"}}') }),
  };
  for (const [label, body] of Object.entries(cases)) {
    it(label, async () => {
      const out = await gate({ base: snap(), head }, registry({ npmBody: body }));
      assert.equal(out.exitCode, 2);
      assert.deepEqual(rows(out), ['failed lodash@4.17.22']);
    });
  }
});
