# Skills Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public Nuxt 4 site that lists, renders, and zips Claude Code setup bundles stored under `skills/` in this repo, reading them from GitHub at runtime on Vercel.

**Architecture:** A pure `server/lib/skills/` layer parses bundles (frontmatter, tree, badges) from either the local filesystem (dev) or a GitHub tarball (prod), fronted by a snapshot store that memoises per instance and persists to the Vercel Runtime Cache. Nitro API routes expose manifests, files, and zips; Nuxt UI dashboard pages render them with MDC for markdown and CodeMirror for everything else. ISR route rules plus a CI-triggered `invalidateByTag` keep content fresh without rebuilds.

**Tech Stack:** Nuxt 4.5, Nuxt UI 4.11, @nuxtjs/mdc 0.23, nuxt-umami 3.2, CodeMirror 6, nanotar, fflate, gray-matter, zod 4, @vercel/functions, vitest 4.1 + @nuxt/test-utils 4.2, playwright-cli, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-03-skills-repository-design.md`

## Global Constraints

- Package manager is **pnpm** only. Never npm/yarn. Commit `pnpm-lock.yaml`.
- Commit messages: no co-author trailers, no model references (user's global rule).
- Nuxt 4 layout: app code under `app/`, Nitro under `server/`, shared types/utils under `shared/`. Pure parsing logic lives in `server/lib/skills/` (NOT auto-imported; relative imports only so vitest and `tsx` scripts can load it). Nitro-aware glue lives in `server/utils/`.
- Nuxt UI v4: use `U*` components before raw markup; semantic color tokens only (`primary`, `neutral`, `text-muted`, `bg-elevated`, `border-default`…), never raw Tailwind palette classes. Verify props with `.claude/skills/nuxt-ui-docs` when unsure. `UDashboardPanel` renders only named-slot content and has **no** `grow`/`collapsible` props; `UTree` `v-model` holds item **objects**, `v-model:expanded` holds key **strings**, always pass `get-key`.
- MDC: `mdc.highlight.langs` is a fixed allow-list (Shiki has OOM'd builds before); `mdc.headings.anchorLinks: false` (Nuxt UI prose heading hydration bug).
- Vercel ISR ignores query strings by default, so cacheable endpoints must encode variation in the **path**. Every ISR response carries header `Vercel-Cache-Tag: skills` so `invalidateByTag('skills')` purges it.
- Vercel Runtime Cache items ≤ 2 MB: cache manifests and per-bundle blobs, never the whole snapshot.
- Slug regex `^[a-z0-9][a-z0-9-]*$`. Required frontmatter: `name`, `description`, `tags[]`, `author`. Optional: `authorUrl`, `requires[]`.
- Excluded from bundles: any `cache/` segment, any dot-segment (`.gitignore`, `.DS_Store`…), files > 1 MB (kept in tree as `oversized`). Binary files (NUL in first 8000 bytes) are listed as `binary`.
- Zip root is `<slug>/`, README included.
- Validate UI with `playwright-cli` (never the Playwright MCP). Dev server on `http://localhost:3000`, no auth.
- Run `pnpm typecheck` and `pnpm test:unit` before every commit; `pnpm build` before the final commit of any task that touches `nuxt.config.ts`.

---

## File structure

```
package.json  pnpm-lock.yaml  nuxt.config.ts  tsconfig.json  eslint.config.mjs  vitest.config.ts
vercel.json  .env.example  .gitignore  CLAUDE.md  README.md
app/
  app.vue  error.vue  app.config.ts
  assets/css/main.css
  layouts/default.vue                 dashboard shell: sidebar + <slot/>
  pages/index.vue                     home
  pages/skills.vue                    index with search + tag chips
  pages/skill/[...segments].vue       /skill/<slug>[/<path>] — tree + content
  pages/docs/[[slug]].vue             /docs[/<slug>]
  components/skill/SkillCard.vue      index card
  components/skill/SkillTree.vue      UTree wrapper bound to a path
  components/skill/SkillMetaCard.vue  README header (name/tags/author/badges)
  components/skill/SkillBadges.vue    content badges row
  components/skill/FileActions.vue    Rendered/Source, Copy, GitHub, Download
  components/MarkdownView.vue         <MDC> wrapper
  components/CodeView.client.vue      CodeMirror read-only
  composables/useSkills.ts            useFetch wrappers
  composables/useAnalytics.ts         umTrackEvent wrapper
  composables/useGithubUrls.ts        repo/tree/blob URLs from runtime config
  utils/docs.ts                       import.meta.glob of content/docs
content/docs/nav.ts + *.md            app docs
shared/types/skills.ts                DTOs shared by server + client
shared/utils/language.ts              detectLanguage(path)
shared/utils/format.ts                formatBytes(n)
shared/utils/github.ts                URL builders
server/lib/skills/types.ts            Snapshot, SkillsSource, RawBundle, BundleFiles
server/lib/skills/frontmatter.ts      zod schema + parseFrontmatter
server/lib/skills/exclusions.ts       isExcludedPath, MAX_FILE_BYTES
server/lib/skills/sniff.ts            isBinary
server/lib/skills/tree.ts             buildTree, deriveBadges, findFile
server/lib/skills/paths.ts            isSafeRelativePath
server/lib/skills/parse-bundle.ts     parseBundle, buildSnapshot
server/lib/skills/fs-source.ts        createFsSource(dir)
server/lib/skills/tarball.ts          extractBundles(tgz)
server/lib/skills/github-source.ts    createGithubSource(opts)
server/lib/skills/store.ts            createSnapshotStore({ source, cache })
server/lib/skills/zip.ts              buildZip(slug, files, mtime)
server/utils/skills.ts                useSkillsStore(), isPublicSkill()
server/api/skills/index.get.ts
server/api/skills/[slug]/index.get.ts
server/api/skills/[slug]/file/[...path].get.ts
server/api/skills/[slug]/download.get.ts
server/api/revalidate.post.ts
server/api/health.get.ts
server/routes/sitemap.xml.get.ts
server/routes/robots.txt.get.ts
scripts/should-build.sh               Vercel ignored build step
scripts/validate-skills.ts            CI bundle validator
test/fixtures/skills/{demo,broken,no-readme}/…
test/unit/*.test.ts
test/e2e/api.test.ts
.github/workflows/ci.yml  .github/workflows/revalidate.yml
skills/nuxt/…                         seed bundle
.claude/skills/browser-testing/SKILL.md
```

---

### Task 1: Scaffold the Nuxt app

**Files:**
- Create: `package.json`, `nuxt.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.env.example`, `.npmrc`
- Create: `app/app.vue`, `app/error.vue`, `app/app.config.ts`, `app/assets/css/main.css`, `app/pages/index.vue` (placeholder, replaced in Task 9)
- Modify: `.gitignore` (already exists)

**Interfaces:**
- Produces: `useRuntimeConfig()` shape — server: `githubToken: string`, `revalidateSecret: string`, `skillsSource: 'fs' | 'github'`, `skillsDir: string`; public: `siteUrl: string`, `github: { owner: string; repo: string; branch: string }`.
- Produces: scripts `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:unit`, `validate:skills`.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "skills",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "lint": "eslint .",
    "typecheck": "nuxt typecheck",
    "test": "vitest run",
    "test:unit": "vitest run --exclude 'test/e2e/**'",
    "validate:skills": "tsx scripts/validate-skills.ts"
  },
  "dependencies": {
    "@codemirror/lang-javascript": "^6.2.5",
    "@codemirror/lang-json": "^6.0.2",
    "@codemirror/lang-markdown": "^6.5.2",
    "@codemirror/lang-python": "^6.2.1",
    "@codemirror/lang-yaml": "^6.1.3",
    "@codemirror/language": "^6.12.4",
    "@codemirror/legacy-modes": "^6.5.4",
    "@codemirror/state": "^6.6.0",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@codemirror/view": "^6.43.0",
    "@iconify-json/lucide": "^1.2.111",
    "@iconify-json/simple-icons": "^1.2.84",
    "@nuxt/ui": "^4.11.0",
    "@nuxtjs/mdc": "^0.23.1",
    "@vercel/functions": "^3.9.5",
    "codemirror": "^6.0.2",
    "fflate": "^0.8.3",
    "gray-matter": "^4.0.3",
    "nanotar": "^0.3.0",
    "nuxt": "^4.5.2",
    "nuxt-umami": "^3.2.1",
    "tailwindcss": "^4.3.0",
    "zod": "^4.5.4"
  },
  "devDependencies": {
    "@nuxt/eslint": "^1.17.0",
    "@nuxt/test-utils": "^4.2.0",
    "eslint": "^10.4.1",
    "tsx": "^4.20.0",
    "typescript": "^6.0.3",
    "vitest": "~4.1.11",
    "vue-tsc": "^3.3.3"
  }
}
```

vitest is pinned to 4.x because `@nuxt/test-utils@4.2.0` declares `peerDependencies.vitest: ^4.0.2`.

- [ ] **Step 2: Write `nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxtjs/mdc', 'nuxt-umami'],
  devtools: { enabled: true },
  compatibilityDate: '2026-09-01',
  css: ['~/assets/css/main.css'],

  // Public content site: SSR everywhere. CodeMirror is the only client-only piece.
  ssr: true,

  runtimeConfig: {
    // Server-only. Override with NUXT_GITHUB_TOKEN etc.
    githubToken: '',
    revalidateSecret: '',
    // 'fs' reads ./skills from disk (dev, CI); 'github' downloads the repo tarball (Vercel).
    skillsSource: process.env.SKILLS_SOURCE ?? (process.env.VERCEL ? 'github' : 'fs'),
    skillsDir: 'skills',
    public: {
      siteUrl: 'http://localhost:3000',
      github: { owner: 'Patrity', repo: 'skills', branch: 'main' }
    }
  },

  // ISR on Vercel. Every cached response is tagged so POST /api/revalidate can
  // invalidateByTag('skills'). Vercel ISR ignores query strings, which is why the
  // file endpoint encodes the path in the URL (see server/api/skills/[slug]/file/).
  routeRules: {
    '/': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/skills': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/skill/**': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/docs/**': { isr: true },
    '/api/skills': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/api/skills/**': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/sitemap.xml': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } }
  },

  mdc: {
    // Fixed allow-list: the full Shiki grammar set has OOM'd Nuxt builds before.
    highlight: {
      langs: ['js', 'ts', 'json', 'yaml', 'bash', 'shell', 'md', 'python', 'vue', 'html', 'css', 'diff'],
      theme: { default: 'github-light', dark: 'github-dark' }
    },
    // Nuxt UI ProseH* crash on hydration when anchorLinks is an object (known bug).
    headings: { anchorLinks: false }
  },

  // nuxt-umami bakes its config at BUILD time. Set NUXT_PUBLIC_UMAMI_ID (and
  // UMAMI_DOMAINS) in Vercel's Production environment only; previews/dev stay in
  // faux (no-op) mode because `id` is empty.
  umami: {
    host: 'https://analytics.patrity.com',
    id: '',
    autoTrack: true,
    ignoreLocalhost: true,
    proxy: 'cloak',
    domains: process.env.UMAMI_DOMAINS ? process.env.UMAMI_DOMAINS.split(',') : null
  },

  eslint: {
    config: { stylistic: { commaDangle: 'never', braceStyle: '1tbs' } }
  }
})
```

- [ ] **Step 3: Write the remaining scaffold files**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

`eslint.config.mjs`:
```js
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt()
```

`vitest.config.ts`:
```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Plain vitest never boots Nuxt, so value-level `~~/…` imports need these aliases.
// Type-only imports are erased before resolution and work without them.
export default defineConfig({
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url))
    }
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**', '**/.claude/**'],
    testTimeout: 30_000
  }
})
```

`.npmrc`:
```
shamefully-hoist=false
```

`.env.example`:
```bash
# --- server-only ---
# Optional: lifts GitHub API rate limits (public repo needs no token to read).
NUXT_GITHUB_TOKEN=
# Required in production: bearer secret for POST /api/revalidate.
NUXT_REVALIDATE_SECRET=change-me
# 'fs' (default locally) or 'github' (default on Vercel).
SKILLS_SOURCE=fs
NUXT_SKILLS_DIR=skills

# --- public ---
NUXT_PUBLIC_SITE_URL=http://localhost:3000
NUXT_PUBLIC_GITHUB_OWNER=Patrity
NUXT_PUBLIC_GITHUB_REPO=skills
NUXT_PUBLIC_GITHUB_BRANCH=main

# --- analytics (BUILD-time, production only) ---
NUXT_PUBLIC_UMAMI_ID=
UMAMI_DOMAINS=
```

`app/assets/css/main.css`:
```css
@import "tailwindcss";
@import "@nuxt/ui";
```

`app/app.config.ts`:
```ts
export default defineAppConfig({
  ui: {
    colors: { primary: 'emerald', neutral: 'zinc' }
  }
})
```

`app/app.vue`:
```vue
<script setup lang="ts">
useHead({
  titleTemplate: title => (title ? `${title} · Skills` : 'Skills — reusable Claude Code setups'),
  htmlAttrs: { lang: 'en' }
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

`app/error.vue`:
```vue
<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()
</script>

<template>
  <UApp>
    <div class="min-h-svh flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p class="text-6xl font-semibold text-highlighted">
        {{ error.statusCode }}
      </p>
      <p class="text-muted">
        {{ error.statusCode === 404 ? 'That page does not exist.' : (error.statusMessage || 'Something went wrong.') }}
      </p>
      <UButton
        label="Back home"
        icon="i-lucide-house"
        color="neutral"
        variant="subtle"
        @click="clearError({ redirect: '/' })"
      />
    </div>
  </UApp>
</template>
```

`app/pages/index.vue` (temporary):
```vue
<template>
  <div class="p-6">
    <h1 class="text-2xl font-semibold">
      Skills
    </h1>
  </div>
</template>
```

Append to `.gitignore`:
```
.output
.vercel
```
(already present; verify with `grep -c vercel .gitignore` → 1.)

- [ ] **Step 4: Install and smoke-test**

Run: `pnpm install`
Expected: lockfile written, `nuxt prepare` runs via postinstall with no errors.

Run: `pnpm typecheck`
Expected: exit 0.

Run in background: `pnpm dev > /tmp/skills-dev.log 2>&1 &` then `until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000`
Expected: `200`. Confirm the page shows the Skills heading with `curl -s http://localhost:3000 | grep -c Skills` ≥ 1. Kill the dev server afterwards (`kill %1` or `pkill -f "nuxt dev"`).

Run: `pnpm lint`
Expected: exit 0 (fix any stylistic complaints in the files above).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Nuxt 4 app with Nuxt UI, MDC, umami, ISR route rules"
```

---

### Task 2: Shared types and pure helpers

**Files:**
- Create: `shared/types/skills.ts`, `shared/utils/language.ts`, `shared/utils/format.ts`, `shared/utils/github.ts`
- Test: `test/unit/language.test.ts`, `test/unit/format.test.ts`, `test/unit/github.test.ts`

**Interfaces:**
- Produces (types): `ContentBadge`, `FileKind`, `Language`, `SkillFrontmatter`, `TreeNode`, `SkillManifest`, `SkillSummary`, `SnapshotMeta`, `SkillsListResponse`, `SkillDetailResponse`, `SkillFileResponse`.
- Produces (values): `detectLanguage(path: string): Language`, `isMarkdownPath(path: string): boolean`, `formatBytes(n: number): string`, `githubRepoUrl(ref)`, `githubTreeUrl(ref, slug)`, `githubBlobUrl(ref, slug, path)` where `ref = { owner, repo, branch }`.

- [ ] **Step 1: Write the failing tests**

`test/unit/language.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { detectLanguage, isMarkdownPath } from '../../shared/utils/language'

describe('detectLanguage', () => {
  it.each([
    ['README.md', 'markdown'],
    ['docs/guide.markdown', 'markdown'],
    ['settings.local.json', 'json'],
    ['hooks/config.yaml', 'yaml'],
    ['hooks/config.yml', 'yaml'],
    ['scripts/run.ts', 'typescript'],
    ['scripts/run.mts', 'typescript'],
    ['scripts/run.js', 'javascript'],
    ['scripts/run.mjs', 'javascript'],
    ['skills/x/fetch.py', 'python'],
    ['hooks/pre-commit.sh', 'shell'],
    ['hooks/pre-commit.bash', 'shell'],
    ['LICENSE', 'plaintext'],
    ['weird.unknownext', 'plaintext']
  ])('%s → %s', (path, lang) => {
    expect(detectLanguage(path)).toBe(lang)
  })

  it('is case-insensitive on the extension', () => {
    expect(detectLanguage('CLAUDE.MD')).toBe('markdown')
  })
})

describe('isMarkdownPath', () => {
  it('matches only markdown extensions', () => {
    expect(isMarkdownPath('a/b.md')).toBe(true)
    expect(isMarkdownPath('a/b.json')).toBe(false)
  })
})
```

`test/unit/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatBytes } from '../../shared/utils/format'

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1048576, '1.0 MB'],
    [5 * 1048576, '5.0 MB']
  ])('%d → %s', (n, s) => {
    expect(formatBytes(n)).toBe(s)
  })
})
```

`test/unit/github.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { githubBlobUrl, githubRepoUrl, githubTreeUrl } from '../../shared/utils/github'

const ref = { owner: 'Patrity', repo: 'skills', branch: 'main' }

describe('github urls', () => {
  it('builds the repo url', () => {
    expect(githubRepoUrl(ref)).toBe('https://github.com/Patrity/skills')
  })
  it('builds a bundle tree url on the production branch', () => {
    expect(githubTreeUrl(ref, 'nuxt')).toBe('https://github.com/Patrity/skills/tree/main/skills/nuxt')
  })
  it('builds a file blob url and encodes path segments', () => {
    expect(githubBlobUrl(ref, 'nuxt', 'skills/nuxt docs/SKILL.md'))
      .toBe('https://github.com/Patrity/skills/blob/main/skills/nuxt/skills/nuxt%20docs/SKILL.md')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit`
Expected: 3 files FAIL with "Cannot find module" / "Failed to resolve import".

- [ ] **Step 3: Write the types and helpers**

`shared/types/skills.ts`:
```ts
export type ContentBadge = 'skills' | 'rules' | 'hooks' | 'settings' | 'claude-md'
export type FileKind = 'text' | 'binary' | 'oversized'
export type Language
  = 'markdown' | 'json' | 'yaml' | 'typescript' | 'javascript' | 'python' | 'shell' | 'plaintext'

export interface SkillFrontmatter {
  name: string
  description: string
  tags: string[]
  author: string
  authorUrl?: string
  requires?: string[]
}

export interface TreeNode {
  /** Basename, e.g. "SKILL.md". */
  name: string
  /** Path relative to the bundle root, e.g. "skills/nuxt-docs/SKILL.md". */
  path: string
  type: 'file' | 'dir'
  size?: number
  kind?: FileKind
  children?: TreeNode[]
}

export interface SkillManifest extends SkillFrontmatter {
  slug: string
  badges: ContentBadge[]
  fileCount: number
  totalBytes: number
  tree: TreeNode[]
  /** Validation problems. Empty for a publishable bundle. */
  errors: string[]
}

export type SkillSummary = Omit<SkillManifest, 'tree'>

export interface SnapshotMeta {
  sha: string
  committedAt: string
  fetchedAt: string
  source: 'fs' | 'github'
}

export interface SkillsListResponse extends SnapshotMeta {
  skills: SkillSummary[]
}

export interface SkillDetailResponse extends SnapshotMeta {
  skill: SkillManifest
}

export interface SkillFileResponse {
  path: string
  language: Language
  size: number
  kind: FileKind
  /** Decoded text for kind === 'text', otherwise null. */
  content: string | null
  /** Raw YAML between the --- fences for markdown files that have frontmatter. */
  frontmatterRaw: string | null
}
```

`shared/utils/language.ts`:
```ts
import type { Language } from '../types/skills'

const BY_EXT: Record<string, Language> = {
  md: 'markdown',
  markdown: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell'
}

