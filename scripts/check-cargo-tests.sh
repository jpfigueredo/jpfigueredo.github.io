#!/usr/bin/env bash
# Guard against an empty or partly skipped Rust test suite.
#
# `cargo test` exits 0 when there are no tests at all, and when tests are
# marked #[ignore] or filtered out. This reads the output of a `cargo test`
# run and fails unless:
#   - at least one "test result:" summary line is present;
#   - no test failed, was ignored or was filtered out;
#   - the number of passed tests is at least MIN_TESTS.
#
# Usage: scripts/check-cargo-tests.sh <cargo-test-output-file> <min-tests>
# CI sets <min-tests> from RUST_MIN_TESTS in .github/workflows/ci.yml; raise
# it when you add tests, lower it only when a test is removed on purpose.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <cargo-test-output-file> <min-tests>" >&2
  exit 2
fi
log="$1"
min="$2"
case "$min" in
  '' | *[!0-9]*)
    echo "::error title=cargo test guard::min-tests must be a non-negative integer, got '$min'"
    exit 2
    ;;
esac

# Strip ANSI colors, keep only libtest summary lines, e.g.
#   test result: ok. 9 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
summaries="$(sed 's/\x1b\[[0-9;]*m//g' "$log" | awk '/^test result: /')"
if [ -z "$summaries" ]; then
  echo "::error title=cargo test guard::No 'test result:' line in the cargo test output: no test binary ran."
  exit 1
fi
echo "$summaries"

sum_field() {
  # Sum the number before "<word>" over every summary line.
  awk -v word="$1" '{
    while (match($0, "[0-9]+ " word)) {
      s += substr($0, RSTART, RLENGTH) + 0
      $0 = substr($0, RSTART + RLENGTH)
    }
  } END { print s + 0 }' <<<"$summaries"
}
passed="$(sum_field passed)"
failed="$(sum_field failed)"
ignored="$(sum_field ignored)"
filtered="$(sum_field 'filtered out')"
echo "passed=$passed failed=$failed ignored=$ignored filtered_out=$filtered min=$min"

status=0
if [ "$failed" -ne 0 ]; then
  echo "::error title=cargo test guard::$failed test(s) failed."
  status=1
fi
if [ "$ignored" -ne 0 ] || [ "$filtered" -ne 0 ]; then
  echo "::error title=cargo test guard::$ignored test(s) ignored and $filtered filtered out. Every test must run in CI."
  status=1
fi
if [ "$passed" -lt "$min" ]; then
  echo "::error title=cargo test guard::Only $passed test(s) passed, expected at least $min (RUST_MIN_TESTS in .github/workflows/ci.yml)."
  status=1
fi
exit "$status"
