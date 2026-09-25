import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['localhost', '127.0.0.1', 'agri-nest-production.up.railway.app', '.up.railway.app'],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['localhost', '127.0.0.1', 'agri-nest-production.up.railway.app', '.up.railway.app'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
