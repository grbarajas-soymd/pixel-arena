import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pixel-arena/',
  root: '.',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    open: true,
  },
});
