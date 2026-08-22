import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' mantém os assets relativos ao index.html — desacopla do path de deploy
// (o path final /apps/ohara/front/ vira problema do compose:pages, não do build).
export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
