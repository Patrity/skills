import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Plain vitest never boots Nuxt, so value-level `~~/…` imports need these aliases.
// Type-only imports are erased before resolution and work without them.
export default defineConfig({
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url))
    }
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**', '**/.claude/**'],
    testTimeout: 30_000,
    passWithNoTests: true
  }
})
