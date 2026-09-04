#!/bin/bash
# protect-env.sh — refuse tool edits to .env and credential files.
#
# Event:  PreToolUse, matcher "Edit|Write". Claude Code pipes the tool call to this
#         script as JSON on stdin; the edited path is .tool_input.file_path.
# Exit 0: allow the edit.
# Exit 2: BLOCK the edit. Whatever this script writes to stderr is handed back to
#         Claude as the reason, so the message must say what to do instead.
#         Any other non-zero exit is a hook *error* and does NOT block.
#
# Requires `jq` on PATH.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Block sensitive files. Templates are explicitly exempt: they hold no values, and
# they go stale when config changes if nothing may edit them.
BASENAME=$(basename "$FILE_PATH")
case "$BASENAME" in
  .env.example|.env.sample)
    exit 0
    ;;
  .env|.env.*|credentials.json|secrets.*)
    echo "Cannot edit sensitive file: $BASENAME. These files contain secrets and should be edited manually." >&2
    exit 2
    ;;
esac

exit 0
