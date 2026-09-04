## Constraints that bit before
- Hooks are fail-closed: a check script that is tracked in git but missing on disk blocks the action instead of silently allowing it. If you cannot point at the refusal, you wrote a reminder, not a rule.
- `.env*`, `credentials.json` and `secrets.*` cannot be edited by tools; ask the user to change them.
