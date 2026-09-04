---
name: Nuxt UI
description: Nuxt UI v4 component docs and template fetchers plus the rule that makes Claude Code check them before touching a .vue file.
tags: [nuxt-ui, vue, ui, docs]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3]
dependsOn: [nuxt]
---

# Nuxt UI

Two doc-fetching skills plus two path-scoped rules. The rules fire when Claude touches a `.vue` file under the app directory and tell it to look up the real v4 API instead of recalling a v2/v3 prop that no longer exists.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/nuxt-ui-docs/` | Fetches Nuxt UI v4 component docs (`python3 .claude/skills/nuxt-ui-docs/fetch.py Button`, `fetch.py Tree`). |
| `skills/nuxt-ui-templates/` | Pulls real files from the official Nuxt UI templates (dashboard, docs, saas, chat…). |
| `rules/web-vue-ui.md` | The entry rule: `U*` components over raw markup, semantic color tokens only, invoke `nuxt-ui-docs` first, validate with playwright-cli. |
| `rules/nuxt-ui.md` | v4 conventions: palette aliases in `app.config.ts`, no `dark:`/`@apply`, icons and forms, the slot-only components (`UDashboard*`, `UPageCard`, `UTree`). |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## Placeholders

The rule globs contain an `{{appDir}}` placeholder that the setup CLI renders from your answers. Installing by hand? Replace it with your srcDir — `app` in a standard Nuxt 4 project.

## Install

```bash
unzip nuxt-ui.zip
mkdir -p .claude
cp -R nuxt-ui/skills nuxt-ui/rules .claude/
cat nuxt-ui/CLAUDE.md >> CLAUDE.md
echo '.claude/skills/*/cache/' >> .gitignore
```

The fetchers cache what they download under `skills/<name>/cache/`, hence the `.gitignore` line. Caches are safe to delete at any time; the next fetch rebuilds them.

## Requirements

- `python3` on PATH (standard library only, no pip installs).
- Network access to `raw.githubusercontent.com` the first time a component or template is fetched.

## Companion bundles

- **[`nuxt`](/skill/nuxt)** — the Nuxt 4 framework docs fetcher and its rule. Install both if the project is Nuxt + Nuxt UI.
- **[`browser-testing`](/skill/browser-testing)** — the playwright-cli workflow `rules/web-vue-ui.md` points at.
