## Constraints that bit before
- Hooks are fail-closed: a check script that is tracked in git but missing on disk exits 2 instead of being silently allowed — on `PreToolUse` that blocks the call before it runs; on `PostToolUse` it hands Claude the reason back after the edit is already written to disk. If you cannot point at the refusal, you wrote a reminder, not a rule.
- `.env*`, `credentials.json` and `secrets.*` cannot be edited by tools; ask the user to change them.
