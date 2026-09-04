---
paths:
  - "scripts/**/*.ts"
  - "cli/**/*.ts"
---

# Scripts and CLI entry points

One-off and maintenance scripts live under `scripts/` and run through the TypeScript runner rather than a build step:

```bash
{{pmx}} tsx scripts/<name>.ts [args]
```

Add a `package.json` script for anything run more than once, so the invocation is discoverable and CI can call it the same way.

## Keep scripts importable

- Scripts import from `server/` and `shared/` like any other module — do not fork logic into the script. A script that reimplements a query drifts from the app the week after it is written.
- Keep the module side-effect free: define the work in a function, call it behind an entry-point guard, and export it so a test can drive it.
- Pure logic that a script needs belongs in a module the app can also import, not in the script file.

## Environment

- A Nuxt production build does **not** read `.env`; neither does a script run outside the dev server. Load it explicitly (`--env-file`, `dotenv`) or require the variables to be exported by the caller.
- Validate required variables at the top and exit with a clear message naming the missing key. Never fall back to a default that silently points at the wrong database.
- Scripts run outside the Nitro runtime, so `process.env` is the correct source here — but read each value once, at the top, into typed config.
- Never print a secret, and never write one into a generated file that is committed.

## Arguments, output and exit codes

- Exit `0` on success, non-zero on failure; `process.exitCode = 1` beats `process.exit(1)` when there is buffered output. An uncaught rejection must not exit `0` — wrap the entry point and fail loudly.
- Diagnostics go to stderr, results to stdout, so the script composes in a pipeline.
- Anything destructive requires an explicit flag (`--force`) or a confirmation prompt, and is a no-op by default. Support `--dry-run` and print exactly what would change.
- Detect non-interactive use (no TTY, `CI`) and skip prompts instead of hanging a pipeline.
- Make it idempotent: re-running after a partial failure should converge, not double-apply.
