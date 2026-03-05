import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/apps/sw-timeline/',
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // Permite @use 'tokens' as ds; em qualquer SCSS do app
        loadPaths: [path.resolve(__dirname, '../../packages/ui/src')],
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});

