# CLAUDE.md – jpfigueredo.github.io monorepo

## Visão geral

Monorepo do portfólio de João Figueredo. Hospedado no **GitHub Pages**.
CI/CD via **GitHub Actions** (`.github/workflows/pages.yml`).

Estrutura:
```
web/               → SPA principal (React + Tailwind + Three.js)
apps/sw-timeline/  → App de linha do tempo (React + SCSS + Design System)
apps/kafka-viz/    → (planejado) Visualização animada de Kafka
packages/ui/       → Design System (@jpfig/ui)
packages/config/   → Config centralizada (@jpfig/config)
services/*         → Backends (Rust, Go, BFF)
```

## Comandos essenciais

```bash
yarn install          # instala todas as dependências
yarn build            # turbo run build (todos os packages)
yarn start:dev        # turbo run dev --parallel
yarn start:fast       # build → compose:pages → serve local em :3000
yarn typecheck        # turbo run typecheck
yarn lint             # turbo run lint
```

**Para rodar apenas um app:**
```bash
cd apps/sw-timeline && yarn dev
cd web && yarn dev
```

## Package manager e workspace

- **Yarn 1.22** com workspaces
- **Turborepo** para pipeline de build
- `pnpm-workspace.yaml` NÃO existe; usar `package.json#workspaces`

## Design System (`packages/ui`)

Tokens em `packages/ui/src/tokens.scss` e `tokens.css`.

Para usar SCSS tokens em qualquer app, configurar no `vite.config.ts`:
```ts
css: {
  preprocessorOptions: {
    scss: {
      loadPaths: [path.resolve(__dirname, '../../packages/ui/src')],
    },
  },
},
```

Nos arquivos SCSS: `@use 'tokens' as ds;` → `color: ds.$color-neon;`

Componentes exportados de `@jpfig/ui`: `PageContainer`, `NeonText`, `Button`, `Badge`, `Card`.

## Convenções de código

### TypeScript / React
- React 18, TypeScript estrito
- Componentes como `React.FC<Props>` com props tipadas explicitamente
- Sem `any` explícito — usar tipos adequados ou `unknown`
- Imports de type: `import type { Foo } from '...'`
- Hooks customizados em `hooks/`, sempre prefixados com `use`

### SCSS / Design System
- Sempre usar tokens: `@use 'tokens' as ds;` → `ds.$color-neon`
- BEM para classes: `.sw-axis__event-dot--selected`
- Sem valores hardcoded de cor, espaçamento ou transição — usar tokens
- Arquivos: `layout.scss`, `timeline.scss`, `animations.scss`

### Git

Ver `CONTRIBUTING.md` para convenções completas de commit.

- Branch principal: `main`
- Tags de release: `v1.0.0-beta.1`, `v1.0.0-beta.2`, etc.
- Commits: Conventional Commits com escopo do pacote — `feat(web):`, `fix(sw-timeline):`, `ci:`, etc.
- Deploy automático em push no `main` ou tag `v*`

## CI/CD (GitHub Actions)

Arquivo: `.github/workflows/pages.yml`
- Trigger: push em `main` ou `workflow_dispatch`
- Processo: `yarn install` → `yarn build` → compõe `.pages/` → deploy
- `web/dist/*` vai para raiz do Pages
- `apps/*/dist/` vai para `.pages/apps/<nome>/`

## Configuração central (`packages/config`)

```ts
import { version, apps, api, features } from '@jpfig/config';

apps.swTimeline.iframeSrcProd  // URL produção do iframe
apps.swTimeline.basePath       // /apps/sw-timeline/
features.swTimelineAnalysis         // feature flag
```

## Observações importantes

- **Não usar `pnpm`** — o projeto usa Yarn 1.x
- **Não modificar `yarn.lock`** manualmente
- O `web/` usa **Tailwind CSS** com classes utilitárias; os apps usam **SCSS + tokens**
- `apps/doom64-wasm/` existe mas é projeto separado (WASM), não mexer sem contexto
- O `transition: all 0.2s` global no `web/src/index.css` é intencional (pode ser refinado)

## Ohara (projeto ativo) — ver `docs/ohara/00-brief.md`

O `apps/sw-timeline` está sendo **substituído** pelo **Ohara**: leitor de **trilhas de leitura**
sobre **fontes primárias** (grafo de citações = DAG). Dois modos:
- **Público** (web, ads+afiliado): só **fontes livres/públicas** + preview **Google Books**. Barato e legalmente limpo.
- **Local** (máquina do JP): + **acervo** (`library.db`) + **audiobook** (piper) + **injeção de definição**. Acervo **nunca** no público.

**Estrutura**: `/apps` é o guarda-chuva de todos os projetos do portfólio; **Ohara é um projeto
próprio** (não um app único) em `apps/ohara/`, com suas camadas dentro:

```text
apps/ohara/
├── front/     → React + TS (UI da trilha)
├── api/       → API pública (trilha, verificador de fontes, proxy Google Books)
├── bff/       → backend-for-frontend
└── service/   → pipeline pesado LOCAL (OCR, narração/piper, injeção, library.db)
```

Isso exige o glob de workspaces do root virar **`apps/*/*`** (além de `apps/*`). Os dados de trilha
migram de `web/src/data/ohara/` para dentro de `apps/ohara/` quando o app for scaffoldado.
Estética: biblioteca **Ohara/Elbaf** (madeira/pergaminho/folhagem/coruja) — pele quente sobre
estrutura simples. Design tokens a migrar em `packages/ui` (neon → Ohara). Versões `0.1.0` até
produção (só então `1.0.0`).

### Modo de trabalho (acordos)
- **Materialista / baseado em evidência**: toda afirmação técnica ancorada em comando, dado ou fonte.
  Rotular procedência: `[LIVRO]` · `[MODELO]` · `[MAQUINA]` · `[LACUNA]`.
- **Proibido inventar**: URL de fonte, aresta de citação ou dado sem verificação **não** entra como
  fato. Arestas do grafo têm procedência (`citada` / `curada` / `inferida`).
- **Fato × interpretação separados** (ADR-0003): dado fiel e camada de análise nunca no mesmo campo/tabela.
- **Commits**: Conventional Commits, escopo por pacote, **sem assinatura / co-author** (nem Claude
  nem ferramenta).
- **Branches**: `feat/ohara-*` curtas → squash-merge no `main` (que é sempre deployável, pois o
  Pages publica dele).
- **Precisão > velocidade** neste projeto (é estudo): iniciar certo e consistente.
- **Registro contínuo**: atualizar `docs/ohara/WORKLOG.md` a cada troca/sessão (decisões +
  mudanças). Documentar sempre; nada relevante fica só no chat.
- **DoR / DoD**: toda tarefa segue `docs/ohara/DOD-DOR.md` — não começa sem DoR, não fecha sem DoD.