export function detectLanguage(path: string): Language {
  const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase()
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return 'plaintext'
  return BY_EXT[base.slice(dot + 1)] ?? 'plaintext'
}

export function isMarkdownPath(path: string): boolean {
  return detectLanguage(path) === 'markdown'
}
```

`shared/utils/format.ts`:
```ts
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const kb = n / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}
```

`shared/utils/github.ts`:
```ts
export interface GithubRef {
  owner: string
  repo: string
  branch: string
}

export function githubRepoUrl(ref: GithubRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}`
}

export function githubTreeUrl(ref: GithubRef, slug: string): string {
  return `${githubRepoUrl(ref)}/tree/${ref.branch}/skills/${slug}`
}

export function githubBlobUrl(ref: GithubRef, slug: string, path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${githubRepoUrl(ref)}/blob/${ref.branch}/skills/${slug}/${encoded}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: 3 files PASS. Then `pnpm typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add shared test/unit
git commit -m "feat: shared skill DTOs, language detection, byte formatting, GitHub URL helpers"
```

---

### Task 3: Bundle parser (frontmatter, exclusions, tree, badges)

**Files:**
- Create: `server/lib/skills/types.ts`, `server/lib/skills/frontmatter.ts`, `server/lib/skills/exclusions.ts`, `server/lib/skills/sniff.ts`, `server/lib/skills/tree.ts`, `server/lib/skills/paths.ts`, `server/lib/skills/parse-bundle.ts`
- Test: `test/unit/frontmatter.test.ts`, `test/unit/exclusions.test.ts`, `test/unit/tree.test.ts`, `test/unit/paths.test.ts`, `test/unit/parse-bundle.test.ts`

**Interfaces:**
- Consumes: types from `shared/types/skills.ts` (relative import `../../../shared/types/skills`).
- Produces:
  - `type BundleFiles = Record<string, Uint8Array>` (key = bundle-relative path)
  - `interface RawBundle { slug: string; files: BundleFiles }`
  - `interface Snapshot extends SnapshotMeta { skills: SkillManifest[]; files: Record<string, BundleFiles> }`
  - `interface SkillsSource { load(): Promise<Snapshot> }`
  - `SLUG_RE`, `frontmatterSchema`, `parseFrontmatter(readme: string): { data: SkillFrontmatter | null; errors: string[] }`
  - `MAX_FILE_BYTES = 1048576`, `isExcludedPath(relPath: string): boolean`
  - `isBinary(bytes: Uint8Array): boolean`
  - `buildTree(entries: Record<string, { size: number; kind: FileKind }>): TreeNode[]`, `deriveBadges(paths: string[]): ContentBadge[]`, `findFile(tree: TreeNode[], path: string): TreeNode | null`
  - `isSafeRelativePath(p: string): boolean`
  - `parseBundle(raw: RawBundle): { manifest: SkillManifest; files: BundleFiles }`, `buildSnapshot(bundles: RawBundle[], meta: SnapshotMeta): Snapshot`

- [ ] **Step 1: Write the failing tests**

`test/unit/frontmatter.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseFrontmatter, SLUG_RE } from '../../server/lib/skills/frontmatter'

const good = `---
name: Nuxt
description: Nuxt 4 + Nuxt UI doc fetchers and rules.
tags: [nuxt, nuxt-ui]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3]
---

# Nuxt bundle
`

describe('parseFrontmatter', () => {
  it('parses a valid README', () => {
    const r = parseFrontmatter(good)
    expect(r.errors).toEqual([])
    expect(r.data).toEqual({
      name: 'Nuxt',
      description: 'Nuxt 4 + Nuxt UI doc fetchers and rules.',
      tags: ['nuxt', 'nuxt-ui'],
      author: 'Patrity',
      authorUrl: 'https://github.com/Patrity',
      requires: ['python3']
    })
  })

  it('reports each missing required key', () => {
    const r = parseFrontmatter('---\nname: X\n---\nbody')
    expect(r.data).toBeNull()
    expect(r.errors).toContain('frontmatter.description: required')
    expect(r.errors).toContain('frontmatter.tags: required')
    expect(r.errors).toContain('frontmatter.author: required')
  })

  it('reports a README with no frontmatter at all', () => {
    const r = parseFrontmatter('# just a heading')
    expect(r.data).toBeNull()
    expect(r.errors[0]).toBe('README.md has no YAML frontmatter')
  })

  it('rejects an empty tags array and a bad authorUrl', () => {
    const r = parseFrontmatter('---\nname: X\ndescription: d\ntags: []\nauthor: a\nauthorUrl: not-a-url\n---\n')
    expect(r.errors.some(e => e.startsWith('frontmatter.tags:'))).toBe(true)
    expect(r.errors.some(e => e.startsWith('frontmatter.authorUrl:'))).toBe(true)
  })
})

describe('SLUG_RE', () => {
  it.each(['nuxt', 'nuxt-ui', 'a1', '2d-rpg'])('accepts %s', s => expect(SLUG_RE.test(s)).toBe(true))
  it.each(['Nuxt', '-nuxt', 'nuxt_ui', 'nuxt ui', ''])('rejects "%s"', s => expect(SLUG_RE.test(s)).toBe(false))
})
```

`test/unit/exclusions.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isExcludedPath, MAX_FILE_BYTES } from '../../server/lib/skills/exclusions'
import { isBinary } from '../../server/lib/skills/sniff'

describe('isExcludedPath', () => {
  it.each([
    'skills/nuxt-docs/cache/x.md',
    'cache/anything',
    '.gitignore',
    'skills/.DS_Store',
    'skills/x/.hidden/file'
  ])('excludes %s', p => expect(isExcludedPath(p)).toBe(true))

  it.each([
    'README.md',
    'settings.local.json',
    'skills/nuxt-docs/SKILL.md',
    'hooks/pre-commit.sh',
    'skills/cache-buster/SKILL.md'
  ])('keeps %s', p => expect(isExcludedPath(p)).toBe(false))
})

describe('MAX_FILE_BYTES', () => {
  it('is 1 MB', () => expect(MAX_FILE_BYTES).toBe(1024 * 1024))
})

describe('isBinary', () => {
  it('flags a NUL byte in the first 8000 bytes', () => {
    expect(isBinary(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x00, 0x0A]))).toBe(true)
  })
  it('accepts UTF-8 text', () => {
    expect(isBinary(new TextEncoder().encode('# héllo\nworld'))).toBe(false)
  })
  it('ignores a NUL past the sniff window', () => {
    const bytes = new Uint8Array(9000).fill(0x61)
    bytes[8500] = 0
    expect(isBinary(bytes)).toBe(false)
  })
})
```

`test/unit/tree.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildTree, deriveBadges, findFile } from '../../server/lib/skills/tree'

const entries = {
  'README.md': { size: 10, kind: 'text' as const },
  'skills/nuxt-docs/SKILL.md': { size: 20, kind: 'text' as const },
  'skills/nuxt-docs/fetch.py': { size: 30, kind: 'text' as const },
  'rules/web-nuxt.md': { size: 5, kind: 'text' as const },
  'CLAUDE.md': { size: 7, kind: 'text' as const }
}

describe('buildTree', () => {
  it('nests by directory, dirs first then alphabetical', () => {
    const tree = buildTree(entries)
    expect(tree.map(n => `${n.type}:${n.name}`)).toEqual([
      'dir:rules', 'dir:skills', 'file:CLAUDE.md', 'file:README.md'
    ])
    const skills = tree.find(n => n.name === 'skills')!
    expect(skills.path).toBe('skills')
    const nuxtDocs = skills.children![0]!
    expect(nuxtDocs.path).toBe('skills/nuxt-docs')
    expect(nuxtDocs.children!.map(c => c.name)).toEqual(['fetch.py', 'SKILL.md'])
    expect(nuxtDocs.children![1]).toMatchObject({ type: 'file', size: 20, kind: 'text', path: 'skills/nuxt-docs/SKILL.md' })
  })
})

describe('findFile', () => {
  const tree = buildTree(entries)
  it('finds a nested file by path', () => {
    expect(findFile(tree, 'skills/nuxt-docs/fetch.py')?.size).toBe(30)
  })
  it('returns null for directories and unknown paths', () => {
    expect(findFile(tree, 'skills')).toBeNull()
    expect(findFile(tree, 'nope.md')).toBeNull()
  })
})

describe('deriveBadges', () => {
  it('derives badges in canonical order', () => {
    expect(deriveBadges(['CLAUDE.md', 'settings.local.json', 'hooks/a.sh', 'rules/r.md', 'skills/s/SKILL.md', 'README.md']))
      .toEqual(['skills', 'rules', 'hooks', 'settings', 'claude-md'])
  })
  it('is case-insensitive for CLAUDE.md only', () => {
    expect(deriveBadges(['claude.md'])).toEqual(['claude-md'])
    expect(deriveBadges(['Settings.local.json'])).toEqual([])
  })
})
```

`test/unit/paths.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isSafeRelativePath } from '../../server/lib/skills/paths'

describe('isSafeRelativePath', () => {
  it.each(['README.md', 'skills/a/SKILL.md', 'hooks/pre-commit.sh', 'a b/c.md'])('accepts %s', p => {
    expect(isSafeRelativePath(p)).toBe(true)
  })
  it.each(['', '/etc/passwd', '../x', 'a/../b', 'a/./b', 'a//b', 'a\\b', 'a/', 'a\u0000b'])('rejects %j', p => {
    expect(isSafeRelativePath(p)).toBe(false)
  })
})
```

`test/unit/parse-bundle.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildSnapshot, parseBundle } from '../../server/lib/skills/parse-bundle'
import { MAX_FILE_BYTES } from '../../server/lib/skills/exclusions'

const enc = (s: string) => new TextEncoder().encode(s)
const readme = `---
name: Demo
description: A demo bundle.
tags: [demo]
author: Tester
---
# Demo
`

function demoFiles() {
  return {
    'README.md': enc(readme),
    'skills/demo/SKILL.md': enc('---\nname: demo\n---\n# skill'),
    'skills/demo/cache/cached.md': enc('ignored'),
    '.DS_Store': enc('junk'),
    'hooks/pre-commit.sh': enc('#!/bin/sh\necho hi'),
    'settings.local.json': enc('{"a":1}'),
    'assets/blob.bin': new Uint8Array([1, 0, 2, 3]),
    'assets/big.txt': new Uint8Array(MAX_FILE_BYTES + 1).fill(0x61)
  }
}

describe('parseBundle', () => {
  it('produces a valid manifest and drops excluded files', () => {
    const { manifest, files } = parseBundle({ slug: 'demo', files: demoFiles() })
    expect(manifest.errors).toEqual([])
    expect(manifest.name).toBe('Demo')
    expect(manifest.tags).toEqual(['demo'])
    expect(manifest.badges).toEqual(['skills', 'hooks', 'settings'])
    expect(Object.keys(files).sort()).toEqual([
      'README.md', 'assets/big.txt', 'assets/blob.bin', 'hooks/pre-commit.sh', 'settings.local.json', 'skills/demo/SKILL.md'
    ])
    expect(manifest.fileCount).toBe(6)
    expect(manifest.totalBytes).toBe(Object.values(files).reduce((n, f) => n + f.byteLength, 0))
  })

  it('marks binary and oversized files', () => {
    const { manifest } = parseBundle({ slug: 'demo', files: demoFiles() })
    const assets = manifest.tree.find(n => n.name === 'assets')!
    expect(assets.children!.find(c => c.name === 'blob.bin')!.kind).toBe('binary')
    expect(assets.children!.find(c => c.name === 'big.txt')!.kind).toBe('oversized')
  })

  it('reports a missing README', () => {
    const { manifest } = parseBundle({ slug: 'x', files: { 'skills/a/SKILL.md': enc('hi') } })
    expect(manifest.errors).toEqual(['README.md is missing'])
    expect(manifest.name).toBe('x')
  })

  it('reports a bad slug alongside frontmatter errors', () => {
    const { manifest } = parseBundle({ slug: 'Bad_Slug', files: { 'README.md': enc('---\nname: X\n---\n') } })
    expect(manifest.errors[0]).toMatch(/^slug "Bad_Slug"/)
    expect(manifest.errors).toContain('frontmatter.description: required')
  })

  it('accepts a lowercase readme.md', () => {
    const { manifest } = parseBundle({ slug: 'demo', files: { 'readme.md': enc(readme) } })
    expect(manifest.errors).toEqual([])
  })
})

describe('buildSnapshot', () => {
  it('sorts bundles by slug and keeps files per slug', () => {
    const meta = { sha: 'abc', committedAt: '2026-09-03T00:00:00.000Z', fetchedAt: '2026-09-03T00:00:01.000Z', source: 'fs' as const }
    const snap = buildSnapshot([
      { slug: 'zeta', files: { 'README.md': enc(readme) } },
      { slug: 'alpha', files: { 'README.md': enc(readme) } }
    ], meta)
    expect(snap.sha).toBe('abc')
    expect(snap.skills.map(s => s.slug)).toEqual(['alpha', 'zeta'])
    expect(Object.keys(snap.files['alpha']!)).toEqual(['README.md'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit`
Expected: the 5 new files FAIL with module-not-found errors.

- [ ] **Step 3: Write the implementation**

`server/lib/skills/types.ts`:
```ts
import type { SkillManifest, SnapshotMeta } from '../../../shared/types/skills'

/** Bundle-relative path → file bytes. */
export type BundleFiles = Record<string, Uint8Array>

export interface RawBundle {
  slug: string
  files: BundleFiles
}

export interface Snapshot extends SnapshotMeta {
  /** Every bundle found, valid or not (see `errors`). Sorted by slug. */
  skills: SkillManifest[]
  /** slug → files (already filtered by exclusions). */
  files: Record<string, BundleFiles>
}

export interface SkillsSource {
  load(): Promise<Snapshot>
}
```

`server/lib/skills/frontmatter.ts`:
```ts
import matter from 'gray-matter'
import { z } from 'zod'
import type { SkillFrontmatter } from '../../../shared/types/skills'

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

export const frontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  author: z.string().min(1),
  authorUrl: z.url().optional(),
  requires: z.array(z.string().min(1)).optional()
})

export interface FrontmatterResult {
  data: SkillFrontmatter | null
  errors: string[]
}

export function parseFrontmatter(readme: string): FrontmatterResult {
  const parsed = matter(readme)
  if (!parsed.matter.trim()) {
    return { data: null, errors: ['README.md has no YAML frontmatter'] }
  }
  const result = frontmatterSchema.safeParse(parsed.data)
  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || '(root)'
      const message = issue.code === 'invalid_type' && issue.message.toLowerCase().includes('undefined')
        ? 'required'
        : issue.message
      return `frontmatter.${key}: ${message}`
    })
    return { data: null, errors }
  }
  return { data: result.data, errors: [] }
}
```

Note: zod 4 reports a missing key as `invalid_type` with a message like `Invalid input: expected string, received undefined`; the mapping above normalises that to `required` so the CI output reads well. If the installed zod phrases it differently, adjust the `includes('undefined')` check so the test's `required` expectation still holds.

`server/lib/skills/exclusions.ts`:
```ts
export const MAX_FILE_BYTES = 1024 * 1024

/** Drop `cache/` dirs (doc-fetcher skills) and any dot-segment (.gitignore, .DS_Store, .hidden/). */
export function isExcludedPath(relPath: string): boolean {
  return relPath.split('/').some(seg => seg === 'cache' || seg.startsWith('.'))
}
```

`server/lib/skills/sniff.ts`:
```ts
const SNIFF_BYTES = 8000

export function isBinary(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.byteLength, SNIFF_BYTES)
  for (let i = 0; i < end; i++) {
    if (bytes[i] === 0) return true
  }
  return false
}
```

`server/lib/skills/tree.ts`:
```ts
import type { ContentBadge, FileKind, TreeNode } from '../../../shared/types/skills'

export function buildTree(entries: Record<string, { size: number; kind: FileKind }>): TreeNode[] {
  const root: TreeNode[] = []
  for (const path of Object.keys(entries).sort()) {
    const parts = path.split('/')
    let level = root
    let acc = ''
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part
      const isLeaf = i === parts.length - 1
      let node = level.find(n => n.name === part && n.type === (isLeaf ? 'file' : 'dir'))
      if (!node) {
        node = isLeaf
          ? { name: part, path: acc, type: 'file', size: entries[path]!.size, kind: entries[path]!.kind }
          : { name: part, path: acc, type: 'dir', children: [] }
        level.push(node)
      }
      if (!isLeaf) level = node.children!
    })
  }
  return sortTree(root)
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  })
  for (const n of nodes) if (n.children) sortTree(n.children)
  return nodes
}

export function findFile(tree: TreeNode[], path: string): TreeNode | null {
  for (const node of tree) {
    if (node.type === 'file' && node.path === path) return node
    if (node.children && path.startsWith(`${node.path}/`)) {
      const found = findFile(node.children, path)
      if (found) return found
    }
  }
  return null
}

const BADGE_ORDER: ContentBadge[] = ['skills', 'rules', 'hooks', 'settings', 'claude-md']

export function deriveBadges(paths: string[]): ContentBadge[] {
  const found = new Set<ContentBadge>()
  for (const p of paths) {
    if (p.startsWith('skills/')) found.add('skills')
    else if (p.startsWith('rules/')) found.add('rules')
    else if (p.startsWith('hooks/')) found.add('hooks')
    else if (p === 'settings.local.json') found.add('settings')
    else if (p.toLowerCase() === 'claude.md') found.add('claude-md')
  }
  return BADGE_ORDER.filter(b => found.has(b))
}
```

`server/lib/skills/paths.ts`:
```ts
/** Bundle-relative path safety: no absolute, no traversal, no empty/dot segments, no backslash/NUL. */
export function isSafeRelativePath(p: string): boolean {
  if (!p || p.includes('\\') || p.includes('\u0000')) return false
  const segments = p.split('/')
  return segments.every(seg => seg !== '' && seg !== '.' && seg !== '..')
}
```

`server/lib/skills/parse-bundle.ts`:
```ts
import type { FileKind, SkillManifest, SnapshotMeta } from '../../../shared/types/skills'
import type { BundleFiles, RawBundle, Snapshot } from './types'
import { parseFrontmatter, SLUG_RE } from './frontmatter'
import { isExcludedPath, MAX_FILE_BYTES } from './exclusions'
import { isBinary } from './sniff'
import { buildTree, deriveBadges } from './tree'

const decoder = new TextDecoder()

export function parseBundle(raw: RawBundle): { manifest: SkillManifest; files: BundleFiles } {
  const errors: string[] = []
  if (!SLUG_RE.test(raw.slug)) errors.push(`slug "${raw.slug}" must match ${SLUG_RE}`)

  const files: BundleFiles = {}
  for (const [path, bytes] of Object.entries(raw.files)) {
    if (!isExcludedPath(path)) files[path] = bytes
  }

  const readmeKey = Object.keys(files).find(p => p.toLowerCase() === 'readme.md')
  let fm = null
  if (!readmeKey) {
    errors.push('README.md is missing')
  } else {
    const parsed = parseFrontmatter(decoder.decode(files[readmeKey]))
    fm = parsed.data
    errors.push(...parsed.errors)
  }

  const entries: Record<string, { size: number; kind: FileKind }> = {}
  let totalBytes = 0
  for (const [path, bytes] of Object.entries(files)) {
    const kind: FileKind = bytes.byteLength > MAX_FILE_BYTES ? 'oversized' : isBinary(bytes) ? 'binary' : 'text'
    entries[path] = { size: bytes.byteLength, kind }
    totalBytes += bytes.byteLength
  }
  const paths = Object.keys(entries)

  const manifest: SkillManifest = {
    slug: raw.slug,
    name: fm?.name ?? raw.slug,
    description: fm?.description ?? '',
    tags: fm?.tags ?? [],
    author: fm?.author ?? '',
    authorUrl: fm?.authorUrl,
    requires: fm?.requires,
    badges: deriveBadges(paths),
    fileCount: paths.length,
    totalBytes,
    tree: buildTree(entries),
    errors
  }
  return { manifest, files }
}

