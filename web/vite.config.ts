import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';

// react-router 7 só exporta o build de desenvolvimento (dist/development): sem
// isto o site publicado mostra o aviso "Hey developer" e loga no console na
// página de erro/404. O build de produção vem no mesmo pacote (dist/production);
// o modo Framework e a v8 já resolvem para ele. Só no `vite build`: o servidor
// de dev continua com os avisos.
const reactRouterProd = path.join(
  path.dirname(createRequire(import.meta.url).resolve('react-router/package.json')),
  'dist/production',
);

export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [mdx(), react()],
  resolve: {
    alias:
      command === 'build'
        ? [
            { find: /^react-router$/, replacement: path.join(reactRouterProd, 'index.mjs') },
            { find: /^react-router\/dom$/, replacement: path.join(reactRouterProd, 'dom-export.mjs') },
          ]
        : [],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // React and React DOM (core framework)
          'react-vendor': ['react', 'react-dom', 'react-router'],
        },
      },
    },
  },
}));
