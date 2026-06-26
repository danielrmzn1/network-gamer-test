import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Standalone config so tests don't pull in the React/build plugin. The @shared
// alias must mirror vite.config.ts so '@shared/*' resolves to ../shared/*.
export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
