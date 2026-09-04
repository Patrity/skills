# Hooks and settings

Claude Code hooks are configured in a settings file and point at scripts. A bundle can ship both.

There are two settings files, and which one a key belongs in is decided by whether it is shared or
machine-local:

| File | Ships | Merged into | Holds |
| --- | --- | --- | --- |
| `settings.json` | committed with the project | the consumer's `.claude/settings.json` | hooks — the checks every clone of the project should run |
| `settings.local.json` | gitignored on the consumer's machine | the consumer's `.claude/settings.local.json` | permission allowlists and anything machine-specific |

## settings.json

The shared half. The CLI **merges** it into the project's `.claude/settings.json` — hook entries are
unioned per event, so a bundle adding a `PreToolUse` hook never drops one that is already there —
and it routes any `permissions.allow` it finds to `settings.local.json`, where permissions belong.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "timeout": 60, "command": "bash .claude/hooks/lint-check.sh" }]
      }
    ]
  }
}
```

Installing by hand, do the same thing: copy the `hooks` key across, appending to the arrays that
already exist for each event.

## settings.local.json

Ship the settings you want the user to merge, nothing more. A typical bundle-level file only carries hooks and permission allowlists:

```json
{
  "permissions": {
    "allow": ["Bash(python3 .claude/skills/*/fetch.py:*)"]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/guard.sh" }]
      }
    ]
  }
}
```

Paths inside the settings file are relative to the **project root**, so reference hook scripts as `.claude/hooks/<script>`.

The CLI merges this into the user's own `.claude/settings.local.json`; downloading the zip from the site does not, so say so in the README.

## Managed .gitignore block and .claude/.env.example

Two files in a project belong to the tool rather than to any one bundle, and both are rebuilt from
scratch on every run.

The first is a block inside the project's root `.gitignore`, between two marker lines:

```text
# >>> skills (managed by @patrity/skills; edit outside this block)
.claude/.env
.claude/settings.local.json
.claude/skills/nuxt-docs/cache/
# <<< skills
```

It holds `.claude/settings.local.json` whenever a local settings file is written, `.claude/.env`
whenever any installed bundle declares `env`, and every path the installed bundles declare in
`gitignore` — sorted and de-duplicated. Lines outside the markers are never touched, the block is
appended after one blank line when it is not there yet, and it disappears when its last entry does.
A start marker with no end marker after it is left alone with a warning, because the block's extent
is unknowable at that point and guessing would delete somebody's lines.

The second is `.claude/.env.example`, written whenever any installed bundle declares `env`. One
group per bundle, alphabetically, from the `env` entries in the READMEs:

```text
# Copy this file to .claude/.env and fill in the values. .claude/.env is gitignored; skills read it, never the repo root .env.

# skills: readonly-db
# Read-only Postgres connection string for the db:q runner. Point it at a replica or a dedicated read-only role. (required)
DATABASE_URL_RO=postgres://<app>_claude_ro:<password>@<host>/<database>
```

The comment is the variable's `description`, with `(required)` appended when `required` is true;
the value is its `example`, or nothing at all when the bundle did not give one.

`.claude/.env.example` is regenerated in full on every run, so edits to it are lost. Real values go
in `.claude/.env`, which the tool never creates, reads or deletes — the one file in `.claude/` that
is entirely yours. Remove the last bundle that declares variables and the example is deleted, or
kept with a warning if you had edited it.

## hooks/

Put the scripts the settings reference here. Make them executable in git (`chmod +x`, then commit) and start them with a shebang. Keep them dependency-free where possible; if they need a tool, add it to `requires` in the README frontmatter.

Shell, Python, JavaScript and TypeScript files render with syntax highlighting on the site so people can read a hook before they trust it.

## Testing a hook locally

```bash
unzip <slug>.zip
cp -R <slug>/hooks .claude/
# merge <slug>/settings.json into .claude/settings.json
# merge <slug>/settings.local.json into .claude/settings.local.json
claude   # start a session and trigger the matcher
```
