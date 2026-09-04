# Composable Claude Code Setups + CLI — Design Spec

**Date:** 2026-09-03
**Status:** approved in brainstorm, awaiting implementation plan
**Builds on:** `2026-09-03-skills-repository-design.md` (the registry site, live at https://skills.patrity.com)

## 1. Purpose

Turn the registry into an opinionated, composable Claude Code setup. A CLI (`pnpx @patrity/skills`)
runs a wizard in a project directory: it asks a few questions that assemble a **base `CLAUDE.md`**,
lets the user pick **bundles** (skills, rules, hooks, settings), then writes `.claude/` and a single
coherent `CLAUDE.md` where every contribution lands in a **canonical section**. A lockfile makes the
result idempotent and updatable (`add`, `update`, `diff`, `remove`).

Content (base fragments, profiles, bundles) stays in this repo and is served by the site at runtime,
so editing a fragment is live in seconds, exactly like bundles today. The CLI is a thin client.

## 2. Non-goals (v1)

- Managing the user's global `~/.claude/` (project scope only; a `--global` mode is a later phase).
- A web version of the wizard (`/setup`) — later; v1 shows the CLI command on the site.
- Auto-migrating existing projects' CLAUDE.md files; `init` works on fresh or hand-written files but
  never rewrites text outside its markers.
- New bundles beyond the seed list in §8 (`blog-pipeline`, design-skill consolidation are tracked as
  MyMind tasks).

## 3. The CLAUDE.md section convention

`base/sections.yaml` defines the canonical, ordered sections. Every base fragment and every bundle
`CLAUDE.md` snippet is markdown whose `##` headings must be canonical titles (or `## @<id>`); the
content under a heading is that section's contribution. Content before any heading lands in
`skills-and-rules`. One snippet may contribute to several sections.

| id | heading | typical content |
|---|---|---|
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
- Each contribution is wrapped in `<!-- skills:<source-id> -->` … `<!-- /skills:<source-id> -->`
  where `source-id` is `base:<axis>=<option>`, `base:always/<name>`, or `bundle:<slug>`.
- Text outside markers is the user's and is never modified. If the user already has a heading
  matching a canonical title, contributions are inserted under it instead of duplicating it.
- Placeholders `{{pm}}`, `{{pmx}}`, `{{appDir}}`, `{{projectName}}` are rendered in snippets and in
  rule `paths:` frontmatter.
- `validate:skills` rejects a snippet whose headings are not canonical.

## 4. Base schema, fragments, profiles

```
base/
├── sections.yaml              # §3
├── questions.yaml             # ordered axes → options (id, label, default, fragment, followUps, selects)
├── fragments/<axis>/<option>.md
├── always/*.md                # every base gets these
└── templates/                 # files the wizard scaffolds (e.g. project browser-testing skill)
profiles/<name>.yaml           # { name, description, answers: {axis: option}, bundles: [slug] }
```

### 4.1 Axes (v1)

| axis | options (default first) | fragment / effect |
|---|---|---|
| `pm` | pnpm, npm, yarn, bun | lockfile-detection rule, standard scripts; sets `{{pm}}`/`{{pmx}}` |
| `layout` | single, monorepo (follow-up: app dir, default `apps/web`) | sets `{{appDir}}`; the CLI rewrites `app/**`-style globs in installed rules so none is silently dead |
| `workflow` | full, lightweight, none | full = superpowers cycle + two-stage review + verification-before-done; lightweight = spec + TDD only |
| `docs` | mechanical, reminder, none | mechanical selects the `docs-discipline` bundle (wiki-parity test); reminder = prose only |
| `memory` | on, off | the MyMind block (source typo "deffered" fixed) |
| `commits` | proactive, ask | when Claude may commit |
| `pushes` | ask, proactive | when Claude may push. Conventional commits and "no co-author/model trailers" are always on |
| `browser` | playwright-cli, none | selects the `browser-testing` bundle |
| ↳ `auth` | no, yes | scaffolds `.claude/skills/{{projectName}}-browser-testing/SKILL.md` from a template: dev URL, snapshot→ref→act login flow, `state-save`/`state-load`; with `yes` it adds the test-account section (register in dev only; credentials live in this skill, never in a bundle) with `TODO` fields the first session fills in |
| `enforcement` | prose, hooks | hooks selects the `quality-hooks` bundle |
| `deploy` | vercel, railway, homelab, static, none | platform gotchas fragment (module-scope leaks, `numReplicas: 1`, production-branch traps) |
| `domain` | off, on (follow-up: domain name) | the domain-humility clause |

Axis options may `selects: [bundle]` (auto-tick), and bundles may declare `dependsOn: [slug]` and
`suggests: [slug]` in README frontmatter (the existing `requires` key keeps meaning external tooling).

### 4.2 Seed profiles
- `nuxt-app`: all defaults + `nuxt`, `nuxt-ui`, `browser-testing`, `quality-hooks`, `docs-discipline`.
- `library`: workflow lightweight, browser none, docs reminder + `quality-hooks`.
- `docs-only`: docs mechanical, memory on, everything else none/off + `docs-discipline`.

## 5. CLI — `@patrity/skills`

Workspace package `cli/` in this repo. TypeScript, `tsup` → ESM, Node ≥ 22, `@clack/prompts`,
`fflate`. Imports shared types from `shared/` at build time; no runtime dependency on the Nuxt app.
Registry defaults to `https://skills.patrity.com` (`--registry` overrides). Sends
`User-Agent: @patrity/skills/<version>`.

### 5.1 Commands
| command | behaviour |
|---|---|
| `init` (default) | wizard: base axes with defaults pre-selected → bundles grouped by tag, profiles offered first, `dependsOn`/`suggests`/`selects` pre-ticked → dry-run summary (files to create/change, sections touched) → apply. Non-interactive: `--yes`, `--profile <name>`, `--with a,b`, `--answer axis=option` (repeatable) |
| `add <slug…>` | install bundles into an initialised project (resolves `dependsOn`) |
| `remove <slug…>` | remove a bundle's marker blocks and the files it owns (never files it didn't create) |
| `update [slug…]` | refetch bundles whose upstream sha changed and re-render base fragments if the schema version changed; shows a diff, applies with confirmation (or `--yes`) |
| `diff` | local files vs lockfile hashes (hand edits) and lockfile vs registry (upstream drift) |
| `list` | installed bundles, answers, upstream status |
| global flags | `--dir <path>`, `--registry <url>`, `--yes`, `--force`, `--json` |

