## Nuxt

- Nuxt **4**. Invoke the `nuxt-docs` skill before using a Nuxt composable (`useFetch`, `useAsyncData`, `useState`, `navigateTo`, …), configuring a module, or touching routing / middleware / Nitro routes — training-data knowledge of these APIs is stale.
- App code lives under `app/` (the `srcDir`); server routes under `server/`. Secrets come from `runtimeConfig`, never `process.env` in app code.
- `.claude/rules/web-nuxt.md` loads automatically when editing `app/**`, `server/**` or `nuxt.config.ts`; follow it.
- Always `pnpm`.
