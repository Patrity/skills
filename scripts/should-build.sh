#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = SKIP the build, exit 1 = BUILD.
#
# Bundle content under skills/** is read from GitHub at runtime and docs/** never ships,
# so commits touching only those (plus the root README) don't need a deploy. content/docs/**
# is app content and is deliberately NOT excluded.
set -uo pipefail

if ! git rev-parse --verify --quiet 'HEAD^' >/dev/null; then
  echo "should-build: no parent commit, building"
  exit 1
fi

if git diff --quiet 'HEAD^' HEAD -- . ':(exclude)skills/**' ':(exclude)docs/**' ':(exclude)README.md'; then
  echo "should-build: only skills/docs changed, skipping build"
  exit 0
fi

echo "should-build: app files changed, building"
exit 1
