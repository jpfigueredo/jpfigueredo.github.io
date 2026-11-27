#!/usr/bin/env bash
# Downloads the Swagger UI release zip that utoipa-swagger-ui embeds, and
# checks it against the SHA-256 pinned below. The one place that pins the
# Swagger UI version and hash: the Dockerfile, CI (rust-checks) and local
# builds all call this script.
#
# Why: utoipa-swagger-ui's build script downloads this zip from GitHub, with
# no checksum, unless SWAGGER_UI_DOWNLOAD_URL points to a local file
# (`file:///absolute/path`). With a file:// URL it only copies and unzips the
# file: no network access. services/rust-api/.cargo/config.toml sets a value
# that fails the build when SWAGGER_UI_DOWNLOAD_URL is not set, so a build
# never falls back to the unchecked download.
#
# Usage:  scripts/fetch-swagger-ui.sh <output-dir> [command [args...]]
# Writes <output-dir>/swagger-ui.zip (reused if it is already there and its
# hash matches). Without a command, prints the value to export as its last
# line:
#   SWAGGER_UI_DOWNLOAD_URL=file:///absolute/output-dir/swagger-ui.zip
# With a command, runs it with that variable exported, e.g.
#   scripts/fetch-swagger-ui.sh target/swagger-ui cargo build --release
#
# To update Swagger UI: change SWAGGER_UI_VERSION, download the new zip
# twice, check that both hashes agree and that the files under dist/ match
# the swagger-ui-dist package of the same version on npm, then set
# SWAGGER_UI_SHA256. utoipa-swagger-ui's own default is in the
# SWAGGER_UI_DOWNLOAD_URL_DEFAULT constant of its build.rs.
set -euo pipefail

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

mkdir -p "$1"
out_dir="$(cd "$1" && pwd)"
shift
zip_name="swagger-ui.zip"

echo "Swagger UI ${SWAGGER_UI_VERSION}"
echo "url:    ${SWAGGER_UI_URL}"
echo "sha256: ${SWAGGER_UI_SHA256}"

verify() {
  # sha256sum -c against the pinned hash; prints "<file>: OK" or fails.
  (cd "$out_dir" && printf '%s  %s\n' "$SWAGGER_UI_SHA256" "$1" | sha256sum -c -)
}

if [ -f "$out_dir/$zip_name" ] && verify "$zip_name"; then
  echo "Reusing $out_dir/$zip_name (hash matches)."
else
  curl --version | head -n 1
  rm -f "$out_dir/$zip_name.part"
  curl --fail --silent --show-error --location \
    --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --retry 3 --max-time 300 \
    --output "$out_dir/$zip_name.part" "$SWAGGER_UI_URL"
  sha256sum "$out_dir/$zip_name.part"
  verify "$zip_name.part"
  mv "$out_dir/$zip_name.part" "$out_dir/$zip_name"
fi

if [ "$#" -eq 0 ]; then
  echo "SWAGGER_UI_DOWNLOAD_URL=file://$out_dir/$zip_name"
else
  export SWAGGER_UI_DOWNLOAD_URL="file://$out_dir/$zip_name"
  echo "SWAGGER_UI_DOWNLOAD_URL=$SWAGGER_UI_DOWNLOAD_URL"
  exec "$@"
fi
