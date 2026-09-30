import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/shiptrack-api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/shiptrack-api/, ''),
      },
      // Development-only same-origin bridge to the Muditam app backend.
      // Production continues to use its deployment-provided API URLs.
      '/muditam-app-api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/muditam-app-api/, ''),
      },
    },
  },
});
