/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // globals is required for Testing Library's afterEach auto-cleanup;
    // without it, rendered components leak across tests.
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
