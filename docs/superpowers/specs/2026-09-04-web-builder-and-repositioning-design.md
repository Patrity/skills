# Web builder and repositioning — design

Date: 2026-09-04. Status: approved in brainstorm, frozen here. Builds on `2026-09-03-composable-setups-and-cli-design.md` (the section convention, base schema, CLI merge semantics) and the shipped `@patrity/skills` 0.1.0.

## 1. Purpose

Two things the current site does not do:

1. Say whose setup this is and how to take all of it. Today the home page, README and docs describe a generic registry of downloadable bundles; the wizard is the third section on the home page and a separate docs page.
2. Offer the wizard on the web. Today the only way to get a composed `CLAUDE.md` plus `.claude/` is the CLI.

This spec adds a `/build` page that runs the same wizard as the CLI in the browser with a live preview and downloads a zip identical to what `pnpx @patrity/skills init` would write, and it reframes the site, README and docs as Tony's opinionated Claude Code setup with two ways in (web builder, CLI) and a third for single bundles.

## 2. Non-goals

- Merging into an existing project on the web (no upload of an existing `CLAUDE.md`; the zip is for a fresh project; the CLI handles updates).
- Accounts, saved setups, or server-side state. Sharing is a URL.
- Changing the base schema, the section convention, or any bundle content.
- Prompting for secret values anywhere (the CLI and the builder only ever write `.claude/.env.example`).

## 3. Decisions already made

| Decision | Choice | Why |
| --- | --- | --- |
| Zip contents | Same as CLI `init`, including `.claude/skills.lock.json` | A project started on the web can be taken over by `pnpx @patrity/skills add/update` |
| Page shape | Single page, form left, live preview right | The web's advantage over the CLI is seeing the composed file as you answer |
| Where composition runs | Browser for the preview, server for the zip, both through the same shared planner | Instant preview, one source of truth, preview and zip are byte-identical |
| Copy | Rewritten as Tony's opinionated setup; every new or rewritten line goes through the `humanizer` skill before commit | The value is the opinions, not the file format |

## 4. The `/build` page

### 4.1 Layout

Route `/build`, a `UDashboardPanel` with two panes (named slots only, per the Nuxt UI constraints in `CLAUDE.md`). One `<h1>` via `UDashboardNavbar` `#left`.

Left pane, top to bottom:

- **Profile presets**: a `URadioGroup` of cards for each registry profile (`nuxt-app`, `library`, `docs-only`) plus "Custom". Picking a profile sets its answers and pre-ticks its bundles (plus `selects`/`suggests` of the chosen options, exactly as `preselectedBundles` does in the CLI). Editing any answer or bundle afterwards switches the preset to "Custom".
- **Project name**: `UInput`, default `my-project`, validated as a basename (`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`). Drives `{{projectName}}`, the `CLAUDE.md` title, the scaffold path and the zip filename.
- **Axes**: one control per active axis in schema order; `USelect` for option axes, `UInput` for text axes (placeholder from `input.placeholder`). Follow-up axes appear only when their `when` holds (`activeAxes`). Text-axis answers become placeholders, as in the CLI.
- **Bundles**: `UCheckbox` list grouped by first tag (`groupByTag`), each row showing name, description and badges. `dependsOn` bundles are auto-ticked and locked while any dependant is ticked (tooltip says which). `suggests` of ticked bundles show a "recommended" chip. Bundles with `errors` are not listed (same filter as the manifest).
- **Actions**: primary `UButton` "Download setup" (`.zip`), secondary "Copy CLI command" which copies `pnpx @patrity/skills init --yes --profile <p> --with <slugs> --answer axis=option …` reproducing the current state (`--profile` omitted for Custom; `--answer` only for values that differ from the profile/defaults).

Right pane, `UTabs`:

- **CLAUDE.md**: the composed document, shown as source by default and as rendered markdown behind a toggle (see 4.3).
- **Files**: a `UTree` of the zip contents with sizes, built from the plan's `FileOp`s plus `CLAUDE.md`, settings files, `.gitignore` and the lockfile.
- **Warnings**: listed under the tabs when non-empty (unknown placeholders, omitted snippets), using the same message text as the CLI.

### 4.2 Data flow

- On load: `GET /api/cli/manifest` (existing, ISR, ~20 KB). If `errors` is non-empty the form is disabled with a banner: "The base schema has errors; the builder is disabled until they are fixed."
- Per selected bundle: `GET /api/skills/<slug>/file/CLAUDE.md` (existing, ISR) for the snippet, cached in the composable for the page lifetime. A failed fetch omits that bundle's contribution and adds a warning naming the bundle.
- Composition: a `useSetupPlan()` composable calls the shared `planFresh()` synchronously on every change and exposes `plan`, `claudeMd`, `files`, `warnings`.
- Download: `POST /api/build` with `{ projectName, answers, bundles }`; the response is saved as `<projectName>-claude-setup.zip`. The button shows a spinner and disables during the request; a failure shows a toast with the server's message.
- Share: the page state is encoded in the URL hash on every change (`#p=<profile|custom>&n=<projectName>&a=<axis:value,…>&b=<slug,…>`) and decoded on load; unknown slugs or axes in the hash are dropped with a warning.

