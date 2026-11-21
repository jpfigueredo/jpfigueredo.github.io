#!/usr/bin/env node
// Fails CI when the test suite silently shrinks.
//
// `turbo run test` exits 0 with "No tasks were executed" when no package has a
// `test` script, and vitest exits 0 when tests are skipped (`describe.skip`,
// `it.skip`, `it.todo`). Both look green. This check reads two reports and
// fails if:
//   - a package listed in EXPECTED_TEST_TASKS has no real `test` task in the
//     turbo task graph (script removed or renamed);
//   - the ohara-front vitest run has fewer than MIN_OHARA_FRONT_TESTS passing
//     tests, any failed test, or more than MAX_OHARA_FRONT_SKIPPED
//     skipped/todo tests.
//
// Skipped tests fail the check (MAX_OHARA_FRONT_SKIPPED = 0) on purpose: a
// skip hides a hole exactly like a deleted test does. If a skip is really
// needed, raise the limit in the same PR, so the reviewer sees it.
//
// Updating the numbers: when a PR adds tests, raise MIN_OHARA_FRONT_TESTS to
// the new "passed" count printed by this script (keep it equal to the real count, so
// a later deletion is caught). When a PR removes tests on purpose, lower it in
// the same PR. When a new package gets a `test` script, add it to
// EXPECTED_TEST_TASKS.
//
// Usage:
//   yarn -s turbo run test --filter='!rust-api' --dry=json > turbo-dry.json
//   yarn -s workspace @jpfig/ohara-front vitest run \
//     --reporter=json --outputFile="$PWD/vitest.json"
//   node scripts/check-test-suite.mjs turbo-dry.json vitest.json

import { readFileSync } from 'node:fs';

// Packages that must have a real `test` task in the turbo graph.
const EXPECTED_TEST_TASKS = ['@jpfig/ohara-front'];

// @jpfig/ohara-front vitest suite (71 tests in 3 files on 2026-11-21).
const MIN_OHARA_FRONT_TESTS = 71;
const MAX_OHARA_FRONT_SKIPPED = 0;

const [turboDryPath, vitestReportPath] = process.argv.slice(2);
if (!turboDryPath || !vitestReportPath) {
  console.error('usage: node scripts/check-test-suite.mjs <turbo-dry.json> <vitest-report.json>');
  process.exit(2);
}

function readJson(file, what) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`could not read ${what} from ${file}: ${err.message}`);
    process.exit(1);
  }
}

const errors = [];

// 1. turbo task graph: which packages run a real `test` command.
const dry = readJson(turboDryPath, 'turbo --dry=json output');
const testTasks = (dry.tasks ?? [])
  .filter((t) => t.task === 'test' && t.command && t.command !== '<NONEXISTENT>')
  .map((t) => t.package);
console.log(`turbo test tasks with a command: ${testTasks.length} (${testTasks.join(', ') || 'none'})`);
for (const pkg of EXPECTED_TEST_TASKS) {
  if (!testTasks.includes(pkg)) {
    errors.push(`${pkg} has no \`test\` task (missing or empty "test" script in its package.json)`);
  }
}

// 2. ohara-front vitest report. Counted from the per-test statuses, not from
// the summary fields: vitest 1.6 counts the tests inside a `describe.skip`
// as passed in numPassedTests (numPendingTests stays 0).
const report = readJson(vitestReportPath, 'vitest JSON report');
const tests = (report.testResults ?? []).flatMap((file) => file.assertionResults ?? []);
const passed = tests.filter((t) => t.status === 'passed');
const failed = tests.filter((t) => t.status === 'failed');
// Anything else (skipped, pending, todo, disabled) did not run.
const notRun = tests.filter((t) => t.status !== 'passed' && t.status !== 'failed');
console.log(
  `@jpfig/ohara-front vitest: total=${tests.length} passed=${passed.length} failed=${failed.length} ` +
    `skipped/todo=${notRun.length} (min passed ${MIN_OHARA_FRONT_TESTS}, max skipped ${MAX_OHARA_FRONT_SKIPPED})`,
);
if (passed.length < MIN_OHARA_FRONT_TESTS) {
  errors.push(`@jpfig/ohara-front ran ${passed.length} passing tests, expected at least ${MIN_OHARA_FRONT_TESTS}`);
}
if (failed.length > 0) {
  errors.push(`@jpfig/ohara-front has ${failed.length} failed tests`);
}
if (notRun.length > MAX_OHARA_FRONT_SKIPPED) {
  const names = notRun.map((t) => `  - [${t.status}] ${t.fullName ?? t.title}`);
  errors.push(
    `@jpfig/ohara-front has ${notRun.length} skipped/todo tests, at most ${MAX_OHARA_FRONT_SKIPPED} allowed:\n${names.join('\n')}`,
  );
}

if (errors.length > 0) {
  for (const e of errors) console.error(`::error title=test suite guard::${e.replaceAll('\n', '%0A')}`);
  console.error('See scripts/check-test-suite.mjs for how to update the expected numbers.');
  process.exit(1);
}
console.log('test suite guard: ok');
