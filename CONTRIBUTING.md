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

A push of a tag matching `v*` triggers the GitHub Pages deploy workflow automatically.

```bash
git tag v1.0.0-beta.2
git push origin v1.0.0-beta.2
```

## Dependency updates (Dependabot)

Configuration: `.github/dependabot.yml`. Every Monday Dependabot opens pull
requests against `develop` for npm (yarn 1, root and workspaces), Cargo
(`services/rust-api`), the base images in `services/rust-api/Dockerfile` and
the GitHub Actions in `.github/workflows/`. Minor and patch updates are
grouped; each major update is its own PR. Versions published less than 7 days
ago are not proposed (cooldown); security updates skip the cooldown.

Nothing is merged automatically. A Dependabot PR gets the same review as any
other PR, plus the checks below. To read the lockfile diff locally:

```bash
git fetch origin develop "pull/<n>/head:dependabot-<n>"
git diff --stat origin/develop...dependabot-<n>
```

1. **Scope.** The diff only touches what the title says: `package.json` files
   and `yarn.lock`; `Cargo.toml`/`Cargo.lock`; a `FROM` line of the
   Dockerfile; or `uses:` lines in workflows. Anything else: close the PR.
2. **Lockfile.**
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
   - Workflows: the SHA is the commit of the tag in the comment:
     `gh api repos/<owner>/<action>/commits/<tag> --jq .sha`.
3. **Provenance.** The release comes from the expected publisher and source
   repository: `yarn info <package>@<version> dist --json` (npm provenance
   attestations, when published, are under `attestations`); the crate's page
   or `https://crates.io/api/v1/crates/<name>/<version>` (`published_by`);
   for actions, the release in the action's own repository; for images,
   `docker buildx imagetools inspect <image>@<digest> --format
   '{{json .Provenance}}'` when the publisher attaches provenance.
4. **Cooldown.** The version was published at least 7 days ago:
   `yarn info <package> time --json`, the crates.io `created_at`, or
   `gh release view <tag> -R <owner>/<action> --json publishedAt`. A security
   update can be younger: read the advisory linked in the PR instead.
5. **Changelog.** Read the release notes in the PR body. For a major update,
   read the migration notes and check the code that uses the package; if code
   must change, close the PR and do the upgrade in a `feature/*` branch.
6. **CI.** `node-checks` and `rust-checks` are green, `rust-checks` actually
   built Rust for Cargo and Docker PRs, and the `yarn audit` step reports no
   new advisories. Dependabot PRs run CI with a read-only token and no
   secrets, like a pull request from a fork.
7. **Merge.** Squash into `develop`, by hand. Do not push to a Dependabot
   branch; to refresh it, comment `@dependabot rebase` on the PR.

The Rust toolchain is not updated by Dependabot (new `rust` image versions are
ignored; digest refreshes of the current tag still come). To upgrade it, one
`feature/*` PR changes the `rust` image tag and digest, the `rustc --version`
check in the Dockerfile and `RUSTUP_TOOLCHAIN` in `.github/workflows/ci.yml`.
