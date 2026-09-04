# Composable Setups — CLI Implementation Plan (`@patrity/skills`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `pnpx @patrity/skills` — a wizard that assembles a project's `.claude/` and CLAUDE.md from the registry's base schema and bundles, with a lockfile that makes `add`/`update`/`diff`/`remove` idempotent.

**Architecture:** A pnpm workspace package `cli/` with pure modules (registry client, lockfile, settings merge, plan builder, wizard sequencing) covered by unit tests, thin clack prompts, citty commands, and one integration suite that runs the real commands against a fake registry served from `test/fixtures`. Composition logic is imported from the repo's `shared/setup/*` so the site and the CLI render CLAUDE.md identically.

**Tech Stack:** TypeScript, citty 0.2, @clack/prompts 1.7, fflate, tsup 8 (ESM, Node ≥ 22), vitest 4.1; npm publish with provenance from GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-03-composable-setups-and-cli-design.md` (§5 CLI, §7 packaging, §9 testing). Registry-side prerequisites: `docs/superpowers/plans/2026-09-03-composable-setups-registry.md` (Tasks 1–9 must be merged; the CLI consumes `/api/cli/manifest` and `/api/skills/:slug/download`).

## Global Constraints

- pnpm only; conventional commits; no `Co-Authored-By`/`Claude-Session`/model references (check `git log -1 --format=%B`). Do not push; the controller pushes.
- `cli/` imports from `../shared/**` with relative paths only (type-only imports and the pure `shared/setup/*` modules); never from `app/` or `server/`.
- Registry default `https://skills.patrity.com`; every request sends `User-Agent: @patrity/skills/<version>`.
- File mapping: bundle `skills/**`, `rules/**`, `hooks/**` and any other bundle file → `.claude/<same path>`; bundle `CLAUDE.md` → snippet (never copied); bundle `README.md` → not installed; bundle `settings.json` → merged into `.claude/settings.json` except `permissions.allow` → `.claude/settings.local.json`; bundle `settings.local.json` → merged into `.claude/settings.local.json`. Hook scripts get mode `0o755`.
- Marker format and section rules are those of `shared/setup/*` (Plan A); contributions order: `base:always/*` (sorted by file name), then axis fragments in schema order, then bundles alphabetically.
- Placeholders `{{pm}}`, `{{pmx}}`, `{{appDir}}`, `{{pkgDir}}` (package-root prefix: empty for a single-app layout, `apps/web/` when `appDir` is `apps/web/app`), `{{projectName}}`, plus `{{<axisId>}}` for text-input axes, rendered in every text file installed and in snippets; unknown placeholders are warnings.
- Lockfile `.claude/skills.lock.json` (committed); `update` refuses to overwrite a hand-edited marker block or owned file without `--force`.
- `.claude/settings.local.json` must be gitignored; the CLI adds the line if missing.
- Never print secrets; never write outside `--dir`.
- Port 3000 is taken locally (`PORT=3210` for the registry dev server).

---

## File structure

```
pnpm-workspace.yaml                    packages: [cli]
cli/package.json                       @patrity/skills, bin "skills", tsup build, vitest
cli/tsconfig.json, cli/tsup.config.ts, cli/vitest.config.ts, cli/README.md
cli/src/index.ts                       citty main + subcommands (default: init)
cli/src/version.ts                     CLI_VERSION from package.json
cli/src/registry.ts                    createRegistryClient(): manifest(), download(slug)
cli/src/lockfile.ts                    Lockfile type, read/write, sha256, diffOwnedFiles()
cli/src/settings.ts                    mergeSettings(), splitBundleSettings(), ensureGitignoreLine()
cli/src/contributions.ts               contributionsFor(manifest, answers, bundles, bundleFiles)
cli/src/plan.ts                        buildPlan() → SetupPlan (file ops, CLAUDE.md, settings, lock)
cli/src/apply.ts                       applyPlan(plan, dir, { force })
cli/src/wizard.ts                      nextAxes(), resolveBundles(), preselectedBundles() (pure)
cli/src/prompts.ts                     clack prompts for axes, bundles, conflicts, summary
cli/src/project.ts                     readProject(dir): existing files, CLAUDE.md, settings, lock, name
cli/src/commands/{init,add,remove,update,diff,list}.ts
cli/test/fixtures/                     manifest.json + demo bundle files (built into a zip in tests)
cli/test/unit/*.test.ts, cli/test/integration/cli.test.ts (fake registry over node:http)
.github/workflows/ci.yml               + cli job;  .github/workflows/release-cli.yml
scripts/should-build.sh                excludes cli/**
```

---

### Task 1: Workspace and package scaffold

**Files:**
- Create: `pnpm-workspace.yaml`, `cli/package.json`, `cli/tsconfig.json`, `cli/tsup.config.ts`, `cli/vitest.config.ts`, `cli/src/index.ts` (placeholder main), `cli/src/version.ts`, `cli/README.md`
- Modify: `scripts/should-build.sh` (exclude `cli/**`), `test/unit/should-build.test.ts` (case), `.github/workflows/ci.yml` (cli job), root `package.json` (`"cli:build"`, `"cli:test"` scripts), `.gitignore` (`cli/dist`)

**Interfaces:**
- Produces: `pnpm --filter @patrity/skills build|test|typecheck|lint`; `node cli/dist/index.js --help` prints usage; `CLI_VERSION` string.

- [ ] **Step 1: Failing test for the ignore script**

Append to `test/unit/should-build.test.ts`:
```ts
  it('skips when only cli/** changed (the CLI is published separately)', () => {
    expect(run(repoWith([['app/a.ts'], ['cli/src/index.ts']]))).toBe(0)
  })
```
Run → FAIL. Add `':(exclude)cli/**'` to the pathspec in `scripts/should-build.sh` (and the comment). Run → PASS.

- [ ] **Step 2: Workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - cli
```
`cli/package.json`:
```json
{
  "name": "@patrity/skills",
  "version": "0.1.0",
  "description": "Assemble an opinionated Claude Code setup (.claude/ + CLAUDE.md) from skills.patrity.com bundles.",
  "type": "module",
  "license": "MIT",
  "repository": { "type": "git", "url": "https://github.com/Patrity/skills.git", "directory": "cli" },
  "homepage": "https://skills.patrity.com/docs/cli",
  "bin": { "skills": "./dist/index.js" },
  "files": ["dist", "README.md"],
  "engines": { "node": ">=22" },
  "publishConfig": { "access": "public" },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src test",
    "test": "vitest run",
    "prepack": "pnpm build"
  },
  "dependencies": {
    "@clack/prompts": "^1.7.0",
    "citty": "^0.2.2",
    "fflate": "^0.8.3"
  },
  "devDependencies": {
    "tsup": "^8.5.1",
    "typescript": "^6.0.3",
    "vitest": "~4.1.11"
  }
}
```
`cli/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noUncheckedIndexedAccess": true, "skipLibCheck": true,
    "types": ["node"], "resolveJsonModule": true, "noEmit": true
  },
  "include": ["src", "test", "../shared/setup/**/*.ts", "../shared/types/**/*.ts"]
}
```
`cli/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  // shared/setup is bundled in; the three runtime deps stay external.
  noExternal: [/^\.\.\/shared\//]
})
```
`cli/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 30_000 } })
```
`cli/src/version.ts`:
```ts
import { createRequire } from 'node:module'
const pkg = createRequire(import.meta.url)('../package.json') as { version: string }
export const CLI_VERSION: string = pkg.version
```
`cli/src/index.ts` (placeholder; commands arrive in Task 8):
```ts
import { defineCommand, runMain } from 'citty'
import { CLI_VERSION } from './version'

const main = defineCommand({
  meta: { name: 'skills', version: CLI_VERSION, description: 'Assemble a Claude Code setup from skills.patrity.com' },
  run() {
    console.log(`@patrity/skills ${CLI_VERSION} — commands arrive in a later task`)
  }
})

runMain(main)
```
`cli/README.md`: title, one paragraph, `pnpx @patrity/skills` quick start, link to https://skills.patrity.com/docs/cli, MIT.

Root `package.json` scripts: `"cli:build": "pnpm --filter @patrity/skills build"`, `"cli:test": "pnpm --filter @patrity/skills test"`. `.gitignore`: add `cli/dist`. `@types/node` is already available through the root workspace; if `tsc` complains, add `"@types/node": "^22"` to `cli/devDependencies`.

`.github/workflows/ci.yml` — add a job:
```yaml
  cli:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @patrity/skills lint
      - run: pnpm --filter @patrity/skills typecheck
      - run: pnpm --filter @patrity/skills test
      - run: pnpm --filter @patrity/skills build
      - run: node cli/dist/index.js --version
```

- [ ] **Step 3: Install and smoke**

`pnpm install` (lockfile gains the workspace); `pnpm cli:build` → `cli/dist/index.js` exists; `node cli/dist/index.js --version` prints `0.1.0`; `pnpm --filter @patrity/skills typecheck` exit 0; root `pnpm lint && pnpm typecheck && pnpm test:unit` still green (root vitest `include` is `test/**` so it does not pick up `cli/test`).

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml package.json .gitignore cli scripts/should-build.sh test/unit/should-build.test.ts .github/workflows/ci.yml
git commit -m "feat(cli): scaffold the @patrity/skills workspace package"
```

---

### Task 2: Registry client

**Files:**
- Create: `cli/src/registry.ts`, `cli/test/fixtures/manifest.json`, `cli/test/fixtures/bundles/demo/{README.md,CLAUDE.md,skills/demo-skill/SKILL.md,rules/demo.md,hooks/pre-commit.sh,settings.json}`, `cli/test/helpers/fixtures.ts`
- Test: `cli/test/unit/registry.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type BundleFiles = Record<string, Uint8Array>
  export interface RegistryClient { registry: string; manifest(): Promise<CliManifest>; download(slug: string): Promise<BundleFiles> }
  export function createRegistryClient(registry: string, opts?: { fetchImpl?: typeof fetch; version?: string }): RegistryClient
  export class RegistryError extends Error { status?: number; url: string }
  ```
- `download` unzips `/api/skills/<slug>/download`, strips the leading `<slug>/`, drops directory entries. `manifest` rejects when `errors.length > 0` with `RegistryError('registry base schema has errors: …')` unless `opts.allowErrors`.
- Fixture helper: `loadFixtureBundle(): BundleFiles` (reads `cli/test/fixtures/bundles/demo/**`), `zipFixtureBundle(slug): Uint8Array` (fflate `zipSync` rooted at `<slug>/`), `fixtureManifest(): CliManifest` (reads `manifest.json`; its `base` is the same fixture base as the registry plan's `test/fixtures/base` — copy `sections.yaml`, `questions.yaml`, fragments and template contents into the JSON).

- [ ] **Step 1: Fixtures**

`cli/test/fixtures/bundles/demo/README.md` (valid frontmatter, `suggests: [second]`), `CLAUDE.md`:
```md
## Commands
- `{{pm}} demo` runs the demo.

## Skills and rules
- Invoke `demo-skill` when demoing.
```
`skills/demo-skill/SKILL.md` (`---\nname: demo-skill\ndescription: d\n---\n# Demo`), `rules/demo.md`:
```md
---
paths:
  - "{{appDir}}/**/*.vue"
