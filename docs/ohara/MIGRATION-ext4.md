# Ohara — Migração do dev p/ ext4 (sair do NTFS)

**Por quê:** NTFS (`/mnt/BACKUP`) quebra symlink/permissão/case dos workspaces; Node 25 é ímpar
(não-LTS); o PnP (`.pnp.cjs`) briga com o tooling do Angular. **O CI já roda certo** (Node 20 +
node_modules) — o alvo é o **local espelhar o CI**.

## 1. Node 20 via nvm

```bash
# instalar nvm — pegue o comando/versão atual em github.com/nvm-sh/nvm
# depois, reabrir o shell e:
nvm install 20
nvm use 20
node -v            # v20.x  (nada de 25)
```

Opcional: criar `.nvmrc` com `20` na raiz p/ fixar por projeto.

## 2. Salvar no NTFS e clonar no ext4

```bash
# na cópia NTFS — garantir tudo no origin
cd /mnt/BACKUP/BACKUP/Estudos/projects/github-portfolio-projects/jpfigueredo.github.io
git push --force-with-lease                 # branch feat/ohara-rebrand (por causa do --amend)
git checkout main && git push               # se houver algo pendente no main

# clonar limpo no ext4 (destino já existe)
cd ~/projetos/portfolio
git clone git@github.com:jpfigueredo/jpfigueredo.github.io.git
cd jpfigueredo.github.io
git checkout feat/ohara-rebrand
```

## 3. Modo de módulos: classic node_modules (não PnP)

O CI usa `yarn install` clássico + `npm install` no angular. O local deve espelhar:

```bash
# se os artefatos PnP forçarem PnP e quebrarem o Angular, remova-os:
rm -f .pnp.cjs .pnp.loader.mjs
yarn install                                # workspaces já resolvem (fix 0.1.0); node_modules ok em ext4
```

**Decisão a formalizar (ADR): node_modules × PnP.** Recomendação: **node_modules** (espelha o CI, não
quebra o Angular). Adotar PnP de verdade exigiria Yarn Berry + plugins padronizados.

## 4. Build

```bash
yarn build                                  # web / sw-timeline / kafka-viz devem passar
cd apps/angular-demo && npm install && yarn build   # angular precisa do npm install próprio (como no CI)
```

## 5. Rodar local

```bash
yarn start:dev                              # turbo dev --parallel
# ou: yarn start:fast  (build + compose:pages + serve em :3000)
```

## Depois

- Scaffoldar `apps/ohara/{front,api,bff,service}`.
- Root `package.json` workspaces: adicionar `apps/*/*` (mantendo `apps/*`).
- Migrar dados de trilha de `web/src/data/ohara/` p/ dentro de `apps/ohara/`.
