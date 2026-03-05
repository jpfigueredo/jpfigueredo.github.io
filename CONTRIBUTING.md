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
| `ci` | GitHub Actions workflows |
| `chore` | Tooling, config, lockfile, deps |

### Scopes

Scopes map to packages/apps in the monorepo:

| Scope | Path |
|---|---|
| `web` | `web/` |
| `sw-timeline` | `apps/sw-timeline/` |
| `kafka-viz` | `apps/kafka-viz/` |
| `angular-demo` | `apps/angular-demo/` |
| `doom64` | `apps/doom64-wasm/` |
| `ui` | `packages/ui/` |
| `config` | `packages/config/` |
| `bff-api` | `services/bff-api/` |
| `rust-api` | `services/rust-api/` |
| `edge-proxy` | `services/edge-proxy/` |
| `workspace` | Root monorepo config (`package.json`, `turbo.json`, `yarn.lock`) |

Omit scope only for cross-cutting changes that don't fit a single package.

### Examples

```
feat(sw-timeline): add macintosh-1984 and java-1995 events with marxist analysis

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

### Releases

Tags follow semver with a pre-release label: `v1.0.0-beta.1`, `v1.0.0-beta.2`, `v1.0.0`.

A push of a tag matching `v*` triggers the GitHub Pages deploy workflow automatically.

```bash
git tag v1.0.0-beta.2
git push origin v1.0.0-beta.2
```
