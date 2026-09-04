# CLI

`@patrity/skills` installs bundles from this registry into a project and keeps them up to date. It writes the same files you would otherwise download and unzip, plus a `CLAUDE.md` assembled from your answers.

## Install

There is nothing to install globally — run it straight from npm:

```bash
pnpx @patrity/skills
```

With no command it runs `init`. Node 22 or newer is required. `npx` and `bunx` work the same way.

## Commands

| Command | What it does |
| --- | --- |
| `init` (default) | The wizard. Asks the base questions with defaults pre-selected, then offers profiles and the bundle list grouped by tag, shows a dry-run summary of every file it would create or change, and applies it once you confirm. |
| `add <slug…>` | Installs bundles into a project that has already been initialised, pulling in anything they declare in `dependsOn`. |
| `remove <slug…>` | Removes a bundle's marker blocks and the files it owns. Files it did not create are left alone. |
| `update [slug…]` | Refetches bundles whose upstream sha changed, and re-renders the base fragments when the schema version changed. Shows the diff before applying. |
| `diff` | Compares local files against the lockfile hashes (your hand edits) and the lockfile against the registry (upstream drift). |
| `list` | Prints the installed bundles, the answers on record, and whether each bundle is behind upstream. |

Flags accepted everywhere: `--dir <path>` (work in another directory), `--registry <url>`, `--yes`, `--force`, `--json`. `init` additionally takes `--profile <name>`, `--with <a,b>` and `--answer <axis>=<option>`.

## What it writes

Everything lands under the project root you point it at:

```text
.claude/
├── skills/…               # bundle skills
├── rules/…                # bundle rules, globs rewritten for your app directory
├── hooks/…                # hook scripts, made executable
├── settings.json          # committed; deep-merged
├── settings.local.json    # gitignored; permission allowlists
└── skills.lock.json       # committed; what is installed and at which sha
CLAUDE.md
```

`CLAUDE.md` is created with a title line if it does not exist yet. Each contribution is wrapped in a marker pair:

```md
<!-- skills:bundle:nuxt -->
- Nuxt 4 uses `app/` as srcDir…
<!-- /skills:bundle:nuxt -->
```

Everything outside those markers is yours and is never touched. See [Base and profiles](/docs/base-and-profiles) for how the sections are ordered.

The two settings files are treated differently. `settings.json` is meant to be committed, so bundle hooks are unioned into it by their command string and `permissions.deny` entries are merged. `settings.local.json` is per-machine: bundle `permissions.allow` entries go there, and the CLI makes sure it is gitignored.

## Updating

`update` compares the hash of each marker block with the hash in `.claude/skills.lock.json`. A block you edited by hand no longer matches, so the CLI refuses to overwrite it and prints the diff instead. Pass `--force` when you want your edit replaced by the upstream version.

The same protection applies to bundle files: a file that exists but is not owned by the bundle being installed is a conflict, and you are asked whether to skip, overwrite or see the diff.

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

`--answer` is repeatable and takes `axis=option` pairs; `--with` takes a comma-separated list of bundle slugs. With `--yes`, conflicting files are skipped rather than prompted for, and the summary at the end says which ones. Add `--json` when a script needs to read the result.

## Using another registry

The CLI talks to `https://skills.patrity.com` by default. Point it at any host that serves the same API — a fork, a staging deploy, or a local `pnpm dev`:

```bash
pnpx @patrity/skills init --registry http://localhost:3000
```

`--registry` works on every command, including `update` and `diff`, and the registry the project was initialised against is recorded in the lockfile.
