# Start here

The setup is a `CLAUDE.md` assembled from your answers plus a `.claude/` directory of skills, rules and hooks. Two paths write it, and they write the same files. If you only want one piece of it, skip to step 5.

## 1. Build it on the web

Open [the builder](/build). Pick a preset (`nuxt-app`, `library`, `docs-only`, or Custom), name the project, and work down the questions. The right pane shows the composed `CLAUDE.md` while you answer; the Files tab lists everything the zip will hold.

**Download setup** gives you a zip of exactly that:

```text
CLAUDE.md
.claude/skills/…             skills from the bundles you ticked
.claude/rules/…              rules, globs rewritten for your app directory
.claude/hooks/…              hook scripts, executable
.claude/settings.json        committed: hooks — only if a bundle contributes some
.claude/settings.local.json  per-machine: permission allowlists — same
.claude/.env.example         only if a bundle you picked declares variables
.claude/skills.lock.json     what is installed, at which sha, and your answers
.gitignore                   one managed block, only if there is anything to ignore
```

The lines that say *only if* are exactly that: a zip of documentation bundles alone comes out as a `CLAUDE.md`, a lockfile and a couple of skill files.

Unzip it into a new project folder. There is no wrapper directory: the paths are already relative to a project root. Nothing in the zip is merged with files you have, so if the folder already holds a `CLAUDE.md` or a `.claude/`, run the CLI there instead.

**Copy share link** puts the whole form state in the URL hash, which is the only way this site remembers anything — send the link and someone else opens your exact answers. **Copy CLI command** copies the `pnpx @patrity/skills init --yes …` invocation that reproduces the same state.

One catch with that command. Untick something the preset recommends and the command drops `--profile` and spells your answers out instead, so the preset itself cannot put it back — but an answer still can. Saying you test in a browser selects `browser-testing` however you got there, and a bundle you kept may suggest one you dropped. When that happens, take it out again with `remove`, or download the zip instead.

## 2. Or run the CLI

```bash
pnpx @patrity/skills
```

With no subcommand it runs `init`, the same wizard in a terminal. Node 22 or newer; `npx` and `bunx` work too. It prints the plan before it writes anything, and if you decline you get `Nothing written.` and an untouched directory.

After that, `add <slug>` installs another bundle, `update` re-renders everything against the current registry, and `diff` shows what drifted — your hand edits on one side, upstream changes on the other. The [CLI reference](/docs/cli) has every command and flag.

The CLI also picks up where the builder left off. A zip holds what `init` writes into an empty directory, lockfile included, so unzip one and `pnpx @patrity/skills diff` should report no local drift.

## 3. Fill in `.claude/.env`

If the run wrote `.claude/.env.example`, copy it and fill in the values:

```bash
cp .claude/.env.example .claude/.env
```

Skills read `.claude/.env` rather than the repo root `.env`, so you can point Claude at a read-only database replica while the app keeps its own connection string. The example file is fully managed and regenerated on every run, so edit `.claude/.env` and leave the example alone.

## 4. Commit `CLAUDE.md` and `.claude/`

Commit both, including `.claude/skills.lock.json`. The lockfile is the only state the CLI keeps: which bundles are installed, at which registry sha, and the answers you gave. Delete it and `add`, `update`, `diff` and `list` have nothing to read.

`.claude/settings.local.json` and `.claude/.env` stay out of git. The managed `.gitignore` block already lists them, along with any cache directory an installed bundle declares.

## 5. Or take a single bundle

None of this is all-or-nothing. Every skill, rule and hook here is also published as a bundle you can download on its own — see [Single bundle](/docs/single-bundle).
