# Start here

Two things land in your repo: a `CLAUDE.md` assembled from your answers, and a `.claude/` directory of skills, rules and hooks. The browser writes them and so does the terminal, out of the same planner. If you only want one piece of it, skip to step 5.

## Before you start

The `full` and `lightweight` answers to the workflow question describe a process I did not invent. It comes from [Superpowers](https://github.com/obra/superpowers), obra's plugin, and the skills it names are the ones that plugin ships: brainstorming, writing plans, subagent-driven development, test-driven development, and the two-stage code review. The `CLAUDE.md` this setup writes points Claude at that cycle, so I install the plugin into my user plugins, where it covers every project on the machine:

```text
/plugin install superpowers@claude-plugins-official
```

That is the official marketplace. obra's own marketplace works too:

```text
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

The [plugin page](https://claude.com/plugins/superpowers) lists what is in it. Answer `none` to the workflow question and you can skip it.

## 1. Answer the questions in a browser

Open [the builder](/build). Pick a preset (`nuxt-app`, `library`, `docs-only`, or Custom), name the project, and work down the list. Some of the questions only appear once an earlier answer calls for them: say monorepo and it asks where the app directory lives; say you validate in a browser and it asks whether the app has a login; say there is a domain Claude must not guess about and it asks for its name. The right pane composes the `CLAUDE.md` while you answer, and the Files tab lists everything the zip will hold.

**Download setup** gives you a zip of exactly that:

```text
CLAUDE.md
.claude/skills/…             skills from the bundles you ticked
.claude/rules/…              rules, globs rewritten for your app directory
.claude/hooks/…              hook scripts, executable
.claude/settings.json        committed: hooks, only if a bundle contributes some
.claude/settings.local.json  per-machine: permission allowlists, same
.claude/.env.example         only if a bundle you picked declares variables
.claude/skills.lock.json     what is installed, at which sha, and your answers
.gitignore                   one managed block, only if there is anything to ignore
```

The lines that say *only if* mean it. A zip of documentation bundles alone comes out as a `CLAUDE.md`, a lockfile and a couple of skill files.

Unzip it into a new project folder. There is no wrapper directory: the paths are already relative to a project root. Nothing in the zip is merged with files you have, so if the folder already holds a `CLAUDE.md` or a `.claude/`, run the CLI there instead.

**Copy share link** puts the whole form state in the URL hash, which is the only thing this site remembers. Send the link and someone else opens your exact answers. **Copy CLI command** copies the `pnpx @patrity/skills init --yes …` invocation that reproduces the same state.

There is a catch with that command, and you should hear it from me. Untick something the preset recommends and the command drops `--profile` and spells your answers out instead, so the preset itself cannot put the bundle back.. but an answer still can. Saying you validate UI in a browser selects `browser-testing` however you got there, and a bundle you kept may suggest one you dropped. When that happens, take it out again with `remove`, or download the zip instead.

## 2. Or answer them in a terminal

```bash
pnpx @patrity/skills
```

With no subcommand it runs `init`, the same wizard in a terminal. Node 22 or newer; `npx` and `bunx` work too. It prints the plan before it writes anything, and if you decline you get `Nothing written.` and an untouched directory.

After that, `add <slug>` installs another bundle, `update` re-renders everything against the current registry, and `diff` shows what drifted: your hand edits on one side, upstream changes on the other. The [CLI reference](/docs/cli) has every command and flag.

The CLI also picks up where the builder left off. A zip holds what `init` writes into an empty directory, lockfile included, so unzip one and `pnpx @patrity/skills diff` should report no local drift.

## 3. The file you fill in yourself

If the run wrote `.claude/.env.example`, copy it and fill in the values:

```bash
cp .claude/.env.example .claude/.env
```

`.claude/.env` is yours. The CLI never creates it, never reads it, never deletes it. Skills read that file rather than the repo root `.env`, so you can point Claude at a read-only database replica while the app keeps its own connection string. The example beside it is fully managed and regenerated on every run, so edit `.claude/.env` and leave the example alone.

## 4. Commit the lockfile

Commit `CLAUDE.md` and `.claude/`, including `.claude/skills.lock.json`. The lockfile is the only state the CLI keeps: which bundles are installed, at which registry sha, and the answers you gave. Delete it and `add`, `update`, `diff` and `list` have nothing to read.

`.claude/settings.local.json` and `.claude/.env` stay out of git. The managed `.gitignore` block already lists them, along with any cache directory an installed bundle declares.

## 5. Or take one bundle

None of this is all-or-nothing. Every skill, rule and hook here is also published as a bundle you can download on its own. See [Single bundle](/docs/single-bundle).
