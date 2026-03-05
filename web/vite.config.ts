import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';

export default defineConfig({
  base: '/',
  plugins: [mdx(), react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Three.js into its own chunk (largest dependency)
          'three': ['three'],
          // Separate Three.js examples (post-processing, etc.)
          'three-addons': [
            'three/examples/jsm/postprocessing/EffectComposer.js',
            'three/examples/jsm/postprocessing/RenderPass.js',
            'three/examples/jsm/postprocessing/UnrealBloomPass.js',
            'three/examples/jsm/postprocessing/OutputPass.js',
          ],
          // React and React DOM (core framework)
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // Increase chunk size warning limit (Three.js is inherently large)
    chunkSizeWarningLimit: 1000,
  },
});