---
# Demo rule
```
`hooks/pre-commit.sh` (`#!/usr/bin/env bash\necho "{{pm}} lint"\n`), `settings.json`:
```json
{ "permissions": { "allow": ["Bash(echo:*)"], "deny": ["Bash(rm -rf:*)"] }, "hooks": { "PostToolUse": [{ "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/pre-commit.sh" }] }] } }
```
`cli/test/fixtures/manifest.json`: a `CliManifest` with `registry: "http://registry.test"`, `sha`, `committedAt`, `fetchedAt`, `source: "fs"`, `errors: []`, `base` = the registry fixture base as JSON (13 sections; axes `pm`, `layout`, `appDir`; fragments `pm/pnpm.md`, `pm/npm.md`, `layout/monorepo.md`; `always: { "self-improvement.md": "## Self-improvement\n- Update CLAUDE.md proactively; keep it concise.\n" }`; `templates: { "browser-testing-project.md": "# Browser testing for {{projectName}}\n\nDev URL: TODO\n" }`; give the `pm=pnpm` option `selects: ["demo"]` and add a fourth axis `browser` (default `cli`, option `cli` with `scaffolds: [{ template: "browser-testing-project.md", to: ".claude/skills/{{projectName}}-browser-testing/SKILL.md" }]`, option `none`), `profiles: [{ name: "demo", description: "d", answers: { pm: "pnpm", layout: "single", browser: "none" }, bundles: ["demo"] }]`, `skills`: summaries for `demo` (tags, badges `skills, rules, hooks, settings, claude-md`, `suggests: ["second"]`) and `second` (no dependsOn) and `third` (`dependsOn: ["second"]`).

`cli/test/helpers/fixtures.ts`: the three helpers above using `node:fs` + `zipSync`.

- [ ] **Step 2: Failing test**

`cli/test/unit/registry.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { createRegistryClient, RegistryError } from '../../src/registry'
import { fixtureManifest, zipFixtureBundle } from '../helpers/fixtures'

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init)) as unknown as typeof fetch
}

describe('createRegistryClient', () => {
  it('fetches the manifest with the CLI user agent', async () => {
    const seen: Record<string, string> = {}
    const client = createRegistryClient('http://registry.test/', {
      version: '9.9.9',
      fetchImpl: fakeFetch((url, init) => {
        seen.url = url
        seen.ua = new Headers(init?.headers).get('user-agent') ?? ''
        return Response.json(fixtureManifest())
      })
    })
    const m = await client.manifest()
    expect(seen.url).toBe('http://registry.test/api/cli/manifest')
    expect(seen.ua).toBe('@patrity/skills/9.9.9')
    expect(m.skills.map(s => s.slug)).toEqual(['demo', 'second', 'third'])
    expect(client.registry).toBe('http://registry.test')
  })

  it('rejects a manifest whose base has errors', async () => {
    const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => Response.json({ ...fixtureManifest(), errors: ['axis "pm": bad'] })) })
    await expect(client.manifest()).rejects.toThrow(/base schema has errors: axis "pm": bad/)
  })

  it('downloads and unpacks a bundle rooted at <slug>/', async () => {
    const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => new Response(zipFixtureBundle('demo'))) })
    const files = await client.download('demo')
    expect(Object.keys(files).sort()).toEqual(['CLAUDE.md', 'README.md', 'hooks/pre-commit.sh', 'rules/demo.md', 'settings.json', 'skills/demo-skill/SKILL.md'])
    expect(new TextDecoder().decode(files['rules/demo.md'])).toContain('{{appDir}}')
  })

  it('turns non-2xx into RegistryError with status and url', async () => {
    const client = createRegistryClient('http://registry.test', { fetchImpl: fakeFetch(() => new Response('nope', { status: 503 })) })
    await expect(client.download('demo')).rejects.toMatchObject({ name: 'RegistryError', status: 503, url: 'http://registry.test/api/skills/demo/download' })
    expect(await client.download('demo').catch(e => e instanceof RegistryError)).toBe(true)
  })
})
```

- [ ] **Step 3: Run → FAIL, then implement**

`cli/src/registry.ts`:
```ts
import { unzipSync } from 'fflate'
import type { CliManifest } from '../../shared/types/setup'
import { CLI_VERSION } from './version'

export type BundleFiles = Record<string, Uint8Array>

export class RegistryError extends Error {
  name = 'RegistryError'
  constructor(message: string, public url: string, public status?: number) {
    super(message)
  }
}

export interface RegistryClient {
  registry: string
  manifest(opts?: { allowErrors?: boolean }): Promise<CliManifest>
  download(slug: string): Promise<BundleFiles>
}

export function createRegistryClient(registry: string, opts: { fetchImpl?: typeof fetch, version?: string } = {}): RegistryClient {
  const base = registry.replace(/\/+$/, '')
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const headers = { 'user-agent': `@patrity/skills/${opts.version ?? CLI_VERSION}`, 'accept': 'application/json, application/zip' }

  async function get(path: string): Promise<Response> {
    const url = `${base}${path}`
    let res: Response
    try {
      res = await fetchImpl(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(30_000) })
    } catch (err) {
      throw new RegistryError(`registry unreachable: ${(err as Error).message}`, url)
    }
    if (!res.ok) throw new RegistryError(`registry returned ${res.status} for ${url}`, url, res.status)
    return res
  }

  return {
    registry: base,
    async manifest({ allowErrors = false } = {}) {
      const manifest = await (await get('/api/cli/manifest')).json() as CliManifest
      if (!allowErrors && manifest.errors.length) {
        throw new RegistryError(`registry base schema has errors: ${manifest.errors.join('; ')}`, `${base}/api/cli/manifest`)
      }
      return manifest
    },
    async download(slug) {
      const bytes = new Uint8Array(await (await get(`/api/skills/${encodeURIComponent(slug)}/download`)).arrayBuffer())
      const entries = unzipSync(bytes, { filter: f => !f.name.endsWith('/') })
      const files: BundleFiles = {}
      const prefix = `${slug}/`
      for (const [name, data] of Object.entries(entries)) {
        if (!name.startsWith(prefix)) continue
        files[name.slice(prefix.length)] = data
      }
      return files
    }
  }
}
```

- [ ] **Step 4: Run tests → PASS; commit**

```bash
git add cli
git commit -m "feat(cli): registry client with manifest and bundle download"
```

---

### Task 3: Lockfile

**Files:**
- Create: `cli/src/lockfile.ts`
- Test: `cli/test/unit/lockfile.test.ts`

**Interfaces:**
```ts
export const LOCKFILE_PATH = '.claude/skills.lock.json'
export interface Lockfile {
  version: 1
  registry: string
  schemaVersion: number
  projectName: string
  answers: Record<string, string>
  bundles: Record<string, { sha: string, files: Record<string, string> }>  // installed path → sha256
  scaffolds: Record<string, string>                                        // installed path → sha256
  blocks: Record<string, string>                                           // marker source id → sha256(content)
}
export function sha256(bytes: Uint8Array | string): string
export function emptyLockfile(init: { registry: string; schemaVersion: number; projectName: string; answers: Record<string, string> }): Lockfile
export function parseLockfile(text: string): Lockfile            // throws on unknown version/shape
export function serializeLockfile(lock: Lockfile): string         // stable key order, 2-space JSON, trailing newline
export function ownerOf(lock: Lockfile, path: string): string | null   // 'bundle:<slug>' | 'scaffold' | null
export function diffOwnedFiles(lock: Lockfile, readHash: (path: string) => string | null): { modified: string[]; missing: string[] }
```

- [ ] **Step 1: Failing test**

`cli/test/unit/lockfile.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { diffOwnedFiles, emptyLockfile, ownerOf, parseLockfile, serializeLockfile, sha256 } from '../../src/lockfile'

describe('lockfile', () => {
  const lock = emptyLockfile({ registry: 'http://r', schemaVersion: 1, projectName: 'p', answers: { pm: 'pnpm' } })
  lock.bundles.demo = { sha: 'abc', files: { '.claude/rules/demo.md': sha256('rule') } }
  lock.scaffolds['.claude/skills/p-browser-testing/SKILL.md'] = sha256('skill')
  lock.blocks['bundle:demo'] = sha256('- x')

  it('round-trips with stable formatting', () => {
    const text = serializeLockfile(lock)
    expect(text.endsWith('\n')).toBe(true)
    expect(parseLockfile(text)).toEqual(lock)
    expect(text.indexOf('"version"')).toBeLessThan(text.indexOf('"registry"'))
  })
  it('rejects other versions and junk', () => {
    expect(() => parseLockfile('{"version":2}')).toThrow(/unsupported lockfile version/)
    expect(() => parseLockfile('nope')).toThrow(/not valid JSON/)
  })
  it('knows who owns a path', () => {
    expect(ownerOf(lock, '.claude/rules/demo.md')).toBe('bundle:demo')
    expect(ownerOf(lock, '.claude/skills/p-browser-testing/SKILL.md')).toBe('scaffold')
    expect(ownerOf(lock, 'CLAUDE.md')).toBeNull()
  })
  it('reports modified and missing owned files', () => {
    const r = diffOwnedFiles(lock, path => path.endsWith('demo.md') ? sha256('edited') : null)
    expect(r.modified).toEqual(['.claude/rules/demo.md'])
    expect(r.missing).toEqual(['.claude/skills/p-browser-testing/SKILL.md'])
  })
  it('hashes bytes and strings identically', () => {
    expect(sha256('abc')).toBe(sha256(new TextEncoder().encode('abc')))
    expect(sha256('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})
```

- [ ] **Step 2: Implement**

```ts
import { createHash } from 'node:crypto'

export const LOCKFILE_PATH = '.claude/skills.lock.json'

export interface Lockfile { /* as in Interfaces */ }

export function sha256(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function emptyLockfile(init: { registry: string, schemaVersion: number, projectName: string, answers: Record<string, string> }): Lockfile {
  return { version: 1, registry: init.registry, schemaVersion: init.schemaVersion, projectName: init.projectName, answers: { ...init.answers }, bundles: {}, scaffolds: {}, blocks: {} }
}

export function parseLockfile(text: string): Lockfile {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error(`${LOCKFILE_PATH} is not valid JSON`) }
  const lock = raw as Partial<Lockfile>
  if (lock.version !== 1) throw new Error(`unsupported lockfile version: ${String(lock.version)}`)
  if (typeof lock.registry !== 'string' || typeof lock.bundles !== 'object') throw new Error(`${LOCKFILE_PATH} is malformed`)
  return { version: 1, registry: lock.registry, schemaVersion: lock.schemaVersion ?? 0, projectName: lock.projectName ?? '', answers: lock.answers ?? {}, bundles: lock.bundles ?? {}, scaffolds: lock.scaffolds ?? {}, blocks: lock.blocks ?? {} }
}

export function serializeLockfile(lock: Lockfile): string {
  const sorted = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]])) as T
  const out = {
    version: lock.version, registry: lock.registry, schemaVersion: lock.schemaVersion, projectName: lock.projectName,
    answers: sorted(lock.answers),
    bundles: sorted(Object.fromEntries(Object.entries(lock.bundles).map(([slug, b]) => [slug, { sha: b.sha, files: sorted(b.files) }]))),
    scaffolds: sorted(lock.scaffolds), blocks: sorted(lock.blocks)
  }
  return `${JSON.stringify(out, null, 2)}\n`
}

export function ownerOf(lock: Lockfile, path: string): string | null {
  for (const [slug, b] of Object.entries(lock.bundles)) if (path in b.files) return `bundle:${slug}`
  if (path in lock.scaffolds) return 'scaffold'
  return null
}

export function diffOwnedFiles(lock: Lockfile, readHash: (path: string) => string | null): { modified: string[], missing: string[] } {
  const modified: string[] = []
  const missing: string[] = []
  const owned: Record<string, string> = { ...lock.scaffolds }
  for (const b of Object.values(lock.bundles)) Object.assign(owned, b.files)
  for (const [path, hash] of Object.entries(owned).sort()) {
    const now = readHash(path)
    if (now === null) missing.push(path)
    else if (now !== hash) modified.push(path)
  }
  return { modified, missing }
}
```

- [ ] **Step 3: Run tests → PASS; commit**

```bash
git add cli
git commit -m "feat(cli): lockfile model, hashing and drift detection"
```

---

### Task 4: Settings merge and allowlist routing

**Files:**
- Create: `cli/src/settings.ts`
- Test: `cli/test/unit/settings.test.ts`

**Interfaces:**
```ts
export type Json = Record<string, unknown>
export function mergeSettings(existing: Json | null, incoming: Json): Json   // deep merge; hooks unioned per event by hook identity; permissions.allow/deny + enabledPlugins unioned
export function splitBundleSettings(settings: Json | null, settingsLocal: Json | null): { shared: Json; local: Json }  // moves permissions.allow → local; settings.local.json entirely → local
export function ensureGitignoreLine(gitignore: string | null, line: string): string  // idempotent append
export function formatJson(value: Json): string   // 2 spaces, trailing newline
```
- Hook identity = `JSON.stringify` of the hook object; matcher groups with the same `matcher` (or both without) are merged.

- [ ] **Step 1: Failing test**

```ts
import { describe, expect, it } from 'vitest'
import { ensureGitignoreLine, mergeSettings, splitBundleSettings } from '../../src/settings'

const hook = (command: string) => ({ type: 'command', command })

describe('mergeSettings', () => {
  it('unions hooks per event by matcher and identity', () => {
    const existing = { hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [hook('a')] }] } }
    const incoming = { hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [hook('a'), hook('b')] }, { matcher: 'Bash', hooks: [hook('c')] }], PreCompact: [{ hooks: [{ type: 'prompt', prompt: 'p' }] }] } }
    expect(mergeSettings(existing, incoming)).toEqual({
      hooks: {
        PreToolUse: [{ matcher: 'Edit|Write', hooks: [hook('a'), hook('b')] }, { matcher: 'Bash', hooks: [hook('c')] }],
        PreCompact: [{ hooks: [{ type: 'prompt', prompt: 'p' }] }]
      }
    })
  })
  it('unions deny and enabledPlugins, deep-merges other objects, incoming scalars win', () => {
    const out = mergeSettings({ permissions: { deny: ['x'] }, enabledPlugins: { a: true }, other: { k: 1, keep: true } }, { permissions: { deny: ['x', 'y'] }, enabledPlugins: { b: true }, other: { k: 2 } })
    expect(out).toEqual({ permissions: { deny: ['x', 'y'] }, enabledPlugins: { a: true, b: true }, other: { k: 2, keep: true } })
  })
  it('handles a missing existing file', () => {
    expect(mergeSettings(null, { a: 1 })).toEqual({ a: 1 })
  })
})

describe('splitBundleSettings', () => {
  it('routes permissions.allow to the local file and keeps the rest shared', () => {
    const { shared, local } = splitBundleSettings({ permissions: { allow: ['Bash(a:*)'], deny: ['Bash(rm:*)'] }, hooks: { X: [] } }, { permissions: { allow: ['Bash(b:*)'] }, outputStyle: 'Concise' })
    expect(shared).toEqual({ permissions: { deny: ['Bash(rm:*)'] }, hooks: { X: [] } })
    expect(local).toEqual({ permissions: { allow: ['Bash(a:*)', 'Bash(b:*)'] }, outputStyle: 'Concise' })
  })
  it('drops empty permissions objects', () => {
    expect(splitBundleSettings({ permissions: { allow: ['a'] } }, null)).toEqual({ shared: {}, local: { permissions: { allow: ['a'] } } })
  })
})

describe('ensureGitignoreLine', () => {
  it('appends once, preserving the file', () => {
    const once = ensureGitignoreLine('node_modules\n', '.claude/settings.local.json')
    expect(once).toBe('node_modules\n.claude/settings.local.json\n')
    expect(ensureGitignoreLine(once, '.claude/settings.local.json')).toBe(once)
    expect(ensureGitignoreLine(null, 'x')).toBe('x\n')
    expect(ensureGitignoreLine('a', 'b')).toBe('a\nb\n')
  })
})
```

- [ ] **Step 2: Implement**

```ts
export type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const unionStrings = (a: unknown, b: unknown): string[] => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter((x): x is string => typeof x === 'string'))]

function mergeHookEvent(existing: unknown, incoming: unknown): unknown[] {
  type Group = { matcher?: string, hooks?: unknown[] }
  const groups: Group[] = Array.isArray(existing) ? existing.map(g => ({ ...(g as Group), hooks: [...((g as Group).hooks ?? [])] })) : []
  for (const raw of Array.isArray(incoming) ? incoming : []) {
    const g = raw as Group
    const target = groups.find(x => (x.matcher ?? '') === (g.matcher ?? ''))
    if (!target) { groups.push({ ...g, hooks: [...(g.hooks ?? [])] }); continue }
    const seen = new Set((target.hooks ?? []).map(h => JSON.stringify(h)))
    for (const h of g.hooks ?? []) if (!seen.has(JSON.stringify(h))) { target.hooks!.push(h); seen.add(JSON.stringify(h)) }
  }
  return groups
}

export function mergeSettings(existing: Json | null, incoming: Json): Json {
  const out: Json = { ...(existing ?? {}) }
  for (const [key, value] of Object.entries(incoming)) {
    const current = out[key]
    if (key === 'hooks' && isObject(value)) {
      const hooks: Json = { ...(isObject(current) ? current : {}) }
      for (const [event, groups] of Object.entries(value)) hooks[event] = mergeHookEvent(hooks[event], groups)
      out.hooks = hooks
    } else if (key === 'permissions' && isObject(value)) {
      const perms: Json = { ...(isObject(current) ? current : {}) }
      if ('allow' in value) perms.allow = unionStrings(perms.allow, value.allow)
      if ('deny' in value) perms.deny = unionStrings(perms.deny, value.deny)
      for (const [k, v] of Object.entries(value)) if (k !== 'allow' && k !== 'deny') perms[k] = v
      out.permissions = perms
    } else if (key === 'enabledPlugins' && isObject(value)) {
      out.enabledPlugins = { ...(isObject(current) ? current : {}), ...value }
    } else if (isObject(value) && isObject(current)) {
      out[key] = mergeSettings(current, value)
    } else {
      out[key] = value
    }
  }
  return out
}

export function splitBundleSettings(settings: Json | null, settingsLocal: Json | null): { shared: Json, local: Json } {
  const shared: Json = { ...(settings ?? {}) }
  let local: Json = {}
  if (isObject(shared.permissions) && 'allow' in shared.permissions) {
    const { allow, ...rest } = shared.permissions
    local = mergeSettings(local, { permissions: { allow } })
    if (Object.keys(rest).length) shared.permissions = rest
    else delete shared.permissions
  }
  if (settingsLocal) local = mergeSettings(local, settingsLocal)
  return { shared, local }
}

export function ensureGitignoreLine(gitignore: string | null, line: string): string {
  const lines = (gitignore ?? '').split('\n')
  if (lines.some(l => l.trim() === line)) return gitignore!
  const base = gitignore ? (gitignore.endsWith('\n') ? gitignore : `${gitignore}\n`) : ''
  return `${base}${line}\n`
}

export function formatJson(value: Json): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
```

- [ ] **Step 3: Run tests → PASS; commit**

```bash
git add cli
git commit -m "feat(cli): settings deep-merge and allowlist routing"
```

---

### Task 5: Contributions and the plan builder

**Files:**
- Create: `cli/src/contributions.ts`, `cli/src/plan.ts`, `cli/src/project.ts`
- Test: `cli/test/unit/contributions.test.ts`, `cli/test/unit/plan.test.ts`

**Interfaces:**
```ts
// project.ts — everything the planner needs to know about the target dir
export interface ProjectState {
  dir: string; name: string
  files: (rel: string) => Promise<Uint8Array | null>
  claudeMd: string | null; settings: Json | null; settingsLocal: Json | null; gitignore: string | null; lock: Lockfile | null
}
export async function readProject(dir: string): Promise<ProjectState>   // name = basename(dir) unless lock.projectName

// contributions.ts
export function activeAxes(schema: BaseSchema, answers: Record<string, string>): BaseAxis[]   // axes whose `when` is satisfied, schema order
export function contributionsFor(input: { manifest: CliManifest; answers: Record<string, string>; bundles: string[]; bundleFiles: Record<string, BundleFiles>; vars: PlaceholderVars & Record<string, string> }): { contributions: Contribution[]; warnings: string[] }
export function scaffoldsFor(schema: BaseSchema, answers: Record<string, string>): { template: string; to: string; mode: 'create' | 'append' }[]

// plan.ts
export interface FileOp { path: string; bytes: Uint8Array; mode?: number; owner: string; action: 'create' | 'update' | 'unchanged' | 'conflict' | 'protected' }
export interface SetupPlan {
  files: FileOp[]
  removals: string[]          // owned files of bundles no longer selected, removed only when untouched since install
  claudeMd: { content: string; changed: boolean; handEdited: string[] }
  settings: { content: string; changed: boolean } | null
  settingsLocal: { content: string; changed: boolean } | null
  gitignore: { content: string; changed: boolean } | null
  lock: Lockfile
  warnings: string[]
}
export async function buildPlan(input: { manifest: CliManifest; project: ProjectState; answers: Record<string, string>; bundles: string[]; bundleFiles: Record<string, BundleFiles>; force?: boolean }): Promise<SetupPlan>
```
- `conflict`: the target exists, differs, and is not owned by this bundle in the lock. `protected`: owned but hand-edited since install (lock hash ≠ current) and `force` is false. `update`: owned, content changes. `unchanged`: bytes equal.
- Text files (not binary) are placeholder-rendered before comparison; `hooks/*` get `mode: 0o755`.
- CLAUDE.md `handEdited`: marker blocks whose current content hash ≠ `lock.blocks[sourceId]`; with `force` false the planner keeps the current content of those blocks (drops the incoming contribution for that source/section) and reports them.

- [ ] **Step 1: Failing tests**

`cli/test/unit/contributions.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { activeAxes, contributionsFor, scaffoldsFor } from '../../src/contributions'
import { fixtureManifest, loadFixtureBundle } from '../helpers/fixtures'
import { placeholderVars } from '../../../shared/setup/placeholders'

const manifest = fixtureManifest()

describe('activeAxes', () => {
  it('skips follow-ups whose condition is not met', () => {
    expect(activeAxes(manifest.base!, { layout: 'single' }).map(a => a.id)).toEqual(['pm', 'layout', 'browser'])
    expect(activeAxes(manifest.base!, { layout: 'monorepo' }).map(a => a.id)).toEqual(['pm', 'layout', 'appDir', 'browser'])
  })
})

describe('contributionsFor', () => {
  it('orders always → axes → bundles, sections split, placeholders rendered', () => {
    const answers = { pm: 'pnpm', layout: 'monorepo', appDir: 'apps/web/app', browser: 'none' }
    const { contributions, warnings } = contributionsFor({
      manifest, answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() },
      vars: { ...placeholderVars(answers, 'proj'), appDir: 'apps/web/app' }
    })
    expect(warnings).toEqual([])
    expect(contributions.map(c => [c.sourceId, c.sectionId])).toEqual([
      ['base:always/self-improvement', 'self-improvement'],
      ['base:pm=pnpm', 'commands'],
      ['base:layout=monorepo', 'constraints'],
      ['bundle:demo', 'commands'],
      ['bundle:demo', 'skills-and-rules']
    ])
    expect(contributions[1]!.markdown).toContain('Always `pnpm`')
    expect(contributions[2]!.markdown).toContain('`apps/web/app`')
    expect(contributions[3]!.markdown).toBe('- `pnpm demo` runs the demo.')
  })
  it('warns on unknown placeholders and skips bundles without a snippet', () => {
    const files = loadFixtureBundle()
    files['CLAUDE.md'] = new TextEncoder().encode('## Commands\n- {{mystery}}\n')
    const { contributions, warnings } = contributionsFor({ manifest, answers: { pm: 'npm', layout: 'single', browser: 'none' }, bundles: ['demo', 'second'], bundleFiles: { demo: files, second: {} }, vars: placeholderVars({ pm: 'npm' }, 'p') })
    expect(warnings).toEqual(['bundle:demo CLAUDE.md: unknown placeholder {{mystery}}'])
    expect(contributions.some(c => c.sourceId === 'bundle:second')).toBe(false)
  })
})

describe('scaffoldsFor', () => {
  it('lists scaffolds for chosen options only', () => {
    expect(scaffoldsFor(manifest.base!, { browser: 'cli' })).toEqual([{ template: 'browser-testing-project.md', to: '.claude/skills/{{projectName}}-browser-testing/SKILL.md', mode: 'create' }])
    expect(scaffoldsFor(manifest.base!, { browser: 'none' })).toEqual([])
  })
})
```

`cli/test/unit/plan.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildPlan } from '../../src/plan'
import { emptyLockfile, sha256 } from '../../src/lockfile'
import type { ProjectState } from '../../src/project'
import { fixtureManifest, loadFixtureBundle } from '../helpers/fixtures'
import { startMarker } from '../../../shared/setup/markers'

const manifest = fixtureManifest()
const enc = (s: string) => new TextEncoder().encode(s)

function project(over: Partial<ProjectState> & { disk?: Record<string, string> } = {}): ProjectState {
  const disk = over.disk ?? {}
  return {
    dir: '/tmp/p', name: 'proj', claudeMd: null, settings: null, settingsLocal: null, gitignore: null, lock: null,
    files: async rel => (rel in disk ? enc(disk[rel]!) : null),
    ...over
  }
}
const answers = { pm: 'pnpm', layout: 'single', browser: 'cli' }

describe('buildPlan (fresh project)', () => {
  it('creates bundle files under .claude, renders placeholders, marks hooks executable, scaffolds, merges settings', async () => {
    const plan = await buildPlan({ manifest, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const paths = plan.files.map(f => f.path).sort()
    expect(paths).toEqual(['.claude/hooks/pre-commit.sh', '.claude/rules/demo.md', '.claude/skills/demo-skill/SKILL.md', '.claude/skills/proj-browser-testing/SKILL.md'])
    expect(plan.files.every(f => f.action === 'create')).toBe(true)
    const hook = plan.files.find(f => f.path.endsWith('pre-commit.sh'))!
    expect(hook.mode).toBe(0o755)
    expect(new TextDecoder().decode(hook.bytes)).toContain('pnpm lint')
    expect(new TextDecoder().decode(plan.files.find(f => f.path.endsWith('rules/demo.md'))!.bytes)).toContain('"app/**/*.vue"')
    expect(new TextDecoder().decode(plan.files.find(f => f.path.includes('proj-browser-testing'))!.bytes)).toContain('Browser testing for proj')
    expect(plan.settings!.content).toContain('"deny"')
    expect(plan.settings!.content).not.toContain('"allow"')
    expect(plan.settingsLocal!.content).toContain('Bash(echo:*)')
    expect(plan.gitignore!.content).toContain('.claude/settings.local.json')
    expect(plan.claudeMd.content.startsWith('# proj\n')).toBe(true)
    expect(plan.claudeMd.content).toContain(startMarker('bundle:demo'))
    expect(plan.lock.bundles.demo!.files['.claude/rules/demo.md']).toBe(sha256(plan.files.find(f => f.path.endsWith('rules/demo.md'))!.bytes))
    expect(plan.lock.blocks['bundle:demo']).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('buildPlan (existing project)', () => {
  it('flags conflicts for foreign files, updates owned ones, and leaves unchanged ones alone', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    const first = await buildPlan({ manifest, project: project(), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const ruleBytes = first.files.find(f => f.path === '.claude/rules/demo.md')!.bytes
    lock.bundles.demo = { sha: 'old', files: { '.claude/rules/demo.md': sha256(ruleBytes), '.claude/skills/demo-skill/SKILL.md': sha256('stale') } }
    const disk = {
      '.claude/rules/demo.md': new TextDecoder().decode(ruleBytes),              // owned, unchanged
      '.claude/skills/demo-skill/SKILL.md': 'stale',                              // owned, upstream changed
      '.claude/hooks/pre-commit.sh': 'someone elses hook'                          // not owned → conflict
    }
    const plan = await buildPlan({ manifest, project: project({ disk, lock }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    const byPath = Object.fromEntries(plan.files.map(f => [f.path, f.action]))
    expect(byPath['.claude/rules/demo.md']).toBe('unchanged')
    expect(byPath['.claude/skills/demo-skill/SKILL.md']).toBe('update')
    expect(byPath['.claude/hooks/pre-commit.sh']).toBe('conflict')
  })

  it('protects hand-edited owned files and marker blocks unless forced', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.bundles.demo = { sha: 'old', files: { '.claude/rules/demo.md': sha256('installed') } }
    lock.blocks['bundle:demo'] = sha256('- installed block')
    const claudeMd = `# proj\n\n## Commands\n\n${startMarker('bundle:demo')}\n- I edited this by hand\n<!-- /skills:bundle:demo -->\n`
    const disk = { '.claude/rules/demo.md': 'edited by hand' }
    const plan = await buildPlan({ manifest, project: project({ disk, lock, claudeMd }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(plan.files.find(f => f.path === '.claude/rules/demo.md')!.action).toBe('protected')
    expect(plan.claudeMd.handEdited).toEqual(['bundle:demo'])
    expect(plan.claudeMd.content).toContain('- I edited this by hand')
    const forced = await buildPlan({ manifest, project: project({ disk, lock, claudeMd }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() }, force: true })
    expect(forced.files.find(f => f.path === '.claude/rules/demo.md')!.action).toBe('update')
    expect(forced.claudeMd.content).not.toContain('- I edited this by hand')
  })

  it('drops files and blocks of a bundle that is no longer selected (remove)', async () => {
    const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: 1, projectName: 'proj', answers })
    lock.bundles.demo = { sha: 'x', files: { '.claude/rules/demo.md': sha256('r') } }
    const plan = await buildPlan({ manifest, project: project({ disk: { '.claude/rules/demo.md': 'r' }, lock }), answers, bundles: [], bundleFiles: {} })
    expect(plan.removals).toEqual(['.claude/rules/demo.md'])
    expect(plan.lock.bundles.demo).toBeUndefined()
  })
})
```
- [ ] **Step 2: Implement**

`cli/src/project.ts`:
```ts
import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { LOCKFILE_PATH, parseLockfile, type Lockfile } from './lockfile'
import type { Json } from './settings'

