#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = SKIP the build, exit 1 = BUILD.
#
# Bundle content under skills/** is read from GitHub at runtime and docs/** never ships,
# so commits touching only those (plus the root README) don't need a deploy. content/docs/**
# is app content and is deliberately NOT excluded.
#
# The base is VERCEL_GIT_PREVIOUS_SHA (the last deployed commit) so a push carrying an app
# commit followed by a skills-only commit still builds. HEAD^ is the fallback when the
# variable is absent (first deploy, manual redeploy) or points at a commit we don't have.
set -uo pipefail

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  base='HEAD^'
fi

if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
  echo "should-build: no usable base commit, building"
  exit 1
fi

if git diff --quiet "$base" HEAD -- . ':(exclude)skills/**' ':(exclude)docs/**' ':(exclude)README.md'; then
  echo "should-build: only skills/docs changed since $base, skipping build"
  exit 0
fi

echo "should-build: app files changed since $base, building"
exit 1
