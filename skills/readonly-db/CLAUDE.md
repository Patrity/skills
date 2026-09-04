## Constraints that bit before
- Database exploration is read-only: query through the `db:q` runner as the read-only role, never with the app's own credential. Destructive SQL, `pg_dump` and `pg_restore` are the user's decision, not Claude's, and migrations are applied by CI.

## Skills and rules
- Invoke `readonly-db` to set up the read-only role and the `db:q` runner, or before running a query through it. `.claude/rules/database-safety.md` loads on `server/`, `db/`, `drizzle/` and `prisma/`.