export interface ProjectState {
  dir: string
  name: string
  files: (rel: string) => Promise<Uint8Array | null>
  claudeMd: string | null
  settings: Json | null
  settingsLocal: Json | null
  gitignore: string | null
  lock: Lockfile | null
}

async function readText(dir: string, rel: string): Promise<string | null> {
  try { return await readFile(join(dir, rel), 'utf8') } catch { return null }
}
async function readJson(dir: string, rel: string): Promise<Json | null> {
  const text = await readText(dir, rel)
  if (text === null) return null
  try { return JSON.parse(text) as Json } catch { throw new Error(`${rel} is not valid JSON`) }
}

export async function readProject(dir: string): Promise<ProjectState> {
  const abs = resolve(dir)
  const lockText = await readText(abs, LOCKFILE_PATH)
  const lock = lockText === null ? null : parseLockfile(lockText)
  return {
    dir: abs,
    name: lock?.projectName || basename(abs),
    files: async rel => { try { return new Uint8Array(await readFile(join(abs, rel))) } catch { return null } },
    claudeMd: await readText(abs, 'CLAUDE.md'),
    settings: await readJson(abs, '.claude/settings.json'),
    settingsLocal: await readJson(abs, '.claude/settings.local.json'),
    gitignore: await readText(abs, '.gitignore'),
    lock
  }
}
```

`cli/src/contributions.ts`:
```ts
import type { BaseAxis, BaseSchema, CliManifest } from '../../shared/types/setup'
import { splitSnippet } from '../../shared/setup/sections'
import { renderPlaceholders, type PlaceholderVars } from '../../shared/setup/placeholders'
import type { Contribution } from '../../shared/setup/render'
import type { BundleFiles } from './registry'