export function buildSnapshot(bundles: RawBundle[], meta: SnapshotMeta): Snapshot {
  const skills: SkillManifest[] = []
  const files: Record<string, BundleFiles> = {}
  for (const bundle of [...bundles].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const parsed = parseBundle(bundle)
    skills.push(parsed.manifest)
    files[bundle.slug] = parsed.files
  }
  return { ...meta, skills, files }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: all unit files PASS. If `frontmatter.test.ts` fails on the `required` wording, print `result.error.issues` once, adjust the normalisation in `parseFrontmatter`, and re-run. Then `pnpm typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/lib test/unit
git commit -m "feat: bundle parser with frontmatter schema, exclusions, tree and badges"
```

---

### Task 4: Filesystem source and test fixtures

**Files:**
- Create: `server/lib/skills/fs-source.ts`
- Create fixtures: `test/fixtures/skills/demo/README.md`, `test/fixtures/skills/demo/CLAUDE.md`, `test/fixtures/skills/demo/settings.local.json`, `test/fixtures/skills/demo/skills/demo-skill/SKILL.md`, `test/fixtures/skills/demo/skills/demo-skill/cache/ignored.md`, `test/fixtures/skills/demo/skills/demo-skill/fetch.py`, `test/fixtures/skills/demo/rules/demo.md`, `test/fixtures/skills/demo/hooks/pre-commit.sh`, `test/fixtures/skills/demo/assets/blob.bin`, `test/fixtures/skills/broken/README.md`, `test/fixtures/skills/no-readme/skills/x/SKILL.md`
- Test: `test/unit/fs-source.test.ts`

**Interfaces:**
- Consumes: `buildSnapshot`, `RawBundle`, `SkillsSource`.
- Produces: `createFsSource(dir: string): SkillsSource`. `sha` is `fs-<12 hex>` derived from every included file's path, size and mtime; `committedAt` is the newest mtime; `source: 'fs'`.

- [ ] **Step 1: Create the fixtures**

````bash
mkdir -p test/fixtures/skills/demo/skills/demo-skill/cache test/fixtures/skills/demo/rules test/fixtures/skills/demo/hooks test/fixtures/skills/demo/assets test/fixtures/skills/broken test/fixtures/skills/no-readme/skills/x
cat > test/fixtures/skills/demo/README.md <<'EOF'
---
name: Demo
description: A fixture bundle used by the test-suite.
tags: [demo, fixture]
author: Tester
authorUrl: https://example.com
requires: [python3]
---

# Demo bundle

This README is rendered on `/skill/demo`.

```bash
echo "code blocks render too"
```
EOF
printf '## Demo\n- Point at the demo skill before doing demo things.\n' > test/fixtures/skills/demo/CLAUDE.md
printf '{\n  "permissions": { "allow": ["Bash(echo:*)"] }\n}\n' > test/fixtures/skills/demo/settings.local.json
printf -- '---\nname: demo-skill\ndescription: Fixture skill.\n---\n\n# Demo skill\n\nRun `python3 fetch.py`.\n' > test/fixtures/skills/demo/skills/demo-skill/SKILL.md
printf 'this file is excluded\n' > test/fixtures/skills/demo/skills/demo-skill/cache/ignored.md
printf 'import sys\n\nprint("hello", sys.argv)\n' > test/fixtures/skills/demo/skills/demo-skill/fetch.py
printf -- '---\npaths:\n  - "app/**"\n---\n# Demo rule\nAlways demo.\n' > test/fixtures/skills/demo/rules/demo.md
printf '#!/usr/bin/env bash\necho "pre-commit"\n' > test/fixtures/skills/demo/hooks/pre-commit.sh
printf '\x89PNG\x00\x01\x02binary' > test/fixtures/skills/demo/assets/blob.bin
printf -- '---\nname: Broken\ndescription: Missing tags and author.\n---\n# Broken\n' > test/fixtures/skills/broken/README.md
printf '# no readme here\n' > test/fixtures/skills/no-readme/skills/x/SKILL.md
```

Verify: `find test/fixtures -type f | wc -l` → 11.

- [ ] **Step 2: Write the failing test**

`test/unit/fs-source.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createFsSource } from '../../server/lib/skills/fs-source'

const fixtures = fileURLToPath(new URL('../fixtures/skills', import.meta.url))

describe('createFsSource', () => {
  it('loads every bundle directory as a snapshot', async () => {
    const snap = await createFsSource(fixtures).load()
    expect(snap.source).toBe('fs')
    expect(snap.sha).toMatch(/^fs-[0-9a-f]{12}$/)
    expect(new Date(snap.committedAt).getTime()).toBeGreaterThan(0)
    expect(snap.skills.map(s => s.slug)).toEqual(['broken', 'demo', 'no-readme'])
  })

  it('parses the demo bundle cleanly and excludes cache files', async () => {
    const snap = await createFsSource(fixtures).load()
    const demo = snap.skills.find(s => s.slug === 'demo')!
    expect(demo.errors).toEqual([])
    expect(demo.badges).toEqual(['skills', 'rules', 'hooks', 'settings', 'claude-md'])
    expect(Object.keys(snap.files['demo']!)).not.toContain('skills/demo-skill/cache/ignored.md')
    expect(Object.keys(snap.files['demo']!)).toContain('skills/demo-skill/fetch.py')
  })

  it('surfaces invalid bundles with errors instead of throwing', async () => {
    const snap = await createFsSource(fixtures).load()
    expect(snap.skills.find(s => s.slug === 'broken')!.errors).toContain('frontmatter.tags: required')
    expect(snap.skills.find(s => s.slug === 'no-readme')!.errors).toEqual(['README.md is missing'])
  })

  it('returns an empty snapshot for a missing directory', async () => {
    const snap = await createFsSource(fixtures + '/does-not-exist').load()
    expect(snap.skills).toEqual([])
  })

  it('produces a stable sha for unchanged content', async () => {
    const a = await createFsSource(fixtures).load()
    const b = await createFsSource(fixtures).load()
    expect(a.sha).toBe(b.sha)
  })
})
````

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test:unit test/unit/fs-source.test.ts`
Expected: FAIL, cannot find `fs-source`.

- [ ] **Step 4: Implement**

`server/lib/skills/fs-source.ts`:
```ts
import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import type { RawBundle, SkillsSource } from './types'
import { buildSnapshot } from './parse-bundle'
import { isExcludedPath } from './exclusions'

async function walk(dir: string, root: string, out: { rel: string; abs: string }[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = join(dir, entry.name)
    const rel = relative(root, abs).split('\\').join('/')
    if (isExcludedPath(rel)) continue
    if (entry.isDirectory()) await walk(abs, root, out)
    else if (entry.isFile()) out.push({ rel, abs })
  }
}

