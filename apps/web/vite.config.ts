import { URL, fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) },
      {
        find: /^@carwash\/shared$/,
        replacement: fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
      },
      {
        find: /^@carwash\/shared\//,
        replacement: fileURLToPath(new URL('../../packages/shared/src/', import.meta.url)),
      },
      {
        find: /^@carwash\/api$/,
        replacement: fileURLToPath(new URL('../api/src/app.ts', import.meta.url)),
      },
      {
        find: /^@carwash\/api\//,
        replacement: fileURLToPath(new URL('../api/src/', import.meta.url)),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['@carwash/shared'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:3212',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
