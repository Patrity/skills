---
name: Doc Fetcher
description: A generator for per-library documentation skills — configure a template and Claude Code fetches a library's real docs from GitHub instead of recalling them.
tags: [docs, generator, python]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3, curl]
gitignore: [".claude/skills/doc-fetcher/cache/"]
---

# Doc Fetcher

The `nuxt-docs` and `nuxt-ui-docs` skills are the same script twice, with a different repository
and topic map. This bundle is that script as a template, plus the procedure for pointing it at any
library.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/doc-fetcher/SKILL.md` | The scaffolding procedure: find the docs in the repo, copy the template, fill `CONFIG`, write the generated skill's `SKILL.md`, verify. |
| `skills/doc-fetcher/fetch.template.py` | The fetcher — topic map, 24-hour cache, installed-version detection, `--list`, `--status`, `--force`, `--update-all`, `--version`. Standard library only. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## What a generated skill does

```bash
python3 .claude/skills/<lib>-docs/fetch.py <topic>          # fetch, or serve from cache
python3 .claude/skills/<lib>-docs/fetch.py <topic> --force  # bypass the cache
python3 .claude/skills/<lib>-docs/fetch.py --list           # topics
python3 .claude/skills/<lib>-docs/fetch.py --status         # what's cached, how stale
python3 .claude/skills/<lib>-docs/fetch.py --update-all     # refresh everything cached
```

Docs come straight from `raw.githubusercontent.com` at the branch you configure, and land under the
skill's own `cache/` for 24 hours. Set `PACKAGE_NAME` to the `package.json` dependency and every
fetch is stamped with the version actually installed in the project — and the cache busts when that
version changes, because a fresh doc read against a stale install is worse than no doc at all.

## Install

```bash
unzip doc-fetcher.zip
mkdir -p .claude/skills
cp -R doc-fetcher/skills/. .claude/skills/
cat doc-fetcher/CLAUDE.md >> CLAUDE.md
```

Then ask Claude to generate a docs skill for the library you care about; the procedure is the
skill.

## The cache

`CACHE_DIR` is `SCRIPT_DIR / "cache"`, so every generated skill caches inside its own directory and
nowhere else. Delete the skill and the cache goes with it; delete the cache and the next fetch
rebuilds it. Nothing here is worth committing.

This bundle declares its own cache path in the `gitignore` frontmatter key, so installing through
`pnpx @patrity/skills` puts it in the project's managed `.gitignore` block. A skill you generate
lives under a new directory, so add its path yourself:

```text
.claude/skills/<lib>-docs/cache/
```

## Configuration

The template needs none: it reads a public GitHub repo over `curl` and takes everything else from
`CONFIG`. If you extend a generated skill to need a value — a token for a private docs repo, say —
read it from `.claude/.env` rather than the repo root `.env`, so the project can give Claude a
different credential than the app uses. Publishing that skill as a bundle, declare the variable
with the `env` frontmatter key and let the tool write `.claude/.env.example`; never ship an example
file of your own.

## Requirements

- `python3` on PATH (standard library only, no pip installs) and `curl`.
- Network access to `raw.githubusercontent.com` the first time each topic is fetched.

## Companion bundles

- **[`nuxt`](/skill/nuxt)** and **[`nuxt-ui`](/skill/nuxt-ui)** — ready-made docs skills built this
  way. Install those directly rather than regenerating them.
