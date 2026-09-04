---
name: Read-only DB Access
description: A dedicated read-only role, a one-statement runner wrapped in BEGIN READ ONLY, and the rule that keeps destructive SQL out of Claude's hands.
tags: [database, postgres, safety]
author: Patrity
authorUrl: https://github.com/Patrity
env:
  - { name: DATABASE_URL_RO, description: "Read-only Postgres connection string for the db:q runner. Point it at a replica or a dedicated read-only role.", required: true, example: "postgres://<app>_claude_ro:<password>@<host>/<database>" }
---

# Read-only DB Access

Some questions only rows can answer: did that trigger fire, what does this view actually return, is
that column populated, how does the query behave at volume. This bundle makes asking them routine
without making writing them possible.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/readonly-db/` | Setting up the read-only role and the `db:q` runner, and the five rules for handling what comes back. |
| `rules/database-safety.md` | Fires on `server/`, `db/`, `drizzle/` and `prisma/` — read-only exploration, no destructive SQL, no dumps, migrations from CI. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## The shape of it

Two independent guards, because either one alone is a single point of failure:

1. **A dedicated role.** `<app>_claude_ro` has `SELECT` and nothing else, with sensitive tables
   revoked explicitly and a `statement_timeout` so a bad join fails instead of hanging. Its
   credential lives in its own env var, separate from the app's.
2. **A one-statement runner.** `{{pm}} run db:q -- "SELECT …"` accepts only `SELECT`, `WITH`,
   `EXPLAIN`, `SHOW`, `TABLE` and `VALUES`, rejects a second statement, wraps the call in
   `BEGIN READ ONLY`, refuses to run outside development, and caps its own output.

The allowlist is there for the error message. `BEGIN READ ONLY` is what makes it true.

It is not a sandbox, and the skill says so plainly: any session in the repo can still reach the
read-write credential the app uses. This removes a class of accident on the exploration path — it
does not contain a session that goes looking.

## Install

```bash
unzip readonly-db.zip
mkdir -p .claude/skills .claude/rules
cp -R readonly-db/skills/. .claude/skills/
cp -R readonly-db/rules/. .claude/rules/
cat readonly-db/CLAUDE.md >> CLAUDE.md
```

Then ask Claude to run the `readonly-db` skill: it writes the migration that creates the role and
the `db:q` script, and wires the npm script.

## Configuration

The runner reads one variable, `DATABASE_URL_RO`, from `.claude/.env` — not from the repo root
`.env`, and not from your shell profile. That is the whole point of the separation: the app keeps
its own connection string, and Claude gets a different one that cannot write.

```bash
# .claude/.env
DATABASE_URL_RO=postgres://<app>_claude_ro:<password>@<host>/<database>
```

Installed through `pnpx @patrity/skills`, the variable is already described in
`.claude/.env.example` and `.claude/.env` is already in the managed `.gitignore` block. Installing
by hand, create `.claude/.env` yourself and add it to `.gitignore` before you paste a password into
it. `.claude/.env.example` is regenerated on every run, so it is never the place for a real value.

The password itself is set out of band, once per database, as the skill describes. It belongs in
whatever secret manager the project already uses, and in `.claude/.env` on the machine that runs
the queries. Never in a committed file.

## Placeholders

`{{pm}}` in the skill and the rule is your package manager. The setup CLI renders it; by hand,
replace it with `pnpm`, `npm`, `yarn` or `bun`.

## What it deliberately does not do

- No `pg_dump`/`pg_restore` — a dump is every revoke undone at once.
- No production connection. Reproduce on a branch or a local copy.
- Nothing read from the database is written into a file, a commit message or a PR body. Git history
  is permanent and gets read back into context on every later prompt.

## Companion bundles

- **[`nuxt`](/skill/nuxt)** — its `rules/database.md` covers the Drizzle side (schema layout,
  generated migrations, query conventions) and agrees with this one on the safety rules.
