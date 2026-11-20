// Tests for scripts/advisory-gate.mjs. Built-in test runner, no network, no
// dependencies: git and OSV are replaced by in-memory fakes.
//   node --test scripts/advisory-gate.test.mjs

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GateError,
  annotation,
  cvss3BaseScore,
  deadlineSeverityOf,
  evaluate,
  md,
  parseAllowlist,
  parseCargoLock,
  parseYarnLock,
  run,
  severityOf,
} from './advisory-gate.mjs';

const TODAY = Date.parse('2026-11-19T00:00:00Z');
const REG = 'https://registry.yarnpkg.com';

// ---------------------------------------------------------------- fixtures

function yarnEntry(keys, name, version, deps = {}) {
  const lines = [`${keys.map((k) => `"${k}"`).join(', ')}:`, `  version "${version}"`];
  const file = name.startsWith('@') ? name.split('/')[1] : name;
  lines.push(`  resolved "${REG}/${name}/-/${file}-${version}.tgz#abc"`, '  integrity sha512-x');
  if (Object.keys(deps).length) {
    lines.push('  dependencies:');
    for (const [n, r] of Object.entries(deps)) lines.push(`    ${n} "${r}"`);
  }
  return lines.join('\n');
}

const yarnLock = (...entries) => `# yarn lockfile v1\n\n\n${entries.join('\n\n')}\n`;

const cargoLock = (...pkgs) =>
  `version = 4\n\n[[package]]\nname = "rust-api"\nversion = "0.1.0"\n` +
  pkgs
    .map(([n, v]) => `\n[[package]]\nname = "${n}"\nversion = "${v}"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\nchecksum = "00"\n`)
    .join('');

const rootPkg = JSON.stringify({ name: 'root', private: true, workspaces: ['web', 'apps/*'] });

// A repository with one commit per ref.
function repo(snapshots) {
  return {
    resolve(ref) {
      if (!snapshots[ref]) throw new GateError(`unknown git ref: ${ref}`);
      return `${ref}`.padEnd(40, '0');
    },
    files(sha) {
      return Object.keys(snapshots[sha.replace(/0+$/, '')]);
    },
    show(sha, path) {
      return snapshots[sha.replace(/0+$/, '')][path];
    },
  };
}

function snapshot({ web = { lodash: '^4.17.0' }, apps = {}, lock, cargo = [['serde', '1.0.0']], allowlist } = {}) {
  const files = {
    'package.json': rootPkg,
    'web/package.json': JSON.stringify({ name: 'web', dependencies: web }),
    'yarn.lock': lock ?? yarnLock(yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.21')),
    'services/rust-api/Cargo.lock': cargoLock(...cargo),
  };
  for (const [name, deps] of Object.entries(apps)) files[`apps/${name}/package.json`] = JSON.stringify({ name, devDependencies: deps });
  if (allowlist !== undefined) files['security/advisory-allowlist.json'] = typeof allowlist === 'string' ? allowlist : JSON.stringify({ version: 1, entries: allowlist });
  return files;
}

// Fake OSV: vulnsByPackage { "npm|name@version": [ids] }, records { id: record }.
function osv(vulnsByPackage, records, { fail } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(url);
    if (fail) return fail(url, init);
    if (url.endsWith('/querybatch')) {
      const { queries } = JSON.parse(init.body);
      const results = queries.map((q) => {
        const ids = vulnsByPackage[`${q.package.ecosystem}|${q.package.name}@${q.version}`] ?? [];
        return ids.length ? { vulns: ids.map((id) => ({ id, modified: '2026-01-01T00:00:00Z' })) } : {};
      });
      return Response.json({ results });
    }
    const id = decodeURIComponent(url.split('/vulns/')[1]);
    if (!records[id]) return new Response('not found', { status: 404 });
    return Response.json(records[id]);
  };
  return { fetchImpl, calls };
}

const ghsa = (id, severity, aliases = []) => ({ id, aliases, summary: `${id} summary`, database_specific: { severity } });