const decoder = new TextDecoder()

export function activeAxes(schema: BaseSchema, answers: Record<string, string>): BaseAxis[] {
  return schema.axes.filter(a => !a.when || answers[a.when.axis] === a.when.option)
}

function render(text: string, vars: Record<string, string>, label: string, warnings: string[]): string {
  const { text: out, unknown } = renderPlaceholders(text, vars as PlaceholderVars)
  for (const key of unknown) warnings.push(`${label}: unknown placeholder {{${key}}}`)
  return out
}

function addSnippet(md: string, sourceId: string, vars: Record<string, string>, label: string, out: Contribution[], warnings: string[]) {
  const { byId, errors } = splitSnippet(md)
  for (const e of errors) warnings.push(`${label}: ${e}`)
  for (const [sectionId, markdown] of Object.entries(byId)) {
    out.push({ sourceId, sectionId, markdown: render(markdown, vars, label, warnings) })
  }
}

/** Ordered contributions: always fragments, then answered axis fragments (schema order), then bundles A→Z. */
export function contributionsFor(input: { manifest: CliManifest, answers: Record<string, string>, bundles: string[], bundleFiles: Record<string, BundleFiles>, vars: PlaceholderVars & Record<string, string> }): { contributions: Contribution[], warnings: string[] } {
  const out: Contribution[] = []
  const warnings: string[] = []
  const base = input.manifest.base
  if (base) {
    for (const name of Object.keys(base.always).sort()) addSnippet(base.always[name]!, `base:always/${name.replace(/\.md$/, '')}`, input.vars, `base/always/${name}`, out, warnings)
    for (const axis of activeAxes(base, input.answers)) {
      const option = axis.options?.find(o => o.id === input.answers[axis.id])
      if (!option?.fragment) continue
      const md = base.fragments[option.fragment]
      if (md === undefined) { warnings.push(`axis ${axis.id}: fragment ${option.fragment} missing from manifest`); continue }
      addSnippet(md, `base:${axis.id}=${option.id}`, input.vars, `base/fragments/${option.fragment}`, out, warnings)
    }
  }
  for (const slug of [...input.bundles].sort()) {
    const files = input.bundleFiles[slug] ?? {}
    const key = Object.keys(files).find(p => p.toLowerCase() === 'claude.md')
    if (!key) continue
    addSnippet(decoder.decode(files[key]), `bundle:${slug}`, input.vars, `bundle:${slug} CLAUDE.md`, out, warnings)
  }
  return { contributions: out, warnings }
}

