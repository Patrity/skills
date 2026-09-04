import type { CliManifest, SectionDef } from '../../shared/types/setup'
import { composeClaudeMd, type Contribution } from '../../shared/setup/render'
import { findMarkerBlocks, type MarkerBlock } from '../../shared/setup/markers'
import { sectionIdForHeading } from '../../shared/setup/sections'
import { placeholderVars, renderPlaceholders, type PlaceholderVars } from '../../shared/setup/placeholders'
import { activeAxes, contributionsFor, scaffoldsFor } from './contributions'
import { emptyLockfile, sha256, type Lockfile } from './lockfile'
import { isSafeBundlePath, type BundleFiles } from './registry'
import type { ProjectState } from './project'
import { ensureGitignoreLine, formatJson, mergeSettings, splitBundleSettings, type Json } from './settings'

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
  gitignore: { content: string, changed: boolean } | null
  lock: Lockfile
  warnings: string[]
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()
const SKIP = new Set(['readme.md', 'claude.md', 'settings.json', 'settings.local.json'])

/** Sort `Object.entries` by key so a plan is byte-identical run to run. */
const byKey = ([a]: [string, unknown], [b]: [string, unknown]): number => (a < b ? -1 : a > b ? 1 : 0)

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
function hashForSource(blocks: MarkerBlock[], sourceId: string): string {
  return sha256(blocks.filter(b => b.sourceId === sourceId).map(b => b.content).join('\n'))
}