/** Reads `<dir>/<slug>/**` from disk. Dev/CI source; zero network. */
export function createFsSource(dir: string): SkillsSource {
  const root = resolve(dir)
  return {
    async load() {
      const fetchedAt = new Date().toISOString()
      let slugs: string[] = []
      try {
        slugs = (await readdir(root, { withFileTypes: true }))
          .filter(e => e.isDirectory() && !e.name.startsWith('.'))
          .map(e => e.name)
          .sort()
      } catch {
        slugs = []
      }

      const hash = createHash('sha1')
      let newest = 0
      const bundles: RawBundle[] = []
      for (const slug of slugs) {
        const bundleRoot = join(root, slug)
        const found: { rel: string; abs: string }[] = []
        await walk(bundleRoot, bundleRoot, found)
        const files: Record<string, Uint8Array> = {}
        for (const f of found.sort((a, b) => a.rel.localeCompare(b.rel))) {
          const [bytes, info] = await Promise.all([readFile(f.abs), stat(f.abs)])
          files[f.rel] = new Uint8Array(bytes)
          hash.update(`${slug}/${f.rel}:${info.size}:${info.mtimeMs}\n`)
          if (info.mtimeMs > newest) newest = info.mtimeMs
        }
        bundles.push({ slug, files })
      }

      return buildSnapshot(bundles, {
        sha: `fs-${hash.digest('hex').slice(0, 12)}`,
        committedAt: new Date(newest || Date.now()).toISOString(),
        fetchedAt,
        source: 'fs'
      })
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: all PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/lib/skills/fs-source.ts test/fixtures test/unit/fs-source.test.ts
git commit -m "feat: filesystem skills source with fixture bundles"
```

---

### Task 5: Tarball extraction and GitHub source

**Files:**
- Create: `server/lib/skills/tarball.ts`, `server/lib/skills/github-source.ts`
- Test: `test/unit/tarball.test.ts`, `test/unit/github-source.test.ts`

**Interfaces:**
- Consumes: `buildSnapshot`, `RawBundle`, `SkillsSource`, `isExcludedPath`.
- Produces:
  - `extractBundles(tgz: Uint8Array | ArrayBuffer): Promise<RawBundle[]>` — GitHub tarballs prefix every entry with `<owner>-<repo>-<sha7>/`; only `skills/<slug>/**` file entries are kept; `data` is copied out of the tar buffer.
  - `createGithubSource(opts: { owner: string; repo: string; branch: string; token?: string; fetchImpl?: typeof fetch }): SkillsSource` — two requests: `GET https://api.github.com/repos/{owner}/{repo}/commits/{branch}` → `{ sha, commit.committer.date }`, then `GET https://api.github.com/repos/{owner}/{repo}/tarball/{sha}`. Throws `Error('github: <status> <url>')` on non-2xx.

- [ ] **Step 1: Write the failing tests**

`test/unit/tarball.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createTarGzip } from 'nanotar'
import { extractBundles } from '../../server/lib/skills/tarball'

async function fixtureTgz() {
  return createTarGzip([
    { name: 'Patrity-skills-abc1234/package.json', data: '{}' },
    { name: 'Patrity-skills-abc1234/app/app.vue', data: '<template/>' },
    { name: 'Patrity-skills-abc1234/skills/nuxt/README.md', data: '---\nname: Nuxt\n---\n' },
    { name: 'Patrity-skills-abc1234/skills/nuxt/skills/nuxt-docs/SKILL.md', data: '# skill' },
    { name: 'Patrity-skills-abc1234/skills/nuxt/skills/nuxt-docs/cache/x.md', data: 'cached' },
    { name: 'Patrity-skills-abc1234/skills/other/README.md', data: 'other' },
    { name: 'Patrity-skills-abc1234/skills/.DS_Store', data: 'junk' }
  ])
}

describe('extractBundles', () => {
  it('groups skills/<slug>/** files by slug and strips the archive prefix', async () => {
    const bundles = await extractBundles(await fixtureTgz())
    expect(bundles.map(b => b.slug).sort()).toEqual(['nuxt', 'other'])
    const nuxt = bundles.find(b => b.slug === 'nuxt')!
    expect(Object.keys(nuxt.files).sort()).toEqual(['README.md', 'skills/nuxt-docs/SKILL.md'])
    expect(new TextDecoder().decode(nuxt.files['skills/nuxt-docs/SKILL.md'])).toBe('# skill')
  })

  it('ignores files outside skills/ and excluded paths', async () => {
    const bundles = await extractBundles(await fixtureTgz())
    const all = bundles.flatMap(b => Object.keys(b.files))
    expect(all.some(p => p.includes('cache/'))).toBe(false)
    expect(bundles.some(b => b.slug === '.DS_Store')).toBe(false)
  })

  it('returns [] for a tarball with no skills dir', async () => {
    const tgz = await createTarGzip([{ name: 'x-y-z/README.md', data: 'root' }])
    expect(await extractBundles(tgz)).toEqual([])
  })
})
```

`test/unit/github-source.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { createTarGzip } from 'nanotar'
import { createGithubSource } from '../../server/lib/skills/github-source'

const readme = '---\nname: Nuxt\ndescription: d\ntags: [nuxt]\nauthor: a\n---\n'

function fakeFetch(opts: { commitStatus?: number; tarStatus?: number } = {}) {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) })
    if (url.includes('/commits/')) {
      return new Response(JSON.stringify({ sha: 'deadbeefcafe', commit: { committer: { date: '2026-09-03T12:00:00Z' } } }), {
        status: opts.commitStatus ?? 200,
        headers: { 'content-type': 'application/json' }
      })
    }
    if (url.includes('/tarball/')) {
      const tgz = await createTarGzip([{ name: 'Patrity-skills-deadbee/skills/nuxt/README.md', data: readme }])
      return new Response(tgz, { status: opts.tarStatus ?? 200 })
    }
    return new Response('not found', { status: 404 })
  })
  return { impl: impl as unknown as typeof fetch, calls }
}

describe('createGithubSource', () => {
  it('looks up the branch head, downloads the tarball at that sha, and builds a snapshot', async () => {
    const { impl, calls } = fakeFetch()
    const snap = await createGithubSource({ owner: 'Patrity', repo: 'skills', branch: 'main', fetchImpl: impl }).load()
    expect(calls[0]!.url).toBe('https://api.github.com/repos/Patrity/skills/commits/main')
    expect(calls[1]!.url).toBe('https://api.github.com/repos/Patrity/skills/tarball/deadbeefcafe')
    expect(snap).toMatchObject({ sha: 'deadbeefcafe', committedAt: '2026-09-03T12:00:00.000Z', source: 'github' })
    expect(snap.skills.map(s => s.slug)).toEqual(['nuxt'])
    expect(snap.skills[0]!.errors).toEqual([])
  })

  it('sends the bearer token and GitHub headers when a token is configured', async () => {
    const { impl, calls } = fakeFetch()
    await createGithubSource({ owner: 'o', repo: 'r', branch: 'b', token: 'tok', fetchImpl: impl }).load()
    expect(calls[0]!.headers.authorization).toBe('Bearer tok')
    expect(calls[0]!.headers.accept).toBe('application/vnd.github+json')
    expect(calls[0]!.headers['user-agent']).toMatch(/skills/)
  })

  it('omits authorization without a token', async () => {
    const { impl, calls } = fakeFetch()
    await createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load()
    expect(calls[0]!.headers.authorization).toBeUndefined()
  })

  it('throws on a non-2xx commit lookup', async () => {
    const { impl } = fakeFetch({ commitStatus: 403 })
    await expect(createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load())
      .rejects.toThrow(/github: 403/)
  })

  it('throws on a non-2xx tarball download', async () => {
    const { impl } = fakeFetch({ tarStatus: 500 })
    await expect(createGithubSource({ owner: 'o', repo: 'r', branch: 'b', fetchImpl: impl }).load())
      .rejects.toThrow(/github: 500/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit test/unit/tarball.test.ts test/unit/github-source.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`server/lib/skills/tarball.ts`:
```ts
import { parseTarGzip } from 'nanotar'
import type { RawBundle } from './types'
import { isExcludedPath } from './exclusions'

/**
 * GitHub tarballs prefix every entry with `<owner>-<repo>-<sha7>/`. Keep only file
 * entries under `<prefix>/skills/<slug>/…`, grouped by slug. Bytes are copied out of
 * the tar buffer so the (large) archive can be garbage-collected.
 */
export async function extractBundles(tgz: Uint8Array | ArrayBuffer): Promise<RawBundle[]> {
  const entries = await parseTarGzip(tgz, {
    filter: entry => /^[^/]+\/skills\/[^/]+\/.+/.test(entry.name)
  })
  const bySlug = new Map<string, Record<string, Uint8Array>>()
  for (const entry of entries) {
    if (entry.type !== 'file' || !entry.data) continue
    const [, , slug, ...rest] = entry.name.split('/')
    if (!slug || rest.length === 0 || slug.startsWith('.')) continue
    const rel = rest.join('/')
    if (isExcludedPath(rel)) continue
    if (!bySlug.has(slug)) bySlug.set(slug, {})
    bySlug.get(slug)![rel] = new Uint8Array(entry.data)
  }
  return [...bySlug.entries()].map(([slug, files]) => ({ slug, files }))
}
```

`server/lib/skills/github-source.ts`:
```ts
import type { SkillsSource } from './types'
import { buildSnapshot } from './parse-bundle'
import { extractBundles } from './tarball'

export interface GithubSourceOptions {
  owner: string
  repo: string
  branch: string
  token?: string
  fetchImpl?: typeof fetch
}

interface CommitResponse {
  sha: string
  commit: { committer: { date: string } }
}

/** Production source: branch-head lookup, then the repo tarball at that sha. */
export function createGithubSource(opts: GithubSourceOptions): SkillsSource {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const base = `https://api.github.com/repos/${opts.owner}/${opts.repo}`
  const headers: Record<string, string> = {
    'accept': 'application/vnd.github+json',
    'user-agent': 'skills-site (+https://github.com/Patrity/skills)',
    'x-github-api-version': '2022-11-28'
  }
  if (opts.token) headers.authorization = `Bearer ${opts.token}`

  async function get(url: string): Promise<Response> {
    const res = await fetchImpl(url, { headers, redirect: 'follow' })
    if (!res.ok) throw new Error(`github: ${res.status} ${url}`)
    return res
  }

  return {
    async load() {
      const fetchedAt = new Date().toISOString()
      const commit = await (await get(`${base}/commits/${opts.branch}`)).json() as CommitResponse
      const tgz = await (await get(`${base}/tarball/${commit.sha}`)).arrayBuffer()
      const bundles = await extractBundles(tgz)
      return buildSnapshot(bundles, {
        sha: commit.sha,
        committedAt: new Date(commit.commit.committer.date).toISOString(),
        fetchedAt,
        source: 'github'
      })
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: all PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/lib/skills/tarball.ts server/lib/skills/github-source.ts test/unit/tarball.test.ts test/unit/github-source.test.ts
git commit -m "feat: GitHub tarball source with nanotar extraction"
```

---

### Task 6: Snapshot store with memo + Runtime Cache

**Files:**
- Create: `server/lib/skills/store.ts`
- Test: `test/unit/store.test.ts`

**Interfaces:**
- Consumes: `SkillsSource`, `Snapshot`, `BundleFiles`, `SkillManifest`, `SnapshotMeta`.
- Produces:
  - `interface StoreCache { get(key: string): Promise<unknown | null>; set(key: string, value: unknown, options?: { ttl?: number; tags?: string[] }): Promise<void> }` — structurally compatible with `@vercel/functions` `RuntimeCache`.
  - `interface ManifestRecord { meta: SnapshotMeta; skills: SkillManifest[] }`
  - `interface SnapshotStore { getManifests(): Promise<ManifestRecord>; getBundleFiles(slug: string): Promise<BundleFiles | null>; refresh(): Promise<SnapshotMeta> }`
  - `createSnapshotStore(opts: { source: SkillsSource; cache?: StoreCache | null; cacheTtl?: number; memoTtl?: number; now?: () => number }): SnapshotStore`
  - Constants `CACHE_TAG = 'skills'`, `MANIFEST_KEY = 'manifest'`, `bundleKey(slug) = 'bundle:<slug>'`.
- Behaviour: without a cache (fs/dev) every `getManifests()` reloads from the source so edits show on reload. With a cache: memo trusted for `memoTtl` ms (default 60 s), then the cached manifest is re-read; a differing sha drops the in-process file memo. Bundles are stored base64-encoded per slug only when the JSON stays under ~1.5 MB; larger bundles fall back to a source reload. Concurrent cold loads are collapsed into one source call.

- [ ] **Step 1: Write the failing test**

`test/unit/store.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { bundleKey, CACHE_TAG, createSnapshotStore, MANIFEST_KEY, type StoreCache } from '../../server/lib/skills/store'
import type { Snapshot, SkillsSource } from '../../server/lib/skills/types'
import { MAX_FILE_BYTES } from '../../server/lib/skills/exclusions'

const enc = (s: string) => new TextEncoder().encode(s)

function snapshot(sha: string, extraFiles: Record<string, Uint8Array> = {}): Snapshot {
  return {
    sha,
    committedAt: '2026-09-03T00:00:00.000Z',
    fetchedAt: '2026-09-03T00:00:01.000Z',
    source: 'github',
    skills: [{
      slug: 'demo', name: 'Demo', description: 'd', tags: ['t'], author: 'a',
      badges: [], fileCount: 1, totalBytes: 5, errors: [],
      tree: [{ name: 'README.md', path: 'README.md', type: 'file', size: 5, kind: 'text' }]
    }],
    files: { demo: { 'README.md': enc('hello'), ...extraFiles } }
  }
}

function fakeSource(snaps: Snapshot[]): SkillsSource & { calls: number } {
  let i = 0
  const src = {
    calls: 0,
    async load() {
      src.calls++
      const s = snaps[Math.min(i, snaps.length - 1)]!
      i++
      return s
    }
  }
  return src
}

function fakeCache(): StoreCache & { store: Map<string, { value: unknown; tags: string[]; ttl?: number }>; gets: number } {
  const store = new Map<string, { value: unknown; tags: string[]; ttl?: number }>()
  return {
    store,
    gets: 0,
    async get(key) {
      this.gets++
      return store.has(key) ? JSON.parse(JSON.stringify(store.get(key)!.value)) : null
    },
    async set(key, value, options) {
      store.set(key, { value: JSON.parse(JSON.stringify(value)), tags: options?.tags ?? [], ttl: options?.ttl })
    }
  }
}

describe('createSnapshotStore without a cache (fs/dev)', () => {
  it('reloads from the source on every manifest read', async () => {
    const source = fakeSource([snapshot('a')])
    const store = createSnapshotStore({ source })
    await store.getManifests()
    await store.getManifests()
    expect(source.calls).toBe(2)
  })

  it('serves bundle files from the loaded snapshot', async () => {
    const store = createSnapshotStore({ source: fakeSource([snapshot('a')]) })
    const files = await store.getBundleFiles('demo')
    expect(new TextDecoder().decode(files!['README.md'])).toBe('hello')
    expect(await store.getBundleFiles('missing')).toBeNull()
  })
})

describe('createSnapshotStore with a cache (Vercel)', () => {
  it('cold start loads once, writes tagged manifest + bundle entries, then serves from memo', async () => {
    const source = fakeSource([snapshot('a')])
    const cache = fakeCache()
    const store = createSnapshotStore({ source, cache, cacheTtl: 123 })
    const first = await store.getManifests()
    expect(first.meta.sha).toBe('a')
    expect(source.calls).toBe(1)
    expect(cache.store.get(MANIFEST_KEY)).toMatchObject({ tags: [CACHE_TAG], ttl: 123 })
    expect(cache.store.get(bundleKey('demo'))).toMatchObject({ tags: [CACHE_TAG], ttl: 123 })

    cache.gets = 0
    await store.getManifests()
    await store.getBundleFiles('demo')
    expect(source.calls).toBe(1)
    expect(cache.gets).toBe(0)
  })

  it('a fresh instance warms from the cache without touching the source', async () => {
    const cache = fakeCache()
    await createSnapshotStore({ source: fakeSource([snapshot('a')]), cache }).getManifests()

    const source2 = fakeSource([snapshot('b')])
    const store2 = createSnapshotStore({ source: source2, cache })
    expect((await store2.getManifests()).meta.sha).toBe('a')
    const files = await store2.getBundleFiles('demo')
    expect(new TextDecoder().decode(files!['README.md'])).toBe('hello')
    expect(source2.calls).toBe(0)
  })

  it('collapses concurrent cold loads into one source call', async () => {
    const source = fakeSource([snapshot('a')])
    const store = createSnapshotStore({ source, cache: fakeCache() })
    await Promise.all([store.getManifests(), store.getManifests(), store.getBundleFiles('demo')])
    expect(source.calls).toBe(1)
  })

  it('skips caching bundles that would exceed the item size limit and reloads them from source', async () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 512 * 1024).fill(0x61)
    const cache = fakeCache()
    const source = fakeSource([snapshot('a', { 'big.txt': big })])
    await createSnapshotStore({ source, cache }).getManifests()
    expect(cache.store.has(bundleKey('demo'))).toBe(false)

    const source2 = fakeSource([snapshot('a', { 'big.txt': big })])
    const store2 = createSnapshotStore({ source: source2, cache })
    const files = await store2.getBundleFiles('demo')
    expect(files!['big.txt']!.byteLength).toBe(big.byteLength)
    expect(source2.calls).toBe(1)
  })

  it('re-reads the cached manifest after memoTtl and adopts a newer sha', async () => {
    let t = 1_000_000
    const now = () => t
    const cache = fakeCache()
    const store = createSnapshotStore({ source: fakeSource([snapshot('a')]), cache, memoTtl: 1000, now })
    await store.getManifests()

    // Another instance refreshed the cache with sha "b" and a different README.
    const other = createSnapshotStore({ source: fakeSource([snapshot('b', { 'README.md': enc('newer') })]), cache, now })
    await other.refresh()

    expect((await store.getManifests()).meta.sha).toBe('a') // memo still trusted
    t += 1001
    expect((await store.getManifests()).meta.sha).toBe('b')
    const files = await store.getBundleFiles('demo')
    expect(new TextDecoder().decode(files!['README.md'])).toBe('newer')
  })

  it('refresh() forces a source reload and returns the new meta', async () => {
    const source = fakeSource([snapshot('a'), snapshot('b')])
    const cache = fakeCache()
    const store = createSnapshotStore({ source, cache })
    await store.getManifests()
    const meta = await store.refresh()
    expect(meta.sha).toBe('b')
    expect(source.calls).toBe(2)
    expect((cache.store.get(MANIFEST_KEY)!.value as { meta: { sha: string } }).meta.sha).toBe('b')
  })

  it('returns null for an unknown slug without hitting the source again', async () => {
    const source = fakeSource([snapshot('a')])
    const store = createSnapshotStore({ source, cache: fakeCache() })
    await store.getManifests()
    expect(await store.getBundleFiles('nope')).toBeNull()
    expect(source.calls).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit test/unit/store.test.ts`
Expected: FAIL, cannot find `store`.

- [ ] **Step 3: Implement**

`server/lib/skills/store.ts`:
```ts
import type { SkillManifest, SnapshotMeta } from '../../../shared/types/skills'
import type { BundleFiles, SkillsSource, Snapshot } from './types'

/** Structurally matches `RuntimeCache` from @vercel/functions. */
export interface StoreCache {
  get(key: string): Promise<unknown | null>
  set(key: string, value: unknown, options?: { ttl?: number; tags?: string[] }): Promise<void>
}

export interface ManifestRecord {
  meta: SnapshotMeta
  skills: SkillManifest[]
}

export interface SnapshotStore {
  getManifests(): Promise<ManifestRecord>
  getBundleFiles(slug: string): Promise<BundleFiles | null>
  refresh(): Promise<SnapshotMeta>
}

export interface StoreOptions {
  source: SkillsSource
  cache?: StoreCache | null
  /** Runtime Cache TTL (seconds). A safety net only; freshness comes from purges. */
  cacheTtl?: number
  /** How long (ms) the in-process memo is trusted before re-checking the cache. */
  memoTtl?: number
  now?: () => number
}

export const CACHE_TAG = 'skills'
export const MANIFEST_KEY = 'manifest'
export const bundleKey = (slug: string) => `bundle:${slug}`

/** Keeps each cached bundle comfortably under Vercel's 2 MB Runtime Cache item limit. */
const MAX_CACHED_BUNDLE_CHARS = 1_500_000

interface BundleRecord {
  files: Record<string, string>
}

function pickMeta(snap: Snapshot): SnapshotMeta {
  return { sha: snap.sha, committedAt: snap.committedAt, fetchedAt: snap.fetchedAt, source: snap.source }
}

function encodeBundle(files: BundleFiles): BundleRecord | null {
  const out: Record<string, string> = {}
  let chars = 0
  for (const [path, bytes] of Object.entries(files)) {
    const b64 = Buffer.from(bytes).toString('base64')
    chars += b64.length + path.length
    if (chars > MAX_CACHED_BUNDLE_CHARS) return null
    out[path] = b64
  }
  return { files: out }
}

function decodeBundle(record: BundleRecord): BundleFiles {
  const out: BundleFiles = {}
  for (const [path, b64] of Object.entries(record.files)) {
    out[path] = new Uint8Array(Buffer.from(b64, 'base64'))
  }
  return out
}

export function createSnapshotStore(opts: StoreOptions): SnapshotStore {
  const source = opts.source
  const cache = opts.cache ?? null
  const cacheTtl = opts.cacheTtl ?? 60 * 60 * 24
  const memoTtl = opts.memoTtl ?? 60_000
  const now = opts.now ?? Date.now

  let manifests: ManifestRecord | null = null
  let manifestsAt = 0
  let files: Record<string, BundleFiles> = {}
  let inflight: Promise<Snapshot> | null = null

  async function writeCache(snap: Snapshot, record: ManifestRecord): Promise<void> {
    if (!cache) return
    await cache.set(MANIFEST_KEY, record, { ttl: cacheTtl, tags: [CACHE_TAG] })
    for (const [slug, bundle] of Object.entries(snap.files)) {
      const encoded = encodeBundle(bundle)
      if (encoded) await cache.set(bundleKey(slug), encoded, { ttl: cacheTtl, tags: [CACHE_TAG] })
    }
  }

  function loadFromSource(): Promise<Snapshot> {
    if (!inflight) {
      inflight = source.load()
        .then(async (snap) => {
          const record: ManifestRecord = { meta: pickMeta(snap), skills: snap.skills }
          manifests = record
          manifestsAt = now()
          files = snap.files
          await writeCache(snap, record)
          return snap
        })
        .finally(() => {
          inflight = null
        })
    }
    return inflight
  }

  async function readCachedManifests(): Promise<ManifestRecord | null> {
    if (!cache) return null
    const hit = await cache.get(MANIFEST_KEY) as ManifestRecord | null
    return hit && Array.isArray(hit.skills) && hit.meta ? hit : null
  }

  async function getManifests(): Promise<ManifestRecord> {
    if (!cache) {
      await loadFromSource()
      return manifests!
    }
    if (manifests && now() - manifestsAt < memoTtl) return manifests
    const cached = await readCachedManifests()
    if (cached) {
      if (manifests && cached.meta.sha !== manifests.meta.sha) files = {}
      manifests = cached
      manifestsAt = now()
      return cached
    }
    await loadFromSource()
    return manifests!
  }

  async function getBundleFiles(slug: string): Promise<BundleFiles | null> {
    const { skills } = await getManifests()
    if (!skills.some(s => s.slug === slug)) return null
    if (files[slug]) return files[slug]!
    if (cache) {
      const record = await cache.get(bundleKey(slug)) as BundleRecord | null
      if (record && record.files) {
        files[slug] = decodeBundle(record)
        return files[slug]!
      }
    }
    const snap = await loadFromSource()
    return snap.files[slug] ?? null
  }

  async function refresh(): Promise<SnapshotMeta> {
    manifests = null
    manifestsAt = 0
    files = {}
    const snap = await loadFromSource()
    return pickMeta(snap)
  }

  return { getManifests, getBundleFiles, refresh }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: all PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/lib/skills/store.ts test/unit/store.test.ts
git commit -m "feat: snapshot store with per-instance memo and tagged runtime cache"
```

---

### Task 7: Zip builder

**Files:**
- Create: `server/lib/skills/zip.ts`
- Test: `test/unit/zip.test.ts`

**Interfaces:**
- Consumes: `BundleFiles`, `MAX_FILE_BYTES`.
- Produces: `buildZip(slug: string, files: BundleFiles, mtime: Date): Uint8Array` — entries are `<slug>/<path>`, sorted, deflate level 6, oversized files skipped.

- [ ] **Step 1: Write the failing test**

`test/unit/zip.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { buildZip } from '../../server/lib/skills/zip'
import { MAX_FILE_BYTES } from '../../server/lib/skills/exclusions'

const enc = (s: string) => new TextEncoder().encode(s)

describe('buildZip', () => {
  it('roots every entry at <slug>/ and round-trips content', () => {
    const zip = buildZip('demo', {
      'skills/a/SKILL.md': enc('# a'),
      'README.md': enc('# readme'),
      'assets/blob.bin': new Uint8Array([1, 0, 2])
    }, new Date('2026-09-03T00:00:00Z'))
    const out = unzipSync(zip)
    expect(Object.keys(out).sort()).toEqual(['demo/README.md', 'demo/assets/blob.bin', 'demo/skills/a/SKILL.md'])
    expect(strFromU8(out['demo/README.md']!)).toBe('# readme')
    expect(Array.from(out['demo/assets/blob.bin']!)).toEqual([1, 0, 2])
  })

  it('skips oversized files', () => {
    const zip = buildZip('demo', {
      'README.md': enc('ok'),
      'big.txt': new Uint8Array(MAX_FILE_BYTES + 1)
    }, new Date())
    expect(Object.keys(unzipSync(zip))).toEqual(['demo/README.md'])
  })

  it('produces a valid archive for an empty bundle', () => {
    expect(unzipSync(buildZip('demo', {}, new Date()))).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit test/unit/zip.test.ts`
Expected: FAIL, cannot find `zip`.

- [ ] **Step 3: Implement**

`server/lib/skills/zip.ts`:
```ts
import { zipSync, type Zippable } from 'fflate'
import type { BundleFiles } from './types'
import { MAX_FILE_BYTES } from './exclusions'

/** Zip a bundle rooted at `<slug>/` so it unpacks as one folder to merge into `.claude/`. */
export function buildZip(slug: string, files: BundleFiles, mtime: Date): Uint8Array {
  const entries: Zippable = {}
  for (const path of Object.keys(files).sort()) {
    const bytes = files[path]!
    if (bytes.byteLength > MAX_FILE_BYTES) continue
    entries[`${slug}/${path}`] = [bytes, { level: 6, mtime }]
  }
  return zipSync(entries)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/lib/skills/zip.ts test/unit/zip.test.ts
git commit -m "feat: bundle zip builder"
```

---

### Task 8: Nitro API routes, sitemap, robots, and route tests

**Files:**
- Create: `server/utils/skills.ts`
- Create: `server/api/skills/index.get.ts`, `server/api/skills/[slug]/index.get.ts`, `server/api/skills/[slug]/file/[...path].get.ts`, `server/api/skills/[slug]/download.get.ts`, `server/api/revalidate.post.ts`, `server/api/health.get.ts`
- Create: `server/routes/sitemap.xml.get.ts`, `server/routes/robots.txt.get.ts`
- Test: `test/e2e/api.test.ts`

**Interfaces:**
- Consumes: `createSnapshotStore`, `createFsSource`, `createGithubSource`, `buildZip`, `findFile`, `isSafeRelativePath`, `detectLanguage`, DTOs.
- Produces:
  - `useSkillsStore(): SnapshotStore` (singleton per Nitro instance; source chosen from `runtimeConfig.skillsSource`; Runtime Cache only in `github` mode)
  - `isPublicSkill(skill: SkillManifest, meta: SnapshotMeta): boolean`
  - HTTP: `GET /api/skills` → `SkillsListResponse`; `GET /api/skills/:slug` → `SkillDetailResponse`; `GET /api/skills/:slug/file/<path>` → `SkillFileResponse`; `GET /api/skills/:slug/download` → zip; `POST /api/revalidate` (bearer) → `{ ok: true } & SnapshotMeta`; `GET /api/health` → `{ ok: true } & SnapshotMeta`; `GET /sitemap.xml`; `GET /robots.txt`.
- Note: the spec wrote the file endpoint as `?path=`; it is path-based here because Vercel ISR drops query strings from the cache key.

- [ ] **Step 1: Write the failing e2e test**

`test/e2e/api.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { unzipSync } from 'fflate'
import type { SkillDetailResponse, SkillFileResponse, SkillsListResponse } from '../../shared/types/skills'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  setupTimeout: 240_000,
  nuxtConfig: {
    runtimeConfig: {
      skillsSource: 'fs',
      skillsDir: fileURLToPath(new URL('../fixtures/skills', import.meta.url)),
      revalidateSecret: 'test-secret'
    }
  }
})

describe('GET /api/skills', () => {
  it('lists bundles from the fixture dir, including invalid ones in fs mode', async () => {
    const res = await $fetch<SkillsListResponse>('/api/skills')
    expect(res.source).toBe('fs')
    expect(res.sha).toMatch(/^fs-/)
    expect(res.skills.map(s => s.slug)).toEqual(['broken', 'demo', 'no-readme'])
    expect(res.skills.find(s => s.slug === 'demo')).toMatchObject({ name: 'Demo', tags: ['demo', 'fixture'], errors: [] })
    expect('tree' in res.skills[0]!).toBe(false)
  })
})

describe('GET /api/skills/:slug', () => {
  it('returns the manifest with its tree', async () => {
    const res = await $fetch<SkillDetailResponse>('/api/skills/demo')
    expect(res.skill.badges).toEqual(['skills', 'rules', 'hooks', 'settings', 'claude-md'])
    expect(res.skill.tree.some(n => n.name === 'README.md')).toBe(true)
  })
  it('404s for an unknown slug', async () => {
    const res = await fetch('/api/skills/does-not-exist')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/skills/:slug/file/*', () => {
  it('returns markdown with its raw frontmatter split out', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/README.md')
    expect(res).toMatchObject({ path: 'README.md', language: 'markdown', kind: 'text' })
    expect(res.frontmatterRaw).toContain('name: Demo')
    expect(res.content).toContain('# Demo bundle')
  })
  it('returns nested code files with the detected language', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/skills/demo-skill/fetch.py')
    expect(res.language).toBe('python')
    expect(res.frontmatterRaw).toBeNull()
    expect(res.content).toContain('print(')
  })
  it('returns binary files without content', async () => {
    const res = await $fetch<SkillFileResponse>('/api/skills/demo/file/assets/blob.bin')
    expect(res.kind).toBe('binary')
    expect(res.content).toBeNull()
  })
  it('404s for directories, excluded files and unknown paths', async () => {
    expect((await fetch('/api/skills/demo/file/skills')).status).toBe(404)
    expect((await fetch('/api/skills/demo/file/skills/demo-skill/cache/ignored.md')).status).toBe(404)
    expect((await fetch('/api/skills/demo/file/nope.md')).status).toBe(404)
  })
  it('rejects traversal attempts', async () => {
    const res = await fetch('/api/skills/demo/file/..%2F..%2Fpackage.json')
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('GET /api/skills/:slug/download', () => {
  it('streams a zip rooted at <slug>/ without excluded files', async () => {
    const res = await fetch('/api/skills/demo/download')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/zip')
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="demo.zip"')
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    const names = Object.keys(files)
    expect(names).toContain('demo/README.md')
    expect(names).toContain('demo/skills/demo-skill/fetch.py')
    expect(names.every(n => n.startsWith('demo/'))).toBe(true)
    expect(names.some(n => n.includes('/cache/'))).toBe(false)
  })
})

describe('POST /api/revalidate', () => {
  it('401s without the bearer secret', async () => {
    expect((await fetch('/api/revalidate', { method: 'POST' })).status).toBe(401)
    expect((await fetch('/api/revalidate', { method: 'POST', headers: { authorization: 'Bearer wrong' } })).status).toBe(401)
  })
  it('refreshes and returns the sha with the right secret', async () => {
    const res = await $fetch<{ ok: boolean; sha: string }>('/api/revalidate', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' }
    })
    expect(res.ok).toBe(true)
    expect(res.sha).toMatch(/^fs-/)
  })
})

describe('meta routes', () => {
  it('health reports the snapshot', async () => {
    const res = await $fetch<{ ok: boolean; source: string }>('/api/health')
    expect(res).toMatchObject({ ok: true, source: 'fs' })
  })
  it('robots.txt points at the sitemap', async () => {
    const txt = await $fetch<string>('/robots.txt')
    expect(txt).toContain('Sitemap: ')
  })
  it('sitemap lists public skill pages', async () => {
    const xml = await $fetch<string>('/sitemap.xml')
    expect(xml).toContain('<loc>http://localhost:3000/skill/demo</loc>')
    expect(xml).toContain('<loc>http://localhost:3000/skills</loc>')
  })
})
```

- [ ] **Step 2: Run the e2e test to verify it fails**

Run: `pnpm vitest run test/e2e/api.test.ts`
Expected: the app builds, then every request fails with 404 (routes don't exist yet).

- [ ] **Step 3: Implement the store glue and routes**

`server/utils/skills.ts`:
```ts
import { getCache } from '@vercel/functions'
import type { SkillManifest, SnapshotMeta } from '~~/shared/types/skills'
import { createSnapshotStore, type SnapshotStore } from '../lib/skills/store'
import { createFsSource } from '../lib/skills/fs-source'
import { createGithubSource } from '../lib/skills/github-source'

let store: SnapshotStore | undefined

/** One store per Nitro instance. `github` mode adds the Vercel Runtime Cache; `fs` mode reads disk on every request. */
export function useSkillsStore(): SnapshotStore {
  if (store) return store
  const config = useRuntimeConfig()
  const github = config.skillsSource === 'github'
  const source = github
    ? createGithubSource({ ...config.public.github, token: config.githubToken || undefined })
    : createFsSource(config.skillsDir)
  store = createSnapshotStore({ source, cache: github ? getCache({ namespace: 'skills' }) : null })
  return store
}

/** Invalid bundles are visible (with their errors) only when reading from disk. */
export function isPublicSkill(skill: SkillManifest, meta: SnapshotMeta): boolean {
  return meta.source === 'fs' || skill.errors.length === 0
}

export async function requirePublicSkill(slug: string): Promise<{ skill: SkillManifest; meta: SnapshotMeta }> {
  const { meta, skills } = await useSkillsStore().getManifests()
  const skill = skills.find(s => s.slug === slug)
  if (!skill || !isPublicSkill(skill, meta)) {
    throw createError({ statusCode: 404, statusMessage: 'Skill not found' })
  }
  return { skill, meta }
}
```

`server/api/skills/index.get.ts`:
```ts
import type { SkillsListResponse } from '~~/shared/types/skills'

export default defineEventHandler(async (): Promise<SkillsListResponse> => {
  const { meta, skills } = await useSkillsStore().getManifests()
  return {
    ...meta,
    skills: skills
      .filter(s => isPublicSkill(s, meta))
      .map(({ tree: _tree, ...summary }) => summary)
  }
})
```

`server/api/skills/[slug]/index.get.ts`:
```ts
import type { SkillDetailResponse } from '~~/shared/types/skills'

export default defineEventHandler(async (event): Promise<SkillDetailResponse> => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const { skill, meta } = await requirePublicSkill(slug)
  return { ...meta, skill }
})
```

`server/api/skills/[slug]/file/[...path].get.ts`:
```ts
import matter from 'gray-matter'
import type { SkillFileResponse } from '~~/shared/types/skills'
import { detectLanguage } from '~~/shared/utils/language'
import { findFile } from '~~/server/lib/skills/tree'
import { isSafeRelativePath } from '~~/server/lib/skills/paths'

const decoder = new TextDecoder()

export default defineEventHandler(async (event): Promise<SkillFileResponse> => {
  const slug = getRouterParam(event, 'slug') ?? ''
  let path: string
  try {
    path = (getRouterParam(event, 'path') ?? '').split('/').map(decodeURIComponent).join('/')
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }
  if (!isSafeRelativePath(path)) throw createError({ statusCode: 400, statusMessage: 'Invalid path' })

  const { skill } = await requirePublicSkill(slug)
  const node = findFile(skill.tree, path)
  if (!node) throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const files = await useSkillsStore().getBundleFiles(slug)
  const bytes = files?.[path]
  if (!bytes) throw createError({ statusCode: 404, statusMessage: 'File not found' })

  const language = detectLanguage(path)
  let content: string | null = null
  let frontmatterRaw: string | null = null
  if (node.kind === 'text') {
    content = decoder.decode(bytes)
    if (language === 'markdown') {
      const parsed = matter(content)
      frontmatterRaw = parsed.matter.trim() || null
    }
  }
  return { path, language, size: node.size ?? bytes.byteLength, kind: node.kind ?? 'text', content, frontmatterRaw }
})
```

`server/api/skills/[slug]/download.get.ts`:
```ts
import { buildZip } from '~~/server/lib/skills/zip'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  const { meta } = await requirePublicSkill(slug)
  const files = await useSkillsStore().getBundleFiles(slug)
  if (!files) throw createError({ statusCode: 404, statusMessage: 'Skill not found' })

  const zip = buildZip(slug, files, new Date(meta.committedAt))
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${slug}.zip"`)
  setHeader(event, 'Content-Length', String(zip.byteLength))
  return Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength)
})
```

`server/api/revalidate.post.ts`:
```ts
import { invalidateByTag } from '@vercel/functions'
import { CACHE_TAG } from '~~/server/lib/skills/store'

/** Called by CI after a push touching skills/**. Purges CDN + Runtime Cache, then warms the store. */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const auth = getHeader(event, 'authorization') ?? ''
  if (!config.revalidateSecret || auth !== `Bearer ${config.revalidateSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (process.env.VERCEL) await invalidateByTag(CACHE_TAG)
  const meta = await useSkillsStore().refresh()
  return { ok: true, ...meta }
})
```

`server/api/health.get.ts`:
```ts
export default defineEventHandler(async () => {
  const { meta } = await useSkillsStore().getManifests()
  return { ok: true, ...meta }
})
```

`server/routes/robots.txt.get.ts`:
```ts
export default defineEventHandler((event) => {
  const base = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`
})
```

`server/routes/sitemap.xml.get.ts`:
```ts
export default defineEventHandler(async (event) => {
  const base = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  const { meta, skills } = await useSkillsStore().getManifests()
  const paths = [
    '/',
    '/skills',
    '/docs',
    ...skills.filter(s => isPublicSkill(s, meta)).map(s => `/skill/${s.slug}`)
  ]
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + paths.map(p => `  <url><loc>${base}${p}</loc></url>`).join('\n')
    + `\n</urlset>\n`
})
```

- [ ] **Step 4: Run the tests**

Run: `pnpm typecheck` → exit 0. If `getRouterParam` complains about the `path` param name, use `event.context.params?.path`.
Run: `pnpm vitest run test/e2e/api.test.ts`
Expected: all PASS. If the traversal test returns 200, check what `path` decodes to and tighten `isSafeRelativePath`; the intended outcome is 400.
Run: `pnpm test` → unit + e2e PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils server/api server/routes test/e2e
git commit -m "feat: skills API routes, revalidate, health, sitemap and robots with e2e tests"
```

---

### Task 9: App shell — layout, composables, cards, home page

**Files:**
- Create: `app/layouts/default.vue`, `app/composables/useSkills.ts`, `app/composables/useAnalytics.ts`, `app/composables/useGithubUrls.ts`, `app/components/skill/SkillBadges.vue`, `app/components/skill/SkillCard.vue`
- Modify: `app/pages/index.vue` (replace the Task 1 placeholder)

**Interfaces:**
- Consumes: `/api/skills`, DTOs, `githubRepoUrl/TreeUrl/BlobUrl`, `formatBytes`, `umTrackEvent` (auto-imported by nuxt-umami).
- Produces:
  - `useSkillsList()` → `useFetch<SkillsListResponse>` result
  - `useSkill(slug: MaybeRefOrGetter<string>)` → `useFetch<SkillDetailResponse>` result (reactive URL)
  - `useSkillFile(slug: MaybeRefOrGetter<string>, path: MaybeRefOrGetter<string>)` → `useFetch<SkillFileResponse>` result (reactive URL, segments URL-encoded)
  - `useAnalytics()` → `{ trackSkillView(slug), trackDownload(slug, from: 'index' | 'detail'), trackSource(slug) }`
  - `useGithubUrls()` → `{ repo: string; tree(slug): string; blob(slug, path): string }`
  - `<SkillBadges :badges />`, `<SkillCard :skill="SkillSummary" from="index|detail" />`
- UI tests for this and later UI tasks are browser checks with `playwright-cli` against `NUXT_SKILLS_DIR=test/fixtures/skills pnpm dev` (the real `skills/` dir is seeded in Task 15).

- [ ] **Step 1: Write the composables**

`app/composables/useSkills.ts`:
```ts
import type { SkillDetailResponse, SkillFileResponse, SkillsListResponse } from '~~/shared/types/skills'

export function useSkillsList() {
  return useFetch<SkillsListResponse>('/api/skills', { key: 'skills:list' })
}

export function useSkill(slug: MaybeRefOrGetter<string>) {
  return useFetch<SkillDetailResponse>(() => `/api/skills/${encodeURIComponent(toValue(slug))}`)
}

export function useSkillFile(slug: MaybeRefOrGetter<string>, path: MaybeRefOrGetter<string>) {
  return useFetch<SkillFileResponse>(() => {
    const encodedPath = toValue(path).split('/').map(encodeURIComponent).join('/')
    return `/api/skills/${encodeURIComponent(toValue(slug))}/file/${encodedPath}`
  })
}
```

`app/composables/useAnalytics.ts`:
```ts
type EventData = Record<string, string | number | boolean>

/** Thin wrapper over nuxt-umami. In dev/preview the module runs in faux mode and every call is a no-op. */
export function useAnalytics() {
  function track(name: string, data?: EventData) {
    if (import.meta.server) return
    void umTrackEvent(name, data)
  }
  return {
    trackSkillView: (slug: string) => track('skill-view', { slug }),
    trackDownload: (slug: string, from: 'index' | 'detail') => track('skill-download', { slug, from }),
    trackSource: (slug: string) => track('skill-source', { slug })
  }
}
```

`app/composables/useGithubUrls.ts`:
```ts
import { githubBlobUrl, githubRepoUrl, githubTreeUrl } from '~~/shared/utils/github'

export function useGithubUrls() {
  const ref = useRuntimeConfig().public.github
  return {
    repo: githubRepoUrl(ref),
    tree: (slug: string) => githubTreeUrl(ref, slug),
    blob: (slug: string, path: string) => githubBlobUrl(ref, slug, path)
  }
}
```

- [ ] **Step 2: Write the layout**

`app/layouts/default.vue`:
```vue
<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { repo } = useGithubUrls()

const items: NavigationMenuItem[] = [
  { label: 'Home', icon: 'i-lucide-house', to: '/' },
  { label: 'Skills', icon: 'i-lucide-package', to: '/skills' },
  { label: 'Docs', icon: 'i-lucide-book-open', to: '/docs' },
  { label: 'GitHub', icon: 'i-simple-icons-github', to: repo, target: '_blank' }
]
</script>

<template>
  <!-- Sizes are percentages (Nuxt UI default unit). -->
  <UDashboardGroup storage-key="skills-dashboard">
    <UDashboardSidebar
      id="app-sidebar"
      collapsible
      resizable
      :default-size="14"
      :min-size="10"
      :max-size="20"
      class="bg-elevated/25"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          to="/"
          class="flex items-center gap-2 mx-1 min-w-0"
        >
          <UIcon
            name="i-lucide-blocks"
            class="size-6 text-primary shrink-0"
          />
          <span
            v-if="!collapsed"
            class="text-sm font-semibold tracking-tight truncate"
          >Skills</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="items"
          orientation="vertical"
          tooltip
        />
      </template>

      <template #footer="{ collapsed }">
        <UColorModeButton :block="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
```

- [ ] **Step 3: Write the badge row and card components**

`app/components/skill/SkillBadges.vue`:
```vue
<script setup lang="ts">
import type { ContentBadge } from '~~/shared/types/skills'

defineProps<{ badges: ContentBadge[] }>()

const META: Record<ContentBadge, { label: string; icon: string }> = {
  'skills': { label: 'Skills', icon: 'i-lucide-graduation-cap' },
  'rules': { label: 'Rules', icon: 'i-lucide-scale' },
  'hooks': { label: 'Hooks', icon: 'i-lucide-webhook' },
  'settings': { label: 'Settings', icon: 'i-lucide-settings-2' },
  'claude-md': { label: 'CLAUDE.md', icon: 'i-lucide-file-text' }
}
</script>

<template>
  <div class="flex flex-wrap gap-1.5">
    <UBadge
      v-for="badge in badges"
      :key="badge"
      :label="META[badge].label"
      :icon="META[badge].icon"
      color="neutral"
      variant="subtle"
      size="sm"
    />
    <span
      v-if="!badges.length"
      class="text-xs text-dimmed"
    >No recognised .claude content</span>
  </div>
</template>
```

`app/components/skill/SkillCard.vue`:
```vue
<script setup lang="ts">
import type { SkillSummary } from '~~/shared/types/skills'
import { formatBytes } from '~~/shared/utils/format'

const props = defineProps<{
  skill: SkillSummary
  from: 'index' | 'detail'
}>()

const { tree } = useGithubUrls()
const { trackDownload, trackSource } = useAnalytics()
const downloadUrl = computed(() => `/api/skills/${props.skill.slug}/download`)
</script>

<template>
  <UPageCard
    variant="subtle"
    :ui="{ container: 'gap-3', footer: 'w-full' }"
  >
    <template #title>
      <NuxtLink
        :to="`/skill/${skill.slug}`"
        class="hover:text-primary transition-colors"
      >
        {{ skill.name }}
      </NuxtLink>
    </template>

    <template #description>
      {{ skill.description }}
    </template>

    <template #body>
      <div class="flex flex-wrap gap-1.5">
        <UBadge
          v-for="tag in skill.tags"
          :key="tag"
          :label="tag"
          color="primary"
          variant="soft"
          size="sm"
        />
      </div>
      <SkillBadges
        :badges="skill.badges"
        class="mt-2"
      />
      <p
        v-if="skill.errors.length"
        class="mt-2 text-xs text-error"
      >
        {{ skill.errors.length }} validation {{ skill.errors.length === 1 ? 'issue' : 'issues' }}
      </p>
    </template>

    <template #footer>
      <div class="flex items-center justify-between gap-2 w-full min-w-0">
        <span class="text-xs text-muted truncate">
          by
          <ULink
            v-if="skill.authorUrl"
            :to="skill.authorUrl"
            target="_blank"
            class="text-default"
          >{{ skill.author }}</ULink>
          <span v-else>{{ skill.author }}</span>
          · {{ skill.fileCount }} files · {{ formatBytes(skill.totalBytes) }}
        </span>
        <UFieldGroup size="xs">
          <UButton
            label="Source"
            icon="i-simple-icons-github"
            color="neutral"
            variant="outline"
            :to="tree(skill.slug)"
            target="_blank"
            @click="trackSource(skill.slug)"
          />
          <UButton
            label="Download"
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            :to="downloadUrl"
            external
            @click="trackDownload(skill.slug, from)"
          />
        </UFieldGroup>
      </div>
    </template>
  </UPageCard>
</template>
```

- [ ] **Step 4: Write the home page**

`app/pages/index.vue`:
```vue
<script setup lang="ts">
const { data } = await useSkillsList()
const { repo } = useGithubUrls()
const featured = computed(() => (data.value?.skills ?? []).slice(0, 6))

useSeoMeta({
  title: 'Skills',
  description: 'Open-source, downloadable Claude Code setups: skills, rules, hooks and settings bundled to drop into any project.',
  ogTitle: 'Skills — reusable Claude Code setups',
  ogDescription: 'Open-source, downloadable Claude Code setups: skills, rules, hooks and settings bundled to drop into any project.'
})
</script>

<template>
  <UDashboardPanel
    id="home"
    :ui="{ body: 'p-0 sm:p-0 gap-0' }"
  >
    <template #header>
      <UDashboardNavbar title="Home">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageHero
        headline="Open source"
        title="Reusable Claude Code setups, one download away."
        description="Every bundle here mirrors a project's .claude/ directory — skills, rules, hooks, settings and a CLAUDE.md pointer — so a new project starts with the tooling you already trust."
        :links="[
          { label: 'Browse skills', to: '/skills', icon: 'i-lucide-package', size: 'xl' },
          { label: 'Read the docs', to: '/docs', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right', size: 'xl' }
        ]"
      />

      <UPageSection
        headline="How it works"
        title="Bundles mirror your .claude/ directory"
        description="Each bundle lives in skills/<slug>/ in the GitHub repo. A README with YAML frontmatter is the only required file; everything else is exactly what you would commit under .claude/."
        :features="[
          { title: 'Download and drop in', description: 'Grab the zip, unzip it into your project\'s .claude/ folder, paste the CLAUDE.md pointer if the bundle ships one.', icon: 'i-lucide-download' },
          { title: 'Rendered straight from GitHub', description: 'Pages are built from the repository at request time. A merge to main is live in seconds, no redeploy.', icon: 'i-lucide-git-branch' },
          { title: 'Readable before you install', description: 'Browse the file tree, read SKILL.md and rules with rendered markdown, inspect hooks and settings with syntax highlighting.', icon: 'i-lucide-eye' }
        ]"
      />

      <UPageSection
        v-if="featured.length"
        headline="Latest"
        title="Bundles"
        :links="[{ label: 'All skills', to: '/skills', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right' }]"
      >
        <UPageGrid>
          <SkillCard
            v-for="skill in featured"
            :key="skill.slug"
            :skill="skill"
            from="index"
          />
        </UPageGrid>
      </UPageSection>

      <UPageSection
        headline="Contribute"
        title="Add your own bundle"
        description="Open a pull request that adds a directory under skills/ with a README. CI validates the frontmatter; once merged to main the bundle is live within seconds — no rebuild."
        :links="[{ label: 'Open on GitHub', to: repo, target: '_blank', icon: 'i-simple-icons-github', color: 'neutral', variant: 'outline' }]"
      />
    </template>
  </UDashboardPanel>
</template>
```

- [ ] **Step 5: Verify in the browser**

Run: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.
Start: `NUXT_SKILLS_DIR=test/fixtures/skills pnpm dev > /tmp/skills-dev.log 2>&1 &` and wait for `curl -sf http://localhost:3000`.
```bash
playwright-cli open http://localhost:3000
playwright-cli snapshot | grep -E 'Reusable Claude Code setups|Browse skills|Demo|Download|GitHub'
playwright-cli screenshot --filename=/tmp/home.png
```
Expected: hero title, both hero links, a card titled "Demo" with tags `demo`/`fixture`, badges, Source and Download buttons, and a GitHub nav entry. Read `/tmp/home.png` and confirm the sidebar + hero render with no unstyled content. Check the console: `playwright-cli console 2>/dev/null | grep -i error` prints nothing (aside from the expected `[umami] id is missing` build warning in the terminal log).

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat: dashboard layout, skills composables, cards and home page"
```

---

### Task 10: Markdown and code viewers

**Files:**
- Create: `app/components/MarkdownView.vue`, `app/components/CodeView.client.vue`

**Interfaces:**
- Produces: `<MarkdownView :source="string" :cache-key="string?" />` (renders via `<MDC>`; MDC strips frontmatter itself) and `<CodeView :code="string" :language="Language" />` (read-only CodeMirror, theme follows `useColorMode()`).
- Consumes: `Language` type.

- [ ] **Step 1: Write `MarkdownView.vue`**

```vue
<script setup lang="ts">
// Wraps @nuxtjs/mdc so prose styling lives in one place. Nuxt UI supplies the Prose*
// components; `mdc.headings.anchorLinks` is disabled in nuxt.config to dodge a hydration bug.
defineProps<{
  source: string
  /** Pass something stable like `${slug}:${path}` so MDC's useAsyncData key never collides. */
  cacheKey?: string
}>()
</script>

<template>
  <article class="skill-prose">
    <MDC
      :value="source"
      :cache-key="cacheKey"
      tag="div"
    />
  </article>
</template>

<style>
.skill-prose > div > :first-child {
  margin-top: 0;
}
.skill-prose pre {
  overflow-x: auto;
}
</style>
```

- [ ] **Step 2: Write `CodeView.client.vue`**

```vue
<script setup lang="ts">
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, highlightSpecialChars, lineNumbers } from '@codemirror/view'
import { bracketMatching, defaultHighlightStyle, foldGutter, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { markdown } from '@codemirror/lang-markdown'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import { python } from '@codemirror/lang-python'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import type { Language } from '~~/shared/types/skills'

const props = defineProps<{
  code: string
  language: Language
}>()

const host = ref<HTMLDivElement>()
const colorMode = useColorMode()
let view: EditorView | null = null
const languageCompartment = new Compartment()
const themeCompartment = new Compartment()

function languageExtension(lang: Language): Extension {
  switch (lang) {
    case 'markdown': return markdown()
    case 'javascript': return javascript()
    case 'typescript': return javascript({ typescript: true })
    case 'json': return json()
    case 'yaml': return yaml()
    case 'python': return python()
    case 'shell': return StreamLanguage.define(shell)
    default: return []
  }
}

function themeExtension(dark: boolean): Extension {
  return dark ? oneDark : syntaxHighlighting(defaultHighlightStyle, { fallback: true })
}

const baseTheme = EditorView.theme({
  '&': { fontSize: '13px' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: '1.6'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--ui-bg-muted)',
    borderRight: '1px solid var(--ui-border)',
    color: 'var(--ui-text-dimmed)'
  },
  '.cm-content': { padding: '12px 0' },
  '.cm-line': { padding: '0 16px' }
})

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.code,
      extensions: [
        lineNumbers(),
        highlightSpecialChars(),
        drawSelection(),
        bracketMatching(),
        foldGutter(),
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        baseTheme,
        languageCompartment.of(languageExtension(props.language)),
        themeCompartment.of(themeExtension(colorMode.value === 'dark'))
      ]
    })
  })
})

watch(() => props.code, (code) => {
  if (view && code !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } })
  }
})

watch(() => props.language, (lang) => {
  view?.dispatch({ effects: languageCompartment.reconfigure(languageExtension(lang)) })
})

watch(() => colorMode.value, (mode) => {
  view?.dispatch({ effects: themeCompartment.reconfigure(themeExtension(mode === 'dark')) })
})

onUnmounted(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div
    ref="host"
    class="code-view rounded-md border border-default overflow-hidden"
  />
</template>

<style>
.code-view .cm-editor {
  height: auto;
}
.code-view .cm-editor.cm-focused {
  outline: none;
}
</style>
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck` → exit 0. If `@codemirror/legacy-modes/mode/shell` fails to resolve types, confirm the package is installed (`ls node_modules/@codemirror/legacy-modes/mode/shell.d.ts`).
These components are exercised in the browser in Task 11.

- [ ] **Step 4: Commit**

```bash
git add app/components/MarkdownView.vue app/components/CodeView.client.vue
git commit -m "feat: MDC markdown view and read-only CodeMirror view"
```

---

### Task 11: Skill page — tree, content panel, actions

**Files:**
- Create: `app/pages/skill/[...segments].vue`, `app/components/skill/SkillTree.vue`, `app/components/skill/SkillMetaCard.vue`, `app/components/skill/FileActions.vue`

**Interfaces:**
- Consumes: `useSkill`, `useSkillFile`, `useAnalytics`, `useGithubUrls`, `MarkdownView`, `CodeView`, `SkillBadges`, `isMarkdownPath`, `formatBytes`.
- Produces: route `/skill/<slug>` (README) and `/skill/<slug>/<path…>` (file); `<SkillTree :tree :selected-path @select(path) />`; `<SkillMetaCard :skill />`; `<FileActions :slug :path :is-markdown :content v-model:view />` where `view: 'rendered' | 'source'`.
- One page instance per slug (`definePageMeta` key) so file navigation never remounts the tree.

- [ ] **Step 1: Write `SkillTree.vue`**

```vue
<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui'
import type { TreeNode } from '~~/shared/types/skills'

const props = defineProps<{
  tree: TreeNode[]
  selectedPath: string
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

interface SkillTreeItem extends TreeItem {
  path: string
  nodeType: 'file' | 'dir'
  children?: SkillTreeItem[]
}

function iconFor(name: string): string {
  const lower = name.toLowerCase()
  if (lower === 'readme.md') return 'i-lucide-book-open'
  if (lower.endsWith('.md')) return 'i-lucide-file-text'
  if (lower.endsWith('.json')) return 'i-lucide-file-json'
  if (lower.endsWith('.py')) return 'i-lucide-file-code-2'
  if (lower.endsWith('.sh') || lower.endsWith('.bash')) return 'i-lucide-terminal'
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'i-lucide-file-cog'
  if (lower.endsWith('.ts') || lower.endsWith('.js')) return 'i-lucide-file-code'
  return 'i-lucide-file'
}

function toItems(nodes: TreeNode[]): SkillTreeItem[] {
  return nodes.map(n => n.type === 'dir'
    ? { label: n.name, path: n.path, nodeType: 'dir' as const, children: toItems(n.children ?? []) }
    : { label: n.name, path: n.path, nodeType: 'file' as const, icon: iconFor(n.name) })
}
const items = computed(() => toItems(props.tree))

function ancestors(path: string): string[] {
  const parts = path.split('/')
  const out: string[] = []
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'))
  return out
}

// UTree keys expanded nodes by `get-key` (the path). Start with the selected file's ancestors
// open and keep adding as the route changes; never collapse on the user's behalf.
const expanded = ref<string[]>(ancestors(props.selectedPath))
watch(() => props.selectedPath, (path) => {
  expanded.value = [...new Set([...expanded.value, ...ancestors(path)])]
})

function findItem(list: SkillTreeItem[], path: string): SkillTreeItem | undefined {
  for (const item of list) {
    if (item.path === path) return item
    const child = item.children && findItem(item.children, path)
    if (child) return child
  }
  return undefined
}

// v-model holds the item OBJECT (Nuxt UI v4 Tree), not a key.
const selected = computed<SkillTreeItem | undefined>({
  get: () => findItem(items.value, props.selectedPath),
  set: (item) => {
    if (item && item.nodeType === 'file' && item.path !== props.selectedPath) emit('select', item.path)
  }
})

function onSelect(e: Event) {
  // Folders toggle open/closed but must not become the selection.
  const item = (e as CustomEvent<{ value?: SkillTreeItem }>).detail?.value
  if (item?.nodeType === 'dir') e.preventDefault()
}
</script>

<template>
  <UTree
    v-model="selected"
    v-model:expanded="expanded"
    :items="items"
    :get-key="(item: SkillTreeItem) => item.path"
    size="sm"
    class="p-2"
    @select="onSelect"
  />
</template>
```

If `v-model` typing fights the generic `UTree` signature, bind explicitly: `:model-value="selected" @update:model-value="(v) => (selected = v as SkillTreeItem | undefined)"`.

- [ ] **Step 2: Write `SkillMetaCard.vue`**

```vue
<script setup lang="ts">
import type { SkillManifest } from '~~/shared/types/skills'
import { formatBytes } from '~~/shared/utils/format'

defineProps<{ skill: SkillManifest }>()
</script>

<template>
  <UPageCard
    variant="subtle"
    :title="skill.name"
    :description="skill.description"
    :ui="{ container: 'gap-3' }"
  >
    <template #body>
      <div class="flex flex-wrap items-center gap-1.5">
        <UBadge
          v-for="tag in skill.tags"
          :key="tag"
          :label="tag"
          color="primary"
          variant="soft"
          size="sm"
        />
      </div>
      <SkillBadges
        :badges="skill.badges"
        class="mt-3"
      />
      <dl class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <dt class="text-xs text-muted">
            Author
          </dt>
          <dd class="truncate">
            <ULink
              v-if="skill.authorUrl"
              :to="skill.authorUrl"
              target="_blank"
              class="text-primary"
            >{{ skill.author }}</ULink>
            <span v-else>{{ skill.author }}</span>
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Files
          </dt>
          <dd>{{ skill.fileCount }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted">
            Size
          </dt>
          <dd>{{ formatBytes(skill.totalBytes) }}</dd>
        </div>
        <div v-if="skill.requires?.length">
          <dt class="text-xs text-muted">
            Requires
          </dt>
          <dd class="font-mono text-xs">
            {{ skill.requires.join(', ') }}
          </dd>
        </div>
      </dl>
    </template>
  </UPageCard>
</template>
```

- [ ] **Step 3: Write `FileActions.vue`**

```vue
<script setup lang="ts">
const props = defineProps<{
  slug: string
  path: string
  isMarkdown: boolean
  content: string | null
}>()

const view = defineModel<'rendered' | 'source'>('view', { required: true })

const { blob } = useGithubUrls()
const { trackDownload, trackSource } = useAnalytics()
const toast = useToast()

async function copyRaw() {
  if (!props.content) return
  await navigator.clipboard.writeText(props.content)
  toast.add({ title: 'Copied raw file', icon: 'i-lucide-clipboard-check', color: 'success' })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <UFieldGroup
      v-if="isMarkdown"
      size="xs"
    >
      <UButton
        label="Rendered"
        icon="i-lucide-eye"
        :color="view === 'rendered' ? 'primary' : 'neutral'"
        :variant="view === 'rendered' ? 'solid' : 'outline'"
        @click="view = 'rendered'"
      />
      <UButton
        label="Source"
        icon="i-lucide-code"
        :color="view === 'source' ? 'primary' : 'neutral'"
        :variant="view === 'source' ? 'solid' : 'outline'"
        @click="view = 'source'"
      />
    </UFieldGroup>

    <UFieldGroup size="xs">
      <UTooltip text="Copy raw file">
        <UButton
          icon="i-lucide-clipboard"
          color="neutral"
          variant="outline"
          :disabled="!content"
          aria-label="Copy raw file"
          @click="copyRaw"
        />
      </UTooltip>
      <UTooltip text="View on GitHub">
        <UButton
          icon="i-simple-icons-github"
          color="neutral"
          variant="outline"
          :to="blob(slug, path)"
          target="_blank"
          aria-label="View on GitHub"
          @click="trackSource(slug)"
        />
      </UTooltip>
      <UTooltip text="Download bundle (.zip)">
        <UButton
          icon="i-lucide-download"
          color="neutral"
          variant="outline"
          :to="`/api/skills/${slug}/download`"
          external
          aria-label="Download bundle"
          @click="trackDownload(slug, 'detail')"
        />
      </UTooltip>
    </UFieldGroup>
  </div>
</template>
```

- [ ] **Step 4: Write the page**

`app/pages/skill/[...segments].vue`:
```vue
<script setup lang="ts">
import type { BreadcrumbItem } from '@nuxt/ui'
import type { TreeNode } from '~~/shared/types/skills'
import { isMarkdownPath } from '~~/shared/utils/language'
import { formatBytes } from '~~/shared/utils/format'

definePageMeta({
  // One page instance per bundle: moving between files must not remount the tree.
  key: route => `skill-${(route.params.segments as string[] | undefined)?.[0] ?? ''}`
})

const route = useRoute()
const segments = computed(() => {
  const raw = route.params.segments
  return (Array.isArray(raw) ? raw : [raw]).filter(Boolean) as string[]
})
const slug = computed(() => segments.value[0] ?? '')
const routePath = computed(() => segments.value.slice(1).join('/'))

const { data: detail, error } = await useSkill(slug)
if (error.value || !detail.value) {
  throw createError({ statusCode: 404, statusMessage: 'Skill not found', fatal: true })
}
const skill = computed(() => detail.value!.skill)

function flatten(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const node of nodes) {
    if (node.type === 'file') out.push(node)
    if (node.children) flatten(node.children, out)
  }
  return out
}
const readmePath = computed(() => flatten(skill.value.tree).find(n => n.name.toLowerCase() === 'readme.md')?.path ?? '')
const currentPath = computed(() => routePath.value || readmePath.value)
const isReadme = computed(() => currentPath.value !== '' && currentPath.value === readmePath.value)
const isMarkdown = computed(() => isMarkdownPath(currentPath.value))

const { data: file, error: fileError, status: fileStatus } = await useSkillFile(slug, currentPath)

const view = ref<'rendered' | 'source'>('rendered')
const treeOpen = ref(false)
const contentEl = ref<HTMLElement>()

watch(currentPath, () => {
  view.value = 'rendered'
  contentEl.value?.scrollTo({ top: 0 })
})

function onSelect(path: string) {
  treeOpen.value = false
  navigateTo(`/skill/${slug.value}/${path}`)
}

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
  { label: 'Skills', to: '/skills' },
  { label: skill.value.name, to: isReadme.value ? undefined : `/skill/${slug.value}` },
  ...(isReadme.value ? [] : currentPath.value.split('/').map(label => ({ label })))
])

useSeoMeta({
  title: () => (isReadme.value ? skill.value.name : `${currentPath.value} · ${skill.value.name}`),
  description: () => skill.value.description,
  ogTitle: () => skill.value.name,
  ogDescription: () => skill.value.description
})

const { trackSkillView } = useAnalytics()
onMounted(() => trackSkillView(slug.value))
</script>

<template>
  <div class="flex flex-1 min-w-0 h-full">
    <UDashboardPanel
      id="skill-tree"
      resizable
      :default-size="22"
      :min-size="15"
      :max-size="35"
      class="hidden lg:flex"
      :ui="{ body: 'p-0 sm:p-0 gap-0' }"
    >
      <template #header>
        <UDashboardNavbar
          :title="skill.name"
          :toggle="false"
        >
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <SkillTree
          :tree="skill.tree"
          :selected-path="currentPath"
          @select="onSelect"
        />
      </template>
    </UDashboardPanel>

    <UDashboardPanel
      id="skill-content"
      :ui="{ body: 'p-0 sm:p-0 gap-0' }"
    >
      <template #header>
        <UDashboardNavbar>
          <template #leading>
            <UButton
              icon="i-lucide-folder-tree"
              color="neutral"
              variant="ghost"
              class="lg:hidden"
              aria-label="Browse files"
              @click="treeOpen = true"
            />
          </template>
          <template #title>
            <UBreadcrumb
              :items="breadcrumbs"
              class="min-w-0"
            />
          </template>
          <template #right>
            <FileActions
              v-model:view="view"
              :slug="slug"
              :path="currentPath"
              :is-markdown="isMarkdown"
              :content="file?.content ?? null"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div
          ref="contentEl"
          class="h-full overflow-y-auto"
        >
          <div class="mx-auto max-w-4xl p-4 sm:p-6 flex flex-col gap-6">
            <SkillMetaCard
              v-if="isReadme"
              :skill="skill"
            />

            <UAlert
              v-if="skill.errors.length"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              title="This bundle has validation issues"
              :description="skill.errors.join(' · ')"
            />

            <UAlert
              v-if="fileError"
              color="error"
              variant="subtle"
              icon="i-lucide-file-x"
              title="Could not load this file"
              :description="fileError.statusMessage ?? 'Not found'"
            />

            <template v-else-if="file">
              <UAlert
                v-if="file.kind !== 'text'"
                color="neutral"
                variant="subtle"
                icon="i-lucide-file"
                :title="file.kind === 'binary' ? 'Binary file' : 'File too large to preview'"
                :description="`${formatBytes(file.size)} · view it on GitHub or download the bundle.`"
              />

              <template v-else>
                <UCollapsible v-if="isMarkdown && !isReadme && file.frontmatterRaw && view === 'rendered'">
                  <UButton
                    label="Frontmatter"
                    icon="i-lucide-braces"
                    trailing-icon="i-lucide-chevron-down"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                  />
                  <template #content>
                    <pre class="mt-2 rounded-md bg-elevated border border-default p-3 text-xs overflow-x-auto">{{ file.frontmatterRaw }}</pre>
                  </template>
                </UCollapsible>

                <MarkdownView
                  v-if="isMarkdown && view === 'rendered'"
                  :source="file.content ?? ''"
                  :cache-key="`${slug}:${currentPath}`"
                />
                <CodeView
                  v-else
                  :code="file.content ?? ''"
                  :language="isMarkdown ? 'markdown' : file.language"
                />
              </template>
            </template>

            <div
              v-else-if="fileStatus === 'pending'"
              class="space-y-3"
            >
              <USkeleton class="h-6 w-1/3" />
              <USkeleton class="h-4 w-full" />
              <USkeleton class="h-4 w-5/6" />
            </div>
          </div>
        </div>
      </template>
    </UDashboardPanel>

    <USlideover
      v-model:open="treeOpen"
      side="left"
      :title="skill.name"
      :ui="{ body: 'p-0' }"
    >
      <template #body>
        <SkillTree
          :tree="skill.tree"
          :selected-path="currentPath"
          @select="onSelect"
        />
      </template>
    </USlideover>
  </div>
</template>
```

- [ ] **Step 5: Verify in the browser**

Run: `pnpm typecheck` and `pnpm lint` → exit 0.
With the fixture dev server running (`NUXT_SKILLS_DIR=test/fixtures/skills pnpm dev`):
```bash
playwright-cli goto http://localhost:3000/skill/demo
playwright-cli snapshot | grep -E 'Demo|README.md|fetch.py|Rendered|Source|Download'
```
Expected: meta card with "Demo", tags, badges; tree shows `assets`, `hooks`, `rules`, `skills` folders and `CLAUDE.md`, `README.md`, `settings.local.json`; the README body renders "Demo bundle" as a heading; Rendered/Source toggle present.
```bash
# Click the `skills` folder, then `demo-skill`, then fetch.py — grab refs from the snapshot each time.
playwright-cli snapshot | grep -E 'skills|demo-skill|fetch.py'
playwright-cli click <ref-of-skills-folder>
playwright-cli click <ref-of-demo-skill-folder>
playwright-cli click <ref-of-fetch.py>
playwright-cli eval "() => ({ path: location.pathname, cm: !!document.querySelector('.cm-editor'), gutter: !!document.querySelector('.cm-gutters') })"
```
Expected: `{ path: '/skill/demo/skills/demo-skill/fetch.py', cm: true, gutter: true }` and the breadcrumb reads Skills › Demo › skills › demo-skill › fetch.py.
```bash
playwright-cli goto http://localhost:3000/skill/demo/rules/demo.md
playwright-cli snapshot | grep -E 'Frontmatter|Demo rule'
playwright-cli click <ref-of-Source-button>
playwright-cli eval "() => !!document.querySelector('.cm-editor')"   # → true
playwright-cli goto http://localhost:3000/skill/demo/assets/blob.bin
playwright-cli snapshot | grep 'Binary file'
playwright-cli goto http://localhost:3000/skill/nope
playwright-cli eval "() => document.body.innerText.includes('404')"   # → true
playwright-cli goto http://localhost:3000/skill/broken
playwright-cli snapshot | grep 'validation issues'
playwright-cli screenshot --filename=/tmp/skill.png
```
Also confirm the download link: `curl -sI http://localhost:3000/api/skills/demo/download | grep -i 'content-disposition'` → `attachment; filename="demo.zip"`. Toggle dark mode with the sidebar button and confirm the CodeMirror gutter recolours (screenshot).

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat: skill page with file tree, markdown/code viewers and actions"
```

---

### Task 12: Skills index page

**Files:**
- Create: `app/pages/skills.vue`

**Interfaces:**
- Consumes: `useSkillsList`, `SkillCard`.
- Produces: route `/skills` with client-side text search and tag chips; `?q=` and `?tag=` are reflected in the URL so filtered views are shareable.

- [ ] **Step 1: Write the page**

`app/pages/skills.vue`:
```vue
<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { data, status } = await useSkillsList()

const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const activeTag = ref<string | null>(typeof route.query.tag === 'string' ? route.query.tag : null)

// Keep the URL in sync so a filtered list can be shared; replace so Back isn't flooded.
watch([q, activeTag], ([nextQ, nextTag]) => {
  router.replace({ query: { ...(nextQ ? { q: nextQ } : {}), ...(nextTag ? { tag: nextTag } : {}) } })
})

const skills = computed(() => data.value?.skills ?? [])

const tags = computed(() => {
  const counts = new Map<string, number>()
  for (const s of skills.value) for (const t of s.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }))
})

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  return skills.value.filter((s) => {
    if (activeTag.value && !s.tags.includes(activeTag.value)) return false
    if (!needle) return true
    const haystack = [s.name, s.slug, s.description, s.author, ...s.tags].join(' ').toLowerCase()
    return haystack.includes(needle)
  })
})

