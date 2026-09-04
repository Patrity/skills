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
