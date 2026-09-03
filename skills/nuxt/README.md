---
name: Nuxt
description: Nuxt 4 + Nuxt UI v4 documentation fetchers and the rules that make Claude Code use them instead of stale training data.
tags: [nuxt, nuxt-ui, vue, docs]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3]
---

# Nuxt

Three doc-fetching skills plus two path-scoped rules. The rules fire when Claude touches `.vue`/`.ts` files under `app/` or `nuxt.config.ts` and tell it to consult the skills before guessing a composable signature or a Nuxt UI prop.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/nuxt-docs/` | Fetches Nuxt 4 docs from GitHub by topic (`python3 .claude/skills/nuxt-docs/fetch.py useFetch`). |
| `skills/nuxt-ui-docs/` | Fetches Nuxt UI v4 component docs (`fetch.py Button`, `fetch.py Tree`). |
| `skills/nuxt-ui-templates/` | Pulls real files from the official Nuxt UI templates (dashboard, docs, saas…). |
| `rules/web-nuxt.md` | Nuxt 4 conventions: `app/` layout, runtimeConfig for secrets, invoke `nuxt-docs` first. |
| `rules/web-vue-ui.md` | Nuxt UI v4: `U*` components over raw markup, semantic color tokens only, invoke `nuxt-ui-docs`, validate with playwright-cli. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## Install

```bash
unzip nuxt.zip
mkdir -p .claude
cp -R nuxt/skills nuxt/rules .claude/
cat nuxt/CLAUDE.md >> CLAUDE.md
echo '.claude/skills/*/cache/' >> .gitignore
```

The fetchers cache what they download under `skills/<name>/cache/`, hence the `.gitignore` line. Caches are safe to delete at any time; the next fetch rebuilds them.

## Requirements

- `python3` on PATH (standard library only, no pip installs).
- Network access to `raw.githubusercontent.com` the first time a topic is fetched.

## Notes

The rules mention a `browser-testing` skill for playwright-cli validation. That skill is project-specific (it carries your dev URL and test flow), so create your own; the rule just tells Claude to use it.
