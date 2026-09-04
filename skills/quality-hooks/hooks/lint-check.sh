#!/bin/bash
# lint-check.sh — lint the project after every edit, and block while it is red.
#
# Event:  PostToolUse, matcher "Edit|Write". The edit has already been written;
#         this decides whether Claude may keep going.
# Exit 0: lint is clean.
# Exit 2: BLOCK. stderr is handed back to Claude as the reason, so it fixes the
#         lint errors in the same turn instead of stacking more edits on top.
#         Any other non-zero exit is a hook *error* and does NOT block.
#
# `{{pm}}` is rendered to your package manager at install time.

cd "$CLAUDE_PROJECT_DIR" || exit 1

# Run lint check
if ! {{pm}} lint --quiet 2>/dev/null; then
  echo "Lint errors found. Please fix them before continuing." >&2
  exit 2
fi

exit 0
