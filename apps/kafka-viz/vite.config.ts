import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/apps/kafka-viz/',
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [path.resolve(__dirname, '../../packages/ui/src')],
      },
    },
  },
});