function toggleTag(tag: string) {
  activeTag.value = activeTag.value === tag ? null : tag
}

useSeoMeta({
  title: 'All skills',
  description: 'Browse every Claude Code bundle: search by name, filter by tag, view the source or download a zip.'
})
</script>

<template>
  <UDashboardPanel
    id="skills-index"
    :ui="{ body: 'gap-4' }"
  >
    <template #header>
      <UDashboardNavbar title="Skills">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <UBadge
            :label="String(filtered.length)"
            color="neutral"
            variant="subtle"
          />
        </template>
        <template #right>
          <UInput
            v-model="q"
            icon="i-lucide-search"
            placeholder="Search skills…"
            size="sm"
            class="w-48 sm:w-64"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="tags.length"
        class="flex flex-wrap gap-1.5"
      >
        <UButton
          v-for="{ tag, count } in tags"
          :key="tag"
          :label="`${tag} · ${count}`"
          size="xs"
          :color="activeTag === tag ? 'primary' : 'neutral'"
          :variant="activeTag === tag ? 'solid' : 'subtle'"
          @click="toggleTag(tag)"
        />
        <UButton
          v-if="activeTag || q"
          label="Clear"
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="activeTag = null; q = ''"
        />
      </div>

      <div
        v-if="status === 'pending'"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
      >
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-48 w-full"
        />
      </div>

      <UPageGrid v-else-if="filtered.length">
        <SkillCard
          v-for="skill in filtered"
          :key="skill.slug"
          :skill="skill"
          from="index"
        />
      </UPageGrid>

      <UAlert
        v-else
        color="neutral"
        variant="subtle"
        icon="i-lucide-search-x"
        title="No skills match"
        :description="q || activeTag ? 'Try a different search or clear the tag filter.' : 'No bundles have been published yet.'"
      />
    </template>
  </UDashboardPanel>
