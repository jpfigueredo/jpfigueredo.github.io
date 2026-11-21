// Tests for scripts/lock-entry-ages.mjs. Built-in test runner, no network, no
// dependencies: git and the registries are replaced by in-memory fakes, and
// the clock is fixed.
//   node --test scripts/lock-entry-ages.test.mjs

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GateError } from './advisory-gate.mjs';
import { EXCEPTIONS_PATH, MAX_EXCEPTION_DAYS, MIN_AGE_MS, USER_AGENT, parseExceptions, run } from './lock-entry-ages.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-21T12:00:00Z');
const TODAY = Date.parse('2026-11-21T00:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const daysAgo = (d) => ago(d * DAY);
const SHA1 = '0123456789abcdef0123456789abcdef01234567';
const INDEX = 'registry+https://github.com/rust-lang/crates.io-index';

// ---------------------------------------------------------------- fixtures

function yarnEntry(keys, name, version, { host = 'registry.yarnpkg.com', sha1 = SHA1, integrity = 'sha512-x', resolved } = {}) {
  const file = name.startsWith('@') ? name.split('/')[1] : name;
  return [
    `${keys.map((k) => `"${k}"`).join(', ')}:`,
    `  version "${version}"`,
    `  resolved "${resolved ?? `https://${host}/${name}/-/${file}-${version}.tgz#${sha1}`}"`,
    `  integrity ${integrity}`,
  ].join('\n');
}

const yarnLock = (...entries) => `# yarn lockfile v1\n\n\n${entries.join('\n\n')}\n`;

// crates: [name, version] from crates.io, or [name, version, source] (null: no source).
const cargoLock = (...pkgs) =>
  `version = 4\n\n[[package]]\nname = "rust-api"\nversion = "0.1.0"\n` +
  pkgs
    .map(([n, v, source = INDEX]) =>
      source === null
        ? `\n[[package]]\nname = "${n}"\nversion = "${v}"\n`
        : `\n[[package]]\nname = "${n}"\nversion = "${v}"\nsource = "${source}"\nchecksum = "${'0'.repeat(64)}"\n`,
    )
    .join('');

const LODASH_20 = yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.20');
const LODASH_21 = yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.21');

function snapshot({ yarn = [LODASH_20], cargo = [['serde', '1.0.0']], exceptions, lock, cargoText } = {}) {
  const files = {
    'yarn.lock': lock ?? yarnLock(...yarn),
    'services/rust-api/Cargo.lock': cargoText ?? cargoLock(...cargo),
  };
  if (exceptions !== undefined) files[EXCEPTIONS_PATH] = typeof exceptions === 'string' ? exceptions : JSON.stringify({ version: 1, entries: exceptions });
  return files;
}

// A repository with one commit per ref.
function repo(snapshots) {
  return {
    resolve(ref) {
      if (!snapshots[ref]) throw new GateError(`unknown git ref: ${ref}`);
      return `${ref}`.padEnd(40, '0');
    },
    read(sha, path) {
      return snapshots[sha.replace(/0+$/, '')][path] ?? null;
    },
  };
}

// Fake registries. npm: { name: { version: publishTime } }; crates: { "name@version": createdAt }.
// fail(url) may return a Response (or throw) to replace the normal answer.
function registry({ npm = {}, crates = {}, fail } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init?.headers });
    if (fail) {
      const answer = fail(url);
      if (answer) return answer;
    }
    if (url.startsWith('https://registry.npmjs.org/')) {
      const name = decodeURIComponent(url.slice('https://registry.npmjs.org/'.length));
      const times = npm[name];
      if (!times) return Response.json({ error: 'Not found' }, { status: 404 });
      const versions = Object.fromEntries(Object.keys(times).map((v) => [v, { name, version: v }]));
      return Response.json({ name, versions, time: { created: '2010-01-01T00:00:00.000Z', ...times } });
    }
    const m = /^https:\/\/crates\.io\/api\/v1\/crates\/([^/]+)\/([^/]+)$/.exec(url);
    if (m) {
      const [name, num] = [decodeURIComponent(m[1]), decodeURIComponent(m[2])];
      const created = crates[`${name}@${num}`];
      if (!created) return Response.json({ errors: [{ detail: 'not found' }] }, { status: 404 });
      return Response.json({ version: { crate: name, num, created_at: created, yanked: false } });
    }
    throw new Error(`unexpected URL in test: ${url}`);
  };
  return { fetchImpl, calls };
}

