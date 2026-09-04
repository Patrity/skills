# Base and profiles

The wizard does not paste a template into your project. It answers a short list of questions, collects one markdown **fragment** per answer, adds the `CLAUDE.md` snippet from every bundle you picked, and merges them into a single file where each rule lands under the heading it belongs to. This page describes the pieces and how to add your own.

"The wizard" is two front ends over one implementation. [The builder](/build) runs in the browser and `pnpx @patrity/skills init` runs in a terminal, but the questions, the fragments, the pre-ticked bundles and the composition all come from `shared/setup/` — the same `planFresh()` the CLI calls. So an axis you add here shows up in both, and the zip the builder downloads holds the files `init` writes into an empty directory. The one difference is scope: `init` can also merge into a project that already has a `CLAUDE.md`, and the builder only ever plans a fresh one.

## The section convention

`base/sections.yaml` defines the canonical, ordered sections. Every base fragment and every bundle `CLAUDE.md` snippet is markdown whose `##` headings must be canonical titles (or `## @<id>`); the content under a heading is that section's contribution. Content before any heading lands in `skills-and-rules`. One snippet may contribute to several sections.

| id | heading | typical content |
| --- | --- | --- |
| `intro` | *(title line + one paragraph)* | project name and one-liner from the wizard |
| `read-first` | Read first | pointers to handovers, wiki, specs |
| `stack` | Stack | frameworks and versions |
| `commands` | Commands | package manager, scripts |
| `workflow` | Workflow | brainstorm → spec → plan → TDD → review |
| `testing` | Testing | TDD rules, browser validation, test-account pointer |
| `docs` | Docs | three-tier doc model, handover/wiki rules |
| `git` | Git | commit/push policy, conventions, no trailers |
| `deploy` | Deploy | target, branch model, platform gotchas |
| `constraints` | Constraints that bit before | hard rules and gotchas |
| `memory` | Memory | MyMind rules |
| `skills-and-rules` | Skills and rules | which skill to invoke when; which rules exist |
| `self-improvement` | Self-improvement | the relentless-improvement block |

Rendering rules:

- Only sections with content are emitted, in canonical order, each heading exactly once.
- Within a section: base fragments first (schema order), then bundles alphabetically by slug.
- Each contribution is wrapped in `<!-- skills:<source-id> -->` … `<!-- /skills:<source-id> -->` where `source-id` is `base:<axis>=<option>`, `base:always/<name>`, or `bundle:<slug>`.
- Text outside markers is the user's and is never modified. If the user already has a heading matching a canonical title, contributions are inserted under it instead of duplicating it.
- Placeholders (below) are rendered in snippets and in rule `paths:` frontmatter.
- `validate:skills` rejects a snippet whose headings are not canonical.

## Placeholders

| Placeholder | Renders to | Use it for |
| --- | --- | --- |
| `{{pm}}` | `pnpm`, `npm`, `yarn`, `bun` | commands — `{{pm}} test` |
| `{{pmx}}` | `pnpx`, `npx`, `yarn dlx`, `bunx` | one-off runners — `{{pmx}} tsx scripts/x.ts` |
| `{{appDir}}` | `app`, or the `appDir` answer (`apps/web/app`) | app-code globs — `{{appDir}}/**/*.vue` |
| `{{pkgDir}}` | nothing in a single-app repo; the package root with a trailing slash (`apps/web/`) in a monorepo | every other path inside the package — `{{pkgDir}}server/**`, `{{pkgDir}}nuxt.config.ts` |
| `{{projectName}}` | the project name | scaffold destinations and titles |

`{{pkgDir}}` is written *immediately* before the path, with no slash of your own: it disappears in
a single-app repo and becomes `apps/web/` when the app lives in `apps/web/app`. Leave a path at the
repo root (`.claude/**`, CI config) unprefixed — those do not move. A text-input axis contributes a
placeholder of its own id as well, so `appDir` is both an answer and `{{appDir}}`.

## Writing a fragment

A fragment is a plain markdown file under `base/fragments/<axis>/<option>.md`. It carries the rules for exactly one answer — one option, one fragment — so that picking a different option swaps the whole block cleanly.

```md
## Commands
- Always `pnpm` — never npm or yarn. If the project ever has a `package-lock.json` use npm; a `yarn.lock` means yarn.
- `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
```

Rules for the file:

- Use only `##` headings, and only canonical titles (or `## @<id>`). Anything else fails validation.
- Go straight to the rules. There is no `#` title: the heading structure of the finished `CLAUDE.md` comes from the section convention, not from the fragment.
- Reach for the placeholders instead of hardcoding: `{{pm}}` and `{{pmx}}` for the package manager, `{{appDir}}` for the app's source directory, `{{pkgDir}}` before any other path inside the package, `{{projectName}}` for the project.
- Files under `base/always/` follow the same rules but skip the questions — every generated `CLAUDE.md` gets them.

