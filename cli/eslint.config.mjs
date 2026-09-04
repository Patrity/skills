// @ts-check
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'

// A minimal, self-contained flat config for a plain TypeScript package. Deliberately does not
// import ../.nuxt/eslint.config.mjs: that file only exists after `nuxt prepare` has run, couples
// this lint to Nuxt's auto-import globals, and cli/ has neither. `typescript-eslint`'s recommended
// rules plus `@stylistic`'s customize() reproduce the same quotes/semi/indent/comma-dangle style
// the root config applies, without depending on the root app at all.
export default tseslint.config(
  { ignores: ['dist/**'] },
  ...tseslint.configs.recommended,
  stylistic.configs.customize({
    quotes: 'single',
    semi: false,
    indent: 2,
    commaDangle: 'never',
    braceStyle: '1tbs'
  }),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
)
