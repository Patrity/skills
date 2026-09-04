#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = SKIP the build, exit 1 = BUILD.
#
# Bundle content under skills/** is read from GitHub at runtime and docs/** never ships,
# so commits touching only those (plus the root README, CLAUDE.md, .claude/**, .github/** and
# cli/**, none of which ship as part of the site) don't need a deploy. cli/** is the
# @patrity/skills CLI package, published separately (not part of this Nuxt app). content/docs/**
# is app content and is deliberately NOT excluded.
#
# The base is VERCEL_GIT_PREVIOUS_SHA (the last deployed commit) so a push carrying an app
# commit followed by a skills-only commit still builds. HEAD^ is the fallback when the
# variable is absent (first deploy) or points at a commit we don't have. A redeploy of the
# same commit always builds (see below).
set -uo pipefail

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  base='HEAD^'
fi

if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null; then
  echo "should-build: no usable base commit, building"
  exit 1
fi

# A redeploy of the already-deployed commit (env vars changed, "Redeploy" in the dashboard,
# `vercel redeploy`) has an empty diff by definition. That is a request to build, not to skip.
if [ "$(git rev-parse "${base}^{commit}")" = "$(git rev-parse HEAD)" ]; then
  echo "should-build: redeploy of the already-deployed commit, building"
  exit 1
fi

if git diff --quiet "$base" HEAD -- . ':(exclude)skills/**' ':(exclude)docs/**' ':(exclude)README.md' ':(exclude)CLAUDE.md' ':(exclude).claude/**' ':(exclude).github/**' ':(exclude)cli/**'; then
  echo "should-build: only skills/docs changed since $base, skipping build"
  exit 0
fi

echo "should-build: app files changed since $base, building"
exit 1