### 5.2 Merge semantics
- **CLAUDE.md**: §3. Created with `# {{projectName}}` if missing. `update` refuses to overwrite a
  marker block whose hash differs from the lockfile (hand-edited) unless `--force`, and prints the diff.
- **`.claude/settings.json`** (committed): deep merge; `hooks[*]` unioned by `command` string;
  `permissions.deny` and `enabledPlugins` unioned. **`.claude/settings.local.json`**: bundle
  `permissions.allow` entries unioned here; the CLI ensures it is gitignored.
- **Bundle files** (`skills/`, `rules/`, `hooks/`): copied; hook scripts `chmod +x`. A pre-existing
  file not owned by the same bundle is a conflict → prompt (skip / overwrite / diff); `--yes` skips
  and reports.
- **Lockfile** `.claude/skills.lock.json` (committed): `registry`, `schemaVersion`, `answers`,
  `bundles[slug] = { sha, files: { path: sha256 } }`, `blocks[sourceId] = sha256`.

## 6. Registry changes (site + API)

- Snapshot parser also ingests `base/**` and `profiles/**`; `validate:skills` validates the question
  schema (every option has a fragment; every profile references real slugs/answers; snippet headings
  canonical). Bundle frontmatter gains optional `dependsOn`, `suggests`; bundles may ship
  `settings.json` in addition to `settings.local.json`.
- Routes (ISR + `Vercel-Cache-Tag: skills`; added to the warm list):
  `GET /api/base` (sections, axes, options, fragments, always), `GET /api/profiles`,
  `GET /api/cli/manifest` (base + profiles + bundle summaries + snapshot sha, one call),
  `/api/skills` gains `dependsOn`/`suggests`.
- Site: install one-liner with copy button on cards and bundle pages (`skill-install-copy` event);
  a "Start a project" section on the home page; docs pages "CLI" and "Base and profiles".

