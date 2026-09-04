---
name: Quality Hooks
description: "Fail-closed Claude Code hooks: protect .env and credential files, lint after every edit, and capture new insights as rules before context compaction."
tags: [hooks, quality, safety]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [bash, jq, git]
---

# Quality Hooks

Three gates the harness runs for you, so they hold on the turn where Claude is in a hurry.

## What's inside

| Path | Purpose |
| --- | --- |
| `hooks/protect-env.sh` | `PreToolUse` on `Edit`/`Write`: reads the tool call from stdin and refuses `.env*`, `credentials.json` and `secrets.*` — templates (`.env.example`, `.env.sample`) stay editable. |
| `hooks/lint-check.sh` | `PostToolUse` on `Edit`/`Write`: runs `{{pm}} lint --quiet` and blocks while it is red. |
| `settings.json` | The wiring, including the `PreCompact` prompt hook that writes new lessons down as a rule before context is compacted. |
| `rules/hooks.md` | Fires on `.claude/hooks/**` and `.claude/settings.json` — the fail-closed pattern to copy when adding a check. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## Why fail-closed

Every wiring in `settings.json` runs its script if the file is on disk, and otherwise asks git
whether that script is *supposed* to exist:

```bash
s="$CLAUDE_PROJECT_DIR/.claude/hooks/protect-env.sh"; if [ -f "$s" ]; then exec "$s"; fi; \
git -C "$CLAUDE_PROJECT_DIR" cat-file -e HEAD:.claude/hooks/protect-env.sh 2>/dev/null && exit 2; exit 0
```

A tracked hook that has been deleted, renamed, or lost to a bad checkout **blocks the edit**
(exit 2) instead of silently waving it through. A repo that never installed the bundle is
unaffected. The tempting one-liner — `[ ! -f "$s" ] || exec "$s"` — is the exact opposite: the
gate vanishes the moment the file does.

## Install

```bash
unzip quality-hooks.zip
mkdir -p .claude/hooks .claude/rules
cp -R quality-hooks/hooks/. .claude/hooks/
chmod +x .claude/hooks/*.sh
cp -R quality-hooks/rules/. .claude/rules/
cat quality-hooks/CLAUDE.md >> CLAUDE.md
```

`settings.json` is **merged**, not copied — you almost certainly have one already. The setup CLI
does this for you (hook entries are unioned per event). By hand, copy the `hooks` key across into
`.claude/settings.json`, appending to the arrays that already exist for `PreToolUse`,
`PostToolUse` and `PreCompact`.

Commit the hooks with the executable bit set (`git ls-files -s .claude/hooks` must show `100755`).
An unexecutable hook exits non-zero for the wrong reason, which the harness treats as a hook error
— it is logged, and the action goes ahead.

## Placeholders

`hooks/lint-check.sh` contains `{{pm}}`. The setup CLI renders it from your answers; installing by
hand, replace it with your package manager (`pnpm`, `npm`, `yarn`, `bun`). The script needs a
`lint` script in `package.json` that accepts `--quiet`; in a monorepo where lint only exists at the
root, use `{{pm}} -w lint --quiet` instead.

## Tuning the protected list

`protect-env.sh` matches on the basename, in one `case` statement: every `.env*` file plus
`credentials.json` and `secrets.*`. `.env.example` and `.env.sample` are exempted in the arm above
it, so templates stay editable and do not go stale when config changes.

The pattern list is the whole policy — add your project's own (`*.pem`, `service-account.json`,
`*.keystore`) to the blocking arm, and any further templates to the exempt arm.

## The PreCompact hook

`PreCompact` fires just before a long session is compressed, and this one is a `prompt` hook: it
asks Claude, in that last moment of full context, whether the session surfaced a pattern or gotcha
that is not written down yet — and to save it as a path-scoped rule or a skill if so. Insights
otherwise die with the context window that discovered them.

## Requirements

- `bash` and `jq` on PATH (`protect-env.sh` parses the tool call with `jq`).
- `git`, for the missing-file guard. The guard is a no-op outside a git work tree.

## Companion bundles

- **[`docs-discipline`](/skill/docs-discipline)** — the other half of "write it down": handovers and
  a wiki-parity test for the knowledge that outgrows a rule.
