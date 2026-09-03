# Skills (registry site)

Nuxt 4 + Nuxt UI v4 site that lists, renders and zips Claude Code bundles stored under `skills/`. Content is read from GitHub at runtime on Vercel; `fs` driver in dev.

## Read first
- Spec: `docs/superpowers/specs/2026-09-03-skills-repository-design.md` (intent, frozen at brainstorm).
- Plan: `docs/superpowers/plans/2026-09-03-skills-repository.md` (what was built, task by task).
- Project skills under `.claude/skills/` and path-scoped rules under `.claude/rules/` load automatically.

## Commands
- Always `pnpm`. `pnpm dev` (port 3000, reads `./skills`). `NUXT_SKILLS_DIR=test/fixtures/skills pnpm dev` for the test bundles.
- `pnpm test:unit` on every change; `pnpm test` (adds the e2e route suite, builds once) before a PR.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm validate:skills`.
- Browser validation: `playwright-cli` via the `browser-testing` skill. Never the Playwright MCP.

## Layout
- `server/lib/skills/` — pure parsing/store logic, relative imports only (vitest + tsx load it without Nuxt).
- `server/utils/skills.ts` — Nitro glue (`useSkillsStore`, `requirePublicSkill`).
- `server/api/skills/**` — list, detail, `file/<path>`, `download`; `server/api/revalidate.post.ts`.
- `app/pages/skill/[...segments].vue` — tree + content; `app/pages/docs/[[slug]].vue` — docs from `content/docs/`.
- `shared/types/skills.ts` — DTOs used on both sides.

## Constraints that bit before
- Vercel ISR ignores query strings: never put cache-varying input in `?query` on a cached route.
- Runtime Cache items ≤ 2 MB: cache per bundle, never the whole snapshot.
- `mdc.highlight.langs` stays a short allow-list; `headings.anchorLinks: false`.
- nuxt-umami config is baked at build time; `NUXT_PUBLIC_UMAMI_ID` is a Production-only build env var.
- `UDashboardPanel`: named slots only, no `grow`. `UTree`: `v-model` = item object, `v-model:expanded` = key strings, pass `get-key`.

## Self-improvement
- When a convention or gotcha emerges, add it here (short) or as a rule/skill (long). Mirror substantive docs to MyMind (project `skills`) and track deferred work as MyMind tasks.
