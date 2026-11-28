#!/usr/bin/env bash
# Downloads the Swagger UI release zip that utoipa-swagger-ui embeds, and
# checks it against the SHA-256 pinned below. The one place that pins the
# Swagger UI version and hash: the Dockerfile, CI (rust-checks) and local
# builds all call this script.
#
# Why: utoipa-swagger-ui's build script downloads this zip from GitHub, with
# no checksum, unless SWAGGER_UI_DOWNLOAD_URL points to a local file
# (`file:///absolute/path`). With a file:// URL it only copies and unzips the
# file: no network access.
#
# What this does not cover:
#   - services/rust-api/.cargo/config.toml makes a build without
#     SWAGGER_UI_DOWNLOAD_URL fail, but cargo reads it only when it runs from
#     inside services/rust-api. `cargo build --manifest-path
#     services/rust-api/Cargo.toml` from the repository root does not see it
#     and falls back to the unchecked download. CI, the Dockerfile, the
#     Makefile and the package.json scripts set the variable explicitly; run
#     cargo by hand only from inside services/rust-api.
#   - the embedded UI is the checked zip only while SWAGGER_UI_OVERWRITE_FOLDER
#     is unset: the build script copies every file of that folder over the
#     unzipped dist/. Nothing here sets it.
#
# Usage:  scripts/fetch-swagger-ui.sh <output-dir> [command [args...]]
# Writes <output-dir>/swagger-ui.zip. If the file is already there and its
# hash matches, it only checks it: no download, curl not needed (the
# Dockerfile's builder stage relies on this). Without a command, prints the
# value to export as its last line:
#   SWAGGER_UI_DOWNLOAD_URL=file:///absolute/output-dir/swagger-ui.zip
# With a command, runs it with that variable exported, e.g.
#   scripts/fetch-swagger-ui.sh target/swagger-ui cargo build --release
#
# To update Swagger UI: change SWAGGER_UI_VERSION, download the new zip
# twice, check that both hashes agree and that the files under dist/ match
# the swagger-ui-dist package of the same version on npm, then set
# SWAGGER_UI_SHA256. utoipa-swagger-ui's own default is in the
# SWAGGER_UI_DOWNLOAD_URL_DEFAULT constant of its build.rs. Then run
# `cargo clean -p utoipa-swagger-ui` before building: its build script
# (10.0.2) does not rerun when only the file:// zip or the variable changes,
# so an incremental build keeps embedding the old UI. Last, run `cargo test`:
# the Swagger UI page's CSP allows its one inline <style> (the top bar logo)
# by hash, and if the new version changed that text, the test
# swagger_ui_logo_style_matches_the_csp_hash fails and prints it. Recompute
# the hash with
#   printf '%s' "$text" | openssl dgst -sha256 -binary | base64
# and update it in src/main.rs: SWAGGER_UI_CSP, and LOGO_STYLE and
# LOGO_STYLE_HASH in the tests module.
set -euo pipefail
# `cd` below must resolve the directory it is given, not a CDPATH entry.
unset CDPATH

# Swagger UI 5.32.6 (tag commit dcdca62c8b64a0a54e4decd4e1a6c3c712fdcc60, the
# version utoipa-swagger-ui 10.0.2 defaults to). The zip's dist/ files are
# byte-identical to npm swagger-ui-dist@5.32.6 (checked 2026-11-27).
SWAGGER_UI_VERSION="5.32.6"
SWAGGER_UI_SHA256="b3c07e091559b59a833f66547eb1fc18f2896f96e3f1f953e2f1efb328aa3394"
SWAGGER_UI_URL="https://github.com/swagger-api/swagger-ui/archive/refs/tags/v${SWAGGER_UI_VERSION}.zip"

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <output-dir> [command [args...]]" >&2
  exit 2
fi

mkdir -p -- "$1"
out_dir="$(cd -- "$1" >/dev/null && pwd)"
shift
zip_name="swagger-ui.zip"

echo "Swagger UI ${SWAGGER_UI_VERSION}"
echo "url:    ${SWAGGER_UI_URL}"
echo "sha256: ${SWAGGER_UI_SHA256}"

verify() {
  # sha256sum -c against the pinned hash; prints "<file>: OK" or fails.
  (cd -- "$out_dir" >/dev/null && printf '%s  %s\n' "$SWAGGER_UI_SHA256" "$1" | sha256sum -c -)
}

if [ -f "$out_dir/$zip_name" ] && verify "$zip_name"; then
  echo "$out_dir/$zip_name is already there and its SHA-256 matches: not downloaded."
else
  if ! command -v curl >/dev/null; then
    echo "error: $out_dir/$zip_name is missing or its SHA-256 does not match, and curl (needed to download it) is not installed." >&2
    exit 1
  fi
  curl --version | sed -n '1p'
  # A temporary name of its own, so parallel runs on the same directory
  # never write to the same file; removed on any exit before the rename.
  part="$(mktemp "$out_dir/$zip_name.XXXXXX.part")"
  trap 'rm -f -- "$part"' EXIT
  curl --fail --silent --show-error --location \
    --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --retry 3 --max-time 300 \
    --output "$part" "$SWAGGER_UI_URL"
  sha256sum "$part"
  verify "${part##*/}"
  chmod 0644 "$part"
  mv -f -- "$part" "$out_dir/$zip_name"
fi

if [ "$#" -eq 0 ]; then
  echo "SWAGGER_UI_DOWNLOAD_URL=file://$out_dir/$zip_name"
else
  export SWAGGER_UI_DOWNLOAD_URL="file://$out_dir/$zip_name"
  echo "SWAGGER_UI_DOWNLOAD_URL=$SWAGGER_UI_DOWNLOAD_URL"
  exec "$@"
fi