export function scaffoldsFor(schema: BaseSchema, answers: Record<string, string>): { template: string, to: string, mode: 'create' | 'append' }[] {
  const out: { template: string, to: string, mode: 'create' | 'append' }[] = []
  for (const axis of activeAxes(schema, answers)) {
    const option = axis.options?.find(o => o.id === answers[axis.id])
    for (const s of option?.scaffolds ?? []) out.push({ template: s.template, to: s.to, mode: s.mode ?? 'create' })
  }
  return out
}
```

`cli/src/plan.ts` — the core (keep it in this shape; helpers may be split into a sibling file if it grows past ~250 lines):
```ts
import type { CliManifest } from '../../shared/types/setup'
import { composeClaudeMd } from '../../shared/setup/render'
import { findMarkerBlocks } from '../../shared/setup/markers'
import { placeholderVars, renderPlaceholders, type PlaceholderVars } from '../../shared/setup/placeholders'
import { activeAxes, contributionsFor, scaffoldsFor } from './contributions'
import { emptyLockfile, sha256, type Lockfile } from './lockfile'
import type { BundleFiles } from './registry'
import type { ProjectState } from './project'
import { ensureGitignoreLine, formatJson, mergeSettings, splitBundleSettings, type Json } from './settings'

export interface FileOp { path: string, bytes: Uint8Array, mode?: number, owner: string, action: 'create' | 'update' | 'unchanged' | 'conflict' | 'protected' }
export interface SetupPlan {
  files: FileOp[]
  removals: string[]
  claudeMd: { content: string, changed: boolean, handEdited: string[] }
  settings: { content: string, changed: boolean } | null
  settingsLocal: { content: string, changed: boolean } | null
  gitignore: { content: string, changed: boolean } | null
  lock: Lockfile
  warnings: string[]
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()
const SKIP = new Set(['readme.md', 'claude.md', 'settings.json', 'settings.local.json'])
const isBinary = (b: Uint8Array) => { for (let i = 0; i < Math.min(b.length, 8000); i++) if (b[i] === 0) return true; return false }

/** Text-axis answers double as placeholders ({{appDir}}, {{domainName}} …). */
export function varsFor(manifest: CliManifest, answers: Record<string, string>, projectName: string): PlaceholderVars & Record<string, string> {
  const vars: Record<string, string> = { ...placeholderVars(answers, projectName) }
  for (const axis of manifest.base ? activeAxes(manifest.base, answers) : []) if (axis.input && answers[axis.id]) vars[axis.id] = answers[axis.id]!
  return vars as PlaceholderVars & Record<string, string>
}

export async function buildPlan(input: { manifest: CliManifest, project: ProjectState, answers: Record<string, string>, bundles: string[], bundleFiles: Record<string, BundleFiles>, force?: boolean }): Promise<SetupPlan> {
  const { manifest, project, answers, bundles, bundleFiles, force = false } = input
  const warnings: string[] = []
  const vars = varsFor(manifest, answers, project.name)
  const prev = project.lock
  const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: manifest.base?.version ?? 0, projectName: project.name, answers })
  const files: FileOp[] = []
  let shared: Json = {}
  let local: Json = {}

  const classify = async (path: string, bytes: Uint8Array, owner: string, prevHash: string | undefined): Promise<FileOp['action']> => {
    const current = await project.files(path)
    if (current === null) return 'create'
    const currentHash = sha256(current)
    if (currentHash === sha256(bytes)) return 'unchanged'
    if (prevHash === undefined) return 'conflict'          // exists but we never installed it
    if (currentHash !== prevHash && !force) return 'protected'  // hand-edited since install
    return 'update'
  }

  for (const slug of [...bundles].sort()) {
    const bundle = bundleFiles[slug] ?? {}
    const prevFiles = prev?.bundles[slug]?.files ?? {}
    lock.bundles[slug] = { sha: manifest.sha, files: {} }
    let settingsJson: Json | null = null
    let settingsLocalJson: Json | null = null
    for (const [rel, raw] of Object.entries(bundle)) {
      const lower = rel.toLowerCase()
      if (lower === 'settings.json') { settingsJson = JSON.parse(renderPlaceholders(decoder.decode(raw), vars).text) as Json; continue }
      if (lower === 'settings.local.json') { settingsLocalJson = JSON.parse(decoder.decode(raw)) as Json; continue }
      if (SKIP.has(lower)) continue
      const path = `.claude/${rel}`
      let bytes = raw
      if (!isBinary(raw)) {
        const r = renderPlaceholders(decoder.decode(raw), vars)
        for (const k of r.unknown) warnings.push(`${slug}/${rel}: unknown placeholder {{${k}}}`)
        bytes = encoder.encode(r.text)
      }
      const action = await classify(path, bytes, `bundle:${slug}`, prevFiles[path])
      files.push({ path, bytes, owner: `bundle:${slug}`, action, ...(rel.startsWith('hooks/') ? { mode: 0o755 } : {}) })
      lock.bundles[slug]!.files[path] = action === 'protected' || action === 'conflict' ? (prevFiles[path] ?? sha256(bytes)) : sha256(bytes)
    }
    const split = splitBundleSettings(settingsJson, settingsLocalJson)
    shared = mergeSettings(shared, split.shared)
    local = mergeSettings(local, split.local)
  }

  // Scaffolds from base options (templates rendered; append mode concatenates onto the same path).
  const scaffolded = new Map<string, string>()
  if (manifest.base) {
    for (const s of scaffoldsFor(manifest.base, answers)) {
      const template = manifest.base.templates[s.template]
      if (template === undefined) { warnings.push(`scaffold template ${s.template} missing from manifest`); continue }
      const to = renderPlaceholders(s.to, vars).text
      const text = renderPlaceholders(template, vars).text
      scaffolded.set(to, s.mode === 'append' && scaffolded.has(to) ? `${scaffolded.get(to)!.replace(/\n*$/, '\n')}${text}` : text)
    }
  }
  for (const [path, text] of scaffolded) {
    const bytes = encoder.encode(text)
    const action = await classify(path, bytes, 'scaffold', prev?.scaffolds[path])
    // A scaffold is a starting point the user edits: never overwrite an existing one unless forced.
    files.push({ path, bytes, owner: 'scaffold', action: action === 'update' && !force ? 'protected' : action })
    lock.scaffolds[path] = prev?.scaffolds[path] ?? sha256(bytes)
  }

  // Bundles present in the previous lock but no longer selected → removals (only if untouched).
  const removals: string[] = []
  for (const [slug, entry] of Object.entries(prev?.bundles ?? {})) {
    if (bundles.includes(slug)) continue
    for (const [path, hash] of Object.entries(entry.files)) {
      const current = await project.files(path)
      if (current === null) continue
      if (sha256(current) === hash) removals.push(path)
      else warnings.push(`${path} was modified after install; left in place (remove it by hand)`)
    }
  }

  // CLAUDE.md
  const { contributions, warnings: cw } = contributionsFor({ manifest, answers, bundles, bundleFiles, vars })
  warnings.push(...cw)
  const handEdited: string[] = []
  const existingBlocks = project.claudeMd ? findMarkerBlocks(project.claudeMd) : []
  for (const block of existingBlocks) {
    const recorded = prev?.blocks[block.sourceId]
    if (recorded && recorded !== sha256(block.content)) handEdited.push(block.sourceId)
  }
  let effective = contributions
  if (handEdited.length && !force) {
    // Keep the user's edited block content: replace incoming contributions of that source with the current text.
    effective = contributions.filter(c => !handEdited.includes(c.sourceId))
    for (const id of handEdited) {
      for (const block of existingBlocks.filter(b => b.sourceId === id)) effective.push({ sourceId: id, sectionId: sectionOfBlock(project.claudeMd!, block.start), markdown: block.content })
    }
  }
  const claudeMd = composeClaudeMd(project.claudeMd, { title: project.name, contributions: effective })
  for (const block of findMarkerBlocks(claudeMd)) lock.blocks[block.sourceId] = sha256(block.content)

  const settingsContent = Object.keys(shared).length ? formatJson(mergeSettings(project.settings, shared)) : null
  const localContent = Object.keys(local).length ? formatJson(mergeSettings(project.settingsLocal, local)) : null
  const gitignoreContent = localContent ? ensureGitignoreLine(project.gitignore, '.claude/settings.local.json') : null

  return {
    files, removals,
    claudeMd: { content: claudeMd, changed: claudeMd !== (project.claudeMd ?? ''), handEdited },
    settings: settingsContent ? { content: settingsContent, changed: settingsContent !== (project.settings ? formatJson(project.settings) : '') } : null,
    settingsLocal: localContent ? { content: localContent, changed: localContent !== (project.settingsLocal ? formatJson(project.settingsLocal) : '') } : null,
    gitignore: gitignoreContent ? { content: gitignoreContent, changed: gitignoreContent !== (project.gitignore ?? '') } : null,
    lock, warnings
  }
}

/** The canonical section id of the `## …` heading above a given line, or skills-and-rules. */
function sectionOfBlock(md: string, line: number): string {
  const lines = md.split('\n')
  for (let i = line; i >= 0; i--) {
    const h = /^##\s+(.+?)\s*$/.exec(lines[i]!)
    if (h) return sectionIdForHeading(h[1]!) ?? 'skills-and-rules'
  }
  return 'skills-and-rules'
}
```
(import `sectionIdForHeading` from `'../../shared/setup/sections'`.)

- [ ] **Step 3: Run tests → PASS; typecheck; commit**

```bash
git add cli
git commit -m "feat(cli): contributions, scaffolds and the plan builder"
```

---

### Task 6: Wizard sequencing (pure) and prompts

**Files:**
- Create: `cli/src/wizard.ts`, `cli/src/prompts.ts`
- Test: `cli/test/unit/wizard.test.ts`

**Interfaces:**
```ts
// wizard.ts (pure)
export function defaultAnswers(schema: BaseSchema): Record<string, string>   // select axes → default; input axes → input.default
export function applyProfile(schema: BaseSchema, profile: Profile | undefined, answers: Record<string, string>): Record<string, string>
export function parseAnswerFlags(flags: string[]): Record<string, string>     // ["pm=npm","layout=monorepo"] → {pm:'npm',…}; throws on bad shape
export function validateAnswers(schema: BaseSchema, answers: Record<string, string>): string[]   // unknown axis, not an option
export function preselectedBundles(schema: BaseSchema, answers: Record<string, string>, profile: Profile | undefined, skills: SkillSummary[]): string[]  // profile.bundles ∪ option.selects ∪ suggests of those
export function resolveBundles(selected: string[], skills: SkillSummary[]): { bundles: string[]; missing: string[] }   // adds dependsOn transitively; sorted
export function groupByTag(skills: SkillSummary[]): Record<string, SkillSummary[]>   // first tag wins; 'other' fallback
// prompts.ts (clack)
export async function askAxes(schema: BaseSchema, answers: Record<string, string>): Promise<Record<string, string>>   // asks active axes in order; text axes via text(); cancel → process.exit(0)
export async function askBundles(skills: SkillSummary[], preselected: string[], profiles: Profile[]): Promise<{ bundles: string[]; profile?: Profile }>  // groupMultiselect grouped by tag, profiles offered first via select
export async function confirmPlan(plan: SetupPlan): Promise<boolean>   // prints the dry-run summary (note()) then confirm()
export async function resolveConflicts(plan: SetupPlan): Promise<Set<string>>   // per conflict: skip / overwrite / show diff; returns paths to overwrite
```

- [ ] **Step 1: Failing tests (pure part)**

```ts
import { describe, expect, it } from 'vitest'
import { applyProfile, defaultAnswers, groupByTag, parseAnswerFlags, preselectedBundles, resolveBundles, validateAnswers } from '../../src/wizard'
import { fixtureManifest } from '../helpers/fixtures'

