# Skills Repository — Design Spec

**Date:** 2026-09-03
**Status:** approved in brainstorm, awaiting implementation plan
**Repo:** `Patrity/skills` (public, open source) · **Deploy:** Vercel · **Stack:** Nuxt 4, Nuxt UI v4, Nitro

## 1. Purpose

A simple, open-source registry for reusable Claude Code setups ("bundles", addressed as
"skills" in URLs). Each bundle mirrors a project's `.claude/` directory — any combination of
`skills/`, `rules/`, `hooks/`, `settings.local.json`, and a `CLAUDE.md` pointer snippet — and
ships with a README whose frontmatter is the registry metadata.

The web app renders those bundles: a home page explaining the project, a searchable index, a
per-bundle page with a file tree and rendered content, a docs section on how to structure a
bundle, zip download, links to GitHub source, and Umami analytics. Content is read from GitHub
at runtime so publishing a bundle never requires rebuilding the app.

Primary audience is the repo owner. Contributions are welcome but not the design driver.

## 2. Non-goals (v1)

- No editing UI, no auth, no database.
- No CLI installer (`npx … add`). Install is: download zip, drop into `.claude/`.
- No per-bundle versioning or changelog beyond GitHub history links.
- No reading view/download counts back from Umami (tracked as a follow-up task).
- Browser E2E tests are local only, not in CI.

## 3. Repo layout and bundle format

```
/                         Nuxt app root (app/, server/, nuxt.config.ts, package.json …)
skills/                   published bundles, one directory each; dir name = slug = URL
  <slug>/
    README.md             REQUIRED. YAML frontmatter (metadata) + install/usage docs
    skills/<name>/SKILL.md, …       optional
    rules/*.md                      optional
    hooks/*                         optional (scripts referenced by settings)
    settings.local.json             optional
    CLAUDE.md                       optional pointer snippet to paste into a project CLAUDE.md
content/docs/*.md         app docs (ships with the build, not runtime content)
.claude/                  this repo's own dev setup
docs/superpowers/         specs and plans
```

### 3.1 Slug rules
`^[a-z0-9][a-z0-9-]*$`. Directory name is authoritative; `name` in frontmatter is display only.

### 3.2 README frontmatter schema

| key | type | required | notes |
|---|---|---|---|
| `name` | string | yes | display name |
| `description` | string | yes | one or two sentences, used on cards and `<meta>` |
| `tags` | string[] | yes | lowercase; drive the index filter chips |
| `author` | string | yes | |
| `authorUrl` | string (url) | no | |
| `requires` | string[] | no | external tooling, e.g. `["python3"]` |

Validation failures (missing README, missing required key, bad slug): the bundle is listed with a
warning badge in dev (`fs` driver) and omitted in prod. The `validate-skills` CI step fails on them.

### 3.3 Derived metadata
Computed from the tree, never hand-written: content badges (`skills`, `rules`, `hooks`,
`settings`, `claude-md`) from which entries exist, `fileCount`, `totalBytes`. Freshness is
snapshot-level, not per bundle: the snapshot carries `sha` and `committedAt` (commit date of the
branch head, or newest file mtime for `fs`); per-bundle last-commit dates would cost one API call
per bundle and are out of scope for v1.

### 3.4 Exclusions
Any `cache/` directory (doc-fetcher skills gitignore theirs), dotfiles other than
`settings.local.json`, and files over 1 MB (kept in the tree as `oversized`, not served or zipped).
Binary files (sniffed) are listed but rendered as a download-only placeholder.

### 3.5 Zip contents
The bundle directory verbatim (README included), rooted at `<slug>/`. Unzipping yields a folder
whose contents merge into a project's `.claude/`.

## 4. Server (Nitro)

### 4.1 Source drivers — `server/utils/skills-source/`

```ts
interface SkillsSource { loadSnapshot(): Promise<Snapshot> }
interface Snapshot {
  sha: string            // git sha (github) or 'fs-' + mtime hash (fs)
  committedAt: string    // branch head commit date (github) or newest mtime (fs)
  fetchedAt: string
  skills: SkillManifest[]
  files: Map<string, Uint8Array>   // key: "<slug>/<relative path>"
}
```

- **`fs`** — walks `./skills` on disk. Selected when `NODE_ENV !== 'production'` or
  `SKILLS_SOURCE=fs`. Zero network in dev.
- **`github`** — two requests per refresh, both with optional `Authorization: Bearer $GITHUB_TOKEN`
  (public repo: the token only lifts the rate limit): `GET /repos/{owner}/{repo}/commits/{branch}`
  for `sha` + `committedAt`, then `GET /repos/{owner}/{repo}/tarball/{sha}`. Gunzip + untar in
  memory (`nanotar`), keep only `skills/**` entries, apply §3.4 exclusions. Non-2xx or a tarball
  with no `skills/` dir throws; the caller keeps serving the previous memoised snapshot if one
  exists and returns 503 otherwise.