</template>
```

- [ ] **Step 2: Verify in the browser**

Run: `pnpm typecheck` and `pnpm lint` → exit 0.
With the fixture dev server (`NUXT_SKILLS_DIR=test/fixtures/skills pnpm dev`):
```bash
playwright-cli goto http://localhost:3000/skills
playwright-cli snapshot | grep -E 'Demo|Broken|no-readme|demo · 1|fixture · 1'
playwright-cli click <ref-of-"fixture · 1"-chip>
playwright-cli eval "() => ({ url: location.search, cards: document.querySelectorAll('a[href^=\"/skill/\"]').length })"
```
Expected: three cards initially (fs mode shows invalid ones with a red "validation issues" line); after clicking the tag chip the URL is `?tag=fixture` and only the Demo card remains.
```bash
playwright-cli snapshot | grep -i 'search skills'      # find the input ref
playwright-cli fill <input-ref> "zzz"
playwright-cli snapshot | grep 'No skills match'
playwright-cli goto "http://localhost:3000/skills?q=demo"
playwright-cli eval "() => document.querySelectorAll('a[href^=\"/skill/\"]').length"   # → 1
```

- [ ] **Step 3: Commit**

```bash
git add app/pages/skills.vue
git commit -m "feat: skills index with search and tag filters"
```

---

### Task 13: Docs pages and content

**Files:**
- Create: `content/docs/nav.ts`, `content/docs/getting-started.md`, `content/docs/bundle-structure.md`, `content/docs/frontmatter.md`, `content/docs/hooks-and-settings.md`, `content/docs/contributing.md`
- Create: `app/utils/docs.ts`, `app/pages/docs/[[slug]].vue`
- Modify: `server/routes/sitemap.xml.get.ts` (add per-doc URLs)

**Interfaces:**
- Produces: `docsNav: DocEntry[]` (`{ slug, title, file, description }`), `getDoc(slug): { entry: DocEntry; source: string } | null`, routes `/docs` (first entry) and `/docs/<slug>`.

- [ ] **Step 1: Write the nav and loader**

`content/docs/nav.ts`:
```ts
export interface DocEntry {
  slug: string
  title: string
  file: string
  description: string
}

