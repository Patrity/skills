# Bundle structure

Every bundle is a directory under `skills/` in the repository. The directory name is the **slug**: lowercase letters, digits and hyphens (`^[a-z0-9][a-z0-9-]*$`). It becomes the URL (`/skill/<slug>`) and the zip's root folder.

```text
skills/
└── <slug>/
    ├── README.md              required — frontmatter + docs
    │     frontmatter: gitignore  optional — paths the project should ignore
    │     frontmatter: env        optional — variables the skills read
    ├── skills/<name>/SKILL.md optional — one folder per skill
    ├── rules/*.md             optional — path-scoped rules
    ├── hooks/*                optional — scripts referenced by settings
    ├── settings.json          optional — shared settings, merged by the CLI
    ├── settings.local.json    optional — machine-local settings, merged by the CLI
    └── CLAUDE.md              optional — pointer snippet
```

Only `README.md` is required. Everything else is copied into a project's `.claude/` verbatim — except the two settings files, which are merged — so structure it exactly as Claude Code expects.

## README.md

The README is two things at once: **metadata** (YAML frontmatter, see [Frontmatter reference](/docs/frontmatter)) and **documentation** (the markdown body). The body is what renders on the bundle's page. Write it for someone deciding whether to install: what it does, what it needs, how to wire the `CLAUDE.md` snippet.

## skills/

Standard Claude Code skills: `skills/<name>/SKILL.md` with `name` and `description` frontmatter, plus any scripts or assets the skill uses. Keep generated caches out of the repo; any `cache/` directory is ignored by the site and never zipped.

## rules/

Markdown files with a `paths:` frontmatter glob. Rules state *when* and *what constraints*; they should point at a skill for the *how*.

## hooks/, settings.json and settings.local.json

A bundle may ship either settings file, or both. `settings.json` is the committed, shared half
(hooks); `settings.local.json` is the per-machine half (permission allowlists). The CLI merges each
into the consumer's file of the same name rather than copying over it. See
[Hooks and settings](/docs/hooks-and-settings).

## CLAUDE.md

A short block the user pastes into their own `CLAUDE.md`. Keep it to pointers: which skills to invoke, which rules exist, one or two hard constraints.

## Caches and configuration

Neither is a file you ship. Both are declared in the README's frontmatter and assembled per project.

A skill that caches something writes it inside its own directory, never in a shared scratch folder, so deleting the skill deletes the cache with it. Declare the path in [`gitignore`](/docs/frontmatter) and the tool adds it to the project's managed `.gitignore` block, then takes it back out if the bundle is removed.

Configuration comes from `.claude/.env`. Declare each variable in [`env`](/docs/frontmatter) — name, one-line description, whether it is required, a fake example — and the tool writes `.claude/.env.example` for the whole project and keeps `.claude/.env` out of git. A skill reads that file directly rather than the repo root `.env`, which is what lets a project point Claude at a read-only replica while the app keeps its own connection string. See [Contributing](/docs/contributing) for the snippets that do the reading.

## What the site ignores

- any `cache/` directory
- dotfiles and dot-directories (`.gitignore`, `.DS_Store`, `.hidden/`)
- files over 1 MB (listed in the tree as "too large", never served or zipped)

Binary files are listed but shown as a placeholder with a link to GitHub.