### 4.3 Preview rendering

The CLAUDE.md tab shows the composed markdown as source in the existing `CodeView` component (read-only CodeMirror, `markdown` language) by default. A rendered view is provided by the existing server-side markdown pipeline through `POST /api/build/render` accepting `{ markdown }` and returning the `MarkdownBody` AST, debounced at 400 ms and only while the "Rendered" toggle is on. This keeps `<MDC :value>` out of the browser (a constraint that bit before) and reuses `renderMarkdown()`.

### 4.4 Errors and edge cases

- No profile chosen, no bundles ticked: the preview still composes base fragments only; download is allowed (a base-only setup is valid).
- A bundle whose snippet fetch fails: warning, contribution omitted, files still included in the zip (the server has the files).
- Text axis left empty: the axis default is used, as in the CLI.
- Very long project names or invalid characters: inline validation, download disabled.

## 5. Shared planner and the build route

### 5.1 Code moves (no behaviour change for the CLI)

- `shared/setup/contributions.ts` ← `cli/src/contributions.ts`, unchanged (`activeAxes`, `contributionsFor`, `scaffoldsFor`).
- `shared/setup/plan.ts` ← the fresh-project half of `cli/src/plan.ts`: `planFresh(input: { manifest: CliManifest; projectName: string; answers: Record<string, string>; bundles: string[]; bundleFiles: Record<string, BundleFiles>; registry: string }): SetupPlan` where every `FileOp` is `create`, `removals` is empty, `handEdited` is empty, and the lock is built from scratch (including per-file settings contributions). `varsFor` moves with it.
- `shared/setup/wizard.ts` ← the pure parts of `cli/src/wizard.ts` (`defaultAnswers`, `applyProfile`, `validateAnswers`, `preselectedBundles`, `resolveBundles`, `groupByTag`, `reconcileAnswers`); `parseAnswerFlags` stays in the CLI.
- `shared/types/setup.ts` gains `Lockfile`, `LockBundle`, `LockSettings`, `SetupPlan`, `FileOp`, `BundleFiles` (the CLI re-exports them from its modules so its imports do not change).
- `cli/src/plan.ts` keeps `buildPlan()` as a wrapper: it calls `planFresh` and then applies the existing-project logic (classification, protection, conflicts, removals, settings subtraction, hand-edit detection). The CLI's 92 tests are the regression net for the move and must pass unchanged.
- Constraint: `shared/setup/*` stays free of Node-only imports; `sha256` becomes the pure implementation in 5.4.

### 5.2 `POST /api/build`

- Nitro route `server/api/build.post.ts`, not ISR, `Cache-Control: no-store`, no `Vercel-Cache-Tag`.
- Body: `{ projectName: string; answers: Record<string, string>; bundles: string[] }`, validated with zod: `projectName` matches the basename pattern; `bundles` are public slugs (`isPublicSkill`) with no duplicates and at most 50; `answers` pass `validateAnswers` against the manifest base; body over 16 KB → 413.
- Loads bundle files through `useSkillsStore` (per-bundle cache), calls `planFresh` with `registry = runtimeConfig.public.siteUrl`, and returns `buildSetupZip(plan)` with `Content-Type: application/zip` and `Content-Disposition: attachment; filename="<projectName>-claude-setup.zip"`.
- Errors: 400 with `{ statusMessage }` using the same wording the CLI prints (`unknown bundle: x`, `pm: "bun2" is not an option`); 503 when the snapshot is cold (existing `getManifestsOr503`).

### 5.3 `buildSetupZip(plan)`