- **Shared parser** (`parse-bundle.ts`): frontmatter via `gray-matter`, schema validation via
  `zod`, tree builder, badge derivation, text/binary sniff, language-from-extension.

### 4.2 Caching (Vercel)

| layer | what | key/tag | ttl |
|---|---|---|---|
| module-scope memo | last `Snapshot` per warm instance | — | until instance dies or purge sha differs |
| Runtime Cache (`@vercel/functions` `getCache()`) | `skills:manifest` (list + trees, no contents); `skills:file:<slug>/<path>` per file | tag `skills` | 24 h safety net |
| CDN / ISR (route rules) | `/`, `/skills`, `/skill/**`, `/api/skills/**` → `isr: 300`; `/api/skills/*/download` → `swr: 300` | — | 5 min floor, stale-while-revalidate |

Freshness comes from purges (§4.3), not TTL. Per-file cache keys keep every Runtime Cache item
under the 2 MB limit. In dev the cache layer is a no-op passthrough.

### 4.3 API routes

| route | behaviour |
|---|---|
| `GET /api/skills` | `{ sha, committedAt, skills: [...] }` — each: slug, name, description, tags, author, authorUrl, requires, badges, fileCount, totalBytes |
| `GET /api/skills/:slug` | one manifest with full tree |
| `GET /api/skills/:slug/file?path=` | `{ path, language, size, content, kind: 'text'\|'binary'\|'oversized' }`; path normalised and rejected if it escapes the bundle; 404 otherwise |
| `GET /api/skills/:slug/download` | `application/zip` via `fflate`, `Content-Disposition: attachment; filename="<slug>.zip"` |
| `POST /api/revalidate` | requires `Authorization: Bearer $REVALIDATE_SECRET`; calls `invalidateByTag('skills')` (purges CDN + Runtime Cache), clears the module memo, reloads, returns `{ sha }` |
| `GET /api/health` | `{ ok, source, sha, committedAt, fetchedAt }` |
| `GET /sitemap.xml`, `GET /robots.txt` | generated from the manifest and `siteUrl` |

### 4.4 Runtime config

Server: `githubOwner` (`Patrity`), `githubRepo` (`skills`), `githubBranch` (`main`), `githubToken`,
`revalidateSecret`, `skillsSource`. Public: `siteUrl`. Umami is configured through the
`nuxt-umami` module options (§6), overridable at runtime by the module's own
`NUXT_PUBLIC_UMAMI_*` env vars.

## 5. Frontend

### 5.1 Rendering
SSR everywhere (public content, SEO/OG). CodeMirror is the only client-only component.
`useSeoMeta` on every page from manifest data; OG title/description per bundle.

### 5.2 Pages

| route | content |
|---|---|
| `/` | `UPageHero` + `UPageSection`s: what this is, bundle anatomy, how to install (unzip into `.claude/`, paste the CLAUDE.md pointer), how to contribute (PR a dir under `skills/`), grid of bundles (max 6, order from `/api/skills`) linking to `/skills`, GitHub link |
| `/skills` | search input + tag filter chips (client-side over `/api/skills`); cards with name, description, tags, author, badges, **View source** (GitHub tree URL on the production branch) and **Download** buttons |
| `/skill/[slug]` and `/skill/[slug]/[...path]` | one page component; no path → README, path → that file; unknown slug/path → 404 |
| `/docs` and `/docs/[slug]` | app docs rendered from `content/docs/*.md` imported with `?raw`; left nav from an ordered list: Getting started, Bundle structure, Frontmatter reference, Hooks and settings, Contributing |

### 5.3 Layout — `layouts/default.vue`
`UDashboardGroup` → slim collapsible `UDashboardSidebar` (logo, nav: Home, Skills, Docs, GitHub,
`UColorModeButton`) + page slot. Skill and docs pages render two `UDashboardPanel`s: left
navigation panel (resizable, default ~22%) and a growing content panel. Below `lg` the left panel
becomes a `USlideover` opened from the content navbar.

### 5.4 Skill page composition
- **Tree panel**: header shows bundle name + badges; body is a `UTree` from the manifest tree,
  folders first, file icons by extension, selection bound to the route, ancestors of the current
  path expanded on load.
- **Content navbar**: breadcrumb of the current path; right actions: Rendered/Source toggle
  (markdown only), Copy raw, View on GitHub (deep link to the exact file on the production
  branch), Download zip.
- **`MarkdownView`**: wraps `<MDC>`; prose styled with Nuxt UI tokens (same approach as mymind's
  `MdView`). README: frontmatter stripped and shown as a metadata header card instead. Other
  `.md`: frontmatter shown as a collapsed "Frontmatter" block above the body.
- **`CodeView.client.vue`**: CodeMirror 6 read-only, line numbers, wrap off, language by
  extension: json, yaml, ts/js, python, shell (`@codemirror/legacy-modes`), markdown (Source
  toggle), plaintext fallback. Theme follows color mode: `@codemirror/theme-one-dark` in dark,
  CodeMirror's default base theme with Nuxt UI token overrides in light.
