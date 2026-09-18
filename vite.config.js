import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // proxy /api ke Vercel dev function kalau pakai `vercel dev`,
    // atau ke backend lokal lain
    proxy: {
      '/api': {
        target: process.env.API_DEV_TARGET || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});
