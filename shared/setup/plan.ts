import type { BundleFiles, CliManifest, EnvVar } from '../types/setup'
import { composeClaudeMd, type Contribution } from './render'
import { findMarkerBlocks, type MarkerBlock } from './markers'
import { placeholderVars, renderPlaceholders, type PlaceholderVars } from './placeholders'
import { isSafeBundlePath } from './paths'
import { activeAxes, contributionsFor, scaffoldsFor } from './contributions'
import { emptyLockfile, sha256, type Lockfile, type LockSettings } from './lock'
import { gitignoreEntries, gitignoreFileFor } from './gitignore'
import { renderEnvExample } from './env-example'
import { formatJson, isEmptyContribution, mergeSettings, settingsContribution, splitBundleSettings, type Json } from './settings'

export interface FileOp {
  path: string
  bytes: Uint8Array
  mode?: number
  owner: string
  action: 'create' | 'update' | 'unchanged' | 'conflict' | 'protected'
}

export interface SetupPlan {
  files: FileOp[]
  /** Owned files of bundles no longer selected, removed only when untouched since install. */
  removals: string[]
  claudeMd: { content: string, changed: boolean, handEdited: string[] }
  settings: { content: string, changed: boolean } | null
  settingsLocal: { content: string, changed: boolean } | null
  /** The whole `.gitignore`, managed block regenerated in place; `null` when there is none to write. */
  gitignore: { content: string, changed: boolean } | null
  /** The whole `.claude/.env.example`; `null` when no selected bundle declares variables. */
  envExample: { content: string, changed: boolean } | null
  /** The project has an example this tool wrote and nothing declares variables any more. */
  envExampleRemove: boolean
  lock: Lockfile
  warnings: string[]
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()
const SKIP = new Set(['readme.md', 'claude.md', 'settings.json', 'settings.local.json'])

/** Sort `Object.entries` by key so a plan is byte-identical run to run. */
export const byKey = ([a]: [string, unknown], [b]: [string, unknown]): number => (a < b ? -1 : a > b ? 1 : 0)

function isBinary(bytes: Uint8Array): boolean {
  for (let i = 0; i < Math.min(bytes.length, 8000); i++) {
    if (bytes[i] === 0) return true
  }
  return false
}

/**
 * One source contributes one block per section, so its lock entry hashes every block it owns,
 * joined in document order. Used identically when recording and when detecting a hand edit.
 */
export function hashForSource(blocks: MarkerBlock[], sourceId: string): string {
  return sha256(blocks.filter(b => b.sourceId === sourceId).map(b => b.content).join('\n'))
}

export function sourceIds(blocks: MarkerBlock[]): string[] {
  return [...new Set(blocks.map(b => b.sourceId))]
}

/** Text-axis answers double as placeholders ({{appDir}}, {{domainName}} …). */
export function varsFor(manifest: CliManifest, answers: Record<string, string>, projectName: string): PlaceholderVars & Record<string, string> {
  const vars: Record<string, string> = { ...placeholderVars(answers, projectName) }
  for (const axis of manifest.base ? activeAxes(manifest.base, answers) : []) {
    if (axis.input && answers[axis.id]) vars[axis.id] = answers[axis.id]!
  }
  return vars as PlaceholderVars & Record<string, string>
}

export interface FreshInput {
  manifest: CliManifest
  projectName: string
  answers: Record<string, string>
  bundles: string[]
  bundleFiles: Record<string, BundleFiles>
  /** The base URL the manifest was fetched from — not what it advertises, which may be a mirror. */
  registry: string
}

/**
 * Internal to this module and the CLI's `buildPlan`: what `planFresh` renders, plus the
 * intermediates an existing-project overlay would otherwise have to recompute — the two merged
 * settings halves (before any merge with what the project already has) and the CLAUDE.md
 * contributions. There is one `contributionsFor` call, here, so both callers can never disagree.
 *
 * `plan.warnings` holds the render warnings only; the contribution warnings come back beside them
 * so each caller can place them where it always has (`planFresh` right after the render warnings,
 * `buildPlan` after its removal warnings).
 */
export function renderFresh(input: FreshInput): {
  plan: SetupPlan
  shared: Json
  local: Json
  contributions: Contribution[]
  contributionWarnings: string[]
} {
  const { manifest, projectName, answers, bundles, bundleFiles, registry } = input
  const warnings: string[] = []
  const vars = varsFor(manifest, answers, projectName)
  const lock = emptyLockfile({ registry, schemaVersion: manifest.base?.version ?? 0, projectName, answers })
  const files: FileOp[] = []
  let shared: Json = {}
  let local: Json = {}

  /** Render a bundle's settings file; a malformed one is reported and skipped, not thrown. */
  const readSettings = (raw: Uint8Array, label: string): Json | null => {
    const { text, unknown } = renderPlaceholders(decoder.decode(raw), vars)
    for (const k of unknown) warnings.push(`${label}: unknown placeholder {{${k}}}`)
    try {
      return JSON.parse(text) as Json
    } catch {
      warnings.push(`${label}: not valid JSON, skipped`)
      return null
    }
  }

  for (const slug of [...bundles].sort()) {
    const bundle = bundleFiles[slug] ?? {}
    // Declared in the bundle's README frontmatter and carried in the manifest summary: recorded on
    // the lock so a later run can rebuild the .gitignore block and the env example from it alone.
    const summary = manifest.skills.find(s => s.slug === slug)
    const declaredGitignore = summary?.gitignore?.length ? [...summary.gitignore].sort() : undefined
    const declaredEnv = summary?.env?.length ? summary.env.map(v => v.name).sort() : undefined
    lock.bundles[slug] = {
      sha: manifest.sha,
      files: {},
      ...(declaredGitignore ? { gitignore: declaredGitignore } : {}),
      ...(declaredEnv ? { env: declaredEnv } : {})
    }
    let settingsJson: Json | null = null
    let settingsLocalJson: Json | null = null
    for (const [rel, raw] of Object.entries(bundle).sort(byKey)) {
      const lower = rel.toLowerCase()
      if (lower === 'settings.json') {
        settingsJson = readSettings(raw, `${slug}/settings.json`)
        continue
      }
      if (lower === 'settings.local.json') {
        settingsLocalJson = readSettings(raw, `${slug}/settings.local.json`)
        continue
      }
      if (SKIP.has(lower)) continue
      if (!isSafeBundlePath(rel)) {
        warnings.push(`${slug}/${rel}: unsafe path, skipped`)
        continue
      }
      const path = `.claude/${rel}`
      let bytes = raw
      if (!isBinary(raw)) {
        const r = renderPlaceholders(decoder.decode(raw), vars)
        for (const k of r.unknown) warnings.push(`${slug}/${rel}: unknown placeholder {{${k}}}`)
        bytes = encoder.encode(r.text)
      }
      files.push({ path, bytes, owner: `bundle:${slug}`, action: 'create', ...(rel.startsWith('hooks/') ? { mode: 0o755 } : {}) })
      lock.bundles[slug]!.files[path] = sha256(bytes)
    }
    const split = splitBundleSettings(settingsJson, settingsLocalJson)
    shared = mergeSettings(shared, split.shared)
    local = mergeSettings(local, split.local)
    // Recorded per file, so a later `remove` disarms exactly these hooks and permissions again and
    // only in the file they were merged into: an identical entry the user keeps in the other file
    // is not this bundle's and must survive.
    const contribution: LockSettings = { shared: settingsContribution(split.shared), local: settingsContribution(split.local) }
    if (!isEmptyContribution(contribution.shared) || !isEmptyContribution(contribution.local)) lock.bundles[slug]!.settings = contribution
  }

  // Scaffolds from base options (templates rendered; append mode concatenates onto the same path).
  const scaffolded = new Map<string, string>()
  if (manifest.base) {
    for (const s of scaffoldsFor(manifest.base, answers)) {
      const template = manifest.base.templates[s.template]
      if (template === undefined) {
        warnings.push(`scaffold template ${s.template} missing from manifest`)
        continue
      }
      const to = renderPlaceholders(s.to, vars).text
      // The rendered path carries text-axis answers, which on the web come from whoever wrote the
      // link — so it gets the same containment check as a bundle's own file names.
      if (!isSafeBundlePath(to)) {
        warnings.push(`scaffold ${s.template}: unsafe path ${to}, skipped`)
        continue
      }
      const text = renderPlaceholders(template, vars).text
      scaffolded.set(to, s.mode === 'append' && scaffolded.has(to) ? `${scaffolded.get(to)!.replace(/\n*$/, '\n')}${text}` : text)
    }
  }
  for (const [path, text] of scaffolded) {
    const bytes = encoder.encode(text)
    files.push({ path, bytes, owner: 'scaffold', action: 'create' })
    lock.scaffolds[path] = sha256(bytes)
  }

  // CLAUDE.md
  const { contributions, warnings: contributionWarnings } = contributionsFor({ manifest, answers, bundles, bundleFiles, vars })
  const sections = manifest.base?.sections
  const claudeMd = composeClaudeMd(null, { title: projectName, sections, contributions })
  const composedBlocks = findMarkerBlocks(claudeMd)
  for (const id of sourceIds(composedBlocks)) lock.blocks[id] = hashForSource(composedBlocks, id)

  const plan: SetupPlan = {
    files,
    removals: [],
    claudeMd: { content: claudeMd, changed: true, handEdited: [] },
    settings: settingsFileFor(null, shared),
    settingsLocal: settingsFileFor(null, local),
    // Both are regenerated around what the project already has: `planFresh` renders them from
    // nothing below, `buildPlan` from the files on disk.
    gitignore: null,
    envExample: null,
    envExampleRemove: false,
    lock,
    warnings
  }
  return { plan, shared, local, contributions, contributionWarnings }
}

/**
 * Everything a setup renders for a project that has nothing yet: bundle files under `.claude/`,
 * scaffolds, the composed CLAUDE.md and the two settings files, with a complete lockfile.
 * Synchronous and pure — no disk, no previous state — so it runs unchanged in the browser. The CLI
 * overlays an existing project on top of this (classification, removals, hand edits) in `buildPlan`.
 */
export function planFresh(input: FreshInput): SetupPlan {
  const { plan, contributionWarnings } = renderFresh(input)
  const gitignore = gitignoreFileFor(null, gitignoreEntries({ settingsLocal: plan.settingsLocal, lock: plan.lock }))
  const envExample = renderEnvExample(envGroups(input.manifest, input.bundles))
  if (envExample) plan.lock.envExample = sha256(envExample)
  return {
    ...plan,
    gitignore: gitignore.file,
    envExample: envExample === null ? null : { content: envExample, changed: true },
    envExampleRemove: false,
    warnings: [...plan.warnings, ...contributionWarnings, ...gitignore.warnings]
  }
}

/** What `.claude/.env.example` is rendered from: each selected bundle's declared variables. */
export function envGroups(manifest: CliManifest, bundles: string[]): { slug: string, env: EnvVar[] }[] {
  return bundles.map(slug => ({ slug, env: manifest.skills.find(s => s.slug === slug)?.env ?? [] }))
}

/** A settings file the plan may write: `null` only when there is nothing there and nothing to add. */
export function settingsFileFor(existing: Json | null, next: Json): { content: string, changed: boolean } | null {
  if (existing === null && !Object.keys(next).length) return null
  const content = formatJson(next)
  return { content, changed: content !== (existing ? formatJson(existing) : '') }
}
