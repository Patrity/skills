#!/bin/bash
# lint-check.sh — lint the project after every edit, and report while it is red.
#
# Event:  PostToolUse, matcher "Edit|Write". The edit has already been written,
#         so nothing here can undo it; this decides what Claude is told next.
# Exit 0: lint is clean.
# Exit 2: stderr is handed back to Claude as the reason before it continues, so
#         it fixes the lint errors in the same turn instead of stacking more
#         edits on top. On PostToolUse this does not block the edit — only a
#         PreToolUse hook can do that. Any other non-zero exit is a hook *error*.
#
# `{{pm}}` is rendered to your package manager at install time.

cd "$CLAUDE_PROJECT_DIR" || exit 1

# Run lint check
if ! {{pm}} lint --quiet 2>/dev/null; then
  echo "Lint errors found. Please fix them before continuing." >&2
  exit 2
fi

exit 0