`server/lib/setup/setup-zip.ts` beside the existing `buildZip`: entries in sorted order — `CLAUDE.md`, every `FileOp.path`, `.claude/settings.json` and `.claude/settings.local.json` when present, `.gitignore` (the managed block from 10.2), `.claude/.env.example` when any bundle declares `env` (10.3), `.claude/skills.lock.json` (serialized with `serializeLockfile`). Hook scripts (`.claude/hooks/*`) carry external attributes for mode 0755 so `unzip` restores them. Fixed mtime (the snapshot's `committedAt`) so identical plans yield identical bytes.

### 5.4 `sha256` in shared code

The lock hashes are SHA-256 hex. In the CLI this is `node:crypto`; in the browser it must not be. `shared/setup/hash.ts` exports `sha256(bytes | string): string` implemented with a small pure TypeScript SHA-256 (no dependency, ~60 lines, tested against known vectors). The CLI switches to it so both sides hash identically. Performance is irrelevant at these sizes (tens of KB).

### 5.5 `POST /api/build/render`

Accepts `{ markdown: string }` (≤ 256 KB), returns `renderMarkdown(markdown, 'CLAUDE.md')`'s body AST. `no-store`. Used only by the preview's "Rendered" toggle.

## 6. Caching, sharing, analytics

- `/build` route rule: `isr: 300`, `Vercel-Cache-Tag: skills`; added to the warm list. The HTML carries no answers.
- `/api/build` and `/api/build/render` are POST, uncached, no route rule.
- State in the URL hash only (never the query, which would fragment the ISR cache).
- Analytics through `useAnalytics`: `setup-build-download` `{ profile, bundles, axes }` on a successful zip; `setup-build-copy-cli` `{ profile }` on copy. Both are added to the analytics composable with the existing wrapper pattern.

## 7. Copy and information architecture

### 7.1 Home (`app/pages/index.vue`)

- Hero: headline "Tony's opinionated Claude Code setup"; description: one sentence saying you answer a few questions and get a `CLAUDE.md` and a `.claude/` directory that match how I work, plus one sentence saying every piece is a bundle you can take on its own. Primary CTA "Build it on the web" → `/build`; secondary the `SkillInstallCommand` with `pnpx @patrity/skills init`.
- Section order: Build (short blurb + CTA) → What's in the box (the axes in plain words: package manager, layout, workflow, testing, docs, git policy, deploy, memory, enforcement; and the nine bundles as chips) → How it works (bundles mirror `.claude/`, sections convention, lockfile) → Latest.
- Byline under the hero: "by Patrity" linking to the GitHub profile.

### 7.2 README

Opening paragraph mirrors the hero. Then "Two ways in" (web builder, CLI), "Use a single bundle", "Philosophy" (five bullets: rules carry direction and skills carry how-to; fail-closed hooks; three-tier docs; `playwright-cli` not a Playwright MCP; memory and handovers when the project wants them), "Contributing" (welcome, curated), the existing structure/development sections.

### 7.3 Docs (`content/docs`)

- New `start-here.md`: web builder walkthrough (with the share link), then the CLI one-liner, then a pointer to single bundles. First in the nav.
- `getting-started.md` renamed `single-bundle.md` ("Use a single bundle"), content unchanged apart from the intro.
- New `philosophy.md`: the five bullets expanded to a paragraph each, with links to the bundles that implement them.
- `cli.md` and `base-and-profiles.md` each gain a short paragraph linking the builder and stating that both paths produce the same files.
- Nav order: Start here, Philosophy, CLI, Base and profiles, Use a single bundle, Bundle structure, Frontmatter, Hooks and settings, Contributing.
- Redirect: `/docs/getting-started` → `/docs/single-bundle` via a route rule so existing links keep working.

### 7.4 Copy process

Draft, then run the `humanizer` skill (`~/.claude/skills/humanizer`) over every new or rewritten sentence in the hero, README and docs, then the task reviewer checks each claim against shipped behaviour (commands, flags, file names, counts). No sentence promises something the code does not do.

## 8. Testing

Unit (root vitest, `test/fixtures`): `planFresh` (ordering, placeholders incl. `{{pkgDir}}`, scaffolds, settings split, lock contents), `buildSetupZip` (entry names, modes, gitignore line, deterministic bytes), `sha256` vectors, the hash-state codec (encode/decode round-trip, unknown keys dropped).

CLI (`cli/test`, unchanged plus one): the existing 92 tests pass after the move; one new integration case runs `init --yes` against the fake registry and `planFresh` with the same input and asserts identical `CLAUDE.md` and lock.

E2E (root `pnpm test`): `POST /api/build` happy path (zip entries equal an in-process `planFresh` plan byte for byte), 400 on unknown bundle / bad answer / bad project name, 413 on an oversized body, `Cache-Control: no-store`; `POST /api/build/render` returns an AST; `/build`, `/docs/start-here`, `/docs/philosophy` render; `/docs/getting-started` redirects.

Browser (`playwright-cli`, `:3210`): pick `nuxt-app`; set `layout` to monorepo and see `appDir`; untick a bundle and see its marker blocks leave the preview; download, unzip into a temp dir, run `pnpx @patrity/skills diff` there and expect a clean result; reload a share link and see the same state; one `<h1>`; no console errors; 375 px width.

Gitignore and env (unit + CLI integration + e2e): frontmatter parsing and validation of `gitignore`/`env`; the managed `.gitignore` block is created, regenerated and removed without touching lines outside it (CRLF file, file without trailing newline, block already present); `.claude/.env.example` regenerated from installed bundles and dropped when none declares env; `remove` subtracts a bundle's entries; the zip contains the same block and example file as the CLI; the validator rejects a bundle `.env.example` with a non-placeholder value.

## 9. Rollout

One implementation plan, executed subagent-driven on `main`, pushed at the end (Vercel deploys the site; the `warm` workflow refills caches). The CLI's on-disk behaviour changes (section 10), so the plan ends with `cli/package.json` at `0.2.0` and the tag `cli-v0.2.0`. Update `CLAUDE.md` (builder route, `no-store` rule for the two POST routes, hash-state convention, managed gitignore block) and the MyMind handover.

## 10. Bundle-declared gitignore entries and `.claude/.env`

### 10.1 Frontmatter

Two optional keys in a bundle README's frontmatter (`SkillFrontmatter`, zod schema in `server/lib/skills/frontmatter.ts`, documented in the frontmatter reference):

```yaml
gitignore:
  - .claude/skills/nuxt-docs/cache/
env:
  - name: DATABASE_URL_RO
    description: Read-only Postgres connection string used by the db:q runner.
    required: true
    example: postgres://<app>_claude_ro:<password>@<host>/<database>
```

Validation (validator and `parseBundle` errors): `gitignore` entries are project-relative, contain no `..` segment, are not absolute, and end with `/` when they name a directory; `env[].name` matches `^[A-Z][A-Z0-9_]*$` and is unique within the bundle; `example`, when present, contains no real-looking secret (the secrets scanner runs over it). Summaries expose both keys (`SkillSummary`), and the bundle page shows "Gitignore" and "Environment" rows beside "Requires".

### 10.2 Managed `.gitignore` block

The CLI (`applyPlan`) and the web zip stop appending loose lines and own exactly one block in the project's root `.gitignore`:

```
# >>> skills (managed by @patrity/skills; edit outside this block)
.claude/settings.local.json
.claude/.env
.claude/skills/nuxt-docs/cache/
# <<< skills
```

Rules: the block is regenerated on every run from the installed bundles (sorted, de-duplicated); `.claude/settings.local.json` is present whenever a local settings file is written and `.claude/.env` whenever any installed bundle declares `env`; lines outside the block are never modified; a file with no block gets the block appended after one blank line; when the block would be empty it is removed; CRLF files are preserved as CRLF. `ensureGitignoreLine` is replaced by `renderGitignoreBlock(existing, entries)` in `shared/setup/gitignore.ts` (pure, shared by CLI and zip). The lockfile records each bundle's `gitignore` entries (`LockBundle.gitignore: string[]`) so `remove` subtracts them.

### 10.3 `.claude/.env.example`

When any installed bundle declares `env`, the CLI and the zip write `.claude/.env.example`, fully managed (regenerated each run, never merged), one group per bundle:

```
# skills: readonly-db
# Read-only Postgres connection string used by the db:q runner. (required)
DATABASE_URL_RO=postgres://<app>_claude_ro:<password>@<host>/<database>
```

`.claude/.env` itself is never created, read or modified by the tool. The lockfile records each bundle's env names (`LockBundle.env: string[]`); when no installed bundle declares env, the example file is removed if it is byte-identical to what the tool last wrote (hash in `lock.scaffolds`-style ownership), otherwise left with a warning.

### 10.4 Skill convention

Skills read configuration from `.claude/.env` only, never from the repo root `.env`, so a project can point a skill (for example `readonly-db`) at a different resource than the application uses. Documented patterns: shell — `set -a; . "$CLAUDE_PROJECT_DIR/.claude/.env"; set +a`; Python — `dotenv_values(Path(__file__).resolve().parents[2] / '.env')` or an explicit path argument; Node — `process.loadEnvFile('.claude/.env')`. Caches live under the skill's own directory and are declared in `gitignore`. `protect-env.sh` already blocks Claude from editing any file whose basename is `.env`, which covers `.claude/.env`; `.env.example` stays editable.

Content changes in this spec: `readonly-db` declares `DATABASE_URL_RO` and its runner reads `.claude/.env`; `nuxt-docs`, `nuxt-ui-docs`, `nuxt-ui-templates` and `doc-fetcher` declare their cache directories; the Contributing docs gain the convention; `hooks-and-settings.md`, `bundle-structure.md`, `frontmatter.md` and `cli.md` describe the two keys, the managed block and the example file.

### 10.5 Registry validator

New checks: `gitignore`/`env` shape as in 10.1; a bundle that ships a `.env.example` file directly (rather than declaring `env`) is an error with a pointer to the convention; skills that reference `process.env`/`os.environ` without loading `.claude/.env` are not detectable mechanically and are covered by review, not by the validator.
