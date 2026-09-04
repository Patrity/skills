---
paths:
  - "{{pkgDir}}server/**/*.ts"
---

# Nitro server routes

Everything below is relative to the package root (`{{pkgDir}}`), which is the project root unless
the app lives in a sub-package.

**Invoke the `nuxt-docs` skill** before reaching for an h3 helper or a Nitro config key you have not used in this codebase — the h3 surface changed across major versions.

## Layout

```
server/
├── api/         # /api/* handlers, auto-registered by file path
├── routes/      # non-/api routes (webhooks, sockets, feeds)
├── middleware/  # runs on every request
├── plugins/     # startup hooks (config validation, warmup)
└── utils/       # auto-imported server helpers
```

- File name encodes the method: `thing.get.ts`, `thing.post.ts`, `[id].delete.ts`. One handler per method — never branch on `event.method` inside a catch-all.
- `server/routes/` takes precedence over pages. A socket or webhook route sharing a name with a page silently shadows it; give it a distinct prefix (`server/routes/_ws/chat.ts` → `/_ws/chat`).
- Import server code through `~~/server/…` and shared types through `~~/shared/types`, not relative `../..` chains.

## Handler shape

```ts
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, bodySchema.parse)
  // …
  return { data: result }
})
```

- Validate every input at the top of the handler with a zod schema and `readValidatedBody` / `getValidatedQuery` / `getValidatedRouterParams`. Never trust `readBody` output straight into a query.
- Return the payload directly (a plain serializable object). Pick one envelope shape across the API and keep it.
- Fail with `createError({ statusCode, message })`. `statusMessage`/`message` reaches the client, so keep it a description of what the caller did wrong.
- 4xx is the caller's fault, 5xx is yours. Never answer a bad request with 200 and an `{ error }` body.

## Secrets and config

- `useRuntimeConfig(event)` only — `process.env` is not populated on edge/worker runtimes and bypasses the typed config schema; `runtimeConfig` works on every target.
- Validate required config once in a startup plugin so a missing value fails at boot, not on the first user request.
- Anything created from runtime config (db client, auth instance, SDK client) is a **lazy singleton**, never a module-level constant:

```ts
let _client: Client | null = null
export function getClient() {
  if (!_client) _client = createClient(useRuntimeConfig().someUrl)
  return _client
}
```

Module-level initialization runs at import time, before runtime config exists.

## Auth

- One middleware is the single source of truth for which paths require a session; it resolves the session once and puts it on `event.context`.
- Prefer default-public with an explicit protected list over a public allowlist: modules add `/api/*` routes of their own, and an allowlist turns those into silent 401s in production.
- Defense in depth anyway: a protected handler still checks `if (!event.context.user) throw createError({ statusCode: 401 })`. A missed list entry then surfaces as a redundant 401 instead of a data leak.
- Authorization is per-resource. "Has a session" is not "owns this row" — check ownership or role in the handler.

## Errors and logging

- Log the cause server-side; return a generic message for 5xx. Stack traces, SQL and upstream bodies never reach the client.
- No silent `catch {}`. If a failure is genuinely ignorable, log it and say why in a comment.
