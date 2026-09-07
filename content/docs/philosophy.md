# Philosophy

A handful of choices decide what is in this setup. They are mine, and they come apart: disagree with one and you can skip the bundle or change the answer that carries it. Nothing else moves.

## Rules and skills stay apart

A rule is a short markdown file with a `paths:` glob. It loads on its own whenever Claude touches a matching file, and it says what must be true: this package manager, migrations only from CI, never guess at the domain. It does not explain how to do any of it.

A skill is the procedure, and it has to be invoked. Steps, commands, the gotcha that cost an afternoon.. all of it lives there, and a session reads it once, when it needs it.

Keeping them apart is what keeps my `CLAUDE.md` short enough that Claude still reads it. When a rule starts describing a procedure, I move that part into a skill and link to it. [`nuxt`](/skill/nuxt) and [`nuxt-ui`](/skill/nuxt-ui) are the plainest version: a rule saying "fetch the real docs, do not recall them", and a skill that knows how to fetch them.

## Hooks fail closed

I kept forgetting the same checks, so I moved them into hooks and let the harness run them. [`quality-hooks`](/skill/quality-hooks) wires the ones I want on every project. `protect-env.sh` refuses edits to `.env` and credential files. `lint-check.sh` runs the linter after every write and hands the failure back in the same turn. A `PreCompact` prompt asks whether the session learned a convention worth writing down, in the last moment where the context that learned it still exists.

The part I care about is the missing-file case. Each wiring runs the script if it is on disk. Otherwise it asks git whether that script is supposed to be there, and exits 2 if it is. A bad checkout refuses the edit instead of quietly allowing it. The obvious one-liner, `[ ! -f "$s" ] || exec "$s"`, does the opposite: the gate disappears the moment the file does.

[`readonly-db`](/skill/readonly-db) comes from the same instinct. A role with `SELECT` and nothing else, and a runner that wraps every statement in `BEGIN READ ONLY`. Neither is a sandbox, and the skill says so, but both remove a class of accident I would rather not rely on prose for.

The `enforcement` axis is where you choose: reminders in `CLAUDE.md` and rules, or the hooks.

## Docs in three tiers, one of them tested

Handovers say what shipped and what was deferred. The wiki says how a system works today. Specs and plans say what was intended, frozen at the time. One job each, three different lifetimes.

The wiki is the tier that rots on me, because it is the one that has to change when the code does. [`docs-discipline`](/skill/docs-discipline) makes that mechanical: `docs/wiki/_systems.json` registers every system, and a test fails when a registered system has no page, or a page exists that nobody registered. Drift shows up as a red test in the commit that caused it. That is the `mechanical` answer to the `docs` axis; `reminder` gives you the same three tiers as prose, and `none` skips them.

## UI work is checked in a browser, with `playwright-cli`

Typecheck, lint and unit tests all pass on a component that never mounted, a Tailwind class that resolved to nothing, and a page that throws on hydration. So I drive the change myself before I call it finished.

[`browser-testing`](/skill/browser-testing) carries that workflow: install `playwright-cli` from npm if it is missing, snapshot, act on refs, assert with `eval`, take a screenshot and read it, then a mobile pass. What I keep from a run is the commands and their output. The rule also says never the Playwright MCP while the CLI is available, so there is one browser session and one source of truth for refs.

Answer `playwright-cli` to the `browser` axis and the setup also scaffolds `.claude/skills/<project>-browser-testing/SKILL.md`, where the dev command, the port and the routes worth checking belong. Say yes to the login follow-up and it adds a place for the dev test account, which is the only kind of credential I want anywhere near a skill.

## Memory and process are questions

Two answers turn parts of my own habits on and off, because they are the parts most likely to be wrong for your project.

The `memory` axis wires the [MyMind](https://github.com/Patrity/mymind) MCP server: search before answering from recollection, mirror docs into it, keep tasks there. It is my own memory server, and it is useful to me across sessions and useless to you unless you run it, so it is a question and it is off by default.

The `workflow` axis sets how much process a change goes through. That process is not mine either. It comes from [Superpowers](https://github.com/obra/superpowers), obra's plugin, and the steps are its skills: `brainstorming`, `writing-plans`, `subagent-driven-development`, `test-driven-development`, and `requesting-code-review` for the two-stage review. `full` runs the lot: brainstorm, a design spec, an implementation plan, a subagent-driven build under TDD, then the review. `lightweight` keeps a short spec in chat and TDD where practical, with no plan documents. `none` leaves Claude to work the way it would anyway. If you answer `full` or `lightweight`, install the plugin as well: [Start here](/docs/start-here) has the command, and the [plugin page](https://claude.com/plugins/superpowers) lists everything in it.