const OLD = { npm: { lodash: { '4.17.20': daysAgo(900), '4.17.21': daysAgo(400) } }, crates: { 'serde@1.0.0': daysAgo(900) } };

const gate = (snaps, reg, extra = {}) =>
  run({ base: 'base', head: 'head' }, { git: repo(snaps), fetchImpl: reg.fetchImpl, nowMs: NOW, sleep: async () => {}, retryDelayMs: 0, log: () => {}, ...extra });

const exception = (over = {}) => ({
  ecosystem: 'npm',
  package: 'lodash',
  version: '4.17.21',
  ghsa: 'GHSA-35jh-r3h4-6jhm',
  reason: 'Fixes the prototype pollution advisory; cannot wait 7 days.',
  reviewBy: '2026-12-01',
  ...over,
});

const statuses = (out) => out.rows.map((r) => `${r.status} ${r.ecosystem}:${r.name}@${r.version}`);

// ---------------------------------------------------------------- age

describe('age of new entries', () => {
  it('fails a new npm entry younger than 7 days', async () => {
    const reg = registry({ npm: { lodash: { '4.17.21': daysAgo(2) } } });
    const out = await gate({ base: snapshot(), head: snapshot({ yarn: [LODASH_21] }) }, reg);
    assert.deepEqual(statuses(out), ['young npm:lodash@4.17.21']);
    assert.equal(out.exitCode, 1);
    assert.equal(out.young.length, 1);
  });

  it('passes an entry exactly 7 days old and fails one 1 ms younger (the boundary is >= 7 * 24 h)', async () => {
    const snaps = { base: snapshot(), head: snapshot({ yarn: [LODASH_21] }) };
    const exact = await gate(snaps, registry({ npm: { lodash: { '4.17.21': ago(MIN_AGE_MS) } } }));
    assert.deepEqual(statuses(exact), ['ok npm:lodash@4.17.21']);
    assert.equal(exact.exitCode, 0);
    const almost = await gate(snaps, registry({ npm: { lodash: { '4.17.21': ago(MIN_AGE_MS - 1) } } }));
    assert.deepEqual(statuses(almost), ['young npm:lodash@4.17.21']);
    assert.equal(almost.exitCode, 1);
  });

  it('passes an old new entry', async () => {
    const out = await gate({ base: snapshot(), head: snapshot({ yarn: [LODASH_21] }) }, registry(OLD));
    assert.deepEqual(statuses(out), ['ok npm:lodash@4.17.21']);
    assert.equal(out.exitCode, 0);
  });

  it('treats a publish time in the future as too young', async () => {
    const out = await gate({ base: snapshot(), head: snapshot({ yarn: [LODASH_21] }) }, registry({ npm: { lodash: { '4.17.21': ago(-DAY) } } }));
    assert.equal(out.exitCode, 1);
  });

  it('does not count removed versions, and checks nothing when no name@version is new', async () => {
    const ms = yarnEntry(['ms@^2.1.3'], 'ms', '2.1.3');
    const reg = registry();
    const out = await gate({ base: snapshot({ yarn: [LODASH_20, ms], cargo: [['serde', '1.0.0'], ['zip', '0.6.6']] }), head: snapshot() }, reg);
    assert.deepEqual(out.rows, []);
    assert.equal(out.exitCode, 0);
    assert.equal(reg.calls.length, 0);
  });

  it('ignores a change of only resolved host, sha1 or integrity for the same name@version (out of scope)', async () => {
    const moved = yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.20', { host: 'registry.npmjs.org', sha1: 'f'.repeat(40), integrity: 'sha512-y' });
    const reg = registry();
    const out = await gate({ base: snapshot(), head: snapshot({ yarn: [moved] }) }, reg);
    assert.deepEqual(out.rows, []);
    assert.equal(out.exitCode, 0);
    assert.equal(reg.calls.length, 0);
  });

  it('checks transitive and direct entries alike, by the real package name of an alias', async () => {
    const alias = yarnEntry(['string-width-cjs@npm:string-width@^4.2.0', 'string-width@^4.1.0'], 'string-width', '4.2.3');
    const scoped = yarnEntry(['@babel/core@^7.0.0'], '@babel/core', '7.28.5');
    const reg = registry({ npm: { 'string-width': { '4.2.3': daysAgo(1) }, '@babel/core': { '7.28.5': daysAgo(30) } } });
    const out = await gate({ base: snapshot(), head: snapshot({ yarn: [LODASH_20, alias, scoped] }) }, reg);
    assert.deepEqual(statuses(out), ['young npm:string-width@4.2.3', 'ok npm:@babel/core@7.28.5']);
    assert.ok(reg.calls.some((c) => c.url === 'https://registry.npmjs.org/@babel%2fcore'));
  });

  it('fails a new crate younger than 7 days and passes an old one', async () => {
    const reg = registry({ crates: { 'tokio@1.48.0': daysAgo(3), 'zip@0.6.6': daysAgo(800) } });
    const out = await gate({ base: snapshot(), head: snapshot({ cargo: [['serde', '1.0.0'], ['tokio', '1.48.0'], ['zip', '0.6.6']] }) }, reg);
    assert.deepEqual(statuses(out), ['young crates.io:tokio@1.48.0', 'ok crates.io:zip@0.6.6']);
    assert.equal(out.exitCode, 1);
  });

  it('skips crates without source (path dependencies, workspace members): they are not published', async () => {
    const reg = registry();
    const out = await gate({ base: snapshot(), head: snapshot({ cargo: [['serde', '1.0.0'], ['local-helper', '0.1.0', null]] }) }, reg);
    assert.deepEqual(out.rows, []);
    assert.equal(reg.calls.length, 0);
  });

  it('asks the npm registry once per package and crates.io once per second, with a generic User-Agent', async () => {
    const sleeps = [];
    const lodash22 = yarnEntry(['lodash@^4.17.22'], 'lodash', '4.17.22');
    const reg = registry({
      npm: { lodash: { '4.17.21': daysAgo(400), '4.17.22': daysAgo(300) } },
      crates: { 'tokio@1.48.0': daysAgo(30), 'zip@0.6.6': daysAgo(800) },
    });
    const head = snapshot({ yarn: [LODASH_21, lodash22], cargo: [['serde', '1.0.0'], ['tokio', '1.48.0'], ['zip', '0.6.6']] });
    const out = await gate({ base: snapshot(), head }, reg, { sleep: async (ms) => sleeps.push(ms) });
    assert.equal(out.exitCode, 0);
    assert.equal(reg.calls.filter((c) => c.url.includes('registry.npmjs.org')).length, 1);
    assert.equal(reg.calls.filter((c) => c.url.includes('crates.io')).length, 2);
    assert.deepEqual(sleeps, [1000]);
    for (const c of reg.calls) assert.equal(c.headers['User-Agent'], USER_AGENT);
    assert.doesNotMatch(USER_AGENT, /@/);
  });
});

