import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages: Change this to your repository name
  // Example: base: "/auto-invaders/"
  // GitHub Pages: Change this to your repository name
  // Example: base: "/auto-invaders/"
  base: "/",

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
  },

  server: {
    port: 3000,
    open: true,
  },
});
