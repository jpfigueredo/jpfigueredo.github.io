# Git & CI/CD – Convenções

## Branches

- `main` → produção (GitHub Pages)
- `feat/<nome>` → novas features
- `fix/<nome>` → bugfixes
- `refactor/<nome>` → refatorações sem mudança de comportamento
- `chore/<nome>` → infra, config, deps

## Commit messages (Conventional Commits)

```
feat(sw-timeline): conectar filtros ao estado global
fix(web): remover console.log de handleToggleGalaxies
refactor(ui): extrair tokens.scss com escala 8pt
chore(ci): adicionar gate de deploy por tag v*
docs(claude): criar CLAUDE.md com convenções do monorepo
```

Formato: `<tipo>(<escopo>): <descrição curta em lowercase>`

Escopos válidos: `web`, `sw-timeline`, `kafka-viz`, `ui`, `config`, `ci`, `root`

## Tags de release

```bash
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1
```

O workflow `pages.yml` faz deploy automático em push no `main`.
Tags são usadas para marcar releases estáveis.

## CI/CD – GitHub Actions

Arquivo: `.github/workflows/pages.yml`

Processo no push em `main`:
1. `yarn install --frozen-lockfile`
2. `yarn build` (turbo run build)
3. Copia `web/dist/*` → `.pages/`
4. Copia `apps/*/dist` → `.pages/apps/<nome>/`
5. Deploy via `actions/deploy-pages@v4`

**Outros workflows:**
- `rust-api.yml` – CI do serviço Rust
- `edge-proxy.yml` – CI do edge proxy
- `links.yml` – verificação de links externos

## Verificação antes de commitar

```bash
yarn typecheck   # sem erros de TS
yarn lint        # sem warnings críticos
yarn build       # build completo com sucesso
```
