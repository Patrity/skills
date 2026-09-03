# Hooks and settings

Claude Code hooks are configured in a settings file and point at scripts. A bundle can ship both.

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

The user merges this into their own `.claude/settings.local.json` (or `settings.json`); the site does not do that for them, so say so in the README.

## hooks/

Put the scripts the settings reference here. Make them executable in git (`chmod +x`, then commit) and start them with a shebang. Keep them dependency-free where possible; if they need a tool, add it to `requires` in the README frontmatter.

Shell, Python, JavaScript and TypeScript files render with syntax highlighting on the site so people can read a hook before they trust it.

## Testing a hook locally

```bash
unzip <slug>.zip
cp -R <slug>/hooks .claude/
# merge <slug>/settings.local.json into .claude/settings.local.json
claude   # start a session and trigger the matcher
```
