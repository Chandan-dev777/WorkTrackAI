import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward every real API path to the FastAPI backend.
      // React code calls /auth/..., /updates/..., etc. — same URLs in dev and prod.
      '/auth':      { target: 'http://localhost:8000', changeOrigin: true },
      '/updates':   { target: 'http://localhost:8000', changeOrigin: true },
      '/worklogs':  { target: 'http://localhost:8000', changeOrigin: true },
      '/dashboard': { target: 'http://localhost:8000', changeOrigin: true },
      '/chat':      { target: 'http://localhost:8000', changeOrigin: true },
      '/admin':     { target: 'http://localhost:8000', changeOrigin: true },
      '/assistant': { target: 'http://localhost:8000', changeOrigin: true },
      '/health':    { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
