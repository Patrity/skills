# Philosophy

Five opinions decide what is in this setup. They are mine, and they are separable: disagree with one and skip the bundle or the answer that enforces it. Nothing else breaks.

## Rules carry the direction, skills carry the how-to

A rule is a short markdown file with a `paths:` glob. It loads on its own whenever Claude touches a matching file, and it says what must be true — this package manager, migrations only from CI, never guess at the domain. It does not explain how to do any of it.

A skill is the procedure, and it has to be invoked. Steps, commands, the gotcha that cost an afternoon: all of that lives there, and a session reads it once, when it needs it.

Splitting them is what keeps `CLAUDE.md` short enough that Claude still reads it. When a rule starts describing a procedure, it should be linking to a skill instead. [`nuxt`](/skill/nuxt) and [`nuxt-ui`](/skill/nuxt-ui) show the pattern at its plainest: a rule saying "fetch the real docs, do not recall them", and a skill that knows how to fetch them.

## Hooks fail closed

A line in `CLAUDE.md` is a suggestion. A `PreToolUse` hook is not.

[`quality-hooks`](/skill/quality-hooks) wires three. `protect-env.sh` refuses edits to `.env` and credential files. `lint-check.sh` runs the linter after every write and hands the failure back in the same turn. A `PreCompact` prompt asks whether the session learned a convention worth writing down, in the last moment where the context that learned it still exists.

What makes them worth having is the missing-file case. Each wiring runs the script if it is on disk, and otherwise asks git whether that script is supposed to be there — exiting 2 if it is. A bad checkout refuses the edit instead of quietly allowing it. The obvious one-liner, `[ ! -f "$s" ] || exec "$s"`, gets this exactly backwards: the gate disappears the moment the file does.

[`readonly-db`](/skill/readonly-db) comes from the same instinct. A role with `SELECT` and nothing else, and a runner that wraps every statement in `BEGIN READ ONLY`. Neither is a sandbox and the skill says so, but both remove a class of accident that no amount of prose can.

The `enforcement` axis is where you choose: reminders in `CLAUDE.md` and rules, or the hooks.

## Docs come in three tiers, and one of them is tested

Handovers say what shipped and what was deferred. The wiki says how a system works today. Specs and plans say what was intended, frozen at the time. One job each, three different lifetimes.

The wiki is the tier that rots, because it is the one that has to change when the code does. [`docs-discipline`](/skill/docs-discipline) makes that mechanical: `docs/wiki/_systems.json` registers every system, and a test fails when a registered system has no page, or a page exists that nobody registered. Drift becomes a red test rather than six quiet months. That is the `mechanical` answer to the `docs` axis; `reminder` gives you the same three tiers as prose, and `none` skips them.

## UI work is proven in a real browser, with `playwright-cli`

Typecheck, lint and unit tests all pass on a component that never mounted, a Tailwind class that resolved to nothing, and a page that throws on hydration. So a UI change is not done until someone drove it.

[`browser-testing`](/skill/browser-testing) carries that workflow: install `playwright-cli` from npm if it is missing, snapshot, act on refs, assert with `eval`, take a screenshot and read it, then a mobile pass. Evidence means the commands and their output, not "verified, looks good". The rule also says never the Playwright MCP while the CLI is available: one browser session, one source of truth for refs.

Answer `playwright-cli` to the `browser` axis and the setup also scaffolds `.claude/skills/<project>-browser-testing/SKILL.md`, where the dev command, the port and the routes worth checking belong. Say yes to the login follow-up and it adds a place for the dev test account, which is the only kind of credential that should ever be near a skill.

## Memory and process are opt-in

Two answers turn parts of my own habits on and off, because they are the parts most likely to be wrong for your project.

The `memory` axis wires the MyMind MCP server: search before answering from recollection, mirror docs into it, keep tasks there. It is genuinely useful across sessions and completely useless if you do not run that server, so it is a question rather than a default in the base.

The `workflow` axis sets how much process a change goes through. `full` is brainstorm, a design spec, an implementation plan, TDD, then a two-stage review. `lightweight` keeps a short spec in chat and TDD where practical, with no plan documents. `none` leaves Claude to work the way it would anyway. A one-file bugfix does not need a spec; a rewrite does.
