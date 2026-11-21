# Contributing

## Commits

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or behavior |
| `fix` | Bug fix |
| `refactor` | Code restructure with no behavior change |
| `style` | CSS/SCSS/formatting changes only |
| `perf` | Performance improvement |
| `test` | Add or update tests |
| `docs` | Documentation only |
| `build` | Dockerfiles, Cargo dependencies, toolchain pins |
| `ci` | GitHub Actions workflows |
| `chore` | Tooling, config, lockfile, deps |

### Scopes

Scopes map to packages/apps in the monorepo:

| Scope | Path |
|---|---|
| `web` | `web/` |
| `sw-timeline` | `apps/sw-timeline/` |
| `kafka-viz` | `apps/kafka-viz/` |
| `angular-demo` | `archive/angular-demo/` (offline, not a workspace) |
| `doom64` | `apps/doom64-wasm/` |
| `ui` | `packages/ui/` |
| `config` | `packages/config/` |
| `bff-api` | `services/bff-api/` |
| `rust-api` | `services/rust-api/` |
| `edge-proxy` | `services/edge-proxy/` |
| `workspace` | Root monorepo config (`package.json`, `turbo.json`, `yarn.lock`) |
| `deps` / `deps-dev` | Dependency updates opened by Dependabot (see "Dependency updates" below) |

Omit scope only for cross-cutting changes that don't fit a single package.

### Examples

```
feat(sw-timeline): add macintosh-1984 and java-1995 events with materialist analysis

fix(kafka-viz): rename unused broker param to _broker to satisfy strict TS

refactor(web): split Button styles into typed constants to fix TS2559

style(sw-timeline): convert kafka.scss to plain CSS, remove sass dependency

ci: add BFF and Rust API deploy hooks for Render.com

chore(workspace): register apps/kafka-viz and apps/angular-demo as workspaces

docs(contributing): add commit conventions
```

### Rules

- **Subject line**: imperative mood, lowercase, no trailing period, max 72 chars
- **Body**: use when the *why* isn't obvious from the subject; wrap at 72 chars
- **Breaking changes**: add `BREAKING CHANGE:` in the footer (or `!` after scope)
- **Atomic commits**: one logical change per commit — avoid mixing unrelated scopes
- **Do not commit**:
  - Build artifacts (`dist/`, `target/`, `*.tsbuildinfo`, `*.timestamp-*.mjs`)
  - Secrets or `.env` files
  - Generated lock file changes unless deps actually changed
- **Do not put claude signature**: The `Co-Authored-By: Claude Sonnet 4.6 noreply@anthropic.com` part is unecessary.

### Releases

Tags follow semver with a pre-release label: `v1.0.0-beta.1`, `v1.0.0-beta.2`, `v1.0.0`.

Tags only mark a release; they do not trigger a deploy. The GitHub Pages deploy
(`.github/workflows/pages.yml`) runs on every push to `main`.

```bash
git tag v1.0.0-beta.2
git push origin v1.0.0-beta.2
```

## Dependency updates (Dependabot)

Configuration: `.github/dependabot.yml`. Every Monday Dependabot opens pull
requests against `develop` (the default branch) for npm (yarn 1, root and
workspaces), Cargo (`services/rust-api`), the base images in
`services/rust-api/Dockerfile` and the GitHub Actions in `.github/workflows/`.
Minor and patch updates are grouped; each major update is its own PR.

Cooldown: Dependabot waits 7 days after a release before proposing it, but
only for the dependency the PR is about. Transitive versions pulled into
`yarn.lock` with it, and Cargo lockfile-only updates, can be hours old.
Security updates skip the cooldown on purpose. PR CI closes that gap: the
lockfile entry age gate fails any PR that adds a version younger than 7 days
(see "Lockfile entry age" below).

Nothing is merged automatically. A Dependabot PR gets the same review as any
other PR, plus the checks below.

```bash
gh pr view <n> --json author,headRefName,isCrossRepository
git fetch origin develop "+pull/<n>/head:dependabot-<n>"
git diff --stat origin/develop...dependabot-<n>
# Gate code from develop (never the PR branch's), with the scripts/lib/
# modules both gates import (lockfile grammar, output escaping).
gate="$(mktemp -d)"; mkdir "$gate/lib"
for f in advisory-gate.mjs lock-entry-ages.mjs lib/lockfile-grammar.mjs lib/gate-report.mjs; do
  git show "origin/develop:scripts/$f" > "$gate/$f"
done
node "$gate/lock-entry-ages.mjs" --base origin/develop --head dependabot-<n>
```

