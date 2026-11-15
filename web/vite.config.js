import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
  define: { __ADMIN_BUILD__: JSON.stringify(mode === 'admin') },
  build: { outDir: mode === 'admin' ? 'dist-admin' : 'dist', emptyOutDir: true },
  test: { environment: 'jsdom', setupFiles: ['./test/setup.js'], globals: true },
}));
