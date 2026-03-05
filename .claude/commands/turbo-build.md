# Turbo Build – jpfigueredo.github.io

Execute o build completo do monorepo e reporte qualquer erro encontrado.

## Contexto

Este é um monorepo com **Yarn 1.22 + Turborepo**. A pipeline de build é:

```
packages/config → packages/ui → apps/* e web/
```

## Comandos

```bash
# Build completo (todos os packages na ordem correta)
yarn build

# Typecheck sem compilar
yarn typecheck

# Lint
yarn lint

# Build + serve local para preview
yarn start:fast

# Apenas um app
cd apps/sw-timeline && yarn dev
cd apps/kafka-viz && yarn dev
cd web && yarn dev
```

## O que verificar após o build

1. **Zero erros TypeScript** — `yarn typecheck` deve completar limpo
2. **Zero warnings de lint críticos** — `yarn lint`
3. **Todos os dist/** existem:
   - `web/dist/`
   - `apps/sw-timeline/dist/`
   - `apps/kafka-viz/dist/` (quando existir)
   - `apps/angular-demo/dist/` (quando existir)
4. **SCSS tokens resolvidos** — se houver `Error: Can't find stylesheet 'tokens'`, verifique o `vite.config.ts` do app afetado — deve ter `css.preprocessorOptions.scss.loadPaths: [path.resolve(__dirname, '../../packages/ui/src')]`

## Estrutura da pipeline Turbo

```json
// turbo.json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

Se encontrar erro, inclua o stack trace completo e o arquivo afetado na sua resposta.
