---
paths:
  - "server/db/**/*.ts"
  - "db/**/*.ts"
  - "drizzle.config.ts"
---

# Drizzle + Postgres

## Layout

```
server/db/
├── schema/       # one file per domain area, re-exported from index.ts
├── migrations/   # generated — never hand-edited
└── index.ts      # the client singleton
```

- Inside the app the client is a lazy singleton built from `useRuntimeConfig()` (see `backend.md`): handlers call `getDb()` and never touch the driver.
- Give that factory an **optional explicit connection string** — `getDb(url?)`, falling back to runtime config — so a script or a test can build its own client from its own env-loaded config. `useRuntimeConfig()` does not exist outside the server runtime (see `cli.md`); without the escape hatch a backfill script has to duplicate the connection setup.
- Types are inferred from the schema, never re-declared:

```ts
export type Task = InferSelectModel<typeof tasks>
export type NewTask = InferInsertModel<typeof tasks>
```

Export them from `shared/types` so app and server agree by construction.

## Schema changes

1. Edit the table in `schema/`, re-export it if the file is new.
2. Generate the migration (`{{pm}} db:generate`) and read the SQL it produced before committing it.
3. Apply to a local or branch database first (`{{pm}} db:push` is dev-only — it drops what does not match).
4. Commit schema and migration in the same change.

Never edit a file under `migrations/` by hand: the checksum recorded in the migrations table is what makes a deploy reproducible.

## Migrations run from CI, not from a laptop

Production migrations are applied by the deploy pipeline (or a startup hook running the same `migrate` command), against the environment's own credentials. A migration applied by hand from a developer machine is invisible to the next deploy and untraceable afterwards.

## Working against a real database

- Explore with a **read-only role**. `SELECT` on a replica or a read-only user cannot become an accidental `UPDATE` without a `WHERE`.
- Never run `drop`, `truncate`, `push`, `reset` or `seed` against a production database — not to "just check", not to unblock yourself. Reproduce on a branch or a local copy.
- Any destructive statement is the user's decision, not yours: propose the SQL, show what it will touch, and wait.
- Prefer a migration over a manual `ALTER`. Ad-hoc DDL puts production out of sync with the migration history.

## Query conventions

- Use the query builder with `eq`/`and`/`isNull` from `drizzle-orm`; string-concatenated SQL is an injection waiting to happen.
- Multi-table writes go in a transaction.
- Select the columns you need. `select()` on a wide table ships every column over the wire and into the payload.
- Paginate anything list-shaped; an unbounded query is fine until the table is not.
- If a table is soft-deleted (nullable `deletedAt`), **every** read filters `isNull(table.deletedAt)` and the delete endpoint sets the timestamp instead of removing the row.
- Index the columns you filter and join on, in the migration that introduces the query.
