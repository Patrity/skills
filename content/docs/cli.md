# CLI

[![npm](https://img.shields.io/npm/v/@patrity/skills)](https://www.npmjs.com/package/@patrity/skills)

`@patrity/skills` installs bundles from this registry into a project and keeps them up to date. It writes the same files you would otherwise download and unzip, plus a `CLAUDE.md` assembled from your answers.

## Install

There is nothing to install globally — run it straight from npm:

```bash
pnpx @patrity/skills
```

With no command it runs `init`. Node 22 or newer is required. `npx` and `bunx` work the same way.

Releases are tagged `cli-vX.Y.Z` and published to [npmjs.com/package/@patrity/skills](https://www.npmjs.com/package/@patrity/skills) with npm provenance.

## Commands

| Command | What it does |
| --- | --- |
| `init` (default) | The wizard. Asks the base questions with defaults pre-selected, then offers profiles and the bundle list grouped by tag, shows a dry-run summary of every file it would create or change, and applies it once you confirm. |
| `add <slug…>` | Installs bundles into a project that has already been initialised, pulling in anything they declare in `dependsOn`. |
| `remove <slug…>` | Removes a bundle's marker blocks and the files it owns. Files it did not create are left alone. |
| `update [slug…]` | Re-renders every installed bundle from the current registry and reports what changed. Naming slugs only narrows which must already be installed — the plan is always a full re-render, so upstream fragment and schema changes reach every bundle. |
| `diff` | Compares local files against the lockfile hashes (your hand edits) and the registry snapshot sha in the lockfile against the current one (upstream drift). |
| `list` | Prints the installed bundles, the answers on record, and whether the installed snapshot is behind the registry. |

Flags accepted everywhere: `--dir <path>` (work in another directory), `--registry <url>`, `--yes`, `--force`, `--json`. `init` additionally takes `--profile <name>`, `--with <a,b>` and `--answer <axis>=<option>`.

Re-running `init` on a project that already has a lockfile edits it rather than starting over: the recorded answers are the starting point (a `--profile` and `--answer` flags override them, and the wizard shows them pre-selected) and everything installed stays ticked, so bundles added later with `add` survive. Untick one in the wizard to remove it.

If a bundle you have installed is no longer published, `update`, `add` and `remove` say so and remove its files instead of refusing to run. Answers recorded against an older base are reconciled the same way: an axis that no longer exists is dropped, an answer that is no longer an option falls back to the axis default, and both are reported.

Windows, macOS and Linux are all supported.

## What it writes

Everything lands under the project root you point it at:

```text
.claude/
├── skills/…               # bundle skills
├── rules/…                # bundle rules, globs rewritten for your app directory
├── hooks/…                # hook scripts, made executable
├── settings.json          # committed; deep-merged
├── settings.local.json    # gitignored; permission allowlists
└── skills.lock.json       # committed; what is installed, at which sha, and your answers
CLAUDE.md
```

`CLAUDE.md` is created with a title line if it does not exist yet. Each contribution is wrapped in a marker pair:

```md
<!-- skills:bundle:nuxt -->
- Nuxt 4 uses `app/` as srcDir…
<!-- /skills:bundle:nuxt -->
```

Everything outside those markers is yours and is never touched. See [Base and profiles](/docs/base-and-profiles) for how the sections are ordered.

The two settings files are treated differently. `settings.json` is meant to be committed, so bundle hooks are unioned into it by matcher and command string and `permissions.deny` entries are merged. `settings.local.json` is per-machine: bundle `permissions.allow` entries go there, and the CLI makes sure it is gitignored. What each bundle merged in is recorded in the lockfile, so removing the bundle takes its hooks and permissions back out — leaving everything you added by hand exactly where it is.

## Updating

`update` re-renders everything and reports what changed. It compares the hash of each marker block with the hash in `.claude/skills.lock.json`: a block you edited by hand no longer matches, so the CLI keeps your version and lists it as hand-edited rather than overwriting it. Pass `--force` when you want your edit replaced by the upstream version.

The same protection applies to bundle files. A file that was installed and then edited is `protected` and left alone; a file that exists but was never installed by the CLI is a `conflict`, and you are asked per file whether to skip it or overwrite it with the bundle version. Either way the plan summary names the paths it did not write.

A file a bundle used to ship and no longer does is removed if you never touched it, and kept with a warning if you did.

```bash
pnpx @patrity/skills diff     # what drifted, locally and upstream
pnpx @patrity/skills update   # apply, with a confirmation
```

## Non-interactive use

Every prompt has a flag, so the wizard runs unattended in a script or a CI job:

```bash
pnpx @patrity/skills init --yes --profile nuxt-app
```

Start from a profile and override individual answers, or skip profiles entirely:

```bash
pnpx @patrity/skills init --yes \
  --profile library \
  --answer pm=npm \
  --answer deploy=vercel \
  --with nuxt,nuxt-ui
```

`--answer` is repeatable and takes `axis=option` pairs; `--with` takes a comma-separated list of bundle slugs. With `--yes`, conflicting files are skipped rather than prompted for, and the summary at the end lists them one per line (`conflict: .claude/hooks/pre-commit.sh (kept yours)`). Add `--json` when a script needs to read the result — skipped paths come back in its `skipped` array.

## Using another registry

The CLI talks to `https://skills.patrity.com` by default. Point it at any host that serves the same API — a fork, a staging deploy, or a local `pnpm dev`:

```bash
pnpx @patrity/skills init --registry http://localhost:3000
```

`--registry` works on every command, including `update` and `diff`, and the registry the project was initialised against is recorded in the lockfile.
