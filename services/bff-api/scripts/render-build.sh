#!/usr/bin/env bash
# Production build for bff-api (Render, native Node runtime, repo root as the
# service root). Render build command:
#
#   bash services/bff-api/scripts/render-build.sh
#
# Installs the production dependencies from the root yarn.lock and nothing
# else:
#   - fails unless Node matches the major in .nvmrc and yarn is exactly the
#     version in packageManager;
#   - fails if any package.json drifted from yarn.lock (yarn 1's
#     --frozen-lockfile misses that in workspaces, see the check script);
#   - --frozen-lockfile: never writes yarn.lock;
#   - --production: no devDependencies;
#   - --ignore-scripts: no lifecycle scripts (express and cors have none);
#   - after the install, fails if a dependency Node resolves from
#     services/bff-api is not the version yarn.lock pins (e.g. a stale
#     node_modules restored from the build cache).
# Note: --production installs the production dependencies of every workspace,
# not only bff-api; only express and cors are loaded at runtime.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."

node_version="$(node --version)"
yarn_version="$(yarn --version)"
echo "node $node_version, yarn $yarn_version"

want_major="$(tr -d '[:space:]v' < .nvmrc)"
want_major="${want_major%%.*}"
have_major="${node_version#v}"
have_major="${have_major%%.*}"
if [ "$have_major" != "$want_major" ]; then
  echo "Node $have_major.x does not match .nvmrc ($want_major)." >&2
  exit 1
fi

want_yarn="$(node -p '(require("./package.json").packageManager || "").replace(/^yarn@/, "")')"
case "$yarn_version" in
  "$want_yarn") ;;
  *)
    echo "yarn $want_yarn required (packageManager), got $yarn_version." >&2
    exit 1
    ;;
esac

node scripts/check-lockfile-sync.mjs
yarn install --frozen-lockfile --production --ignore-scripts --non-interactive
node scripts/check-lockfile-sync.mjs --installed services/bff-api
