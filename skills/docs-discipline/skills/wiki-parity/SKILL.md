---
name: wiki-parity
description: Use when setting up or fixing the docs/wiki registry and its parity test — a system shipped and its page is stale, a page exists that nobody registered, or the project has no mechanical check that the wiki matches the code.
allowed-tools: Read, Write, Edit, Bash
---

# Keeping the wiki honest, mechanically

The wiki (`docs/wiki/`) says how each system works **today**. Every audit of a prose-only rule has
found the same drift: a system ships, the page still calls it planned, and a later session reads
the page and plans work that already exists. The fix is not a stronger reminder — it is a test.

## The registry

`docs/wiki/_systems.json` is the machine-readable half:

```json
{
  "systems": [
    { "id": "auth", "page": "auth.md", "status": "shipped" },
    { "id": "billing", "page": "billing.md", "status": "building" },
    { "id": "notifications", "page": "systems/notifications.md", "status": "planned" }
  ]
}
```

- `id` — stable, unique, kebab-case. It is what a handover or a commit message refers to.
- `page` — path relative to `docs/wiki/`, including any subdirectory.
- `status` — the ladder, and it is a **closed set**:

  | Status | Means | The page must contain |
  | --- | --- | --- |
  | `planned` | Decided, no code | The intended shape, and a link to the spec |
  | `building` | Code exists, not usable end to end | What is real today and what is still stubbed |
  | `shipped` | Usable end to end | The real schema, routes, config and constants — read out of the code, not out of the plan |

  Nothing else. `partial`, `wip` and `done` are the words that let a stale page hide.

`_systems.example.json` in this skill is a starting file — copy it to `docs/wiki/_systems.json`
and replace the entries.

## Installing the test

1. Copy `wiki-parity.test.ts` from this skill into the project's test directory, keeping whatever
   convention it already uses:

   ```bash
   mkdir -p test/docs
   cp .claude/skills/wiki-parity/wiki-parity.test.ts test/docs/wiki-parity.test.ts
   ```

   It reads `docs/wiki/` relative to `process.cwd()`, so it needs no configuration — but check
   that the path matches your runner's `include` glob, or it will never run.
2. Create `docs/wiki/_systems.json` from the example and register every page you already have.
3. Run the suite. The first run usually fails with a list of orphan pages — that list *is* the
   backlog; register them, do not delete the test.
4. Make sure it runs in CI, in the same job as the unit tests. A parity test that only runs
   locally drifts exactly like the prose it replaced.

## What it asserts

- Every `page` in the registry exists under `docs/wiki/`.
- Every `docs/wiki/**/*.md` except `_index.md` is registered.
- Every `status` is on the ladder, and every `id` is unique.

It deliberately does **not** guess whether a system is "really" shipped — a test that infers that
is a test nobody trusts. As shipped it enforces that the registry and the directory agree, and
leaves the status to the change that ships the system.

### Enforcing the status half too

If status drift is the failure your project actually has, give each `shipped` entry an `anchor` —
a `path/to/file.ts#exportName` that only exists once the system does — and add a sixth assertion
that the file exists and contains the symbol. Now flipping a status to `shipped` requires the code
to be there, and the anchor breaks loudly when the system is renamed or removed. Keep it to
`shipped` entries: anchors on planned work are noise.

## When you ship or change a system

In the **same change** as the code:

1. Update the page — real constants, real endpoints, what the code does now.
2. Bump `status` if it moved.
3. Add the entry if the system is new.

If you find yourself writing "I'll update the wiki after this lands", you have already created the
drift this test exists to catch.
