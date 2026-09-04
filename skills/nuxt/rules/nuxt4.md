---
paths:
  - "{{appDir}}/**/*.vue"
  - "{{appDir}}/**/*.ts"
  - "nuxt.config.ts"
---

# Nuxt 4 conventions

**Invoke the `nuxt-docs` skill before using a composable, a module option or a config key.** Nuxt 4 moved the source root and changed defaults; training-data recall of Nuxt 2/3 APIs is stale, and a wrong-but-plausible signature costs more than the lookup.

## Directory layout

App code lives under the srcDir (`app/` unless `srcDir` says otherwise); Nitro stays at the project root.

```
app/            # srcDir: components, composables, layouts, middleware,
                # pages, plugins, utils, assets, app.vue, app.config.ts
shared/         # types and pure utils imported by BOTH app and server
server/         # Nitro: api/, routes/, middleware/, plugins/, utils/
public/         # served verbatim
nuxt.config.ts
```

- `shared/` is the only place a type may be used by app and server code. Never duplicate a type across the boundary.
- Follow the existing structure instead of inventing new top-level directories.

## Aliases

- `~/`, `@/` → srcDir. `~~/`, `@@/` → project root (use these for `server/` and `shared/`).
- `#imports` for explicit auto-import access, `#components` for components.
- Relative `../..` climbing out of a directory is a smell — use an alias.

## Auto-imports

Do not hand-write imports for: Vue reactivity (`ref`, `computed`, `watch`, lifecycle hooks), Nuxt composables (`useFetch`, `useAsyncData`, `useState`, `useRoute`, `useRuntimeConfig`, `navigateTo`, …), anything under `<srcDir>/composables/` or `<srcDir>/utils/`, and every component under `<srcDir>/components/`.

Component names come from **directory + filename with duplicate segments removed**:

```
components/Thing.vue          → <Thing />
components/chat/Input.vue     → <ChatInput />
components/chat/Message.vue   → <ChatMessage />
```

Name files as if the directory prefix is already there: `chat/Input.vue`, not `chat/ChatInput.vue`. Deduplication makes the redundant form work by accident, and it breaks the moment the directory is plural and the prefix is singular (`agents/AgentCard.vue` → `<AgentsAgentCard>`).

## Components

- `<script setup lang="ts">` everywhere.
- Type props and emits (`defineProps<Props>()`, `defineEmits<{ … }>()`, `withDefaults()` for defaults) — no runtime object syntax, no untyped `emit('x')`.

## Data fetching

- `useFetch` for data a page or component needs to render: it runs during SSR and the result is serialized into the payload, so the client does not re-request it.
- `useAsyncData` when you need the key, `transform`, `watch`, `lazy` or a non-URL source; always pass a stable, unique key.
- `$fetch` only inside event handlers, `onMounted` and other client-only paths. `$fetch` in `setup` fetches twice (server, then client) and skips the payload entirely.
- Handle `status`/`error` explicitly. A component that renders `data.value!` has a blank first paint and a crash path.
- Re-read after a mutation with the `refresh()` returned by the original `useFetch`, not a second fetch.

## Config and secrets

- Read configuration through `useRuntimeConfig()`, never `process.env` in app or handler code: `process.env` is not populated on edge/worker runtimes and bypasses the typed config schema; `runtimeConfig` works on every target.
- Server-only values are top-level in `runtimeConfig`; only what is safe in the browser goes under `public`.
- Every key is overridable by env at runtime as `NUXT_<KEY>` / `NUXT_PUBLIC_<KEY>` — name keys with that in mind.
- Build-time-only tools (a `drizzle.config.ts`, a script) may read `process.env` — they run outside the Nitro runtime.

## Route rules

Per-route rendering and caching is declared once in `nuxt.config.ts`, not scattered through pages:

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': { ssr: true },                          // SEO-critical
    '/dashboard/**': { ssr: false },             // authed app shell — SPA
    '/blog/**': { isr: 3600 },                   // rebuild hourly
    '/api/**': { cors: true }
  }
})
```

Route rules are read at build time: changing one needs a rebuild, not a reload. See `ssr.md` before flipping a route between SSR and SPA.
