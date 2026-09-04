# Web Builder and Repositioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/build` page that runs the CLI's wizard in the browser with a live preview and downloads a zip identical to `pnpx @patrity/skills init`, teach bundles to declare gitignore entries and `.claude/.env` variables, and reframe the site, README and docs as Tony's opinionated Claude Code setup.

**Architecture:** The fresh-project half of the CLI planner, the contribution ordering and the pure wizard helpers move from `cli/src/` into `shared/setup/` (browser-safe: no Node imports, a pure SHA-256), so the page composes the preview in the browser and `POST /api/build` composes the zip on the server with the same code. The CLI's `buildPlan` becomes a wrapper over `planFresh` and keeps its existing-project logic and its 92 tests. Gitignore and env become frontmatter keys that flow through the manifest into a managed `.gitignore` block and a managed `.claude/.env.example`, written identically by the CLI and the zip.

**Tech Stack:** Nuxt 4.5 / Nuxt UI 4 / Nitro, TypeScript, zod 4, vitest 4.1, fflate, citty + @clack/prompts (CLI), `playwright-cli` for browser checks, the `humanizer` skill for copy.

**Spec:** `docs/superpowers/specs/2026-09-04-web-builder-and-repositioning-design.md` (§4 page, §5 shared planner + build route, §6 caching/analytics, §7 copy, §8 testing, §10 gitignore + env). Prior specs: `2026-09-03-composable-setups-and-cli-design.md`, `2026-09-03-skills-repository-design.md`.

## Global Constraints

- pnpm only; conventional commits; no `Co-Authored-By`/`Claude-Session`/model references (check `git log -1 --format=%B`). Do not push; the controller pushes.
- `shared/**` and `server/lib/**` use relative imports only and `shared/setup/**` must contain no Node-only import (`node:*`, `fs`, `path`, `crypto`) — the browser bundles it. Nitro routes and app code may use `~~/`.
- CLI: `cli/` imports `../../shared/**` relatively; the CLI's existing 92 tests (`pnpm --filter @patrity/skills test`) must pass unchanged after the move; `cli/package.json` version becomes `0.2.0` in the last task only.
- Managed `.gitignore` block, exact lines: `# >>> skills (managed by @patrity/skills; edit outside this block)` … entries … `# <<< skills`. Entries sorted and de-duplicated; `.claude/settings.local.json` present whenever a local settings file is written; `.claude/.env` whenever any installed bundle declares `env`; lines outside the block never modified; when the block would be empty it is removed; CRLF files stay CRLF.
- `.claude/.env.example` is fully managed (regenerated each run), one group per bundle: `# skills: <slug>` then per variable `# <description> (required)` and `NAME=<example or empty>`. `.claude/.env` is never created, read or modified.
- Frontmatter: `gitignore: string[]` (project-relative, no `..`, not absolute, `/` suffix for directories); `env: { name, description, required?, example? }[]` with `name` matching `^[A-Z][A-Z0-9_]*$`, unique per bundle.
- `POST /api/build` and `POST /api/build/render`: not ISR, `Cache-Control: no-store`; body limits 16 KB and 256 KB; validation errors are 400 with the same wording the CLI prints (`unknown bundle: x`, `pm: "bun2" is not an option`); project name `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`.
- `/build` route rule `isr: 300` + `Vercel-Cache-Tag: skills`; state lives in the URL hash, never the query.
- Web preview and zip are byte-identical for the same input; hook scripts carry mode 0755 in the zip; zip mtime is the snapshot's `committedAt`.
- Analytics through `useAnalytics`: `setup-build-download` `{ profile, bundles, axes }`, `setup-build-copy-cli` `{ profile }`.
- Copy: every new or rewritten sentence in the hero, README and docs goes through the `humanizer` skill (`~/.claude/skills/humanizer`) before commit; no sentence promises something the code does not do.
- Nuxt UI rules that bit before: `UDashboardPanel` named slots only; `UDashboardNavbar` `#left` for the single `<h1>`; never `<MDC :value>` in the browser; `UTree` `v-model` = item object, `v-model:expanded` = key strings, `get-key` required; `UFieldGroup` not ButtonGroup.
- Port 3000 is taken locally: dev server `PORT=3210 pnpm dev`. Browser checks with `playwright-cli` only.
- Gate before every commit: `pnpm lint && pnpm typecheck && pnpm test:unit`; `pnpm --filter @patrity/skills lint && … typecheck && … test && … build` whenever `cli/` or `shared/` changed; `pnpm test` and `pnpm build` at the end of any task touching routes, `nuxt.config.ts`, `content/docs/` or the app.

---

## File structure

```
shared/setup/hash.ts                 sha256() — pure TypeScript SHA-256 (browser + Node)
shared/setup/paths.ts                isSafeBundlePath() (moved from cli/src/registry.ts)
shared/setup/contributions.ts        activeAxes(), contributionsFor(), scaffoldsFor() (moved)
shared/setup/wizard.ts               defaultAnswers(), applyProfile(), validateAnswers(), reconcileAnswers(), preselectedBundles(), resolveBundles(), groupByTag() (moved)
shared/setup/settings.ts             Json, SettingsContribution, hookIdentity(), settingsContribution(), isEmptyContribution(), subtractSettings(), mergeSettings(), splitBundleSettings(), formatJson() (moved; ensureGitignoreLine deleted)
shared/setup/lock.ts                 Lockfile types, emptyLockfile(), serializeLockfile(), parseLockfile() (moved; sha256 from hash.ts)
shared/setup/gitignore.ts            renderGitignoreBlock(existing, entries) — the managed block
shared/setup/env-example.ts          renderEnvExample(bundles) — the managed .claude/.env.example
shared/setup/plan.ts                 FileOp, SetupPlan, varsFor(), hashForSource(), planFresh()
shared/types/setup.ts                += BundleFiles, EnvVar, Lockfile/LockBundle/LockSettings re-exported types
shared/types/skills.ts               SkillFrontmatter += gitignore?, env?
server/lib/setup/manifest.ts         toCliManifest(record, registry) — shared by the manifest route, the build route and tests
server/lib/setup/setup-zip.ts        buildSetupZip(plan, mtime)
server/lib/skills/frontmatter.ts     gitignore/env in the zod schema
server/lib/skills/parse-bundle.ts    gitignore/env copied onto the manifest; shipped .env.example is an error
server/api/cli/manifest.get.ts       uses toCliManifest
server/api/build.post.ts             zip
server/api/build/render.post.ts      markdown → AST for the preview
scripts/validate-skills.ts           prints gitignore/env; shipped .env.example error
cli/src/{plan,apply,lockfile,settings,contributions,wizard,registry}.ts   thin wrappers / re-exports over shared
app/pages/build.vue                  the builder page
app/components/build/{BuildForm,AxisField,BundlePicker,SetupPreview,FilesTree}.vue
app/composables/useSetupPlan.ts      manifest + snippets + planFresh, warnings
app/composables/useBuildState.ts     hash codec (encode/decode) + URL sync
app/composables/useAnalytics.ts      += trackBuildDownload, trackBuildCopyCli
app/components/skill/SkillMetaCard.vue   Gitignore / Environment rows
app/pages/index.vue, README.md, content/docs/{start-here,philosophy,single-bundle,…}.md, content/docs/nav.ts, nuxt.config.ts (route rules, redirect)
skills/{readonly-db,doc-fetcher,nuxt,nuxt-ui}/README.md  gitignore/env declarations; readonly-db SKILL.md reads .claude/.env
test/unit/setup-{hash,gitignore,env-example,plan,manifest,setup-zip,build-state}.test.ts, test/e2e/api.test.ts, cli/test/**
```

Task order: 1 hash + paths → 2 shared move + `planFresh` → 3 frontmatter keys + validator + bundle content → 4 managed gitignore + env example (planner, CLI apply, lock) → 5 zip + build routes → 6 builder page → 7 copy reframe + docs → 8 release + verification.

---

### Task 1: Pure SHA-256 and the shared path check

**Files:**
- Create: `shared/setup/hash.ts`, `shared/setup/paths.ts`
- Modify: `cli/src/lockfile.ts` (import `sha256` from shared, drop `node:crypto`), `cli/src/registry.ts` (re-export `isSafeBundlePath` from shared), `cli/src/plan.ts` (import path check from shared)
- Test: `test/unit/setup-hash.test.ts`, `test/unit/setup-paths.test.ts`

**Interfaces:**
- Produces: `sha256(input: Uint8Array | string): string` (lowercase hex, 64 chars; strings hashed as UTF-8); `isSafeBundlePath(rel: string): boolean` with the exact semantics of the current `cli/src/registry.ts:13-22` implementation.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

`test/unit/setup-hash.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { sha256 } from '../../shared/setup/hash'

const node = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex')

describe('sha256 (pure)', () => {
  it('matches the known vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
  })
  it('agrees with node:crypto on strings, multibyte text, bytes and long inputs', () => {
    for (const s of ['x', 'héllo wörld ✓', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000)]) expect(sha256(s)).toBe(node(s))
    const bytes = new Uint8Array(70000).map((_, i) => (i * 31) & 0xff)
    expect(sha256(bytes)).toBe(node(bytes))
  })
})
```

`test/unit/setup-paths.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isSafeBundlePath } from '../../shared/setup/paths'

describe('isSafeBundlePath', () => {
  it('accepts normal nested paths and rejects escapes', () => {
    for (const ok of ['rules/demo.md', 'skills/a/b/SKILL.md', 'hooks/pre-commit.sh', '..foo', 'a..b/c']) expect(isSafeBundlePath(ok), ok).toBe(true)
    for (const bad of ['../evil', 'a/../b', '..', '..//x', '/etc/x', 'C:/x', 'x\\y', '']) expect(isSafeBundlePath(bad), bad).toBe(false)
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run test/unit/setup-hash.test.ts test/unit/setup-paths.test.ts`
Expected: FAIL — cannot find module `../../shared/setup/hash` / `paths`.

- [ ] **Step 3: Implement**

`shared/setup/hash.ts` (pure SHA-256, FIPS 180-4; no dependencies):
```ts
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

/** SHA-256 as lowercase hex. Pure TypeScript so the same hash runs in the browser and in Node. */
export function sha256(input: Uint8Array | string): string {
  const msg = typeof input === 'string' ? new TextEncoder().encode(input) : input
  const bitLen = msg.length * 8
  const padded = new Uint8Array(((msg.length + 9 + 63) >> 6) << 6)
  padded.set(msg)
  padded[msg.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000))
  view.setUint32(padded.length - 4, bitLen >>> 0)

  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }
    let a = h[0]!, b = h[1]!, c = h[2]!, d = h[3]!, e = h[4]!, f = h[5]!, g = h[6]!, hh = h[7]!
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i]! + w[i]!) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + b) >>> 0; h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0
    h[4] = (h[4]! + e) >>> 0; h[5] = (h[5]! + f) >>> 0; h[6] = (h[6]! + g) >>> 0; h[7] = (h[7]! + hh) >>> 0
  }
  return Array.from(h, x => x.toString(16).padStart(8, '0')).join('')
}
```
(If the lint config rejects the one-line assignment chain `hh = g; g = f; …`, split it onto separate lines; keep the algorithm.)

`shared/setup/paths.ts`: move the body of `isSafeBundlePath` from `cli/src/registry.ts` verbatim (its doc comment too). In `cli/src/registry.ts` replace the definition with `export { isSafeBundlePath } from '../../shared/setup/paths'`. In `cli/src/lockfile.ts` replace the `node:crypto` import and the `sha256` body with `export { sha256 } from '../../shared/setup/hash'` (keep the export so `cli/src/plan.ts`, `run.ts` and the tests keep importing it from `./lockfile`).

- [ ] **Step 4: Run tests → PASS; CLI suite unchanged**

Run: `pnpm vitest run test/unit/setup-hash.test.ts test/unit/setup-paths.test.ts` → PASS. Then `pnpm --filter @patrity/skills test` → 92 passed / 1 skipped (nothing changed behaviourally; the lock hashes are identical because both implementations are SHA-256). Then the root gate.

- [ ] **Step 5: Commit**

