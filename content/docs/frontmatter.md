# Frontmatter reference

The YAML block at the top of `README.md` is the bundle's metadata. GitHub renders it as a table, and the site validates it on every load.

```yaml
---
name: Nuxt
description: Nuxt 4 + Nuxt UI v4 doc fetchers and the rules that make Claude use them.
tags: [nuxt, nuxt-ui, vue, docs]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3]
---
```

| Key | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Display name. The slug (directory name) stays the identifier. |
| `description` | string | yes | One or two sentences. Used on cards and in `<meta>` tags. |
| `tags` | string[] | yes | Lowercase. At least one. Drives the filter chips on the index. |
| `author` | string | yes | A person or org name. |
| `authorUrl` | URL | no | Where the author name links to. |
| `requires` | string[] | no | External tooling the bundle needs, e.g. `python3`, `playwright-cli`. |

## Validation

A bundle with a missing README, a missing required key, or a bad slug is:

- **shown with a warning** when the site reads from disk (local development), so you can see exactly what is wrong;
- **hidden** in production;
- **rejected by CI** — `pnpm validate:skills` fails the pull request with the same messages the site shows.

Messages look like `frontmatter.tags: required` or `slug "Bad_Slug" must match /^[a-z0-9][a-z0-9-]*$/`.

## Derived metadata

You never write these; the site computes them from the files:

- **badges** — which of `skills/`, `rules/`, `hooks/`, `settings.local.json`, `CLAUDE.md` exist
- **file count** and **total size**
- **freshness** — the commit that the whole snapshot was read from
