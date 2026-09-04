## Constraints that bit before
- Hooks are fail-closed: a tracked check script missing on disk exits 2 rather than waving the action through. Edits to `.env*`/`credentials.json`/`secrets.*` are refused by a PreToolUse hook; lint runs after every edit (PostToolUse, so the edit stands) and its failure comes back as the reason to fix it before continuing.

## Skills and rules
- Add a new gate as a script in `.claude/hooks/` wired in `.claude/settings.json` with the same missing-file guard; `.claude/rules/hooks.md` has the pattern.