const m = fixtureManifest()
const schema = m.base!

describe('wizard', () => {
  it('defaults every axis', () => {
    expect(defaultAnswers(schema)).toEqual({ pm: 'pnpm', layout: 'single', appDir: 'apps/web/app', browser: 'cli' })
  })
  it('applies a profile over defaults and parses --answer flags', () => {
    const a = applyProfile(schema, m.profiles[0], defaultAnswers(schema))
    expect(a.browser).toBe('none')
    expect(parseAnswerFlags(['pm=npm', 'appDir=x/y'])).toEqual({ pm: 'npm', appDir: 'x/y' })
    expect(() => parseAnswerFlags(['nope'])).toThrow(/expected axis=option/)
  })
  it('validates answers', () => {
    expect(validateAnswers(schema, { pm: 'bun2', zzz: 'x' })).toEqual(['pm: "bun2" is not an option', 'unknown axis "zzz"'])
    expect(validateAnswers(schema, { appDir: 'anything' })).toEqual([])
  })
  it('preselects from profile, selects and suggests', () => {
    expect(preselectedBundles(schema, { pm: 'pnpm' }, undefined, m.skills)).toEqual(['demo', 'second'])   // pm=pnpm selects demo; demo suggests second
    expect(preselectedBundles(schema, { pm: 'npm' }, m.profiles[0], m.skills)).toEqual(['demo', 'second'])
  })
  it('resolves dependencies transitively and reports unknown slugs', () => {
    expect(resolveBundles(['third'], m.skills)).toEqual({ bundles: ['second', 'third'], missing: [] })
    expect(resolveBundles(['ghost', 'demo'], m.skills)).toEqual({ bundles: ['demo'], missing: ['ghost'] })
  })
  it('groups by first tag', () => {
    const g = groupByTag(m.skills)
    expect(Object.values(g).flat().length).toBe(m.skills.length)
  })
})
```

- [ ] **Step 2: Implement `wizard.ts`**

```ts
import type { BaseSchema, Profile } from '../../shared/types/setup'
import type { SkillSummary } from '../../shared/types/skills'
import { activeAxes } from './contributions'

export function defaultAnswers(schema: BaseSchema): Record<string, string> {
  const out: Record<string, string> = {}
  for (const axis of schema.axes) {
    if (axis.options && axis.default) out[axis.id] = axis.default
    else if (axis.input) out[axis.id] = axis.input.default
  }
  return out
}

export function applyProfile(_schema: BaseSchema, profile: Profile | undefined, answers: Record<string, string>): Record<string, string> {
  return profile ? { ...answers, ...profile.answers } : { ...answers }
}

export function parseAnswerFlags(flags: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const flag of flags) {
    const m = /^([A-Za-z][A-Za-z0-9]*)=(.*)$/.exec(flag)
    if (!m) throw new Error(`--answer "${flag}": expected axis=option`)
    out[m[1]!] = m[2]!
  }
  return out
}

export function validateAnswers(schema: BaseSchema, answers: Record<string, string>): string[] {
  const errors: string[] = []
  for (const [id, value] of Object.entries(answers)) {
    const axis = schema.axes.find(a => a.id === id)
    if (!axis) { errors.push(`unknown axis "${id}"`); continue }
    if (axis.options && !axis.options.some(o => o.id === value)) errors.push(`${id}: "${value}" is not an option`)
  }
  return errors
}

export function preselectedBundles(schema: BaseSchema, answers: Record<string, string>, profile: Profile | undefined, skills: SkillSummary[]): string[] {
  const picked = new Set<string>(profile?.bundles ?? [])
  for (const axis of activeAxes(schema, answers)) {
    const option = axis.options?.find(o => o.id === answers[axis.id])
    for (const slug of option?.selects ?? []) picked.add(slug)
  }
  for (const slug of [...picked]) for (const s of skills.find(k => k.slug === slug)?.suggests ?? []) picked.add(s)
  return [...picked].filter(slug => skills.some(s => s.slug === slug)).sort()
}

export function resolveBundles(selected: string[], skills: SkillSummary[]): { bundles: string[], missing: string[] } {
  const known = new Map(skills.map(s => [s.slug, s]))
  const out = new Set<string>()
  const missing = new Set<string>()
  const visit = (slug: string) => {
    if (out.has(slug)) return
    const skill = known.get(slug)
    if (!skill) { missing.add(slug); return }
    out.add(slug)
    for (const dep of skill.dependsOn ?? []) visit(dep)
  }
  for (const slug of selected) visit(slug)
  return { bundles: [...out].sort(), missing: [...missing].sort() }
}

export function groupByTag(skills: SkillSummary[]): Record<string, SkillSummary[]> {
  const groups: Record<string, SkillSummary[]> = {}
  for (const skill of [...skills].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const tag = skill.tags[0] ?? 'other'
    ;(groups[tag] ??= []).push(skill)
  }
  return groups
}
```

- [ ] **Step 3: Implement `prompts.ts`** (thin; not unit-tested — exercised by hand and by the `--yes` paths in the integration suite)

```ts
import { cancel, confirm, groupMultiselect, isCancel, note, select, text } from '@clack/prompts'
import type { BaseSchema, Profile } from '../../shared/types/setup'
import type { SkillSummary } from '../../shared/types/skills'
import { activeAxes } from './contributions'
import type { SetupPlan } from './plan'
import { groupByTag } from './wizard'

/** Unwrap a clack result; a cancel (Ctrl-C) exits cleanly. */
function bail<T>(value: T | symbol): T {
  if (isCancel(value)) { cancel('Cancelled.'); process.exit(0) }
  return value as T
}

export async function askAxes(schema: BaseSchema, answers: Record<string, string>): Promise<Record<string, string>> {
  const out = { ...answers }
  // Re-evaluate after every answer so follow-ups appear as soon as their condition holds.
  for (let i = 0; i < schema.axes.length; i++) {
    const axis = activeAxes(schema, out)[i]
    if (!axis) break
    if (axis.options) {
      out[axis.id] = bail(await select({ message: axis.question, initialValue: out[axis.id] ?? axis.default, options: axis.options.map(o => ({ value: o.id, label: o.label, hint: o.description })) }))
    } else if (axis.input) {
      out[axis.id] = bail(await text({ message: axis.question, placeholder: axis.input.placeholder, initialValue: out[axis.id] ?? axis.input.default })) || axis.input.default
    }
  }
  return out
}

export async function askBundles(skills: SkillSummary[], preselected: string[], profiles: Profile[]): Promise<{ bundles: string[], profile?: Profile }> {
  let profile: Profile | undefined
  if (profiles.length) {
    const picked = bail(await select({ message: 'Start from a profile?', initialValue: 'none', options: [{ value: 'none', label: 'No profile — pick bundles myself' }, ...profiles.map(p => ({ value: p.name, label: p.name, hint: p.description }))] }))
    profile = profiles.find(p => p.name === picked)
  }
  const initial = [...new Set([...preselected, ...(profile?.bundles ?? [])])]
  const options = Object.fromEntries(Object.entries(groupByTag(skills)).map(([tag, list]) => [tag, list.map(s => ({ value: s.slug, label: s.name, hint: s.description }))]))
  const chosen = bail(await groupMultiselect({ message: 'Which bundles?', options, initialValues: initial, required: false }))
  return { bundles: chosen, profile }
}

export function summarize(plan: SetupPlan): string {
  const count = (a: string) => plan.files.filter(f => f.action === a).length
  const lines = [
    `create ${count('create')} · update ${count('update')} · unchanged ${count('unchanged')} · conflicts ${count('conflict')} · protected ${count('protected')}`,
    ...(plan.removals.length ? [`remove ${plan.removals.length}: ${plan.removals.join(', ')}`] : []),
    `CLAUDE.md: ${plan.claudeMd.changed ? 'updated' : 'unchanged'}${plan.claudeMd.handEdited.length ? ` (hand-edited kept: ${plan.claudeMd.handEdited.join(', ')})` : ''}`,
    `settings.json: ${plan.settings ? (plan.settings.changed ? 'merged' : 'unchanged') : '—'} · settings.local.json: ${plan.settingsLocal ? (plan.settingsLocal.changed ? 'merged' : 'unchanged') : '—'}`,
    ...plan.warnings.map(w => `⚠ ${w}`)
  ]
  return lines.join('\n')
}

export async function confirmPlan(plan: SetupPlan): Promise<boolean> {
  note(summarize(plan), 'Plan')
  return bail(await confirm({ message: 'Apply?', initialValue: true }))
}