- Binary/oversized: placeholder with size and GitHub link.

### 5.5 Known Nuxt UI / MDC gotchas to honour
- Set `mdc.highlight` to a small language allow-list (or `false`) — the default Shiki bundle has
  OOM'd builds before.
- Nuxt UI overrides `mdc.components.map`; don't rely on custom prose component maps.
- `UDashboardPanel` only renders content inside its named slots.
- Nuxt UI v4 props must be verified against installed source (`nuxt-ui-docs` skill), not memory.

## 6. Analytics — `nuxt-umami`

Config mirrors `../portfolio-v2`: `id` and `host` (`https://analytics.patrity.com`) from env
(`NUXT_PUBLIC_UMAMI_ID`; empty in dev/preview), `autoTrack: true`, `ignoreLocalhost: true`,
`proxy: 'cloak'` (script + collect proxied through Nitro), `domains: [<production host>]`.

Events via `umTrackEvent`:

| event | data | when |
|---|---|---|
| `skill-view` | `{ slug }` | `/skill/**` mount and slug change |
| `skill-download` | `{ slug, from: 'index' \| 'detail' }` | either Download button, fired before navigation |
| `skill-source` | `{ slug }` | View source clicks |

## 7. CI and deploy

- Vercel Git integration on `Patrity/skills`, production branch `main`, Nitro `vercel` preset
  auto-detected. Env per environment: `GITHUB_TOKEN` (optional), `REVALIDATE_SECRET`,
  `NUXT_PUBLIC_UMAMI_ID` (production only), `NUXT_PUBLIC_SITE_URL`.
- **Ignored Build Step** (`vercel.ts` → `scripts/should-build.sh`): exit 0 (skip) when
  `git diff --quiet HEAD^ HEAD -- . ':(exclude)skills/**' ':(exclude)docs/**' ':(exclude)README.md'`
  reports no other changes. `content/docs/**` is deliberately NOT excluded: app docs ship with
  the build.
- **`.github/workflows/revalidate.yml`**: on push to `main` with `paths: ['skills/**']`, POST
  `/api/revalidate` with the bearer secret, then GET `/api/skills` and assert `sha == github.sha`
  (a newer push racing in simply re-runs the workflow, so equality is the right check).
- **`.github/workflows/ci.yml`**: PRs and pushes — `pnpm install --frozen-lockfile`, lint,
  typecheck, `vitest run`, `nuxt build`, and `pnpm validate:skills` (runs the parser over
  `skills/` and fails on §3.2 violations).
- Local: `pnpm dev` uses `fs`; `SKILLS_SOURCE=github pnpm dev` exercises the tarball path.

## 8. Testing

- **Vitest** (`test/`): frontmatter parse + validation errors; tree/badge derivation; tarball
  extraction from a fixture `.tar.gz` (skills + noise + oversized + `cache/`); path-traversal
  guard; zip round-trip (unzip with fflate, compare); language detection; `should-build.sh`
  against synthetic diffs.
- **Nitro route tests** (`@nuxt/test-utils`, `fs` driver, fixture `skills/`): manifest, single
  skill, file, 404s, download headers, revalidate 401/200.
- **Browser** (`playwright-cli`, project `browser-testing` skill): tree click updates route,
  Rendered/Source toggle, CodeMirror mounts for `.py`, download returns a zip, umami absent on
  localhost. No auth, so no test account.

## 9. Seed content and repo tooling

- First bundle `skills/nuxt/`: `nuxt-docs`, `nuxt-ui-docs`, `nuxt-ui-templates` skills; genericized
  `web-nuxt.md` and `web-vue-ui.md` rules; `CLAUDE.md` pointer snippet; README with
  `tags: [nuxt, nuxt-ui, vue, docs]`, `author: Patrity`, `requires: [python3]`.
- Deliberately not published from mymind: `browser-testing` (dev credentials), `prod-deploy`
  (homelab IPs), `add-live-resource` (mymind-specific).
- This repo's `.claude/`: the same three skills and two rules (already present), a new
  `browser-testing` skill for this app, and a `CLAUDE.md` with commands and conventions.
- MyMind: project `skills` exists; deferred items (Umami read-back counts, CLI installer) are
  recorded as tasks there.

## 10. Decisions log

| decision | choice | why |
|---|---|---|
| content pipeline | GitHub tarball → parsed snapshot (Approach A) | one upstream request per refresh, PAT optional, zip and index need no extra calls |
| freshness | CI-triggered `invalidateByTag` + 5 min ISR floor | edits live in seconds without rebuild; TTL only as a backstop |
| dev source | local `fs` driver | no network, works offline, same parser as prod |
| rendering | SSR everywhere | public content, SEO/OG |
| analytics | `nuxt-umami` module | matches portfolio-v2, composables + cloak proxy for free |
| docs pages | `content/docs/*.md` via `?raw` | app content changes with app code; no extra module |
| zip root | `<slug>/` incl. README | README carries install notes |
