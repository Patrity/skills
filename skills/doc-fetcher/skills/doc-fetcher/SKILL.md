---
name: doc-fetcher
description: Use when a library's API is uncertain and there is no docs skill for it yet — scaffolds a <lib>-docs skill that fetches and caches that library's documentation from its GitHub repo, so answers come from the docs rather than from training data.
allowed-tools: Read, Write, Edit, Bash
---

# Generating a `<lib>-docs` skill

Training data goes stale, and a plausible-looking wrong signature costs more than a fetch. When a
library matters to a project, give it a docs skill: one Python script that pulls the real docs out
of the library's own repository and caches them for a day.

`fetch.template.py` in this skill is the whole implementation. You configure it; you do not rewrite
it.

## 1. Find the docs in the repo

Open the library's GitHub repository and confirm, by looking:

- **Which branch or tag** the published docs come from (`main`, `v4`, `master`, a version branch).
  Docs on `main` may describe a version the project has not installed.
- **Which directory** holds them (`docs/`, `docs/content/`, `website/docs/`, `pages/`).
- **Which extension** they use (`.md` or `.mdx`).
- **A handful of real file paths**, which become the topic map.

Fetch one file by hand before writing any config — a wrong `DOCS_PATH` fails as a 404 on every
topic, and the failure looks identical to "the library has no docs".

```bash
curl -sI https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<docs-path>/<file>.md | head -1
```

## 2. Scaffold the skill

```bash
mkdir -p .claude/skills/<lib>-docs
cp .claude/skills/doc-fetcher/fetch.template.py .claude/skills/<lib>-docs/fetch.py
printf 'cache/\nmanifest.json\n' > .claude/skills/<lib>-docs/.gitignore
```

The cache is a download, never a source of truth — it must not be committed, and it is safe to
delete at any time. `manifest.json` is cache bookkeeping; ignore it too unless you want the topic
list in git.

## 3. Fill in CONFIG

Everything you change is between the `CONFIG` markers at the top of `fetch.py`:

| Key | What it is |
| --- | --- |
| `SKILL_NAME` | `<lib>-docs`. Shows up in the User-Agent and every printed heading. |
| `REPO` | `<owner>/<repo>` on GitHub. |
| `BRANCH` | The branch or tag the docs are published from. |
| `DOCS_PATH` | Docs directory, relative to the repo root. |
| `DOC_EXT` | `.md` or `.mdx`. |
| `PACKAGE_NAME` | Optional `package.json` dependency name. Set it and every fetch reports the version actually installed, and the cache busts when that version changes. Leave `""` to skip. |
| `TOPIC_MAP` | Friendly topic → doc path (no directory prefix, no extension). Aliases are encouraged; several keys may point at one path. Leave empty for a flat docs tree and pass raw paths instead. |
| `CATEGORIES` | Optional grouping for `--list`. |

Nothing below the `end CONFIG` line needs editing. If you find yourself changing the fetch or cache
logic for one library, fix it here in the template instead so every generated skill inherits it.

## 4. Write the generated skill's SKILL.md

`.claude/skills/<lib>-docs/SKILL.md` — the description is what makes Claude reach for it, so name
the symbols someone would actually ask about:

````md
---
name: <lib>-docs
description: Fetches <Library> documentation from GitHub. Use when needing <the APIs people ask about — name the real ones, e.g. specific composables, hooks, config keys> or any <Library> concept, before guessing a signature.
allowed-tools: Bash, Read
---

# <Library> documentation

Fetches up-to-date <Library> docs from `<owner>/<repo>` and caches them for 24 hours.

| Task | Command |
| --- | --- |
| Fetch a topic | `python3 .claude/skills/<lib>-docs/fetch.py <topic>` |
| Force a refresh | `python3 .claude/skills/<lib>-docs/fetch.py <topic> --force` |
| List topics | `python3 .claude/skills/<lib>-docs/fetch.py --list` |
| Cache status | `python3 .claude/skills/<lib>-docs/fetch.py --status` |
| Refresh everything cached | `python3 .claude/skills/<lib>-docs/fetch.py --update-all` |
| Installed version | `python3 .claude/skills/<lib>-docs/fetch.py --version` |

## When to use

- "How do I use <the API>?"
- "What options does <the config key> take?"
- Any answer you would otherwise give from memory about <Library>.
````

## 5. Verify before you rely on it

```bash
python3 .claude/skills/<lib>-docs/fetch.py --list
python3 .claude/skills/<lib>-docs/fetch.py <a real topic> | head -30
python3 .claude/skills/<lib>-docs/fetch.py --status
```

`--list` proves the config parses; the fetch proves the URL is right. A topic that prints a
banner and nothing else means the path resolved to a 404 page — go back to step 1.

## Using a generated skill

Fetch the topic, read it, then write the code. A cached hit is free, so there is no reason to
answer a version-specific question from memory. The banner at the top of every fetch says which
version is installed against which branch the docs came from — when those disagree, believe the
installed version and say so.