## Axes

`base/questions.yaml` is the ordered list of questions. Each axis has an id, a question, a default, and either a set of `options` or a free-text `input`:

```yaml
version: 1
axes:
  - id: docs
    question: How should project docs be kept?
    default: mechanical
    options:
      - { id: mechanical, label: "Three-tier docs with a wiki-parity test", fragment: docs/mechanical.md, selects: [docs-discipline] }
      - { id: reminder, label: "Three-tier docs, reminder only", fragment: docs/reminder.md }
      - { id: none, label: None }

  - id: browser
    question: How is UI work validated?
    default: playwright-cli
    options:
      - id: playwright-cli
        label: playwright-cli in a real browser
        fragment: testing/playwright-cli.md
        selects: [browser-testing]
        scaffolds:
          - { template: browser-testing-project.md, to: ".claude/skills/{{projectName}}-browser-testing/SKILL.md" }
      - { id: none, label: No browser validation }

  - id: appDir
    question: Where does the app's srcDir live, relative to the repo root?
    when: { axis: layout, option: monorepo }
    input: { placeholder: apps/web/app, default: apps/web/app }
```

The keys that do the work:

- `fragment` — the file under `base/fragments/` this option contributes. An option with no fragment (`none`, `off`) simply contributes nothing.
- `selects` — bundles to pre-tick in the bundle step when this option is chosen.
- `scaffolds` — files the CLI writes from `base/templates/`, with placeholders rendered in both the template and the destination path. `mode: append` adds to a file an earlier scaffold created.
- `when` — asks the question only if an **earlier** axis has a given answer, so follow-ups stay hidden until they are relevant.
- `input` — a free-text answer instead of options; the value is available as a placeholder.

## Profiles

A profile is a named starting point: a set of answers plus a set of bundles. One file per profile under `profiles/<name>.yaml`, with `name` matching the file name.

```yaml
name: library
description: A package or library — lightweight process, hooks, no browser validation.
answers: { pm: pnpm, layout: single, workflow: lightweight, docs: reminder, memory: "on", commits: proactive, pushes: ask, browser: none, enforcement: hooks, deploy: none, domain: "off" }
bundles: [quality-hooks]
```

The wizard offers profiles first and pre-fills every answer from the one you pick; you can still change any of them. Non-interactively that is `--profile library`, with `--answer <axis>=<option>` for the overrides. Quote YAML values like `on`, `off`, `no` and `yes` — unquoted they parse as booleans and no longer match an option id.

## Validation

`pnpm validate:skills` checks the base schema and the profiles alongside the bundles:

- Every `##` heading in every fragment, `always/` file and bundle `CLAUDE.md` resolves to a canonical section.
- `sections.yaml` lists exactly the canonical section ids, in order.
- Every axis has either options or an input, its default is one of its options, ids are unique, and each `when.axis` refers to an earlier axis and a real option of it.
- Every `rules/*.md` in a bundle has a non-empty `paths:` list — a rule with no globs never loads.
- Every `{{…}}` token in a snippet, rule, skill, fragment, template or scaffold destination is a known placeholder or the id of a text-input axis.
- Every `fragment` and every `scaffolds.template` path exists, and every `selects` entry names a real bundle.
- Every profile's `name` matches its file name, every answer names a real axis and a real option, and every bundle in `bundles` exists.
- `base/` and `profiles/` are scanned for secrets and private infrastructure along with `skills/`.

CI runs it on every pull request, so a fragment with a stray heading never reaches the registry.

## How bundles contribute

A bundle's own `CLAUDE.md` is a snippet, not a page. It follows the same heading rules as a fragment, which is what lets the CLI file each part of it under the right section instead of appending a wall of text:

```md
## Stack
- Nuxt 4 with `app/` as srcDir; Nuxt UI v4 components over raw markup.

## Constraints that bit before
- `UDashboardPanel` takes named slots only — no `grow` prop.
```

Two optional frontmatter keys let a bundle describe its neighbours:

- `dependsOn: [slug]` — required companions. `add` and the wizard install them automatically.
- `suggests: [slug]` — related bundles, pre-ticked in the wizard but easy to untick.

Both take registry slugs and are validated. They are distinct from `requires`, which lists external tooling the bundle needs on your machine (`python3`, `playwright-cli`). See the [frontmatter reference](/docs/frontmatter) for the full list of keys.
