import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// In local development the Vite server proxies /api to the backend, so the
// browser always talks to a single origin (the same shape as the Nginx setup
// used in Docker) and no CORS configuration is needed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'RECONCILE_');
  const backend = env.RECONCILE_BACKEND_URL ?? 'http://127.0.0.1:8001';
  const proxy = { '/api': { target: backend, changeOrigin: false } };

  return {
    plugins: [react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy },
    preview: { host: '127.0.0.1', port: 4174, proxy },
    test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], restoreMocks: true },
  };
});
