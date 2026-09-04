import type { CliManifest, SectionDef } from '../../shared/types/setup'
import { composeClaudeMd, type Contribution } from '../../shared/setup/render'
import { findMarkerBlocks } from '../../shared/setup/markers'
import { sectionIdForHeading } from '../../shared/setup/sections'
import { byKey, envGroups, hashForSource, renderFresh, settingsFileFor, sourceIds, varsFor, type FileOp, type SetupPlan } from '../../shared/setup/plan'
import { gitignoreEntries, gitignoreFileFor } from '../../shared/setup/gitignore'
import { ENV_EXAMPLE_PATH, renderEnvExample } from '../../shared/setup/env-example'
import { sha256, type LockSettings } from './lockfile'
import type { BundleFiles } from './registry'
import type { ProjectState } from './project'
import { mergeSettings, subtractSettings, type Json, type SettingsContribution } from './settings'

export { hashForSource, varsFor }
export type { FileOp, SetupPlan }

/**
 * A setup for a project that may already have one. Everything a fresh project gets is rendered once
 * by `renderFresh` (shared with the web builder); this adds what only a real project on disk has: the
 * classification of each file against disk and the previous lock, removals, hand-edited marker
 * blocks and settings entries, and the two files regenerated around what is already there — the
 * managed `.gitignore` block and `.claude/.env.example`.
 */
