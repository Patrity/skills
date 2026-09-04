---
paths:
  - ".claude/hooks/**"
  - ".claude/settings.json"
---

# Hooks are fail-closed

A hook exists because a reminder did not hold. It only keeps that property while it cannot be
skipped by accident.

## The contract

- **Exit 2 blocks.** Whatever the script writes to stderr is handed back to Claude as the reason,
  so the message has to say what to do instead ("edit it manually", "fix the lint errors"). Exit 0
  allows. Every other non-zero exit is a hook *error* — it is logged and the action proceeds.
- **A missing check is a blocked action, not a free pass.** Each wiring in `settings.json` runs the
  script if it is on disk, and otherwise asks git whether it is *supposed* to be there:

  ```bash
  s="$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"; if [ -f "$s" ]; then exec "$s"; fi; \
  git -C "$CLAUDE_PROJECT_DIR" cat-file -e HEAD:.claude/hooks/<name>.sh 2>/dev/null && exit 2; exit 0
  ```

  A tracked script that has been deleted, renamed or lost to a bad checkout blocks the action. A
  script that was never tracked (a fresh clone that has not installed the bundle) does not.
- **Never write the fail-open form.** `[ ! -f X ] || X` and `[ -x X ] && X` both let the gate
  disappear silently, which is exactly the failure a hook is meant to prevent.

## Adding a check

1. Write the script under `.claude/hooks/`, `chmod +x` it, and commit it with mode `100755`.
   An unexecutable hook fails with `Permission denied` — a hook error, so it does *not* block.
2. Give it the same header the shipped hooks have: purpose, event and matcher, exit-code semantics.
3. Wire it in `.claude/settings.json` under the right event with the missing-file guard above, and
   set a `timeout` that fits the work (5s for a stdin check, 60s for a lint run).
4. Prove both directions before you call it done: make the offending change and watch it be
   refused, then make a clean change and watch it pass.

## Reading stdin

`PreToolUse` hooks receive the tool call as JSON on stdin — read it once (`INPUT=$(cat)`) and pull
fields with `jq`. Reading stdin twice gets you an empty string the second time, which reads as
"nothing to check" and silently allows everything.
