import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/web',
  server: {
    port: 3456,
    open: '/viewer3d.html'
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true
  }
});
