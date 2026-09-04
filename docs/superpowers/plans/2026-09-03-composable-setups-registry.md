# Composable Setups — Registry Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the registry the CLAUDE.md section convention, serve a base schema + profiles + a CLI manifest, and ship the re-sectioned and new bundles the wizard composes from.

**Architecture:** Pure composition logic (snippet sectioning, marker rendering, placeholders) lives in `shared/setup/` so the site validates with the exact code the CLI later renders with. The snapshot grows `base` and `profiles` parsed from `base/**` and `profiles/**` in the same GitHub zip; three new ISR routes expose them. Content work re-sections the three existing bundles and adds six new ones.

**Tech Stack:** Nuxt 4.5 / Nitro, TypeScript, zod 4, `yaml` 2.9, vitest 4.1, existing store/ISR/warming pipeline.

**Spec:** `docs/superpowers/specs/2026-09-03-composable-setups-and-cli-design.md` (§3 convention, §4 base schema, §6 registry changes, §8 content, §9 testing). Registry background: `docs/superpowers/specs/2026-09-03-skills-repository-design.md`.

## Global Constraints

- pnpm only; commit messages conventional, no `Co-Authored-By`/`Claude-Session`/model references (check `git log -1 --format=%B` after each commit). Do not push; the controller pushes.
- `server/lib/**` and `shared/**` use relative imports only (vitest and `tsx` load them without Nuxt); Nitro routes may use `~~/`.
- Canonical sections (id → title), exact strings: `intro` (title line), `read-first` → "Read first", `stack` → "Stack", `commands` → "Commands", `workflow` → "Workflow", `testing` → "Testing", `docs` → "Docs", `git` → "Git", `deploy` → "Deploy", `constraints` → "Constraints that bit before", `memory` → "Memory", `skills-and-rules` → "Skills and rules", `self-improvement` → "Self-improvement".
- Snippet rule: `##` headings must be canonical titles or `## @<id>`; content before any heading → `skills-and-rules`; anything else is a validation error.
- Marker format, exact: `<!-- skills:<source-id> -->` … `<!-- /skills:<source-id> -->`. Source ids: `base:<axis>=<option>`, `base:always/<name>`, `bundle:<slug>`.
- Placeholders: `{{pm}}`, `{{pmx}}`, `{{appDir}}`, `{{pkgDir}}`, `{{projectName}}` only (`{{pkgDir}}` is the package-root prefix — empty for a single-app layout, `apps/web/` when `appDir` is `apps/web/app` — and is written immediately before a path).
- `paths:` frontmatter in every rule file is a non-empty YAML list (the validator enforces it); app-code globs use `{{appDir}}/**` and every other package-relative path uses `{{pkgDir}}…` where the layout can move it.
- Frontmatter: `requires` keeps meaning external tooling; `dependsOn` and `suggests` are bundle slugs.
- Every published file (bundles, base, profiles) must be free of secrets, private IPs and internal hostnames; the validator enforces the patterns in Task 5.
- ISR routes carry `Vercel-Cache-Tag: skills`; new content types ride the existing purge + warm.
- Port 3000 is taken on the dev machine: dev server `PORT=3210 pnpm dev`, prod-like `PORT=3100`. Browser checks with `playwright-cli` only.
- Run `pnpm lint && pnpm typecheck && pnpm test:unit` before every commit; `pnpm test` (e2e) and `pnpm build` at the end of any task that touches routes, `nuxt.config.ts` or content the e2e suite reads.

---

## File structure

```
shared/types/setup.ts                 SectionDef, BaseAxis, BaseOption, BaseSchema, Profile, CliManifest, BaseResponse, ProfilesResponse
shared/types/skills.ts                SkillFrontmatter += dependsOn?, suggests?
shared/setup/sections.ts              CANONICAL_SECTIONS, splitSnippet()
shared/setup/markers.ts               startMarker/endMarker, stripMarkerBlocks(), findMarkerBlocks()
shared/setup/render.ts                composeClaudeMd() — sections + markers + user text preserved
shared/setup/placeholders.ts          renderPlaceholders(), placeholderVars()
server/lib/setup/base.ts              parseBaseSchema(files) → schema + errors (yaml)
server/lib/setup/profiles.ts          parseProfiles(files, schema, slugs) → profiles + errors
server/lib/setup/secrets.ts           scanForSecrets(files) → findings (fail/warn)
server/lib/skills/types.ts            Snapshot += base, baseErrors, profiles, profileErrors; RawExtras
server/lib/skills/parse-bundle.ts     buildSnapshot(bundles, meta, extras)
server/lib/skills/archive.ts          extractArchive(zip) → { bundles, base, profiles }
server/lib/skills/fs-source.ts        reads sibling base/ and profiles/ dirs
server/lib/skills/frontmatter.ts      dependsOn/suggests in the schema
server/lib/skills/store.ts            ManifestRecord carries base/profiles
server/api/base.get.ts, server/api/profiles.get.ts, server/api/cli/manifest.get.ts
server/api/skills/index.get.ts        summaries include dependsOn/suggests (automatic via type)
scripts/validate-skills.ts            base/profile/snippet/secrets validation
base/sections.yaml, base/questions.yaml, base/fragments/**, base/always/**, base/templates/**
profiles/nuxt-app.yaml, profiles/library.yaml, profiles/docs-only.yaml
skills/{nuxt,nuxt-ui,browser-testing}/…   re-sectioned snippets, reconciled rules, dependsOn
skills/{quality-hooks,docs-discipline,doc-fetcher,iterative-spec-design,readonly-db,remote-ops}/…
app/components/skill/InstallCommand.vue  one-liner + copy button
app/pages/index.vue, app/pages/skills.vue, app/pages/skill/[...segments].vue  install command placement
content/docs/{cli,base-and-profiles}.md + nav.ts
test/fixtures/{base,profiles}/**, test/unit/*.test.ts, test/e2e/api.test.ts
```

---

### Task 1: Setup types and the snippet sectioning rule

**Files:**
- Create: `shared/types/setup.ts`, `shared/setup/sections.ts`
- Modify: `shared/types/skills.ts` (add `dependsOn?`, `suggests?` to `SkillFrontmatter`)
- Test: `test/unit/setup-sections.test.ts`

**Interfaces:**
- Produces (types):
  ```ts
  export interface SectionDef { id: string; title: string }
  export interface BaseOption { id: string; label: string; description?: string; fragment?: string; selects?: string[] }
  export interface BaseAxis {
    id: string; question: string; description?: string
    when?: { axis: string; option: string }          // follow-up: only asked when that answer was given
    options?: BaseOption[]; default?: string          // select-style axis
    input?: { placeholder: string; default: string }  // text-style axis (no options)
  }
  export interface BaseSchema {
    version: number; sections: SectionDef[]; axes: BaseAxis[]
    fragments: Record<string, string>   // "pm/pnpm.md" → markdown
    always: Record<string, string>      // "self-improvement.md" → markdown
    templates: Record<string, string>   // "browser-testing-project.md" → markdown
  }
  export interface Profile { name: string; description: string; answers: Record<string, string>; bundles: string[] }
  export interface BaseResponse extends SnapshotMeta { base: BaseSchema | null; errors: string[] }
  export interface ProfilesResponse extends SnapshotMeta { profiles: Profile[]; errors: string[] }
  export interface CliManifest extends SnapshotMeta { registry: string; base: BaseSchema | null; profiles: Profile[]; skills: SkillSummary[]; errors: string[] }
  ```
- Produces (values): `CANONICAL_SECTIONS: SectionDef[]` (13 entries, exact order/titles from Global Constraints), `DEFAULT_SECTION_ID = 'skills-and-rules'`, `splitSnippet(md: string, sections?: SectionDef[]): { byId: Record<string, string>; errors: string[] }`.

- [ ] **Step 1: Write the failing test**