function sourceIds(blocks: MarkerBlock[]): string[] {
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

export async function buildPlan(input: {
  manifest: CliManifest
  project: ProjectState
  answers: Record<string, string>
  bundles: string[]
  bundleFiles: Record<string, BundleFiles>
  force?: boolean
}): Promise<SetupPlan> {
  const { manifest, project, answers, bundles, bundleFiles, force = false } = input
  const warnings: string[] = []
  const vars = varsFor(manifest, answers, project.name)
  const prev = project.lock
  const lock = emptyLockfile({ registry: manifest.registry, schemaVersion: manifest.base?.version ?? 0, projectName: project.name, answers })
  const files: FileOp[] = []
  let shared: Json = {}
  let local: Json = {}

  const classify = async (path: string, bytes: Uint8Array, prevHash: string | undefined): Promise<FileOp['action']> => {
    const current = await project.files(path)
    if (current === null) return 'create'
    const currentHash = sha256(current)
    if (currentHash === sha256(bytes)) return 'unchanged'
    if (prevHash === undefined) return 'conflict' // exists but we never installed it
    if (currentHash !== prevHash && !force) return 'protected' // hand-edited since install
    return 'update'
  }

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
    const prevFiles = prev?.bundles[slug]?.files ?? {}
    lock.bundles[slug] = { sha: manifest.sha, files: {} }
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
      const action = await classify(path, bytes, prevFiles[path])
      files.push({ path, bytes, owner: `bundle:${slug}`, action, ...(rel.startsWith('hooks/') ? { mode: 0o755 } : {}) })
      // A conflicting path is someone else's file: never claim it in the lock.
      if (action !== 'conflict') {
        lock.bundles[slug]!.files[path] = action === 'protected' ? (prevFiles[path] ?? sha256(bytes)) : sha256(bytes)
      }
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
      if (template === undefined) {
        warnings.push(`scaffold template ${s.template} missing from manifest`)
        continue
      }
      const to = renderPlaceholders(s.to, vars).text
      const text = renderPlaceholders(template, vars).text
      scaffolded.set(to, s.mode === 'append' && scaffolded.has(to) ? `${scaffolded.get(to)!.replace(/\n*$/, '\n')}${text}` : text)
    }
  }
  for (const [path, text] of scaffolded) {
    const bytes = encoder.encode(text)
    const classified = await classify(path, bytes, prev?.scaffolds[path])
    // A scaffold is a starting point the user edits: never overwrite an existing one unless forced.
    const action = classified === 'update' && !force ? 'protected' : classified
    files.push({ path, bytes, owner: 'scaffold', action })
    if (action !== 'conflict') {
      lock.scaffolds[path] = action === 'protected' ? (prev?.scaffolds[path] ?? sha256(bytes)) : sha256(bytes)
    }
  }

  // Bundles present in the previous lock but no longer selected → removals (only if untouched).
  const removals: string[] = []
  const seen = new Set(files.map(f => f.path))
  for (const [slug, entry] of Object.entries(prev?.bundles ?? {}).sort(byKey)) {
    if (bundles.includes(slug)) continue
    for (const [path, hash] of Object.entries(entry.files).sort(byKey)) {
      // A path a still-selected bundle installs is not a leftover, and two dropped bundles may
      // have shipped the same file.
      if (seen.has(path)) continue
      seen.add(path)
      const current = await project.files(path)
      if (current === null) continue
      if (sha256(current) === hash) removals.push(path)
      else warnings.push(`${path} was modified after install; left in place (remove it by hand)`)
    }
  }

  // CLAUDE.md
  const { contributions, warnings: cw } = contributionsFor({ manifest, answers, bundles, bundleFiles, vars })
  warnings.push(...cw)
  const sections = manifest.base?.sections
  const handEdited: string[] = []
  const existingBlocks = project.claudeMd ? findMarkerBlocks(project.claudeMd) : []
  for (const id of sourceIds(existingBlocks)) {
    const recorded = prev?.blocks[id]
    if (recorded && recorded !== hashForSource(existingBlocks, id)) handEdited.push(id)
  }
  let effective: Contribution[] = contributions
  if (handEdited.length && !force) {
    // Keep the user's edited block content: replace incoming contributions of that source with the current text.
    effective = contributions.filter(c => !handEdited.includes(c.sourceId))
    for (const id of handEdited) {
      for (const block of existingBlocks.filter(b => b.sourceId === id)) {
        effective.push({ sourceId: id, sectionId: sectionOfBlock(project.claudeMd!, block.start, sections), markdown: block.content })
      }
    }
  }
  const claudeMd = composeClaudeMd(project.claudeMd, { title: project.name, sections, contributions: effective })
  const composedBlocks = findMarkerBlocks(claudeMd)
  for (const id of sourceIds(composedBlocks)) {
    // A protected block keeps its previously recorded hash, so it stays protected next run.
    const kept = !force && handEdited.includes(id) ? prev?.blocks[id] : undefined
    lock.blocks[id] = kept ?? hashForSource(composedBlocks, id)
  }

  const settingsContent = Object.keys(shared).length ? formatJson(mergeSettings(project.settings, shared)) : null
  const localContent = Object.keys(local).length ? formatJson(mergeSettings(project.settingsLocal, local)) : null
  const gitignoreContent = localContent ? ensureGitignoreLine(project.gitignore, '.claude/settings.local.json') : null

  return {
    files,
    removals,
    claudeMd: { content: claudeMd, changed: claudeMd !== (project.claudeMd ?? ''), handEdited },
    settings: settingsContent ? { content: settingsContent, changed: settingsContent !== (project.settings ? formatJson(project.settings) : '') } : null,
    settingsLocal: localContent ? { content: localContent, changed: localContent !== (project.settingsLocal ? formatJson(project.settingsLocal) : '') } : null,
    gitignore: gitignoreContent ? { content: gitignoreContent, changed: gitignoreContent !== (project.gitignore ?? '') } : null,
    lock,
    warnings
  }
}

/** The canonical section id of the `## …` heading above a given line, or skills-and-rules. */
function sectionOfBlock(md: string, line: number, sections?: SectionDef[]): string {
  const lines = md.split('\n')
  for (let i = line; i >= 0; i--) {
    const h = /^##\s+(.+?)\s*$/.exec(lines[i]!)
    if (h) return sectionIdForHeading(h[1]!, sections) ?? 'skills-and-rules'
  }
  return 'skills-and-rules'
}