export const docsNav: DocEntry[] = [
  { slug: 'getting-started', title: 'Getting started', file: 'getting-started.md', description: 'Install a bundle into a project in under a minute.' },
  { slug: 'bundle-structure', title: 'Bundle structure', file: 'bundle-structure.md', description: 'What goes where inside skills/<slug>/.' },
  { slug: 'frontmatter', title: 'Frontmatter reference', file: 'frontmatter.md', description: 'Every README key, required or optional.' },
  { slug: 'hooks-and-settings', title: 'Hooks and settings', file: 'hooks-and-settings.md', description: 'Shipping settings.local.json and hook scripts.' },
  { slug: 'contributing', title: 'Contributing', file: 'contributing.md', description: 'How a pull request becomes a live bundle.' }
]
```

`app/utils/docs.ts`:
```ts
import { docsNav, type DocEntry } from '~~/content/docs/nav'

// Docs ship with the build (they describe the app, not the bundles), so a static glob is right.
const sources = import.meta.glob('../../content/docs/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export function getDoc(slug: string): { entry: DocEntry; source: string } | null {
  const entry = docsNav.find(d => d.slug === slug)
  if (!entry) return null
  const source = sources[`../../content/docs/${entry.file}`]
  return source === undefined ? null : { entry, source }
}
```

- [ ] **Step 2: Write the docs content**

`content/docs/getting-started.md`:
````md
# Getting started

A **bundle** is a ready-made slice of a project's `.claude/` directory: skills, rules, hooks, settings, and a `CLAUDE.md` snippet. Installing one takes three steps.

## 1. Pick a bundle

Browse the [skills index](/skills). Each card shows what the bundle contains (Skills, Rules, Hooks, Settings, CLAUDE.md), its tags, and anything it requires on your machine (for example `python3` for the doc-fetcher skills).

## 2. Download and unzip

Click **Download**. The zip unpacks to a single folder named after the bundle:

```text
nuxt/
├── README.md
├── skills/…
├── rules/…
└── CLAUDE.md
```

Move the folder's *contents* into your project's `.claude/` directory:

```bash
unzip nuxt.zip
mkdir -p .claude
cp -R nuxt/skills nuxt/rules .claude/
```

Skip the README unless you want it, and skip `CLAUDE.md` for now.

## 3. Wire up CLAUDE.md

If the bundle ships a `CLAUDE.md`, it is a **pointer snippet**, not a replacement. Paste its contents into your project's `CLAUDE.md` so Claude Code knows the skills and rules exist and when to reach for them.

## Keeping bundles out of git noise

Doc-fetcher skills write a `cache/` folder next to their `SKILL.md`. Add this to your project's `.gitignore`:

```gitignore
.claude/skills/*/cache/
```

## Updating

Bundles have no versions. Re-download and overwrite when you want the latest; the **Source** button opens the exact GitHub tree so you can diff before you do.
````

`content/docs/bundle-structure.md`:
````md
# Bundle structure

Every bundle is a directory under `skills/` in the repository. The directory name is the **slug**: lowercase letters, digits and hyphens (`^[a-z0-9][a-z0-9-]*$`). It becomes the URL (`/skill/<slug>`) and the zip's root folder.

```text
skills/
└── <slug>/
    ├── README.md              required — frontmatter + docs
    ├── skills/<name>/SKILL.md optional — one folder per skill
    ├── rules/*.md             optional — path-scoped rules
    ├── hooks/*                optional — scripts referenced by settings
    ├── settings.local.json    optional — hooks/permissions config
    └── CLAUDE.md              optional — pointer snippet
```

Only `README.md` is required. Everything else is copied into a project's `.claude/` verbatim, so structure it exactly as Claude Code expects.

## README.md

The README is two things at once: **metadata** (YAML frontmatter, see [Frontmatter reference](/docs/frontmatter)) and **documentation** (the markdown body). The body is what renders on the bundle's page. Write it for someone deciding whether to install: what it does, what it needs, how to wire the `CLAUDE.md` snippet.

## skills/

Standard Claude Code skills: `skills/<name>/SKILL.md` with `name` and `description` frontmatter, plus any scripts or assets the skill uses. Keep generated caches out of the repo; any `cache/` directory is ignored by the site and never zipped.

## rules/

Markdown files with a `paths:` frontmatter glob. Rules state *when* and *what constraints*; they should point at a skill for the *how*.

## hooks/ and settings.local.json

See [Hooks and settings](/docs/hooks-and-settings).

## CLAUDE.md

A short block the user pastes into their own `CLAUDE.md`. Keep it to pointers: which skills to invoke, which rules exist, one or two hard constraints.

## What the site ignores

- any `cache/` directory
- dotfiles and dot-directories (`.gitignore`, `.DS_Store`, `.hidden/`)
- files over 1 MB (listed in the tree as "too large", never served or zipped)

Binary files are listed but shown as a placeholder with a link to GitHub.
````

`content/docs/frontmatter.md`:
````md
# Frontmatter reference

The YAML block at the top of `README.md` is the bundle's metadata. GitHub renders it as a table, and the site validates it on every load.

```yaml
---
name: Nuxt
description: Nuxt 4 + Nuxt UI v4 doc fetchers and the rules that make Claude use them.
tags: [nuxt, nuxt-ui, vue, docs]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3]
---
```

| Key | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Display name. The slug (directory name) stays the identifier. |
| `description` | string | yes | One or two sentences. Used on cards and in `<meta>` tags. |
| `tags` | string[] | yes | Lowercase. At least one. Drives the filter chips on the index. |
| `author` | string | yes | A person or org name. |
| `authorUrl` | URL | no | Where the author name links to. |
| `requires` | string[] | no | External tooling the bundle needs, e.g. `python3`, `playwright-cli`. |

## Validation

A bundle with a missing README, a missing required key, or a bad slug is:

- **shown with a warning** when the site reads from disk (local development), so you can see exactly what is wrong;
- **hidden** in production;
- **rejected by CI** — `pnpm validate:skills` fails the pull request with the same messages the site shows.

Messages look like `frontmatter.tags: required` or `slug "Bad_Slug" must match /^[a-z0-9][a-z0-9-]*$/`.

## Derived metadata

You never write these; the site computes them from the files:

- **badges** — which of `skills/`, `rules/`, `hooks/`, `settings.local.json`, `CLAUDE.md` exist
- **file count** and **total size**
- **freshness** — the commit that the whole snapshot was read from
````

`content/docs/hooks-and-settings.md`:
````md
# Hooks and settings

Claude Code hooks are configured in a settings file and point at scripts. A bundle can ship both.

## settings.local.json

Ship the settings you want the user to merge, nothing more. A typical bundle-level file only carries hooks and permission allowlists:

```json
{
  "permissions": {
    "allow": ["Bash(python3 .claude/skills/*/fetch.py:*)"]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/guard.sh" }]
      }
    ]
  }
}
```

Paths inside the settings file are relative to the **project root**, so reference hook scripts as `.claude/hooks/<script>`.

The user merges this into their own `.claude/settings.local.json` (or `settings.json`); the site does not do that for them, so say so in the README.

## hooks/

Put the scripts the settings reference here. Make them executable in git (`chmod +x`, then commit) and start them with a shebang. Keep them dependency-free where possible; if they need a tool, add it to `requires` in the README frontmatter.

Shell, Python, JavaScript and TypeScript files render with syntax highlighting on the site so people can read a hook before they trust it.

## Testing a hook locally

```bash
unzip <slug>.zip
cp -R <slug>/hooks .claude/
# merge <slug>/settings.local.json into .claude/settings.local.json
claude   # start a session and trigger the matcher
```
````

`content/docs/contributing.md`:
````md
# Contributing

This is primarily a personal registry, but pull requests for genuinely reusable bundles are welcome.

## Add a bundle

1. Fork the repository and create `skills/<slug>/` (see [Bundle structure](/docs/bundle-structure)).
2. Write `README.md` with valid [frontmatter](/docs/frontmatter) and a body that explains what the bundle does and how to install it.
3. Run the validator locally:

   ```bash
   pnpm install
   pnpm validate:skills
   ```

4. Run the site against your working tree and check the page:

   ```bash
   pnpm dev
   # open http://localhost:3000/skill/<slug>
   ```

5. Open a pull request. CI runs the same validator plus the app's lint, typecheck, tests and build.

## What happens on merge

Bundle content is read from GitHub **at runtime**. Merging to `main`:

- skips the Vercel build when only `skills/**` changed (the Ignored Build Step in `vercel.json`);
- runs the `revalidate` workflow, which purges the cache tag and asserts the site now serves your commit.

Your bundle is live within seconds of the merge.

## Ground rules

- No secrets, credentials, internal hostnames or IPs. Bundles are public.
- No generated caches. `cache/` directories are ignored anyway, but do not commit them.
- Keep bundles generic. Project-specific paths, theme mappings or account names belong in the user's own `CLAUDE.md`, not here.
- Lowercase tags, one concern per bundle.
````

- [ ] **Step 3: Write the docs page**

`app/pages/docs/[[slug]].vue`:
```vue
<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { docsNav } from '~~/content/docs/nav'
import { getDoc } from '~/utils/docs'

const route = useRoute()
const slug = computed(() => (typeof route.params.slug === 'string' && route.params.slug) || docsNav[0]!.slug)
const doc = computed(() => getDoc(slug.value))

if (!doc.value) {
  throw createError({ statusCode: 404, statusMessage: 'Doc not found', fatal: true })
}

const navOpen = ref(false)
const items = computed<NavigationMenuItem[]>(() => docsNav.map(d => ({
  label: d.title,
  to: `/docs/${d.slug}`,
  active: d.slug === slug.value,
  onSelect: () => {
    navOpen.value = false
  }
})))

useSeoMeta({
  title: () => doc.value?.entry.title ?? 'Docs',
  description: () => doc.value?.entry.description ?? ''
})
</script>

<template>
  <div class="flex flex-1 min-w-0 h-full">
    <UDashboardPanel
      id="docs-nav"
      resizable
      :default-size="20"
      :min-size="14"
      :max-size="30"
      class="hidden lg:flex"
    >
      <template #header>
        <UDashboardNavbar
          title="Docs"
          :toggle="false"
        >
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
        />
      </template>
    </UDashboardPanel>

    <UDashboardPanel
      id="docs-content"
      :ui="{ body: 'p-0 sm:p-0 gap-0' }"
    >
      <template #header>
        <UDashboardNavbar :title="doc?.entry.title">
          <template #leading>
            <UButton
              icon="i-lucide-list"
              color="neutral"
              variant="ghost"
              class="lg:hidden"
              aria-label="Docs navigation"
              @click="navOpen = true"
            />
          </template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <div class="h-full overflow-y-auto">
          <div class="mx-auto max-w-3xl p-4 sm:p-6">
            <MarkdownView
              v-if="doc"
              :source="doc.source"
              :cache-key="`docs:${slug}`"
            />
          </div>
        </div>
      </template>
    </UDashboardPanel>

    <USlideover
      v-model:open="navOpen"
      side="left"
      title="Docs"
    >
      <template #body>
        <UNavigationMenu
          :items="items"
          orientation="vertical"
        />
      </template>
    </USlideover>
  </div>
</template>
```

- [ ] **Step 4: Add doc URLs to the sitemap**

In `server/routes/sitemap.xml.get.ts`, add `import { docsNav } from '~~/content/docs/nav'` and replace `'/docs',` in `paths` with:
```ts
    '/docs',
    ...docsNav.map(d => `/docs/${d.slug}`),
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck` and `pnpm lint` → exit 0. Run `pnpm vitest run test/e2e/api.test.ts` → still PASS (sitemap test).
Browser:
```bash
playwright-cli goto http://localhost:3000/docs
playwright-cli snapshot | grep -E 'Getting started|Bundle structure|Frontmatter reference|Hooks and settings|Contributing'
playwright-cli eval "() => document.querySelector('h1')?.textContent"          # → "Getting started"
playwright-cli goto http://localhost:3000/docs/frontmatter
playwright-cli eval "() => ({ h1: document.querySelector('h1')?.textContent, table: !!document.querySelector('table') })"   # → Frontmatter reference, true
playwright-cli goto http://localhost:3000/docs/nope
playwright-cli eval "() => document.body.innerText.includes('404')"          # → true
```

- [ ] **Step 6: Commit**

```bash
git add content app/utils/docs.ts app/pages/docs server/routes/sitemap.xml.get.ts
git commit -m "feat: docs pages explaining bundle structure, frontmatter, hooks and contributing"
```

---

### Task 14: CI, deploy config, validator

**Files:**
- Create: `vercel.json`, `scripts/should-build.sh`, `scripts/validate-skills.ts`, `.github/workflows/ci.yml`, `.github/workflows/revalidate.yml`
- Test: `test/unit/should-build.test.ts`

**Interfaces:**
- Produces: `bash scripts/should-build.sh` → exit 0 = skip build, exit 1 = build; `pnpm validate:skills [dir]` → exit 1 with per-bundle messages when any bundle is invalid.
- Deviation from spec: `vercel.json` instead of `vercel.ts`. One static key doesn't justify a 0.x config package.

- [ ] **Step 1: Write the failing test for the ignored-build script**

`test/unit/should-build.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../../scripts/should-build.sh', import.meta.url))

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], { cwd, stdio: 'pipe' }).toString()
}

function repoWith(commits: string[][]): string {
  const cwd = mkdtempSync(join(tmpdir(), 'should-build-'))
  git(cwd, 'init', '-q', '-b', 'main')
  for (const files of commits) {
    for (const f of files) {
      mkdirSync(join(cwd, f, '..'), { recursive: true })
      writeFileSync(join(cwd, f), String(Math.random()))
    }
    git(cwd, 'add', '-A')
    git(cwd, 'commit', '-q', '-m', files.join(','))
  }
  return cwd
}

function run(cwd: string) {
  return spawnSync('bash', [script], { cwd, encoding: 'utf8' }).status
}

describe('scripts/should-build.sh', () => {
  it('skips (exit 0) when only skills/** changed', () => {
    expect(run(repoWith([['app/a.ts'], ['skills/nuxt/README.md']]))).toBe(0)
  })
  it('skips when only docs/** and the root README changed', () => {
    expect(run(repoWith([['app/a.ts'], ['docs/x.md', 'README.md']]))).toBe(0)
  })
  it('builds (exit 1) when app files changed alongside skills', () => {
    expect(run(repoWith([['app/a.ts'], ['skills/nuxt/README.md', 'app/b.ts']]))).toBe(1)
  })
  it('builds when content/docs changed (app content, not bundle content)', () => {
    expect(run(repoWith([['app/a.ts'], ['content/docs/getting-started.md']]))).toBe(1)
  })
  it('builds on the first commit', () => {
    expect(run(repoWith([['skills/nuxt/README.md']]))).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:unit test/unit/should-build.test.ts`
Expected: FAIL (script not found → status null).

- [ ] **Step 3: Write the scripts and config**

`scripts/should-build.sh`:
```bash
#!/usr/bin/env bash
# Vercel "Ignored Build Step". Exit 0 = SKIP the build, exit 1 = BUILD.
#
# Bundle content under skills/** is read from GitHub at runtime and docs/** never ships,
# so commits touching only those (plus the root README) don't need a deploy. content/docs/**
# is app content and is deliberately NOT excluded.
set -uo pipefail

if ! git rev-parse --verify --quiet 'HEAD^' >/dev/null; then
  echo "should-build: no parent commit, building"
  exit 1
fi

if git diff --quiet 'HEAD^' HEAD -- . ':(exclude)skills/**' ':(exclude)docs/**' ':(exclude)README.md'; then
  echo "should-build: only skills/docs changed, skipping build"
  exit 0
fi

echo "should-build: app files changed, building"
exit 1
```
Then `chmod +x scripts/should-build.sh`.

`vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nuxtjs",
  "ignoreCommand": "bash scripts/should-build.sh"
}
```

`scripts/validate-skills.ts`:
```ts
import { createFsSource } from '../server/lib/skills/fs-source'

const dir = process.argv[2] ?? 'skills'
const snapshot = await createFsSource(dir).load()

if (snapshot.skills.length === 0) {
  console.error(`validate-skills: no bundles found under ${dir}`)
  process.exit(1)
}

let failed = 0
for (const skill of snapshot.skills) {
  if (skill.errors.length) {
    failed++
    console.error(`✗ ${skill.slug}`)
    for (const err of skill.errors) console.error(`    - ${err}`)
  } else {
    console.log(`✓ ${skill.slug} — ${skill.name} (${skill.fileCount} files; ${skill.badges.join(', ') || 'no badges'})`)
  }
}

if (failed) {
  console.error(`\nvalidate-skills: ${failed} bundle(s) failed`)
  process.exit(1)
}
```

`.github/workflows/ci.yml`:
```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Validate bundles
        run: pnpm validate:skills

      - run: pnpm lint

      - run: pnpm typecheck

      - name: Unit + route tests
        run: pnpm test

      - name: Build
        run: pnpm build
        env:
          SKILLS_SOURCE: fs
```

`.github/workflows/revalidate.yml`:
```yaml
name: revalidate

# A push that touches bundle content doesn't deploy (see vercel.json ignoreCommand);
# instead purge the `skills` cache tag and confirm the site serves this commit.
on:
  push:
    branches: [main]
    paths: ['skills/**']

jobs:
  purge:
    runs-on: ubuntu-latest
    steps:
      - name: Purge and warm
        env:
          SITE_URL: ${{ vars.SITE_URL }}
          REVALIDATE_SECRET: ${{ secrets.REVALIDATE_SECRET }}
        run: |
          set -euo pipefail
          out=$(curl -fsS -X POST -H "Authorization: Bearer $REVALIDATE_SECRET" "$SITE_URL/api/revalidate")
          echo "$out"
          sha=$(echo "$out" | jq -r .sha)
          if [ "$sha" != "$GITHUB_SHA" ]; then
            echo "revalidate returned $sha, expected $GITHUB_SHA"
            exit 1
          fi

      - name: Wait for the CDN to serve the new snapshot
        env:
          SITE_URL: ${{ vars.SITE_URL }}
        run: |
          for i in $(seq 1 12); do
            sha=$(curl -fsS "$SITE_URL/api/skills" | jq -r .sha)
            if [ "$sha" = "$GITHUB_SHA" ]; then echo "CDN serving $sha"; exit 0; fi
            echo "attempt $i: CDN still serving $sha"
            sleep 5
          done
          echo "CDN never caught up"
          exit 1
```

Repository settings this workflow needs (done once the repo exists, Task 16): Actions variable `SITE_URL` (e.g. `https://skills.patrity.com`) and secret `REVALIDATE_SECRET` (same value as Vercel's `NUXT_REVALIDATE_SECRET`).

- [ ] **Step 4: Run the tests**

Run: `pnpm test:unit` → PASS including `should-build.test.ts`.
Run: `pnpm validate:skills test/fixtures/skills; echo "exit=$?"`
Expected: `✓ demo …`, `✗ broken` with `frontmatter.tags: required` and `frontmatter.author: required`, `✗ no-readme` with `README.md is missing`, then `exit=1`.

- [ ] **Step 5: Commit**

```bash
git add vercel.json scripts .github test/unit/should-build.test.ts
git commit -m "ci: validator, ignored build step, CI and revalidate workflows"
```

---

### Task 15: Seed bundle, repo docs, browser-testing skill

**Files:**
- Create: `skills/nuxt/README.md`, `skills/nuxt/CLAUDE.md`, `skills/nuxt/skills/{nuxt-docs,nuxt-ui-docs,nuxt-ui-templates}/…` (copied from `.claude/skills/`), `skills/nuxt/rules/{web-nuxt,web-vue-ui}.md` (copied from `.claude/rules/`)
- Create: `README.md`, `CLAUDE.md`, `.claude/skills/browser-testing/SKILL.md`

**Interfaces:**
- Produces: the first live bundle at `/skill/nuxt`; `pnpm validate:skills` passes on the real `skills/` dir.

- [ ] **Step 1: Copy the bundle content**

```bash
mkdir -p skills/nuxt/skills skills/nuxt/rules
for s in nuxt-docs nuxt-ui-docs nuxt-ui-templates; do
  mkdir -p "skills/nuxt/skills/$s"
  cp ".claude/skills/$s/SKILL.md" ".claude/skills/$s/fetch.py" ".claude/skills/$s/.gitignore" "skills/nuxt/skills/$s/"
  [ -f ".claude/skills/$s/manifest.json" ] && cp ".claude/skills/$s/manifest.json" "skills/nuxt/skills/$s/"
done
cp .claude/rules/web-nuxt.md .claude/rules/web-vue-ui.md skills/nuxt/rules/
find skills -type f | sort
```
Expected: 11 files, no `cache/` directories. The `.gitignore` files keep future caches out of the repo and are excluded from the published tree by the dot-file rule.

Then open `skills/nuxt/skills/nuxt-docs/fetch.py`, `nuxt-ui-docs/fetch.py`, `nuxt-ui-templates/fetch.py` and confirm they reference their cache dir relative to the script (`Path(__file__).parent / 'cache'` or equivalent), not a mymind-specific path. Fix any absolute path.

- [ ] **Step 2: Write the bundle README and CLAUDE.md snippet**

`skills/nuxt/README.md`:
````md
---
name: Nuxt
description: Nuxt 4 + Nuxt UI v4 documentation fetchers and the rules that make Claude Code use them instead of stale training data.
tags: [nuxt, nuxt-ui, vue, docs]
author: Patrity
authorUrl: https://github.com/Patrity
requires: [python3]
---

# Nuxt

Three doc-fetching skills plus two path-scoped rules. The rules fire when Claude touches `.vue`/`.ts` files under `app/` or `nuxt.config.ts` and tell it to consult the skills before guessing a composable signature or a Nuxt UI prop.

## What's inside

| Path | Purpose |
| --- | --- |
| `skills/nuxt-docs/` | Fetches Nuxt 4 docs from GitHub by topic (`python3 .claude/skills/nuxt-docs/fetch.py useFetch`). |
| `skills/nuxt-ui-docs/` | Fetches Nuxt UI v4 component docs (`fetch.py Button`, `fetch.py Tree`). |
| `skills/nuxt-ui-templates/` | Pulls real files from the official Nuxt UI templates (dashboard, docs, saas…). |
| `rules/web-nuxt.md` | Nuxt 4 conventions: `app/` layout, runtimeConfig for secrets, invoke `nuxt-docs` first. |
| `rules/web-vue-ui.md` | Nuxt UI v4: `U*` components over raw markup, semantic color tokens only, invoke `nuxt-ui-docs`, validate with playwright-cli. |
| `CLAUDE.md` | A pointer block to paste into your project's `CLAUDE.md`. |

## Install

```bash
unzip nuxt.zip
mkdir -p .claude
cp -R nuxt/skills nuxt/rules .claude/
cat nuxt/CLAUDE.md >> CLAUDE.md
echo '.claude/skills/*/cache/' >> .gitignore
```

The fetchers cache what they download under `skills/<name>/cache/`, hence the `.gitignore` line.

## Requirements

- `python3` on PATH (standard library only, no pip installs).
- Network access to `raw.githubusercontent.com` the first time a topic is fetched.

## Notes

The rules mention a `browser-testing` skill for playwright-cli validation. That skill is project-specific (it carries your dev URL and test flow), so create your own; the rule just tells Claude to use it.
````

`skills/nuxt/CLAUDE.md`:
```md
## Nuxt / Nuxt UI