1. **Author.** `author.login` is `app/dependabot`, `headRefName` starts with
   `dependabot/` and `isCrossRepository` is `false`. A PR from a fork that
   copies a Dependabot title is an ordinary external PR.
2. **Scope.** The diff only touches what the title says: `package.json` files
   and `yarn.lock`; `Cargo.toml`/`Cargo.lock`; a `FROM` line of the
   Dockerfile; or `uses:` lines in workflows. Anything else: close the PR.
3. **Lockfile.**
   - `yarn.lock`: every new `resolved` URL points to `registry.yarnpkg.com` or
     `registry.npmjs.org`, and every changed version has a new `integrity`.
     New packages (not only new versions) must be explained by the update.
     Look for duplicate versions with `yarn why <package>`.
   - `Cargo.lock`: every `source` is
     `registry+https://github.com/rust-lang/crates.io-index` and every changed
     version has a new `checksum`. Look for duplicates with
     `cargo tree -d --locked` in `services/rust-api`.
   - Dockerfile: the new digest is what the registry serves for that tag (the
     command is in the Dockerfile header). Dependabot does not edit the
     `# image:tag (read <date>)` comment above the `FROM`; refresh it in a
     follow-up PR.
   - Workflows: the new SHA is the commit of the tag in the comment, it
     descends from the old SHA, and it is on the action's default branch:

     ```bash
     gh api repos/<owner>/<action>/commits/<tag> --jq .sha        # = new SHA
     gh api repos/<owner>/<action>/compare/<old-sha>...<new-sha> --jq .status
     # -> ahead
     gh api repos/<owner>/<action>/compare/<new-sha>...<default-branch> --jq .status
     # -> ahead or identical
     ```

4. **Age.** Automatic: the "Lockfile entry age" step of `node-checks` fails
   if any new version in `yarn.lock` or `Cargo.lock`, direct or transitive,
   is younger than 7 days or could not be looked up. To see the table
   locally, run develop's copy as above (not the PR branch's: a PR can edit
   the script). For actions, which the gate does not cover, use
   `gh release view <tag> -R <owner>/<action> --json publishedAt`. A security
   update can be younger: read the advisory linked in the PR, and if it cannot
   wait, add an exception (see "Lockfile entry age").
5. **Provenance (npm).** For each package the PR updates directly:
   `node scripts/npm-release-facts.mjs <package> <old-version> <new-version>`.
   It reads `https://registry.npmjs.org/<package>/<version>` (`_npmUser`,
   `dist.attestations.url`, `scripts`, `maintainers`) and the provenance
   attestation (source repository, ref and workflow), and flags lost
   provenance, a different source repository, new install scripts and a
   different publisher or maintainer list. For crates, check `published_by`
   at `https://crates.io/api/v1/crates/<name>/<version>`; for images,
   `docker buildx imagetools inspect <image>@<digest> --format
   '{{json .Provenance}}'` when the publisher attaches provenance.
6. **Changelog.** Read the release notes in the PR body. For a major update,
   read the migration notes and check the code that uses the package; if code
   must change, close the PR and do the upgrade in a `feature/*` branch.
7. **Not covered by PR CI.** These run only in deploy workflows (push to
   `main`, with deploy permissions or secrets), so a green PR says nothing
   about them: `actions/upload-pages-artifact` and `actions/deploy-pages`
   (`pages.yml`), `actions/upload-artifact` (`links.yml`) and `wrangler`
   (`edge-proxy.yml`). For these, read the full diff between the old and new
   SHA or version, including the built `dist/` of an action, before merging.
8. **CI.** `node-checks` and `rust-checks` are green, `rust-checks` actually
   built Rust for Cargo and Docker PRs, the advisory gate reports no new
   advisories (see "Dependency advisories" below) and the lockfile entry age
   gate passed without a new exception you did not approve. Dependabot PRs run CI with a read-only token and no
   secrets, like a pull request from a fork. To try the branch locally, never
   run lifecycle scripts: `yarn install --ignore-scripts`, as CI does.
9. **Merge.** Squash into `develop`, by hand. To refresh a Dependabot branch,
   comment `@dependabot rebase` on the PR.

### Rust toolchain upgrades