`test/unit/setup-sections.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { CANONICAL_SECTIONS, DEFAULT_SECTION_ID, splitSnippet } from '../../shared/setup/sections'

describe('CANONICAL_SECTIONS', () => {
  it('has the 13 sections in canonical order', () => {
    expect(CANONICAL_SECTIONS.map(s => s.id)).toEqual([
      'intro', 'read-first', 'stack', 'commands', 'workflow', 'testing', 'docs', 'git', 'deploy',
      'constraints', 'memory', 'skills-and-rules', 'self-improvement'
    ])
    expect(CANONICAL_SECTIONS.find(s => s.id === 'constraints')!.title).toBe('Constraints that bit before')
  })
})

describe('splitSnippet', () => {
  it('routes content under canonical headings to their section ids', () => {
    const md = `## Commands\n- \`{{pm}} typecheck\` often\n\n## Constraints that bit before\n- Shiki OOMs builds\n`
    const r = splitSnippet(md)
    expect(r.errors).toEqual([])
    expect(r.byId).toEqual({
      'commands': '- `{{pm}} typecheck` often',
      'constraints': '- Shiki OOMs builds'
    })
  })

  it('accepts `## @id` headings', () => {
    const r = splitSnippet('## @skills-and-rules\n- invoke nuxt-docs\n')
    expect(r.byId['skills-and-rules']).toBe('- invoke nuxt-docs')
  })

  it('puts content before any heading into skills-and-rules', () => {
    const r = splitSnippet('- Always pnpm\n\n## Git\n- no trailers\n')
    expect(r.byId[DEFAULT_SECTION_ID]).toBe('- Always pnpm')
    expect(r.byId.git).toBe('- no trailers')
  })

  it('rejects unknown headings and reports them', () => {
    const r = splitSnippet('## Random Stuff\n- x\n## Commands\n- y\n')
    expect(r.errors).toEqual(['unknown section heading "Random Stuff" (use a canonical title or ## @id)'])
    expect(r.byId.commands).toBe('- y')
    expect(r.byId['Random Stuff']).toBeUndefined()
  })

  it('merges repeated headings and ignores deeper headings', () => {
    const r = splitSnippet('## Commands\n- a\n### sub\n- b\n## Commands\n- c\n')
    expect(r.byId.commands).toBe('- a\n### sub\n- b\n\n- c')
  })

  it('returns nothing for an empty snippet', () => {
    expect(splitSnippet('   \n')).toEqual({ byId: {}, errors: [] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/setup-sections.test.ts`
Expected: FAIL — cannot resolve `../../shared/setup/sections`.

- [ ] **Step 3: Write the types and the splitter**

`shared/types/setup.ts`:
```ts
import type { SkillSummary, SnapshotMeta } from './skills'

export interface SectionDef {
  id: string
  title: string
}

export interface BaseOption {
  id: string
  label: string
  description?: string
  /** Path under base/fragments, e.g. "pm/pnpm.md". Optional: some options add nothing. */
  fragment?: string
  /** Bundle slugs this option auto-selects in the wizard. */
  selects?: string[]
}

export interface BaseAxis {
  id: string
  question: string
  description?: string
  /** Follow-up axis: asked only when `axis` was answered with `option`. */
  when?: { axis: string, option: string }
  /** Select-style axis. */
  options?: BaseOption[]
  default?: string
  /** Text-style axis (no options). Its answer becomes a placeholder variable of the same id. */
  input?: { placeholder: string, default: string }
}

export interface BaseSchema {
  version: number
  sections: SectionDef[]
  axes: BaseAxis[]
  /** "pm/pnpm.md" → markdown (already sectioned with ## headings). */
  fragments: Record<string, string>
  /** "self-improvement.md" → markdown. Every base gets these. */
  always: Record<string, string>
  /** "browser-testing-project.md" → markdown the wizard scaffolds into the project. */
  templates: Record<string, string>
}

export interface Profile {
  name: string
  description: string
  answers: Record<string, string>
  bundles: string[]
}

export interface BaseResponse extends SnapshotMeta {
  base: BaseSchema | null
  errors: string[]
}

export interface ProfilesResponse extends SnapshotMeta {
  profiles: Profile[]
  errors: string[]
}

/** Everything the CLI needs in one request. */
export interface CliManifest extends SnapshotMeta {
  registry: string
  base: BaseSchema | null
  profiles: Profile[]
  skills: SkillSummary[]
  errors: string[]
}
```

In `shared/types/skills.ts`, extend `SkillFrontmatter`:
```ts
export interface SkillFrontmatter {
  name: string
  description: string
  tags: string[]
  author: string
  authorUrl?: string
  /** External tooling, e.g. ["python3"]. */
  requires?: string[]
  /** Bundle slugs that must be installed with this one. */
  dependsOn?: string[]
  /** Bundle slugs the wizard pre-ticks alongside this one. */
  suggests?: string[]
}
```

`shared/setup/sections.ts`:
```ts
import type { SectionDef } from '../types/setup'

export const CANONICAL_SECTIONS: SectionDef[] = [
  { id: 'intro', title: '' },
  { id: 'read-first', title: 'Read first' },
  { id: 'stack', title: 'Stack' },
  { id: 'commands', title: 'Commands' },
  { id: 'workflow', title: 'Workflow' },
  { id: 'testing', title: 'Testing' },
  { id: 'docs', title: 'Docs' },
  { id: 'git', title: 'Git' },
  { id: 'deploy', title: 'Deploy' },
  { id: 'constraints', title: 'Constraints that bit before' },
  { id: 'memory', title: 'Memory' },
  { id: 'skills-and-rules', title: 'Skills and rules' },
  { id: 'self-improvement', title: 'Self-improvement' }
]

export const DEFAULT_SECTION_ID = 'skills-and-rules'

const H2 = /^##\s+(.+?)\s*$/

/** Resolve a `## Heading` line to a section id, or null when it is not canonical. */
export function sectionIdForHeading(heading: string, sections: SectionDef[] = CANONICAL_SECTIONS): string | null {
  const at = /^@([a-z-]+)$/.exec(heading)
  if (at) return sections.some(s => s.id === at[1]) ? at[1]! : null
  const byTitle = sections.find(s => s.title && s.title.toLowerCase() === heading.toLowerCase())
  return byTitle?.id ?? null
}

/**
 * Split a CLAUDE.md snippet (a base fragment or a bundle's CLAUDE.md) into per-section
 * markdown. Only `##` headings are section boundaries; deeper headings stay in the body.
 */
export function splitSnippet(md: string, sections: SectionDef[] = CANONICAL_SECTIONS): { byId: Record<string, string>, errors: string[] } {
  const byId: Record<string, string[]> = {}
  const errors: string[] = []
  let current: string | null = DEFAULT_SECTION_ID
  let buffer: string[] = []

  const flush = () => {
    const text = buffer.join('\n').trim()
    buffer = []
    if (!text || current === null) return
    byId[current] = byId[current] ? [...byId[current]!, text] : [text]
  }

  for (const line of md.split(/\r?\n/)) {
    const match = H2.exec(line)
    if (!match) {
      buffer.push(line)
      continue
    }
    flush()
    const id = sectionIdForHeading(match[1]!, sections)
    if (!id) {
      errors.push(`unknown section heading "${match[1]}" (use a canonical title or ## @id)`)
      current = null // swallow this section's content
    } else {
      current = id
    }
  }
  flush()

  return {
    byId: Object.fromEntries(Object.entries(byId).map(([id, parts]) => [id, parts.join('\n\n')])),
    errors
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/unit/setup-sections.test.ts` → PASS. `pnpm typecheck` → exit 0 (the new optional keys break nothing).

- [ ] **Step 5: Commit**

```bash
git add shared/types/setup.ts shared/setup/sections.ts shared/types/skills.ts test/unit/setup-sections.test.ts
git commit -m "feat: setup types and the CLAUDE.md snippet sectioning rule"
```

---

### Task 2: Marker blocks, placeholders, and CLAUDE.md composition

**Files:**
- Create: `shared/setup/markers.ts`, `shared/setup/placeholders.ts`, `shared/setup/render.ts`
- Test: `test/unit/setup-render.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // markers.ts
  export const startMarker = (id: string) => `<!-- skills:${id} -->`
  export const endMarker = (id: string) => `<!-- /skills:${id} -->`
  export interface MarkerBlock { sourceId: string; start: number; end: number; content: string }  // line indices, inclusive
  export function findMarkerBlocks(md: string): MarkerBlock[]
  export function stripMarkerBlocks(md: string, keep?: (sourceId: string) => boolean): string
  // placeholders.ts
  export const PLACEHOLDERS = ['pm', 'pmx', 'appDir', 'projectName'] as const
  export type PlaceholderVars = Record<(typeof PLACEHOLDERS)[number], string>
  export function placeholderVars(answers: Record<string, string>, projectName: string): PlaceholderVars
  export function renderPlaceholders(text: string, vars: PlaceholderVars): { text: string; unknown: string[] }
  // render.ts
  export interface Contribution { sourceId: string; sectionId: string; markdown: string }
  export function composeClaudeMd(existing: string | null, opts: { title: string; intro?: string; sections?: SectionDef[]; contributions: Contribution[] }): string
  ```
- `composeClaudeMd` semantics: strip every existing marker block; keep all other text; for each canonical section in order, contributions (in given order) are appended inside marker blocks under the section's heading — reusing a heading the user already has (case-insensitive title match), otherwise creating `## Title` at the canonical position (after the last existing canonical section that precedes it, else at the end). A missing document starts with `# title` and the optional intro paragraph. Output ends with one newline.

- [ ] **Step 1: Write the failing test**

`test/unit/setup-render.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { endMarker, findMarkerBlocks, startMarker, stripMarkerBlocks } from '../../shared/setup/markers'
import { placeholderVars, renderPlaceholders } from '../../shared/setup/placeholders'
import { composeClaudeMd } from '../../shared/setup/render'

describe('markers', () => {
  const doc = `# X\n\n## Commands\n${startMarker('base:pm=pnpm')}\n- pnpm\n${endMarker('base:pm=pnpm')}\nkeep me\n${startMarker('bundle:nuxt')}\n- nuxt\n${endMarker('bundle:nuxt')}\n`
  it('finds blocks with their source ids and content', () => {
    const blocks = findMarkerBlocks(doc)
    expect(blocks.map(b => [b.sourceId, b.content])).toEqual([['base:pm=pnpm', '- pnpm'], ['bundle:nuxt', '- nuxt']])
  })
  it('strips blocks but keeps user text', () => {
    expect(stripMarkerBlocks(doc)).toBe('# X\n\n## Commands\nkeep me\n')
  })
  it('can keep selected sources', () => {
    expect(stripMarkerBlocks(doc, id => id === 'bundle:nuxt')).toContain('- nuxt')
    expect(stripMarkerBlocks(doc, id => id === 'bundle:nuxt')).not.toContain('- pnpm')
  })
})

describe('placeholders', () => {
  it('derives vars from answers', () => {
    expect(placeholderVars({ pm: 'pnpm', layout: 'single' }, 'my-app')).toEqual({ pm: 'pnpm', pmx: 'pnpx', appDir: 'app', projectName: 'my-app' })
    expect(placeholderVars({ pm: 'npm', layout: 'monorepo', appDir: 'apps/web/app' }, 'x').appDir).toBe('apps/web/app')
    expect(placeholderVars({ pm: 'bun' }, 'x').pmx).toBe('bunx')
    expect(placeholderVars({ pm: 'yarn' }, 'x').pmx).toBe('yarn dlx')
  })
  it('renders known placeholders and reports unknown ones', () => {
    const r = renderPlaceholders('run {{pm}} dev in {{appDir}}; {{nope}}', placeholderVars({ pm: 'pnpm' }, 'p'))
    expect(r.text).toBe('run pnpm dev in app; {{nope}}')
    expect(r.unknown).toEqual(['nope'])
  })
})

describe('composeClaudeMd', () => {
  const contributions = [
    { sourceId: 'base:always/self-improvement', sectionId: 'self-improvement', markdown: '- improve' },
    { sourceId: 'base:pm=pnpm', sectionId: 'commands', markdown: '- always pnpm' },
    { sourceId: 'bundle:nuxt', sectionId: 'commands', markdown: '- pnpm typecheck' },
    { sourceId: 'bundle:nuxt', sectionId: 'skills-and-rules', markdown: '- invoke nuxt-docs' }
  ]

  it('creates a fresh document in canonical order with one block per source per section', () => {
    const out = composeClaudeMd(null, { title: 'My App', intro: 'A thing.', contributions })
    expect(out).toBe([
      '# My App', '', 'A thing.', '',
      '## Commands', '',
      startMarker('base:pm=pnpm'), '- always pnpm', endMarker('base:pm=pnpm'), '',
      startMarker('bundle:nuxt'), '- pnpm typecheck', endMarker('bundle:nuxt'), '',
      '## Skills and rules', '',
      startMarker('bundle:nuxt'), '- invoke nuxt-docs', endMarker('bundle:nuxt'), '',
      '## Self-improvement', '',
      startMarker('base:always/self-improvement'), '- improve', endMarker('base:always/self-improvement'), ''
    ].join('\n'))
  })

  it('reuses an existing user heading and preserves user text before the blocks', () => {
    const existing = '# Mine\n\nIntro kept.\n\n## Commands\n- my own command\n\n## Notes\n- user section stays\n'
    const out = composeClaudeMd(existing, { title: 'Mine', contributions })
    expect(out).toContain('Intro kept.')
    expect(out.match(/## Commands/g)).toHaveLength(1)
    expect(out.indexOf('- my own command')).toBeLessThan(out.indexOf(startMarker('base:pm=pnpm')))
    expect(out).toContain('## Notes\n- user section stays')
    // Skills and rules is inserted after Commands (canonical order) — before the user's Notes? No:
    // new canonical sections go after the last canonical section that precedes them; Notes is not
    // canonical, so Skills and rules lands after Commands' content and before Notes.
    expect(out.indexOf('## Skills and rules')).toBeGreaterThan(out.indexOf('## Commands'))
    expect(out.indexOf('## Skills and rules')).toBeLessThan(out.indexOf('## Notes'))
  })

  it('is idempotent: re-composing replaces blocks instead of duplicating them', () => {
    const once = composeClaudeMd(null, { title: 'T', contributions })
    const twice = composeClaudeMd(once, { title: 'T', contributions })
    expect(twice).toBe(once)
  })

  it('drops a source that is no longer contributed and removes the section it leaves empty', () => {
    const once = composeClaudeMd(null, { title: 'T', contributions })
    const without = composeClaudeMd(once, { title: 'T', contributions: contributions.filter(c => c.sourceId !== 'bundle:nuxt') })
    expect(without).not.toContain('bundle:nuxt')
    expect(without).not.toContain('## Skills and rules')
    expect(without).toContain('## Commands')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/unit/setup-render.test.ts` → FAIL (modules missing).

- [ ] **Step 3: Implement**

`shared/setup/markers.ts`:
```ts
export const startMarker = (sourceId: string) => `<!-- skills:${sourceId} -->`
export const endMarker = (sourceId: string) => `<!-- /skills:${sourceId} -->`

const START = /^<!-- skills:([^\s>]+) -->$/
const END = /^<!-- \/skills:([^\s>]+) -->$/

export interface MarkerBlock {
  sourceId: string
  /** Line index of the start marker. */
  start: number
  /** Line index of the end marker. */
  end: number
  /** Text between the markers, trimmed. */
  content: string
}

export function findMarkerBlocks(md: string): MarkerBlock[] {
  const lines = md.split('\n')
  const blocks: MarkerBlock[] = []
  for (let i = 0; i < lines.length; i++) {
    const open = START.exec(lines[i]!)
    if (!open) continue
    const id = open[1]!
    for (let j = i + 1; j < lines.length; j++) {
      const close = END.exec(lines[j]!)
      if (close && close[1] === id) {
        blocks.push({ sourceId: id, start: i, end: j, content: lines.slice(i + 1, j).join('\n').trim() })
        i = j
        break
      }
    }
  }
  return blocks
}

/** Remove marker blocks (and one following blank line) except those `keep` returns true for. */
export function stripMarkerBlocks(md: string, keep: (sourceId: string) => boolean = () => false): string {
  const lines = md.split('\n')
  const drop = new Set<number>()
  for (const block of findMarkerBlocks(md)) {
    if (keep(block.sourceId)) continue
    for (let i = block.start; i <= block.end; i++) drop.add(i)
    if (lines[block.end + 1] === '') drop.add(block.end + 1)
  }
  return lines.filter((_, i) => !drop.has(i)).join('\n')
}
```

`shared/setup/placeholders.ts`:
```ts
export const PLACEHOLDERS = ['pm', 'pmx', 'appDir', 'projectName'] as const
export type PlaceholderVars = Record<(typeof PLACEHOLDERS)[number], string>

const PMX: Record<string, string> = { pnpm: 'pnpx', npm: 'npx', yarn: 'yarn dlx', bun: 'bunx' }

/** Derive the placeholder variables from wizard answers. Unknown pm falls back to pnpm. */
export function placeholderVars(answers: Record<string, string>, projectName: string): PlaceholderVars {
  const pm = answers.pm && PMX[answers.pm] ? answers.pm : 'pnpm'
  const appDir = answers.layout === 'monorepo' ? (answers.appDir || 'apps/web/app') : 'app'
  return { pm, pmx: PMX[pm]!, appDir, projectName }
}

export function renderPlaceholders(text: string, vars: PlaceholderVars): { text: string, unknown: string[] } {
  const unknown = new Set<string>()
  const out = text.replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (whole, key: string) => {
    if (key in vars) return vars[key as keyof PlaceholderVars]
    unknown.add(key)
    return whole
  })
  return { text: out, unknown: [...unknown] }
}
```

`shared/setup/render.ts`:
```ts
import type { SectionDef } from '../types/setup'
import { CANONICAL_SECTIONS, sectionIdForHeading } from './sections'
import { endMarker, startMarker, stripMarkerBlocks } from './markers'

export interface Contribution {
  sourceId: string
  sectionId: string
  markdown: string
}

interface DocSection {
  /** Canonical id when the heading is canonical, else null (user section). */
  id: string | null
  heading: string | null   // the `## …` line, null for the preamble
  lines: string[]
}

function parseDoc(md: string): DocSection[] {
  const out: DocSection[] = [{ id: 'intro', heading: null, lines: [] }]
  for (const line of md.split('\n')) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line)
    if (h2) {
      out.push({ id: sectionIdForHeading(h2[1]!), heading: line, lines: [] })
    } else {
      out[out.length - 1]!.lines.push(line)
    }
  }
  return out
}

function trimBlank(lines: string[]): string[] {
  let start = 0
  let end = lines.length
  while (start < end && lines[start]!.trim() === '') start++
  while (end > start && lines[end - 1]!.trim() === '') end--
  return lines.slice(start, end)
}

function renderBlock(c: Contribution): string[] {
  return [startMarker(c.sourceId), c.markdown.trim(), endMarker(c.sourceId), '']
}

/**
 * Compose CLAUDE.md: every previous marker block is removed, all other text is kept, and the
 * contributions are written inside marker blocks under their canonical section — reusing a
 * heading the document already has, or creating it in canonical order.
 */
export function composeClaudeMd(existing: string | null, opts: {
  title: string
  intro?: string
  sections?: SectionDef[]
  contributions: Contribution[]
}): string {
  const sections = opts.sections ?? CANONICAL_SECTIONS
  const order = sections.map(s => s.id)
  const base = existing ? stripMarkerBlocks(existing) : `# ${opts.title}\n${opts.intro ? `\n${opts.intro}\n` : ''}`
  const doc = parseDoc(base)

  const bySection = new Map<string, Contribution[]>()
  for (const c of opts.contributions) {
    if (!bySection.has(c.sectionId)) bySection.set(c.sectionId, [])
    bySection.get(c.sectionId)!.push(c)
  }

  // Append blocks into existing canonical sections; create the missing ones in canonical order.
  for (const id of order) {
    if (id === 'intro') continue
    const contribs = bySection.get(id)
    let section = doc.find(s => s.id === id)
    if (!contribs?.length) {
      // A canonical section we created earlier and that is now empty disappears.
      if (section && trimBlank(section.lines).length === 0) doc.splice(doc.indexOf(section), 1)
      continue
    }
    if (!section) {
      const title = sections.find(s => s.id === id)!.title
      section = { id, heading: `## ${title}`, lines: [] }
      // Insert after the last canonical section that precedes this id in canonical order.
      let insertAt = doc.length
      for (let i = doc.length - 1; i >= 1; i--) {
        const sid = doc[i]!.id
        if (sid && order.indexOf(sid) < order.indexOf(id)) {
          insertAt = i + 1
          break
        }
      }
      if (insertAt === doc.length) {
        // No canonical predecessor: right after the preamble, unless user sections exist before
        // any canonical one — then after the last user section that precedes the first canonical.
        const firstCanonical = doc.findIndex((s, i) => i > 0 && s.id && order.indexOf(s.id) > order.indexOf(id))
        insertAt = firstCanonical === -1 ? doc.length : firstCanonical
      }
      doc.splice(insertAt, 0, section)
    }
    const body = trimBlank(section.lines)
    section.lines = [...(body.length ? [...body, ''] : []), ...contribs.flatMap(renderBlock)]
  }

  const out: string[] = []
  doc.forEach((s, i) => {
    if (s.heading) out.push(s.heading, '')
    const body = trimBlank(s.lines)
    if (body.length) out.push(...body, '')
    else if (i === 0 && !s.heading) { /* empty preamble */ }
  })
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run test/unit/setup-render.test.ts test/unit/setup-sections.test.ts` → PASS. If the exact string expectation in the first `composeClaudeMd` test is off by a blank line, fix the renderer (not the test): the intended output is exactly one blank line after every heading and after every block, and the file ends with a single newline. `pnpm typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add shared/setup test/unit/setup-render.test.ts
git commit -m "feat: marker blocks, placeholders and CLAUDE.md section composition"
```

---

### Task 3: Base schema, profiles and secrets parsers (pure)

**Files:**
- Create: `server/lib/setup/base.ts`, `server/lib/setup/profiles.ts`, `server/lib/setup/secrets.ts`
- Create fixtures: `test/fixtures/base/sections.yaml`, `test/fixtures/base/questions.yaml`, `test/fixtures/base/fragments/pm/pnpm.md`, `test/fixtures/base/fragments/pm/npm.md`, `test/fixtures/base/fragments/layout/monorepo.md`, `test/fixtures/base/always/self-improvement.md`, `test/fixtures/base/templates/browser-testing-project.md`, `test/fixtures/profiles/demo.yaml`
- Test: `test/unit/setup-base.test.ts`, `test/unit/setup-secrets.test.ts`
- Modify: `package.json` (add dependency `"yaml": "^2.9.0"`; run `pnpm install`)

**Interfaces:**
- Consumes: `BaseSchema`, `BaseAxis`, `Profile` (Task 1), `splitSnippet`, `CANONICAL_SECTIONS` (Task 1).
- Produces:
  ```ts
  // base.ts — keys of `files` are paths relative to base/ (e.g. "questions.yaml", "fragments/pm/pnpm.md")
  export function parseBaseSchema(files: Record<string, Uint8Array>): { schema: BaseSchema | null; errors: string[] }
  export function validateBaseAgainstSlugs(schema: BaseSchema, slugs: string[]): string[]   // unknown `selects`
  // profiles.ts — keys relative to profiles/ (e.g. "nuxt-app.yaml")
  export function parseProfiles(files: Record<string, Uint8Array>, schema: BaseSchema | null, slugs: string[]): { profiles: Profile[]; errors: string[] }
  // secrets.ts
  export interface SecretFinding { path: string; line: number; rule: string; severity: 'fail' | 'warn'; excerpt: string }
  export function scanForSecrets(files: Record<string, Uint8Array>, pathPrefix?: string): SecretFinding[]
  ```

- [ ] **Step 1: Create the fixtures**

```bash
mkdir -p test/fixtures/base/fragments/pm test/fixtures/base/fragments/layout test/fixtures/base/always test/fixtures/base/templates test/fixtures/profiles
cat > test/fixtures/base/sections.yaml <<'EOF'
sections:
  - { id: intro, title: "" }
  - { id: read-first, title: "Read first" }
  - { id: stack, title: "Stack" }
  - { id: commands, title: "Commands" }
  - { id: workflow, title: "Workflow" }
  - { id: testing, title: "Testing" }
  - { id: docs, title: "Docs" }
  - { id: git, title: "Git" }
  - { id: deploy, title: "Deploy" }
  - { id: constraints, title: "Constraints that bit before" }
  - { id: memory, title: "Memory" }
  - { id: skills-and-rules, title: "Skills and rules" }
  - { id: self-improvement, title: "Self-improvement" }
EOF
cat > test/fixtures/base/questions.yaml <<'EOF'
version: 1
axes:
  - id: pm
    question: Which package manager?
    default: pnpm
    options:
      - { id: pnpm, label: pnpm, fragment: pm/pnpm.md }
      - { id: npm, label: npm, fragment: pm/npm.md }
  - id: layout
    question: How is the repo laid out?
    default: single
    options:
      - { id: single, label: Single app }
      - { id: monorepo, label: Monorepo, fragment: layout/monorepo.md, selects: [demo] }
  - id: appDir
    question: Where does the app live?
    when: { axis: layout, option: monorepo }
    input: { placeholder: apps/web/app, default: apps/web/app }
EOF
printf '## Commands\n- Always `{{pm}}`; never npm or yarn.\n' > test/fixtures/base/fragments/pm/pnpm.md
printf '## Commands\n- This project uses npm (package-lock.json present).\n' > test/fixtures/base/fragments/pm/npm.md
printf '## Constraints that bit before\n- App code lives under `{{appDir}}`; rule globs must use that prefix.\n' > test/fixtures/base/fragments/layout/monorepo.md
printf '## Self-improvement\n- Update CLAUDE.md proactively; keep it concise.\n' > test/fixtures/base/always/self-improvement.md
printf '# Browser testing for {{projectName}}\n\nDev URL: TODO\n' > test/fixtures/base/templates/browser-testing-project.md
cat > test/fixtures/profiles/demo.yaml <<'EOF'
name: demo
description: Fixture profile.
answers: { pm: pnpm, layout: single }
bundles: [demo]
EOF
find test/fixtures/base test/fixtures/profiles -type f | wc -l   # → 8
```

- [ ] **Step 2: Write the failing tests**

`test/unit/setup-base.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBaseSchema, validateBaseAgainstSlugs } from '../../server/lib/setup/base'
import { parseProfiles } from '../../server/lib/setup/profiles'

function readTree(root: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name)
      if (statSync(abs).isDirectory()) walk(abs)
      else out[relative(root, abs).split('\\').join('/')] = new Uint8Array(readFileSync(abs))
    }
  }
  walk(root)
  return out
}
const enc = (s: string) => new TextEncoder().encode(s)
const baseFiles = readTree(fileURLToPath(new URL('../fixtures/base', import.meta.url)))
const profileFiles = readTree(fileURLToPath(new URL('../fixtures/profiles', import.meta.url)))

describe('parseBaseSchema', () => {
  it('parses the fixture base', () => {
    const { schema, errors } = parseBaseSchema(baseFiles)
    expect(errors).toEqual([])
    expect(schema!.version).toBe(1)
    expect(schema!.sections.map(s => s.id)[3]).toBe('commands')
    expect(schema!.axes.map(a => a.id)).toEqual(['pm', 'layout', 'appDir'])
    expect(schema!.axes[2]!.when).toEqual({ axis: 'layout', option: 'monorepo' })
    expect(schema!.fragments['pm/pnpm.md']).toContain('Always `{{pm}}`')
    expect(schema!.always['self-improvement.md']).toContain('Update CLAUDE.md')
    expect(schema!.templates['browser-testing-project.md']).toContain('{{projectName}}')
  })

  it('reports a missing fragment, a bad default and an unknown follow-up axis', () => {
    const files = { ...baseFiles }
    files['questions.yaml'] = enc(`version: 1
axes:
  - id: pm
    question: Q
    default: bun
    options:
      - { id: pnpm, label: pnpm, fragment: pm/missing.md }
  - id: extra
    question: Q2
    when: { axis: nope, option: x }
    input: { placeholder: p, default: d }
`)
    const { schema, errors } = parseBaseSchema(files)
    expect(schema).toBeNull()
    expect(errors).toEqual(expect.arrayContaining([
      'axis "pm": default "bun" is not one of its options',
      'axis "pm": option "pnpm" fragment "pm/missing.md" does not exist',
      'axis "extra": when.axis "nope" is not an earlier axis'
    ]))
  })

  it('rejects a fragment with a non-canonical heading and a wrong section list', () => {
    const files = { ...baseFiles }
    files['fragments/pm/pnpm.md'] = enc('## Random\n- x\n')
    files['sections.yaml'] = enc('sections:\n  - { id: intro, title: "" }\n  - { id: commands, title: "Commands" }\n')
    const { errors } = parseBaseSchema(files)
    expect(errors).toEqual(expect.arrayContaining([
      'fragments/pm/pnpm.md: unknown section heading "Random" (use a canonical title or ## @id)',
      'sections.yaml: section ids must be exactly the canonical list in order'
    ]))
  })

  it('requires exactly one of options/input and rejects duplicate axis ids', () => {
    const files = { ...baseFiles }
    files['questions.yaml'] = enc('version: 1\naxes:\n  - { id: a, question: Q }\n  - { id: a, question: Q, input: { placeholder: p, default: d } }\n')
    const { errors } = parseBaseSchema(files)
    expect(errors).toEqual(expect.arrayContaining(['axis "a": needs either options or input', 'axis "a": duplicate id']))
  })

  it('reports missing files', () => {
    expect(parseBaseSchema({}).errors).toEqual(['base/questions.yaml is missing', 'base/sections.yaml is missing'])
  })
})

describe('validateBaseAgainstSlugs', () => {
  it('flags selects that reference unknown bundles', () => {
    const { schema } = parseBaseSchema(baseFiles)
    expect(validateBaseAgainstSlugs(schema!, ['demo'])).toEqual([])
    expect(validateBaseAgainstSlugs(schema!, ['other'])).toEqual(['axis "layout": option "monorepo" selects unknown bundle "demo"'])
  })
})

describe('parseProfiles', () => {
  const { schema } = parseBaseSchema(baseFiles)
  it('parses valid profiles', () => {
    const { profiles, errors } = parseProfiles(profileFiles, schema, ['demo'])
    expect(errors).toEqual([])
    expect(profiles).toEqual([{ name: 'demo', description: 'Fixture profile.', answers: { pm: 'pnpm', layout: 'single' }, bundles: ['demo'] }])
  })
  it('validates name, answers and bundles', () => {
    const files = { 'bad.yaml': enc('name: other\ndescription: d\nanswers: { pm: bun, nope: x }\nbundles: [ghost]\n') }
    const { profiles, errors } = parseProfiles(files, schema, ['demo'])
    expect(profiles).toEqual([])
    expect(errors).toEqual(expect.arrayContaining([
      'profiles/bad.yaml: name "other" must match the file name "bad"',
      'profiles/bad.yaml: answer pm="bun" is not an option',
      'profiles/bad.yaml: answer for unknown axis "nope"',
      'profiles/bad.yaml: unknown bundle "ghost"'
    ]))
  })
  it('accepts free text for input axes and reports YAML errors', () => {
    const ok = parseProfiles({ 'mono.yaml': enc('name: mono\ndescription: d\nanswers: { layout: monorepo, appDir: packages/site/app }\nbundles: []\n') }, schema, [])
    expect(ok.errors).toEqual([])
    const bad = parseProfiles({ 'x.yaml': enc('name: [unclosed') }, schema, [])
    expect(bad.errors[0]).toMatch(/^profiles\/x\.yaml: invalid YAML/)
  })
})
```

`test/unit/setup-secrets.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { scanForSecrets } from '../../server/lib/setup/secrets'

const enc = (s: string) => new TextEncoder().encode(s)

describe('scanForSecrets', () => {
  it('fails on token-like values and connection strings', () => {
    const findings = scanForSecrets({
      'skills/a/SKILL.md': enc('key: sk-abcdefghijklmnopqrstuvwxyz1234\n'),
      'settings.json': enc('{"token": "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"}'),
      'rules/db.md': enc('DATABASE_URL=postgres://user:hunter2hunter2@db.example.com/x\n'),
      'README.md': enc('password: correct-horse-battery\n')
    })
    expect(findings.map(f => [f.path, f.severity, f.rule])).toEqual(expect.arrayContaining([
      ['skills/a/SKILL.md', 'fail', 'api-key'],
      ['settings.json', 'fail', 'github-token'],
      ['rules/db.md', 'fail', 'connection-string'],
      ['README.md', 'fail', 'credential-assignment']
    ]))
  })

  it('warns on private IPs and internal hostnames', () => {
    const findings = scanForSecrets({ 'SKILL.md': enc('ssh root@192.168.2.50 and http://nas.local:8080 and 10.0.0.7\n') }, 'skills/x/')
    expect(findings.map(f => [f.path, f.severity, f.rule])).toEqual(expect.arrayContaining([
      ['skills/x/SKILL.md', 'warn', 'private-ip'],
      ['skills/x/SKILL.md', 'warn', 'internal-hostname']
    ]))
    expect(findings[0]!.line).toBe(1)
    expect(findings[0]!.excerpt.length).toBeLessThanOrEqual(80)
  })

  it('ignores prose mentions, placeholders and binary files', () => {
    expect(scanForSecrets({
      'README.md': enc('Store the password in the project skill, never here. Use {{pm}}.\nTOKEN=<your-token>\n'),
      'blob.bin': new Uint8Array([0x89, 0x50, 0x00, 0x41])
    })).toEqual([])
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm add yaml@^2.9.0 && pnpm vitest run test/unit/setup-base.test.ts test/unit/setup-secrets.test.ts` → FAIL (modules missing).

- [ ] **Step 4: Implement**

`server/lib/setup/base.ts`:
```ts
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import type { BaseAxis, BaseSchema, SectionDef } from '../../../shared/types/setup'
import { CANONICAL_SECTIONS, splitSnippet } from '../../../shared/setup/sections'

const decoder = new TextDecoder()

const optionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1),
  description: z.string().optional(),
  fragment: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\.md$/).optional(),
  selects: z.array(z.string()).optional()
})

const axisSchema = z.object({
  id: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
  question: z.string().min(1),
  description: z.string().optional(),
  when: z.object({ axis: z.string(), option: z.string() }).optional(),
  options: z.array(optionSchema).min(1).optional(),
  default: z.string().optional(),
  input: z.object({ placeholder: z.string(), default: z.string() }).optional()
})

const questionsSchema = z.object({ version: z.number().int().positive(), axes: z.array(axisSchema).min(1) })
const sectionsSchema = z.object({ sections: z.array(z.object({ id: z.string(), title: z.string() })) })

function text(files: Record<string, Uint8Array>, key: string): string | undefined {
  const bytes = files[key]
  return bytes ? decoder.decode(bytes) : undefined
}

function yamlOrError(src: string, label: string, errors: string[]): unknown {
  try {
    return parseYaml(src)
  } catch (err) {
    errors.push(`${label}: invalid YAML: ${(err as Error).message.split('\n')[0]}`)
    return undefined
  }
}

function collect(files: Record<string, Uint8Array>, dir: string, errors: string[], validateSections: boolean): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith(`${dir}/`) || !path.endsWith('.md')) continue
    const md = decoder.decode(bytes)
    if (validateSections) {
      for (const e of splitSnippet(md).errors) errors.push(`${path}: ${e}`)
    }
    out[path.slice(dir.length + 1)] = md
  }
  return out
}

export function parseBaseSchema(files: Record<string, Uint8Array>): { schema: BaseSchema | null, errors: string[] } {
  const errors: string[] = []
  const questionsSrc = text(files, 'questions.yaml')
  const sectionsSrc = text(files, 'sections.yaml')
  if (questionsSrc === undefined) errors.push('base/questions.yaml is missing')
  if (sectionsSrc === undefined) errors.push('base/sections.yaml is missing')
  if (errors.length) return { schema: null, errors }

  let sections: SectionDef[] = CANONICAL_SECTIONS
  const sectionsRaw = yamlOrError(sectionsSrc!, 'sections.yaml', errors)
  if (sectionsRaw !== undefined) {
    const parsed = sectionsSchema.safeParse(sectionsRaw)
    if (!parsed.success) {
      errors.push('sections.yaml: expected { sections: [{ id, title }] }')
    } else {
      const ids = parsed.data.sections.map(s => s.id)
      if (JSON.stringify(ids) !== JSON.stringify(CANONICAL_SECTIONS.map(s => s.id))) {
        errors.push('sections.yaml: section ids must be exactly the canonical list in order')
      } else {
        sections = parsed.data.sections
      }
    }
  }

  const fragments = collect(files, 'fragments', errors, true)
  const always = collect(files, 'always', errors, true)
  const templates = collect(files, 'templates', errors, false)

  let axes: BaseAxis[] = []
  let version = 0
  const questionsRaw = yamlOrError(questionsSrc!, 'questions.yaml', errors)
  if (questionsRaw !== undefined) {
    const parsed = questionsSchema.safeParse(questionsRaw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`questions.yaml: ${issue.path.join('.')}: ${issue.message}`)
    } else {
      version = parsed.data.version
      axes = parsed.data.axes as BaseAxis[]
      const seen = new Set<string>()
      axes.forEach((axis, index) => {
        const tag = `axis "${axis.id}"`
        if (seen.has(axis.id)) errors.push(`${tag}: duplicate id`)
        seen.add(axis.id)
        const hasOptions = !!axis.options?.length
        const hasInput = !!axis.input
        if (hasOptions === hasInput) errors.push(`${tag}: needs either options or input`)
        if (hasOptions) {
          if (!axis.default || !axis.options!.some(o => o.id === axis.default)) {
            errors.push(`${tag}: default "${axis.default ?? ''}" is not one of its options`)
          }
          for (const option of axis.options!) {
            if (option.fragment && !(option.fragment in fragments)) {
              errors.push(`${tag}: option "${option.id}" fragment "${option.fragment}" does not exist`)
            }
          }
        }
        if (axis.when) {
          const earlier = axes.slice(0, index).find(a => a.id === axis.when!.axis)
          if (!earlier) errors.push(`${tag}: when.axis "${axis.when.axis}" is not an earlier axis`)
          else if (!earlier.options?.some(o => o.id === axis.when!.option)) {
            errors.push(`${tag}: when.option "${axis.when.option}" is not an option of "${axis.when.axis}"`)
          }
        }
      })
    }
  }

  if (errors.length) return { schema: null, errors }
  return { schema: { version, sections, axes, fragments, always, templates }, errors }
}

