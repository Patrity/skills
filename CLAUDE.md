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
- `bash scripts/warm-cache.sh <site-url>` re-fills every ISR entry after a purge or a deploy (CI does it automatically).
- Browser validation: `playwright-cli` via the `browser-testing` skill. Never the Playwright MCP.

## Layout
- `server/lib/skills/` — pure parsing/store logic, relative imports only (vitest + tsx load it without Nuxt).
- `server/utils/skills.ts` — Nitro glue (`useSkillsStore`, `requirePublicSkill`).
- `server/api/skills/**` — list, detail, `file/<path>`, `download`; `server/api/revalidate.post.ts`.
- `app/pages/skill/[...segments].vue` — tree + content; `app/pages/docs/[[slug]].vue` — docs from `content/docs/`.
- `shared/types/skills.ts` — DTOs used on both sides.

## Constraints that bit before
- Every distinct query string is a separate ISR cache entry (no `allowQuery` is emitted): keep cache-varying input in the path, and warm payload URLs with the exact `?_b=<buildId>` the client sends.
- Runtime Cache items ≤ 2 MB: cache per bundle, never the whole snapshot.
- `mdc.highlight.langs` stays a short allow-list; `headings.anchorLinks: false`.
- nuxt-umami config is baked at build time; `NUXT_PUBLIC_UMAMI_ID` is a Production-only build env var.
- `UDashboardPanel`: named slots only, no `grow`. `UTree`: `v-model` = item object, `v-model:expanded` = key strings, pass `get-key`.
- `UDashboardNavbar` nests its `<h1>` inside `#left`'s default content: override `#left` (not `#title`) to keep one h1 per page.
- Markdown is parsed server-side (`server/utils/markdown.ts` → `MarkdownView :body`). Never `<MDC :value>`: it re-parses in the browser and hits `/api/_mdc/highlight` once per code block.
- `nitro.serverAssets` needs an absolute `dir`; a relative one mounts an empty store.
- `/build` is ISR + `Vercel-Cache-Tag: skills` like every other page; `POST /api/build` and `POST /api/build/render` set `Cache-Control: no-store` themselves (they answer per request body, which ISR cannot key on).
- Builder state lives in the URL hash, never the query: a query string would be its own ISR entry per share link. Every hash field is attacker-controlled — `n=`, `a=` and `b=` are each validated in `decodeBuildState`, and a dropped value raises a warning the page toasts.
- `shared/setup/**` must stay Node-free (the browser bundles it): no `node:` imports, no `process`. `renderFresh` is the single render both planners use — `planFresh` (web zip) and `buildPlan` (CLI overlay) — so a new `SetupPlan` field must be handled in both.
- The `.gitignore` block is `# >>> skills (managed by @patrity/skills; edit outside this block)` … `# <<< skills`, regenerated every run; an unterminated one leaves the whole file alone with a warning. `.claude/.env.example` is fully managed (rewritten every run, deleted with the last bundle that declares `env`); `.claude/.env` is never created, read or deleted.

## Production (verified 2026-09-03)
- https://skills.patrity.com on Vercel team `patritys-projects`, project `skills`; repo `Patrity/skills` is public. Vercel CLI is linked from this directory (`.vercel/`, gitignored).
- Env (Vercel): `NUXT_SKILLS_SOURCE=github`, `NUXT_PUBLIC_SITE_URL`, `UMAMI_DOMAINS`, `NUXT_REVALIDATE_SECRET` (sensitive; same value as the GitHub Actions secret `REVALIDATE_SECRET`), `NUXT_GITHUB_TOKEN` (sensitive), `NUXT_PUBLIC_UMAMI_ID` (production only). Do NOT set `NUXT_PUBLIC_GITHUB_*` unless overriding — empty values override the config defaults and break every GitHub URL.
- `invalidateByTag('skills')` DOES purge ISR entries: after `POST /api/revalidate` the next hit is `x-vercel-cache: STALE`, then `HIT`. No bypass-token fallback needed.
- A skills-only push is ignored by Vercel (`scripts/should-build.sh`) and the `revalidate` workflow puts the new sha on the CDN in ~5 s. A redeploy of the same commit (env changes) always builds.
- Env changes need a redeploy: `vercel redeploy <latest-production-url> --scope patritys-projects`.
- CLI `@patrity/skills` (workspace `cli/`) is published from `.github/workflows/release-cli.yml` on `cli-v*` tags (repo secret `NPM_TOKEN`); first release `cli-v0.1.0` on 2026-09-04, next tag `cli-v0.2.0`. Bump `cli/package.json` and add the `cli/README.md` changelog entry before tagging — the workflow refuses a mismatched tag. Smoke: `pnpm dlx @patrity/skills init --yes --profile nuxt-app --json` in a scratch dir.
- A push that adds API routes AND touches `skills/**` makes the `revalidate` workflow's warm step 404 on the new routes (it runs before Vercel finishes deploying); the deploy-triggered `warm` workflow fixes it. Expected, not a regression.
- A local `.env` that sets `NUXT_SKILLS_DIR` or `NUXT_REVALIDATE_SECRET` overrides the e2e fixture config and fails 14 `pnpm test` assertions; unset them (or use `.env.example` values only) before running the e2e suite.

## Self-improvement
- When a convention or gotcha emerges, add it here (short) or as a rule/skill (long). Mirror substantive docs to MyMind (project `skills`) and track deferred work as MyMind tasks.
