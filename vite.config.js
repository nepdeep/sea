import { defineConfig } from 'vite';

// The whole game lives in index.html; this only tunes the build output.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 800 },
});