export function validateBaseAgainstSlugs(schema: BaseSchema, slugs: string[]): string[] {
  const known = new Set(slugs)
  const errors: string[] = []
  for (const axis of schema.axes) {
    for (const option of axis.options ?? []) {
      for (const slug of option.selects ?? []) {
        if (!known.has(slug)) errors.push(`axis "${axis.id}": option "${option.id}" selects unknown bundle "${slug}"`)
      }
    }
  }
  return errors
}
```

`server/lib/setup/profiles.ts`:
```ts
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import type { BaseSchema, Profile } from '../../../shared/types/setup'

const decoder = new TextDecoder()

const profileSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  description: z.string().min(1),
  answers: z.record(z.string(), z.string()).default({}),
  bundles: z.array(z.string()).default([])
})

export function parseProfiles(files: Record<string, Uint8Array>, schema: BaseSchema | null, slugs: string[]): { profiles: Profile[], errors: string[] } {
  const profiles: Profile[] = []
  const errors: string[] = []
  const known = new Set(slugs)

  for (const path of Object.keys(files).sort()) {
    if (!path.endsWith('.yaml') && !path.endsWith('.yml')) continue
    const label = `profiles/${path}`
    const fileName = path.replace(/\.ya?ml$/, '')
    let raw: unknown
    try {
      raw = parseYaml(decoder.decode(files[path]!))
    } catch (err) {
      errors.push(`${label}: invalid YAML: ${(err as Error).message.split('\n')[0]}`)
      continue
    }
    const parsed = profileSchema.safeParse(raw)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${label}: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      continue
    }
    const profile = parsed.data
    let ok = true
    if (profile.name !== fileName) {
      errors.push(`${label}: name "${profile.name}" must match the file name "${fileName}"`)
      ok = false
    }
    for (const [axisId, value] of Object.entries(profile.answers)) {
      const axis = schema?.axes.find(a => a.id === axisId)
      if (!axis) {
        errors.push(`${label}: answer for unknown axis "${axisId}"`)
        ok = false
      } else if (axis.options && !axis.options.some(o => o.id === value)) {
        errors.push(`${label}: answer ${axisId}="${value}" is not an option`)
        ok = false
      }
    }
    for (const slug of profile.bundles) {
      if (!known.has(slug)) {
        errors.push(`${label}: unknown bundle "${slug}"`)
        ok = false
      }
    }
    if (ok) profiles.push(profile)
  }
  return { profiles, errors }
}
```

`server/lib/setup/secrets.ts`:
```ts
export interface SecretFinding {
  path: string
  line: number
  rule: string
  severity: 'fail' | 'warn'
  excerpt: string
}

