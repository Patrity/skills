// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

// cli/ is its own pnpm workspace package (see cli/eslint.config.mjs) and lints via
// `pnpm --filter @patrity/skills lint`, not the root `pnpm lint`.
export default withNuxt({
  ignores: ['cli/**']
})
