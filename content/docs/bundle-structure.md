# Bundle structure

Every bundle is a directory under `skills/` in the repository. The directory name is the **slug**: lowercase letters, digits and hyphens (`^[a-z0-9][a-z0-9-]*$`). It becomes the URL (`/skill/<slug>`) and the zip's root folder.

```text
skills/
└── <slug>/
    ├── README.md              required — frontmatter + docs
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

## What the site ignores

- any `cache/` directory
- dotfiles and dot-directories (`.gitignore`, `.DS_Store`, `.hidden/`)
- files over 1 MB (listed in the tree as "too large", never served or zipped)

Binary files are listed but shown as a placeholder with a link to GitHub.
