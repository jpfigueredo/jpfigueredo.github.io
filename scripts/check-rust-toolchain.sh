#!/usr/bin/env bash
# Checks that the three places that pin the Rust version agree:
#   1. the rust image tag in the Dockerfile (`FROM rust:X.Y.Z-...`);
#   2. the rustc version the Dockerfile expects (`expected="X.Y.Z"`);
#   3. RUSTUP_TOOLCHAIN in .github/workflows/ci.yml (passed as an argument).
#
# Dependabot (and anyone bumping the image by hand) only changes 1. Without
# this check the PR fails deep inside `docker build`; with it, CI says up
# front which values to change, as an annotation on the Dockerfile.
#
# Usage: scripts/check-rust-toolchain.sh <Dockerfile> <rustup-toolchain>
# CI: scripts/check-rust-toolchain.sh services/rust-api/Dockerfile "$RUSTUP_TOOLCHAIN"
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <Dockerfile> <rustup-toolchain>" >&2
  exit 2
fi
dockerfile="$1"
toolchain="$2"
title="Rust toolchain mismatch"

# 1. FROM rust:<version>-<suffix>@sha256:<digest> (exactly one).
from_lines="$(grep -n -E '^FROM rust:' "$dockerfile" || true)"
if [ "$(printf '%s\n' "$from_lines" | grep -c .)" -ne 1 ]; then
  echo "::error file=$dockerfile,title=$title::expected exactly one 'FROM rust:' line, found: ${from_lines:-none}"
  exit 1
fi
from_line_no="${from_lines%%:*}"
image_version="$(printf '%s\n' "$from_lines" | sed -E -n 's/^[0-9]+:FROM rust:([0-9]+\.[0-9]+\.[0-9]+)-.*/\1/p')"
if [ -z "$image_version" ]; then
  echo "::error file=$dockerfile,line=$from_line_no,title=$title::cannot read an X.Y.Z version from the rust image tag"
  exit 1
fi

# 2. expected="<version>" in the rustc check (exactly one).
expected_lines="$(grep -n -E '^RUN expected="[^"]+"' "$dockerfile" || true)"
if [ "$(printf '%s\n' "$expected_lines" | grep -c .)" -ne 1 ]; then
  echo "::error file=$dockerfile,title=$title::expected exactly one 'RUN expected=\"X.Y.Z\"' line, found: ${expected_lines:-none}"
  exit 1
fi
expected_line_no="${expected_lines%%:*}"
expected_version="$(printf '%s\n' "$expected_lines" | sed -E -n 's/^[0-9]+:RUN expected="([^"]+)".*/\1/p')"

echo "rust image tag:              $image_version (line $from_line_no)"
echo "Dockerfile expected rustc:   $expected_version (line $expected_line_no)"
echo "RUSTUP_TOOLCHAIN (ci.yml):   $toolchain"

if [ "$image_version" = "$expected_version" ] && [ "$image_version" = "$toolchain" ]; then
  echo "OK: all three are $image_version."
  exit 0
fi

echo "::error file=$dockerfile,line=$from_line_no,title=$title::The rust image is $image_version, but the Dockerfile expects rustc $expected_version (line $expected_line_no) and RUSTUP_TOOLCHAIN in .github/workflows/ci.yml is $toolchain. A PR that changes the rust image must set all three to the same version (see CONTRIBUTING.md, Dependency updates)."
exit 1
