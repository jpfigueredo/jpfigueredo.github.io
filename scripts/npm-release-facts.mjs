#!/usr/bin/env node
// Compares what the npm registry says about two versions of a package, for
// reviewing a dependency bump: who published it, from which repository and
// workflow (npm provenance attestation), lifecycle install scripts, and the
// maintainer list.
//
// Flags (exit 1) the changes that need a closer look:
//   - provenance lost: the old version had a provenance attestation, the new
//     one has none;
//   - provenance from a different repository than the old version;
//   - a new install-time script (preinstall, install, postinstall);
//   - a different publisher account, or a different maintainer list.
// Exit 0: nothing flagged. Exit 2: a lookup failed or bad usage.
//
// Usage: node scripts/npm-release-facts.mjs <package> <old-version> <new-version>
// Network: read-only GET requests to registry.npmjs.org. Installs nothing.

const INSTALL_SCRIPTS = ['preinstall', 'install', 'postinstall'];
const TIMEOUT_MS = 30_000;

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
}

function pkgPath(name) {
  return name.startsWith('@') ? `@${encodeURIComponent(name.slice(1))}` : encodeURIComponent(name);
}

async function facts(name, version) {
  const doc = await getJson(`https://registry.npmjs.org/${pkgPath(name)}/${encodeURIComponent(version)}`);
  const result = {
    version,
    publisher: doc._npmUser?.name ?? '(unknown)',
    trustedPublisher: doc._npmUser?.trustedPublisher?.id ?? null,
    maintainers: (doc.maintainers ?? []).map((m) => m.name).sort(),
    installScripts: Object.fromEntries(INSTALL_SCRIPTS.filter((s) => doc.scripts?.[s]).map((s) => [s, doc.scripts[s]])),
    provenance: null,
  };
  const url = doc.dist?.attestations?.url;
  if (url) {
    const bundle = await getJson(url);
    for (const att of bundle.attestations ?? []) {
      const statement = JSON.parse(Buffer.from(att.bundle.dsseEnvelope.payload, 'base64').toString('utf8'));
      const workflow = statement.predicate?.buildDefinition?.externalParameters?.workflow;
      if (workflow) result.provenance = { repository: workflow.repository, ref: workflow.ref, workflow: workflow.path };
    }
    if (!result.provenance) throw new Error(`${name}@${version}: attestation at ${url} has no SLSA provenance workflow`);
  }
  return result;
}

function show(f) {
  const prov = f.provenance ? `${f.provenance.repository} ${f.provenance.ref} ${f.provenance.workflow}` : 'none';
  const scripts = Object.keys(f.installScripts).length ? JSON.stringify(f.installScripts) : 'none';
  console.log(`  ${f.version}`);
  console.log(`    publisher:       ${f.publisher}${f.trustedPublisher ? ` (trusted publisher: ${f.trustedPublisher})` : ''}`);
  console.log(`    provenance:      ${prov}`);
  console.log(`    install scripts: ${scripts}`);
  console.log(`    maintainers:     ${f.maintainers.join(', ') || '(none)'}`);
}

async function main() {
  const [name, oldVersion, newVersion, extra] = process.argv.slice(2);
  if (!name || !oldVersion || !newVersion || extra) {
    console.error('usage: node scripts/npm-release-facts.mjs <package> <old-version> <new-version>');
    process.exit(2);
  }
  const [before, after] = await Promise.all([facts(name, oldVersion), facts(name, newVersion)]);
  console.log(name);
  show(before);
  show(after);

  const flags = [];
  if (before.provenance && !after.provenance) flags.push('provenance lost: the new version has no provenance attestation');
  if (before.provenance && after.provenance && before.provenance.repository !== after.provenance.repository) {
    flags.push(`provenance repository changed: ${before.provenance.repository} -> ${after.provenance.repository}`);
  }
  for (const s of INSTALL_SCRIPTS) {
    if (after.installScripts[s] && after.installScripts[s] !== before.installScripts[s]) flags.push(`new or changed ${s} script: ${after.installScripts[s]}`);
  }
  if (before.publisher !== after.publisher) {
    const note = after.trustedPublisher && after.provenance ? ' (now trusted publishing with provenance)' : '';
    flags.push(`publisher changed: ${before.publisher} -> ${after.publisher}${note}`);
  }
  if (before.maintainers.join() !== after.maintainers.join()) flags.push('maintainer list changed');

  if (flags.length === 0) {
    console.log('Result: OK (nothing flagged)');
    return;
  }
  for (const f of flags) console.log(`CHECK: ${f}`);
  console.log('Result: review the flagged items before merging');
  process.exit(1);
}

main().catch((err) => {
  console.error(`error: ${err.message}`);
  process.exit(2);
});
