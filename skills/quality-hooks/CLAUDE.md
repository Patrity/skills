## Constraints that bit before
- Hooks are fail-closed: a tracked check script missing on disk blocks the action. Edits to `.env*`/`credentials.json`/`secrets.*` are refused by a PreToolUse hook; lint runs after every edit and blocks on failure.

## Skills and rules
- Add a new gate as a script in `.claude/hooks/` wired in `.claude/settings.json` with the same missing-file guard; `.claude/rules/hooks.md` has the pattern.
