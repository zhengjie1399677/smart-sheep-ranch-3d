import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples/jsm')) {
            return 'three-addons';
          }
          if (id.includes('node_modules/three')) {
            return 'three-core';
          }
        },
      },
    },
  },
});

