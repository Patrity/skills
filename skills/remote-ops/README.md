---
name: Remote Ops Quoting
description: The ssh argument-flattening trap that silently runs your command on the wrong machine, the two forms that work, and the base64 hop for anything with nested quotes or SQL.
tags: [ops, ssh, proxmox, shell]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [ssh]
---

# Remote Ops Quoting

One skill about one bug, because that bug produces a confident, detailed, completely wrong report.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/remote-ops/` | How `ssh` flattens its arguments, the broken vs. correct forms, the base64 hop for nested quotes and SQL, and the `hostname` check. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## The bug

`ssh` joins all of its arguments into a single command string, so your local quoting is gone before
the remote shell sees it. A nested `bash -lc` then takes only the **first word** as its script:

```bash
# ✗ prints a blank line, then the OUTER HOST's hostname
ssh root@<host> -- pct exec <ctid> -- bash -lc 'echo hi; hostname'

# ✓ prints "hi", then the container's hostname
ssh root@<host> "pct exec <ctid> -- bash -lc 'echo hi; hostname'"
```

Both exit 0. The broken form either runs everything after a `;` or `&&` on the outer host, or runs
a bare first word with the rest discarded into `$@`. It has already turned a healthy production
container into a report that the app directory was missing, the service inactive and `docker` not
installed — every one of those true of the host, none of them true of the container.

The same shape appears anywhere a remote command nests: `ssh … docker exec … sh -c '…'`,
`ssh … sudo -u app bash -lc '…'`, `ssh … kubectl exec … -- sh -c '…'`.

## The rule worth memorising

**When a remote result surprises you, run `hostname` before believing it.** "Not found", "not
installed", "no such directory" is what a perfectly healthy outer host says when your command never
reached the container.

## Install

```bash
unzip remote-ops.zip
mkdir -p .claude/skills
cp -R remote-ops/skills/. .claude/skills/
cat remote-ops/CLAUDE.md >> CLAUDE.md
```

No configuration. The examples use `<host>`, `<ctid>`, `<app>` and `<container>` placeholders —
substitute your own, and keep the project's real hosts in a project-local skill rather than here.

## Requirements

- `ssh` on PATH, and `base64` on both ends for the payload form.