export async function buildPlan(input: {
  manifest: CliManifest
  /** The base URL the manifest was fetched from — not what it advertises, which may be a mirror. */
  registry: string
  project: ProjectState
  answers: Record<string, string>
  bundles: string[]
  bundleFiles: Record<string, BundleFiles>
  force?: boolean
}): Promise<SetupPlan> {
  const { manifest, registry, project, answers, bundles, bundleFiles, force = false } = input
  // One render, shared with the web builder. `shared`/`local` are the settings halves the selected
  // bundles contribute and `contributions` the CLAUDE.md snippets — the same values `planFresh`
  // used, so the overlay below can never disagree with what it rendered.
  const { plan: fresh, shared, local, contributions, contributionWarnings } = renderFresh({ manifest, projectName: project.name, answers, bundles, bundleFiles, registry })
  // Render warnings first; the contribution ones go in after the removals, where they always were.
  const warnings = [...fresh.warnings]
  const prev = project.lock
  // `fresh.lock` already records every rendered file; only classification changes an entry below.
  const lock = fresh.lock

  const classify = async (path: string, bytes: Uint8Array, prevHash: string | undefined): Promise<FileOp['action']> => {
    const current = await project.files(path)
    if (current === null) return 'create'
    const currentHash = sha256(current)
    if (currentHash === sha256(bytes)) return 'unchanged'
    if (prevHash === undefined) return 'conflict' // exists but we never installed it
    if (currentHash !== prevHash && !force) return 'protected' // hand-edited since install
    return 'update'
  }

  const files: FileOp[] = []
  for (const op of fresh.files) {
    const slug = op.owner.startsWith('bundle:') ? op.owner.slice('bundle:'.length) : null
    const record = slug === null ? lock.scaffolds : lock.bundles[slug]!.files
    const prevHash = slug === null ? prev?.scaffolds[op.path] : prev?.bundles[slug]?.files[op.path]
    const classified = await classify(op.path, op.bytes, prevHash)
    // A scaffold is a starting point the user edits: never overwrite an existing one unless forced.
    const action = slug === null && classified === 'update' && !force ? 'protected' : classified
    files.push({ ...op, action })
    // A conflicting path is someone else's file: never claim it in the lock.
    if (action === 'conflict') delete record[op.path]
    else if (action === 'protected') record[op.path] = prevHash ?? sha256(op.bytes)
  }

  // Everything the previous lock owned that this plan does not re-render → removals (only if
  // untouched). That covers a dropped bundle and a file a still-selected bundle stopped shipping
  // (an upstream rename), which would otherwise sit on disk forever, owned by nobody.
  const removals: string[] = []
  const seen = new Set(files.map(f => f.path))
  for (const [, entry] of Object.entries(prev?.bundles ?? {}).sort(byKey)) {
    for (const [path, hash] of Object.entries(entry.files).sort(byKey)) {
      // A path this plan installs is not a leftover, and two bundles may have shipped the same file.
      if (seen.has(path)) continue
      seen.add(path)
      const current = await project.files(path)
      if (current === null) continue
      if (sha256(current) === hash) removals.push(path)
      else warnings.push(`${path} was modified after install; left in place (remove it by hand)`)
    }
  }

  // CLAUDE.md, recomposed onto the project's own file: the contributions are the rendered ones,
  // with a hand-edited block folded back in below.
  warnings.push(...contributionWarnings)
  const sections = manifest.base?.sections
  const handEdited: string[] = []
  const contributing = new Set(contributions.map(c => c.sourceId))
  const existingBlocks = project.claudeMd ? findMarkerBlocks(project.claudeMd) : []
  for (const id of sourceIds(existingBlocks)) {
    const recorded = prev?.blocks[id]
    if (!recorded || recorded === hashForSource(existingBlocks, id)) continue
    // A hand-edited block whose source stopped contributing (its bundle was removed, or an answer
    // changed) is dropped: re-contributing it would resurrect what the user asked to take out.
    if (!contributing.has(id)) {
      warnings.push(`${id}: dropped a hand-edited block (recover it from git)`)
      continue
    }
    handEdited.push(id)
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
  lock.blocks = {}
  for (const id of sourceIds(composedBlocks)) {
    // A protected block keeps its previously recorded hash, so it stays protected next run.
    const kept = !force && handEdited.includes(id) ? prev?.blocks[id] : undefined
    lock.blocks[id] = kept ?? hashForSource(composedBlocks, id)
  }

  // Every contribution the previous lock recorded comes out before the new ones go in — of dropped
  // bundles (so their fail-closed hooks stop firing once their scripts are gone) and of kept ones
  // (so a changed hook or permission replaces the installed entry instead of accumulating).
  // Each half comes out of its own file only: `permissions.allow` is merged into settings.local.json
  // and hooks/`permissions.deny` into settings.json, so subtracting a contribution from both files
  // would delete a byte-identical entry the user had added to the other one by hand.
  const previous = Object.values(prev?.bundles ?? {}).map(b => b.settings).filter((c): c is LockSettings => c !== undefined)
  const strip = (existing: Json | null, half: (c: LockSettings) => SettingsContribution): Json | null =>
    (existing === null ? null : previous.reduce((acc, c) => subtractSettings(acc, half(c)), existing))
  const settings = settingsFileFor(project.settings, mergeSettings(strip(project.settings, c => c.shared), shared))
  const settingsLocal = settingsFileFor(project.settingsLocal, mergeSettings(strip(project.settingsLocal, c => c.local), local))

  // The managed .gitignore block, regenerated in place: what is outside it is the user's, and an
  // unterminated block leaves the whole file alone with a warning rather than risk eating lines.
  const gitignore = gitignoreFileFor(project.gitignore, gitignoreEntries({ settingsLocal, lock }))
  warnings.push(...gitignore.warnings)

  // .claude/.env.example is entirely ours, so it is only ever deleted when it is byte-identical to
  // the one we wrote. `.claude/.env` itself is never read, written or removed.
  const envContent = renderEnvExample(envGroups(manifest, bundles))
  let envExample: SetupPlan['envExample'] = null
  let envExampleRemove = false
  if (envContent !== null) {
    envExample = { content: envContent, changed: envContent !== (project.envExample ?? '') }
    lock.envExample = sha256(envContent)
  } else if (project.envExample !== null) {
    if (prev?.envExample !== undefined && sha256(project.envExample) === prev.envExample) envExampleRemove = true
    else warnings.push(`${ENV_EXAMPLE_PATH} was modified after install; left in place`)
  }

  // Spelled out rather than spread over `fresh`: a field added to `SetupPlan` must be considered
  // here too, not silently inherit the value a fresh project would have got.
  return {
    files,
    removals,
    claudeMd: { content: claudeMd, changed: claudeMd !== (project.claudeMd ?? ''), handEdited },
    settings,
    settingsLocal,
    gitignore: gitignore.file,
    envExample,
    envExampleRemove,
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
