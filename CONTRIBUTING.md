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
Security updates skip the cooldown on purpose.

Nothing is merged automatically. A Dependabot PR gets the same review as any
other PR, plus the checks below.

```bash
gh pr view <n> --json author,headRefName,isCrossRepository
git fetch origin develop "+pull/<n>/head:dependabot-<n>"
git diff --stat origin/develop...dependabot-<n>
node scripts/lock-entry-ages.mjs --head dependabot-<n>
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

4. **Age.** `node scripts/lock-entry-ages.mjs --head dependabot-<n>` lists
   every new version in `yarn.lock` and `Cargo.lock`, direct or transitive,
   with its publish date, and exits non-zero if one is younger than 7 days or
   could not be looked up. For actions use
   `gh release view <tag> -R <owner>/<action> --json publishedAt`. A security
   update can be younger: read the advisory linked in the PR instead.
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
   built Rust for Cargo and Docker PRs, and the `yarn audit` step reports no
   new advisories. Dependabot PRs run CI with a read-only token and no
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