```bash
git add shared/setup/hash.ts shared/setup/paths.ts cli/src/lockfile.ts cli/src/registry.ts cli/src/plan.ts test/unit/setup-hash.test.ts test/unit/setup-paths.test.ts
git commit -m "feat(setup): pure sha256 and the bundle path check in shared/setup"
```

---

### Task 2: Move the planner into `shared/setup` and introduce `planFresh`

**Files:**
- Create: `shared/setup/contributions.ts`, `shared/setup/wizard.ts`, `shared/setup/settings.ts`, `shared/setup/lock.ts`, `shared/setup/plan.ts`, `server/lib/setup/manifest.ts`
- Modify: `shared/types/setup.ts` (add `BundleFiles`, re-export lock/plan types), `cli/src/contributions.ts`, `cli/src/wizard.ts`, `cli/src/settings.ts`, `cli/src/lockfile.ts`, `cli/src/plan.ts` (become wrappers/re-exports), `cli/src/registry.ts` (`BundleFiles` from shared), `server/api/cli/manifest.get.ts`
- Test: `test/unit/setup-plan.test.ts`, `test/unit/setup-manifest.test.ts`; all `cli/test/**` unchanged

**Interfaces:**
- Produces (shared):
  ```ts
  // shared/types/setup.ts
  export type BundleFiles = Record<string, Uint8Array>
  export type { Lockfile, LockBundle, LockSettings } from '../setup/lock'
  export type { FileOp, SetupPlan } from '../setup/plan'
  // shared/setup/plan.ts
  export function varsFor(manifest: CliManifest, answers: Record<string, string>, projectName: string): PlaceholderVars & Record<string, string>
  export function hashForSource(blocks: MarkerBlock[], sourceId: string): string
  export function planFresh(input: { manifest: CliManifest; projectName: string; answers: Record<string, string>; bundles: string[]; bundleFiles: Record<string, BundleFiles>; registry: string }): SetupPlan
  // server/lib/setup/manifest.ts
  export function toCliManifest(record: ManifestRecord, registry: string): CliManifest
  ```
  `planFresh` is synchronous and pure: every `FileOp.action` is `'create'`, `removals` is `[]`, `claudeMd.changed` is `true`, `handEdited` is `[]`, `settings`/`settingsLocal` are the merged bundle contributions or `null`, `gitignore` is `null` in this task (Task 4 fills it), `lock` is complete (registry, schemaVersion, projectName, answers, bundles with files + per-file `settings` contributions, scaffolds, blocks).
- Consumes: Task 1's `sha256`, `isSafeBundlePath`.
- The CLI keeps every existing import path working: `cli/src/plan.ts` re-exports `FileOp`, `SetupPlan`, `varsFor`, `hashForSource` from shared and defines `buildPlan` by delegating to `planFresh` for the fresh half; `cli/src/{contributions,wizard,settings,lockfile}.ts` become `export * from '../../shared/setup/<x>'` (plus `parseAnswerFlags` staying in `cli/src/wizard.ts` and `LOCKFILE_PATH` staying in `cli/src/lockfile.ts`).

- [ ] **Step 1: Write the failing tests**

`test/unit/setup-manifest.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createFsSource } from '../../server/lib/skills/fs-source'
import { toCliManifest } from '../../server/lib/setup/manifest'

const dir = fileURLToPath(new URL('../fixtures/skills', import.meta.url))

describe('toCliManifest', () => {
  it('projects a manifest record into the CLI manifest shape', async () => {
    const snap = await createFsSource(dir).load()
    const m = toCliManifest({ meta: snap, skills: snap.skills, base: snap.base, baseErrors: snap.baseErrors, profiles: snap.profiles, profileErrors: snap.profileErrors }, 'https://example.test/')
    expect(m.registry).toBe('https://example.test')
    expect(m.sha).toBe(snap.sha)
    expect(m.skills.map(s => s.slug)).toContain('demo')
    expect('tree' in m.skills[0]!).toBe(false)
    expect(m.base?.axes.map(a => a.id)).toEqual(['pm', 'layout', 'appDir'])
    expect(m.errors).toEqual([])
  })
})
```
(`createFsSource(...).load()` returns a `Snapshot`, which extends `SnapshotMeta` — pass it as `meta`. Private/erroring skills are filtered by `isPublicSkill`, the same rule the route uses today; import it from `server/lib/skills/store` if it lives there, otherwise move the pure predicate `isPublicSkill(skill, meta)` from `server/utils/skills.ts` into `server/lib/skills/public.ts` and have both import it.)