export async function resolveConflicts(plan: SetupPlan): Promise<Set<string>> {
  const overwrite = new Set<string>()
  for (const op of plan.files.filter(f => f.action === 'conflict')) {
    const choice = bail(await select({ message: `${op.path} exists and is not managed.`, options: [{ value: 'skip', label: 'Skip (keep mine)' }, { value: 'overwrite', label: 'Overwrite with the bundle version' }] }))
    if (choice === 'overwrite') overwrite.add(op.path)
  }
  return overwrite
}
```

- [ ] **Step 4: Run tests → PASS; typecheck; commit**

```bash
git add cli
git commit -m "feat(cli): wizard sequencing, dependency resolution and prompts"
```

---

### Task 7: Apply and the commands, with an integration suite

**Files:**
- Create: `cli/src/apply.ts`, `cli/src/commands/{init,add,remove,update,diff,list}.ts`, `cli/src/run.ts` (programmatic entry used by tests), `cli/test/helpers/registry-server.ts`
- Modify: `cli/src/index.ts`
- Test: `cli/test/integration/cli.test.ts`

**Interfaces:**
```ts
// apply.ts
export async function applyPlan(plan: SetupPlan, dir: string, opts: { overwrite?: Set<string> }): Promise<{ written: string[]; removed: string[]; skipped: string[] }>
// run.ts — every command as a function; index.ts only parses args and calls these
export interface CommonOpts { dir: string; registry: string; yes: boolean; force: boolean; json: boolean; fetchImpl?: typeof fetch; interactive?: boolean }
export async function runInit(opts: CommonOpts & { profile?: string; with?: string[]; answers?: string[] }): Promise<SetupPlan>
export async function runAdd(opts: CommonOpts & { slugs: string[] }): Promise<SetupPlan>
export async function runRemove(opts: CommonOpts & { slugs: string[] }): Promise<SetupPlan>
export async function runUpdate(opts: CommonOpts & { slugs?: string[] }): Promise<SetupPlan>
export async function runDiff(opts: CommonOpts): Promise<{ modified: string[]; missing: string[]; upstream: { slug: string; installed: string; latest: string }[]; handEdited: string[] }>
export async function runList(opts: CommonOpts): Promise<{ bundles: string[]; answers: Record<string, string>; registry: string; upstreamSha: string; installedSha: string }>
```
- `applyPlan` writes `create`/`update` ops and conflicts in `overwrite`; skips `protected`, `unchanged` and other conflicts; sets modes; writes CLAUDE.md/settings/settings.local/.gitignore when changed; deletes `removals`; writes the lockfile last. Never writes outside `dir` (assert resolved paths start with `dir`).
- `runInit` with `yes: true`: answers = defaults → profile → `--answer` flags (validated); bundles = `--with` ∪ preselected, resolved; conflicts are skipped and reported. Interactive mode uses the prompts. `runAdd`/`runRemove`/`runUpdate` require a lockfile (error otherwise), re-download every kept bundle (the plan is a full re-render), and reuse the recorded answers. `runUpdate` without slugs refreshes all; with slugs only those, others keep their previous files (pass their previously installed files? — simplest correct behaviour: always re-download all installed bundles so the plan is complete; `update <slug>` differs only in that it fails fast if that slug is not installed).

- [ ] **Step 1: Fake registry helper and failing integration test**

`cli/test/helpers/registry-server.ts`: `startRegistry(): Promise<{ url: string; close(): Promise<void> }>` — `node:http` server serving `GET /api/cli/manifest` → `fixtureManifest()` with `registry` set to its own URL, `GET /api/skills/:slug/download` → `zipFixtureBundle(slug)` for `demo`, `second`, `third` (the `second`/`third` zips contain only a README and a `CLAUDE.md` with `## Skills and rules\n- <slug>\n`), 404 otherwise.

`cli/test/integration/cli.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runAdd, runDiff, runInit, runList, runRemove, runUpdate } from '../../src/run'
import { startRegistry } from '../helpers/registry-server'
import { startMarker } from '../../../shared/setup/markers'

let registry: Awaited<ReturnType<typeof startRegistry>>
beforeAll(async () => { registry = await startRegistry() })
afterAll(async () => { await registry.close() })

const common = () => ({ registry: registry.url, yes: true, force: false, json: true, interactive: false })
const read = (dir: string, rel: string) => readFile(join(dir, rel), 'utf8')

describe('@patrity/skills end to end', () => {
  it('init --yes --profile demo writes .claude, CLAUDE.md, settings and the lockfile', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skills-cli-'))
    const plan = await runInit({ ...common(), dir, profile: 'demo' })
    expect(plan.warnings).toEqual([])
    const claude = await read(dir, 'CLAUDE.md')
    expect(claude.startsWith(`# ${dir.split('/').pop()}\n`)).toBe(true)
    expect(claude).toContain('## Commands')
    expect(claude).toContain(startMarker('base:pm=pnpm'))
    expect(claude).toContain(startMarker('bundle:demo'))
    expect(claude).toContain(startMarker('bundle:second'))       // suggested by demo
    expect((await stat(join(dir, '.claude/hooks/pre-commit.sh'))).mode & 0o111).toBeTruthy()
    expect(await read(dir, '.claude/rules/demo.md')).toContain('"app/**/*.vue"')
    expect(JSON.parse(await read(dir, '.claude/settings.json')).permissions.deny).toEqual(['Bash(rm -rf:*)'])
    expect(JSON.parse(await read(dir, '.claude/settings.local.json')).permissions.allow).toEqual(['Bash(echo:*)'])
    expect(await read(dir, '.gitignore')).toContain('.claude/settings.local.json')
    const lock = JSON.parse(await read(dir, '.claude/skills.lock.json'))
    expect(Object.keys(lock.bundles).sort()).toEqual(['demo', 'second'])
    expect(lock.answers).toMatchObject({ pm: 'pnpm', browser: 'none' })
  })

  it('is idempotent and honours --answer and --with', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skills-cli-'))
    const answers = ['pm=npm', 'layout=monorepo', 'appDir=apps/site/app', 'browser=cli']
    await runInit({ ...common(), dir, answers, with: ['third'] })
    const first = await read(dir, 'CLAUDE.md')
    expect(first).toContain(startMarker('base:pm=npm'))
    expect(first).toContain('`apps/site/app`')
    expect(first).toContain(startMarker('bundle:third'))
    expect(first).toContain(startMarker('bundle:second'))            // dependency of third
    expect(first).not.toContain('bundle:demo')                         // only pm=pnpm selects demo
    await expect(stat(join(dir, '.claude/rules/demo.md'))).rejects.toThrow()
    expect(await read(dir, `.claude/skills/${dir.split('/').pop()}-browser-testing/SKILL.md`)).toContain('Browser testing for')
    const lock1 = await read(dir, '.claude/skills.lock.json')
    await runInit({ ...common(), dir, answers, with: ['third'] })
    expect(await read(dir, 'CLAUDE.md')).toBe(first)
    expect(await read(dir, '.claude/skills.lock.json')).toBe(lock1)
  })

  it('add, remove, diff and list work off the lockfile', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skills-cli-'))
    await runInit({ ...common(), dir, profile: 'demo' })
    await runAdd({ ...common(), dir, slugs: ['third'] })
    expect(await read(dir, 'CLAUDE.md')).toContain(startMarker('bundle:third'))
    const list = await runList({ ...common(), dir })
    expect(list.bundles).toEqual(['demo', 'second', 'third'])

    await writeFile(join(dir, '.claude/rules/demo.md'), 'hand edited\n')
    const diff = await runDiff({ ...common(), dir })
    expect(diff.modified).toEqual(['.claude/rules/demo.md'])

    await expect(runUpdate({ ...common(), dir })).resolves.toMatchObject({ files: expect.arrayContaining([expect.objectContaining({ path: '.claude/rules/demo.md', action: 'protected' })]) })
    expect(await read(dir, '.claude/rules/demo.md')).toBe('hand edited\n')
    await runUpdate({ ...common(), dir, force: true })
    expect(await read(dir, '.claude/rules/demo.md')).toContain('# Demo rule')

    await runRemove({ ...common(), dir, slugs: ['third'] })
    expect(await read(dir, 'CLAUDE.md')).not.toContain('bundle:third')
    expect((await runList({ ...common(), dir })).bundles).toEqual(['demo', 'second'])
  })

  it('refuses add/remove/update without a lockfile and reports unknown slugs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skills-cli-'))
    await expect(runAdd({ ...common(), dir, slugs: ['demo'] })).rejects.toThrow(/no \.claude\/skills\.lock\.json/)
    await runInit({ ...common(), dir, profile: 'demo' })
    await expect(runAdd({ ...common(), dir, slugs: ['ghost'] })).rejects.toThrow(/unknown bundle: ghost/)
  })
})
```
- [ ] **Step 2: Implement `apply.ts`, `run.ts`, commands, `index.ts`**

`cli/src/apply.ts`:
```ts
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { LOCKFILE_PATH, serializeLockfile } from './lockfile'
import type { SetupPlan } from './plan'

function inside(dir: string, rel: string): string {
  const abs = resolve(dir, rel)
  if (!abs.startsWith(`${resolve(dir)}/`)) throw new Error(`refusing to write outside the project: ${rel}`)
  return abs
}

async function write(dir: string, rel: string, data: Uint8Array | string, mode?: number) {
  const abs = inside(dir, rel)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, data)
  if (mode) await chmod(abs, mode)
}

export async function applyPlan(plan: SetupPlan, dir: string, opts: { overwrite?: Set<string> } = {}): Promise<{ written: string[], removed: string[], skipped: string[] }> {
  const written: string[] = []
  const skipped: string[] = []
  for (const op of plan.files) {
    const go = op.action === 'create' || op.action === 'update' || (op.action === 'conflict' && opts.overwrite?.has(op.path))
    if (!go) { if (op.action !== 'unchanged') skipped.push(op.path); continue }
    await write(dir, op.path, op.bytes, op.mode)
    written.push(op.path)
  }
  for (const rel of plan.removals) { await rm(inside(dir, rel), { force: true }); }
  if (plan.claudeMd.changed) { await write(dir, 'CLAUDE.md', plan.claudeMd.content); written.push('CLAUDE.md') }
  if (plan.settings?.changed) { await write(dir, '.claude/settings.json', plan.settings.content); written.push('.claude/settings.json') }
  if (plan.settingsLocal?.changed) { await write(dir, '.claude/settings.local.json', plan.settingsLocal.content); written.push('.claude/settings.local.json') }
  if (plan.gitignore?.changed) { await write(dir, '.gitignore', plan.gitignore.content); written.push('.gitignore') }
  await write(dir, LOCKFILE_PATH, serializeLockfile(plan.lock))
  return { written, removed: plan.removals, skipped }
}
```

`cli/src/run.ts` — the shared flow:
```ts
import { createRegistryClient, type BundleFiles } from './registry'
import { readProject } from './project'
import { buildPlan, type SetupPlan } from './plan'
import { applyPlan } from './apply'
import { applyProfile, defaultAnswers, parseAnswerFlags, preselectedBundles, resolveBundles, validateAnswers } from './wizard'
import { askAxes, askBundles, confirmPlan, resolveConflicts } from './prompts'
import { diffOwnedFiles, sha256, type Lockfile } from './lockfile'
import { findMarkerBlocks } from '../../shared/setup/markers'

export const DEFAULT_REGISTRY = 'https://skills.patrity.com'
/** --registry flag → lockfile registry → production. */
export const registryFor = (flag: string | undefined, lock: Lockfile | null) => flag || lock?.registry || DEFAULT_REGISTRY

export interface CommonOpts { dir: string, registry?: string, yes: boolean, force: boolean, json: boolean, fetchImpl?: typeof fetch, interactive?: boolean }

async function download(client: ReturnType<typeof createRegistryClient>, slugs: string[]): Promise<Record<string, BundleFiles>> {
  const out: Record<string, BundleFiles> = {}
  await Promise.all(slugs.map(async slug => { out[slug] = await client.download(slug) }))
  return out
}

async function plan(opts: CommonOpts, answers: Record<string, string>, bundles: string[]): Promise<SetupPlan> {
  const project = await readProject(opts.dir)
  const client = createRegistryClient(registryFor(opts.registry, project.lock), { fetchImpl: opts.fetchImpl })
  const manifest = await client.manifest()
  const resolved = resolveBundles(bundles, manifest.skills)
  if (resolved.missing.length) throw new Error(`unknown bundle: ${resolved.missing.join(', ')}`)
  const bundleFiles = await download(client, resolved.bundles)
  const built = await buildPlan({ manifest, project, answers, bundles: resolved.bundles, bundleFiles, force: opts.force })
  const interactive = opts.interactive ?? (!opts.yes && process.stdout.isTTY)
  const overwrite = interactive ? await resolveConflicts(built) : new Set<string>()
  if (interactive && !(await confirmPlan(built))) return built
  const result = await applyPlan(built, opts.dir, { overwrite })
  if (opts.json) console.log(JSON.stringify({ ...result, warnings: built.warnings, handEdited: built.claudeMd.handEdited }))
  return built
}