- Nuxt 4 + Nuxt UI v4. Before using a Nuxt composable or a `U*` component, invoke the `nuxt-docs` / `nuxt-ui-docs` skills — training-data knowledge of these APIs is stale.
- Use the `nuxt-ui-templates` skill for composition patterns (dashboard, docs, landing).
- Rules under `.claude/rules/web-nuxt.md` and `web-vue-ui.md` load automatically when editing `app/**` or `nuxt.config.ts`; follow them.
- Always `pnpm`.
```

- [ ] **Step 3: Write the repo README and CLAUDE.md**

`README.md`:
````md
# Skills

Reusable Claude Code setups, published as downloadable bundles. Each bundle under [`skills/`](skills/) mirrors a project's `.claude/` directory (skills, rules, hooks, settings, a `CLAUDE.md` pointer) and ships a README whose frontmatter is the registry metadata.

The site renders those bundles straight from this repository at request time, so publishing a bundle never rebuilds the app.

## Using a bundle

1. Browse the site and pick a bundle.
2. **Download** the zip and copy its contents into your project's `.claude/`.
3. Paste the bundle's `CLAUDE.md` snippet (if any) into your own `CLAUDE.md`.

Full instructions live on the site under **Docs**.

## Adding a bundle

Create `skills/<slug>/README.md` with frontmatter (`name`, `description`, `tags`, `author`, optional `authorUrl`/`requires`) and add the `.claude` content beside it. Run `pnpm validate:skills`, open a PR. See `content/docs/contributing.md`.

## Development

```bash
pnpm install
pnpm dev            # http://localhost:3000, reads ./skills from disk
pnpm test:unit      # fast unit tests
pnpm test           # + route tests (builds the app once)
pnpm typecheck && pnpm lint && pnpm build
````

`SKILLS_SOURCE=github pnpm dev` exercises the production path (GitHub tarball → parsed snapshot). Copy `.env.example` to `.env` for the knobs.

## How it works

- `server/lib/skills/` parses bundles from disk (`fs`) or from the repo tarball (`github`), caches per-bundle blobs in the Vercel Runtime Cache under tag `skills`, and serves them through `/api/skills/**`.
- Pages and API routes are ISR-cached (5 min floor) and tagged; `POST /api/revalidate` purges the tag.
- On a push that touches `skills/**`, Vercel skips the build (`vercel.json` `ignoreCommand`) and the `revalidate` workflow purges the cache instead.

## Deploy

Vercel, Git integration on `main`. Environment variables: `NUXT_REVALIDATE_SECRET`, `NUXT_PUBLIC_SITE_URL`, optional `NUXT_GITHUB_TOKEN`; production-only `NUXT_PUBLIC_UMAMI_ID` and `UMAMI_DOMAINS` (build-time). GitHub Actions needs the `SITE_URL` variable and `REVALIDATE_SECRET` secret.
```

`CLAUDE.md`:
````md
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
````

- [ ] **Step 4: Write the browser-testing skill**

`.claude/skills/browser-testing/SKILL.md`:
````md
---
name: browser-testing
description: Use when validating UI or end-to-end behaviour of the Skills site with playwright-cli (tree navigation, markdown/code rendering, downloads, filters, dark mode). Use it to PROVE a change works in the real browser — green typecheck/test/build never catch rendering or wiring bugs.
---

# Browser testing (playwright-cli)

Validate UI with **`playwright-cli`** (terminal CLI), never the Playwright MCP. The site is public: no login, no test account.

## Dev server
- Real bundles: `pnpm dev` → http://localhost:3000
- Test bundles (demo / broken / no-readme): `NUXT_SKILLS_DIR=test/fixtures/skills pnpm dev`
- Ready check: `until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done`

## Core workflow: snapshot → ref → act
```bash
playwright-cli open http://localhost:3000/skills     # or: goto <url>
playwright-cli snapshot                              # YAML tree with [ref=eNN] ids
playwright-cli click e31
playwright-cli fill e20 "nuxt"
playwright-cli eval "() => ({ path: location.pathname, text: document.body.innerText.slice(0, 200) })"
playwright-cli screenshot --filename=/tmp/x.png      # then Read the PNG
```
Refs change after navigation — re-snapshot before clicking.

## Useful assertions
```bash
# CodeMirror mounted (client-only component)
playwright-cli eval "() => !!document.querySelector('.cm-editor')"
# Rendered markdown heading present
playwright-cli eval "() => document.querySelector('h1')?.textContent"
# Download headers (no browser needed)
curl -sI http://localhost:3000/api/skills/nuxt/download | grep -i content-disposition
# Umami must be absent on localhost
playwright-cli eval "() => !!document.querySelector('script[data-website-id]')"   # → false
```

## reka-ui components need a real click
`UTree` rows, `USlideover`, `UCollapsible`, `UFieldGroup` buttons: use `playwright-cli click <ref>`, not `el.click()` inside `eval`.

## Routes to cover after UI changes
`/`, `/skills` (search + tag chip), `/skill/nuxt`, `/skill/nuxt/skills/nuxt-docs/fetch.py`, `/skill/nuxt/rules/web-nuxt.md` (Rendered ↔ Source), `/docs`, `/docs/frontmatter`, a 404 (`/skill/nope`). Toggle dark mode via the sidebar button and screenshot a code file.
````

- [ ] **Step 5: Verify**

```bash
pnpm validate:skills          # → ✓ nuxt — Nuxt (11 files; skills, rules, claude-md), exit 0
pnpm typecheck && pnpm lint && pnpm test:unit
```
Start `pnpm dev` (real bundles) and check:
```bash
playwright-cli goto http://localhost:3000/skill/nuxt
playwright-cli snapshot | grep -E 'Nuxt|nuxt-docs|nuxt-ui-docs|nuxt-ui-templates|web-nuxt.md|python3'
playwright-cli goto http://localhost:3000/skill/nuxt/skills/nuxt-ui-docs/fetch.py
playwright-cli eval "() => !!document.querySelector('.cm-editor')"   # → true
curl -s http://localhost:3000/api/skills/nuxt/download -o /tmp/nuxt.zip && unzip -l /tmp/nuxt.zip | grep -c 'nuxt/'   # ≥ 11, no cache/ entries
```

- [ ] **Step 6: Commit**

```bash
git add skills README.md CLAUDE.md .claude/skills/browser-testing
git commit -m "feat: seed nuxt bundle, repo docs and browser-testing skill"
```

---

### Task 16: Full verification, production build, GitHub source smoke, deploy checklist

**Files:**
- Modify: anything the checks below surface. No planned new files.

**Interfaces:**
- Consumes: everything above.
- Produces: a green `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, a verified production server run, and a written deploy checklist in the final report.

- [ ] **Step 1: Full local gate**

```bash
pnpm lint && pnpm typecheck && pnpm validate:skills && pnpm test && pnpm build
```
Expected: every command exits 0. If `pnpm build` OOMs in the MDC/Shiki step, first shorten `mdc.highlight.langs`; only if that fails set `NODE_OPTIONS=--max-old-space-size=4096` in the build script and note it in `CLAUDE.md`.

- [ ] **Step 2: Run the production build locally against disk**

```bash
NUXT_SKILLS_SOURCE=fs NUXT_REVALIDATE_SECRET=local PORT=3100 node .output/server/index.mjs > /tmp/skills-prod.log 2>&1 &
until curl -sf http://localhost:3100/api/health >/dev/null; do sleep 1; done
curl -s http://localhost:3100/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/skill/nuxt
curl -s http://localhost:3100/skill/nuxt | grep -c 'Nuxt'          # SSR'd content present
curl -s -X POST -H "Authorization: Bearer local" http://localhost:3100/api/revalidate
kill %1
```
Expected: health `ok: true, source: fs`; skill page 200 with server-rendered content; revalidate returns `ok: true` (no `VERCEL` env, so no purge call). Check `/tmp/skills-prod.log` for a single `Runtime Cache unavailable` warning at most and no stack traces.

- [ ] **Step 3: Browser pass on the production server**

Start `pnpm preview` (port 3000) or reuse the server above with `playwright-cli open http://localhost:3100`, then walk the route list in `.claude/skills/browser-testing/SKILL.md` (home, index with a tag chip, skill README, a `.py` file, a rule with Rendered ↔ Source, docs, 404, dark mode screenshot). Fix anything broken, re-run Step 1, commit as `fix: …`.

- [ ] **Step 4: Publish the repository (requires user confirmation — outward-facing)**

Ask before running: this creates a public repo and pushes.
```bash
gh repo create Patrity/skills --public --source=. --remote=origin --push
```
Then smoke the GitHub source against the real repo:
```bash
SKILLS_SOURCE=github pnpm dev > /tmp/skills-gh.log 2>&1 &
until curl -sf http://localhost:3000/api/health >/dev/null; do sleep 1; done
curl -s http://localhost:3000/api/skills | jq '{sha, source, slugs: [.skills[].slug]}'
git rev-parse HEAD
kill %1
```
Expected: `source: "github"`, `sha` equal to the local HEAD, `slugs: ["nuxt"]`. A 403 in the log means the unauthenticated rate limit is exhausted; set `NUXT_GITHUB_TOKEN` and retry.

- [ ] **Step 5: Deploy checklist (Vercel dashboard / CLI, user-driven)**

1. Import `Patrity/skills` in Vercel (framework auto-detects Nuxt; `vercel.json` supplies the ignore command).
2. Environment variables — all environments: `NUXT_REVALIDATE_SECRET` (generate with `openssl rand -hex 32`), `NUXT_PUBLIC_SITE_URL` (production URL), optional `NUXT_GITHUB_TOKEN` (fine-grained, read-only, public repo). Production only: `NUXT_PUBLIC_UMAMI_ID` (from the Umami dashboard for the new website), `UMAMI_DOMAINS` (the production hostname). `SKILLS_SOURCE` is not needed — `VERCEL` is set automatically and selects `github`.
3. GitHub repo: `gh variable set SITE_URL --body https://<prod-host>` and `gh secret set REVALIDATE_SECRET` (same value as Vercel).
4. After the first deploy: `curl -sI https://<prod-host>/skill/nuxt | grep -iE 'x-vercel-cache|cache-control'` twice — second hit should be `HIT` or `STALE`. Then `curl -X POST -H "Authorization: Bearer …" https://<prod-host>/api/revalidate` and confirm the next `curl -sI` shows `MISS`/`STALE`/`REVALIDATED` (tag purge reached the ISR layer). If it stays `HIT`, the ISR entry is not honouring `Vercel-Cache-Tag`: fall back to `dangerouslyDeleteByTag` in `revalidate.post.ts` and, if that also fails, to `nitro.vercel.config.bypassToken` on-demand revalidation. Record the outcome in `CLAUDE.md`.
5. Push a commit that only edits `skills/nuxt/README.md`: Vercel should show the deployment as **Ignored**, the `revalidate` workflow should pass, and the README change should be live.

- [ ] **Step 6: Record and close out**

- Update MyMind: mark the design-spec doc as implemented, add a short "How the skills site works today" doc under project `skills`, and create tasks for anything deferred during Steps 1–5 (e.g. cache-tag fallback, view counts).
- Final commit if anything changed: `git add -A && git commit -m "chore: post-verification fixes"`.

---

## Self-review notes

- **Spec coverage:** §3 layout/frontmatter/exclusions/zip → Tasks 3, 4, 7, 15. §4.1 drivers → Tasks 4, 5. §4.2 caching → Tasks 1 (route rules), 6. §4.3 routes → Task 8 (file route is path-based, documented deviation). §4.4 runtime config → Task 1. §5 pages/layout/components/gotchas → Tasks 9–13. §6 analytics → Tasks 1, 9. §7 CI/deploy → Task 14 (`vercel.json` deviation documented) and Task 16. §8 testing → unit tests in 2–7, 14; route tests in 8; browser checks in 9–13, 15, 16. §9 seed content + repo `.claude/` → Task 15. Sitemap/robots → Tasks 8, 13.
- **Type consistency:** `SkillFileResponse.frontmatterRaw` (Task 2) is what the file route returns (Task 8) and the page reads (Task 11). `SnapshotStore.getManifests()` returns `ManifestRecord { meta, skills }` everywhere. `useSkillFile(slug, path)` takes a non-null path; the page always supplies one (README fallback).
