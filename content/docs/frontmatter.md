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
dependsOn: [doc-fetcher]
suggests: [nuxt-ui]
gitignore:
  - .claude/skills/nuxt-docs/cache/
---
```

| Key | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Display name. The slug (directory name) stays the identifier. |
| `description` | string | yes | One or two sentences. Used on cards and in `<meta>` tags. |
| `tags` | string[] | yes | Lowercase. At least one. Drives the filter chips on the index. |
| `author` | string | yes | A person or org name. |
| `authorUrl` | URL | no | Where the author name links to. |
| `requires` | string[] | no | External tooling the bundle needs on your machine, e.g. `python3`, `curl`, `playwright-cli`. |
| `dependsOn` | string[] | no | Bundle slugs this one cannot work without. `add` and the wizard install them automatically. |
| `suggests` | string[] | no | Bundle slugs that pair well with this one. Pre-selected in the wizard, easy to untick. |
| `gitignore` | string[] | no | Paths this bundle wants ignored — a cache directory it writes into, say. They go in the project's managed `.gitignore` block. |
| `env` | object[] | no | The variables this bundle's skills read from `.claude/.env`. Each one becomes a line in `.claude/.env.example`. |

`dependsOn` and `suggests` take **registry slugs** and are validated against the registry: a slug
that names no bundle fails the build. They are the bundle graph; `requires` is about your machine,
not the registry.

## gitignore

Each entry is a project-relative path: no leading `/`, no `..` segment, no drive letter, no
backslashes. End a directory with `/` — the convention, not something the schema enforces. Write
the path as the project will see it, from the repo root:

```yaml
gitignore:
  - .claude/skills/nuxt-ui-docs/cache/
  - .claude/skills/nuxt-ui-templates/cache/
```

The CLI and the web builder collect these across every installed bundle, sort them, and regenerate
one managed block in the project's root `.gitignore`. Removing the bundle takes its lines back out.
See [Hooks and settings](/docs/hooks-and-settings) for the block itself.

## env

A bundle never ships a `.env.example` file. It declares the variables its skills read and lets the
tool write the example:

```yaml
env:
  - name: DATABASE_URL_RO
    description: Read-only Postgres connection string for the db:q runner.
    required: true
    example: postgres://<app>_claude_ro:<password>@<host>/<database>
```

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Must match `^[A-Z][A-Z0-9_]*$`, and be unique within the bundle. |
| `description` | yes | One line. It becomes the comment above the variable in the example file. |
| `required` | no | `true` appends `(required)` to that comment. |
| `example` | no | A sample value, right of the `=`. Omit it and the line ends at the `=`. |

Keep `example` obviously fake. It ends up in a file people commit, and the secrets scanner reads
every bundle file including the README, so a real-looking credential fails validation.

Shipping a `.env.example` file in the bundle instead is an error:
`.env.example: declare variables with the env frontmatter key instead of shipping a file`. The
example belongs to the project, assembled from every installed bundle at once, so no single bundle
can own the file.

Declaring `env` at all does two things beyond the example file: it adds `.claude/.env` to the
managed `.gitignore` block, and it tells a reader of the bundle page what the skill needs before it
will work.

## Validation

A bundle with a missing README, a missing required key, or a bad slug is:

- **shown with a warning** when the site reads from disk (local development), so you can see exactly what is wrong;
- **hidden** in production;
- **rejected by CI** — `pnpm validate:skills` fails the pull request with the same messages the site shows.

Messages look like `frontmatter.tags: required` or `slug "Bad_Slug" must match /^[a-z0-9][a-z0-9-]*$/`.

## Derived metadata

You never write these; the site computes them from the files:

- **badges** — which of `skills/`, `rules/`, `hooks/`, `settings.json`/`settings.local.json`, `CLAUDE.md` exist
- **file count** and **total size**
- **freshness** — the commit that the whole snapshot was read from