export async function runInit(opts: CommonOpts & { profile?: string, with?: string[], answers?: string[] }): Promise<SetupPlan> {
  const client = createRegistryClient(registryFor(opts.registry, null), { fetchImpl: opts.fetchImpl })
  const manifest = await client.manifest()
  if (!manifest.base) throw new Error('the registry has no base schema')
  const profile = opts.profile ? manifest.profiles.find(p => p.name === opts.profile) : undefined
  if (opts.profile && !profile) throw new Error(`unknown profile: ${opts.profile} (available: ${manifest.profiles.map(p => p.name).join(', ')})`)
  let answers = applyProfile(manifest.base, profile, defaultAnswers(manifest.base))
  answers = { ...answers, ...parseAnswerFlags(opts.answers ?? []) }
  const errors = validateAnswers(manifest.base, answers)
  if (errors.length) throw new Error(errors.join('; '))
  const interactive = opts.interactive ?? (!opts.yes && process.stdout.isTTY)
  if (interactive) answers = await askAxes(manifest.base, answers)
  let bundles = [...new Set([...preselectedBundles(manifest.base, answers, profile, manifest.skills), ...(opts.with ?? [])])]
  if (interactive) bundles = (await askBundles(manifest.skills, bundles, profile ? [] : manifest.profiles)).bundles
  return plan(opts, answers, bundles)
}

async function requireLock(dir: string) {
  const project = await readProject(dir)
  if (!project.lock) throw new Error('no .claude/skills.lock.json here — run `skills init` first')
  return project
}

export async function runAdd(opts: CommonOpts & { slugs: string[] }) {
  const p = await requireLock(opts.dir)
  return plan(opts, p.lock!.answers, [...Object.keys(p.lock!.bundles), ...opts.slugs])
}
export async function runRemove(opts: CommonOpts & { slugs: string[] }) {
  const p = await requireLock(opts.dir)
  return plan(opts, p.lock!.answers, Object.keys(p.lock!.bundles).filter(s => !opts.slugs.includes(s)))
}
export async function runUpdate(opts: CommonOpts & { slugs?: string[] }) {
  const p = await requireLock(opts.dir)
  for (const s of opts.slugs ?? []) if (!(s in p.lock!.bundles)) throw new Error(`${s} is not installed`)
  return plan(opts, p.lock!.answers, Object.keys(p.lock!.bundles))
}
export async function runDiff(opts: CommonOpts) {
  const p = await requireLock(opts.dir)
  const client = createRegistryClient(registryFor(opts.registry, p.lock), { fetchImpl: opts.fetchImpl })
  const manifest = await client.manifest({ allowErrors: true })
  const hashes = new Map<string, string>()
  const owned = [...Object.values(p.lock!.bundles).flatMap(b => Object.keys(b.files)), ...Object.keys(p.lock!.scaffolds)]
  for (const path of owned) {
    const bytes = await p.files(path)
    if (bytes) hashes.set(path, sha256(bytes))
  }
  const files = diffOwnedFiles(p.lock!, path => hashes.get(path) ?? null)
  const handEdited = (p.claudeMd ? findMarkerBlocks(p.claudeMd) : [])
    .filter(b => p.lock!.blocks[b.sourceId] && p.lock!.blocks[b.sourceId] !== sha256(b.content))
    .map(b => b.sourceId)
  const upstream = Object.entries(p.lock!.bundles).filter(([, b]) => b.sha !== manifest.sha).map(([slug, b]) => ({ slug, installed: b.sha, latest: manifest.sha }))
  const result = { ...files, upstream, handEdited }
  if (opts.json) console.log(JSON.stringify(result))
  return result
}
export async function runList(opts: CommonOpts) {
  const p = await requireLock(opts.dir)
  const client = createRegistryClient(registryFor(opts.registry, p.lock), { fetchImpl: opts.fetchImpl })
  const manifest = await client.manifest({ allowErrors: true })
  const result = { bundles: Object.keys(p.lock!.bundles).sort(), answers: p.lock!.answers, registry: p.lock!.registry, upstreamSha: manifest.sha, installedSha: Object.values(p.lock!.bundles)[0]?.sha ?? '' }
  if (opts.json) console.log(JSON.stringify(result))
  return result
}
```
`cli/src/commands/*.ts` — one file per command, e.g. `init.ts`:
```ts
import { defineCommand } from 'citty'
import { intro, outro } from '@clack/prompts'
import { runInit } from '../run'
import { commonArgs, commonOpts } from './common'

export default defineCommand({
  meta: { name: 'init', description: 'Run the setup wizard in the current project' },
  args: {
    ...commonArgs,
    profile: { type: 'string', description: 'Start from a registry profile (e.g. nuxt-app)' },
    with: { type: 'string', description: 'Comma-separated bundle slugs to add' },
    answer: { type: 'string', description: 'axis=option, repeatable' }
  },
  async run({ args }) {
    const opts = commonOpts(args)
    if (!opts.yes) intro('@patrity/skills')
    const plan = await runInit({ ...opts, profile: args.profile, with: args.with ? String(args.with).split(',').map(s => s.trim()).filter(Boolean) : [], answers: ([] as string[]).concat((args.answer as string | string[] | undefined) ?? []) })
    if (!opts.yes) outro(plan.warnings.length ? `Done with ${plan.warnings.length} warning(s).` : 'Done.')
  }
})
```
`commands/common.ts` exports `commonArgs` (`dir` string default `.`, `registry` string with NO default — `run.ts` resolves flag → lockfile → `DEFAULT_REGISTRY`, `yes` boolean, `force` boolean, `json` boolean) and `commonOpts(args)` mapping them (`dir: resolve(args.dir)`, `registry: args.registry || undefined`). `add`/`remove`/`update` take variadic slugs from `args._`; `diff`/`list` print human-readable tables when not `--json`.

`cli/src/index.ts`:
```ts
import { defineCommand, runMain } from 'citty'
import { CLI_VERSION } from './version'
import init from './commands/init'

const main = defineCommand({
  meta: { name: 'skills', version: CLI_VERSION, description: 'Assemble a Claude Code setup from skills.patrity.com' },
  args: init.args,
  subCommands: {
    init: () => import('./commands/init').then(m => m.default),
    add: () => import('./commands/add').then(m => m.default),
    remove: () => import('./commands/remove').then(m => m.default),
    update: () => import('./commands/update').then(m => m.default),
    diff: () => import('./commands/diff').then(m => m.default),
    list: () => import('./commands/list').then(m => m.default)
  },
  run: init.run   // bare `skills` == `skills init`
})

runMain(main)
```

- [ ] **Step 3: Run the integration suite and the unit suite**

`pnpm --filter @patrity/skills test` → all PASS. `pnpm --filter @patrity/skills typecheck && pnpm --filter @patrity/skills lint && pnpm cli:build`. Manual: with the registry dev server running (`PORT=3210 pnpm dev` at the repo root, after Plan A is merged), in a scratch dir `node <repo>/cli/dist/index.js --registry http://localhost:3210` and walk the wizard once; then `--yes --profile nuxt-app`; open the result in Claude Code and confirm the rules load.

- [ ] **Step 4: Commit**

```bash
git add cli
git commit -m "feat(cli): init/add/remove/update/diff/list commands with an end-to-end suite"
```

---

### Task 8: Release pipeline

**Files:**
- Create: `.github/workflows/release-cli.yml`
- Modify: `cli/README.md` (full usage), `content/docs/cli.md` (link to npm), root `README.md` (CLI section)

- [ ] **Step 1: Workflow**

`.github/workflows/release-cli.yml`:
```yaml
name: release-cli
on:
  push:
    tags: ['cli-v*']
permissions:
  contents: read
  id-token: write   # npm provenance
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with: { node-version: 22, cache: pnpm, registry-url: https://registry.npmjs.org }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @patrity/skills test
      - run: pnpm --filter @patrity/skills build
      - name: Check the tag matches package.json
        run: |
          v=$(node -p "require('./cli/package.json').version")
          [ "cli-v$v" = "${GITHUB_REF_NAME}" ] || { echo "tag ${GITHUB_REF_NAME} != cli-v$v"; exit 1; }
      - run: cd cli && npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
Repo secret needed (user): `NPM_TOKEN` (an npm automation token for the `@patrity` scope).

- [ ] **Step 2: Docs**

`cli/README.md`: install/quick start, every command with its flags, what gets written, lockfile, updating, non-interactive examples, registry override, license. `content/docs/cli.md`: add the npm badge/link and "Releases are tagged `cli-vX.Y.Z`". Root `README.md`: a "CLI" section with the one-liner.

- [ ] **Step 3: Verify and commit**

`pnpm test` (root) still green; `pnpm --filter @patrity/skills test`. Commit: `git commit -m "ci(cli): npm release workflow and CLI docs"`.

---

### Task 9: First release and production smoke (controller + user)

- [ ] **Step 1 (user):** create an npm automation token for `@patrity` and `gh secret set NPM_TOKEN --repo Patrity/skills`.
- [ ] **Step 2 (controller):** push Plan A Task 10 + Plan B; `git tag cli-v0.1.0 && git push origin cli-v0.1.0`; watch `release-cli` succeed; `npm view @patrity/skills version` → `0.1.0`.
- [ ] **Step 3 (controller):** in a scratch dir, `pnpx @patrity/skills init --yes --profile nuxt-app` against production; inspect `CLAUDE.md` (13 canonical sections in order, one heading each), `.claude/` tree, lockfile; `pnpx @patrity/skills diff` → clean; `pnpx @patrity/skills add remote-ops` and `remove remote-ops` round-trip. Open Claude Code in the dir and confirm the rules load.
- [ ] **Step 4:** record the release in `CLAUDE.md` (Production section) and MyMind.

---

## Self-review notes

- **Spec coverage:** §5.1 commands → Task 7; §5.2 merge semantics → Tasks 4 (settings), 5 (files, markers, hand-edit protection), 3 (lockfile); wizard → Task 6; §7 packaging/release → Tasks 1, 8, 9; §9 CLI testing → unit suites in 2–6, integration in 7, release smoke in 9.
- **Type consistency:** `BundleFiles` (Task 2) flows into `contributionsFor`/`buildPlan` (Task 5) and `run.ts` (Task 7); `SetupPlan` (Task 5) is what `applyPlan`/`confirmPlan` consume; `Lockfile` (Task 3) is produced by `buildPlan` and read by `readProject`; `CliManifest`/`BaseSchema`/`Profile` come from `shared/types/setup.ts` (Plan A Task 1); `composeClaudeMd`/`splitSnippet`/`findMarkerBlocks`/`placeholderVars` come from `shared/setup/*` (Plan A Tasks 1–2).
- **Known simplification:** `update <slug>` re-renders all installed bundles (a full plan) and only differs by validating the slug; per-bundle partial updates are unnecessary because the plan is idempotent.
