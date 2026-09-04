---
paths:
  - "{{appDir}}/pages/**/*.vue"
  - "{{appDir}}/components/**/*.vue"
  - "{{appDir}}/composables/**/*.ts"
  - "nuxt.config.ts"
---

# SSR and hydration

Check `routeRules` in `nuxt.config.ts` before assuming how a page renders. These rules apply to anything reachable with `ssr: true`.

## Choosing SSR or SPA

- `ssr: true` for anything a crawler or a link preview must see: landing, marketing, docs, public profiles, shared content. `useSeoMeta` only produces real tags during SSR.
- `ssr: false` for the authenticated app shell, real-time pages holding a socket, and pages whose libraries touch `window`/`document` at import time.
- Do not pay for SSR on a page that renders nothing until auth resolves — that is a SPA route with extra latency.

## Auth is not reliable during SSR

The server render usually has no resolved session: cookies do not always survive the internal server-to-server request, and an endpoint that skips auth middleware sees no user at all. Anything the API returns that depends on "who is asking" (`canEdit`, `isOwner`, `role`) can be `false` during SSR — and Nuxt caches that payload for the client, which then never re-fetches.

```vue
<script setup lang="ts">
const { user } = useAuth()
const { data } = await useFetch('/api/resource')

// WRONG — resolved on the server, frozen into the payload as false
const canEdit = computed(() => data.value?.canEdit === true)

// CORRECT — derive from client-side auth state and the fetched data
const canEdit = computed(() => !!user.value && user.value.id === data.value?.authorId)
</script>
```

## Render the unauthenticated state as the SSR default

Auth resolves after hydration. Wrapping visible chrome (headers, navbars) in `<ClientOnly>` leaves a hole that flashes when content lands. Render the signed-out state on the server and let Vue patch it — a swap, not a pop-in.

```vue
<!-- WRONG: empty gap during SSR -->
<ClientOnly><UserMenu v-if="isAuthenticated" /><UButton v-else to="/login">Sign in</UButton></ClientOnly>

<!-- CORRECT: signed-out is the safe default, client swaps it -->
<UserMenu v-if="isAuthenticated" />
<UButton v-else to="/login">Sign in</UButton>
```

Reserve `<ClientOnly>` for elements that are purely additive and have no SSR equivalent (an edit affordance, a browser-API widget) — nothing that reserves layout.

`<ClientOnly>` stops rendering, **not** module evaluation. A library that touches browser globals at import time still explodes; that needs a `.client.vue` component.

## `.client.vue` / `.server.vue`

```
components/chart/
├── Cost.client.vue    # browser-only implementation
├── Cost.server.vue    # SSR placeholder / skeleton
└── Legend.vue         # ordinary isomorphic component
```

The suffix is **stripped from the component name** — write `<ChartCost />`, never `<ChartCostClient />`. When both variants exist Nuxt renders the `.server.vue` one and hydrates with the `.client.vue` one.

## Payload discipline

Everything returned from `useFetch`/`useAsyncData` and everything in `useState` is serialized into the HTML payload and read back on the client.

- Keep it plain and serializable: no class instances, functions, `Symbol`s or live DB handles. Return DTOs from handlers.
- Keep it small — the payload ships on every request; do not stuff a whole result set in to save one round trip.
- Never put a secret or a full user record in `useState`: the payload is world-readable page source.
- Any value that must differ between server and client (`Date.now()`, `Math.random()`, `localStorage`) produces a hydration mismatch. Compute it in `onMounted`.

## Navigation and mutations

- `navigateTo()`, not `router.push()` — it works in both rendering contexts and in middleware.
- Mutations (`POST`/`PUT`/`DELETE`) use `$fetch` from an event handler, then `refresh()`.

## Prerendering

Pages whose content changes after the build must be excluded from prerendering, or the built HTML freezes stale data:

```ts
nitro: { prerender: { crawlLinks: true, ignore: ['/dashboard'] } }
```

Nitro's `ignore` matches with `startsWith()`, **not** globs. `'/dashboard'` works; `'/dashboard/**'` silently matches nothing.
