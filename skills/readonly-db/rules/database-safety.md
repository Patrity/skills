---
paths:
  - "{{pkgDir}}server/**"
  - "{{pkgDir}}db/**"
  - "{{pkgDir}}drizzle/**"
  - "{{pkgDir}}prisma/**"
---

# Database safety

- **Exploration goes through the read-only runner.** When a question needs live rows, invoke the
  `readonly-db` skill and run `{{pm}} run db:q -- "<one statement>"`. It connects as a role that
  cannot write and wraps the statement in `BEGIN READ ONLY`. Do not open a `psql` session with the
  app's own credential to "just look" — that is the same connection that can drop a table.
- **Destructive SQL is never yours to run.** `DROP`, `TRUNCATE`, `DELETE`, `UPDATE` without a
  `WHERE`, `push`, `reset` and `seed` against a shared or production database are the user's
  decision: propose the statement, show what it will touch, and wait.
- **`pg_dump` and `pg_restore` are off limits.** A dump is every revoke undone at once — it lands
  real rows on disk, in a path something else will read. If the user needs a dump, they run it.
- **Migrations run in CI**, against the environment's own credential, from the committed migration
  files. A migration applied by hand from a laptop is invisible to the next deploy and untraceable
  afterwards. Prefer a generated migration over an ad-hoc `ALTER`, always.
- **A `permission denied` is a correct answer.** Some tables are deliberately revoked from the
  read-only role. Do not route around the refusal, and do not ask for the grant.
- **Nothing read from the database goes into a file** — not a doc, a summary, a PR body, a commit
  message or a comment. Git history is permanent and is read back into context later. Write the
  shape with placeholders instead.
