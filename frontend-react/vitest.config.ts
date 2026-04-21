import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    testTimeout: 15000,
    coverage: {
      reporter: ['text', 'lcov'],
      exclude: ['node_modules/', 'src/test-setup.ts', 'src/mocks/'],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