The Rust version is pinned in three places: the `rust` image tag in
`services/rust-api/Dockerfile`, `expected="X.Y.Z"` in the Dockerfile's rustc
check, and `RUSTUP_TOOLCHAIN` in `.github/workflows/ci.yml`. Dependabot
proposes new minor and patch `rust` tags (majors are ignored) but only edits
the first. Its PR therefore fails on purpose: the "Rust version agrees" step
of `rust-checks` (`scripts/check-rust-toolchain.sh`) annotates the Dockerfile
with the values to change. The same PR must set all three to the new version:
add the two edits to the Dependabot branch, or close it and open a
`feature/*` PR with the tag, digest and both edits.

## Dependency advisories

`scripts/advisory-gate.mjs` checks every version in `yarn.lock` and
`services/rust-api/Cargo.lock` against [OSV](https://osv.dev) (GitHub
Advisory Database and RustSec, the data behind the Dependabot alerts). It
needs no token and installs nothing.

- **PR CI** (`node-checks`, ratchet mode): fails if the PR adds an advisory
  that the base branch does not have, for the same package and workspace,
  unless the allowlist accepts it. Any severity counts. Moving a vulnerable
  package from `devDependencies` to `dependencies` also counts as new. The
  gate code comes from the base branch, so a PR that edits the script is
  judged by the old version. Allowlist entries the PR adds or edits show up
  as warnings: they already apply in that run, so the reviewer approves them.
- **Weekly** (`.github/workflows/advisories.yml`, absolute mode on
  `develop`): fails on every advisory the allowlist does not accept, so the
  existing ones stay visible until they are fixed.
- **Bootstrap (`release`/`main`):** while the base branch has no
  `scripts/advisory-gate.mjs`, CI fetches `develop` and requires the PR's
  gate files (`scripts/advisory-gate.mjs`, `scripts/lib/*.mjs` that CI copies)
  to be develop's, same mode and blob; then develop's copy runs. Any
  difference is exit 2. Only promotions, and hotfixes that do not touch the
  gate, pass; change the gate in a PR to `develop` first.
- **How CI runs both gates:** with a clean environment (`env -i` with only
  `PATH`, `HOME` and `GITHUB_STEP_SUMMARY`, so `NODE_OPTIONS`, TLS, CA and
  proxy variables of the job never reach them), and exit 0 counts as a pass
  only if the output has exactly one line `Result: PASS`. An exit 0 without
  it (e.g. a CLI guard that did not start the gate) is exit 2.
- Both fail if an allowlist entry is invalid, expired, or further away than
  its severity allows (exit 1), and fail closed (exit 2, nothing checked) if
  OSV cannot be queried or a lockfile does not validate. The lockfiles are
  read with a closed grammar: only the lines yarn 1 and Cargo write (known
  field names, unquoted, once each, exact indentation; `resolved` a plain
  `https://` registry URL), so the gate cannot read a different version than
  the one yarn or Cargo installs. `version` must be SemVer and, in
  `yarn.lock`, match the `resolved` tarball name (`<name>-<version>.tgz`),
  with every key naming the same package. A hand-edited lockfile that yarn
  would still accept can fail here: regenerate it with `yarn install`.

Run it locally the way a reviewer should, with the `develop` copy of the
script against the PR branch:

```bash
git fetch origin develop "+pull/<n>/head:pr-<n>"
# "$gate": develop's copy of the gate code, as in "Dependency updates (Dependabot)".
node "$gate/advisory-gate.mjs" --mode ratchet --base origin/develop --head pr-<n>
node "$gate/advisory-gate.mjs" --mode absolute --head origin/develop   # all debt
```

A lockfile that the base does not have (e.g. `Cargo.lock` in a promotion
PR into a branch that predates it) counts as empty: every advisory of the
head in it is new. Missing in the head is exit 2.

### Accepting an advisory (`security/advisory-allowlist.json`)

Upgrading is the default. An entry is a decision that the advisory does not
affect this project, in VEX terms, with a date to look at it again:

```json
{
  "id": "GHSA-xxxx-xxxx-xxxx",
  "ecosystem": "npm",
  "package": "react-router",
  "version": "6.30.6",
  "paths": ["web"],
  "reason": "Why the vulnerable code cannot be reached here, in one or two sentences.",
  "justification": "vulnerable_code_not_in_execute_path",
  "reviewBy": "2027-02-17"
}
```

- `id`: GHSA, RUSTSEC or CVE id; aliases match (one entry for
  GHSA-m665-v7pm-7grj also covers its RUSTSEC id).
- `ecosystem`: `npm` or `crates.io`. `version` (exact) or `range`
  (`>=6.0.0 <7.0.0`; comparators `>= > <= < =`), not both.
