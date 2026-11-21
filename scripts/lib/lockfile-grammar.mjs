// Closed grammar of yarn.lock (yarn 1) and Cargo.lock, shared by the
// dependency gates (scripts/advisory-gate.mjs, scripts/lock-entry-ages.mjs),
// so they cannot read the same lockfile differently.
//
// Pure module: no side effects on import, no main, only node: built-ins (none
// today). CI copies it from the PR's base branch next to the gate scripts
// (see ci.yml), so it must stay importable on its own.

export const CRATES_IO_INDEX = 'registry+https://github.com/rust-lang/crates.io-index';
export const NPM_REGISTRY_HOSTS = new Set(['registry.npmjs.org', 'registry.yarnpkg.com']);

export class GateError extends Error {}

// Strict SemVer 2.0.0 (no "v", no spaces, no ranges).
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
// npm package names (lowercase, URL-safe; optional @scope/). Older registry
// names with capitals are rejected too: fail closed, review by hand.
export const NPM_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
export const CRATE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

// Package name in a yarn.lock key ("name@range", "@scope/name@range"), and
// the real name behind an alias ("alias@npm:real@range").
function keyPackageName(key) {
  const at = key.indexOf('@', key.startsWith('@') ? 1 : 0);
  if (at <= 0) throw new GateError(`yarn.lock: cannot read the package name in key ${JSON.stringify(key)}`);
  const range = key.slice(at + 1);
  return range.startsWith('npm:') ? keyPackageName(range.slice(4)) : key.slice(0, at);
}

// ------------------------------------------------------------------ lockfiles

