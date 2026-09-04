---
name: Nuxt
description: Nuxt 4 framework docs fetcher and the rule that makes Claude Code check it before guessing a composable.
tags: [nuxt, vue, docs]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3]
suggests: [nuxt-ui, browser-testing]
gitignore: [".claude/skills/nuxt-docs/cache/"]
---

# Nuxt

One doc-fetching skill plus six path-scoped rules. The rules fire when Claude touches `.ts`/`.vue` files under the app directory, anything under `server/`, or `nuxt.config.ts`, and tell it to consult the docs before guessing a composable signature or a config key.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/nuxt-docs/` | Fetches Nuxt 4 docs from GitHub by topic (`python3 .claude/skills/nuxt-docs/fetch.py useFetch`). |
| `rules/web-nuxt.md` | The entry rule: invoke `nuxt-docs` first, Nuxt 4 layout, `runtimeConfig` for secrets. |
| `rules/nuxt4.md` | Directory layout, aliases, auto-imports and component naming, `useFetch`/`useAsyncData` discipline, route rules. |
| `rules/ssr.md` | SSR vs SPA, auth during SSR, hydration pitfalls, `.client.vue`/`.server.vue`, payload and prerender rules. |
| `rules/backend.md` | Nitro routes: file-per-method, zod validation, `createError` shape, lazy singletons, no `process.env` in handlers. |
| `rules/database.md` | Drizzle + Postgres: generated migrations applied from CI, read-only roles for exploration, nothing destructive against prod. |
| `rules/cli.md` | Scripts under `scripts/` run through `tsx`: explicit env loading, exit codes, dry-run before anything destructive. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## Placeholders

The rule globs and the `CLAUDE.md` snippet contain `{{appDir}}` and `{{pm}}`/`{{pmx}}` placeholders. The setup CLI renders them from your answers. Installing by hand? Replace `{{appDir}}` with your srcDir (`app` in a standard Nuxt 4 project) and `{{pm}}`/`{{pmx}}` with your package manager (`pnpm`/`pnpx`).

## Install

```bash
unzip nuxt.zip
mkdir -p .claude
cp -R nuxt/skills nuxt/rules .claude/
cat nuxt/CLAUDE.md >> CLAUDE.md
echo '.claude/skills/*/cache/' >> .gitignore
```

The fetcher caches what it downloads under `skills/nuxt-docs/cache/`, hence the `.gitignore` line. Caches are safe to delete at any time; the next fetch rebuilds them.

## Requirements

- `python3` on PATH (standard library only, no pip installs).
- Network access to `raw.githubusercontent.com` the first time a topic is fetched.

## Companion bundles

- **[`nuxt-ui`](/skill/nuxt-ui)** — the Nuxt UI v4 component and template fetchers plus their rule. Install it alongside this one when the project uses Nuxt UI.
- **[`browser-testing`](/skill/browser-testing)** — proving UI changes in a real browser with playwright-cli.