const LODASH_OLD = yarnLock(yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.20'));
const OSV_LODASH = { 'npm|lodash@4.17.20': ['GHSA-aaaa-bbbb-cccc'] };
const RECORDS = { 'GHSA-aaaa-bbbb-cccc': ghsa('GHSA-aaaa-bbbb-cccc', 'MODERATE') };

const gate = (snaps, mode, o, extra = {}) =>
  run({ mode, base: 'base', head: 'head' }, { git: repo(snaps), fetchImpl: o.fetchImpl, todayMs: TODAY, retryDelayMs: 0, log: () => {}, ...extra });

const allow = (over = {}) => ({
  id: 'GHSA-aaaa-bbbb-cccc',
  ecosystem: 'npm',
  package: 'lodash',
  version: '4.17.20',
  paths: ['web'],
  reason: 'Only used with constant input in the build.',
  justification: 'vulnerable_code_cannot_be_controlled_by_adversary',
  reviewBy: '2027-01-01',
  ...over,
});

// ---------------------------------------------------------------- parsers

describe('parseYarnLock', () => {
  it('takes the real name from resolved (aliases, scopes) and keeps every key', () => {
    const text = yarnLock(
      yarnEntry(['string-width-cjs@npm:string-width@^4.2.0', 'string-width@^4.1.0'], 'string-width', '4.2.3', { 'strip-ansi': '^6.0.1' }),
      yarnEntry(['@babel/core@^7.0.0'], '@babel/core', '7.28.5'),
    );
    const lock = parseYarnLock(text);
    assert.deepEqual([...lock.byPackage.keys()], ['string-width@4.2.3', '@babel/core@7.28.5']);
    assert.equal(lock.byKey.get('string-width-cjs@npm:string-width@^4.2.0').name, 'string-width');
    assert.deepEqual(lock.byKey.get('string-width@^4.1.0').deps, [{ name: 'strip-ansi', range: '^6.0.1' }]);
  });

  it('ties version to the resolved tarball (fails closed on a forged version)', () => {
    const real = yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.20');
    assert.equal(parseYarnLock(yarnLock(real)).byPackage.size, 1);
    const forged = real.replace('version "4.17.20"', 'version "4.17.21"'); // resolved/integrity still 4.17.20
    assert.throws(() => parseYarnLock(yarnLock(forged)), (e) => e instanceof GateError && /does not match the resolved tarball "lodash-4.17.20.tgz"/.test(e.message));
    const spaced = real.replace('version "4.17.20"', 'version "4.17.20 || 9.9.9"');
    assert.throws(() => parseYarnLock(yarnLock(spaced)), /is not a SemVer version/);
    const scoped = yarnEntry(['@babel/core@^7.0.0'], '@babel/core', '7.28.5');
    assert.throws(() => parseYarnLock(yarnLock(scoped.replace('core-7.28.5.tgz', 'core-7.28.4.tgz'))), /expected core-7.28.5.tgz/);
    const otherKey = yarnEntry(['left-pad@^1.0.0'], 'lodash', '4.17.20');
    assert.throws(() => parseYarnLock(yarnLock(otherKey)), /names "left-pad" but resolved is lodash/);
    const badAlias = yarnEntry(['x@npm:left-pad@^1.0.0'], 'lodash', '4.17.20');
    assert.throws(() => parseYarnLock(yarnLock(badAlias)), /names "left-pad"/);
  });

  it('rejects a package name outside the npm grammar, and escapes it in output', () => {
    const evil = 'evil%0A::stop-commands::tok';
    const text = yarnLock(`"${evil}@^1.0.0":
  version "1.0.0"
  resolved "${REG}/${evil}/-/x-1.0.0.tgz#abc"
  integrity sha512-x`);
    let err;
    assert.throws(() => parseYarnLock(text), (e) => { err = e; return e instanceof GateError && /invalid npm package name/.test(e.message); });
    const line = annotation('error', 'advisory gate', err.message);
    assert.equal(line.split('\n').length, 1);
    assert.doesNotMatch(line, /\n::stop-commands::/);
    const raw = annotation('warning', 't', 'a%0A::stop-commands::b\n::stop-commands::c\rd');
    assert.equal(raw, '::warning title=t::a%250A::stop-commands::b%0A::stop-commands::c%0Dd');
    assert.equal(md('a|b\n<img src=x>`c`'), "a\\|b &lt;img src=x&gt;'c'");
  });

  it('rejects entries OSV cannot check, and an empty lockfile', () => {
    const git = 'foo@github:x/foo:\n  version "1.0.0"\n  resolved "https://codeload.github.com/x/foo/tar.gz/abc"\n';
    assert.throws(() => parseYarnLock(yarnLock(git)), /not from the npm registry/);
    assert.throws(() => parseYarnLock('# yarn lockfile v1\n'), /no entries/);
  });
});

describe('parseCargoLock', () => {
  it('skips the local crate and rejects non-crates.io sources', () => {
    assert.deepEqual([...parseCargoLock(cargoLock(['zip', '0.6.6'])).keys()], ['zip@0.6.6']);
    const gitDep = `${cargoLock(['zip', '0.6.6'])}\n[[package]]\nname = "x"\nversion = "1.0.0"\nsource = "git+https://example.com/x#abc"\n`;
    assert.throws(() => parseCargoLock(gitDep), /not from crates.io/);
    assert.throws(() => parseCargoLock(cargoLock(['zip', '0.6.6 '])), /is not a SemVer version/);
    assert.throws(() => parseCargoLock(cargoLock(['zip', '>=0.6'])), /is not a SemVer version/);
  });
});

// ---------------------------------------------------------------- severity

describe('severity', () => {
  it('computes CVSS 3.1 base scores', () => {
    assert.equal(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'), 9.8);
    assert.equal(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N'), 6.5);
    assert.equal(cvss3BaseScore('CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N'), 6.1);
    assert.equal(cvss3BaseScore('CVSS:3.1/AV:L/AC:L/PR:L/UI:R/S:U/C:H/I:H/A:H'), 7.3);
    assert.equal(cvss3BaseScore('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N'), null);
  });

  it('prefers the GitHub label, then CVSS v3, then RustSec informational', () => {
    assert.equal(severityOf(ghsa('GHSA-1', 'MODERATE')).severity, 'medium');
    assert.equal(severityOf({ severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }] }).severity, 'critical');
    assert.equal(severityOf({ affected: [{ database_specific: { cvss: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H' } }] }).severity, 'high');
    assert.equal(severityOf({ affected: [{ database_specific: { informational: 'unmaintained' } }] }).severity, 'info');
    assert.equal(severityOf({ severity: [{ type: 'CVSS_V4', score: 'CVSS:4.0/AV:N' }] }).severity, 'unknown');
  });
});

// ---------------------------------------------------------------- ratchet

describe('ratchet mode', () => {
  it('passes when the base already has the advisory', async () => {
    const s = snapshot({ lock: LODASH_OLD });
    const { result } = await gate({ base: s, head: s }, 'ratchet', osv(OSV_LODASH, RECORDS));
    assert.equal(result.pass, true);
    assert.deepEqual(result.rows.map((r) => r.status), ['existing']);
  });

  it('fails when the head introduces an advisory (downgrade)', async () => {
    const { result } = await gate({ base: snapshot(), head: snapshot({ lock: LODASH_OLD }) }, 'ratchet', osv(OSV_LODASH, RECORDS));
    assert.equal(result.pass, false);
    assert.deepEqual(result.blocking.map((r) => [r.key, r.package, r.version, r.path, r.scope]), [['GHSA-aaaa-bbbb-cccc', 'lodash', '4.17.20', 'web', 'prod']]);
  });

  it('fails when a new workspace reaches a package that already had the advisory', async () => {
    const base = snapshot({ lock: LODASH_OLD });
    const head = snapshot({ lock: LODASH_OLD, apps: { newapp: { lodash: '^4.17.0' } } });
    const { result } = await gate({ base, head }, 'ratchet', osv(OSV_LODASH, RECORDS));
    assert.equal(result.pass, false);
    assert.deepEqual(result.blocking.map((r) => [r.path, r.scope]), [['apps/newapp', 'dev']]);
  });

  it('fails when a vulnerable package moves from devDependencies to dependencies', async () => {
    const asDev = snapshot({ lock: LODASH_OLD, web: {}, apps: { app: { lodash: '^4.17.0' } } });
    const asProd = snapshot({ lock: LODASH_OLD, web: {}, apps: { app: {} } });
    asProd['apps/app/package.json'] = JSON.stringify({ name: 'app', dependencies: { lodash: '^4.17.0' } });
    const up = await gate({ base: asDev, head: asProd }, 'ratchet', osv(OSV_LODASH, RECORDS));
    assert.equal(up.result.pass, false);
    assert.deepEqual(up.result.blocking.map((r) => [r.path, r.scope]), [['apps/app', 'prod']]);
    const down = await gate({ base: asProd, head: asDev }, 'ratchet', osv(OSV_LODASH, RECORDS));
    assert.equal(down.result.pass, true);
  });

  it('follows transitive dependencies and sibling workspaces', async () => {
    const lock = yarnLock(
      yarnEntry(['a@^1.0.0'], 'a', '1.0.0', { lodash: '^4.17.0' }),
      yarnEntry(['lodash@^4.17.0'], 'lodash', '4.17.20'),
    );
    const head = snapshot({ lock, web: { a: '^1.0.0' } });
    head['apps/ui/package.json'] = JSON.stringify({ name: 'ui', dependencies: { web: '*' } });
    const { result } = await gate({ base: snapshot(), head }, 'ratchet', osv(OSV_LODASH, RECORDS));
    assert.deepEqual(result.blocking.map((r) => `${r.path}:${r.scope}`).sort(), ['apps/ui:prod', 'web:prod']);
  });

  it('accepts an allowlisted new advisory, but only for the listed path and version', async () => {
    const o = osv(OSV_LODASH, RECORDS);
    const ok = await gate({ base: snapshot(), head: snapshot({ lock: LODASH_OLD, allowlist: [allow()] }) }, 'ratchet', o);
    assert.equal(ok.result.pass, true);
    assert.deepEqual(ok.result.rows.map((r) => r.status), ['allowed']);
    const otherPath = await gate({ base: snapshot(), head: snapshot({ lock: LODASH_OLD, allowlist: [allow({ paths: ['apps/x'] })] }) }, 'ratchet', o);
    assert.equal(otherPath.result.pass, false);
    const otherVersion = await gate({ base: snapshot(), head: snapshot({ lock: LODASH_OLD, allowlist: [allow({ version: '4.17.19' })] }) }, 'ratchet', o);
    assert.equal(otherVersion.result.pass, false);
    const range = await gate({ base: snapshot(), head: snapshot({ lock: LODASH_OLD, allowlist: [allow({ version: undefined, range: '>=4.0.0 <4.17.21' })] }) }, 'ratchet', o);
    assert.equal(range.result.pass, true);
  });

  it('groups aliases: an entry for the RustSec id covers the GHSA record', async () => {
    const records = {
      'GHSA-zzzz-zzzz-zzzz': ghsa('GHSA-zzzz-zzzz-zzzz', 'CRITICAL', ['RUSTSEC-2026-0001']),
      'RUSTSEC-2026-0001': { id: 'RUSTSEC-2026-0001', aliases: ['GHSA-zzzz-zzzz-zzzz'], affected: [{}] },
    };
    const vulns = { 'crates.io|zip@0.6.6': ['GHSA-zzzz-zzzz-zzzz', 'RUSTSEC-2026-0001'] };
    const entry = allow({ id: 'RUSTSEC-2026-0001', ecosystem: 'crates.io', package: 'zip', version: '0.6.6', paths: ['services/rust-api'], reviewBy: '2026-12-01' });
    const { result } = await gate({ base: snapshot(), head: snapshot({ cargo: [['zip', '0.6.6']], allowlist: [entry] }) }, 'ratchet', osv(vulns, records));
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].key, 'GHSA-zzzz-zzzz-zzzz');
    assert.equal(result.rows[0].severity, 'critical');
    assert.equal(result.pass, true);
  });
});

// ---------------------------------------------------------------- absolute

describe('absolute mode', () => {
  it('fails on any advisory not in the allowlist, even if old', async () => {
    const s = snapshot({ lock: LODASH_OLD });
    const { result } = await gate({ head: s }, 'absolute', osv(OSV_LODASH, RECORDS));
    assert.equal(result.pass, false);
    assert.deepEqual(result.blocking.map((r) => r.status), ['not-accepted']);
  });

  it('ignores withdrawn advisories', async () => {
    const records = { 'GHSA-aaaa-bbbb-cccc': { ...RECORDS['GHSA-aaaa-bbbb-cccc'], withdrawn: '2026-01-01T00:00:00Z' } };
    const { result, withdrawn } = await gate({ head: snapshot({ lock: LODASH_OLD }) }, 'absolute', osv(OSV_LODASH, records));
    assert.equal(result.pass, true);
    assert.deepEqual([...withdrawn], ['GHSA-aaaa-bbbb-cccc']);
  });
});

// ---------------------------------------------------------------- allowlist

describe('allowlist', () => {
  const check = (entries, findings = []) => evaluate({ mode: 'absolute', headFindings: findings, baseFindings: [], allowlistText: JSON.stringify({ version: 1, entries }), todayMs: TODAY });
  const withEntry = (entry, records = RECORDS) => gate({ head: snapshot({ lock: LODASH_OLD, allowlist: [entry] }) }, 'absolute', osv(OSV_LODASH, records));

  it('fails on an expired entry that still matches', async () => {
    const { result } = await withEntry(allow({ reviewBy: '2026-11-18' }));
    assert.equal(result.pass, false);
    assert.match(result.errors[0], /expired on 2026-11-18/);
  });

  it('accepts an entry on its reviewBy day, with a warning', async () => {
    const { result } = await withEntry(allow({ reviewBy: '2026-11-19' }));
    assert.equal(result.pass, true);
    assert.deepEqual(result.errors, []);
    assert.match(result.warnings.join('\n'), /expires on 2026-11-19 \(0 days\)/);
  });

  it('fails when reviewBy is too far for the severity', async () => {
    const records = { 'GHSA-aaaa-bbbb-cccc': ghsa('GHSA-aaaa-bbbb-cccc', 'HIGH') };
    const { result } = await withEntry(allow({ reviewBy: '2027-01-01' }), records);
    assert.equal(result.pass, false);
    assert.match(result.errors[0], /a high advisory \(highest of GitHub label and CVSS\) can be accepted for at most 30 days/);
  });

  it('uses the highest of GitHub label and CVSS for the deadline only', async () => {
    const moderateButCritical = {
      'GHSA-aaaa-bbbb-cccc': { ...ghsa('GHSA-aaaa-bbbb-cccc', 'MODERATE'), severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }] },
    };
    assert.equal(deadlineSeverityOf(moderateButCritical['GHSA-aaaa-bbbb-cccc']), 'critical');
    const sixtyDays = allow({ reviewBy: '2027-01-18' });
    const strict = await withEntry(sixtyDays, moderateButCritical);
    assert.equal(strict.result.pass, false);
    assert.match(strict.result.errors[0], /a critical advisory/);
    assert.equal(strict.result.rows[0].severity, 'medium'); // what is shown and compared stays GitHub's label
    const plain = await withEntry(sixtyDays, RECORDS);
    assert.equal(plain.result.pass, true);
  });

  it('only warns about an entry that matches nothing, whatever its reviewBy', () => {
    for (const reviewBy of ['2027-12-31', '2026-01-01']) {
      const r = check([allow({ reviewBy })]);
      assert.equal(r.pass, true, reviewBy);
      assert.deepEqual(r.errors, []);
      assert.match(r.warnings.join('\n'), /matches nothing in the lockfiles any more: remove it/);
    }
  });

  it('rejects malformed entries and unknown fields', () => {
    assert.equal(check([allow({ reviewby: '2027-01-01' })]).pass, false);
    assert.equal(check([allow({ justification: 'trust me' })]).pass, false);
    assert.equal(check([allow({ range: '>=1.0.0' })]).pass, false); // version and range
    assert.equal(check([allow({ version: undefined, range: '^1.0.0' })]).pass, false);
    assert.equal(check([allow({ paths: [] })]).pass, false);
    assert.equal(check([allow({ reason: 'ok' })]).pass, false);
    assert.equal(check([allow({ reviewBy: '2027-13-45' })]).pass, false);
    assert.equal(check([allow(), allow()]).pass, false);
    assert.equal(parseAllowlist('{').errors.length, 1);
    assert.equal(parseAllowlist('{"entries": []}').errors.length, 1);
  });

  it('warns about entries the change adds or edits (ratchet)', async () => {
    const base = snapshot({ lock: LODASH_OLD, allowlist: [allow({ reviewBy: '2026-12-01' })] });
    const same = await gate({ base, head: base }, 'ratchet', osv(OSV_LODASH, RECORDS));
    assert.equal(same.result.warnings.filter((w) => /adds or edits/.test(w)).length, 0);
    const edited = snapshot({ lock: LODASH_OLD, allowlist: [allow({ reviewBy: '2027-01-01' })] });
    const { result } = await gate({ base, head: edited }, 'ratchet', osv(OSV_LODASH, RECORDS));
    assert.equal(result.pass, true);
    assert.match(result.warnings.join('\n'), /adds or edits the entry GHSA-aaaa-bbbb-cccc lodash \(web, reviewBy 2027-01-01\)/);
  });
});

// ---------------------------------------------------------------- fail closed

describe('fails closed', () => {
  const head = snapshot();
  const expectError = (o, re) => assert.rejects(gate({ head }, 'absolute', o), (err) => err instanceof GateError && re.test(err.message));

  it('when OSV is unreachable', () =>
    expectError(osv({}, {}, { fail: () => { throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }); } }), /failed after 3 attempts \(TypeError: ENOTFOUND\)/));

  it('when OSV keeps answering 5xx, after retrying', async () => {
    const o = osv({}, {}, { fail: () => new Response('', { status: 503 }) });
    await expectError(o, /failed after 3 attempts \(HTTP 503\)/);
    assert.equal(o.calls.length, 3);
  });

  it('when OSV answers 4xx', () => expectError(osv({}, {}, { fail: () => new Response('', { status: 400 }) }), /HTTP 400/));

  it('when the answer is not JSON', () => expectError(osv({}, {}, { fail: () => new Response('<html>') }), /not JSON/));

  it('when the batch answer is incomplete', () => expectError(osv({}, {}, { fail: () => Response.json({ results: [] }) }), /returned 0 results for 2 queries/));

  it('when a vuln record cannot be fetched', async () => {
    await assert.rejects(gate({ head: snapshot({ lock: LODASH_OLD }) }, 'absolute', osv(OSV_LODASH, {})), /HTTP 404/);
  });

  it('when a dependency has no yarn.lock entry', async () => {
    await assert.rejects(gate({ head: snapshot({ web: { missing: '^1.0.0' } }) }, 'absolute', osv({}, {})), /no yarn.lock entry/);
  });

  it('when a lockfile is missing or the ref is unknown', async () => {
    const noCargo = snapshot();
    delete noCargo['services/rust-api/Cargo.lock'];
    await assert.rejects(gate({ head: noCargo }, 'absolute', osv({}, {})), /Cargo.lock is missing/);
    await assert.rejects(gate({ head: snapshot() }, 'ratchet', osv({}, {})), /unknown git ref: base/);
  });

  it('follows next_page_token', async () => {
    let page = 0;
    const o = osv({}, RECORDS, {
      fail: (url, init) => {
        if (!url.endsWith('/querybatch')) return Response.json(RECORDS['GHSA-aaaa-bbbb-cccc']);
        const { queries } = JSON.parse(init.body);
        page += 1;
        if (page === 1) return Response.json({ results: queries.map((q) => (q.package.name === 'lodash' ? { next_page_token: 't1' } : {})) });
        assert.equal(queries.length, 1);
        assert.equal(queries[0].page_token, 't1');
        return Response.json({ results: [{ vulns: [{ id: 'GHSA-aaaa-bbbb-cccc' }] }] });
      },
    });
    const { result } = await gate({ head: snapshot() }, 'absolute', o);
    assert.equal(page, 2);
    assert.deepEqual(result.blocking.map((r) => r.key), ['GHSA-aaaa-bbbb-cccc']);
  });
});
