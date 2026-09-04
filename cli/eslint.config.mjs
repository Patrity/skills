// @ts-check
// cli/ has no eslint of its own (see root CLAUDE.md: pnpm only, no extra deps beyond the
// brief). It reuses the eslint + typescript-eslint + stylistic setup that `nuxt prepare`
// already resolves for the root app (../.nuxt/eslint.config.mjs uses relative paths into
// the pnpm store, so this works without hoisting anything into cli/node_modules).
import withNuxt from '../.nuxt/eslint.config.mjs'

export default withNuxt({
  ignores: ['dist/**']
})