// yarn 1 lockfile -> { byKey: Map key -> entry, byPackage: Map "name@version" -> entry }.
//
// Closed grammar: only what yarn 1 itself writes is accepted, line by line.
// yarn's own parser is more lenient (quoted field names, repeated fields where
// the last one wins, blocks without a blank line between them); a lockfile
// that yarn and this gate would read differently could install one tarball
// while the gate checks another version. So anything outside this grammar is
// an error (exit 2), not a guess:
//
//   # comment                     only before the first entry
//   <blank line>                  one or more between entries
//   key[, key...]:                key = name@range, or "..." (no " \ , inside)
//     version "<semver>"          once
//     resolved "<url>"            once; https://registry.(npmjs.org|yarnpkg.com)
//                                 /<name>/-/<file>.tgz[#<sha1>], nothing else
//     integrity <algo>-<base64>   once
//     uid "<value>"               at most once
//     dependencies:               at most once each, followed by one or
//     optionalDependencies:       more lines:  name "range"  (4 spaces)
//
// The package name comes from the `resolved` URL (so aliases
// "string-width-cjs@npm:string-width@^4" resolve to the published package),
// must be a valid npm name, every key must name it, and the tarball file must
// be "<name without scope>-<version>.tgz".
const YARN_UNQUOTED = '[A-Za-z0-9][^\\s",:#\\\\]*';
const YARN_QUOTED = '"[^"\\\\,]+"';
const YARN_KEY = `(?:${YARN_QUOTED}|${YARN_UNQUOTED})`;
const YARN_HEADER = new RegExp(`^${YARN_KEY}(?:, ${YARN_KEY})*:$`);
const YARN_FIELD = /^ {2}(version|resolved|uid) "([^"\\]*)"$|^ {2}integrity ([a-z0-9]+-[A-Za-z0-9+/]+={0,2})$|^ {2}(dependencies|optionalDependencies):$/;
const YARN_DEP = new RegExp(`^ {4}(${YARN_KEY}) "([^"\\\\]*)"$`);
const RESOLVED = /^https:\/\/(registry\.npmjs\.org|registry\.yarnpkg\.com)(\/[A-Za-z0-9@._~\/-]+)(#[0-9a-f]{40})?$/;

export function parseYarnLock(text) {
  const byKey = new Map();
  const byPackage = new Map();
  const unquote = (k) => (k.startsWith('"') ? k.slice(1, -1) : k);
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  let block = null;
  let seenEntry = false;
  let afterBlank = true;
  const finish = () => {
    if (!block) return;
    const where = `yarn.lock line ${block.line} (${block.header})`;
    for (const f of ['version', 'resolved', 'integrity']) {
      if (block.fields[f] === undefined) throw new GateError(`${where}: missing ${f}`);
    }
    for (const section of ['dependencies', 'optionalDependencies']) {
      if (block.fields[section] !== undefined && block.fields[section] === 0) throw new GateError(`${where}: empty ${section}:`);
    }
    const { version, resolved } = block.fields;
    const m = RESOLVED.exec(resolved);
    if (!m) {
      throw new GateError(`${where}: resolved ${JSON.stringify(resolved)} is not https://registry.npmjs.org or registry.yarnpkg.com /<name>/-/<file>.tgz (no credentials, port, query or other fragment); OSV cannot check it`);
    }
    const rawPath = m[2];
    let url;
    try {
      url = new URL(resolved);
    } catch {
      throw new GateError(`${where}: invalid resolved URL ${JSON.stringify(resolved)}`);
    }
    if (url.pathname !== rawPath || url.username || url.password || url.port || url.search || !NPM_REGISTRY_HOSTS.has(url.hostname)) {
      throw new GateError(`${where}: resolved ${JSON.stringify(resolved)} is not a plain registry URL`);
    }
    const path = /^\/((?:@[^/]+\/)?[^/@][^/]*)\/-\/([^/]+)$/.exec(rawPath);
    if (!path || rawPath.split('/').some((seg) => seg === '.' || seg === '..')) {
      throw new GateError(`${where}: resolved path ${JSON.stringify(rawPath)} is not /<name>/-/<file>.tgz`);
    }
    const [, name, tarball] = path;
    if (!NPM_NAME.test(name)) throw new GateError(`${where}: invalid npm package name ${JSON.stringify(name)} in resolved`);
    if (!SEMVER.test(version)) throw new GateError(`${where}: version ${JSON.stringify(version)} is not a SemVer version`);
    const expected = `${name.split('/').pop()}-${version}.tgz`;
    if (tarball !== expected) {
      throw new GateError(`${where}: version "${version}" does not match the resolved tarball ${JSON.stringify(tarball)} (expected ${expected})`);
    }
    for (const key of block.keys) {
      const keyName = keyPackageName(key);
      if (keyName !== name) throw new GateError(`${where}: key ${JSON.stringify(key)} names ${JSON.stringify(keyName)} but resolved is ${name}`);
      if (byKey.has(key)) throw new GateError(`${where}: key ${JSON.stringify(key)} appears in more than one entry`);
    }
    const id = `${name}@${version}`;
    const entry = byPackage.get(id) ?? { ecosystem: 'npm', name, version, deps: [] };
    entry.deps.push(...block.deps);
    byPackage.set(id, entry);
    for (const key of block.keys) byKey.set(key, entry);
    block = null;
  };
  lines.forEach((line, i) => {
    const n = i + 1;
    const bad = (why) => {
      throw new GateError(`yarn.lock line ${n}: ${why}: ${JSON.stringify(line.slice(0, 120))}`);
    };
    if (/[\t\r]/.test(line)) bad('tab or carriage return (yarn writes neither)');
    if (line === '') {
      finish();
      afterBlank = true;
      return;
    }
    if (line.startsWith('#')) {
      if (seenEntry) bad('comment after the first entry (yarn only writes them in the header)');
      return;
    }
    if (!line.startsWith(' ')) {
      if (!afterBlank) bad('entry not separated from the previous one by a blank line');
      if (!YARN_HEADER.test(line)) bad('not a yarn 1 entry header');
      const keys = line.slice(0, -1).split(', ').map(unquote);
      block = { line: n, header: line.slice(0, 120), keys, fields: {}, deps: [], section: null, depNames: new Set() };
      seenEntry = true;
      afterBlank = false;
      return;
    }
    afterBlank = false;
    if (!block) bad('indented line outside an entry');
    const field = YARN_FIELD.exec(line);
    if (field) {
      const name = field[1] ?? (field[3] !== undefined ? 'integrity' : field[4]);
      if (block.fields[name] !== undefined) bad(`repeated field "${name}"`);
      block.fields[name] = field[1] ? field[2] : field[3] ?? 0;
      block.section = field[4] ?? null;
      return;
    }
    const dep = YARN_DEP.exec(line);
    if (dep) {
      if (!block.section) bad('dependency line outside dependencies:/optionalDependencies:');
      const depName = unquote(dep[1]);
      const sectionKey = `${block.section}|${depName}`;
      if (block.depNames.has(sectionKey)) bad(`repeated dependency "${depName}"`);
      block.depNames.add(sectionKey);
      block.fields[block.section] += 1;
      block.deps.push({ name: depName, range: dep[2] });
      return;
    }
    bad('unexpected line (unknown or quoted field name, wrong indentation, or a value yarn would not write)');
  });
  finish();
  if (byPackage.size === 0) throw new GateError('yarn.lock has no entries');
  return { byKey, byPackage };
}

// Cargo.lock -> Map "name@version" -> entry. Closed grammar, as Cargo writes
// it: comment lines and `version = N` before the first [[package]]; in each
// package `name`, `version` (required), `source`, `checksum` and a
// multi-line `dependencies = [ "x", ... ]`, each at most once; nothing else
// (no other tables, no single quotes, no escapes). Packages without `source`
// are the local crate (rust-api itself) and are skipped; any source other
// than crates.io is an error (OSV cannot check a git dependency by version).
const CARGO_FIELD = /^(name|version|source|checksum) = "([^"\\]*)"$/;
export function parseCargoLock(text) {
  const byPackage = new Map();
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  let pkg = null;
  let inDeps = false;
  let header = true;
  const packages = [];
  lines.forEach((line, i) => {
    const bad = (why) => {
      throw new GateError(`Cargo.lock line ${i + 1}: ${why}: ${JSON.stringify(line.slice(0, 120))}`);
    };
    if (inDeps) {
      if (line === ']') inDeps = false;
      else if (!/^ "[^"\\]+",$/.test(line)) bad('unexpected line in dependencies');
      return;
    }
    if (line === '') return;
    if (header) {
      if (line.startsWith('#')) return;
      if (/^version = \d+$/.test(line)) {
        header = 'version-seen';
        return;
      }
    }
    if (line === '[[package]]') {
      header = false;
      pkg = { line: i + 1, fields: {} };
      packages.push(pkg);
      return;
    }
    if (!pkg) bad('unexpected line before the first [[package]]');
    const m = CARGO_FIELD.exec(line);
    if (m) {
      if (pkg.fields[m[1]] !== undefined) bad(`repeated key "${m[1]}"`);
      pkg.fields[m[1]] = m[2];
      return;
    }
    if (line === 'dependencies = [') {
      if (pkg.fields.dependencies !== undefined) bad('repeated key "dependencies"');
      pkg.fields.dependencies = true;
      inDeps = true;
      return;
    }
    bad('unexpected line (unknown key, table or format Cargo would not write)');
  });
  if (inDeps) throw new GateError('Cargo.lock: unterminated dependencies array');
  for (const { line, fields } of packages) {
    const { name, version, source } = fields;
    if (!name || !version) throw new GateError(`Cargo.lock line ${line}: package without name or version`);
    if (!CRATE_NAME.test(name)) throw new GateError(`Cargo.lock: invalid crate name ${JSON.stringify(name)}`);
    if (!SEMVER.test(version)) throw new GateError(`Cargo.lock: ${name}: version ${JSON.stringify(version)} is not a SemVer version`);
    if (source === undefined) continue;
    if (source !== CRATES_IO_INDEX) {
      throw new GateError(`Cargo.lock: ${name} ${version} is not from crates.io (${JSON.stringify(source)}); OSV cannot check it`);
    }
    if (!/^[0-9a-f]{64}$/.test(fields.checksum ?? '')) throw new GateError(`Cargo.lock: ${name} ${version} has no valid checksum`);
    if (byPackage.has(`${name}@${version}`)) throw new GateError(`Cargo.lock: ${name} ${version} listed twice`);
    byPackage.set(`${name}@${version}`, { ecosystem: 'crates.io', name, version, deps: [] });
  }
  if (byPackage.size === 0) throw new GateError('Cargo.lock has no crates.io packages');
  return byPackage;
}
