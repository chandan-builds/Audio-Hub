import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:10000',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:10000',
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
