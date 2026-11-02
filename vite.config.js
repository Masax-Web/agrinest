import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/',
  server: {
    host: '0.0.0.0',
    port: 3001,
    allowedHosts: ['localhost', '127.0.0.1', 'agri-nest-production.up.railway.app', '.up.railway.app'],
    proxy: Object.fromEntries([
      '/auth', '/users', '/farms', '/fields', '/jicho', '/soko', '/community', '/students', '/communications', '/security',
    ].map((route) => [route, 'http://localhost:3000'])),
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
