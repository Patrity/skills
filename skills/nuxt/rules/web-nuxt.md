---
paths:
  - "{{appDir}}/**/*.ts"
  - "{{appDir}}/**/*.vue"
  - "{{pkgDir}}server/**/*.ts"
  - "{{pkgDir}}nuxt.config.ts"
---

# Nuxt framework conventions

- **Invoke the `nuxt-docs` skill** before using Nuxt composables (`useFetch`, `useAsyncData`, `useState`, `useRuntimeConfig`, `navigateTo`, …), configuring modules, or touching routing / middleware / Nitro server routes. We run **Nuxt 4**; don't guess composable signatures or config keys from memory.
- **Nuxt 4 layout:** app code lives under `{{appDir}}/` (the `srcDir`) — `composables/`, `components/`, `pages/`, `layouts/`, `lib/`, `assets/`. Server/Nitro routes live under `{{pkgDir}}server/`. Follow the existing structure rather than inventing new top-level dirs.
- **Secrets come from `runtimeConfig`** (`useRuntimeConfig()`), never `process.env` directly in app code. Server-only secrets stay off the `public` key.
