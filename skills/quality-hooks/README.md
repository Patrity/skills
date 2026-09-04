---
name: Quality Hooks
description: "Fail-closed Claude Code hooks: protect .env and credential files, lint after every edit, and flag an unwritten convention before context is compacted."
tags: [hooks, quality, safety]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [bash, jq, git]
---

# Quality Hooks

Three checks the harness runs for you, so they hold on the turn where Claude is in a hurry.

## What's inside

| Path | Purpose |
| --- | --- |
| `hooks/protect-env.sh` | `PreToolUse` on `Edit`/`Write`: reads the tool call from stdin and refuses `.env*`, `credentials.json` and `secrets.*` — templates (`.env.example`, `.env.sample`) stay editable. |
| `hooks/lint-check.sh` | `PostToolUse` on `Edit`/`Write`: runs `{{pm}} lint --quiet` and, while it is red, hands the failure back to Claude to fix in the same turn. |
| `settings.json` | The wiring, including the `PreCompact` prompt hook that asks whether the session learned something worth writing down. |
| `rules/hooks.md` | Fires on `.claude/hooks/**` and `.claude/settings.json` — the fail-closed pattern to copy when adding a check. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## Why fail-closed

Every wiring in `settings.json` runs its script if the file is on disk, and otherwise asks git
whether that script is *supposed* to exist:

```bash
s="$CLAUDE_PROJECT_DIR/.claude/hooks/protect-env.sh"; if [ -f "$s" ]; then exec "$s"; fi; \
git -C "$CLAUDE_PROJECT_DIR" cat-file -e HEAD:.claude/hooks/protect-env.sh 2>/dev/null && exit 2; exit 0
```

A tracked hook that has been deleted, renamed, or lost to a bad checkout exits 2 instead of
silently waving the action through: on `PreToolUse` that **refuses the edit**, and on `PostToolUse`
— where the edit is already written — it tells Claude the gate is missing before it continues. A
repo that never installed the bundle is unaffected. The tempting one-liner —
`[ ! -f "$s" ] || exec "$s"` — is the exact opposite: the gate vanishes the moment the file does.

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

Exit 2 means two different things by event: on `PreToolUse` it refuses the tool call, and on
`PostToolUse` the tool has already run, so the write stands and stderr is what Claude reads before
it continues. `rules/hooks.md` has the full contract.

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

`PreCompact` fires just before a long session is compressed, and this one is a `prompt` hook: the
prompt and the hook input go to a separate fast model for a single turn, which answers
`{"ok": true}` or `{"ok": false, "reason": "…"}`. It is asked one question — does this transcript
hold a convention, pattern or gotcha that is not written down yet?

That model has no session context, no tools and no way to write a file, and `PreCompact` is not a
blocking event: an `ok: false` reason is *surfaced to Claude*, nothing more. That is the whole
value — the reminder arrives in the last moment where the context that learned the lesson still
exists, and Claude can save it as a path-scoped rule or a skill before compaction takes it. The
hook never writes the rule itself, and it never stops the compaction.

## Requirements

- `bash` and `jq` on PATH (`protect-env.sh` parses the tool call with `jq`).
- `git`, for the missing-file guard. The guard is a no-op outside a git work tree.

## Companion bundles

- **[`docs-discipline`](/skill/docs-discipline)** — the other half of "write it down": handovers and
  a wiki-parity test for the knowledge that outgrows a rule.
