#!/usr/bin/env bash
# Production build for bff-api (Render, native Node runtime, repo root as the
# service root). Render build command:
#
#   bash services/bff-api/scripts/render-build.sh
#
# Installs the production dependencies from the root yarn.lock and nothing
# else:
#   - fails unless Node matches the major in .nvmrc and yarn is 1.x;
#   - fails if any workspace package.json drifted from yarn.lock (yarn 1's
#     --frozen-lockfile misses that in workspaces, see the check script);
#   - --frozen-lockfile: never writes yarn.lock;
#   - --production: no devDependencies;
#   - --ignore-scripts: no lifecycle scripts (express and cors have none).
# Note: --production installs the production dependencies of every workspace,
# not only bff-api; only express and cors are loaded at runtime.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."

echo "node $(node --version), yarn $(yarn --version)"

want_major="$(tr -d '[:space:]v' < .nvmrc)"
want_major="${want_major%%.*}"
have_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$have_major" != "$want_major" ]; then
  echo "Node $have_major.x does not match .nvmrc ($want_major)." >&2
  exit 1
fi
if ! yarn --version | grep -q '^1\.'; then
  echo "yarn 1.x required (packageManager: yarn@1.22.22)." >&2
  exit 1
fi

node scripts/check-lockfile-sync.mjs
yarn install --frozen-lockfile --production --ignore-scripts --non-interactive

# Versions actually resolved by bff-api, for the deploy log.
node -e '
const paths = ["services/bff-api"];
for (const name of Object.keys(require("./services/bff-api/package.json").dependencies)) {
  const pkg = require(require.resolve(name + "/package.json", { paths }));
  console.log(`bff-api uses ${name}@${pkg.version}`);
}'
