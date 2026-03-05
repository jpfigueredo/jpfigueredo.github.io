# New App – Scaffold de app React no monorepo

Crie um novo app React + Vite no monorepo `jpfigueredo.github.io` seguindo o padrão estabelecido.

## Parâmetros necessários

Ao usar este comando, informe:
- **Nome do app**: ex. `kafka-viz`, `angular-demo`, `data-explorer`
- **Descrição**: o que o app faz em 1 frase
- **Base path**: ex. `/apps/kafka-viz/`

## Estrutura padrão a criar

```
apps/<nome>/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── components/
    └── styles/
        └── app.scss
```

## package.json padrão

```json
{
  "name": "@jpfig/<nome>",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@jpfig/ui": "*",
    "@jpfig/config": "*"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  }
}
```

## vite.config.ts padrão

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/apps/<nome>/',
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [path.resolve(__dirname, '../../packages/ui/src')],
      },
    },
  },
});
```

## Após criar os arquivos

1. Adicionar entrada no `packages/config/src/index.ts`:
```typescript
<nome>: {
  basePath: '/apps/<nome>/',
  iframeSrcProd: 'https://jpfigueredo.github.io/apps/<nome>/index.html',
},
```

2. Adicionar rota em `web/src/main.tsx` (rota + nav item + card na Home)

3. Adicionar i18n keys em `web/src/i18n/locales/pt.json` e `en.json`

4. Rodar `yarn install` na raiz para registrar o novo workspace

## Design System

Sempre iniciar o SCSS do app com:
```scss
@use 'tokens' as ds;
```

Usar componentes de `@jpfig/ui`: `PageContainer`, `NeonText`, `Button`, `Badge`, `Card`.