`test/unit/setup-plan.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { createFsSource } from '../../server/lib/skills/fs-source'
import { toCliManifest } from '../../server/lib/setup/manifest'
import { planFresh } from '../../shared/setup/plan'
import { startMarker } from '../../shared/setup/markers'
import { parseLockfile, serializeLockfile } from '../../shared/setup/lock'

const dir = fileURLToPath(new URL('../fixtures/skills', import.meta.url))
const dec = new TextDecoder()

async function load() {
  const snap = await createFsSource(dir).load()
  const manifest = toCliManifest({ meta: snap, skills: snap.skills, base: snap.base, baseErrors: snap.baseErrors, profiles: snap.profiles, profileErrors: snap.profileErrors }, 'https://example.test')
  return { manifest, files: snap.files }
}

describe('planFresh', () => {
  it('plans a fresh project: every op is create, lock is complete, CLAUDE.md is sectioned', async () => {
    const { manifest, files } = await load()
    const plan = planFresh({ manifest, projectName: 'proj', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'], bundleFiles: { demo: files.demo! }, registry: 'https://example.test' })
    expect(plan.files.every(f => f.action === 'create')).toBe(true)
    expect(plan.removals).toEqual([])
    expect(plan.claudeMd.handEdited).toEqual([])
    expect(plan.claudeMd.content.startsWith('# proj\n')).toBe(true)
    expect(plan.claudeMd.content).toContain(startMarker('base:pm=pnpm'))
    expect(plan.claudeMd.content).toContain(startMarker('bundle:demo'))
    expect(plan.lock.registry).toBe('https://example.test')
    expect(plan.lock.projectName).toBe('proj')
    expect(Object.keys(plan.lock.bundles)).toEqual(['demo'])
    for (const f of plan.files) if (f.owner === 'bundle:demo') expect(plan.lock.bundles.demo!.files[f.path]).toMatch(/^[0-9a-f]{64}$/)
    expect(Object.keys(plan.lock.blocks).length).toBeGreaterThan(0)
    // Round-trips through the lock codec byte for byte.
    const text = serializeLockfile(plan.lock)
    expect(serializeLockfile(parseLockfile(text))).toBe(text)
  })
  it('is deterministic and renders placeholders in text files but not binary ones', async () => {
    const { manifest, files } = await load()
    const input = { manifest, projectName: 'proj', answers: { pm: 'npm', layout: 'monorepo', appDir: 'apps/web/app' }, bundles: ['demo'], bundleFiles: { demo: { ...files.demo!, 'skills/demo/bin.dat': new Uint8Array([0, 1, 2, 0]) } }, registry: 'r' }
    const a = planFresh(input)
    const b = planFresh(input)
    expect(serializeLockfile(a.lock)).toBe(serializeLockfile(b.lock))
    expect(a.claudeMd.content).toBe(b.claudeMd.content)
    const rule = a.files.find(f => f.path.endsWith('.md') && dec.decode(f.bytes).includes('apps/web/app'))
    expect(rule, 'a text file rendered {{appDir}}').toBeDefined()
    expect(a.files.find(f => f.path.endsWith('bin.dat'))!.bytes).toEqual(new Uint8Array([0, 1, 2, 0]))
  })
  it('warns instead of throwing on a malformed settings.json and an unsafe path', async () => {
    const { manifest, files } = await load()
    const enc = new TextEncoder()
    const plan = planFresh({ manifest, projectName: 'p', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'], bundleFiles: { demo: { ...files.demo!, 'settings.json': enc.encode('{ bad'), '../x.md': enc.encode('x') } }, registry: 'r' })
    expect(plan.warnings).toEqual(expect.arrayContaining([expect.stringContaining('demo/settings.json: not valid JSON'), 'demo/../x.md: unsafe path, skipped']))
    expect(plan.files.some(f => f.path.includes('..'))).toBe(false)
  })
})
```
(The `demo` fixture bundle must contain at least one text file with `{{appDir}}`; `test/fixtures/skills/demo/rules/*.md` does — check with `grep -r appDir test/fixtures/skills/demo`; if it does not, add `paths: ["{{appDir}}/**/*.vue"]` to a fixture rule's frontmatter and keep the e2e suite green.)

- [ ] **Step 2: Run → FAIL** (modules missing).

- [ ] **Step 3: Move the modules**

Use `git mv` so history follows:
```bash
git mv cli/src/contributions.ts shared/setup/contributions.ts
git mv cli/src/settings.ts shared/setup/settings.ts
```
Then fix their imports to be relative within `shared/` (`../types/setup`, `./sections`, `./placeholders`, `./render`, `./paths`). Delete `ensureGitignoreLine` from `shared/setup/settings.ts` (Task 4 replaces it; until then `cli/src/plan.ts` keeps a private copy of the three-line helper so the CLI's behaviour is unchanged in this task).

`shared/setup/wizard.ts`: create with the bodies of `defaultAnswers`, `applyProfile`, `validateAnswers`, `reconcileAnswers`, `preselectedBundles`, `resolveBundles`, `groupByTag` cut from `cli/src/wizard.ts`; `cli/src/wizard.ts` keeps only `parseAnswerFlags` plus `export * from '../../shared/setup/wizard'`.

`shared/setup/lock.ts`: create with everything from `cli/src/lockfile.ts` except `LOCKFILE_PATH` and the Node-only bits (there are none after Task 1; `sha256` comes from `./hash`). `cli/src/lockfile.ts` becomes:
```ts
export const LOCKFILE_PATH = '.claude/skills.lock.json'
export * from '../../shared/setup/lock'
```

`cli/src/contributions.ts` and `cli/src/settings.ts` become one-line re-exports (`export * from '../../shared/setup/contributions'` etc.) so `cli/src/run.ts`, `prompts.ts` and the CLI tests compile unchanged. `cli/src/registry.ts`: `export type { BundleFiles } from '../../shared/types/setup'` and drop its local definition.

`shared/types/setup.ts`: append
```ts
export type BundleFiles = Record<string, Uint8Array>
export type { Lockfile, LockBundle, LockSettings } from '../setup/lock'
export type { FileOp, SetupPlan } from '../setup/plan'
```
(`shared/setup/lock.ts` imports `SettingsContribution` from `./settings`; `shared/setup/plan.ts` imports types from `../types/setup` — that is a type-only cycle, which TypeScript allows; keep the `import type`.)

- [ ] **Step 4: Split `buildPlan` into `planFresh` + the CLI wrapper**

`shared/setup/plan.ts` — take the current `cli/src/plan.ts` and turn it into the fresh-project planner. Keep, unchanged: `FileOp`, `SetupPlan`, `SKIP`, `byKey`, `isBinary`, `hashForSource`, `sourceIds`, `varsFor`, `settingsFile` (renamed export `settingsFileFor`), the `readSettings` closure, the bundle loop, the scaffold loop, the contributions/`composeClaudeMd` step, the settings merge. Remove: `ProjectState`, `classify`, the `prev`/`force` logic, removals, hand-edit detection, `strip`, `sectionOfBlock`, the gitignore line. The signature and body shape:
```ts
export function planFresh(input: {
  manifest: CliManifest
  projectName: string
  answers: Record<string, string>
  bundles: string[]
  bundleFiles: Record<string, BundleFiles>
  registry: string
}): SetupPlan {
  const { manifest, projectName, answers, bundles, bundleFiles, registry } = input
  const warnings: string[] = []
  const vars = varsFor(manifest, answers, projectName)
  const lock = emptyLockfile({ registry, schemaVersion: manifest.base?.version ?? 0, projectName, answers })
  const files: FileOp[] = []
  let shared: Json = {}
  let local: Json = {}
  // … bundle loop exactly as today, but every op is { action: 'create' } and every path is recorded in lock.bundles[slug].files …
  // … scaffold loop exactly as today, action 'create', recorded in lock.scaffolds …
  const { contributions, warnings: cw } = contributionsFor({ manifest, answers, bundles, bundleFiles, vars })
  warnings.push(...cw)
  const sections = manifest.base?.sections
  const claudeMd = composeClaudeMd(null, { title: projectName, sections, contributions })
  const composed = findMarkerBlocks(claudeMd)
  for (const id of sourceIds(composed)) lock.blocks[id] = hashForSource(composed, id)
  const settings = settingsFileFor(null, shared)
  const settingsLocal = settingsFileFor(null, local)
  return {
    files, removals: [],
    claudeMd: { content: claudeMd, changed: true, handEdited: [] },
    settings, settingsLocal,
    gitignore: null,
    lock, warnings
  }
}
```
`settingsFileFor(existing, next)` is today's `settingsFile` exported.

`cli/src/plan.ts` — keeps `buildPlan(input)` with the same signature and behaviour. Implement it by calling `planFresh` for the rendered artefacts and then overlaying the existing-project logic on the result:
```ts
import { planFresh, hashForSource, varsFor, settingsFileFor, type FileOp, type SetupPlan } from '../../shared/setup/plan'
export { hashForSource, varsFor }
export type { FileOp, SetupPlan }

export async function buildPlan(input: { manifest, registry, project, answers, bundles, bundleFiles, force? }): Promise<SetupPlan> {
  const { manifest, registry, project, answers, bundles, bundleFiles, force = false } = input
  const fresh = planFresh({ manifest, projectName: project.name, answers, bundles, bundleFiles, registry })
  const warnings = [...fresh.warnings]
  const prev = project.lock
  const lock = fresh.lock   // mutate: re-record hashes per classification below
  // 1. classify every fresh op against disk + prev lock (create/update/unchanged/conflict/protected) — today's `classify`;
  //    scaffolds: 'update' && !force → 'protected'; conflict → drop the lock entry; protected → keep prev hash.
  // 2. removals — today's loop, unchanged.
  // 3. CLAUDE.md — recompute with `composeClaudeMd(project.claudeMd, …)` and today's hand-edit logic; replace fresh.claudeMd and fresh.lock.blocks.
  // 4. settings — today's strip/merge against project.settings / project.settingsLocal; replace fresh.settings / fresh.settingsLocal.
  // 5. gitignore — today's ensureGitignoreLine (private copy until Task 4).
  return { ...fresh, files, removals, claudeMd, settings, settingsLocal, gitignore, lock, warnings }
}
```
Write it fully (the comments above name the blocks to keep from the current file; move them, do not paraphrase them). The bundle/scaffold *rendering* now happens once in `planFresh`; the CLI only classifies and re-records. To classify, iterate `fresh.files` (each already has `path`, `bytes`, `owner`, `mode`) and for bundle ops look up `prev?.bundles[slug]?.files[path]` (slug from `owner.replace('bundle:', '')`), for scaffold ops `prev?.scaffolds[path]`.

`server/lib/setup/manifest.ts`:
```ts
import type { CliManifest } from '../../../shared/types/setup'
import type { ManifestRecord } from '../skills/store'
import { isPublicSkill } from '../skills/public'

/** The CLI-facing projection of a manifest record: public summaries without trees, base, profiles, errors. */
export function toCliManifest(record: ManifestRecord, registry: string): CliManifest {
  const { meta, skills, base, baseErrors, profiles, profileErrors } = record
  return {
    ...meta,
    registry: registry.replace(/\/$/, ''),
    base,
    profiles,
    skills: skills.filter(s => isPublicSkill(s, meta)).map(({ tree: _tree, ...summary }) => summary),
    errors: [...baseErrors, ...profileErrors]
  }
}
```
`server/api/cli/manifest.get.ts` becomes `return toCliManifest(await getManifestsOr503(), useRuntimeConfig().public.siteUrl)`.

- [ ] **Step 5: Run everything**

`pnpm vitest run test/unit/setup-plan.test.ts test/unit/setup-manifest.test.ts` → PASS. `pnpm --filter @patrity/skills test` → 92 passed / 1 skipped, unchanged (this is the regression net for the move; do not edit CLI tests to make them pass — if one fails, the wrapper is wrong). `pnpm --filter @patrity/skills build` and inspect `cli/dist/index.js`: `shared/setup/*` still bundled, no `node:crypto` import remains. Root gate. `pnpm test` (the manifest route changed).

- [ ] **Step 6: Commit**

```bash
git add shared cli server test
git commit -m "refactor(setup): move the fresh-project planner, wizard helpers and lock codec into shared/setup"
```

---

### Task 3: `gitignore` and `env` frontmatter keys, validator checks, bundle declarations

**Files:**
- Modify: `shared/types/skills.ts` (`SkillFrontmatter` += `gitignore?: string[]`, `env?: EnvVar[]`), `shared/types/setup.ts` (`EnvVar`), `server/lib/skills/frontmatter.ts` (zod), `server/lib/skills/parse-bundle.ts` (copy onto manifest; shipped `.env.example` error), `scripts/validate-skills.ts` (print), `app/components/skill/SkillMetaCard.vue` (two rows), `cli/test/fixtures/manifest.json` (demo declares both keys for later tasks), `test/fixtures/skills/demo/README.md` (declares both keys)
- Modify content: `skills/readonly-db/README.md` + `skills/readonly-db/skills/readonly-db/SKILL.md`, `skills/doc-fetcher/README.md`, `skills/nuxt/README.md` (three cache dirs: `nuxt-docs`, `nuxt-ui-templates`; `nuxt-ui` bundle owns `nuxt-ui-docs`), `skills/nuxt-ui/README.md`
- Test: `test/unit/frontmatter.test.ts`, `test/unit/parse-bundle.test.ts`, `test/e2e/api.test.ts` (summary carries the keys)

**Interfaces:**
- Produces: `EnvVar { name: string; description: string; required?: boolean; example?: string }` in `shared/types/setup.ts`; `SkillFrontmatter.gitignore?: string[]`, `SkillFrontmatter.env?: EnvVar[]` (so `SkillSummary`/`CliManifest.skills[]` carry them). Validation error strings, exact: `frontmatter.gitignore.<i>: must be a project-relative path (no leading /, no .. segment)`, `frontmatter.gitignore.<i>: a directory entry must end with /` is NOT enforced (a file entry is legal; only `..`/absolute are rejected — the spec's "trailing `/` for directories" is a convention documented in Task 7), `frontmatter.env.<i>.name: must match ^[A-Z][A-Z0-9_]*$`, `frontmatter.env: duplicate name <NAME>`, and the bundle error `.env.example: declare variables with the env frontmatter key instead of shipping a file`.
- Consumes: nothing new.

- [ ] **Step 1: Failing tests**

Append to `test/unit/frontmatter.test.ts`:
```ts
  it('accepts gitignore and env declarations and rejects bad shapes', () => {
    const ok = parseFrontmatter(`---\nname: X\ndescription: d\ntags: [t]\nauthor: a\ngitignore: [".claude/skills/x/cache/"]\nenv:\n  - { name: API_KEY, description: key, required: true, example: "<key>" }\n---\n`)
    expect(ok.errors).toEqual([])
    expect(ok.data?.gitignore).toEqual(['.claude/skills/x/cache/'])
    expect(ok.data?.env).toEqual([{ name: 'API_KEY', description: 'key', required: true, example: '<key>' }])
    const bad = parseFrontmatter(`---\nname: X\ndescription: d\ntags: [t]\nauthor: a\ngitignore: ["../x", "/abs"]\nenv:\n  - { name: lower, description: d }\n  - { name: DUP, description: d }\n  - { name: DUP, description: d }\n---\n`)
    expect(bad.errors).toEqual([
      'frontmatter.gitignore.0: must be a project-relative path (no leading /, no .. segment)',
      'frontmatter.gitignore.1: must be a project-relative path (no leading /, no .. segment)',
      'frontmatter.env.0.name: must match ^[A-Z][A-Z0-9_]*$',
      'frontmatter.env: duplicate name DUP'
    ])
  })
```

Append to `test/unit/parse-bundle.test.ts` (use the file's existing `bundle()`/`enc` helpers; adapt names to what is there):
```ts
  it('copies gitignore/env onto the manifest and rejects a shipped .env.example', () => {
    const files = {
      'README.md': enc('---\nname: X\ndescription: d\ntags: [t]\nauthor: a\ngitignore: [".claude/skills/x/cache/"]\nenv: [{ name: A, description: d }]\n---\n'),
      '.env.example': enc('A=\n')
    }
    const m = parseBundle('x', files)
    expect(m.gitignore).toEqual(['.claude/skills/x/cache/'])
    expect(m.env).toEqual([{ name: 'A', description: 'd' }])
    expect(m.errors).toContain('.env.example: declare variables with the env frontmatter key instead of shipping a file')
  })
```

In `test/e2e/api.test.ts`, in the `/api/skills` describe, add: `expect(res.skills.find(s => s.slug === 'demo')).toMatchObject({ gitignore: ['.claude/skills/demo-skill/cache/'], env: [{ name: 'DEMO_TOKEN', description: 'Token the demo skill sends.', required: false, example: '<token>' }] })` after adding those two keys to `test/fixtures/skills/demo/README.md`.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

`shared/types/setup.ts`:
```ts
/** A variable a bundle reads from `.claude/.env`; the tool writes it into `.claude/.env.example`. */
export interface EnvVar { name: string, description: string, required?: boolean, example?: string }
```
`shared/types/skills.ts` (`SkillFrontmatter`): `import type { EnvVar } from './setup'` and
```ts
  /** Project-relative paths the tool adds to the managed block in the project's .gitignore. */
  gitignore?: string[]
  /** Variables the bundle's skills read from .claude/.env. */
  env?: EnvVar[]
```
`server/lib/skills/frontmatter.ts`:
```ts
export const ENV_NAME_RE = /^[A-Z][A-Z0-9_]*$/
const relativePath = z.string().min(1).refine(p => !p.startsWith('/') && !/(^|\/)\.\.(\/|$)/.test(p) && !/^[A-Za-z]:/.test(p) && !p.includes('\\'), { message: 'must be a project-relative path (no leading /, no .. segment)' })
const envVar = z.object({
  name: z.string().regex(ENV_NAME_RE, { message: 'must match ^[A-Z][A-Z0-9_]*$' }),
  description: z.string().min(1),
  required: z.boolean().optional(),
  example: z.string().optional()
})
// in frontmatterSchema:
  gitignore: z.array(relativePath).optional(),
  env: z.array(envVar).optional().refine(list => !list || new Set(list.map(v => v.name)).size === list.length, list => ({ message: `duplicate name ${list?.find((v, i) => list.findIndex(o => o.name === v.name) !== i)?.name}` }))
```
(zod 4: `refine` with a function message receives the value; if your installed zod's `refine` signature differs, use `superRefine` and `ctx.addIssue({ code: 'custom', message, path: [] })` so the error key renders as `frontmatter.env`.)

`server/lib/skills/parse-bundle.ts`: beside `dependsOn: fm?.dependsOn, suggests: fm?.suggests,` add `gitignore: fm?.gitignore, env: fm?.env,`; in the per-file loop, `if (rel.toLowerCase() === '.env.example') manifest.errors.push('.env.example: declare variables with the env frontmatter key instead of shipping a file')`.

`scripts/validate-skills.ts`: after the badge line print `    gitignore: <entries>` and `    env: <NAME (required)>, …` when present.

`app/components/skill/SkillMetaCard.vue`: two more `<div>`s after "Requires", same markup:
```vue
        <div v-if="skill.gitignore?.length">
          <dt class="text-xs text-muted">Gitignore</dt>
          <dd class="font-mono text-xs">{{ skill.gitignore.join(', ') }}</dd>
        </div>
        <div v-if="skill.env?.length">
          <dt class="text-xs text-muted">Environment</dt>
          <dd class="font-mono text-xs">{{ skill.env.map(v => v.name).join(', ') }}</dd>
        </div>
```

Content declarations (README frontmatter):
- `skills/readonly-db/README.md`: `env: [{ name: DATABASE_URL_RO, description: "Read-only Postgres connection string for the db:q runner. Point it at a replica or a dedicated read-only role.", required: true, example: "postgres://<app>_claude_ro:<password>@<host>/<database>" }]`. In `skills/readonly-db/skills/readonly-db/SKILL.md`, the runner section: the `db:q` script loads `.claude/.env` explicitly — for the shell runner `set -a; . "${CLAUDE_PROJECT_DIR:-.}/.claude/.env"; set +a` before using `$DATABASE_URL_RO`, and one sentence: "The runner reads `.claude/.env`, never the repo root `.env`, so a project can point Claude at a different database than the app uses."
- `skills/doc-fetcher/README.md`: `gitignore: [".claude/skills/doc-fetcher/cache/"]` (the template's `CACHE_DIR = SCRIPT_DIR / "cache"`).
- `skills/nuxt/README.md`: `gitignore: [".claude/skills/nuxt-docs/cache/", ".claude/skills/nuxt-ui-templates/cache/"]` — confirm both `fetch.py` files use `SCRIPT_DIR / "cache"` (grep `CACHE_DIR`); if `nuxt-ui-templates` lives in the `nuxt-ui` bundle instead, move that entry there.
- `skills/nuxt-ui/README.md`: `gitignore: [".claude/skills/nuxt-ui-docs/cache/"]`.
- `test/fixtures/skills/demo/README.md`: `gitignore: [".claude/skills/demo-skill/cache/"]` and `env: [{ name: DEMO_TOKEN, description: "Token the demo skill sends.", required: false, example: "<token>" }]`.
- `cli/test/fixtures/manifest.json`: give the `demo` summary the same `gitignore` and `env` values (Task 4's CLI tests rely on them).

- [ ] **Step 4: Run → PASS.** Root gate + `pnpm validate:skills` (must exit 0, shows the new lines for readonly-db, doc-fetcher, nuxt, nuxt-ui) + `pnpm test` (e2e changed) + `pnpm --filter @patrity/skills test` (fixture changed; still green).

- [ ] **Step 5: Commit**

```bash
git add shared server scripts app/components/skill/SkillMetaCard.vue skills test cli/test/fixtures/manifest.json
git commit -m "feat(registry): gitignore and env frontmatter keys with validation and bundle declarations"
```

---

### Task 4: Managed `.gitignore` block and `.claude/.env.example`

**Files:**
- Create: `shared/setup/gitignore.ts`, `shared/setup/env-example.ts`
- Modify: `shared/setup/plan.ts` (`planFresh` fills `gitignore` and a new `envExample` field; lock records `gitignore`/`env` per bundle), `shared/setup/lock.ts` (`LockBundle.gitignore?: string[]`, `LockBundle.env?: string[]`; `Lockfile.envExample?: string` hash of the last written example), `cli/src/plan.ts` (`buildPlan` uses the block and the example; drops the private `ensureGitignoreLine`), `cli/src/apply.ts` (writes/removes `.claude/.env.example`), `cli/src/project.ts` (reads `.claude/.env.example`), `cli/src/run.ts` (nothing, unless `RunResult` reporting needs the new file), `cli/README.md` + `content/docs/cli.md` (one paragraph each: the managed block and the example file — full docs pass is Task 7)
- Test: `test/unit/setup-gitignore.test.ts`, `test/unit/setup-env-example.test.ts`, `test/unit/setup-plan.test.ts` (extend), `cli/test/unit/plan.test.ts` (extend), `cli/test/integration/cli.test.ts` (extend)

**Interfaces:**
- Produces:
  ```ts
  // shared/setup/gitignore.ts
  export const GITIGNORE_START = '# >>> skills (managed by @patrity/skills; edit outside this block)'
  export const GITIGNORE_END = '# <<< skills'
  export function renderGitignoreBlock(existing: string | null, entries: string[]): string | null   // null = no file needed (no existing content and no entries)
  export function gitignoreEntries(plan: { settingsLocal: unknown | null, lock: Lockfile }): string[]   // '.claude/settings.local.json' when settingsLocal, '.claude/.env' when any bundle has env, plus every bundle's gitignore entries; sorted, unique
  // shared/setup/env-example.ts
  export function renderEnvExample(bundles: { slug: string, env: EnvVar[] }[]): string | null   // null when no bundle declares env
  // shared/setup/plan.ts — SetupPlan gains
  envExample: { content: string, changed: boolean } | null   // content of .claude/.env.example; `changed` vs the project's current file
  envExampleRemove: boolean                                   // true when the project has an example the tool wrote and no bundle declares env any more
  ```
- Consumes: Task 3's `EnvVar`/frontmatter keys via `manifest.skills[].gitignore/env`; Task 2's `planFresh`.

- [ ] **Step 1: Failing tests**

`test/unit/setup-gitignore.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { GITIGNORE_END, GITIGNORE_START, renderGitignoreBlock } from '../../shared/setup/gitignore'

const block = (entries: string[]) => [GITIGNORE_START, ...entries, GITIGNORE_END].join('\n')

describe('renderGitignoreBlock', () => {
  it('appends a block after one blank line to an existing file and keeps user lines', () => {
    expect(renderGitignoreBlock('node_modules\n.env', ['.claude/.env', '.claude/settings.local.json'])).toBe(`node_modules\n.env\n\n${block(['.claude/.env', '.claude/settings.local.json'])}\n`)
  })
  it('creates the file when there is none, sorted and de-duplicated', () => {
    expect(renderGitignoreBlock(null, ['b/', 'a', 'b/'])).toBe(`${block(['a', 'b/'])}\n`)
  })
  it('regenerates an existing block in place and leaves lines around it alone', () => {
    const before = `node_modules\n${block(['old'])}\n# mine\n`
    expect(renderGitignoreBlock(before, ['new'])).toBe(`node_modules\n${block(['new'])}\n# mine\n`)
  })
  it('removes the block (and the blank line it added) when there are no entries', () => {
    expect(renderGitignoreBlock(`node_modules\n\n${block(['x'])}\n`, [])).toBe('node_modules\n')
    expect(renderGitignoreBlock(null, [])).toBeNull()
    expect(renderGitignoreBlock('', [])).toBe('')
  })
  it('preserves CRLF and a missing trailing newline', () => {
    expect(renderGitignoreBlock('a\r\nb', ['x'])).toBe(`a\r\nb\r\n\r\n${block(['x']).replace(/\n/g, '\r\n')}\r\n`)
  })
  it('is idempotent', () => {
    const once = renderGitignoreBlock('a\n', ['x', 'y'])!
    expect(renderGitignoreBlock(once, ['x', 'y'])).toBe(once)
  })
})
```

`test/unit/setup-env-example.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { renderEnvExample } from '../../shared/setup/env-example'

describe('renderEnvExample', () => {
  it('renders one group per bundle, sorted by slug, with required markers and examples', () => {
    expect(renderEnvExample([
      { slug: 'zeta', env: [{ name: 'Z_KEY', description: 'Zeta key.' }] },
      { slug: 'readonly-db', env: [{ name: 'DATABASE_URL_RO', description: 'Read-only connection string.', required: true, example: 'postgres://<app>_claude_ro:<password>@<host>/<db>' }] }
    ])).toBe([
      '# Copy this file to .claude/.env and fill in the values. .claude/.env is gitignored; skills read it, never the repo root .env.',
      '',
      '# skills: readonly-db',
      '# Read-only connection string. (required)',
      'DATABASE_URL_RO=postgres://<app>_claude_ro:<password>@<host>/<db>',
      '',
      '# skills: zeta',
      '# Zeta key.',
      'Z_KEY=',
      ''
    ].join('\n'))
  })
  it('returns null when no bundle declares env', () => {
    expect(renderEnvExample([{ slug: 'a', env: [] }])).toBeNull()
  })
})
```

Extend `test/unit/setup-plan.test.ts`:
```ts
  it('fills the managed gitignore block and the env example from the bundles', async () => {
    const { manifest, files } = await load()
    const plan = planFresh({ manifest, projectName: 'p', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'], bundleFiles: { demo: files.demo! }, registry: 'r' })
    expect(plan.gitignore!.content).toBe(`${GITIGNORE_START}\n.claude/.env\n.claude/settings.local.json\n.claude/skills/demo-skill/cache/\n${GITIGNORE_END}\n`)
    expect(plan.envExample!.content).toContain('# skills: demo\n# Token the demo skill sends.\nDEMO_TOKEN=<token>\n')
    expect(plan.lock.bundles.demo).toMatchObject({ gitignore: ['.claude/skills/demo-skill/cache/'], env: ['DEMO_TOKEN'] })
  })
```
(`demo` ships `settings.json` with `permissions.allow`, so `settingsLocal` is non-null and `.claude/settings.local.json` is in the block.)

Extend `cli/test/unit/plan.test.ts` (fixture `demo` now declares gitignore+env via `cli/test/fixtures/manifest.json`):
```ts
  it('regenerates the managed gitignore block around user lines and removes it with the last bundle', async () => {
    const first = await buildPlan({ manifest, registry: 'r', project: project({ disk: { '.gitignore': 'node_modules\n' } }), answers, bundles: ['demo'], bundleFiles: { demo: loadFixtureBundle() } })
    expect(first.gitignore!.content).toBe(`node_modules\n\n${GITIGNORE_START}\n.claude/.env\n.claude/settings.local.json\n.claude/skills/demo-skill/cache/\n${GITIGNORE_END}\n`)
    const lock = first.lock
    const after = await buildPlan({ manifest, registry: 'r', project: project({ disk: { '.gitignore': first.gitignore!.content }, lock }), answers, bundles: [], bundleFiles: {} })
    expect(after.gitignore!.content).toBe('node_modules\n')
    expect(after.envExampleRemove).toBe(true)
  })
```
Extend `cli/test/integration/cli.test.ts` (init case): `.gitignore` contains the block with `.claude/.env`, `.claude/settings.local.json` and `.claude/skills/demo-skill/cache/`; `.claude/.env.example` exists and contains `DEMO_TOKEN=<token>`; `.claude/.env` does not exist. In the remove case: after removing the last env-declaring bundle the example file is gone and the block no longer lists `.claude/.env`.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

`shared/setup/gitignore.ts`:
```ts
import type { Lockfile } from './lock'

export const GITIGNORE_START = '# >>> skills (managed by @patrity/skills; edit outside this block)'
export const GITIGNORE_END = '# <<< skills'

/** Everything the tool wants ignored for this plan: sorted, unique. */
export function gitignoreEntries(plan: { settingsLocal: unknown | null, lock: Lockfile }): string[] {
  const out = new Set<string>()
  if (plan.settingsLocal) out.add('.claude/settings.local.json')
  for (const b of Object.values(plan.lock.bundles)) {
    if (b.env?.length) out.add('.claude/.env')
    for (const e of b.gitignore ?? []) out.add(e)
  }
  return [...out].sort()
}

/**
 * Regenerate the managed block inside an existing .gitignore. Lines outside the block are never
 * touched; the block is appended after one blank line when absent and removed when it would be
 * empty. CRLF files stay CRLF. Returns null when there is no file and nothing to add.
 */
export function renderGitignoreBlock(existing: string | null, entries: string[]): string | null {
  const unique = [...new Set(entries)].sort()
  if (existing === null && unique.length === 0) return null
  const eol = existing?.includes('\r\n') ? '\r\n' : '\n'
  const lines = existing === null || existing === '' ? [] : existing.split(/\r?\n/)
  if (lines.length && lines[lines.length - 1] === '') lines.pop() // trailing newline
  const start = lines.indexOf(GITIGNORE_START)
  const end = start === -1 ? -1 : lines.indexOf(GITIGNORE_END, start)
  const block = unique.length ? [GITIGNORE_START, ...unique, GITIGNORE_END] : []
  let out: string[]
  if (start !== -1 && end !== -1) {
    out = [...lines.slice(0, start), ...block, ...lines.slice(end + 1)]
    // Removing the block also removes the single blank line it was appended after.
    if (!block.length && start > 0 && out[start - 1] === '' && (start >= out.length || out[start] === '')) out.splice(start - 1, 1)
  } else if (block.length) {
    out = lines.length ? [...lines, '', ...block] : block
  } else {
    out = lines
  }
  if (!out.length) return existing === null ? null : ''
  return `${out.join(eol)}${eol}`
}
```
Trace the tests against this before running them; adjust the blank-line removal so both `renderGitignoreBlock('node_modules\n\n<block>\n', [])` → `'node_modules\n'` and the in-place case hold.

`shared/setup/env-example.ts`:
```ts
import type { EnvVar } from '../types/setup'

export const ENV_EXAMPLE_PATH = '.claude/.env.example'
const HEADER = '# Copy this file to .claude/.env and fill in the values. .claude/.env is gitignored; skills read it, never the repo root .env.'

/** The whole managed example file, or null when no installed bundle declares variables. */
export function renderEnvExample(bundles: { slug: string, env: EnvVar[] }[]): string | null {
  const groups = bundles.filter(b => b.env.length).sort((a, b) => a.slug.localeCompare(b.slug))
  if (!groups.length) return null
  const lines = [HEADER, '']
  for (const b of groups) {
    lines.push(`# skills: ${b.slug}`)
    for (const v of b.env) {
      lines.push(`# ${v.description}${v.required ? ' (required)' : ''}`)
      lines.push(`${v.name}=${v.example ?? ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
```

`shared/setup/lock.ts`: `LockBundle` gains `gitignore?: string[]` and `env?: string[]`; `Lockfile` gains `envExample?: string` (sha256 of the last example the tool wrote). `parseBundle` copies them when they are string arrays; `serializeLockfile` sorts them; `emptyLockfile` leaves `envExample` undefined.

`shared/setup/plan.ts` (`planFresh`): after the bundle loop, for each slug read the summary `manifest.skills.find(s => s.slug === slug)` and set `lock.bundles[slug].gitignore = summary?.gitignore?.length ? [...summary.gitignore].sort() : undefined` and `.env = summary?.env?.map(v => v.name).sort()` (undefined when empty); then
```ts
  const gitignoreText = renderGitignoreBlock(null, gitignoreEntries({ settingsLocal, lock }))
  const envText = renderEnvExample(bundles.map(slug => ({ slug, env: manifest.skills.find(s => s.slug === slug)?.env ?? [] })))
  if (envText) lock.envExample = sha256(envText)
  return { …, gitignore: gitignoreText ? { content: gitignoreText, changed: true } : null, envExample: envText ? { content: envText, changed: true } : null, envExampleRemove: false, … }
```

`cli/src/project.ts`: `ProjectState.envExample: string | null` read from `.claude/.env.example`.

`cli/src/plan.ts` (`buildPlan`): replace the gitignore line with `const gitignoreText = renderGitignoreBlock(project.gitignore, gitignoreEntries({ settingsLocal, lock }))` → `gitignore: gitignoreText === null ? null : { content: gitignoreText, changed: gitignoreText !== (project.gitignore ?? '') }` (when `gitignoreText` is `''` and the project had no file, treat as `null`). Env example: `const envText = renderEnvExample(...)`; if `envText`: `envExample = { content: envText, changed: envText !== (project.envExample ?? '') }`, `lock.envExample = sha256(envText)`; else if `project.envExample !== null`: `envExampleRemove = prev?.envExample !== undefined && sha256(project.envExample) === prev.envExample` (only remove what we wrote and the user did not touch; otherwise push warning `.claude/.env.example was modified after install; left in place`).

`cli/src/apply.ts`: after the settings files, `if (plan.envExample?.changed) write '.claude/.env.example'` and `if (plan.envExampleRemove) rm '.claude/.env.example'` (report under `removed`). Never touch `.claude/.env`.

Docs: one paragraph in `cli/README.md` ("What it writes") and `content/docs/cli.md` describing the managed block and the example file (Task 7 rewrites the pages; keep this factual and short).

- [ ] **Step 4: Run → PASS**: root unit, CLI unit + integration (the existing `.gitignore` assertion in the init case changes from "contains the line" to "contains the block"; update that assertion), root gate, CLI gate, `pnpm test` (docs page changed).

- [ ] **Step 5: Commit**

```bash
git add shared cli test content/docs/cli.md
git commit -m "feat(setup): managed .gitignore block and .claude/.env.example from bundle declarations"
```

---

### Task 5: `buildSetupZip`, `POST /api/build`, `POST /api/build/render`

**Files:**
- Create: `server/lib/setup/setup-zip.ts`, `server/api/build.post.ts`, `server/api/build/render.post.ts`, `server/lib/setup/build-input.ts` (zod schema + validation shared by route and tests)
- Modify: `nuxt.config.ts` (`/build` route rule), `server/lib/skills/warm-urls.ts` (+ `/build` and its payload), `test/unit/warm-cache.test.ts`
- Test: `test/unit/setup-zip.test.ts`, `test/unit/build-input.test.ts`, `test/e2e/api.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // server/lib/setup/setup-zip.ts
  export function setupZipEntries(plan: SetupPlan): { path: string, bytes: Uint8Array, mode?: number }[]   // sorted; CLAUDE.md, files, settings, .gitignore, .claude/.env.example, .claude/skills.lock.json
  export function buildSetupZip(plan: SetupPlan, mtime: Date): Uint8Array
  // server/lib/setup/build-input.ts
  export const buildInputSchema: z.ZodType<{ projectName: string, answers: Record<string, string>, bundles: string[] }>
  export const PROJECT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
  export function validateBuildInput(input: unknown, manifest: CliManifest): { ok: true, value: BuildInput } | { ok: false, status: 400, message: string }
  ```
  Route contract: `POST /api/build` → zip (`application/zip`, `Content-Disposition: attachment; filename="<projectName>-claude-setup.zip"`, `Cache-Control: no-store`), 400 `{ statusMessage }`, 413 over 16 KB, 503 cold. `POST /api/build/render` `{ markdown }` (≤ 256 KB) → `MarkdownRender` (the same shape `/api/docs/<slug>` returns minus `entry`), `no-store`.
- Consumes: `planFresh`, `toCliManifest`, `getManifestsOr503`, `getBundleFilesOr503`, `renderMarkdown`, `validateAnswers`/`resolveBundles` from `shared/setup/wizard`.

- [ ] **Step 1: Failing tests**

`test/unit/setup-zip.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { fileURLToPath } from 'node:url'
import { createFsSource } from '../../server/lib/skills/fs-source'
import { toCliManifest } from '../../server/lib/setup/manifest'
import { planFresh } from '../../shared/setup/plan'
import { buildSetupZip, setupZipEntries } from '../../server/lib/setup/setup-zip'

const dir = fileURLToPath(new URL('../fixtures/skills', import.meta.url))

describe('buildSetupZip', () => {
  it('contains exactly the plan, with hook modes, in sorted order, deterministically', async () => {
    const snap = await createFsSource(dir).load()
    const manifest = toCliManifest({ meta: snap, skills: snap.skills, base: snap.base, baseErrors: snap.baseErrors, profiles: snap.profiles, profileErrors: snap.profileErrors }, 'r')
    const plan = planFresh({ manifest, projectName: 'p', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'], bundleFiles: { demo: snap.files.demo! }, registry: 'r' })
    const entries = setupZipEntries(plan)
    expect(entries.map(e => e.path)).toEqual([...entries.map(e => e.path)].sort())
    expect(entries.map(e => e.path)).toEqual(expect.arrayContaining(['CLAUDE.md', '.gitignore', '.claude/.env.example', '.claude/skills.lock.json', '.claude/settings.json', '.claude/settings.local.json']))
    const zip = buildSetupZip(plan, new Date('2026-09-04T00:00:00Z'))
    expect(buildSetupZip(plan, new Date('2026-09-04T00:00:00Z'))).toEqual(zip)
    const files = unzipSync(zip)
    expect(Object.keys(files).sort()).toEqual(entries.map(e => e.path))
    expect(new TextDecoder().decode(files['CLAUDE.md']!)).toBe(plan.claudeMd.content)
  })
  it('marks hook scripts executable', async () => {
    // fflate exposes no attrs on unzip; assert through the raw central directory: external attrs high 16 bits = 0o100755
    const snap = await createFsSource(dir).load()
    const manifest = toCliManifest({ meta: snap, skills: snap.skills, base: snap.base, baseErrors: snap.baseErrors, profiles: snap.profiles, profileErrors: snap.profileErrors }, 'r')
    const plan = planFresh({ manifest, projectName: 'p', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'], bundleFiles: { demo: snap.files.demo! }, registry: 'r' })
    const hook = setupZipEntries(plan).find(e => e.path.startsWith('.claude/hooks/'))
    expect(hook?.mode).toBe(0o755)
    const zip = buildSetupZip(plan, new Date(0))
    // central directory header signature 0x02014b50; external attrs at offset 38 of each header
    const text = Buffer.from(zip)
    let found = false
    for (let i = 0; i + 46 < text.length; i++) {
      if (text.readUInt32LE(i) !== 0x02014b50) continue
      const nameLen = text.readUInt16LE(i + 28)
      const name = text.toString('utf8', i + 46, i + 46 + nameLen)
      if (name === hook!.path) { expect(text.readUInt32LE(i + 38) >>> 16).toBe(0o100755); found = true }
    }
    expect(found).toBe(true)
  })
})
```
(`test/fixtures/skills/demo` must ship a `hooks/*.sh`; it does — `hooks/pre-commit.sh` per the CLI fixture mirror. If the root fixture differs, add one.)

`test/unit/build-input.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { validateBuildInput } from '../../server/lib/setup/build-input'
import { fixtureManifest } from '../../cli/test/helpers/fixtures'   // if importing across packages is awkward, build a minimal CliManifest inline with axes pm/layout and skills demo/second/third

const manifest = fixtureManifest()
describe('validateBuildInput', () => {
  it('accepts a valid body', () => {
    expect(validateBuildInput({ projectName: 'my-app', answers: { pm: 'pnpm' }, bundles: ['demo'] }, manifest)).toMatchObject({ ok: true })
  })
  it('rejects with the CLI wording', () => {
    expect(validateBuildInput({ projectName: 'my-app', answers: { pm: 'bun2' }, bundles: [] }, manifest)).toEqual({ ok: false, status: 400, message: 'pm: "bun2" is not an option' })
    expect(validateBuildInput({ projectName: 'my-app', answers: {}, bundles: ['ghost'] }, manifest)).toEqual({ ok: false, status: 400, message: 'unknown bundle: ghost' })
    expect(validateBuildInput({ projectName: '../x', answers: {}, bundles: [] }, manifest)).toEqual({ ok: false, status: 400, message: 'projectName: must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$' })
    expect(validateBuildInput({ projectName: 'a', answers: {}, bundles: ['demo', 'demo'] }, manifest)).toEqual({ ok: false, status: 400, message: 'bundles: duplicate demo' })
  })
})
```

`test/e2e/api.test.ts`, new describe:
```ts
describe('POST /api/build', () => {
  const body = { projectName: 'e2e-app', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'] }
  it('returns a zip identical to an in-process planFresh, uncached', async () => {
    const res = await fetch('/api/build', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/zip')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(res.headers.get('content-disposition')).toContain('e2e-app-claude-setup.zip')
    const zip = unzipSync(new Uint8Array(await res.arrayBuffer()))
    const manifest = await $fetch<CliManifest>('/api/cli/manifest')
    const demo = await $fetch<SkillFileResponse>('/api/skills/demo/file/CLAUDE.md')
    // The in-process plan needs the bundle files: rebuild them from the download zip.
    const bundleZip = unzipSync(new Uint8Array(await (await fetch('/api/skills/demo/download')).arrayBuffer()))
    const bundleFiles = Object.fromEntries(Object.entries(bundleZip).map(([k, v]) => [k.replace(/^demo\//, ''), v]))
    const plan = planFresh({ manifest, projectName: 'e2e-app', answers: body.answers, bundles: ['demo'], bundleFiles: { demo: bundleFiles }, registry: manifest.registry })
    expect(new TextDecoder().decode(zip['CLAUDE.md']!)).toBe(plan.claudeMd.content)
    expect(new TextDecoder().decode(zip['.claude/skills.lock.json']!)).toBe(serializeLockfile(plan.lock))
    expect(Object.keys(zip).sort()).toEqual(setupZipEntries(plan).map(e => e.path))
    void demo
  })
  it('validates', async () => {
    const bad = await fetch('/api/build', { method: 'POST', body: JSON.stringify({ ...body, bundles: ['ghost'] }), headers: { 'content-type': 'application/json' } })
    expect(bad.status).toBe(400)
    expect((await bad.json()).statusMessage).toBe('unknown bundle: ghost')
    const big = await fetch('/api/build', { method: 'POST', body: JSON.stringify({ ...body, answers: { pad: 'x'.repeat(20000) } }), headers: { 'content-type': 'application/json' } })
    expect(big.status).toBe(413)
  })
})

describe('POST /api/build/render', () => {
  it('renders markdown to the docs AST shape', async () => {
    const res = await fetch('/api/build/render', { method: 'POST', body: JSON.stringify({ markdown: '# T\n\n## Commands\n- x' }), headers: { 'content-type': 'application/json' } })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    const json = await res.json()
    expect(json.body.type).toBe('root')
  })
})
```
(Imports: `planFresh` from `../../shared/setup/plan`, `serializeLockfile` from `../../shared/setup/lock`, `setupZipEntries` from `../../server/lib/setup/setup-zip`.) Also extend `test/unit/warm-cache.test.ts`: the URL list contains `/build` and its payload URL.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement**

`server/lib/setup/setup-zip.ts`:
```ts
import { zipSync, type Zippable } from 'fflate'
import type { SetupPlan } from '../../../shared/types/setup'
import { serializeLockfile } from '../../../shared/setup/lock'
import { ENV_EXAMPLE_PATH } from '../../../shared/setup/env-example'

const enc = new TextEncoder()

export function setupZipEntries(plan: SetupPlan): { path: string, bytes: Uint8Array, mode?: number }[] {
  const out = plan.files.map(f => ({ path: f.path, bytes: f.bytes, ...(f.mode ? { mode: f.mode } : {}) }))
  out.push({ path: 'CLAUDE.md', bytes: enc.encode(plan.claudeMd.content) })
  if (plan.settings) out.push({ path: '.claude/settings.json', bytes: enc.encode(plan.settings.content) })
  if (plan.settingsLocal) out.push({ path: '.claude/settings.local.json', bytes: enc.encode(plan.settingsLocal.content) })
  if (plan.gitignore) out.push({ path: '.gitignore', bytes: enc.encode(plan.gitignore.content) })
  if (plan.envExample) out.push({ path: ENV_EXAMPLE_PATH, bytes: enc.encode(plan.envExample.content) })
  out.push({ path: '.claude/skills.lock.json', bytes: enc.encode(serializeLockfile(plan.lock)) })
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}

/** Deterministic: sorted entries, fixed mtime, level 6; hook scripts carry 0755 in the external attributes. */
export function buildSetupZip(plan: SetupPlan, mtime: Date): Uint8Array {
  const entries: Zippable = {}
  for (const e of setupZipEntries(plan)) {
    entries[e.path] = [e.bytes, { level: 6, mtime, ...(e.mode ? { attrs: ((0o100000 | e.mode) << 16) >>> 0, os: 3 } : {}) }]
  }
  return zipSync(entries)
}
```
(fflate's `ZipAttributes` has `attrs` and `os`; `os: 3` = Unix so unzip honours the mode. Verify the installed fflate 0.8.3 typings expose both; they do.)

`server/lib/setup/build-input.ts`:
```ts
import { z } from 'zod'
import type { CliManifest } from '../../../shared/types/setup'
import { resolveBundles, validateAnswers } from '../../../shared/setup/wizard'

export const PROJECT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
export const buildInputSchema = z.object({
  projectName: z.string(),
  answers: z.record(z.string(), z.string()),
  bundles: z.array(z.string()).max(50)
})
export type BuildInput = z.infer<typeof buildInputSchema>

export function validateBuildInput(input: unknown, manifest: CliManifest): { ok: true, value: BuildInput } | { ok: false, status: 400, message: string } {
  const parsed = buildInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, status: 400, message: `body: ${parsed.error.issues[0]?.message ?? 'invalid'}` }
  const v = parsed.data
  if (!PROJECT_NAME_RE.test(v.projectName)) return { ok: false, status: 400, message: `projectName: must match ${PROJECT_NAME_RE.source}` }
  const dup = v.bundles.find((s, i) => v.bundles.indexOf(s) !== i)
  if (dup) return { ok: false, status: 400, message: `bundles: duplicate ${dup}` }
  if (manifest.base) {
    const errors = validateAnswers(manifest.base, v.answers)
    if (errors.length) return { ok: false, status: 400, message: errors[0]! }
  }
  const { missing } = resolveBundles(v.bundles, manifest.skills)
  if (missing.length) return { ok: false, status: 400, message: `unknown bundle: ${missing.join(', ')}` }
  return { ok: true, value: v }
}
```

`server/api/build.post.ts`:
```ts
import { planFresh } from '~~/shared/setup/plan'
import { resolveBundles } from '~~/shared/setup/wizard'
import { toCliManifest } from '~~/server/lib/setup/manifest'
import { validateBuildInput } from '~~/server/lib/setup/build-input'
import { buildSetupZip } from '~~/server/lib/setup/setup-zip'
import type { BundleFiles } from '~~/shared/types/setup'

const MAX_BODY = 16 * 1024

export default defineEventHandler(async (event): Promise<Buffer> => {
  setHeader(event, 'Cache-Control', 'no-store')
  const raw = await readRawBody(event, 'utf8')
  if (!raw) throw createError({ statusCode: 400, statusMessage: 'body: expected JSON' })
  if (Buffer.byteLength(raw) > MAX_BODY) throw createError({ statusCode: 413, statusMessage: 'body too large' })
  let json: unknown
  try { json = JSON.parse(raw) } catch { throw createError({ statusCode: 400, statusMessage: 'body: not valid JSON' }) }

  const record = await getManifestsOr503()
  const registry = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  const manifest = toCliManifest(record, registry)
  if (manifest.errors.length) throw createError({ statusCode: 503, statusMessage: 'the base schema has errors; the builder is disabled' })
  const checked = validateBuildInput(json, manifest)
  if (!checked.ok) throw createError({ statusCode: checked.status, statusMessage: checked.message })
  const { projectName, answers } = checked.value
  const bundles = resolveBundles(checked.value.bundles, manifest.skills).bundles

  const bundleFiles: Record<string, BundleFiles> = {}
  for (const slug of bundles) {
    const files = await getBundleFilesOr503(slug)
    if (!files) throw createError({ statusCode: 400, statusMessage: `unknown bundle: ${slug}` })
    bundleFiles[slug] = files
  }
  const plan = planFresh({ manifest, projectName, answers, bundles, bundleFiles, registry })
  const zip = buildSetupZip(plan, new Date(record.meta.committedAt))
  setHeader(event, 'Content-Type', 'application/zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${projectName}-claude-setup.zip"`)
  setHeader(event, 'Content-Length', zip.byteLength)
  return Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength)
})
```
(Body limit: `readRawBody` reads everything first; the 413 check is on the decoded length, which is fine at 16 KB. `getBundleFilesOr503` returns `null` for a missing slug; the summaries were already validated so this is defence in depth.)

`server/api/build/render.post.ts`:
```ts
import { renderMarkdown } from '~~/server/utils/markdown'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const body = await readBody<{ markdown?: unknown }>(event)
  const md = body?.markdown
  if (typeof md !== 'string') throw createError({ statusCode: 400, statusMessage: 'markdown: expected a string' })
  if (Buffer.byteLength(md) > 256 * 1024) throw createError({ statusCode: 413, statusMessage: 'markdown too large' })
  return renderMarkdown(md, 'CLAUDE.md')
})
```
(`renderMarkdown` may already be auto-imported from `server/utils`; if so drop the import.)

`nuxt.config.ts` route rules: add `'/build': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } }` (POST routes need no rule; confirm with `curl -I` that `/api/build` is not matched by any existing `/api/**` glob — it is not, the globs are `/api/skills/**`, `/api/cli/**`, `/api/docs/**`). `warm-urls.ts`: add `'/build'` and `payload('/build')` to the seed set; extend the unit test.

- [ ] **Step 4: Run → PASS.** Root gate, `pnpm test`, `pnpm build`. Manual: `curl -X POST localhost:3210/api/build -H 'content-type: application/json' -d '{"projectName":"t","answers":{"pm":"pnpm"},"bundles":["nuxt"]}' -o t.zip && unzip -l t.zip` shows hooks with `-rwxr-xr-x`.

- [ ] **Step 5: Commit**

```bash
git add server nuxt.config.ts test
git commit -m "feat(api): POST /api/build zips a fresh setup; POST /api/build/render for the preview"
```

---

### Task 6: The `/build` page

**Files:**
- Create: `app/pages/build.vue`, `app/components/build/BuildForm.vue`, `app/components/build/AxisField.vue`, `app/components/build/BundlePicker.vue`, `app/components/build/SetupPreview.vue`, `app/components/build/FilesTree.vue`, `app/composables/useSetupPlan.ts`, `app/composables/useBuildState.ts`, `shared/setup/build-state.ts` (hash codec, pure)
- Modify: `app/composables/useAnalytics.ts` (+ `trackBuildDownload`, `trackBuildCopyCli`), `app/pages/index.vue` (only a nav link for now; the copy rewrite is Task 7), the app navigation (wherever `/skills` and `/docs` links live — add `/build` labelled "Build")
- Test: `test/unit/setup-build-state.test.ts`; browser checks with `playwright-cli`

**Interfaces:**
- Produces:
  ```ts
  // shared/setup/build-state.ts
  export interface BuildState { profile: string | null, projectName: string, answers: Record<string, string>, bundles: string[] }
  export function encodeBuildState(s: BuildState): string           // "p=nuxt-app&n=my-app&a=pm:pnpm,layout:single&b=nuxt,nuxt-ui" (URL-encoded values; profile omitted when null)
  export function decodeBuildState(hash: string, manifest: CliManifest): { state: BuildState, warnings: string[] }   // unknown axes/slugs/profiles dropped with a warning each; missing → defaults
  export function cliCommand(s: BuildState, manifest: CliManifest): string   // `pnpx @patrity/skills init --yes [--profile p] [--with a,b] [--answer k=v …]` — `--answer` only for answers that differ from what defaults + profile would give; `--with` only for bundles not already pre-selected by the profile/selects/suggests
  // app/composables/useSetupPlan.ts
  export function useSetupPlan(state: Ref<BuildState>, manifest: Ref<CliManifest | null>): { plan: ComputedRef<SetupPlan | null>, snippetsLoading: Ref<boolean>, warnings: ComputedRef<string[]> }
  ```
- Consumes: Task 2 `planFresh`, `shared/setup/wizard` (`defaultAnswers`, `applyProfile`, `preselectedBundles`, `resolveBundles`, `groupByTag`, `validateAnswers`), Task 5 routes, existing `/api/cli/manifest` and `/api/skills/<slug>/file/CLAUDE.md`.

- [ ] **Step 1: Failing unit test for the codec and the CLI command**

`test/unit/setup-build-state.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { cliCommand, decodeBuildState, encodeBuildState } from '../../shared/setup/build-state'
import { fixtureManifest } from '../../cli/test/helpers/fixtures'   // or an inline CliManifest with axes pm/layout/appDir/browser, profile demo, skills demo/second/third

const manifest = fixtureManifest()

describe('build state codec', () => {
  it('round-trips and omits defaults', () => {
    const s = { profile: 'demo', projectName: 'my app', answers: { pm: 'pnpm', layout: 'monorepo', appDir: 'apps/x/app' }, bundles: ['demo', 'third'] }
    const hash = encodeBuildState(s)
    expect(hash).toBe('p=demo&n=my%20app&a=pm:pnpm,layout:monorepo,appDir:apps%2Fx%2Fapp&b=demo,third')
    expect(decodeBuildState(hash, manifest)).toEqual({ state: s, warnings: [] })
  })
  it('drops unknown axes, slugs and profiles with warnings and falls back to defaults', () => {
    const { state, warnings } = decodeBuildState('p=nope&a=pm:pnpm,zzz:1&b=demo,ghost', manifest)
    expect(state.profile).toBeNull()
    expect(state.answers).toEqual({ pm: 'pnpm', layout: 'single', appDir: 'apps/web/app', browser: 'cli' })
    expect(state.bundles).toEqual(['demo'])
    expect(warnings).toEqual(['unknown profile "nope"', 'unknown axis "zzz"', 'unknown bundle "ghost"'])
  })
  it('renders the shortest equivalent CLI command', () => {
    const defaults = { profile: null, projectName: 'x', answers: { pm: 'pnpm', layout: 'single', appDir: 'apps/web/app', browser: 'cli' }, bundles: ['demo', 'second'] }
    expect(cliCommand(defaults, manifest)).toBe('pnpx @patrity/skills init --yes')   // pm=pnpm selects demo, demo suggests second: nothing to add
    expect(cliCommand({ ...defaults, answers: { ...defaults.answers, pm: 'npm' }, bundles: ['third'] }, manifest)).toBe('pnpx @patrity/skills init --yes --with third --answer pm=npm')
    expect(cliCommand({ ...defaults, profile: 'demo', answers: { ...defaults.answers, browser: 'none' } }, manifest)).toBe('pnpx @patrity/skills init --yes --profile demo')
  })
})
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement the codec**

`shared/setup/build-state.ts`:
```ts
import type { CliManifest } from '../types/setup'
import { applyProfile, defaultAnswers, preselectedBundles, resolveBundles } from './wizard'

export interface BuildState { profile: string | null, projectName: string, answers: Record<string, string>, bundles: string[] }

const enc = (s: string) => encodeURIComponent(s)
const dec = (s: string) => { try { return decodeURIComponent(s) } catch { return s } }

export function encodeBuildState(s: BuildState): string {
  const parts: string[] = []
  if (s.profile) parts.push(`p=${enc(s.profile)}`)
  parts.push(`n=${enc(s.projectName)}`)
  const a = Object.entries(s.answers).map(([k, v]) => `${k}:${enc(v)}`).join(',')
  if (a) parts.push(`a=${a}`)
  if (s.bundles.length) parts.push(`b=${s.bundles.join(',')}`)
  return parts.join('&')
}

export function decodeBuildState(hash: string, manifest: CliManifest): { state: BuildState, warnings: string[] } {
  const warnings: string[] = []
  const params = new Map(hash.replace(/^#/, '').split('&').filter(Boolean).map(kv => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)] as const }))
  const base = manifest.base
  let profile: string | null = params.get('p') ? dec(params.get('p')!) : null
  const prof = profile ? manifest.profiles.find(p => p.name === profile) : undefined
  if (profile && !prof) { warnings.push(`unknown profile "${profile}"`); profile = null }
  let answers = base ? applyProfile(base, prof, defaultAnswers(base)) : {}
  for (const pair of (params.get('a') ?? '').split(',').filter(Boolean)) {
    const i = pair.indexOf(':')
    const id = pair.slice(0, i); const value = dec(pair.slice(i + 1))
    const axis = base?.axes.find(x => x.id === id)
    if (!axis) { warnings.push(`unknown axis "${id}"`); continue }
    if (axis.options && !axis.options.some(o => o.id === value)) { warnings.push(`${id}: "${value}" is not an option`); continue }
    answers = { ...answers, [id]: value }
  }
  const wanted = (params.get('b') ?? '').split(',').filter(Boolean)
  const known = new Set(manifest.skills.map(s => s.slug))
  for (const slug of wanted) if (!known.has(slug)) warnings.push(`unknown bundle "${slug}"`)
  const bundles = params.has('b') ? wanted.filter(s => known.has(s)) : (base ? preselectedBundles(base, answers, prof, manifest.skills) : [])
  return { state: { profile, projectName: params.get('n') ? dec(params.get('n')!) : 'my-project', answers, bundles }, warnings }
}

/** The CLI invocation that reproduces this state, with nothing the wizard would infer anyway. */
export function cliCommand(s: BuildState, manifest: CliManifest): string {
  const base = manifest.base
  const prof = s.profile ? manifest.profiles.find(p => p.name === s.profile) : undefined
  const implied = base ? applyProfile(base, prof, defaultAnswers(base)) : {}
  const parts = ['pnpx @patrity/skills init --yes']
  if (prof) parts.push(`--profile ${prof.name}`)
  const preselected = base ? resolveBundles(preselectedBundles(base, s.answers, prof, manifest.skills), manifest.skills).bundles : []
  const extra = s.bundles.filter(b => !preselected.includes(b))
  if (extra.length) parts.push(`--with ${extra.join(',')}`)
  for (const [k, v] of Object.entries(s.answers)) if (implied[k] !== v) parts.push(`--answer ${k}=${v.includes(' ') ? `"${v}"` : v}`)
  return parts.join(' ')
}
```
(The second test asserts the decoded default answers contain `appDir` even though it is a follow-up axis; `defaultAnswers` includes text-axis defaults — matches the CLI.)

- [ ] **Step 4: Composables**

`app/composables/useSetupPlan.ts`:
```ts
import type { CliManifest, SetupPlan, BundleFiles } from '~~/shared/types/setup'
import type { SkillFileResponse } from '~~/shared/types/skills'
import { planFresh } from '~~/shared/setup/plan'
import { resolveBundles } from '~~/shared/setup/wizard'
import type { BuildState } from '~~/shared/setup/build-state'

const enc = new TextEncoder()

export function useSetupPlan(state: Ref<BuildState>, manifest: Ref<CliManifest | null>) {
  const snippets = reactive(new Map<string, string | null>())   // slug → CLAUDE.md text, null when the fetch failed
  const snippetsLoading = ref(false)
  const fetchWarnings = ref<string[]>([])

  const resolved = computed(() => (manifest.value ? resolveBundles(state.value.bundles, manifest.value.skills).bundles : []))

  watch(resolved, async (slugs) => {
    const missing = slugs.filter(s => !snippets.has(s))
    if (!missing.length) return
    snippetsLoading.value = true
    await Promise.all(missing.map(async (slug) => {
      try {
        const res = await $fetch<SkillFileResponse>(`/api/skills/${slug}/file/CLAUDE.md`)
        snippets.set(slug, res.content ?? '')
      } catch (e) {
        if ((e as { statusCode?: number }).statusCode === 404) snippets.set(slug, '')     // bundle has no snippet
        else { snippets.set(slug, null); fetchWarnings.value = [...fetchWarnings.value, `${slug}: could not load its CLAUDE.md snippet; its section is missing from the preview`] }
      }
    }))
    snippetsLoading.value = false
  }, { immediate: true })

  // The preview only needs each bundle's snippet; the server has the real files for the zip.
  const plan = computed<SetupPlan | null>(() => {
    if (!manifest.value) return null
    const bundleFiles: Record<string, BundleFiles> = {}
    for (const slug of resolved.value) {
      const md = snippets.get(slug)
      bundleFiles[slug] = md ? { 'CLAUDE.md': enc.encode(md) } : {}
    }
    return planFresh({ manifest: manifest.value, projectName: state.value.projectName, answers: state.value.answers, bundles: resolved.value, bundleFiles, registry: manifest.value.registry })
  })
  const warnings = computed(() => [...(plan.value?.warnings ?? []), ...fetchWarnings.value])
  return { plan, snippetsLoading, warnings }
}
```
Note: because the browser only has snippets, the preview's **Files** tab lists the bundle files from each `SkillSummary`'s badges/fileCount rather than real bytes — build the tree from `manifest.skills[].fileCount` is not enough. Fetch the real tree once per selected bundle from `/api/skills/<slug>` (`SkillDetailResponse.tree`, ISR) in `FilesTree.vue` and prefix paths with `.claude/`; add the plan's own entries (`CLAUDE.md`, settings, `.gitignore`, `.claude/.env.example`, lockfile). Sizes come from the tree.

`app/composables/useBuildState.ts`: owns `state: Ref<BuildState>`, initialises from `location.hash` (via `decodeBuildState`, surfacing its warnings once as a toast) after the manifest loads, writes `history.replaceState(null, '', '#' + encodeBuildState(state))` on change (debounced 150 ms), exposes `applyProfile(name | null)`, `setAnswer(id, value)` (re-runs `activeAxes`; answers of axes that stopped being active are kept but unused), `toggleBundle(slug)` (adds `dependsOn` via `resolveBundles`, refuses to untick a slug another ticked bundle depends on), and `preset` = `state.profile` or `'custom'` (flips to custom on any manual edit).

`useAnalytics.ts`: `trackBuildDownload: (profile: string, bundles: string[], answers: Record<string, string>) => track('setup-build-download', { profile, bundles: bundles.join(','), axes: Object.entries(answers).map(([k, v]) => `${k}=${v}`).join(';') })`, `trackBuildCopyCli: (profile: string) => track('setup-build-copy-cli', { profile })`.

- [ ] **Step 5: Components and page**

`app/pages/build.vue`: `useSeoMeta` title "Build your setup"; `useFetch<CliManifest>('/api/cli/manifest')`; if `manifest.errors.length` render a `UAlert` (color error) "The base schema has errors; the builder is disabled until they are fixed." and stop. Otherwise `UDashboardPanel` (header: `UDashboardNavbar` with `#left` = `UDashboardSidebarCollapse` + `<h1 class="text-sm font-semibold">Build your setup</h1>`), body = a `lg:grid lg:grid-cols-2 gap-6` with `<BuildForm>` and `<SetupPreview>`. Follow the existing pages for panel `:ui` classes.

`BuildForm.vue` (props `manifest`, `state`, emits through the composable):
- `URadioGroup` (`variant="card"`, `orientation="horizontal"` on `sm+`) for presets: items from `manifest.profiles` plus `{ value: 'custom', label: 'Custom', description: 'Start from the defaults' }`.
- `UFormField label="Project name"` + `UInput` (pattern `PROJECT_NAME_RE`, error text when invalid).
- `<AxisField v-for="axis in activeAxes(manifest.base, state.answers)" :key="axis.id" :axis :value="state.answers[axis.id]" @update="setAnswer" />` — `AxisField.vue` renders `UFormField :label="axis.question"` with `USelect` (`:items="axis.options.map(o => ({ value: o.id, label: o.label, description: o.description }))"`) or `UInput :placeholder="axis.input.placeholder"`.
- `<BundlePicker :skills="manifest.skills" :selected="state.bundles" :locked="lockedSlugs" :recommended="recommendedSlugs" @toggle="toggleBundle" />` — groups from `groupByTag`, each row a `UCheckbox` with `:label="skill.name" :description="skill.description" :disabled="locked.has(skill.slug)"`, a `UBadge` "recommended" when in `recommended`, and `SkillBadges` (existing component) for the content badges. Locked rows get a `UTooltip` "required by <slugs>".
- Actions: `UButton` "Download setup" (`icon="i-lucide-download"`, `:loading="downloading"`, `:disabled="!valid"`) → `POST /api/build` via `$fetch` with `responseType: 'blob'`, then `URL.createObjectURL` + a temporary `<a download>` click; on success `trackBuildDownload`; on error `toast.add({ title: 'Could not build the zip', description: message, color: 'error' })`. `UButton` variant outline "Copy CLI command" → `navigator.clipboard.writeText(cliCommand(state, manifest))` in try/catch, toast, `trackBuildCopyCli`. A `UButton` variant ghost "Copy share link" copies `location.href`.

`SetupPreview.vue` (props `plan`, `warnings`, `loading`): `UTabs` items `CLAUDE.md` / `Files`. CLAUDE.md tab: a `USwitch` "Rendered"; off → `<CodeView :code="plan.claudeMd.content" language="markdown" />` (check `CodeView.client.vue`'s prop names — it takes the file content and a language; use exactly those); on → `<MarkdownView :body="rendered" />` where `rendered` comes from a debounced (400 ms) `$fetch('/api/build/render', { method: 'POST', body: { markdown } })`, with a `USkeleton` while loading and the source view as fallback on error. Files tab → `<FilesTree>`. Warnings → `UAlert color="warning"` listing them, only when non-empty. `loading` shows a thin `UProgress` under the tabs while snippets load.

`FilesTree.vue`: `UTree` with `get-key="path"`, items built from `plan` + the per-bundle trees fetched from `/api/skills/<slug>` (cached in a module-level map); leaf labels show `name` and a muted size; hooks get a `i-lucide-terminal` icon. Follow the `UTree` rules from `CLAUDE.md`.

Navigation: add `{ label: 'Build', to: '/build', icon: 'i-lucide-hammer' }` wherever the app's sidebar items are defined (search for `to: '/skills'`).

- [ ] **Step 6: Verify**

Unit: `pnpm vitest run test/unit/setup-build-state.test.ts` → PASS. Root gate + `pnpm build` (the client bundle now includes `shared/setup/*`; the build must not pull `node:` modules — if it does, a shared file still imports one; fix the import). Browser (`playwright-cli`, dev server on :3210, use the `browser-testing` skill's workflow): (1) `/build` loads, one `<h1>`, no console errors; (2) pick `nuxt-app` → answers and bundles fill, preview shows `## Stack … ## Self-improvement` in order with `bundle:nuxt` markers; (3) set layout to monorepo → `appDir` field appears, preview rules mention `apps/web/app`; (4) untick `browser-testing` → its blocks leave the preview, `nuxt` stays locked while `nuxt-ui` is ticked; (5) "Rendered" toggle shows headings; (6) Download → unzip into a scratch dir → `pnpx @patrity/skills diff` there reports clean (`{"modified":[],"missing":[],…}`); (7) reload with the hash → same state; (8) 375 px width has no horizontal scroll; (9) copy CLI command → paste matches `cliCommand`. Record the steps and screenshots in the report.

- [ ] **Step 7: Commit**

```bash
git add app shared/setup/build-state.ts test/unit/setup-build-state.test.ts
git commit -m "feat(site): /build composes a setup in the browser and downloads the zip"
```

---

### Task 7: Copy reframe and docs

**Files:**
- Modify: `app/pages/index.vue`, `README.md`, `content/docs/nav.ts`, `content/docs/{cli,base-and-profiles,frontmatter,bundle-structure,hooks-and-settings,contributing}.md`, `nuxt.config.ts` (redirect), `test/e2e/api.test.ts` (docs slugs)
- Create: `content/docs/start-here.md`, `content/docs/philosophy.md`; rename `content/docs/getting-started.md` → `content/docs/single-bundle.md`
- Modify content: `skills/readonly-db/README.md` body, `skills/doc-fetcher/README.md` body (how the cache dir and `.claude/.env` work), `skills/quality-hooks/README.md` (one sentence: `protect-env.sh` also covers `.claude/.env`)

**Interfaces:**
- Consumes: everything shipped in Tasks 3–6 (the copy may only describe what exists: `/build`, the managed block, `.claude/.env.example`, the two frontmatter keys, the CLI flags).
- Produces: nav order `start-here, philosophy, cli, base-and-profiles, single-bundle, bundle-structure, frontmatter, hooks-and-settings, contributing`; route rule `'/docs/getting-started': { redirect: { to: '/docs/single-bundle', statusCode: 301 } }`.

- [ ] **Step 1: E2E first**

In `test/e2e/api.test.ts` (docs describe): assert `/api/docs/start-here` and `/api/docs/philosophy` return `entry.title` "Start here" / "Philosophy"; `/api/docs/single-bundle` exists; `/api/docs/getting-started` is 404 at the API (the page-level redirect is checked with `fetch('/docs/getting-started', { redirect: 'manual' })` → 301 to `/docs/single-bundle`). Run → FAIL.

- [ ] **Step 2: Draft the copy** (then Step 3 humanizes it; do not commit before Step 3)

Home (`index.vue`):
- Hero: `headline="Open source"`, `title="Tony's opinionated Claude Code setup."`, description: "Answer a few questions and get a CLAUDE.md and a .claude/ directory that match how I work: rules that carry direction, skills that carry the how-to, hooks that fail closed, docs that stay honest. Every piece is a bundle you can take on its own." Links: primary `{ label: 'Build it on the web', to: '/build', icon: 'i-lucide-hammer' }`, secondary the `SkillInstallCommand` with `pnpx @patrity/skills init`. Byline under the hero: "by Patrity" → `https://github.com/Patrity`.
- Section 1 `headline="Build"`, `title="Two ways in, one result"`: web builder (live preview, share link, zip with a lockfile) and the CLI (`init`, then `add`/`update`); one sentence that both write the same files.
- Section 2 `headline="What's in the box"`, `title="Fourteen questions, nine bundles"`: the axes in plain words (package manager, repo layout, workflow depth, testing, docs discipline, git policy, deploy target, memory, enforcement, domain) and the bundles as `UBadge` chips linking to their pages.
- Section 3 `headline="How it works"` (existing text, trimmed), Section 4 `headline="Latest"` (existing), Section 5 `headline="Contribute"` (existing, add "curated, opinionated, welcome").

README: opening paragraph mirrors the hero; "Two ways in" (`/build`, CLI); "Use a single bundle"; "Philosophy" (five bullets: rules carry direction and skills carry the how-to; hooks fail closed; three-tier docs; `playwright-cli`, never a Playwright MCP; memory and handovers only when the project wants them); "Configuration and caches" (`.claude/.env`, the managed `.gitignore` block); "Contributing" (welcome, curated); then the existing "Bundle structure" and "Development" sections.

Docs:
- `start-here.md`: 1. Build on the web (`/build`, what you get, the share link, "unzip into a new project folder"), 2. Or run the CLI (`pnpx @patrity/skills`, then `add`/`update`/`diff`), 3. Fill in `.claude/.env` if `.claude/.env.example` was written, 4. Commit `.claude/` and `CLAUDE.md` (and the lockfile), 5. Take a single bundle instead (link).
- `philosophy.md`: one short section per bullet with the bundle(s) that implement it linked (`quality-hooks`, `docs-discipline`, `browser-testing`, `readonly-db`, the base memory/workflow axes).
- `single-bundle.md`: the old getting-started, intro rewritten ("When you only want one piece…"), unchanged steps.
- `frontmatter.md`: rows for `gitignore` and `env` with the validation rules from Task 3 and a YAML example.
- `bundle-structure.md`: the tree gains `README.md frontmatter: gitignore / env` lines and a paragraph "Caches and configuration": caches live under the skill's own directory and are declared in `gitignore`; configuration comes from `.claude/.env`, declared in `env`, never shipped as a file.
- `hooks-and-settings.md`: a "Managed .gitignore block and .claude/.env.example" section with the exact block text and the example format.
- `cli.md`: "What it writes" gains the block and the example file; a "From the web builder" paragraph (zip = `init`; run `diff` after unzipping to confirm; `add`/`update` work on it).
- `base-and-profiles.md`: a paragraph linking the builder, stating both paths use the same code.
- `contributing.md`: "Skill conventions": read config from `.claude/.env` (the three snippets from spec §10.4), cache under your skill dir and declare it, no `.env.example` in a bundle.
- `nav.ts` reordered with the descriptions rewritten in the same voice.

- [ ] **Step 3: Humanize**

Invoke the `humanizer` skill (`~/.claude/skills/humanizer`) on every new or rewritten sentence: the hero and section copy in `index.vue`, `README.md`, the three new/renamed docs pages, and the added paragraphs in the other docs. Apply its edits. Then check every factual claim against the code: command names and flags (`cli/src/commands/*.ts`), the block text (`shared/setup/gitignore.ts`), the example format (`shared/setup/env-example.ts`), the frontmatter rules (`server/lib/skills/frontmatter.ts`), the axis count (`base/questions.yaml`: 14) and bundle count (9).

- [ ] **Step 4: Wire and verify**

`nuxt.config.ts` route rule for the redirect; `nav.ts` order; `test/e2e/api.test.ts` green; root gate; `pnpm test`; `pnpm build`. Browser: `/`, `/docs/start-here`, `/docs/philosophy`, `/docs/single-bundle`, `/docs/getting-started` (redirects), one `<h1>` each, links resolve, 375 px width.

- [ ] **Step 5: Commit**

```bash
git add app/pages/index.vue README.md content nuxt.config.ts test/e2e/api.test.ts skills
git commit -m "docs: reframe the site as an opinionated setup; start-here, philosophy and the env/gitignore conventions"
```

---

### Task 8: CLI 0.2.0 release, deploy verification (controller + user)

- [ ] **Step 1:** Bump `cli/package.json` to `0.2.0`; `cli/README.md` changelog line ("0.2.0 — managed .gitignore block, .claude/.env.example, shared planner"); `pnpm --filter @patrity/skills build && npm pack --dry-run` in `cli/` lists `dist`, `README.md`, `LICENSE`, `package.json`; commit `chore(cli): 0.2.0`.
- [ ] **Step 2 (controller):** full gate (`pnpm lint && pnpm typecheck && pnpm validate:skills && pnpm test && pnpm build`, CLI gate); push `main`; tag `cli-v0.2.0`, push the tag; watch `ci`, `release-cli`, `warm`; `npm view @patrity/skills version` → `0.2.0` (allow for registry cache lag; the tarball URL is the reliable check).
- [ ] **Step 3 (controller):** production: `https://skills.patrity.com/build` renders; `curl -X POST https://skills.patrity.com/api/build -H 'content-type: application/json' -d '{"projectName":"smoke","answers":{"pm":"pnpm"},"bundles":["nuxt","readonly-db"]}' -o smoke.zip` → unzip in a scratch dir, check `.gitignore` block, `.claude/.env.example` with `DATABASE_URL_RO`, hooks executable; `pnpx @patrity/skills@0.2.0 diff` in that dir → clean; `pnpx @patrity/skills@0.2.0 init --yes --profile nuxt-app` in another scratch dir → same files as the zip for the same input (diff the two trees, ignoring nothing).
- [ ] **Step 4:** `CLAUDE.md` (Production + Constraints): `/build` and the two POST routes are `no-store`; state lives in the URL hash; the managed `.gitignore` block; `shared/setup/**` must stay Node-free. MyMind: handover doc + tasks. Delete the SDD workspace.

---

## Self-review notes

- **Spec coverage:** §4.1 layout → Task 6 (`BuildForm`, `AxisField`, `BundlePicker`, actions); §4.2 data flow → Task 6 (`useSetupPlan`, `useBuildState`); §4.3 preview → Task 5 render route + Task 6 `SetupPreview`; §4.4 edge cases → Task 6 (banner, warnings, validation); §5.1 moves → Tasks 1–2; §5.2 build route → Task 5; §5.3 zip → Task 5; §5.4 hash → Task 1; §5.5 render → Task 5; §6 caching/analytics → Tasks 5 (route rule, warm) and 6 (analytics, hash state); §7 copy → Task 7 (humanizer step 3); §8 testing → per task + Task 8 verification; §9 rollout → Task 8; §10.1 frontmatter → Task 3; §10.2 block → Task 4; §10.3 example → Task 4; §10.4 convention → Tasks 3 (readonly-db runner) and 7 (docs); §10.5 validator → Task 3.
- **Type consistency:** `planFresh` (Task 2) is consumed by Tasks 4 (extends its output), 5 (route + zip), 6 (composable) with the same input shape; `SetupPlan` gains `envExample`/`envExampleRemove` in Task 4 and Task 5's `setupZipEntries` reads `envExample`; `EnvVar` (Task 3) is what `renderEnvExample` (Task 4) and `SkillFrontmatter.env` use; `LockBundle.gitignore/env` (Task 4) are read by `gitignoreEntries`; `toCliManifest` (Task 2) is used by Task 5's route and every unit test that needs a manifest from the fixture snapshot; `BuildState`/`cliCommand` (Task 6) reuse `applyProfile`/`defaultAnswers`/`preselectedBundles`/`resolveBundles` moved in Task 2.
- **Placeholders:** none; every step carries its code or the exact text to write. The one "verify against the installed API" instruction (fflate `attrs`/`os`, `CodeView` prop names, zod `refine` message signature) names the file to check.
- **Ordering risk:** Task 3 changes the CLI fixture manifest before Task 4 uses it — harmless because nothing reads `gitignore`/`env` until Task 4. Task 6's browser checks need Task 5's routes; Task 7's docs describe Task 6's page, so the order is fixed.
