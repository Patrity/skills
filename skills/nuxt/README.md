---
name: Nuxt
description: Nuxt 4 framework docs fetcher and the rule that makes Claude Code check it before guessing a composable.
tags: [nuxt, vue, docs]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3]
---

# Nuxt

One doc-fetching skill plus one path-scoped rule. The rule fires when Claude touches `.ts`/`.vue` files under `app/`, anything under `server/`, or `nuxt.config.ts`, and tells it to consult the docs before guessing a composable signature or a config key.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/nuxt-docs/` | Fetches Nuxt 4 docs from GitHub by topic (`python3 .claude/skills/nuxt-docs/fetch.py useFetch`). |
| `rules/web-nuxt.md` | Nuxt 4 conventions: `app/` layout, `runtimeConfig` for secrets, invoke `nuxt-docs` first. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

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