- `paths`: the workspaces the decision covers (`web`, `apps/ohara/front`,
  `services/rust-api`, `.` for the root). A new workspace that pulls in the
  same package is a new finding.
- `justification`: one of `component_not_present`,
  `vulnerable_code_not_present`, `vulnerable_code_not_in_execute_path`,
  `vulnerable_code_cannot_be_controlled_by_adversary`,
  `inline_mitigations_already_exist`.
- `reviewBy`: at most 30 days ahead for critical, high or unknown severity,
  90 days for the rest; for this limit the severity is the highest of
  GitHub's label and the CVSS v3 score. The gate warns 14 days before and
  fails the day after. An entry that no longer matches anything (e.g. after
  the upgrade) does not fail: it gets a warning to remove it.

Severity comes from the OSV record: GitHub's label (`database_specific.severity`)
when there is one, else the CVSS v3 base score, else `info` for RustSec
informational advisories (unmaintained, unsound), else `unknown`.

## Lockfile entry age

`scripts/lock-entry-ages.mjs` runs in PR CI (`node-checks`, every PR, not
only Dependabot's). It compares the PR's `yarn.lock` and
`services/rust-api/Cargo.lock` with the base branch's and fails if a
`name@version` the PR adds, direct or transitive, was published less than
7 days ago (npm registry `time`, crates.io `created_at`). Exactly 7 days
passes. Removed versions do not count, and neither does a change of only
`resolved`, `integrity` or `checksum` for the same `name@version`.

- Exit 1: a version too young and not accepted, an exception that is
  invalid or expired, or `security/lock-age-allowlist.json` deleted.
- Exit 2, not checked: a registry lookup failed (network, HTTP error, version
  missing or unpublished), or a lockfile entry is outside the closed grammar
  of the advisory gate. Git, tarball, `file:` and other-registry sources fail
  here with no exception possible: there is no registry publish date. Cargo
  path dependencies and workspace members (no `source`) are skipped.
- A lockfile the base does not have counts as empty: every entry of the
  head is new and checked (promotion PRs into `release`/`main`, which
  predate `Cargo.lock`). Missing in the head is exit 2.
- Like the advisory gate, CI runs the base branch's copy of the script and
  of the `scripts/lib/` modules it imports, so a PR that edits them is
  judged by the old version. The base copy is used once the base has
  `security/lock-age-allowlist.json`. Before that (promotion and hotfix PRs
  to `release`/`main` until the gate gets there), CI fetches `develop` and
  requires the PR's `scripts/lock-entry-ages.mjs`,
  `scripts/lib/lockfile-grammar.mjs` and `scripts/lib/gate-report.mjs` to be
  develop's, same mode and blob; then develop's copy runs, with a warning.
  Any difference is exit 2: only promotions, and hotfixes that do not touch
  the gate, pass. Reviewers run develop's copy the same way (commands in
  "Dependency updates (Dependabot)").
- Same clean environment and positive proof as the advisory gate: `env -i`
  with only `PATH`, `HOME` and `GITHUB_STEP_SUMMARY`; exit 0 counts only
  with exactly one `Result: PASS` line.

The usual fix is to wait, or to keep the previous version (in `yarn.lock`,
pin the range to the older entry; in Cargo, `cargo update -p <crate>
--precise <older>`).

### Asking for an exception (`security/lock-age-allowlist.json`)

Only when the version cannot wait, typically a security fix. Add an entry in
the same PR and explain it in the PR description; the gate lists it as a
warning, and `security/` changes need the owner's review:

```json
{
  "ecosystem": "npm",
  "package": "example-package",
  "version": "1.2.3",
  "ghsa": "GHSA-xxxx-xxxx-xxxx",
  "reason": "Why this version cannot wait 7 days, in one or two sentences.",
  "reviewBy": "2026-12-01"
}
```

- `ecosystem`: `npm` or `crates.io`; `package` is the exact package name
  (the real one, not an alias) and `version` one exact SemVer version: no
  ranges, `*` or dist-tags. One entry per version.
- Do not delete the file, even when it is empty: its presence in the base
  branch is what makes CI run the base's copy of the gate. A PR that deletes
  it fails the gate (exit 1).
- `ghsa`: the advisory the young version is needed for.
- `reviewBy`: at most 30 days ahead. The day after, the entry fails every PR
  until it is removed (by then the version is old enough).
- An exception accepts the age only: the registry lookup must still succeed.
