## Stack
- Nuxt 4 (`{{appDir}}/` is the srcDir, Nitro under `server/`). Training-data knowledge of Nuxt APIs is stale: check the docs skill first.

## Commands
- `{{pm}} typecheck` and `{{pm}} build` often; both catch what the dev server hides.

## Skills and rules
- Invoke `nuxt-docs` before using a composable (`useFetch`, `useAsyncData`, `useState`, `useRuntimeConfig`, `navigateTo` …), a module option, or a Nitro route helper.
- Rules under `.claude/rules/{web-nuxt,nuxt4,ssr,backend,database,cli}.md` load by path glob; they point back at this skill.

## Constraints that bit before
- Secrets come from `runtimeConfig`, never `process.env` in app code; server-only values stay off the `public` key.
- `@nuxtjs/mdc`: keep `highlight.langs` to a short allow-list (the full Shiki set has OOM'd builds) and set `headings.anchorLinks: false` (Nuxt UI prose hydration bug).
