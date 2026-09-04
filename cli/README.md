# @patrity/skills

[![npm](https://img.shields.io/npm/v/@patrity/skills)](https://www.npmjs.com/package/@patrity/skills)

A CLI that assembles an opinionated Claude Code setup — `.claude/` plus `CLAUDE.md` — from bundles published on [skills.patrity.com](https://skills.patrity.com).

## Quick start

```bash
pnpx @patrity/skills
```

No install step: `pnpx`/`npx`/`bunx` all fetch and run the package straight from npm. With no
subcommand it runs `init`, the interactive wizard. Node 22 or newer is required; Windows, macOS
and Linux are all supported.

## Commands

Every command accepts `--dir <path>` (default `.`), `--registry <url>` (default: the project's
lockfile, else `https://skills.patrity.com`), `--yes` (take defaults, never prompt), `--force`
(overwrite files and CLAUDE.md blocks edited since install) and `--json` (print one JSON object on
stdout and nothing else — implies non-interactive).

| Command | Aliases | Positional | What it does |
| --- | --- | --- | --- |
| `init` | — (default) | — | The wizard: asks the base questions, offers profiles and the bundle list grouped by tag, shows a dry-run plan, and applies it once confirmed. Also `--profile <name>`, `--with <slugs>` (repeatable/comma-separated), `--answer <axis>=<option>` (repeatable). Re-run it to edit a project, not to start it over — see below. |
| `add <slug…>` | — | one or more bundle slugs | Adds bundles to an already-initialised project, re-rendering from the answers on record and pulling in anything the new bundles declare in `dependsOn`. |
| `remove <slug…>` | `rm` | one or more bundle slugs | Removes a bundle's marker blocks and the files it owns. Files it did not create are left alone. |
| `update [slug…]` | `up` | bundle slugs (optional) | Re-renders every installed bundle from the current registry. Naming slugs only narrows which must already be installed — the plan is always a full re-render, so upstream schema changes reach every bundle. |
| `diff` | — | — | Compares local files against the lockfile's hashes (your hand edits) and the lockfile's recorded sha against the registry (upstream drift). |
| `list` | `ls` | — | Prints the installed bundles, the recorded answers, and whether the install is behind the registry. |

`add`/`remove`/`update` all read the previous answers and bundle list from
`.claude/skills.lock.json`, so re-run `init` (not `add`) to change an axis answer.

Re-running `init` on an initialised project **edits** it. The answers on record are the starting
point — a `--profile` and any `--answer` flags override them, and interactively they come up
pre-selected — and every installed bundle stays ticked, so a bundle you added later with `add`
survives. Untick one in the wizard (or use `remove`) to take it out.

Two things the lockfile can outlive:

- **A bundle that is no longer published.** `update`, `add` and `remove` warn
  (`ghost is installed but no longer in the registry; removing its files`) and remove its files
  rather than refusing to run. Naming it explicitly — `add ghost` — is still an error.
- **An answer the base no longer has.** An axis that vanished upstream is dropped, an answer that
  is no longer one of its options falls back to the axis default, an axis added upstream gets its
  default, and each correction is reported and written back to the lockfile.

## What it writes

Everything lands under the project root you point it at:

```text
.claude/
├── skills/…               # bundle skills
├── rules/…                # bundle rules, globs rewritten for your app directory
├── hooks/…                # hook scripts, made executable
├── settings.json          # committed; deep-merged
├── settings.local.json    # gitignored; permission allowlists
└── skills.lock.json       # committed; what is installed and at which sha, plus your answers
CLAUDE.md
.gitignore                 # a `.claude/settings.local.json` line is added if missing
```

`CLAUDE.md` is created with a title line if it does not exist yet. Each contribution is wrapped in
a marker pair:

```md
<!-- skills:bundle:nuxt -->
- Nuxt 4 uses `app/` as srcDir…
<!-- /skills:bundle:nuxt -->
```

Everything outside those markers is yours and is never touched.

`settings.json` and `settings.local.json` are treated differently because one is meant to be
committed and the other is per-machine: bundle hooks are unioned into `settings.json` by matcher
and command string (a changed timeout replaces the installed entry rather than duplicating it), and
`permissions.deny` entries are merged there too; `permissions.allow` entries go into
`settings.local.json` instead, and the CLI makes sure that file is gitignored.

Each bundle's contribution is recorded in the lockfile once per settings file, so `remove` takes its
hooks and permissions back out of the file it merged them into — a fail-closed hook never stays
armed after its script is deleted — and `update` replaces its own entries instead of stacking new
ones beside them. Anything you added by hand survives `remove` and `update` unless it is
byte-identical to an entry the bundle contributed to that same file: an `allow` you keep in
`settings.json` stays put when the bundle's copy leaves `settings.local.json`.

## The lockfile

`.claude/skills.lock.json` records the registry a project was set up against, the answers given to
every axis, which bundle owns which file (with its content hash), what each bundle merged into each
of the two settings files, and the hash of every CLAUDE.md marker block. `add`, `remove`, `update`, `diff`
and `list` all read it — there is no other place the CLI keeps state, and it is meant to be
committed.

## Updating

Every file and CLAUDE.md block the CLI wrote is hashed at install time. On a later run:

- A **bundle file** whose content still matches the hash on record is `unchanged` — a no-op.
- One that was **edited by hand** since install is `protected`: the CLI refuses to overwrite it
  and leaves it alone, unless you pass `--force`.
- A file that **already existed and was never installed by this CLI** is a `conflict`: interactively
  you are asked, per file, to skip or overwrite it; non-interactively (`--yes`) it is always
  skipped. A skipped conflict is never recorded in the lockfile, so it stays entirely yours. The
  summary names every conflicting and protected path, one per line, and `--json` returns them in
  `skipped`.
- A file a bundle **used to ship and no longer does** is deleted if it still matches its recorded
  hash, and kept with a warning if you edited it.
- A **CLAUDE.md block** you edited by hand no longer matches its recorded hash, so it is kept as-is
  on `update` unless you pass `--force` to replace it with the upstream version.

```bash
pnpx @patrity/skills diff     # what drifted, locally and upstream — nothing is written
pnpx @patrity/skills update   # re-render and apply, with a confirmation
```

## Non-interactive use

Every prompt has a flag, so the wizard runs unattended in a script or a CI job:

```bash
pnpx @patrity/skills init --yes --profile nuxt-app
```

Start from a profile and override individual answers, or skip profiles entirely and list bundles
by hand:

```bash
pnpx @patrity/skills init --yes \
  --profile library \
  --answer pm=npm \
  --answer deploy=vercel \
  --with nuxt,nuxt-ui
```

`--answer` is repeatable and takes `axis=option` pairs; `--with` takes a comma-separated list of
bundle slugs (also repeatable). Add `--json` when a script needs to read the result instead of the
human-readable summary.

## Using another registry

The CLI talks to `https://skills.patrity.com` by default. Point it at any host that serves the same
API — a fork, a staging deploy, or a local `pnpm dev`:

```bash
pnpx @patrity/skills init --registry http://localhost:3000
```

`--registry` works on every command. The registry a project was initialised against is recorded in
`.claude/skills.lock.json` and used automatically by `add`/`remove`/`update`/`diff`/`list` after
that, so you only need to pass it again to point the project somewhere else.

## Releases

Published to npm as [`@patrity/skills`](https://www.npmjs.com/package/@patrity/skills). Releases
are tagged `cli-vX.Y.Z` and built with npm provenance.

Full documentation also lives at [skills.patrity.com/docs/cli](https://skills.patrity.com/docs/cli).

## License

MIT