// ---------------------------------------------------------------- sources

describe('sources outside the public registries fail closed (exit 2, no exception possible)', () => {
  const expectGrammar = async (head, re) => {
    const reg = registry(OLD);
    await assert.rejects(
      gate({ base: snapshot(), head: { ...head, [EXCEPTIONS_PATH]: JSON.stringify({ version: 1, entries: [exception()] }) } }, reg),
      (e) => e instanceof GateError && /does not fit the closed lockfile grammar/.test(e.message) && /cannot be excepted/.test(e.message) && re.test(e.message),
    );
    assert.equal(reg.calls.length, 0);
  };
  const resolvedTo = (url) => snapshot({ yarn: [yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.21', { resolved: url })] });

  it('git dependency in yarn.lock', () => expectGrammar(resolvedTo('git+https://github.com/lodash/lodash.git#abc'), /is not https:\/\/registry/));
  it('tarball URL on another host', () => expectGrammar(resolvedTo('https://example.com/lodash/-/lodash-4.17.21.tgz'), /is not https:\/\/registry/));
  it('alternative npm registry', () => expectGrammar(resolvedTo('https://npm.pkg.github.com/lodash/-/lodash-4.17.21.tgz'), /is not https:\/\/registry/));
  it('git crate', () => expectGrammar(snapshot({ cargo: [['serde', '1.0.0'], ['x', '1.0.0', 'git+https://example.com/x#abc']] }), /not from crates.io/));
  it('alternative crate registry', () => expectGrammar(snapshot({ cargo: [['serde', '1.0.0'], ['x', '1.0.0', 'sparse+https://example.com/index/']] }), /not from crates.io/));
});

describe('closed lockfile grammar (shared with the advisory gate)', () => {
  it('rejects a yarn.lock line yarn would read differently (quoted duplicate resolved)', async () => {
    const forged = `${LODASH_21}\n  "resolved" "https://registry.yarnpkg.com/lodash/-/lodash-4.17.20.tgz"`;
    await assert.rejects(gate({ base: snapshot(), head: snapshot({ yarn: [forged] }) }, registry(OLD)), /yarn\.lock at head .*unexpected line/);
  });

  it('rejects a version that does not match the resolved tarball', async () => {
    const forged = LODASH_20.replace('version "4.17.20"', 'version "4.17.21"');
    await assert.rejects(gate({ base: snapshot(), head: snapshot({ yarn: [forged] }) }, registry(OLD)), /does not match the resolved tarball/);
  });

  it('rejects a Cargo.lock line outside the grammar, in the base as well', async () => {
    const bad = cargoLock(['serde', '1.0.0']).replace('version = "1.0.0"', 'version = "1.0.0"\nversion = "1.0.1"');
    await assert.rejects(gate({ base: snapshot(), head: snapshot({ cargoText: bad }) }, registry(OLD)), /Cargo\.lock at head .*repeated key "version"/);
    await assert.rejects(gate({ base: snapshot({ cargoText: bad }), head: snapshot() }, registry(OLD)), /Cargo\.lock at base/);
  });
});

// ---------------------------------------------------------------- registry failures

describe('registry failures fail closed (exit 2)', () => {
  const snaps = { base: snapshot(), head: snapshot({ yarn: [LODASH_21], cargo: [['serde', '1.0.0'], ['zip', '0.6.6']] }) };
  const failedWith = async (reg, re) => {
    const out = await gate(snaps, reg);
    assert.equal(out.exitCode, 2);
    assert.ok(out.failed.some((r) => re.test(r.error)), out.failed.map((r) => r.error).join('\n'));
    return out;
  };

  it('network error, after 3 attempts, also when an exception covers the entry', async () => {
    const reg = registry({ fail: () => { throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }); } });
    const out = await gate({ ...snaps, head: { ...snaps.head, [EXCEPTIONS_PATH]: JSON.stringify({ version: 1, entries: [exception()] }) } }, reg);
    assert.equal(out.exitCode, 2);
    assert.match(out.failed[0].error, /failed after 3 attempts \(TypeError: ENOTFOUND\)/);
    assert.equal(reg.calls.length, 6);
  });

  it('5xx and 429 are retried, then fail', async () => {
    const out = await failedWith(registry({ fail: () => new Response('', { status: 503 }) }), /failed after 3 attempts \(HTTP 503\)/);
    assert.equal(out.failed.length, 2);
    await failedWith(registry({ fail: () => new Response('', { status: 429 }) }), /HTTP 429/);
  });

  it('a retry that succeeds is fine', async () => {
    let n = 0;
    const reg = registry({ ...OLD, crates: { 'zip@0.6.6': daysAgo(800) }, fail: () => (n++ === 0 ? new Response('', { status: 502 }) : undefined) });
    assert.equal((await gate(snaps, reg)).exitCode, 0);
  });

  it('other HTTP errors', () => failedWith(registry({ fail: () => new Response('', { status: 403 }) }), /HTTP 403/));

  it('answer that is not JSON', () => failedWith(registry({ fail: () => new Response('<html>') }), /not JSON/));

  it('npm version missing from the registry (unpublished: still in time, not in versions)', async () => {
    const reg = registry({
      crates: { 'zip@0.6.6': daysAgo(800) },
      fail: (url) => (url.includes('npmjs') ? Response.json({ name: 'lodash', versions: { '4.17.20': {} }, time: { '4.17.20': daysAgo(900), '4.17.21': daysAgo(30), unpublished: daysAgo(1) } }) : undefined),
    });
    await failedWith(reg, /npm: lodash@4\.17\.21 is not in the registry/);
  });

  it('npm package missing (404)', () => failedWith(registry({ crates: { 'zip@0.6.6': daysAgo(800) } }), /npm: package lodash is not in the registry/));

  it('crate version missing (404)', () => failedWith(registry({ npm: OLD.npm }), /crates\.io: zip@0\.6\.6 is not in the registry/));

  it('answer about another package or version', async () => {
    await failedWith(registry({ ...OLD, fail: (url) => (url.includes('npmjs') ? Response.json({ name: 'lodash-evil', versions: {}, time: {} }) : undefined) }), /answered about "lodash-evil" instead of lodash/);
    await failedWith(registry({ npm: OLD.npm, fail: (url) => (url.includes('crates.io') ? Response.json({ version: { crate: 'zip', num: '0.6.7', created_at: daysAgo(800) } }) : undefined) }), /the answer for zip@0\.6\.6 is about/);
  });

  it('publish time that is not an ISO 8601 date', () =>
    failedWith(registry({ npm: { lodash: { '4.17.21': 'last tuesday' } }, crates: { 'zip@0.6.6': daysAgo(800) } }), /publish time "last tuesday" is not an ISO 8601 date/));

  it('reports a young entry next to a failed lookup', async () => {
    const out = await gate(snaps, registry({ npm: { lodash: { '4.17.21': daysAgo(1) } } }));
    assert.deepEqual(statuses(out), ['young npm:lodash@4.17.21', 'failed crates.io:zip@0.6.6']);
    assert.equal(out.exitCode, 2);
  });
});

// ---------------------------------------------------------------- exceptions

describe('exceptions (security/lock-age-allowlist.json)', () => {
  const young = registry({ npm: { lodash: { '4.17.21': daysAgo(2) } } });
  const withExceptions = (entries, baseEntries) => ({
    base: snapshot({ exceptions: baseEntries }),
    head: snapshot({ yarn: [LODASH_21], exceptions: entries }),
  });

  it('a valid exception accepts the young version, with a warning when this change adds it', async () => {
    const out = await gate(withExceptions([exception()]), young);
    assert.deepEqual(statuses(out), ['accepted npm:lodash@4.17.21']);
    assert.equal(out.exitCode, 0);
    assert.equal(out.warnings.length, 1);
    assert.match(out.warnings[0], /adds or edits the exception npm lodash@4\.17\.21 \(GHSA-35jh-r3h4-6jhm/);
  });

  it('no warning for an exception the base already had', async () => {
    const out = await gate(withExceptions([exception()], [exception()]), young);
    assert.equal(out.exitCode, 0);
    assert.deepEqual(out.warnings, []);
  });

  it('accepts only the exact ecosystem, package and version', async () => {
    for (const over of [{ version: '4.17.22' }, { package: 'lodash-es' }, { ecosystem: 'crates.io' }]) {
      const out = await gate(withExceptions([exception(over)]), young);
      assert.deepEqual(statuses(out), ['young npm:lodash@4.17.21'], JSON.stringify(over));
      assert.equal(out.exitCode, 1);
    }
  });

  it('an expired exception fails the gate, even if nothing uses it', async () => {
    const out = await gate({ base: snapshot(), head: snapshot({ exceptions: [exception({ reviewBy: '2026-11-20' })] }) }, registry());
    assert.equal(out.exitCode, 1);
    assert.match(out.errors[0], /expired on 2026-11-20/);
  });

  it('an expired exception does not accept the young version', async () => {
    const out = await gate(withExceptions([exception({ reviewBy: '2026-11-20' })]), young);
    assert.deepEqual(statuses(out), ['young npm:lodash@4.17.21']);
  });

  it('reviewBy today is still valid; more than 30 days ahead is not', () => {
    assert.deepEqual(parseExceptions(JSON.stringify({ version: 1, entries: [exception({ reviewBy: '2026-11-21' })] }), TODAY).errors, []);
    assert.deepEqual(parseExceptions(JSON.stringify({ version: 1, entries: [exception({ reviewBy: '2026-12-21' })] }), TODAY).errors, []);
    const far = parseExceptions(JSON.stringify({ version: 1, entries: [exception({ reviewBy: '2026-12-22' })] }), TODAY);
    assert.match(far.errors[0], new RegExp(`31 days away; at most ${MAX_EXCEPTION_DAYS}`));
    assert.deepEqual(far.entries, []);
  });

  const malformed = {
    'not JSON': ['{', /not valid JSON/],
    'wrong top level': [JSON.stringify({ version: 2, entries: [] }), /must be \{ "version": 1/],
    'unknown top-level field': [JSON.stringify({ version: 1, entries: [], extra: 1 }), /unknown top-level field "extra"/],
    'entry not an object': [JSON.stringify({ version: 1, entries: ['lodash@4.17.21'] }), /not an object/],
    'unknown field': [{ paths: ['web'] }, /unknown field "paths"/],
    'missing ghsa': [{ ghsa: undefined }, /"ghsa" must be the GHSA id/],
    'not a GHSA id': [{ ghsa: 'CVE-2026-1234' }, /"ghsa" must be the GHSA id/],
    'short reason': [{ reason: 'urgent' }, /"reason" must explain/],
    'impossible date': [{ reviewBy: '2026-02-30' }, /"reviewBy" must be a date/],
    'date with time': [{ reviewBy: '2026-12-01T00:00:00Z' }, /"reviewBy" must be a date/],
    'unknown ecosystem': [{ ecosystem: 'pypi' }, /"ecosystem" must be/],
    'range instead of version': [{ version: '>= 4.17.21' }, /"version" is required/],
    'package with spaces': [{ package: 'lo dash' }, /"package" is required/],
  };
  for (const [name, [over, re]] of Object.entries(malformed)) {
    it(`malformed (${name}) fails the gate and accepts nothing`, async () => {
      const text = typeof over === 'string' ? over : JSON.stringify({ version: 1, entries: [exception(over)] });
      const out = await gate(withExceptions(text), young);
      assert.equal(out.exitCode, 1);
      assert.ok(out.errors.some((e) => re.test(e)), out.errors.join('\n'));
      assert.deepEqual(statuses(out), ['young npm:lodash@4.17.21']);
    });
  }

  it('duplicate entries', () => {
    const { errors } = parseExceptions(JSON.stringify({ version: 1, entries: [exception(), exception()] }), TODAY);
    assert.deepEqual(errors, [`${EXCEPTIONS_PATH} entry 1 (lodash@4.17.21): duplicate entry`]);
  });

  it('a missing file means no exceptions', async () => {
    const out = await gate({ base: snapshot(), head: snapshot({ yarn: [LODASH_21] }) }, young);
    assert.deepEqual(out.errors, []);
    assert.equal(out.exitCode, 1);
  });
});

// ---------------------------------------------------------------- git

describe('git', () => {
  it('fails closed on an unknown ref or a missing lockfile', async () => {
    await assert.rejects(gate({ head: snapshot() }, registry()), /unknown git ref: base/);
    const noCargo = snapshot();
    delete noCargo['services/rust-api/Cargo.lock'];
    await assert.rejects(gate({ base: snapshot(), head: noCargo }, registry()), /Cargo\.lock is missing at head/);
    await assert.rejects(gate({ base: noCargo, head: snapshot() }, registry()), /Cargo\.lock is missing at base/);
  });
});