const RULES: { rule: string, severity: 'fail' | 'warn', re: RegExp }[] = [
  { rule: 'api-key', severity: 'fail', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { rule: 'github-token', severity: 'fail', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { rule: 'connection-string', severity: 'fail', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s/]+:[^@\s]+@/i },
  { rule: 'credential-assignment', severity: 'fail', re: /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i },
  { rule: 'private-ip', severity: 'warn', re: /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/ },
  { rule: 'internal-hostname', severity: 'warn', re: /\b[a-z0-9-]+\.(?:local|lan|home|internal)\b/i }
]

const decoder = new TextDecoder()

function isBinary(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.byteLength, 8000)
  for (let i = 0; i < end; i++) if (bytes[i] === 0) return true
  return false
}

/** Scan published text for secrets/private infrastructure. `pathPrefix` is prepended to reported paths. */
export function scanForSecrets(files: Record<string, Uint8Array>, pathPrefix = ''): SecretFinding[] {
  const findings: SecretFinding[] = []
  for (const [path, bytes] of Object.entries(files)) {
    if (bytes.byteLength > 1024 * 1024 || isBinary(bytes)) continue
    const lines = decoder.decode(bytes).split('\n')
    lines.forEach((line, i) => {
      // Placeholders like <your-token> or {{pm}} are documentation, not values.
      const stripped = line.replace(/<[^>]+>/g, '').replace(/\{\{[^}]+\}\}/g, '')
      for (const { rule, severity, re } of RULES) {
        if (re.test(stripped)) {
          findings.push({ path: pathPrefix + path, line: i + 1, rule, severity, excerpt: line.trim().slice(0, 80) })
        }
      }
    })
  }
  return findings
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:unit` → all PASS (adjust the exact error-message expectations in code, not tests, if wording differs). `pnpm typecheck` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml server/lib/setup test/fixtures/base test/fixtures/profiles test/unit/setup-base.test.ts test/unit/setup-secrets.test.ts
git commit -m "feat: base schema, profile and secrets parsers"
```

---

### Task 4: Snapshot carries base and profiles; sources collect them

**Files:**
- Modify: `server/lib/skills/types.ts`, `server/lib/skills/parse-bundle.ts`, `server/lib/skills/archive.ts`, `server/lib/skills/fs-source.ts`, `server/lib/skills/github-source.ts`, `server/lib/skills/store.ts`
- Modify tests: `test/unit/archive.test.ts`, `test/unit/fs-source.test.ts`, `test/unit/store.test.ts`, `test/unit/parse-bundle.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export interface RawExtras { base: BundleFiles; profiles: BundleFiles }   // keys relative to base/ and profiles/
  export interface Snapshot extends SnapshotMeta {
    skills: SkillManifest[]; files: Record<string, BundleFiles>
    base: BaseSchema | null; baseErrors: string[]; profiles: Profile[]; profileErrors: string[]
  }
  // parse-bundle.ts
  export function buildSnapshot(bundles: RawBundle[], meta: SnapshotMeta, extras?: RawExtras): Snapshot
  // archive.ts
  export function extractArchive(zip: Uint8Array | ArrayBuffer): { bundles: RawBundle[]; extras: RawExtras }
  // fs-source.ts
  export function createFsSource(dir: string, opts?: { baseDir?: string; profilesDir?: string }): SkillsSource  // defaults: <dir>/../base, <dir>/../profiles
  // store.ts
  export interface ManifestRecord { meta: SnapshotMeta; skills: SkillManifest[]; base: BaseSchema | null; baseErrors: string[]; profiles: Profile[]; profileErrors: string[] }
  ```
- `buildSnapshot` cross-validates: `validateBaseAgainstSlugs` errors → `baseErrors`; per bundle, `dependsOn`/`suggests` slugs that don't exist → `errors.push('dependsOn references unknown bundle "x"')` (same for suggests). `extractBundles` is removed (replace its callers/tests).

- [ ] **Step 1: Extend the tests**

Append to `test/unit/parse-bundle.test.ts` inside `describe('buildSnapshot')`:
```ts
  it('parses base and profiles from extras and cross-validates slugs', () => {
    const meta = { sha: 'x', committedAt: '2026-09-03T00:00:00.000Z', fetchedAt: '2026-09-03T00:00:01.000Z', source: 'fs' as const }
    const extras = {
      base: {
        'sections.yaml': enc(readFileSync(new URL('../fixtures/base/sections.yaml', import.meta.url), 'utf8')),
        'questions.yaml': enc(readFileSync(new URL('../fixtures/base/questions.yaml', import.meta.url), 'utf8')),
        'fragments/pm/pnpm.md': enc('## Commands\n- pnpm\n'),
        'fragments/pm/npm.md': enc('## Commands\n- npm\n'),
        'fragments/layout/monorepo.md': enc('## Constraints that bit before\n- x\n')
      },
      profiles: { 'demo.yaml': enc('name: demo\ndescription: d\nanswers: { pm: pnpm }\nbundles: [demo]\n') }
    }
    const snap = buildSnapshot([{ slug: 'demo', files: { 'README.md': enc(readme) } }], meta, extras)
    expect(snap.baseErrors).toEqual([])
    expect(snap.base!.axes.map(a => a.id)).toEqual(['pm', 'layout', 'appDir'])
    expect(snap.profiles.map(p => p.name)).toEqual(['demo'])
    expect(snap.profileErrors).toEqual([])
  })

  it('defaults to no base and no profiles', () => {
    const meta = { sha: 'x', committedAt: '2026-09-03T00:00:00.000Z', fetchedAt: '2026-09-03T00:00:01.000Z', source: 'fs' as const }
    const snap = buildSnapshot([], meta)
    expect(snap.base).toBeNull()
    expect(snap.baseErrors).toEqual([])   // no base dir at all is not an error
    expect(snap.profiles).toEqual([])
  })

  it('flags dependsOn/suggests that reference unknown bundles', () => {
    const meta = { sha: 'x', committedAt: '2026-09-03T00:00:00.000Z', fetchedAt: '2026-09-03T00:00:01.000Z', source: 'fs' as const }
    const withDeps = readme.replace('author: Tester', 'author: Tester\ndependsOn: [nuxt]\nsuggests: [ghost]')
    const snap = buildSnapshot([{ slug: 'demo', files: { 'README.md': enc(withDeps) } }, { slug: 'nuxt', files: { 'README.md': enc(readme) } }], meta)
    const demo = snap.skills.find(s => s.slug === 'demo')!
    expect(demo.dependsOn).toEqual(['nuxt'])
    expect(demo.errors).toEqual(['suggests references unknown bundle "ghost"'])
  })
```
Add `import { readFileSync } from 'node:fs'` at the top of that test file. (The `dependsOn`/`suggests` frontmatter keys are added to the schema in Task 5; write this test now, it goes green there — mark it `it.todo` until Task 5 if you prefer a green commit, then un-todo in Task 5.)

In `test/unit/archive.test.ts`: rename every `extractBundles(...)` call to `extractArchive(...).bundles`, and add:
```ts
  it('collects base/** and profiles/** as extras', async () => {
    const zip = zipSync({
      'Patrity-skills-abc1234/base/questions.yaml': strToU8('version: 1\naxes: []\n'),
      'Patrity-skills-abc1234/base/fragments/pm/pnpm.md': strToU8('## Commands\n- pnpm\n'),
      'Patrity-skills-abc1234/profiles/nuxt-app.yaml': strToU8('name: nuxt-app\n'),
      'Patrity-skills-abc1234/skills/demo/README.md': strToU8('x')
    })
    const { bundles, extras } = extractArchive(zip)
    expect(bundles.map(b => b.slug)).toEqual(['demo'])
    expect(Object.keys(extras.base).sort()).toEqual(['fragments/pm/pnpm.md', 'questions.yaml'])
    expect(Object.keys(extras.profiles)).toEqual(['nuxt-app.yaml'])
  })
```