## 7. Packaging and release

- `pnpm-workspace.yaml` adds `cli`. `scripts/should-build.sh` excludes `cli/**`.
- `ci.yml` gains a `cli` job (lint, typecheck, vitest, build). `release-cli.yml` on tags `cli-v*`:
  build, test, `npm publish --provenance --access public` with `NPM_TOKEN`.
- Manual version bumps; one tag per release.

## 8. Content work (v1)

| bundle | contents | source / stripping |
|---|---|---|
| `nuxt` (extend) | reconciled `nuxt4.md`, `ssr.md`, `backend.md`, `database.md`, `cli.md` rules; snippet re-sectioned | newest variants (codethis-dev/helpy-ai `backend.md`, cognova-docs `nuxt4.md`); YAML-list `paths:`, `{{appDir}}` globs |
| `nuxt-ui` (extend) | reconciled `nuxt-ui.md` rule; snippet re-sectioned | drop the leaked mymind brand mapping |
| `browser-testing` (adjust) | snippet re-sectioned; no other change | — |
| `quality-hooks` (new) | `hooks/protect-env.sh`, `hooks/lint-check.sh` (`{{pm}}`, workspace flag from `layout`), `settings.json` PreToolUse/PostToolUse using the fail-closed pattern, PreCompact "save insights as rules" prompt hook | byte-identical hooks from 9 projects; fail-closed skeleton from Revival without its scripts |
| `docs-discipline` (new) | `docs/` skeleton (`handovers/`, `wiki/_systems.json`, `superpowers/`), `handover` skill, wiki-parity vitest, three-tier rule | 2d-rpg `wiki-parity.md`, the seven identical handover blocks |
| `doc-fetcher` (new) | generator skill scaffolding `<lib>-docs` skills (version detection, 24 h cache, `--list/--status/--force`) | nuxt-docs, colyseus-docs, phaser-docs, neon-postgres |
| `iterative-spec-design` (new) | as is | daily-games |
| `readonly-db` (new) | read-only role + statement allowlist + `BEGIN READ ONLY` runner | Revival `db-query`; never copy homelab's `ai-cost-analytics` credentials |
| `remote-ops` (new) | the nested `ssh … pct exec … bash -lc` quoting gotcha | mymind `prod-deploy`, hosts removed |

Base fragments are written from the corpus phrasing. Every published file is scanned for secrets,
IPs and hostnames before merge (`validate:skills` gains a simple pattern check for `sk-`, `password`,
`192.168.`, `10.`, `@<host>:` in bundle content).

## 9. Testing

- `cli/` unit tests: section rendering (insert/replace/remove per marker; existing user heading
  reuse), placeholder rendering, settings deep-merge, allowlist routing, lockfile hashing and drift,
  conflict classification, glob rewriting for `layout`, dependency resolution, schema validation.
- `cli/` integration tests: fake registry from fixtures (manifest + zips built with fflate) + temp
  project dir; `init --yes --profile …`, `add`, `update` after a fixture sha change, `remove`, `diff`,
  hand-edit guard.
- Registry e2e: `/api/base`, `/api/profiles`, `/api/cli/manifest`; validator covers schema/profile/
  heading rules; browser check of the install command and copy button.
- Release smoke: `pnpx ./cli init --profile nuxt-app --yes` in a scratch dir against production, then
  open Claude Code there and confirm rules load.

## 10. Decisions

| decision | choice | why |
|---|---|---|
| composition | wizard (base axes → bundles) | user's model of "build up" |
| where content lives | registry repo, served at runtime | edits live in seconds; CLI stays thin |
| CLAUDE.md layout | canonical sections + per-source markers | coherent document, deterministic targets, safe updates |
| lifecycle | lockfile + update/diff/remove | idempotent, team-shareable |
| scope | project only in v1 | global mode later |
| settings split | hooks/deny/plugins → `settings.json`; allowlists → `settings.local.json` | matches every surveyed project |
| commits/pushes | wizard asks both | corpus contradicts itself |
| `paths:` frontmatter | YAML list, validated against layout | two syntaxes coexisted; dead globs bit before |
