import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  // shared/setup is bundled in; the three runtime deps stay external.
  noExternal: [/^\.\.\/shared\//]
})