In `test/unit/fs-source.test.ts` add:
```ts
  it('reads sibling base/ and profiles/ directories', async () => {
    const snap = await createFsSource(fixtures).load()
    expect(snap.base?.axes.map(a => a.id)).toEqual(['pm', 'layout', 'appDir'])
    expect(snap.profiles.map(p => p.name)).toEqual(['demo'])
    expect(snap.baseErrors).toEqual([])
  })
```
(The fixture `test/fixtures/skills` now has siblings `test/fixtures/base` and `test/fixtures/profiles` from Task 3; the `demo` profile's `bundles: [demo]` matches the `demo` fixture bundle.)

In `test/unit/store.test.ts` the `snapshot()` helper must return the new fields (`base: null, baseErrors: [], profiles: [], profileErrors: []`) and the cold-start test additionally asserts `first.profiles` is `[]` and the cached manifest record round-trips `base`/`profiles`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit` → FAIL on the new/changed cases (type errors on `Snapshot`, missing `extractArchive`).

- [ ] **Step 3: Implement**

`server/lib/skills/types.ts` — add:
```ts
import type { BaseSchema, Profile } from '../../../shared/types/setup'

export interface RawExtras {
  /** Files under base/, keys relative to it. */
  base: BundleFiles
  /** Files under profiles/, keys relative to it. */
  profiles: BundleFiles
}
```
and extend `Snapshot`:
```ts
export interface Snapshot extends SnapshotMeta {
  skills: SkillManifest[]
  files: Record<string, BundleFiles>
  base: BaseSchema | null
  baseErrors: string[]
  profiles: Profile[]
  profileErrors: string[]
}
```

`server/lib/skills/parse-bundle.ts` — replace `buildSnapshot`:
```ts
import { parseBaseSchema, validateBaseAgainstSlugs } from '../setup/base'
import { parseProfiles } from '../setup/profiles'
import type { RawExtras } from './types'

const NO_EXTRAS: RawExtras = { base: {}, profiles: {} }

export function buildSnapshot(bundles: RawBundle[], meta: SnapshotMeta, extras: RawExtras = NO_EXTRAS): Snapshot {
  const skills: SkillManifest[] = []
  const files: Record<string, BundleFiles> = {}
  for (const bundle of [...bundles].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const parsed = parseBundle(bundle)
    skills.push(parsed.manifest)
    files[bundle.slug] = parsed.files
  }

  const slugs = skills.map(s => s.slug)
  for (const skill of skills) {
    for (const [key, list] of [['dependsOn', skill.dependsOn], ['suggests', skill.suggests]] as const) {
      for (const slug of list ?? []) {
        if (!slugs.includes(slug)) skill.errors.push(`${key} references unknown bundle "${slug}"`)
      }
    }
  }

  let base: BaseSchema | null = null
  let baseErrors: string[] = []
  if (Object.keys(extras.base).length) {
    const parsed = parseBaseSchema(extras.base)
    base = parsed.schema
    baseErrors = parsed.errors
    if (base) baseErrors.push(...validateBaseAgainstSlugs(base, slugs))
    if (baseErrors.length) base = null
  }
  const profilesParsed = Object.keys(extras.profiles).length ? parseProfiles(extras.profiles, base, slugs) : { profiles: [], errors: [] }

  return { ...meta, skills, files, base, baseErrors, profiles: profilesParsed.profiles, profileErrors: profilesParsed.errors }
}
```
(add `import type { BaseSchema } from '../../../shared/types/setup'`.)

`server/lib/skills/archive.ts` — replace the export:
```ts
const ENTRY_RE = /^[^/]+\/(skills\/[^/]+\/.+|base\/.+|profiles\/.+)$/

export function extractArchive(zip: Uint8Array | ArrayBuffer): { bundles: RawBundle[], extras: RawExtras } {
  const data = zip instanceof Uint8Array ? zip : new Uint8Array(zip)
  const entries = unzipSync(data, { filter: file => !file.name.endsWith('/') && ENTRY_RE.test(file.name) })
  const bySlug = new Map<string, BundleFiles>()
  const extras: RawExtras = { base: {}, profiles: {} }
  for (const [name, bytes] of Object.entries(entries)) {
    const [, top, second, ...rest] = name.split('/')
    const payload = bytes ?? new Uint8Array(0)
    if (top === 'base' || top === 'profiles') {
      const rel = [second, ...rest].join('/')
      if (isSafeRelativePath(rel) && !isExcludedPath(rel)) extras[top][rel] = payload
      continue
    }
    const slug = second
    if (!slug || rest.length === 0 || slug.startsWith('.')) continue
    const rel = rest.join('/')
    if (!isSafeRelativePath(rel) || isExcludedPath(rel)) continue
    if (!bySlug.has(slug)) bySlug.set(slug, {})
    bySlug.get(slug)![rel] = payload
  }
  return { bundles: [...bySlug.entries()].map(([slug, files]) => ({ slug, files })), extras }
}
```
`github-source.ts`: `const { bundles, extras } = extractArchive(zip)` and `buildSnapshot(bundles, meta, extras)`; the "no bundles" throw stays.

`server/lib/skills/fs-source.ts`: `createFsSource(dir, opts = {})` computes `baseRoot = resolve(opts.baseDir ?? join(root, '..', 'base'))` and `profilesRoot` likewise; after the bundles loop, `const readDir = async (r) => { const found = []; try { await walk(r, r, found) } catch { return {} } … read bytes into a map, hashing paths+size+mtime as for bundles }`; call `buildSnapshot(bundles, meta, { base, profiles })`.

`server/lib/skills/store.ts`: `ManifestRecord` gains `base`, `baseErrors`, `profiles`, `profileErrors`; `loadFromSource` builds the record from the snapshot with those fields; `isValidManifestRecord` additionally requires `Array.isArray(profiles)` and `Array.isArray(baseErrors)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit` → PASS; `pnpm typecheck` → exit 0. Then `pnpm test` (e2e still green — the API surface is unchanged so far).

- [ ] **Step 5: Commit**

```bash
git add server/lib test/unit
git commit -m "feat: snapshot carries base schema and profiles from base/ and profiles/"
```

---

### Task 5: Frontmatter dependsOn/suggests, settings.json badge, snippet validation, validator upgrades

**Files:**
- Modify: `server/lib/skills/frontmatter.ts`, `server/lib/skills/parse-bundle.ts`, `server/lib/skills/tree.ts`, `scripts/validate-skills.ts`
- Test: `test/unit/frontmatter.test.ts`, `test/unit/tree.test.ts`, `test/unit/parse-bundle.test.ts` (un-todo the Task 4 case)

**Interfaces:**
- `frontmatterSchema` gains `dependsOn: z.array(z.string().regex(SLUG_RE)).optional()`, `suggests: z.array(z.string().regex(SLUG_RE)).optional()`; `parseBundle` copies them onto the manifest.
- `deriveBadges`: `settings` badge when `settings.json` **or** `settings.local.json` exists at the bundle root.
- `parseBundle`: if `CLAUDE.md` (case-insensitive) exists, `splitSnippet` it and push each error as `CLAUDE.md: <error>` into `manifest.errors`.
- `scripts/validate-skills.ts` exits 1 on: any bundle error, any `baseErrors`, any `profileErrors`, any `fail` secret finding across bundles + base + profiles; prints `warn` findings; prints `✓ base (N axes, M profiles)` when valid.

- [ ] **Step 1: Write the failing tests**

`test/unit/frontmatter.test.ts` — add:
```ts
  it('accepts dependsOn/suggests slugs and rejects malformed ones', () => {
    const ok = parseFrontmatter('---\nname: X\ndescription: d\ntags: [t]\nauthor: a\ndependsOn: [nuxt]\nsuggests: [browser-testing]\n---\n')
    expect(ok.errors).toEqual([])
    expect(ok.data).toMatchObject({ dependsOn: ['nuxt'], suggests: ['browser-testing'] })
    const bad = parseFrontmatter('---\nname: X\ndescription: d\ntags: [t]\nauthor: a\ndependsOn: [Bad_Slug]\n---\n')
    expect(bad.errors.some(e => e.startsWith('frontmatter.dependsOn.0:'))).toBe(true)
  })
```
`test/unit/tree.test.ts` — add:
```ts
  it('treats settings.json like settings.local.json for the badge', () => {
    expect(deriveBadges(['settings.json'])).toEqual(['settings'])
  })
```
`test/unit/parse-bundle.test.ts` — add:
```ts
  it('validates CLAUDE.md snippet headings', () => {
    const { manifest } = parseBundle({ slug: 'demo', files: { 'README.md': enc(readme), 'CLAUDE.md': enc('## Nope\n- x\n## Commands\n- y\n') } })
    expect(manifest.errors).toEqual(['CLAUDE.md: unknown section heading "Nope" (use a canonical title or ## @id)'])
  })
  it('accepts an unheaded CLAUDE.md snippet (goes to skills-and-rules)', () => {
    const { manifest } = parseBundle({ slug: 'demo', files: { 'README.md': enc(readme), 'CLAUDE.md': enc('- invoke things\n') } })
    expect(manifest.errors).toEqual([])
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test:unit` → the new cases FAIL.

- [ ] **Step 3: Implement**

`frontmatter.ts` schema additions:
```ts
  dependsOn: z.array(z.string().regex(SLUG_RE)).optional(),
  suggests: z.array(z.string().regex(SLUG_RE)).optional()
```
`parse-bundle.ts` manifest: `dependsOn: fm?.dependsOn, suggests: fm?.suggests`; and after the README handling:
```ts
  const claudeKey = Object.keys(files).find(p => p.toLowerCase() === 'claude.md')
  if (claudeKey) {
    for (const e of splitSnippet(decoder.decode(files[claudeKey])).errors) errors.push(`CLAUDE.md: ${e}`)
  }
```
(import `splitSnippet` from `'../../../shared/setup/sections'`.)
`tree.ts` `deriveBadges`: `else if (p === 'settings.local.json' || p === 'settings.json') found.add('settings')`.

`scripts/validate-skills.ts` — after the per-bundle loop:
```ts
import { scanForSecrets } from '../server/lib/setup/secrets'

// Base + profiles
if (snapshot.baseErrors.length) {
  failed++
  console.error('✗ base')
  for (const err of snapshot.baseErrors) console.error(`    - ${err}`)
} else if (snapshot.base) {
  console.log(`✓ base (${snapshot.base.axes.length} axes, ${snapshot.profiles.length} profiles)`)
}
if (snapshot.profileErrors.length) {
  failed++
  console.error('✗ profiles')
  for (const err of snapshot.profileErrors) console.error(`    - ${err}`)
}

// Secrets and private infrastructure must never be published.
const findings = [
  ...Object.entries(snapshot.files).flatMap(([slug, files]) => scanForSecrets(files, `skills/${slug}/`)),
  ...scanForSecrets(baseFiles, 'base/'),
  ...scanForSecrets(profileFiles, 'profiles/')
]
```
To get `baseFiles`/`profileFiles` the script reads the sibling dirs the same way `fs-source` does — export a small `readDirFiles(dir)` helper from `server/lib/skills/fs-source.ts` (the walker already exists there) and use it for both. Then:
```ts
for (const f of findings) {
  const line = `${f.severity === 'fail' ? '✗' : '⚠'} ${f.path}:${f.line} [${f.rule}] ${f.excerpt}`
  if (f.severity === 'fail') { failed++; console.error(line) } else console.warn(line)
}
```

- [ ] **Step 4: Run tests and the validator**

Run: `pnpm test:unit` → PASS. `pnpm validate:skills` → `✓ nuxt`, `✓ nuxt-ui`, `✓ browser-testing`, and (no `base/` dir yet) no base line; exit 0. `pnpm validate:skills test/fixtures/skills` → `✓ base (3 axes, 1 profiles)` plus the known ✗ broken/no-readme, exit 1. `pnpm typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/lib scripts/validate-skills.ts test/unit
git commit -m "feat: dependsOn/suggests, snippet heading validation and secrets scan in the validator"
```

---

### Task 6: Base content — sections, questions, fragments, templates, profiles

**Files:**
- Modify: `shared/types/setup.ts` (add `scaffolds` to `BaseOption`), `server/lib/setup/base.ts` (validate scaffold templates exist), `test/unit/setup-base.test.ts`
- Create: `base/sections.yaml`, `base/questions.yaml`, `base/fragments/**` (listed below), `base/always/{self-improvement,skills-philosophy,no-secrets}.md`, `base/templates/{browser-testing-project,browser-testing-auth-section}.md`, `profiles/{nuxt-app,library,docs-only}.yaml`

**Interfaces:**
- `BaseOption.scaffolds?: { template: string; to: string; mode?: 'create' | 'append' }[]` — `template` is a key of `BaseSchema.templates`; `to` is a project-relative path with placeholders; `append` appends to an existing file (the CLI implements it in Plan B). Validation: every `scaffolds[].template` must exist under `base/templates/`.
- Profiles reference bundles that exist after Task 8 (`quality-hooks`, `docs-discipline`); until then `pnpm validate:skills` reports them as unknown — run the validator against the real tree only at the end of Task 8, and use `test/fixtures` for the unit tests here.

- [ ] **Step 1: Add `scaffolds` to the schema (test first)**

Append to `test/unit/setup-base.test.ts`:
```ts
  it('validates scaffold templates', () => {
    const files = { ...baseFiles }
    files['questions.yaml'] = enc(`version: 1
axes:
  - id: browser
    question: Q
    default: cli
    options:
      - { id: cli, label: CLI, scaffolds: [{ template: browser-testing-project.md, to: ".claude/skills/{{projectName}}-browser-testing/SKILL.md" }] }
      - { id: broken, label: B, scaffolds: [{ template: nope.md, to: x.md, mode: append }] }
`)
    const { schema, errors } = parseBaseSchema(files)
    expect(schema).toBeNull()
    expect(errors).toEqual(['axis "browser": option "broken" scaffold template "nope.md" does not exist'])
  })
```
Run it → FAIL. Then in `shared/types/setup.ts` add to `BaseOption`:
```ts
  /** Files the wizard writes into the project when this option is chosen. */
  scaffolds?: { template: string, to: string, mode?: 'create' | 'append' }[]
```
In `server/lib/setup/base.ts`: extend `optionSchema` with `scaffolds: z.array(z.object({ template: z.string(), to: z.string().min(1), mode: z.enum(['create', 'append']).optional() })).optional()` and, inside the options loop, `for (const s of option.scaffolds ?? []) if (!(s.template in templates)) errors.push(\`${tag}: option "${option.id}" scaffold template "${s.template}" does not exist\`)`. Run → PASS.

- [ ] **Step 2: Write `base/sections.yaml` and `base/questions.yaml`**

`base/sections.yaml` is identical to `test/fixtures/base/sections.yaml` (copy it).

`base/questions.yaml`:
```yaml
version: 1
axes:
  - id: pm
    question: Which package manager does this project use?
    description: Sets the commands Claude runs and the lockfile rule.
    default: pnpm
    options:
      - { id: pnpm, label: pnpm, fragment: pm/pnpm.md }
      - { id: npm, label: npm, fragment: pm/npm.md }
      - { id: yarn, label: yarn, fragment: pm/yarn.md }
      - { id: bun, label: bun, fragment: pm/bun.md }

  - id: layout
    question: How is the repo laid out?
    description: Every rule glob is rewritten for the app directory you pick.
    default: single
    options:
      - { id: single, label: Single app (code under app/, server/, …) }
      - { id: monorepo, label: Monorepo (the app lives in a sub-package), fragment: layout/monorepo.md }

  - id: appDir
    question: Where does the app's srcDir live, relative to the repo root?
    when: { axis: layout, option: monorepo }
    input: { placeholder: apps/web/app, default: apps/web/app }

  - id: workflow
    question: How much process should Claude follow?
    default: full
    options:
      - { id: full, label: "Full: brainstorm → spec → plan → TDD → two-stage review", fragment: workflow/full.md }
      - { id: lightweight, label: "Lightweight: spec + TDD, no handovers", fragment: workflow/lightweight.md }
      - { id: none, label: None }

  - id: docs
    question: How should project docs be kept?
    default: mechanical
    options:
      - { id: mechanical, label: "Three-tier docs with a wiki-parity test", fragment: docs/mechanical.md, selects: [docs-discipline] }
      - { id: reminder, label: "Three-tier docs, reminder only", fragment: docs/reminder.md }
      - { id: none, label: None }

  - id: memory
    question: Use the MyMind memory server?
    default: on
    options:
      - { id: on, label: Yes, fragment: memory/on.md }
      - { id: off, label: No }

  - id: commits
    question: May Claude commit without asking?
    default: proactive
    options:
      - { id: proactive, label: "Yes — commit proactively, one concern per commit", fragment: git/commits-proactive.md }
      - { id: ask, label: "No — ask before every commit", fragment: git/commits-ask.md }

  - id: pushes
    question: May Claude push without asking?
    default: ask
    options:
      - { id: ask, label: "No — always ask before pushing", fragment: git/pushes-ask.md }
      - { id: proactive, label: "Yes — push when the work is verified", fragment: git/pushes-proactive.md }

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

  - id: auth
    question: Does the app have a login?
    when: { axis: browser, option: playwright-cli }
    default: "no"
    options:
      - { id: "no", label: No }
      - id: "yes"
        label: Yes — register a dev test account and store it in the project skill
        fragment: testing/auth.md
        scaffolds:
          - { template: browser-testing-auth-section.md, to: ".claude/skills/{{projectName}}-browser-testing/SKILL.md", mode: append }

  - id: enforcement
    question: How should the rules be enforced?
    default: prose
    options:
      - { id: prose, label: Reminders in CLAUDE.md and rules }
      - { id: hooks, label: "Fail-closed hooks (protect .env, lint gate, insight capture)", fragment: enforcement/hooks.md, selects: [quality-hooks] }

  - id: deploy
    question: Where does this deploy?
    default: vercel
    options:
      - { id: vercel, label: Vercel, fragment: deploy/vercel.md }
      - { id: railway, label: Railway (persistent process), fragment: deploy/railway.md }
      - { id: homelab, label: Homelab (Proxmox + Docker), fragment: deploy/homelab.md }
      - { id: static, label: Static hosting, fragment: deploy/static.md }
      - { id: none, label: Not deployed }

  - id: domain
    question: Is there a non-engineering domain Claude must not guess about?
    default: "off"
    options:
      - { id: "off", label: No }
      - { id: "on", label: Yes, fragment: domain/on.md }

  - id: domainName
    question: Name the domain (e.g. construction EVM, personal finance, security consulting)
    when: { axis: domain, option: "on" }
    input: { placeholder: the domain, default: the domain }
```
Note: `{{domainName}}` is not a global placeholder — the `domain/on.md` fragment refers to "this domain" generically; the CLI (Plan B) additionally substitutes any `{{<axisId>}}` for text-axis answers. Keep `domain/on.md` readable without it.

- [ ] **Step 3: Write the fragments**

Every fragment uses only canonical `##` headings. Create each file with the content shown.

`base/fragments/pm/pnpm.md`
```md
## Commands
- Always `pnpm` — never npm or yarn. If the project ever has a `package-lock.json` use npm; a `yarn.lock` means yarn.
- `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` — run typecheck and build often, not just at the end.
```
`base/fragments/pm/npm.md`
```md
## Commands
- This project uses npm (`package-lock.json`). Never mix in pnpm or yarn.
- `npm run dev`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` — run typecheck and build often.
```
`base/fragments/pm/yarn.md`
```md
## Commands
- This project uses yarn (`yarn.lock`). Never mix in npm or pnpm.
- `yarn dev`, `yarn test`, `yarn typecheck`, `yarn lint`, `yarn build` — run typecheck and build often.
```
`base/fragments/pm/bun.md`
```md
## Commands
- This project uses bun (`bun.lock`). Never mix in npm, pnpm or yarn.
- `bun dev`, `bun test`, `bun run typecheck`, `bun run lint`, `bun run build` — run typecheck and build often.
```
`base/fragments/layout/monorepo.md`
```md
## Constraints that bit before
- App code lives under `{{appDir}}`. Every path-scoped rule glob must use that prefix; a rule whose glob never matches is silently dead (it happened: a glob copied from a single-app repo matched nothing for ten tasks).
```
`base/fragments/workflow/full.md`
```md
## Workflow
- Creative work follows the superpowers cycle: brainstorm → design spec (`docs/superpowers/specs/`) → implementation plan (`docs/superpowers/plans/`) → subagent-driven build with TDD → two-stage review (spec compliance, then code quality). Never skip the review loop.
- Verification before completion: run the tests, typecheck and build and paste the evidence before claiming anything is done. Green typecheck is not proof the UI works.
- Rules carry direction and constraints; skills carry the how-to. When a recurring lesson appears, add a rule or skill instead of a longer CLAUDE.md.

## Testing
- TDD: write the failing test first, watch it fail for the right reason, then implement. A test that never failed proves nothing.
- Every new test is sabotage-proven before commit: break the code line it covers, confirm the test fails, revert.
```
`base/fragments/workflow/lightweight.md`
```md
## Workflow
- Write a short spec in chat before non-trivial changes and get a yes before coding. No plan documents.
- Verification before completion: run tests, typecheck and build and show the output before claiming done.

## Testing
- TDD where practical: failing test first, then the implementation.
```
`base/fragments/docs/mechanical.md`
```md
## Docs
- Three tiers, each with one job: `docs/handovers/` (what shipped, what was deferred, next seam — written before user hand-off, updated through acceptance, accurate frontmatter always), `docs/wiki/` (how the system works **today**, one page per system with a status ladder), `docs/superpowers/{specs,plans}/` (intent frozen at brainstorm time).
- Code plus the newest handover are truth; the spec holds intent; the wiki holds current behaviour. Never let a wiki page describe shipped work as unbuilt — stale pages have misled past sessions.
- Wiki parity is mechanical: `docs/wiki/_systems.json` lists every system and the parity test fails when a page is missing or its status lags the code. Update the wiki in the same change that ships the system.
```
`base/fragments/docs/reminder.md`
```md
## Docs
- Three tiers: `docs/handovers/` (what shipped and what's next, written before hand-off), `docs/wiki/` (how the system works today, one page per system), `docs/superpowers/{specs,plans}/` (frozen intent).
- Code plus the newest handover are truth. Update the relevant wiki page in the same change that ships the behaviour; stale pages have misled past sessions.
```
`base/fragments/memory/on.md`
```md
## Memory
- Always use the `mymind` MCP server. Its memories come from every Claude Code session and are project-scoped: search them (`search_memories`, `search_docs`, `search_passages`) before answering from recollection and whenever you start discovery or a new implementation.
- Mirror project docs and wikis to MyMind when you write them; file them under the project slug.
- Two inlets: the enrichment loop (preferred, distils session transcripts into confidence-scored memories) and `save_memory` (sparingly, for one durable sentence enrichment cannot see, always with a `confidence`). Architecture detail belongs in handovers and the wiki, not in memories.
- Search MyMind tasks for open work fronts before starting; create or update a task whenever work is deferred or finished.
```
`base/fragments/git/commits-proactive.md`
```md
## Git
- Commit proactively as work is verified, one concern per commit, conventional-commit subjects (`feat:`, `fix:`, `docs:`, `chore:` …).
- Never add co-author trailers or mention AI models in commit messages.
```
`base/fragments/git/commits-ask.md`
```md
## Git
- Do not commit without explicit approval; propose the commit message and wait.
- Conventional-commit subjects; never add co-author trailers or mention AI models in commit messages.
```
`base/fragments/git/pushes-ask.md`
```md
## Git
- Never push without explicit approval, even after a commit was approved.
```
`base/fragments/git/pushes-proactive.md`
```md
## Git
- Push when the work is verified (tests, typecheck, build green) and committed; say what was pushed.
```
`base/fragments/testing/playwright-cli.md`
```md
## Testing
- Validate every UI change in a real browser with `playwright-cli` (never the Playwright MCP): dev server up → `snapshot` → act on refs → `eval` assertions → read a screenshot. The `browser-testing` skill has the workflow; the project-local `{{projectName}}-browser-testing` skill has this app's URL and routes.
```
`base/fragments/testing/auth.md`
```md
## Testing
- Auth-gated pages: use the dev test account recorded in the project-local browser-testing skill. Register it in the dev environment only; never reuse production credentials; never paste credentials into a shared bundle or CLAUDE.md.
```
`base/fragments/enforcement/hooks.md`
```md
## Constraints that bit before
- Hooks are fail-closed: a check script that is tracked in git but missing on disk blocks the action instead of silently allowing it. If you cannot point at the refusal, you wrote a reminder, not a rule.
- `.env*`, `credentials.json` and `secrets.*` cannot be edited by tools; ask the user to change them.
```
`base/fragments/deploy/vercel.md`
```md
## Deploy
- Vercel via the Git integration on the production branch. Module scope in a serverless function is shared across requests: never keep per-request or per-tenant state there.
- ISR caches 200/404 and keeps stale on 5xx: surface upstream failures as 5xx, never as an empty 200 or a synthetic 404. Each distinct query string is a separate cache entry.
- Env changes need a redeploy; a redeploy of the same commit must not be skipped by an ignored-build step.
```
`base/fragments/deploy/railway.md`
```md
## Deploy
- Railway runs a persistent process: in-process state (SSE fan-out, caches, schedulers) only works with `numReplicas: 1`; say so in the config and the wiki before scaling.
- Deploys follow the production branch; run migrations from CI, not from a laptop.
```
`base/fragments/deploy/homelab.md`
```md
## Deploy
- Homelab (Proxmox + Docker), internet-exposed through a tunnel. Prod ops go through the host with `pct exec`; the `remote-ops` skill covers the nested-quoting trap that has silently run commands on the wrong machine before.
- Never paste hostnames, IPs or credentials into skills or rules that could be published; keep them in the gitignored project notes.
```
`base/fragments/deploy/static.md`
```md
## Deploy
- Static hosting: everything is built at deploy time. No runtime secrets, no server code; anything dynamic needs an explicit decision.
```
`base/fragments/domain/on.md`
```md
## Constraints that bit before
- We are software engineers, not domain experts in this project's field. Never fill a domain gap by inference: mark it as a question for the subject-matter expert (`SME:` in comments and docs) and keep going with what is verifiable.
```

`base/always/self-improvement.md`
```md
## Self-improvement
- You are relentlessly self-improving. Update CLAUDE.md proactively but keep it concise; put directory- or filetype-specific guidance in `.claude/rules/` and how-tos in `.claude/skills/`.
- When a recurring lesson, gotcha or workflow emerges, add or update a rule or skill in the same session. When a documented step fails, fix the documentation before moving on.
- Use memory religiously; write the handover before user hand-off and update it through acceptance.
```
`base/always/skills-philosophy.md`
```md
## Skills and rules
- Rules (`.claude/rules/*.md`, path-scoped) state direction, when, and constraints; skills (`.claude/skills/*/SKILL.md`) hold the how-to. A rule points at the skill; neither repeats the other.
- Invoke a skill whenever there is even a small chance it applies; read its current version rather than working from memory of it.
```
`base/always/no-secrets.md`
```md
## Constraints that bit before
- Credentials, tokens, private IPs and internal hostnames never go into CLAUDE.md, rules or skills that might be shared. Reference the env var or the gitignored local note instead. Real keys have been found committed in skill files before.
```

`base/templates/browser-testing-project.md`
```md
---
name: {{projectName}}-browser-testing
description: Use when validating UI or end-to-end behaviour of {{projectName}} in a real browser with playwright-cli — this app's URLs, routes and flows. Pairs with the generic browser-testing skill for the command workflow.
---

# Browser testing for {{projectName}}

## Dev server
- Start: `{{pm}} dev` — TODO: confirm the URL (default http://localhost:3000; pick another port if 3000 is taken).
- Ready check: `until curl -sf <dev-url> >/dev/null; do sleep 1; done`

## Routes to cover after UI changes
- TODO: list the routes that matter (home, main flows, an error page).

## Workflow
Follow the `browser-testing` skill: `open` → `snapshot` → act on refs → `eval` assertions → screenshot and read it. Headless-UI components need a real `click <ref>`.
```
`base/templates/browser-testing-auth-section.md`
```md

## Test account (dev only)
- Register a dedicated account in the DEV environment the first time this skill is used and record it here — never a production credential, never in a shared bundle.
- email: TODO · password: TODO · role: TODO
- Login flow: `goto <login-url>` → `snapshot` → `fill <email-ref>` → `fill <password-ref>` → `click <submit-ref>`; then `state-save auth.json` and reuse with `state-load auth.json` within a session. Delete the state file when done.
```

- [ ] **Step 4: Write the profiles**

`profiles/nuxt-app.yaml`
```yaml
name: nuxt-app
description: Nuxt 4 + Nuxt UI app with the full workflow, mechanical docs, hooks and browser validation.
answers: { pm: pnpm, layout: single, workflow: full, docs: mechanical, memory: "on", commits: proactive, pushes: ask, browser: playwright-cli, auth: "no", enforcement: hooks, deploy: vercel, domain: "off" }
bundles: [nuxt, nuxt-ui, browser-testing, quality-hooks, docs-discipline]
```
`profiles/library.yaml`
```yaml
name: library
description: A package or library — lightweight process, hooks, no browser validation.
answers: { pm: pnpm, layout: single, workflow: lightweight, docs: reminder, memory: "on", commits: proactive, pushes: ask, browser: none, enforcement: hooks, deploy: none, domain: "off" }
bundles: [quality-hooks]
```
`profiles/docs-only.yaml`
```yaml
name: docs-only
description: A documentation or notes repo — docs discipline and memory, nothing else.
answers: { pm: pnpm, layout: single, workflow: none, docs: mechanical, memory: "on", commits: proactive, pushes: ask, browser: none, enforcement: prose, deploy: none, domain: "off" }
bundles: [docs-discipline]
```

- [ ] **Step 5: Verify**

`pnpm test:unit` → PASS. `pnpm validate:skills` will now report `✓ base (15 axes, 3 profiles)` only after Task 8 adds `quality-hooks` and `docs-discipline`; until then expect `✗ profiles` with "unknown bundle" lines for those two — that is the expected intermediate state; commit anyway (CI runs the validator on main, so do Tasks 6–8 in one push).

- [ ] **Step 6: Commit**

```bash
git add shared/types/setup.ts server/lib/setup/base.ts test/unit/setup-base.test.ts base profiles
git commit -m "feat(base): question schema, fragments, templates and seed profiles"
```

---

### Task 7: Re-section the existing bundles and reconcile the drifted Nuxt rules

**Files:**
- Modify: `skills/nuxt/CLAUDE.md`, `skills/nuxt/README.md` (frontmatter `suggests`), `skills/nuxt/rules/web-nuxt.md`
- Create: `skills/nuxt/rules/{nuxt4,ssr,backend,database,cli}.md`
- Modify: `skills/nuxt-ui/CLAUDE.md`, `skills/nuxt-ui/README.md` (`dependsOn: [nuxt]`), `skills/nuxt-ui/rules/web-vue-ui.md`
- Create: `skills/nuxt-ui/rules/nuxt-ui.md`
- Modify: `skills/browser-testing/CLAUDE.md`
- Modify: `.claude/rules/web-nuxt.md`, `.claude/rules/web-vue-ui.md` only if the reconciled text changes a rule this repo relies on (keep this repo's copies in sync with the bundle copies)

**Interfaces:**
- Consumes: the section convention (Task 1), `dependsOn`/`suggests` (Task 5), `{{pm}}`/`{{appDir}}` placeholders.
- Produces: bundles whose `CLAUDE.md` snippets use canonical `##` headings; `nuxt-ui` declares `dependsOn: [nuxt]`; `nuxt` declares `suggests: [nuxt-ui, browser-testing]`; reconciled rules with YAML-list `paths:` using `{{appDir}}`.

- [ ] **Step 1: Read the drifted sources**

Read every variant and choose the most complete/newest as the base for each rule, then merge in anything the others add. Paths (all under `/Users/tony/Documents/GitHub/`): `cognova-docs/.claude/rules/nuxt4.md`, `gpx-workflows/.claude/rules/nuxt4.md`, `codethis-dev/.claude/rules/backend.md`, `helpy-ai/.claude/rules/backend.md`, `codethis-dev/.claude/rules/database.md`, `codethis-dev/.claude/rules/ssr.md`, `codethis-dev/.claude/rules/cli.md`, `codethis-dev/.claude/rules/nuxt-ui.md`, plus `notery`, `second-brain`, `heatwave-site`, `factory` for `diff`-checking drift (`diff` each pair; keep the superset of non-project-specific guidance). Record in the report which copy you started from for each file.

- [ ] **Step 2: Write the reconciled rules**

Requirements for every rule file:
- Frontmatter `paths:` is a YAML list; app-relative globs use `{{appDir}}/**` (e.g. `"{{appDir}}/**/*.vue"`, `"{{appDir}}/**/*.ts"`); repo-level ones stay literal (`"server/**/*.ts"`, `"nuxt.config.ts"`, `"drizzle.config.ts"`).
- No project names, hostnames, brand colours or theme mappings (drop mymind's `primary → gold` mapping wherever it leaked); no `apps/web/` literals.
- Direction and constraints only; point at `nuxt-docs` / `nuxt-ui-docs` / `nuxt-ui-templates` for the how-to.
- `skills/nuxt/rules/`: `web-nuxt.md` (existing; keep, re-glob), `nuxt4.md` (Nuxt 4 directory layout, auto-imports, `useFetch`/`useAsyncData` discipline, runtimeConfig for secrets, route rules), `ssr.md` (SSR vs SPA decisions, hydration pitfalls, `.client` components, payload extraction), `backend.md` (Nitro routes, h3 helpers, error shape, validation with zod, no `process.env` in handlers), `database.md` (Drizzle + Postgres conventions, migrations from CI, read-only roles for exploration, never destructive commands against prod), `cli.md` (scripts under `scripts/` run with `{{pmx}} tsx`, env loading, exit codes).
- `skills/nuxt-ui/rules/`: `web-vue-ui.md` (existing; keep, re-glob), `nuxt-ui.md` (theming through `app.config.ts` colour aliases, semantic tokens only, `UDashboard*` slot rules, verify props against installed source via `nuxt-ui-docs`, playwright-cli validation pointer to the `browser-testing` bundle).

- [ ] **Step 3: Re-section the three CLAUDE.md snippets**

`skills/nuxt/CLAUDE.md`
```md
## Stack
- Nuxt 4 (`app/` is the srcDir, Nitro under `server/`). Training-data knowledge of Nuxt APIs is stale: check the docs skill first.

## Commands
- `{{pm}} typecheck` and `{{pm}} build` often; both catch what the dev server hides.

## Skills and rules
- Invoke `nuxt-docs` before using a composable (`useFetch`, `useAsyncData`, `useState`, `useRuntimeConfig`, `navigateTo` …), a module option, or a Nitro route helper.
- Rules under `.claude/rules/{web-nuxt,nuxt4,ssr,backend,database,cli}.md` load by path glob; they point back at this skill.

## Constraints that bit before
- Secrets come from `runtimeConfig`, never `process.env` in app code; server-only values stay off the `public` key.
- `@nuxtjs/mdc`: keep `highlight.langs` to a short allow-list (the full Shiki set has OOM'd builds) and set `headings.anchorLinks: false` (Nuxt UI prose hydration bug).
```
`skills/nuxt-ui/CLAUDE.md`
```md
## Stack
- Nuxt UI v4 (installed `@nuxt/ui` 4.x). Props, slots and variants differ from training data; verify against the installed source.

## Skills and rules
- Invoke `nuxt-ui-docs` before using or changing a `U*` component; `nuxt-ui-templates` for composition patterns (dashboard, docs, landing).
- Use `U*` components before hand-rolled markup; semantic colour tokens only (`primary`, `neutral`, `text-muted`, `bg-elevated`, `border-default` …), never raw Tailwind palette classes.

## Constraints that bit before
- `UDashboardPanel` renders only named-slot content and has no `grow`/`collapsible` props; `UDashboardNavbar` renders an `<h1>` inside its `#left` default content — override `#left` for secondary titles.
- `UTree` `v-model` holds item objects and `v-model:expanded` holds key strings; always pass `get-key`.
- `UPageCard` renders `title`/`description` only inside the default `#body`; supply your own when you use the body slot.
```
`skills/browser-testing/CLAUDE.md`
```md
## Testing
- Prove UI changes in a real browser with `playwright-cli` before saying they are done; typecheck and unit tests never catch rendering or wiring bugs. If `playwright-cli` is missing, install it with `npm install -g @playwright/cli@latest`.

## Skills and rules
- Invoke `browser-testing` after any change to pages, components, styles or client logic. The project-local browser-testing skill (if present) holds this app's URL, routes and dev test account.
```

- [ ] **Step 4: Frontmatter**

`skills/nuxt/README.md`: add `suggests: [nuxt-ui, browser-testing]` and list the new rules in the "What's inside" table. `skills/nuxt-ui/README.md`: add `dependsOn: [nuxt]` and the `nuxt-ui.md` rule row. Mention in each README that rule globs contain `{{appDir}}` and are rendered by the CLI (or replaced by hand with `app` when installing manually).

- [ ] **Step 5: Verify**

`pnpm validate:skills` → `✓ nuxt`, `✓ nuxt-ui`, `✓ browser-testing`, no snippet errors, zero secret findings (profiles still report the two not-yet-created bundles). `grep -rn "gold\|thunder\|apps/web\|mymind" skills/nuxt skills/nuxt-ui` → nothing. `pnpm test:unit` → PASS. Run `pnpm dev` (`PORT=3210`) and check `/skill/nuxt` and `/skill/nuxt-ui` render the new rules and README tables (playwright-cli snapshot grep for `nuxt4.md`, `dependsOn`).

- [ ] **Step 6: Commit**

```bash
git add skills .claude/rules
git commit -m "feat(skills): section the CLAUDE.md snippets and reconcile the Nuxt rules"
```

---

### Task 8: New bundles — quality-hooks, docs-discipline, doc-fetcher, iterative-spec-design, readonly-db, remote-ops

**Files:**
- Create: `skills/quality-hooks/{README.md,CLAUDE.md,settings.json,hooks/protect-env.sh,hooks/lint-check.sh,rules/hooks.md}`
- Create: `skills/docs-discipline/{README.md,CLAUDE.md,rules/docs.md,skills/handover/SKILL.md,skills/wiki-parity/SKILL.md,skills/wiki-parity/wiki-parity.test.ts,skills/wiki-parity/_systems.example.json}`
- Create: `skills/doc-fetcher/{README.md,CLAUDE.md,skills/doc-fetcher/SKILL.md,skills/doc-fetcher/fetch.template.py}`
- Create: `skills/iterative-spec-design/{README.md,CLAUDE.md,skills/iterative-spec-design/SKILL.md}`
- Create: `skills/readonly-db/{README.md,CLAUDE.md,skills/readonly-db/SKILL.md,rules/database-safety.md}`
- Create: `skills/remote-ops/{README.md,CLAUDE.md,skills/remote-ops/SKILL.md}`

**Interfaces:**
- Every README frontmatter has `name`, `description`, `tags`, `author: Patrity`, `authorUrl: https://github.com/Patrity`, plus `requires`/`dependsOn`/`suggests` as listed. Every `CLAUDE.md` uses canonical `##` headings. `validate:skills` ends green with zero `fail` secret findings and `✓ base (15 axes, 3 profiles)`.

- [ ] **Step 1: `quality-hooks`**

Copy the two hooks byte-for-byte from `/Users/tony/Documents/GitHub/cognova/.claude/hooks/protect-env.sh` and `.../lint-check.sh` (the `pnpm lint --quiet` variant from `bridget`/`notery`, not the `-w` one), then replace the literal `pnpm` in `lint-check.sh` with `{{pm}}` and make both executable (`chmod +x`, committed mode 100755). Add a header comment to each: purpose, event, exit-2-blocks semantics.

`settings.json` (fail-closed wiring — the check `[ -f script ] || (git cat-file -e HEAD:script && exit 2)` blocks when a tracked script is missing on disk):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "timeout": 5, "command": "s=\"$CLAUDE_PROJECT_DIR/.claude/hooks/protect-env.sh\"; if [ -f \"$s\" ]; then exec \"$s\"; fi; git -C \"$CLAUDE_PROJECT_DIR\" cat-file -e HEAD:.claude/hooks/protect-env.sh 2>/dev/null && exit 2; exit 0" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "timeout": 60, "command": "s=\"$CLAUDE_PROJECT_DIR/.claude/hooks/lint-check.sh\"; if [ -f \"$s\" ]; then exec \"$s\"; fi; git -C \"$CLAUDE_PROJECT_DIR\" cat-file -e HEAD:.claude/hooks/lint-check.sh 2>/dev/null && exit 2; exit 0" }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          { "type": "prompt", "prompt": "Before context is compacted: if this session surfaced a reusable pattern, gotcha or convention that is not yet written down, save it now as a path-scoped rule under .claude/rules/ (direction + constraint, pointing at a skill for the how-to) or as a skill. Respond with {\"ok\": true} when done or {\"ok\": false, \"reason\": \"…\"} if nothing new was learned." }
        ]
      }
    ]
  }
}
```
Verify the PreCompact `prompt` hook shape against `/Users/tony/Documents/GitHub/parlors-2d/.claude/settings.json` (copy its exact key names) before committing.

`rules/hooks.md` (paths `[".claude/hooks/**", ".claude/settings.json"]`): hooks are fail-closed; new checks are scripts under `.claude/hooks/` wired in `settings.json` with the same missing-file guard; never make a hook fail-open (`[ ! -f X ] || X`).

`CLAUDE.md`:
```md
## Constraints that bit before
- Hooks are fail-closed: a tracked check script missing on disk blocks the action. Edits to `.env*`/`credentials.json`/`secrets.*` are refused by a PreToolUse hook; lint runs after every edit and blocks on failure.

## Skills and rules
- Add a new gate as a script in `.claude/hooks/` wired in `.claude/settings.json` with the same missing-file guard; `.claude/rules/hooks.md` has the pattern.
```
README frontmatter: `name: Quality Hooks`, `description: Fail-closed Claude Code hooks: protect .env and credential files, lint after every edit, and capture new insights as rules before context compaction.`, `tags: [hooks, quality, safety]`. Body: what's inside, install (merge `settings.json` into the project's `.claude/settings.json`; the CLI does this; by hand copy the `hooks` key), the `{{pm}}` placeholder note.

- [ ] **Step 2: `docs-discipline`**

Sources: `/Users/tony/Documents/GitHub/2d-rpg/.claude/rules/wiki-parity.md`, `2d-rpg/docs/wiki/_systems.json` (shape only), the handover block in `mymind/claude.md` "Rules". Contents:
- `rules/docs.md` (paths `["docs/**"]`): the three-tier model and the parity rule, pointing at the two skills.
- `skills/handover/SKILL.md`: when to write a handover (before user hand-off), the frontmatter fields (`title`, `date`, `status: draft|accepted`, `cycle`, `summary`), the section list (Shipped / Deferred / Next seam / How to verify), and "update through acceptance".
- `skills/wiki-parity/SKILL.md` + `wiki-parity.test.ts` (a vitest that reads `docs/wiki/_systems.json` — `{ systems: [{ id, page, status: 'planned'|'building'|'shipped' }] }` — and asserts every `page` exists under `docs/wiki/` and every `docs/wiki/*.md` except `_index.md` is listed) + `_systems.example.json`. The SKILL explains copying the test into the project's `test/` dir and the status ladder.
- `CLAUDE.md`: `## Docs` (three-tier model, two bullets) and `## Skills and rules` (invoke `handover` before hand-off; run the wiki-parity test in CI).
- README: `name: Docs Discipline`, `tags: [docs, handovers, wiki, process]`, `description: The three-tier docs model (handovers, living wiki, frozen specs) with a handover skill and a mechanical wiki-parity test.`

- [ ] **Step 3: `doc-fetcher`**

Generalise `skills/nuxt/skills/nuxt-docs/fetch.py` into `fetch.template.py` with a `CONFIG` block at the top (`REPO`, `BRANCH`, `DOCS_PATH`, `RAW_BASE`, `SKILL_NAME`, `TOPIC_MAP` optional) and identical behaviour (installed-version detection when a `package.json` dependency name is configured, 24 h cache under `cache/`, `--list`, `--status`, `--force`, `--update-all`). `skills/doc-fetcher/SKILL.md`: how to scaffold `<lib>-docs` — copy the template to `.claude/skills/<lib>-docs/fetch.py`, fill `CONFIG`, write the SKILL.md from the included snippet, add `cache/` to the skill's `.gitignore`, verify with `--list`. Include the SKILL.md snippet the generated skill should use (frontmatter + usage table) as a fenced block. `CLAUDE.md`: `## Skills and rules` — "When a library's API is uncertain, generate a `<lib>-docs` skill with `doc-fetcher` and read the fetched docs instead of guessing." README: `name: Doc Fetcher`, `tags: [docs, generator, python]`, `requires: [python3]`.

- [ ] **Step 4: `iterative-spec-design`**

Copy `/Users/tony/Documents/GitHub/daily-games/.claude/skills/iterative-spec-design/SKILL.md` verbatim (it is already generic; confirm with a grep for project names), plus README (`name: Iterative Spec Design`, `tags: [process, planning, specs]`) and `CLAUDE.md`: `## Workflow` — "Design specs section by section with an approval checkpoint after each (`iterative-spec-design`)."

- [ ] **Step 5: `readonly-db`**

From `/Users/tony/Documents/GitHub/Revival/.claude/skills/db-query/SKILL.md`: keep the pattern (a dedicated read-only role, `BEGIN READ ONLY` wrapper, a statement allowlist, a `db:q` script), replace every project name/role with placeholders (`<app>_claude_ro`), remove any host. `rules/database-safety.md` (paths `["server/**", "db/**", "drizzle/**", "prisma/**"]`): exploration goes through the read-only runner; destructive SQL and `pg_dump`/`pg_restore` are never run by Claude; migrations run in CI. `CLAUDE.md`: `## Constraints that bit before` (read-only exploration only; no destructive SQL) and `## Skills and rules` (invoke `readonly-db` to set up or use the runner). README: `name: Read-only DB Access`, `tags: [database, postgres, safety]`. Do NOT read or copy anything from `homelab/.claude/skills/ai-cost-analytics/` — it contains live credentials.

- [ ] **Step 6: `remote-ops`**

From `/Users/tony/Documents/GitHub/mymind/.claude/skills/prod-deploy/SKILL.md`, extract only the quoting section ("ssh joins all arguments into one string…", the broken vs correct examples) into `skills/remote-ops/SKILL.md`, replacing the host and CTID with `<host>` / `<ctid>`, and add the general rule: always verify with `hostname` when a remote result surprises you. `CLAUDE.md`: `## Constraints that bit before` — one bullet on the nested `ssh … pct exec … bash -lc` quoting trap with a pointer to the skill. README: `name: Remote Ops Quoting`, `tags: [ops, ssh, proxmox, shell]`.

- [ ] **Step 7: Verify**

```bash
pnpm validate:skills          # ✓ ×9 bundles, ✓ base (15 axes, 3 profiles), zero ✗, warns only if a private IP slipped in (there must be none)
grep -rnE "192\.168|10\.0\.|Copenflagen|sk-[A-Za-z0-9]{20}|ghp_" skills base profiles && echo LEAK || echo clean
pnpm test:unit && pnpm typecheck && pnpm lint
git ls-files -s skills/quality-hooks/hooks | awk '{print $1, $4}'   # both 100755
```
Browser (`PORT=3210 pnpm dev`): `/skills` shows 9 cards; `/skill/quality-hooks/settings.json` renders in CodeMirror; `/skill/docs-discipline/skills/wiki-parity/wiki-parity.test.ts` renders.

- [ ] **Step 8: Commit**

```bash
git add skills
git commit -m "feat(skills): quality-hooks, docs-discipline, doc-fetcher, iterative-spec-design, readonly-db and remote-ops bundles"
```

---

### Task 9: API routes for base, profiles and the CLI manifest

**Files:**
- Create: `server/api/base.get.ts`, `server/api/profiles.get.ts`, `server/api/cli/manifest.get.ts`
- Modify: `nuxt.config.ts` (route rules), `server/lib/skills/warm-urls.ts` (+ test), `test/e2e/api.test.ts`

**Interfaces:**
- Consumes: `getManifestsOr503()` (returns `ManifestRecord` with `base`, `baseErrors`, `profiles`, `profileErrors`), `isPublicSkill`, `BaseResponse`, `ProfilesResponse`, `CliManifest`.
- Produces: `GET /api/base` → `BaseResponse`; `GET /api/profiles` → `ProfilesResponse`; `GET /api/cli/manifest` → `CliManifest` (`registry` = `runtimeConfig.public.siteUrl`, `skills` = public summaries without `tree`, `errors` = base + profile errors). All three: `isr: 300` + `Vercel-Cache-Tag: skills`; warmed after purges.

- [ ] **Step 1: Write the failing e2e tests**

Append to `test/e2e/api.test.ts`:
```ts
describe('setup endpoints', () => {
  it('GET /api/base returns the fixture schema', async () => {
    const res = await $fetch<BaseResponse>('/api/base')
    expect(res.errors).toEqual([])
    expect(res.base!.axes.map(a => a.id)).toEqual(['pm', 'layout', 'appDir'])
    expect(res.base!.sections.map(s => s.id)).toContain('skills-and-rules')
    expect(res.base!.fragments['pm/pnpm.md']).toContain('{{pm}}')
  })
  it('GET /api/profiles returns the fixture profiles', async () => {
    const res = await $fetch<ProfilesResponse>('/api/profiles')
    expect(res.profiles.map(p => p.name)).toEqual(['demo'])
  })
  it('GET /api/cli/manifest bundles everything the CLI needs in one call', async () => {
    const res = await $fetch<CliManifest>('/api/cli/manifest')
    expect(res.registry).toBe('http://localhost:3000')
    expect(res.base!.version).toBe(1)
    expect(res.profiles).toHaveLength(1)
    expect(res.skills.map(s => s.slug)).toEqual(['broken', 'demo', 'no-readme'])
    expect('tree' in res.skills[0]!).toBe(false)
    expect(res.errors).toEqual([])
  })
  it('caches the manifest with the skills tag', async () => {
    const res = await fetch('/api/cli/manifest')
    expect(res.headers.get('vercel-cache-tag')).toBe('skills')
  })
})
```
(import the three types from `../../shared/types/setup`.)

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run test/e2e/api.test.ts` → the four new cases 404.

- [ ] **Step 3: Implement**

`server/api/base.get.ts`:
```ts
import type { BaseResponse } from '~~/shared/types/setup'

export default defineEventHandler(async (): Promise<BaseResponse> => {
  const { meta, base, baseErrors } = await getManifestsOr503()
  return { ...meta, base, errors: baseErrors }
})
```
`server/api/profiles.get.ts`:
```ts
import type { ProfilesResponse } from '~~/shared/types/setup'

export default defineEventHandler(async (): Promise<ProfilesResponse> => {
  const { meta, profiles, profileErrors } = await getManifestsOr503()
  return { ...meta, profiles, errors: profileErrors }
})
```
`server/api/cli/manifest.get.ts`:
```ts
import type { CliManifest } from '~~/shared/types/setup'

export default defineEventHandler(async (): Promise<CliManifest> => {
  const { meta, skills, base, baseErrors, profiles, profileErrors } = await getManifestsOr503()
  const registry = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  return {
    ...meta,
    registry,
    base,
    profiles,
    skills: skills.filter(s => isPublicSkill(s, meta)).map(({ tree: _tree, ...summary }) => summary),
    errors: [...baseErrors, ...profileErrors]
  }
})
```
`nuxt.config.ts` route rules — add:
```ts
    '/api/base': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/api/profiles': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
    '/api/cli/**': { isr: 300, headers: { 'Vercel-Cache-Tag': 'skills' } },
```
`warm-urls.ts`: add `'/api/base'`, `'/api/profiles'`, `'/api/cli/manifest'` to the URL set; extend `test/unit/warm-cache.test.ts` to assert they are present.

- [ ] **Step 4: Run tests**

`pnpm test:unit` → PASS; `pnpm test` → e2e PASS; `pnpm typecheck` and `pnpm lint` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add server/api nuxt.config.ts server/lib/skills/warm-urls.ts test
git commit -m "feat(api): base, profiles and CLI manifest endpoints"
```

---

### Task 10: Site — install command, home section, CLI and base docs

**Files:**
- Create: `app/components/skill/InstallCommand.vue`, `content/docs/cli.md`, `content/docs/base-and-profiles.md`
- Modify: `app/components/skill/SkillMetaCard.vue`, `app/components/skill/SkillCard.vue`, `app/pages/index.vue`, `app/composables/useAnalytics.ts`, `content/docs/nav.ts`

**Interfaces:**
- `<InstallCommand :command="string" :slug="string" />` renders the one-liner in a `<code>` with a copy `UButton` (icon `i-lucide-copy`, `aria-label="Copy install command"`), copies via `navigator.clipboard.writeText`, shows a toast, and calls `trackInstallCopy(slug)` (new in `useAnalytics`, event `skill-install-copy { slug }`).
- Commands: bundle → `pnpx @patrity/skills add <slug>`; home → `pnpx @patrity/skills init`.

- [ ] **Step 1: Component and analytics**

`app/composables/useAnalytics.ts`: add `trackInstallCopy: (slug: string) => track('skill-install-copy', { slug })`.

`app/components/skill/InstallCommand.vue`:
```vue
<script setup lang="ts">
const props = defineProps<{ command: string, slug: string }>()
const toast = useToast()
const { trackInstallCopy } = useAnalytics()

async function copy() {
  await navigator.clipboard.writeText(props.command)
  toast.add({ title: 'Command copied', icon: 'i-lucide-clipboard-check', color: 'success' })
  trackInstallCopy(props.slug)
}
</script>

<template>
  <div class="flex items-center gap-2 min-w-0 rounded-md border border-default bg-muted px-3 py-1.5">
    <code class="text-xs font-mono text-default truncate flex-1">{{ command }}</code>
    <UButton
      icon="i-lucide-copy"
      size="xs"
      color="neutral"
      variant="ghost"
      aria-label="Copy install command"
      @click.stop="copy"
    />
  </div>
</template>
```
Place it: in `SkillMetaCard.vue` under the badges row (`<InstallCommand :command="\`pnpx @patrity/skills add ${skill.slug}\`" :slug="skill.slug" class="mt-4" />`); in `SkillCard.vue` inside the footer above the author/buttons row (the footer already stops propagation so the card click is unaffected).

- [ ] **Step 2: Home section**

In `app/pages/index.vue`, between "How it works" and "Latest", add:
```vue
      <UPageSection
        headline="Start a project"
        title="One command, one coherent CLAUDE.md"
        description="Run the wizard in a project directory: it asks about package manager, workflow, docs, git policy and testing, lets you pick bundles, and writes .claude/ plus a CLAUDE.md where every rule lands in its section. Re-run any time; a lockfile keeps it idempotent."
        :links="[{ label: 'CLI docs', to: '/docs/cli', color: 'neutral', variant: 'subtle', trailingIcon: 'i-lucide-arrow-right' }]"
      >
        <InstallCommand
          command="pnpx @patrity/skills init"
          slug="init"
          class="max-w-md"
        />
      </UPageSection>
```
(The component lives under `components/skill/`, so its auto-import name is `SkillInstallCommand` — use that tag in all three places.)

- [ ] **Step 3: Docs**

`content/docs/nav.ts`: append `{ slug: 'cli', title: 'CLI', file: 'cli.md', description: 'Install and manage bundles from a project directory.' }` and `{ slug: 'base-and-profiles', title: 'Base and profiles', file: 'base-and-profiles.md', description: 'How the wizard assembles CLAUDE.md, and how to add an axis or a profile.' }`.

`content/docs/cli.md` — sections: Install (`pnpx @patrity/skills` runs `init`; Node ≥ 22), Commands table (init/add/remove/update/diff/list with the flags from spec §5.1), What it writes (`.claude/` files, `CLAUDE.md` marker blocks, `settings.json` vs `settings.local.json`, `.claude/skills.lock.json`), Updating (hand-edited blocks are protected; `--force`), Non-interactive use (`--yes --profile nuxt-app`, `--answer pm=npm`, `--with nuxt,nuxt-ui`), Using another registry (`--registry`).

`content/docs/base-and-profiles.md` — sections: The section convention (the 13 sections table and the marker format, verbatim from the spec §3), Writing a fragment (canonical headings, placeholders, one option → one fragment), Axes (`base/questions.yaml` shape with a short example including `when`, `input`, `selects`, `scaffolds`), Profiles (`profiles/<name>.yaml` shape), Validation (`pnpm validate:skills` checks headings, fragments, profiles, secrets), How bundles contribute (their `CLAUDE.md` snippet headings; `dependsOn`/`suggests`).

Both docs start with `# Title` (single h1 rule) and use only `##`/`###` below.

- [ ] **Step 4: Verify**

`pnpm typecheck && pnpm lint && pnpm test:unit`; `pnpm test` (sitemap test still passes; docs API serves the two new pages: add e2e `GET /api/docs/cli` → 200). Browser (`PORT=3210 pnpm dev`): `/skill/nuxt` shows the install command and copy works (toast appears; `eval "() => navigator.clipboard.readText()"` may need permissions — assert the toast text instead), `/skills` cards show the command without breaking the card click, `/` shows "Start a project", `/docs/cli` and `/docs/base-and-profiles` render with one h1 each. Screenshots read.

- [ ] **Step 5: Commit**

```bash
git add app content
git commit -m "feat(site): install commands, start-a-project section, CLI and base docs"
```

> Push note for the controller: Tasks 1–9 can go live any time. Task 10 advertises `@patrity/skills`, which Plan B publishes; push Task 10 together with Plan B's first release (or accept a short window where the docs describe a package that is about to exist).

---

### Task 11: Full gate and production verification

**Files:** none planned; fix anything the gate surfaces.

- [ ] **Step 1: Gate**

```bash
pnpm lint && pnpm typecheck && pnpm validate:skills && pnpm test && pnpm build
```
All exit 0; validator prints 9 bundle ✓ lines and `✓ base (15 axes, 3 profiles)`, zero `✗`, zero `fail` findings.

- [ ] **Step 2: Production-like run**

```bash
PORT=3100 NUXT_SKILLS_SOURCE=fs NUXT_REVALIDATE_SECRET=local node .output/server/index.mjs > /tmp/skills-prod.log 2>&1 &
until curl -sf http://localhost:3100/api/health >/dev/null; do sleep 1; done
curl -s http://localhost:3100/api/cli/manifest | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d["skills"]), [a["id"] for a in d["base"]["axes"]], [p["name"] for p in d["profiles"]], d["errors"])'
bash scripts/warm-cache.sh http://localhost:3100    # lists /api/base, /api/profiles, /api/cli/manifest among the URLs, all 200
kill %1
```

- [ ] **Step 3: After the controller pushes**

On production: `curl -s https://skills.patrity.com/api/cli/manifest | jq '{skills: (.skills|length), axes: (.base.axes|length), profiles: (.profiles|length), errors}'` → 9 / 15 / 3 / `[]`; the revalidate workflow (this push touches `skills/**`) and the warm workflow both succeed; `/skill/quality-hooks` renders.

---

## Self-review notes

- **Spec coverage:** §3 convention → Tasks 1, 2, 5 (validation), 7 (snippets), 10 (docs). §4 schema/fragments/profiles → Tasks 3, 4, 6. §6 registry changes → Tasks 4, 5, 9, 10 (frontmatter keys in 5; `settings.json` badge in 5; routes in 9; site in 10). §8 content → Tasks 7, 8. §9 registry-side testing → unit tests in 1–5, e2e in 9/10, validator in 5/8, browser checks in 7/8/10. The `scaffolds` field (Task 6) is an addition to the spec's schema to keep the browser-testing scaffold data-driven; the CLI plan consumes it.
- **Type consistency:** `BaseSchema`/`Profile`/`CliManifest` (Task 1) are what `parseBaseSchema`/`parseProfiles` (Task 3) produce, what `Snapshot`/`ManifestRecord` (Task 4) carry, and what the routes (Task 9) return. `splitSnippet` (Task 1) is used by `parseBaseSchema` (Task 3) and `parseBundle` (Task 5). Marker/renderer functions (Task 2) are not used server-side yet — the CLI plan consumes them.
- **Ordering:** Tasks 6–8 produce an intermediate state where profiles reference bundles created in Task 8; the validator (and CI) is green again at the end of Task 8, so those three tasks land in one push.
