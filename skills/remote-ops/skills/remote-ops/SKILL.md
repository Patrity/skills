---
name: remote-ops
description: Use before running anything over ssh, especially a nested command such as `ssh host pct exec <ctid> -- bash -lc '...'` or `ssh host docker exec ... sh -c '...'`. Covers how ssh flattens its arguments and destroys local quoting, the two forms that work, the base64 form for anything with nested quotes or SQL, and verifying which machine actually ran your command.
allowed-tools: Bash, Read
---

# Remote command quoting

> The single most dangerous mistake in remote ops — read it before running anything.

`ssh` joins **all** of its arguments into one command string, so your local shell's quotes are
stripped before the remote shell ever parses them. A nested `bash -lc` then receives only the
**first word** as its script; the rest become positional parameters (`$0`, `$1`, …). This fails two
different ways, both silent and both exit 0:

| Your command contains | What actually happens |
| --- | --- |
| an unquoted `;` or `&&` | the remote shell splits there — everything after the separator runs **on the outer host**, not in the container |
| no separator | it runs in the container, but as bare `<firstword>` with every other token discarded into `$@` (e.g. `systemctl status <app>` → plain `systemctl`; `docker exec … psql …` → plain `docker` usage) |

```bash
# ✗ BROKEN — prints a blank line, then the OUTER HOST's hostname
ssh root@<host> -- pct exec <ctid> -- bash -lc 'echo hi; hostname'

# ✓ CORRECT — prints "hi", then the container's hostname
ssh root@<host> "pct exec <ctid> -- bash -lc 'echo hi; hostname'"
```

This has already burned a session: it made an intact production host look like a wiped container
(the app directory "missing", the service "inactive", `docker` "not found" — all true of the outer
host, none true of the container) and produced a confident, wrong report. A `systemctl restart …`
or a `docker exec … psql` typed the broken way silently targets the **wrong machine or the wrong
command**.

## Use these two forms

Quote the entire remote command. Never rely on an unquoted `--` chain.

```bash
# On the outer host
ssh root@<host> '<host command>'

# Inside the container — note the outer double quotes
ssh root@<host> "pct exec <ctid> -- bash -lc '<command run in the container>'"
```

The same trap applies to every nesting of this shape, not just Proxmox: `ssh … docker exec … sh -c
'…'`, `ssh … sudo -u app bash -lc '…'`, `ssh … kubectl exec … -- sh -c '…'`.

## For nested quotes, SQL or `$`-expansion: skip quoting entirely

Base64 the payload so no shell on the path can reinterpret it. This is the reliable form:

```bash
remote() { local b=$(printf '%s' "$1" | base64 | tr -d '\n'); \
  ssh root@<host> "pct exec <ctid> -- bash -lc 'echo $b | base64 -d | bash'"; }

remote 'systemctl status <app> --no-pager'
remote 'docker exec -i <container> psql -U <user> -d <db> -c "select count(*) from things;"'
```

Single quotes, double quotes, `;`, `&&`, `$(…)` and SQL all survive the hop intact, because the
outer shells only ever see one base64 word — and `tr -d '\n'` is what keeps it *one* word: GNU
coreutils `base64` wraps its output at 76 columns, so any payload over 57 bytes (the second example
here is 83) arrives as two lines, and the embedded newline reaches the remote shell as a broken
command. macOS/BSD `base64` does not wrap, which is exactly why this bites only on Linux. Use
`tr -d '\n'` rather than `-w0`, which is GNU-only.

## Verify the machine, always

**When a remote result surprises you, verify with `hostname` before believing it.** "The directory
is gone", "the service is not installed", "the command is not found" are all exactly what a
correctly-working outer host says when your command never reached the container.

```bash
remote 'hostname'    # expect the container's name, not the host's
```

Make this the first command of any remote debugging session, and the first command again the moment
a result contradicts what you expect. It costs one round trip and it is the difference between
fixing a problem and inventing one.
